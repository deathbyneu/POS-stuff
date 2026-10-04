import { createHash } from "node:crypto";
import { z } from "zod";

export const idSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Mã định danh không hợp lệ");
const money = z.coerce.number().int().min(0).max(100_000_000);
const stock = z.coerce.number().int().min(0).max(1_000_000);
const shortText = z.string().trim().min(1).max(160);
const imageUrl = z.union([
  z.string().url().max(1500),
  z
    .string()
    .regex(
      /^\/uploads\/products\/[a-zA-Z0-9._-]+$/,
      "Đường dẫn ảnh tải lên không hợp lệ",
    ),
  z.literal(""),
  z.null(),
]);
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(100),
});
export const categorySchema = z.object({
  name: shortText,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563eb"),
  icon: z.string().min(1).max(40).default("Package"),
});
export const productSchema = z.object({
  name: shortText,
  sku: z.string().trim().min(1).max(50),
  barcode: z.string().trim().min(1).max(80),
  price: money.positive(),
  cost: money.default(0),
  stock: stock.default(0),
  minStock: stock.default(10),
  active: z.boolean().default(true),
  categoryId: idSchema,
  emoji: z.string().min(1).max(20).default("📦"),
  imageUrl: imageUrl.optional(),
});
export const productUpdateSchema = productSchema
  .partial()
  .omit({ stock: true });
export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: idSchema,
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
  method: z.enum(["QR", "CASH"]),
  source: z.enum(["KIOSK", "CASHIER"]),
  customerId: idSchema.optional().nullable(),
  requestId: z
    .string()
    .min(20)
    .max(128)
    .regex(/^[\w-]+$/),
});
export const customerSchema = z.object({
  name: shortText,
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s.-]{7,19}$/, "Số điện thoại không hợp lệ"),
  email: z
    .union([z.string().trim().email().max(160), z.literal("")])
    .default(""),
});
export const userSchema = z.object({
  name: shortText,
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
  active: z.boolean().default(true),
});
export const userUpdateSchema = userSchema.partial();
export const storeSchema = z.object({
  name: shortText,
  address: z.string().trim().max(300),
  phone: z.string().trim().max(30),
  receiptNote: z.string().trim().max(500),
});
export const adjustSchema = z
  .object({
    productId: idSchema,
    quantity: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((v) => v !== 0, "Số lượng điều chỉnh phải khác 0"),
    type: z.enum(["PURCHASE", "ADJUSTMENT", "DAMAGE"]).default("ADJUSTMENT"),
    note: z.string().trim().min(3).max(300),
    batchCode: z.string().trim().min(1).max(80).optional(),
    lotId: idSchema.optional(),
    manufacturedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sản xuất không hợp lệ")
      .optional()
      .or(z.literal("")),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Hạn sử dụng không hợp lệ")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.type === "PURCHASE" && value.quantity < 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Nhập hàng phải có số lượng dương",
      });
    if (value.type === "DAMAGE" && value.quantity < 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Số lượng xuất hủy phải lớn hơn 0",
      });
    if (value.type === "PURCHASE" && !value.batchCode)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batchCode"],
        message: "Nhập hàng phải có mã lô",
      });
    if (value.type === "DAMAGE" && !value.lotId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lotId"],
        message: "Hãy chọn lô cần xuất hủy",
      });
    if (
      value.manufacturedAt &&
      value.expiryDate &&
      value.manufacturedAt > value.expiryDate
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "Hạn sử dụng phải sau ngày sản xuất",
      });
  });

const purchaseLineSchema = z
  .object({
    productId: idSchema,
    quantity: z.number().int().min(1).max(1_000_000),
    batchCode: z.string().trim().min(1).max(80),
    unitCost: money,
    manufacturedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sản xuất không hợp lệ")
      .optional()
      .or(z.literal("")),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Hạn sử dụng không hợp lệ")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (
      value.manufacturedAt &&
      value.expiryDate &&
      value.manufacturedAt > value.expiryDate
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "Hạn sử dụng phải sau ngày sản xuất",
      });
  });

export const purchaseReceiptSchema = z
  .object({
    supplier: z.string().trim().max(160).default(""),
    reference: z.string().trim().max(80).default(""),
    note: z.string().trim().min(3).max(300),
    lines: z.array(purchaseLineSchema).min(1).max(100),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.lines.forEach((line, index) => {
      const key = `${line.productId}:${line.batchCode.toLocaleLowerCase("vi-VN")}`;
      if (seen.has(key))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index, "batchCode"],
          message: "Sản phẩm và mã lô bị lặp trong cùng phiếu",
        });
      seen.add(key);
    });
  });

export function normalizeItems(
  items: { productId: string; quantity: number }[],
) {
  const map = new Map<string, number>();
  for (const item of items)
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
  if ([...map.values()].some((q) => q > 100))
    throw new Error("Mỗi sản phẩm tối đa 100 đơn vị trong một đơn hàng");
  return [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }));
}

export function checkoutHash(data: z.infer<typeof checkoutSchema>) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        items: normalizeItems(data.items),
        method: data.method,
        source: data.source,
        customerId: data.customerId ?? null,
      }),
    )
    .digest("hex");
}
