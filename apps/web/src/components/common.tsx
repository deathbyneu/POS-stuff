"use client";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Inbox,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { api, Order, money, dateTime } from "@/lib/api";
export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function reload() {
    setLoading(true);
    try {
      const next = await api<T>(path);
      setData(next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, [path]);
  return { data, setData, error, loading, reload };
}
export function Loading() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={26} />
      <span>Đang tải dữ liệu…</span>
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return message ? (
    <div className="error-box">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          <RefreshCw size={15} />
          Thử lại
        </button>
      )}
    </div>
  ) : null;
}
export function Empty({
  text = "Chưa có dữ liệu",
  hint = "Dữ liệu sẽ hiển thị tại đây khi được tạo.",
}: {
  text?: string;
  hint?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Inbox size={27} />
      </div>
      <strong>{text}</strong>
      <p>{hint}</p>
    </div>
  );
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">KHÔNG GIAN QUẢN LÝ</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Badge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    COMPLETED: "Hoàn thành",
    PENDING: "Chờ thanh toán",
    CANCELLED: "Đã hủy",
    REFUNDED: "Đã hoàn tiền",
    ADMIN: "Quản trị viên",
    STAFF: "Nhân viên",
    KIOSK: "Bán nhanh",
    CASHIER: "Tại quầy",
  };
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      {status === "COMPLETED" && <Check size={12} />}
      {labels[status] || status}
    </span>
  );
}
export function Toast({
  message,
  clear,
}: {
  message: string;
  clear: () => void;
}) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(clear, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  return message ? (
    <div className="toast">
      <Check size={18} />
      <span>{message}</span>
      <button aria-label="Đóng thông báo" onClick={clear}>
        <X size={17} />
      </button>
    </div>
  ) : null;
}
export function OrderTable({
  orders,
  onSelect,
}: {
  orders: Order[];
  onSelect: (order: Order) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Mã giao dịch</th>
            <th>Thời gian</th>
            <th>Kênh bán</th>
            <th>Thanh toán</th>
            <th className="align-right">Tổng tiền</th>
            <th>Trạng thái</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <button className="order-code" onClick={() => onSelect(order)}>
                  {order.code}
                </button>
              </td>
              <td className="muted nowrap">{dateTime(order.createdAt)}</td>
              <td>
                <Badge status={order.source} />
              </td>
              <td>{order.method === "QR" ? "QR · Demo" : "Tiền mặt"}</td>
              <td className="align-right strong">{money(order.total)}</td>
              <td>
                <Badge status={order.status} />
              </td>
              <td>
                <button
                  className="icon-button"
                  title="Xem giao dịch"
                  onClick={() => onSelect(order)}
                >
                  <ArrowRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && (
        <Empty
          text="Chưa có giao dịch"
          hint="Hãy tạo đơn tại màn hình Bán hàng."
        />
      )}
    </div>
  );
}
