import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, Product } from "@prisma/client";
import { ZodError, z } from "zod";
import { db, HttpError, transaction } from "./db";
import {
  cookieName,
  cookieOptions,
  jwtSecret,
  optionalAuth,
  requireAdmin,
  requireAuth,
  userSelect,
} from "./auth";
import {
  adjustSchema,
  categorySchema,
  customerSchema,
  idSchema,
  loginSchema,
  productSchema,
  productUpdateSchema,
  purchaseReceiptSchema,
  storeSchema,
  userSchema,
  userUpdateSchema,
} from "./validation";
import { expirePendingOrders, ordersRouter, route, safeOrder } from "./orders";
import { confirmPayOSWebhook, paymentMode } from "./payos";
import { geminiRouter } from "./gemini";
import {
  availableStockMap,
  expiryInfo,
  inventoryDate,
  takeFromLots,
  vietnamDayStart,
} from "./inventory";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const uploadRoot = path.resolve(
  process.env.UPLOAD_ROOT ?? path.join(process.cwd(), "uploads"),
);
const productUploadDir = path.join(uploadRoot, "products");
mkdirSync(productUploadDir, { recursive: true });
const origins = (
  process.env.CORS_ORIGIN ??
  "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const publicAppOrigin = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "");
if (publicAppOrigin && !origins.includes(publicAppOrigin))
  origins.push(publicAppOrigin);
app.use(helmet());
app.use(
  "/uploads",
  express.static(uploadRoot, {
    index: false,
    dotfiles: "deny",
    maxAge: "30d",
    immutable: true,
  }),
);
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || origins.includes(origin)),
    credentials: true,
  }),
);
app.use(express.json({ limit: "150kb" }));
app.use(cookieParser());
app.use((req, _res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    !origins.includes(req.headers.origin)
  )
    return next(new HttpError(403, "Nguồn yêu cầu không được phép"));
  next();
});
app.get(
  "/api/health",
  route(async (_req, res) => {
    await db.$runCommandRaw({ ping: 1 });
    return res.json({
      status: "ok",
      database: "connected",
      app: "EasyRetail",
      paymentMode,
      timestamp: new Date().toISOString(),
    });
  }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 500,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
  }),
  optionalAuth,
);
const authLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Bạn đăng nhập quá nhiều lần. Hãy thử lại sau 15 phút." },
});

function detectImageExtension(buffer: Buffer) {
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "png";
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return "jpg";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

app.post(
  "/api/auth/login",
  authLimit,
  route(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (
      !user ||
      !user.active ||
      !(await bcrypt.compare(input.password, user.passwordHash))
    )
      throw new HttpError(401, "Email hoặc mật khẩu không đúng");
    const token = jwt.sign({}, jwtSecret, {
      subject: user.id,
      algorithm: "HS256",
      expiresIn: "12h",
    });
    res.cookie(cookieName, token, {
      ...cookieOptions,
      maxAge: 12 * 60 * 60 * 1000,
    });
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    });
  }),
);
app.get("/api/auth/me", requireAuth, (req, res) =>
  res.json({ user: req.user }),
);
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(cookieName, cookieOptions);
  res.json({ message: "Đã đăng xuất" });
});

app.post(
  "/api/uploads/product-image",
  requireAdmin,
  express.raw({
    type: ["image/png", "image/jpeg", "image/webp"],
    limit: "3mb",
  }),
  route(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 32)
      throw new HttpError(400, "Tệp ảnh trống hoặc không hợp lệ");
    const extension = detectImageExtension(req.body);
    if (!extension)
      throw new HttpError(400, "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP hợp lệ");
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    await writeFile(path.join(productUploadDir, filename), req.body, {
      flag: "wx",
    });
    return res.status(201).json({ imageUrl: `/uploads/products/${filename}` });
  }),
);

function safeProduct<T extends Product>(product: T, authenticated: boolean) {
  if (authenticated) return product;
  const { cost: _cost, ...publicProduct } = product;
  return publicProduct;
}

app.get(
  "/api/products",
  route(async (req, res) => {
    const products = await db.product.findMany({
      where: req.user ? {} : { active: true },
      include: { category: true },
      orderBy: { name: "asc" },
    });
    const available = await availableStockMap(
      db,
      products.map((product) => product.id),
    );
    return res.json(
      products.map((product) =>
        safeProduct(
          { ...product, availableStock: available.get(product.id) ?? 0 },
          !!req.user,
        ),
      ),
    );
  }),
);
app.get(
  "/api/products/barcode/:barcode",
  route(async (req, res) => {
    const product = await db.product.findUnique({
      where: { barcode: req.params.barcode },
      include: { category: true },
    });
    if (!product || (!product.active && !req.user))
      throw new HttpError(404, "Không tìm thấy sản phẩm với mã vạch này");
    const available = await availableStockMap(db, [product.id]);
    return res.json(
      safeProduct(
        { ...product, availableStock: available.get(product.id) ?? 0 },
        !!req.user,
      ),
    );
  }),
);
app.post(
  "/api/products",
  requireAdmin,
  route(async (req, res) => {
    const input = productSchema.parse(req.body);
    if (!(await db.category.findUnique({ where: { id: input.categoryId } })))
      throw new HttpError(400, "Danh mục không tồn tại");
    const product = await transaction(async (tx) => {
      const product = await tx.product.create({
        data: { ...input, imageUrl: input.imageUrl || null },
        include: { category: true },
      });
      if (product.stock)
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            productName: product.name,
            quantity: product.stock,
            type: "OPENING",
            note: "Tồn kho khi tạo sản phẩm",
            userId: req.user!.id,
          },
        });
      if (product.stock) {
        const lot = await tx.inventoryLot.create({
          data: {
            productId: product.id,
            batchCode: `OPENING-${product.sku}`,
            quantity: product.stock,
          },
        });
        await tx.inventoryMovement.updateMany({
          where: {
            productId: product.id,
            type: "OPENING",
            lotId: null,
          },
          data: { lotId: lot.id, batchCode: lot.batchCode },
        });
      }
      return product;
    });
    return res.status(201).json(product);
  }),
);
const updateProduct = route(async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const input = productUpdateSchema.parse(req.body);
  if (
    input.categoryId &&
    !(await db.category.findUnique({ where: { id: input.categoryId } }))
  )
    throw new HttpError(400, "Danh mục không tồn tại");
  const product = await db.product.update({
    where: { id },
    data: {
      ...input,
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl || null }
        : {}),
    },
    include: { category: true },
  });
  return res.json(product);
});
app.patch("/api/products/:id", requireAdmin, updateProduct);
app.put("/api/products/:id", requireAdmin, updateProduct);
app.delete(
  "/api/products/:id",
  requireAdmin,
  route(async (req, res) => {
    return res.json(
      await db.product.update({
        where: { id: idSchema.parse(req.params.id) },
        data: { active: false },
        include: { category: true },
      }),
    );
  }),
);

app.get(
  "/api/categories",
  route(async (_req, res) =>
    res.json(await db.category.findMany({ orderBy: { name: "asc" } })),
  ),
);
app.post(
  "/api/categories",
  requireAdmin,
  route(async (req, res) =>
    res
      .status(201)
      .json(await db.category.create({ data: categorySchema.parse(req.body) })),
  ),
);
const updateCategory = route(async (req, res) =>
  res.json(
    await db.category.update({
      where: { id: idSchema.parse(req.params.id) },
      data: categorySchema.partial().parse(req.body),
    }),
  ),
);
app.patch("/api/categories/:id", requireAdmin, updateCategory);
app.put("/api/categories/:id", requireAdmin, updateCategory);
app.delete(
  "/api/categories/:id",
  requireAdmin,
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    if (await db.product.count({ where: { categoryId: id } }))
      throw new HttpError(409, "Danh mục còn sản phẩm nên chưa thể xóa");
    await db.category.delete({ where: { id } });
    return res.json({ message: "Đã xóa danh mục" });
  }),
);

app.get(
  "/api/inventory",
  requireAuth,
  route(async (_req, res) => {
    const products = await db.product.findMany({
      include: { category: true },
      orderBy: { name: "asc" },
    });
    const available = await availableStockMap(
      db,
      products.map((product) => product.id),
    );
    return res.json(
      products.map((product) => ({
        ...product,
        availableStock: available.get(product.id) ?? 0,
      })),
    );
  }),
);
app.get(
  "/api/inventory/lots",
  requireAuth,
  route(async (req, res) => {
    const productId = req.query.productId
      ? idSchema.parse(req.query.productId)
      : undefined;
    const lots = await db.inventoryLot.findMany({
      where: { productId, quantity: { gt: 0 } },
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { receivedAt: "desc" },
      take: 2000,
    });
    return res.json(
      lots
        .map((lot) => ({ ...lot, ...expiryInfo(lot.expiryDate) }))
        .sort((a, b) => {
          if (a.expiryDate && b.expiryDate)
            return a.expiryDate.getTime() - b.expiryDate.getTime();
          return a.expiryDate ? -1 : b.expiryDate ? 1 : 0;
        }),
    );
  }),
);
app.get(
  "/api/inventory/movements",
  requireAuth,
  route(async (req, res) => {
    const productId = req.query.productId
      ? idSchema.parse(req.query.productId)
      : undefined;
    return res.json(
      await db.inventoryMovement.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    );
  }),
);
app.get(
  "/api/inventory/purchases",
  requireAdmin,
  route(async (_req, res) =>
    res.json(
      await db.goodsReceipt.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ),
  ),
);
app.post(
  "/api/inventory/purchases",
  requireAdmin,
  route(async (req, res) => {
    const input = purchaseReceiptSchema.parse(req.body);
    const now = new Date();
    const code = `PN${now.toISOString().slice(2, 10).replace(/-/g, "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const receipt = await transaction(async (tx) => {
      let totalQuantity = 0;
      let totalCost = 0;
      const savedLines = [];
      for (const [index, line] of input.lines.entries()) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
        });
        if (!product)
          throw new HttpError(
            404,
            `Sản phẩm ở dòng ${index + 1} không tồn tại`,
          );

        const manufacturedAt = inventoryDate(line.manufacturedAt);
        const expiryDate = inventoryDate(line.expiryDate);
        if (expiryDate && expiryDate < vietnamDayStart())
          throw new HttpError(
            400,
            `Dòng ${index + 1}: không thể nhập lô đã hết hạn`,
          );
        if (manufacturedAt && manufacturedAt > new Date())
          throw new HttpError(
            400,
            `Dòng ${index + 1}: ngày sản xuất không thể ở tương lai`,
          );

        const changed = await tx.product.updateMany({
          where: {
            id: line.productId,
            stock: { lte: 1_000_000 - line.quantity },
          },
          data: {
            stock: { increment: line.quantity },
            cost: line.unitCost,
          },
        });
        if (!changed.count)
          throw new HttpError(
            409,
            `Dòng ${index + 1}: tồn kho sau khi nhập vượt quá 1.000.000`,
          );

        const existing = await tx.inventoryLot.findUnique({
          where: {
            productId_batchCode: {
              productId: line.productId,
              batchCode: line.batchCode,
            },
          },
        });
        if (
          existing &&
          ((existing.expiryDate?.getTime() ?? null) !==
            (expiryDate?.getTime() ?? null) ||
            (existing.manufacturedAt?.getTime() ?? null) !==
              (manufacturedAt?.getTime() ?? null))
        )
          throw new HttpError(
            409,
            `Dòng ${index + 1}: mã lô đã có ngày sản xuất hoặc hạn dùng khác`,
          );

        const lot = existing
          ? await tx.inventoryLot.update({
              where: { id: existing.id },
              data: { quantity: { increment: line.quantity } },
            })
          : await tx.inventoryLot.create({
              data: {
                productId: line.productId,
                batchCode: line.batchCode,
                quantity: line.quantity,
                manufacturedAt,
                expiryDate,
              },
            });
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            productName: product.name,
            quantity: line.quantity,
            type: "PURCHASE",
            note: `Phiếu ${code}${input.supplier ? ` · ${input.supplier}` : ""} · ${input.note}`.slice(
              0,
              300,
            ),
            userId: req.user!.id,
            lotId: lot.id,
            batchCode: lot.batchCode,
          },
        });
        totalQuantity += line.quantity;
        totalCost += line.quantity * line.unitCost;
        if (totalCost > 2_000_000_000)
          throw new HttpError(400, "Tổng giá trị phiếu nhập vượt giới hạn");
        savedLines.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          batchCode: line.batchCode,
          quantity: line.quantity,
          unitCost: line.unitCost,
          manufacturedAt,
          expiryDate,
        });
      }
      return tx.goodsReceipt.create({
        data: {
          code,
          supplier: input.supplier,
          reference: input.reference,
          note: input.note,
          totalQuantity,
          totalCost,
          lines: savedLines,
          userId: req.user!.id,
        },
      });
    });
    return res.status(201).json(receipt);
  }),
);
app.post(
  "/api/inventory/adjust",
  requireAdmin,
  route(async (req, res) => {
    const input = adjustSchema.parse(req.body);
    const stockChange = input.type === "DAMAGE" ? -input.quantity : input.quantity;
    const product = await transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
      });
      if (!product) throw new HttpError(404, "Sản phẩm không tồn tại");
      const changed = await tx.product.updateMany({
        where: {
          id: input.productId,
          stock:
            stockChange < 0
              ? { gte: -stockChange }
              : { lte: 1_000_000 - stockChange },
        },
        data: { stock: { increment: stockChange } },
      });
      if (!changed.count)
        throw new HttpError(
          409,
          "Tồn kho sau điều chỉnh phải từ 0 đến 1.000.000",
        );
      if (stockChange > 0) {
        const batchCode =
          input.type === "PURCHASE" ? input.batchCode! : `ADJUST-${Date.now()}`;
        const manufacturedAt = inventoryDate(input.manufacturedAt);
        const expiryDate = inventoryDate(input.expiryDate);
        if (expiryDate && expiryDate < vietnamDayStart())
          throw new HttpError(400, "Không thể nhập lô đã hết hạn");
        if (manufacturedAt && manufacturedAt > new Date())
          throw new HttpError(400, "Ngày sản xuất không thể ở tương lai");
        const existing = await tx.inventoryLot.findUnique({
          where: {
            productId_batchCode: { productId: product.id, batchCode },
          },
        });
        if (
          existing &&
          ((existing.expiryDate?.getTime() ?? null) !==
            (expiryDate?.getTime() ?? null) ||
            (existing.manufacturedAt?.getTime() ?? null) !==
              (manufacturedAt?.getTime() ?? null))
        )
          throw new HttpError(
            409,
            "Mã lô đã tồn tại với ngày sản xuất hoặc hạn dùng khác",
          );
        const lot = existing
          ? await tx.inventoryLot.update({
              where: { id: existing.id },
              data: { quantity: { increment: stockChange } },
            })
          : await tx.inventoryLot.create({
              data: {
                productId: product.id,
                batchCode,
                quantity: stockChange,
                manufacturedAt,
                expiryDate,
              },
            });
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            productName: product.name,
            quantity: stockChange,
            type: input.type,
            note: input.note,
            userId: req.user!.id,
            lotId: lot.id,
            batchCode: lot.batchCode,
          },
        });
      } else {
        const takes = await takeFromLots(tx, product.id, -stockChange, {
          lotId: input.type === "DAMAGE" ? input.lotId : undefined,
        });
        for (const take of takes)
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              productName: product.name,
              quantity: -take.quantity,
              type: input.type,
              note: input.note,
              userId: req.user!.id,
              lotId: take.lotId,
              batchCode: take.batchCode,
            },
          });
      }
      return tx.product.findUniqueOrThrow({
        where: { id: product.id },
        include: { category: true },
      });
    });
    return res.json(product);
  }),
);

app.get(
  "/api/customers",
  requireAuth,
  route(async (_req, res) =>
    res.json(
      await db.customer.findMany({
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
    ),
  ),
);
app.post(
  "/api/customers",
  requireAuth,
  route(async (req, res) =>
    res
      .status(201)
      .json(await db.customer.create({ data: customerSchema.parse(req.body) })),
  ),
);
app.patch(
  "/api/customers/:id",
  requireAuth,
  route(async (req, res) =>
    res.json(
      await db.customer.update({
        where: { id: idSchema.parse(req.params.id) },
        data: customerSchema.partial().parse(req.body),
      }),
    ),
  ),
);

app.get(
  "/api/users",
  requireAdmin,
  route(async (_req, res) =>
    res.json(
      await db.user.findMany({
        select: { ...userSelect, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ),
  ),
);
app.post(
  "/api/users",
  requireAdmin,
  route(async (req, res) => {
    const { password, ...input } = userSchema.parse(req.body);
    const user = await db.user.create({
      data: { ...input, passwordHash: await bcrypt.hash(password, 12) },
      select: userSelect,
    });
    return res.status(201).json(user);
  }),
);
app.patch(
  "/api/users/:id",
  requireAdmin,
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const { password, ...input } = userUpdateSchema.parse(req.body);
    if (
      id === req.user!.id &&
      (input.active === false || (input.role && input.role !== "ADMIN"))
    )
      throw new HttpError(
        400,
        "Bạn không thể vô hiệu hóa hoặc hạ quyền chính mình",
      );
    const data = {
      ...input,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
    };
    return res.json(
      await db.user.update({ where: { id }, data, select: userSelect }),
    );
  }),
);

app.get(
  "/api/store",
  route(async (_req, res) =>
    res.json(
      await db.store.upsert({ where: { key: "main" }, create: {}, update: {} }),
    ),
  ),
);
app.patch(
  "/api/store",
  requireAdmin,
  route(async (req, res) =>
    res.json(
      await db.store.upsert({
        where: { key: "main" },
        create: storeSchema.parse(req.body),
        update: storeSchema.partial().parse(req.body),
      }),
    ),
  ),
);

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), "Ngày không hợp lệ");
function vietnamDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
app.get(
  "/api/dashboard",
  requireAuth,
  route(async (req, res) => {
    const toDate = req.query.to
      ? dateString.parse(req.query.to)
      : vietnamDate(new Date());
    const fromDate = req.query.from
      ? dateString.parse(req.query.from)
      : vietnamDate(new Date(Date.now() - 6 * 86400000));
    const from = new Date(`${fromDate}T00:00:00+07:00`);
    const to = new Date(
      new Date(`${toDate}T00:00:00+07:00`).getTime() + 86400000,
    );
    if (from >= to || to.getTime() - from.getTime() > 367 * 86400000)
      throw new HttpError(
        400,
        "Khoảng báo cáo không hợp lệ hoặc vượt quá 366 ngày",
      );
    const [orders, products, recent, expiryLots] = await Promise.all([
      db.order.findMany({
        where: { status: "COMPLETED", createdAt: { gte: from, lt: to } },
      }),
      db.product.findMany({
        where: { active: true },
        include: { category: true },
      }),
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      db.inventoryLot.findMany({
        where: {
          quantity: { gt: 0 },
          expiryDate: {
            not: null,
            lte: new Date(Date.now() + 30 * 86_400_000),
          },
        },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { expiryDate: "asc" },
        take: 100,
      }),
    ]);
    const available = await availableStockMap(
      db,
      products.map((product) => product.id),
    );
    const chart = new Map<
      string,
      { date: string; revenue: number; orders: number }
    >();
    for (
      let timestamp = from.getTime();
      timestamp < to.getTime();
      timestamp += 86400000
    ) {
      const date = vietnamDate(new Date(timestamp));
      chart.set(date, { date, revenue: 0, orders: 0 });
    }
    const top = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    let revenue = 0;
    let costOfGoods = 0;
    for (const order of orders) {
      revenue += order.total;
      const day = chart.get(vietnamDate(order.createdAt));
      if (day) {
        day.revenue += order.total;
        day.orders++;
      }
      for (const item of order.items) {
        costOfGoods += item.cost * item.quantity;
        const product = top.get(item.productId) ?? {
          name: item.name,
          quantity: 0,
          revenue: 0,
        };
        product.quantity += item.quantity;
        product.revenue += item.quantity * item.price;
        top.set(item.productId, product);
      }
    }
    const grossProfit = revenue - costOfGoods;
    return res.json({
      revenue,
      grossProfit,
      grossMargin: revenue
        ? Math.round((grossProfit / revenue) * 1000) / 10
        : 0,
      ordersCount: orders.length,
      averageOrder: orders.length ? Math.round(revenue / orders.length) : 0,
      productsCount: products.length,
      lowStock: products
        .map((product) => ({
          ...product,
          stock: available.get(product.id) ?? 0,
          physicalStock: product.stock,
        }))
        .filter((product) => product.stock <= product.minStock)
        .sort((a, b) => a.stock - b.stock),
      expiryAlerts: expiryLots.map((lot) => ({
        id: lot.id,
        productId: lot.productId,
        productName: lot.product.name,
        sku: lot.product.sku,
        batchCode: lot.batchCode,
        quantity: lot.quantity,
        expiryDate: lot.expiryDate,
        ...expiryInfo(lot.expiryDate),
      })),
      chart: [...chart.values()],
      topProducts: [...top.values()]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 6),
      recentOrders: recent.map((order) => safeOrder(order)),
      paymentMode,
      from: fromDate,
      to: toDate,
    });
  }),
);

app.use("/api", geminiRouter);
app.use("/api", ordersRouter);
app.use((_req, _res, next) => next(new HttpError(404, "API không tồn tại")));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: err.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        message: "Mã vạch, SKU, email, số điện thoại hoặc tên đã tồn tại",
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Không tìm thấy bản ghi" });
      return;
    }
    if (err.code === "P2034") {
      res
        .status(409)
        .json({ message: "Dữ liệu vừa thay đổi. Vui lòng thử lại." });
      return;
    }
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ message: "Dữ liệu JSON không hợp lệ" });
    return;
  }
  console.error("API error:", err instanceof Error ? err.message : err);
  res.status(500).json({ message: "Hệ thống gặp lỗi, vui lòng thử lại" });
});

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, "0.0.0.0", () =>
  console.log(
    `EasyRetail API listening on port ${port}; payment=${paymentMode}`,
  ),
);
if (paymentMode === "PAYOS")
  void confirmPayOSWebhook()
    .then(() => console.log("payOS webhook registered"))
    .catch((err) =>
      console.error(
        "payOS webhook registration:",
        err instanceof Error ? err.message : err,
      ),
    );
let sweeping = false;
const sweep = async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    await expirePendingOrders();
  } catch (err) {
    console.error(
      "Pending-order expiry:",
      err instanceof Error ? err.message : err,
    );
  } finally {
    sweeping = false;
  }
};
void sweep();
const timer = setInterval(() => {
  void sweep();
}, 30_000);
timer.unref();
async function shutdown() {
  clearInterval(timer);
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
