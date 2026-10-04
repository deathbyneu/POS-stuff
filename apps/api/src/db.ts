import { Prisma, PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function transaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(fn, { maxWait: 5000, timeout: 15000 });
    } catch (err) {
      const transient =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === "P2034" ||
          (err.code === "P2028" &&
            /write conflict|transient|aborted/i.test(err.message)));
      if (!transient || attempt === 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 35 * (attempt + 1)));
    }
  }
  throw new HttpError(503, "Giao dịch đang bận, vui lòng thử lại");
}
