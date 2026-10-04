import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Order, Prisma } from "@prisma/client";
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db, HttpError, transaction } from "./db";
import {
  checkoutSchema,
  checkoutHash,
  idSchema,
  normalizeItems,
} from "./validation";
import { requireAdmin, requireAuth } from "./auth";
import { takeFromLots } from "./inventory";
import {
  cancelPayOSPayment,
  createPayOSPayment,
  getPayOSPayment,
  isPayOSNotFound,
  paymentMode,
  verifyPayOSWebhook,
} from "./payos";

export const ordersRouter = Router();
export const route =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const tokenSchema = z
  .string()
  .regex(/^[a-f\d]{48}$/, "Mã truy cập đơn hàng không hợp lệ");
const demoMode = paymentMode === "DEMO";

export function safeOrder(order: Order, withToken = false) {
  return {
    id: order.id,
    code: order.code,
    total: order.total,
    status: order.status,
    method: order.method,
    source: order.source,
    customerId: order.customerId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
    refundedAt: order.refundedAt,
    expiresAt: order.expiresAt,
    items: order.items.map(({ cost: _cost, ...item }) => item),
    paymentMode,
    paymentProvider: order.paymentProvider ?? undefined,
    ...(withToken
      ? {
          token: order.receiptToken,
          qrData:
            order.paymentQrData ??
            (demoMode ? `ER-DEMO:${order.code}:${order.total}:VND` : undefined),
          paymentLinkId: order.paymentLinkId ?? undefined,
        }
      : {}),
  };
}

function checkToken(order: Order, input: unknown) {
  const token = tokenSchema.parse(input);
  const expected = Buffer.from(order.receiptToken);
  const actual = Buffer.from(token);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new HttpError(403, "Bạn không có quyền truy cập đơn hàng này");
}

async function restoreItems(
  tx: Prisma.TransactionClient,
  order: Order,
  type: "RELEASE" | "REFUND",
  note: string,
) {
  const allocations = await tx.inventoryAllocation.findMany({
    where: { orderId: order.id },
  });
  for (const item of order.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
    const itemAllocations = allocations.filter(
      (allocation) => allocation.productId === item.productId,
    );
    if (itemAllocations.length) {
      for (const allocation of itemAllocations) {
        await tx.inventoryLot.update({
          where: { id: allocation.lotId },
          data: { quantity: { increment: allocation.quantity } },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            productName: item.name,
            quantity: allocation.quantity,
            type,
            note,
            orderId: order.id,
            lotId: allocation.lotId,
            batchCode: allocation.batchCode,
          },
        });
      }
    } else {
      const product = await tx.product.findUniqueOrThrow({
        where: { id: item.productId },
      });
      const batchCode = `RETURN-${product.sku}`;
      const lot = await tx.inventoryLot.upsert({
        where: { productId_batchCode: { productId: product.id, batchCode } },
        create: { productId: product.id, batchCode, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          type,
          note,
          orderId: order.id,
          lotId: lot.id,
          batchCode,
        },
      });
    }
  }
}

async function awardPoints(tx: Prisma.TransactionClient, order: Order) {
  if (order.customerId)
    await tx.customer.update({
      where: { id: order.customerId },
      data: { points: { increment: Math.floor(order.total / 10000) } },
    });
}

type ProviderPayment = {
  paymentLinkId?: string;
  reference?: string;
  amount?: number;
  status?: string;
};

async function completePaidOrder(id: string, payment: ProviderPayment = {}) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
    if (payment.amount !== undefined && payment.amount !== order.total)
      throw new HttpError(400, "Số tiền thanh toán không khớp đơn hàng");
    if (
      payment.paymentLinkId &&
      order.paymentLinkId &&
      payment.paymentLinkId !== order.paymentLinkId
    )
      throw new HttpError(400, "Mã thanh toán không khớp đơn hàng");
    const providerData = {
      ...(payment.paymentLinkId
        ? { paymentLinkId: payment.paymentLinkId }
        : {}),
      ...(payment.reference
        ? { paymentReference: payment.reference }
        : {}),
      ...(payment.amount !== undefined ? { paidAmount: payment.amount } : {}),
      providerStatus: payment.status ?? "PAID",
    };
    if (order.status === "COMPLETED") {
      return tx.order.update({ where: { id }, data: providerData });
    }
    if (order.status !== "PENDING") {
      return tx.order.update({
        where: { id },
        data: { ...providerData, providerStatus: "PAID_AFTER_CANCEL" },
      });
    }
    const updated = await tx.order.updateMany({
      where: { id, status: "PENDING" },
      data: {
        ...providerData,
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });
    if (updated.count) await awardPoints(tx, order);
    return tx.order.findUniqueOrThrow({ where: { id } });
  });
}

async function provisionPayOSPayment(order: Order) {
  const payment = await createPayOSPayment(order);
  const persisted = await db.order.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: {
      paymentLinkId: payment.paymentLinkId,
      paymentQrData: payment.qrCode,
      providerStatus: payment.status,
    },
  });
  if (payment.status === "PAID")
    return completePaidOrder(order.id, {
      paymentLinkId: payment.paymentLinkId,
      amount: payment.amount,
      status: payment.status,
    });
  if (!persisted.count) {
    try {
      await cancelPayOSPayment(
        order.providerOrderCode!,
        `Don khong con cho ${order.code}`,
      );
    } catch (err) {
      console.error(
        `payOS orphan cancellation ${order.code}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return db.order.findUniqueOrThrow({ where: { id: order.id } });
}

async function cancelProviderConfirmedOrder(order: Order, note: string) {
  return transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id } });
    if (!current || current.status !== "PENDING") return current ?? order;
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        providerStatus: "CANCELLED",
      },
    });
    if (updated.count) await restoreItems(tx, current, "RELEASE", note);
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

async function syncPayOSOrder(order: Order) {
  if (
    order.status !== "PENDING" ||
    order.paymentProvider !== "PAYOS" ||
    !order.providerOrderCode
  )
    return order;
  try {
    const payment = await getPayOSPayment(order.providerOrderCode);
    if (payment.status === "PAID")
      return completePaidOrder(order.id, {
        paymentLinkId: payment.id,
        reference: payment.transactions[0]?.reference,
        amount: payment.amountPaid || payment.amount,
        status: payment.status,
      });
    if (["CANCELLED", "EXPIRED", "FAILED"].includes(payment.status))
      return cancelProviderConfirmedOrder(
        order,
        `payOS ${payment.status.toLowerCase()} ${order.code}`,
      );
    if (payment.status !== order.providerStatus)
      return db.order.update({
        where: { id: order.id },
        data: { providerStatus: payment.status },
      });
  } catch (err) {
    console.error(
      `payOS status sync ${order.code}:`,
      err instanceof Error ? err.message : err,
    );
  }
  return order;
}

async function waitForPaymentProvision(id: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const order = await db.order.findUnique({ where: { id } });
    if (!order || order.status !== "PENDING" || order.paymentQrData)
      return order;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return db.order.findUnique({ where: { id } });
}

export async function expireOrder(id: string) {
  const initial = await db.order.findUnique({ where: { id } });
  if (!initial || initial.status !== "PENDING" || initial.expiresAt > new Date())
    return initial;
  if (initial.paymentProvider === "PAYOS" && initial.providerOrderCode) {
    try {
      const payment = await cancelPayOSPayment(
        initial.providerOrderCode,
        `Het han ${initial.code}`,
      );
      if (payment.status === "PAID")
        return completePaidOrder(initial.id, {
          paymentLinkId: payment.id,
          amount: payment.amountPaid || payment.amount,
          status: payment.status,
        });
      if (!["CANCELLED", "EXPIRED", "FAILED"].includes(payment.status))
        return initial;
    } catch (err) {
      if (isPayOSNotFound(err)) {
        // No provider payment exists for this deterministic order code, so it
        // is safe to continue with local expiry and release the reservation.
      } else {
        console.error(
          `payOS expiry cancellation ${initial.code}:`,
          err instanceof Error ? err.message : err,
        );
        // Do not release stock while the provider state is unknown: payment may
        // already be in flight. The sweeper will retry on its next pass.
        return initial;
      }
    }
  }
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order || order.status !== "PENDING" || order.expiresAt > new Date())
      return order;
    const claimed = await tx.order.updateMany({
      where: { id, status: "PENDING", expiresAt: { lte: new Date() } },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (claimed.count)
      await restoreItems(
        tx,
        order,
        "RELEASE",
        `Hết hạn thanh toán ${order.code}`,
      );
    return tx.order.findUnique({ where: { id } });
  });
}

export async function expirePendingOrders() {
  const expired = await db.order.findMany({
    where: { status: "PENDING", expiresAt: { lte: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const order of expired) await expireOrder(order.id);
}

ordersRouter.post(
  "/checkout",
  route(async (req, res) => {
    const input = checkoutSchema.parse(req.body);
    if (input.source === "CASHIER" && !req.user)
      throw new HttpError(401, "Đăng nhập để dùng quầy thu ngân");
    if (input.method === "CASH" && (!req.user || input.source !== "CASHIER"))
      throw new HttpError(
        403,
        "Thanh toán tiền mặt chỉ thực hiện tại quầy thu ngân",
      );
    if (input.customerId && !req.user)
      throw new HttpError(403, "Chỉ thu ngân được gắn khách hàng vào đơn");
    if (input.method === "QR" && paymentMode === "UNAVAILABLE")
      throw new HttpError(503, "Cổng thanh toán chưa được cấu hình");
    let items;
    try {
      items = normalizeItems(input.items);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
    const payloadHash = checkoutHash(input);
    await expirePendingOrders();
    const existing = await db.order.findUnique({
      where: { requestId: input.requestId },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new HttpError(
          409,
          "Mã yêu cầu đã được dùng cho một giỏ hàng khác",
        );
      const current =
        existing.paymentProvider === "PAYOS" &&
        existing.status === "PENDING" &&
        !existing.paymentQrData
          ? await waitForPaymentProvision(existing.id)
          : existing;
      if (
        current?.paymentProvider === "PAYOS" &&
        current.status === "PENDING" &&
        !current.paymentQrData
      ) {
        const provisioned = await provisionPayOSPayment(current);
        return res.json(safeOrder(provisioned, true));
      }
      return res.json(safeOrder(current ?? existing, true));
    }
    try {
      const order = await transaction(async (tx) => {
        if (
          input.customerId &&
          !(await tx.customer.findUnique({ where: { id: input.customerId } }))
        )
          throw new HttpError(400, "Khách hàng không tồn tại");
        const products = await tx.product.findMany({
          where: { id: { in: items.map((i) => i.productId) }, active: true },
        });
        const orderItems = [];
        const lotTakes = new Map<
          string,
          Awaited<ReturnType<typeof takeFromLots>>
        >();
        for (const item of items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product)
            throw new HttpError(
              400,
              "Có sản phẩm không tồn tại hoặc đã ngừng bán",
            );
          const change = await tx.product.updateMany({
            where: {
              id: product.id,
              active: true,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (change.count !== 1)
            throw new HttpError(
              409,
              `${product.name} không đủ tồn kho (còn ${product.stock})`,
            );
          lotTakes.set(
            product.id,
            await takeFromLots(tx, product.id, item.quantity, {
              sellableOnly: true,
            }),
          );
          orderItems.push({
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            quantity: item.quantity,
            price: product.price,
            cost: product.cost,
          });
        }
        const total = orderItems.reduce(
          (sum, item) => sum + item.quantity * item.price,
          0,
        );
        if (total > 2_000_000_000)
          throw new HttpError(400, "Giá trị đơn hàng vượt giới hạn");
        const now = new Date();
        const providerOrderCode =
          input.method === "QR" && paymentMode === "PAYOS"
            ? `${now.getTime()}${randomInt(10, 100)}`
            : null;
        const order = await tx.order.create({
          data: {
            code: `ER${now.toISOString().slice(2, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
            total,
            status: input.method === "CASH" ? "COMPLETED" : "PENDING",
            method: input.method,
            source: input.source,
            customerId: input.customerId ?? null,
            items: orderItems,
            receiptToken: randomBytes(24).toString("hex"),
            requestId: input.requestId,
            payloadHash,
            paymentProvider:
              input.method === "QR" ? paymentMode : "CASH",
            providerOrderCode,
            providerStatus:
              input.method === "QR" && paymentMode === "PAYOS"
                ? "CREATING"
                : null,
            expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
            paidAt: input.method === "CASH" ? now : null,
          },
        });
        for (const item of orderItems) {
          for (const take of lotTakes.get(item.productId) ?? []) {
            await tx.inventoryAllocation.create({
              data: {
                orderId: order.id,
                productId: item.productId,
                lotId: take.lotId,
                batchCode: take.batchCode,
                quantity: take.quantity,
              },
            });
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                productName: item.name,
                quantity: -take.quantity,
                type: input.method === "CASH" ? "SALE" : "RESERVE",
                note: `${input.method === "CASH" ? "Bán hàng" : "Giữ hàng chờ QR"} ${order.code}`,
                orderId: order.id,
                userId: req.user?.id,
                lotId: take.lotId,
                batchCode: take.batchCode,
              },
            });
          }
        }
        if (order.status === "COMPLETED") await awardPoints(tx, order);
        return order;
      });
      if (order.paymentProvider === "PAYOS") {
        try {
          const provisioned = await provisionPayOSPayment(order);
          return res.status(201).json(safeOrder(provisioned, true));
        } catch (err) {
          await db.order
            .update({
              where: { id: order.id },
              data: { providerStatus: "CREATE_FAILED" },
            })
            .catch(() => undefined);
          throw err;
        }
      }
      return res.status(201).json(safeOrder(order, true));
    } catch (err) {
      if (err instanceof HttpError && err.status >= 500) throw err;
      // A duplicate request can reach the stock check while the first transaction
      // is still committing. Give the idempotency record a brief chance to become
      // visible, regardless of whether Mongo reports a unique-key or stock conflict.
      for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt)
          await new Promise((resolve) => setTimeout(resolve, 25 * attempt));
        const order = await db.order.findUnique({
          where: { requestId: input.requestId },
        });
        if (order && order.payloadHash === payloadHash)
          return res.json(safeOrder(order, true));
      }
      throw err;
    }
  }),
);

ordersRouter.get(
  "/checkout/:id",
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    let order = await db.order.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
    checkToken(order, req.query.token);
    order = await syncPayOSOrder(order);
    if (order.status === "PENDING" && order.expiresAt <= new Date())
      order = await expireOrder(id);
    return res.json(safeOrder(order!, true));
  }),
);

ordersRouter.post(
  "/checkout/:id/pay",
  route(async (req, res) => {
    if (!demoMode)
      throw new HttpError(403, "Thanh toán mô phỏng chưa được bật");
    const id = idSchema.parse(req.params.id);
    const initial = await db.order.findUnique({ where: { id } });
    if (!initial) throw new HttpError(404, "Không tìm thấy đơn hàng");
    checkToken(initial, req.body.token);
    if (initial.status === "PENDING" && initial.expiresAt <= new Date()) {
      await expireOrder(id);
      throw new HttpError(409, "Đơn hàng đã hết hạn thanh toán");
    }
    const order = await transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id } });
      if (order.status === "COMPLETED") return order;
      if (order.status !== "PENDING")
        throw new HttpError(409, "Đơn hàng đã hủy hoặc hoàn tiền");
      const updated = await tx.order.updateMany({
        where: { id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "COMPLETED", paidAt: new Date() },
      });
      if (!updated.count)
        throw new HttpError(409, "Đơn hàng đã hết hạn hoặc đang được xử lý");
      await awardPoints(tx, order);
      return tx.order.findUniqueOrThrow({ where: { id } });
    });
    return res.json(safeOrder(order, true));
  }),
);

ordersRouter.post(
  "/payments/payos/webhook",
  route(async (req, res) => {
    if (paymentMode !== "PAYOS")
      throw new HttpError(503, "Cổng thanh toán payOS chưa được bật");
    let payment: Awaited<ReturnType<typeof verifyPayOSWebhook>>;
    try {
      payment = await verifyPayOSWebhook(req.body);
    } catch {
      throw new HttpError(400, "Chữ ký webhook payOS không hợp lệ");
    }
    // payOS sends a signed validation payload while registering the webhook.
    // A valid but unknown order must still receive HTTP 200.
    const order = await db.order.findFirst({
      where: { providerOrderCode: String(payment.orderCode) },
    });
    if (!order) return res.json({ success: true });
    if (payment.code !== "00" || payment.currency !== "VND")
      return res.json({ success: true });
    if (
      payment.amount !== order.total ||
      (order.paymentLinkId && payment.paymentLinkId !== order.paymentLinkId)
    ) {
      await db.order.update({
        where: { id: order.id },
        data: { providerStatus: "PAYMENT_MISMATCH" },
      });
      console.error(`payOS webhook mismatch for ${order.code}`);
      return res.status(400).json({ success: false });
    }
    const completed = await completePaidOrder(order.id, {
      paymentLinkId: payment.paymentLinkId,
      reference: payment.reference,
      amount: payment.amount,
      status: "PAID",
    });
    if (completed.status !== "COMPLETED")
      console.error(`payOS paid after cancellation for ${order.code}`);
    return res.json({ success: true });
  }),
);

ordersRouter.post(
  "/checkout/:id/cancel",
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const initial = await db.order.findUnique({ where: { id } });
    if (!initial) throw new HttpError(404, "Không tìm thấy đơn hàng");
    checkToken(initial, req.body.token);
    if (
      initial.status === "PENDING" &&
      initial.paymentProvider === "PAYOS" &&
      initial.providerOrderCode
    ) {
      let providerPayment;
      try {
        providerPayment = await cancelPayOSPayment(
          initial.providerOrderCode,
          `Khach huy ${initial.code}`,
        );
      } catch (err) {
        if (isPayOSNotFound(err)) {
          providerPayment = { status: "CANCELLED" };
        } else {
          console.error(
            `payOS customer cancellation ${initial.code}:`,
            err instanceof Error ? err.message : err,
          );
          throw new HttpError(
            502,
            "Chưa xác nhận được trạng thái với payOS. Vui lòng thử lại.",
          );
        }
      }
      if (providerPayment.status === "PAID") {
        const paid = await completePaidOrder(initial.id, {
          paymentLinkId: providerPayment.id,
          amount: providerPayment.amountPaid || providerPayment.amount,
          status: providerPayment.status,
        });
        return res.json(safeOrder(paid, true));
      }
      if (
        !["CANCELLED", "EXPIRED", "FAILED"].includes(providerPayment.status)
      )
        throw new HttpError(
          409,
          "Giao dịch đang được xử lý, chưa thể hủy",
        );
    }
    const order = await transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id } });
      if (order.status === "CANCELLED") return order;
      if (order.status !== "PENDING")
        throw new HttpError(409, "Chỉ có thể hủy đơn đang chờ thanh toán");
      const updated = await tx.order.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          providerStatus:
            order.paymentProvider === "PAYOS" ? "CANCELLED" : undefined,
        },
      });
      if (updated.count)
        await restoreItems(tx, order, "RELEASE", `Hủy đơn ${order.code}`);
      return tx.order.findUniqueOrThrow({ where: { id } });
    });
    return res.json(safeOrder(order, true));
  }),
);

ordersRouter.get(
  "/orders",
  requireAuth,
  route(async (req, res) => {
    const where: Prisma.OrderWhereInput = {};
    if (
      typeof req.query.status === "string" &&
      ["PENDING", "COMPLETED", "CANCELLED", "REFUNDED"].includes(
        req.query.status,
      )
    )
      where.status = req.query.status;
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return res.json(orders.map((order) => safeOrder(order)));
  }),
);

ordersRouter.get(
  "/orders/:id",
  requireAuth,
  route(async (req, res) => {
    const order = await db.order.findUnique({
      where: { id: idSchema.parse(req.params.id) },
    });
    if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
    return res.json(safeOrder(order));
  }),
);

ordersRouter.post(
  "/orders/:id/refund",
  requireAdmin,
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const order = await transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order) throw new HttpError(404, "Không tìm thấy đơn hàng");
      if (order.status === "REFUNDED") return order;
      if (order.status !== "COMPLETED")
        throw new HttpError(409, "Chỉ hoàn tiền cho đơn đã thanh toán");
      if (order.paymentProvider === "PAYOS")
        throw new HttpError(
          409,
          "payOS không hoàn chuyển khoản tự động. Hãy chuyển khoản hoàn tiền thủ công rồi cập nhật đối soát.",
        );
      const updated = await tx.order.updateMany({
        where: { id, status: "COMPLETED" },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      if (updated.count) {
        await restoreItems(tx, order, "REFUND", `Hoàn hàng ${order.code}`);
        if (order.customerId) {
          const customer = await tx.customer.findUnique({
            where: { id: order.customerId },
          });
          if (customer)
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                points: Math.max(
                  0,
                  customer.points - Math.floor(order.total / 10000),
                ),
              },
            });
        }
      }
      return tx.order.findUniqueOrThrow({ where: { id } });
    });
    return res.json(safeOrder(order));
  }),
);
