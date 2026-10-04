import { InventoryLot, Prisma, PrismaClient } from "@prisma/client";
import { HttpError } from "./db";

type Reader = PrismaClient | Prisma.TransactionClient;

export type LotTake = {
  lotId: string;
  batchCode: string;
  quantity: number;
  expiryDate: Date | null;
};

export function vietnamDayStart(date = new Date()) {
  const value = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return new Date(`${value}T00:00:00+07:00`);
}

export function inventoryDate(value?: string | null) {
  return value ? new Date(`${value}T00:00:00+07:00`) : null;
}

export function expiryInfo(expiryDate: Date | null) {
  if (!expiryDate)
    return { daysUntilExpiry: null, expiryStatus: "NO_EXPIRY" as const };
  const daysUntilExpiry = Math.round(
    (expiryDate.getTime() - vietnamDayStart().getTime()) / 86_400_000,
  );
  const expiryStatus =
    daysUntilExpiry < 0
      ? ("EXPIRED" as const)
      : daysUntilExpiry <= 7
        ? ("URGENT" as const)
        : daysUntilExpiry <= 30
          ? ("WARNING" as const)
          : ("OK" as const);
  return { daysUntilExpiry, expiryStatus };
}

function fefo(a: InventoryLot, b: InventoryLot) {
  if (a.expiryDate && b.expiryDate)
    return a.expiryDate.getTime() - b.expiryDate.getTime();
  if (a.expiryDate) return -1;
  if (b.expiryDate) return 1;
  return a.receivedAt.getTime() - b.receivedAt.getTime();
}

export async function takeFromLots(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
  options: { sellableOnly?: boolean; lotId?: string } = {},
) {
  const lots = await tx.inventoryLot.findMany({
    where: {
      productId,
      quantity: { gt: 0 },
      ...(options.lotId ? { id: options.lotId } : {}),
    },
  });
  if (options.sellableOnly) {
    const today = vietnamDayStart();
    for (let index = lots.length - 1; index >= 0; index--)
      if (lots[index].expiryDate && lots[index].expiryDate! < today)
        lots.splice(index, 1);
  }
  lots.sort(fefo);
  if (lots.reduce((sum, lot) => sum + lot.quantity, 0) < quantity)
    throw new HttpError(
      409,
      options.sellableOnly
        ? "Không đủ hàng còn hạn sử dụng để bán"
        : "Lô được chọn không đủ số lượng",
    );
  let remaining = quantity;
  const takes: LotTake[] = [];
  for (const lot of lots) {
    if (!remaining) break;
    const take = Math.min(remaining, lot.quantity);
    const changed = await tx.inventoryLot.updateMany({
      where: { id: lot.id, quantity: { gte: take } },
      data: { quantity: { decrement: take } },
    });
    if (!changed.count)
      throw new HttpError(409, "Lô hàng vừa thay đổi. Vui lòng thử lại");
    takes.push({
      lotId: lot.id,
      batchCode: lot.batchCode,
      quantity: take,
      expiryDate: lot.expiryDate,
    });
    remaining -= take;
  }
  return takes;
}

export async function availableStockMap(reader: Reader, productIds: string[]) {
  const result = new Map<string, number>();
  if (!productIds.length) return result;
  const lots = await reader.inventoryLot.findMany({
    where: {
      productId: { in: productIds },
      quantity: { gt: 0 },
    },
    select: { productId: true, quantity: true, expiryDate: true },
  });
  const today = vietnamDayStart();
  for (const lot of lots) {
    if (lot.expiryDate && lot.expiryDate < today) continue;
    result.set(lot.productId, (result.get(lot.productId) ?? 0) + lot.quantity);
  }
  return result;
}
