import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.BASE_URL || "http://localhost:3000";
let passed = 0;
function check(condition, label) {
  assert.ok(condition, label);
  console.log(`PASS ${++passed}: ${label}`);
}
function client() {
  let cookie = "";
  return async (path, body, method = body === undefined ? "GET" : "POST") => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return { status: res.status, ok: res.ok, data: await res.json() };
  };
}
const admin = client(),
  staff = client(),
  guest = client();
check((await guest("/health")).ok, "Web proxy reaches API and real database");
check(
  (await guest("/orders")).status === 401,
  "Anonymous users cannot list orders",
);
check(
  (await guest("/users")).status === 401,
  "Anonymous users cannot list accounts",
);
check(
  (
    await admin("/auth/login", {
      email: "admin@easyretail.local",
      password: "EasyRetail@2026",
    })
  ).ok,
  "Admin cookie login",
);
check(
  (
    await staff("/auth/login", {
      email: "staff@easyretail.local",
      password: "EasyRetail@2026",
    })
  ).ok,
  "Staff cookie login",
);
check(
  (await staff("/users")).status === 403,
  "Staff cannot list privileged user accounts",
);
const categories = (await admin("/categories")).data;
check(
  Array.isArray(categories) && categories.length > 0,
  "Seed categories are persisted",
);
const unique = randomUUID().slice(0, 8);
const lotCode = `QA-LOT-${unique}`;
const futureExpiry = new Date(Date.now() + 10 * 86400000)
  .toISOString()
  .slice(0, 10);
const pastExpiry = new Date(Date.now() - 2 * 86400000)
  .toISOString()
  .slice(0, 10);
const created = await admin("/products", {
  name: `Kiểm thử giao dịch ${unique}`,
  sku: `QA-${unique}`,
  barcode: `QA${unique}`,
  price: 15000,
  cost: 10000,
  stock: 3,
  minStock: 1,
  active: true,
  categoryId: categories[0].id,
  emoji: "🧪",
});
check(created.ok && created.data.id, "Create product via administrative API");
const product = created.data;
const getStock = async () =>
  (await admin("/inventory")).data.find((p) => p.id === product.id)?.stock;
const orderBody = (quantity = 1) => ({
  items: [{ productId: product.id, quantity }],
  method: "QR",
  source: "KIOSK",
  requestId: randomUUID(),
});
const negative = await guest("/checkout", orderBody(-1));
check(
  negative.status === 400 && (await getStock()) === 3,
  "Negative quantity rejected without stock mutation",
);
const fractional = await guest("/checkout", orderBody(0.5));
check(fractional.status === 400, "Fractional quantity rejected");
check(
  (await guest("/checkout", { ...orderBody(), method: "CASH" })).status >= 400,
  "Anonymous cash checkout rejected",
);
check(
  (await staff(`/products/${product.id}`, { price: 1 }, "PATCH")).status ===
    403,
  "Staff cannot change product price",
);

const req = orderBody(2);
const twins = await Promise.all([
  guest("/checkout", req),
  guest("/checkout", req),
]);
check(
  twins.every((r) => r.ok) && twins[0].data.id === twins[1].data.id,
  "Concurrent duplicate checkout produces one order",
);
const order = twins[0].data;
check(
  order.total === 30000 && (await getStock()) === 1,
  "Server computes price and reserves stock exactly once",
);
check(
  (await guest(`/checkout/${order.id}?token=forged-token`)).status >= 400,
  "Receipt cannot be accessed with a forged token",
);
check(
  (await guest(`/checkout/${order.id}/pay`, { token: "forged-token" }))
    .status >= 400,
  "Forged payment token rejected",
);
check(
  (await guest("/checkout", orderBody(2))).status >= 400 &&
    (await getStock()) === 1,
  "Insufficient stock cannot oversell",
);
const payments = await Promise.all([
  guest(`/checkout/${order.id}/pay`, { token: order.token }),
  guest(`/checkout/${order.id}/pay`, { token: order.token }),
]);
check(
  payments.every((r) => r.ok && r.data.status === "COMPLETED"),
  "Duplicate demo payment is idempotent",
);
check(
  (await getStock()) === 1,
  "Payment confirmation does not deduct inventory twice",
);
check(
  (await staff(`/orders/${order.id}/refund`, {})).status === 403,
  "Staff cannot refund orders",
);
const refunds = await Promise.all([
  admin(`/orders/${order.id}/refund`, {}),
  admin(`/orders/${order.id}/refund`, {}),
]);
check(
  refunds.every((r) => r.ok) && (await getStock()) === 3,
  "Duplicate refund restores stock once",
);

const competing = await Promise.all([
  guest("/checkout", orderBody(3)),
  guest("/checkout", orderBody(3)),
]);
check(
  competing.filter((r) => r.ok).length === 1 && (await getStock()) === 0,
  "Concurrent distinct orders cannot oversell final units",
);
const pending = competing.find((r) => r.ok).data;
const cancels = await Promise.all([
  guest(`/checkout/${pending.id}/cancel`, { token: pending.token }),
  guest(`/checkout/${pending.id}/cancel`, { token: pending.token }),
]);
check(
  cancels.every((r) => r.ok) && (await getStock()) === 3,
  "Duplicate cancellation releases reserved stock once",
);

const cash = await staff("/checkout", {
  ...orderBody(),
  method: "CASH",
  source: "CASHIER",
});
check(
  cash.ok && cash.data.status === "COMPLETED" && (await getStock()) === 2,
  "Staff cash checkout completes and updates stock",
);
check(
  (await admin(`/orders/${cash.data.id}/refund`, {})).ok &&
    (await getStock()) === 3,
  "Cash refund restores inventory",
);
check(
  (
    await admin("/inventory/adjust", {
      productId: product.id,
      quantity: 5,
      note: "Kiểm thử nhập kho",
    })
  ).ok && (await getStock()) === 8,
  "Manual stock adjustment persists",
);
check(
  (
    await admin("/inventory/adjust", {
      productId: product.id,
      quantity: -9,
      note: "Kiểm thử tồn âm",
    })
  ).status >= 400 && (await getStock()) === 8,
  "Adjustment cannot create negative stock",
);
check(
  (
    await admin("/inventory/adjust", {
      productId: product.id,
      quantity: 1,
      type: "PURCHASE",
      note: "Kiểm thử lô đã hết hạn",
      batchCode: `QA-PAST-${unique}`,
      expiryDate: pastExpiry,
    })
  ).status === 400 && (await getStock()) === 8,
  "Expired lots cannot be received into inventory",
);
check(
  (
    await admin("/inventory/purchases", {
      supplier: "Nhà cung cấp kiểm thử",
      reference: `QA-${unique}`,
      note: "Kiểm thử phiếu nhập nhiều lô",
      lines: [
        {
          productId: product.id,
          quantity: 2,
          unitCost: 9500,
          batchCode: lotCode,
          expiryDate: futureExpiry,
        },
      ],
    })
  ).ok && (await getStock()) === 10,
  "Goods receipt increases inventory atomically",
);
const receiptHistory = (await admin("/inventory/purchases")).data;
check(
  receiptHistory.some(
    (receipt) =>
      receipt.reference === `QA-${unique}` && receipt.totalQuantity === 2,
  ),
  "Goods receipt history preserves supplier and document reference",
);
const lotsAfterPurchase = (
  await admin(`/inventory/lots?productId=${product.id}`)
).data;
const purchasedLot = lotsAfterPurchase.find((lot) => lot.batchCode === lotCode);
check(
  purchasedLot?.quantity === 2 && purchasedLot?.daysUntilExpiry >= 9,
  "Purchase creates a dated inventory lot",
);
check(
  (
    await admin("/inventory/adjust", {
      productId: product.id,
      quantity: 1,
      type: "DAMAGE",
      note: "Kiểm thử nghiệp vụ xuất hủy",
      lotId: purchasedLot.id,
    })
  ).ok && (await getStock()) === 9,
  "Damage write-off decreases the selected lot",
);
const fefoSale = await staff("/checkout", {
  ...orderBody(),
  method: "CASH",
  source: "CASHIER",
});
check(
  fefoSale.ok && (await getStock()) === 8,
  "Sale succeeds with lot-level inventory",
);
let lotMovements = (await admin("/inventory/movements")).data;
check(
  lotMovements.some(
    (movement) =>
      movement.orderId === fefoSale.data.id &&
      movement.type === "SALE" &&
      movement.batchCode === lotCode,
  ),
  "FEFO sale consumes the dated lot before non-expiring stock",
);
check(
  (await admin(`/orders/${fefoSale.data.id}/refund`, {})).ok &&
    (await getStock()) === 9,
  "Refund restores inventory to the allocated lot",
);
const movements = (await admin("/inventory/movements")).data;
check(
  movements.some((m) => m.productId === product.id),
  "Inventory movements preserve transaction audit history",
);
check(
  movements.some((m) => m.productId === product.id && m.type === "PURCHASE") &&
    movements.some((m) => m.productId === product.id && m.type === "DAMAGE"),
  "Inventory history identifies purchase and damage operations",
);
const dashboard = (await admin("/dashboard")).data;
check(
  typeof dashboard.revenue === "number" &&
    typeof dashboard.grossProfit === "number" &&
    typeof dashboard.grossMargin === "number" &&
    Array.isArray(dashboard.chart),
  "Dashboard reads revenue, cost and gross-profit aggregates",
);
check(
  (await admin(`/products/${product.id}`, undefined, "DELETE")).ok,
  "Archive test product",
);
const catalog = (await guest("/products")).data;
check(
  !catalog.some((p) => p.id === product.id && p.active),
  "Archived product unavailable to kiosk",
);
check(
  catalog.every((p) => p.cost === undefined),
  "Public catalog does not reveal purchase costs",
);
console.log(`\n${passed} integration checks passed against ${base}.`);
