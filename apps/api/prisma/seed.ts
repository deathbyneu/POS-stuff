import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const db = new PrismaClient();
const categories = [
  { key: "drink", name: "Đồ uống", color: "#2563eb", icon: "🥤" },
  { key: "snack", name: "Đồ ăn nhanh", color: "#f59e0b", icon: "🍪" },
  { key: "stationery", name: "Văn phòng phẩm", color: "#8b5cf6", icon: "✏️" },
  { key: "personal", name: "Tiện ích cá nhân", color: "#10b981", icon: "🧻" },
];
const products = [
  [
    "Nước khoáng Lavie 500ml",
    "NUOC-LAVIE",
    "8935001712112",
    8000,
    5000,
    46,
    12,
    "drink",
    "💧",
  ],
  [
    "Coca-Cola 390ml",
    "NUOC-COCA",
    "8935049501471",
    12000,
    8500,
    34,
    10,
    "drink",
    "🥤",
  ],
  [
    "Pepsi 390ml",
    "NUOC-PEPSI",
    "8934588012226",
    12000,
    8200,
    29,
    10,
    "drink",
    "🥤",
  ],
  [
    "Trà xanh Không Độ 455ml",
    "NUOC-TRAXANH",
    "8934563138163",
    12000,
    8000,
    21,
    8,
    "drink",
    "🍵",
  ],
  [
    "Cà phê sữa Birdy 170ml",
    "NUOC-CAFE",
    "8936036023273",
    15000,
    10500,
    18,
    6,
    "drink",
    "☕",
  ],
  [
    "Sữa tươi Vinamilk 180ml",
    "NUOC-SUA",
    "8934673570327",
    9000,
    6300,
    24,
    8,
    "drink",
    "🥛",
  ],
  [
    "Bánh Chocopie hộp 2 chiếc",
    "BANH-CHOCO",
    "8934564600065",
    14000,
    9500,
    22,
    7,
    "snack",
    "🍫",
  ],
  [
    "Bánh mì tươi Kinh Đô",
    "BANH-MITUOI",
    "8934680033129",
    12000,
    8000,
    15,
    6,
    "snack",
    "🥐",
  ],
  [
    "Mì ly Hảo Hảo tôm chua cay",
    "MI-HAOHAO",
    "8934563034250",
    13000,
    9000,
    30,
    10,
    "snack",
    "🍜",
  ],
  [
    "Snack Oishi phồng mực 45g",
    "SNACK-OISHI",
    "8934803029244",
    10000,
    6500,
    19,
    7,
    "snack",
    "🍿",
  ],
  [
    "Kẹo Mentos hương bạc hà",
    "KEO-MENTOS",
    "8935004600355",
    10000,
    6800,
    17,
    5,
    "snack",
    "🍬",
  ],
  [
    "Bút bi Thiên Long TL-027",
    "BUT-TL027",
    "8935001850272",
    5000,
    2800,
    52,
    15,
    "stationery",
    "🖊️",
  ],
  [
    "Bút chì 2B Thiên Long",
    "BUTCHI-2B",
    "8935001802028",
    6000,
    3200,
    25,
    8,
    "stationery",
    "✏️",
  ],
  [
    "Vở Campus 200 trang",
    "VO-CAMPUS200",
    "8936036270271",
    22000,
    15000,
    13,
    5,
    "stationery",
    "📓",
  ],
  [
    "Giấy note vàng 3x3",
    "NOTE-3X3",
    "6951234500019",
    15000,
    9000,
    9,
    5,
    "stationery",
    "🗒️",
  ],
  [
    "Thước kẻ 20cm",
    "THUOC-20",
    "8935001842208",
    7000,
    3500,
    18,
    6,
    "stationery",
    "📏",
  ],
  [
    "Khăn giấy bỏ túi Bless You",
    "KHAN-BLESS",
    "8934572148252",
    6000,
    3700,
    28,
    8,
    "personal",
    "🧻",
  ],
  [
    "Khẩu trang y tế gói 5 chiếc",
    "KHAUTRANG-5",
    "8938509123053",
    10000,
    5500,
    20,
    6,
    "personal",
    "😷",
  ],
  [
    "Áo mưa tiện lợi",
    "AOMUA-01",
    "8936054760013",
    15000,
    8500,
    11,
    5,
    "personal",
    "🌧️",
  ],
  [
    "Pin AAA Energizer vỉ 2 viên",
    "PIN-AAA2",
    "8888021300617",
    26000,
    18000,
    8,
    4,
    "personal",
    "🔋",
  ],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash("EasyRetail@2026", 12);
  const admin = await db.user.upsert({
    where: { email: "admin@easyretail.local" },
    create: {
      name: "Lê Triều Vỹ",
      email: "admin@easyretail.local",
      passwordHash,
      role: "ADMIN",
    },
    update: {},
  });
  await db.user.upsert({
    where: { email: "staff@easyretail.local" },
    create: {
      name: "Nguyễn Minh Anh",
      email: "staff@easyretail.local",
      passwordHash,
      role: "STAFF",
    },
    update: {},
  });
  await db.store.upsert({
    where: { key: "main" },
    create: {
      key: "main",
      name: "EasyRetail Store",
      address: "Điểm bán thử nghiệm",
      phone: "024 3628 0280",
      receiptNote: "Cảm ơn bạn đã sử dụng EasyRetail!",
    },
    update: {},
  });
  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const saved = await db.category.upsert({
      where: { name: category.name },
      create: {
        name: category.name,
        color: category.color,
        icon: category.icon,
      },
      update: {},
    });
    categoryMap.set(category.key, saved.id);
  }
  const savedProducts = [];
  for (const [
    name,
    sku,
    barcode,
    price,
    cost,
    stock,
    minStock,
    category,
    emoji,
  ] of products) {
    savedProducts.push(
      await db.product.upsert({
        where: { barcode },
        create: {
          name,
          sku,
          barcode,
          price,
          cost,
          stock,
          minStock,
          categoryId: categoryMap.get(category)!,
          emoji,
        },
        update: {},
      }),
    );
  }
  // Existing installations did not have lot-level inventory. Preserve their
  // current physical stock by placing only the unaccounted difference in a
  // non-expiring opening lot.
  for (const product of await db.product.findMany()) {
    const lots = await db.inventoryLot.findMany({
      where: { productId: product.id },
      select: { quantity: true },
    });
    const accounted = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const difference = product.stock - accounted;
    if (difference > 0) {
      const batchCode = `LEGACY-${product.sku}`;
      await db.inventoryLot.upsert({
        where: { productId_batchCode: { productId: product.id, batchCode } },
        create: { productId: product.id, batchCode, quantity: difference },
        update: { quantity: { increment: difference } },
      });
    }
  }
  const demoExpiryLots = [
    {
      barcode: "8934680033129",
      batchCode: "DEMO-BANHMI-EXP",
      quantity: 2,
      expiresInDays: -1,
    },
    {
      barcode: "8934673570327",
      batchCode: "DEMO-SUA-SOON",
      quantity: 4,
      expiresInDays: 5,
    },
    {
      barcode: "8934564600065",
      batchCode: "DEMO-CHOCO-30D",
      quantity: 5,
      expiresInDays: 20,
    },
  ];
  for (const sample of demoExpiryLots) {
    const product = savedProducts.find(
      (item) => item.barcode === sample.barcode,
    );
    if (!product) continue;
    const exists = await db.inventoryLot.findUnique({
      where: {
        productId_batchCode: {
          productId: product.id,
          batchCode: sample.batchCode,
        },
      },
    });
    if (exists) continue;
    const source = (
      await db.inventoryLot.findMany({
        where: {
          productId: product.id,
          quantity: { gte: sample.quantity },
        },
      })
    ).find((lot) => !lot.expiryDate);
    if (!source) continue;
    await db.$transaction(async (tx) => {
      await tx.inventoryLot.update({
        where: { id: source.id },
        data: { quantity: { decrement: sample.quantity } },
      });
      await tx.inventoryLot.create({
        data: {
          productId: product.id,
          batchCode: sample.batchCode,
          quantity: sample.quantity,
          manufacturedAt: new Date(Date.now() - 7 * 86_400_000),
          expiryDate: new Date(Date.now() + sample.expiresInDays * 86_400_000),
        },
      });
    });
  }
  const customer = await db.customer.upsert({
    where: { phone: "0912345678" },
    create: {
      name: "Trần Hà Linh",
      phone: "0912345678",
      email: "linh@example.com",
      points: 32,
    },
    update: {},
  });
  await db.customer.upsert({
    where: { phone: "0987654321" },
    create: {
      name: "Phạm Đức Nam",
      phone: "0987654321",
      email: "nam@example.com",
      points: 15,
    },
    update: {},
  });
  if ((await db.order.count()) === 0) {
    for (let day = 6; day >= 0; day--) {
      const createdAt = new Date(
        Date.now() - day * 86400000 - (day + 2) * 3600000,
      );
      const lines = [
        savedProducts[(day * 2) % savedProducts.length],
        savedProducts[(day * 2 + 3) % savedProducts.length],
      ];
      const items = lines.map((p, i) => ({
        productId: p.id,
        name: p.name,
        barcode: p.barcode,
        quantity: i + 1,
        price: p.price,
        cost: p.cost,
      }));
      const total = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const requestId = `seed-order-${day}-${createHash("sha1").update(String(createdAt)).digest("hex")}`;
      const order = await db.order.create({
        data: {
          code: `ER-DEMO-${String(7 - day).padStart(3, "0")}`,
          total,
          status: "COMPLETED",
          method: day % 2 ? "CASH" : "QR",
          source: "CASHIER",
          items,
          customerId: day === 2 ? customer.id : null,
          receiptToken: createHash("sha256")
            .update(requestId)
            .digest("hex")
            .slice(0, 48),
          requestId,
          payloadHash: createHash("sha256")
            .update(JSON.stringify(items))
            .digest("hex"),
          expiresAt: new Date(createdAt.getTime() + 600000),
          paidAt: createdAt,
          createdAt,
        },
      });
      for (const item of items)
        await db.inventoryMovement.create({
          data: {
            productId: item.productId,
            productName: item.name,
            quantity: -item.quantity,
            type: "SALE",
            note: `Dữ liệu demo ${order.code}`,
            orderId: order.id,
            userId: admin.id,
            createdAt,
          },
        });
    }
  }
  console.log(
    `Seed ready: ${await db.product.count()} products, ${await db.order.count()} orders.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
