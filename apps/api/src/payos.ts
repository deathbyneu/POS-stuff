import {
  PayOS,
  APIError,
  type CreatePaymentLinkResponse,
  type PaymentLink,
  type Webhook,
  type WebhookData,
} from "@payos/node";
import { HttpError } from "./db";

export type PaymentMode = "DEMO" | "PAYOS" | "UNAVAILABLE";

export const paymentMode: PaymentMode =
  process.env.PAYMENT_PROVIDER?.toUpperCase() === "PAYOS"
    ? "PAYOS"
    : process.env.DEMO_MODE === "true"
      ? "DEMO"
      : "UNAVAILABLE";

let client: PayOS | undefined;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new HttpError(
      503,
      `Thanh toán payOS chưa được cấu hình đầy đủ (${name})`,
    );
  return value;
}

export function payOSClient() {
  if (paymentMode !== "PAYOS")
    throw new HttpError(503, "Cổng thanh toán payOS chưa được bật");
  client ??= new PayOS({
    clientId: required("PAYOS_CLIENT_ID"),
    apiKey: required("PAYOS_API_KEY"),
    checksumKey: required("PAYOS_CHECKSUM_KEY"),
    timeout: 15_000,
    maxRetries: 2,
  });
  return client;
}

function publicAppUrl() {
  return required("PUBLIC_APP_URL").replace(/\/$/, "");
}

export type PayOSOrder = {
  code: string;
  total: number;
  providerOrderCode: string | null;
  expiresAt: Date;
  source: string;
};

export async function createPayOSPayment(
  order: PayOSOrder,
): Promise<CreatePaymentLinkResponse> {
  if (!order.providerOrderCode)
    throw new HttpError(500, "Đơn hàng chưa có mã thanh toán payOS");
  const orderCode = Number(order.providerOrderCode);
  const path = order.source === "KIOSK" ? "/kiosk" : "/pos";
  const url = `${publicAppUrl()}${path}`;
  try {
    return await payOSClient().paymentRequests.create({
      orderCode,
      amount: order.total,
      description: `ER ${order.code}`.slice(0, 25),
      returnUrl: url,
      cancelUrl: url,
      expiredAt: Math.floor(order.expiresAt.getTime() / 1000),
    });
  } catch (createError) {
    // Retried/idempotent checkout may have created the link before the local
    // response was persisted. Recover it by the deterministic order code.
    try {
      const existing = await payOSClient().paymentRequests.get(orderCode);
      if (existing.status === "PAID")
        return {
          bin: "",
          accountNumber: "",
          accountName: "",
          amount: existing.amount,
          description: `ER ${order.code}`.slice(0, 25),
          orderCode: existing.orderCode,
          currency: "VND",
          paymentLinkId: existing.id,
          status: existing.status,
          checkoutUrl: "",
          qrCode: "",
        };
    } catch {
      // Preserve the original provider error below.
    }
    console.error(
      "payOS create payment failed:",
      createError instanceof Error ? createError.message : createError,
    );
    throw new HttpError(
      502,
      "Không thể tạo mã thanh toán payOS. Vui lòng thử lại.",
    );
  }
}

export async function getPayOSPayment(orderCode: string) {
  return payOSClient().paymentRequests.get(Number(orderCode));
}

export async function cancelPayOSPayment(
  orderCode: string,
  reason: string,
): Promise<PaymentLink> {
  return payOSClient().paymentRequests.cancel(Number(orderCode), reason);
}

export async function verifyPayOSWebhook(body: unknown): Promise<WebhookData> {
  return payOSClient().webhooks.verify(body as Webhook);
}

export async function confirmPayOSWebhook() {
  const webhookUrl = `${publicAppUrl()}/api/payments/payos/webhook`;
  if (!webhookUrl.startsWith("https://"))
    throw new Error("PUBLIC_APP_URL phải là HTTPS công khai khi dùng payOS");
  return payOSClient().webhooks.confirm(webhookUrl);
}

export function isPayOSNotFound(error: unknown) {
  return error instanceof APIError && error.status === 404;
}
