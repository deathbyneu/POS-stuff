"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import {
  Dashboard,
  User,
  Order,
  api,
  dateTime,
  money,
  mutate,
} from "@/lib/api";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  OrderTable,
  PageHeading,
  Toast,
  useData,
} from "./common";
export function DashboardPage({ user }: { user: User }) {
  const { data, loading, error, reload } = useData<Dashboard>("/dashboard");
  const [selected, setSelected] = useState<Order | null>(null);
  if (loading && !data) return <Loading />;
  return (
    <>
      <PageHeading
        title="Tổng quan cửa hàng"
        subtitle={`Xin chào ${user.name.split(" ").pop()}, cùng theo dõi hoạt động điểm bán trong 7 ngày gần nhất.`}
      >
        <button className="button secondary" onClick={reload}>
          <RefreshCw size={16} /> Làm mới
        </button>
        <Link href="/pos" className="button primary">
          <Plus size={18} /> Tạo đơn hàng
        </Link>
      </PageHeading>
      <ErrorBox message={error} retry={reload} />
      {data && (
        <>
          <div className="overview-banner">
            <div>
              <span className="banner-chip">
                <span className="live-dot" /> EASYRETAIL
              </span>
              <h2>Bán hàng và tồn kho. Một luồng vận hành.</h2>
              <p>
                Từ nhập hàng đến bán tại quầy, mọi dữ liệu đều được quản lý tập
                trung và cập nhật theo thời gian thực.
              </p>
              <Link href="/inventory">
                Kiểm tra tồn kho <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="banner-art">
              <div className="mini-terminal">
                <div className="terminal-screen">
                  <ShoppingBag size={34} />
                  <span>EasyRetail</span>
                  <div className="terminal-check">✓</div>
                </div>
                <div className="terminal-foot" />
              </div>
              <span className="banner-orbit orbit-one" />
              <span className="banner-orbit orbit-two" />
            </div>
          </div>
          <div className="stats-grid">
            {[
              {
                label: "Doanh thu 7 ngày",
                value: money(data.revenue),
                icon: CircleDollarSign,
                color: "blue",
                hint: "Từ các đơn đã hoàn thành",
              },
              {
                label: "Đơn hàng 7 ngày",
                value: data.ordersCount,
                icon: ShoppingBag,
                color: "purple",
                hint: "Từ các đơn đã hoàn thành",
              },
              {
                label: "Giá trị đơn trung bình",
                value: money(data.averageOrder),
                icon: CreditCard,
                color: "green",
                hint: "Doanh thu / đơn hoàn thành",
              },
              {
                label: "Sản phẩm đang bán",
                value: data.productsCount,
                icon: Package,
                color: "orange",
                hint: `${data.lowStock.length} sản phẩm cần bổ sung`,
              },
            ].map((stat) => (
              <div className="stat-card" key={stat.label}>
                <div className="stat-top">
                  <span>{stat.label}</span>
                  <div className={`stat-icon ${stat.color}`}>
                    <stat.icon size={20} />
                  </div>
                </div>
                <strong className="stat-value">{stat.value}</strong>
                <small>{stat.hint}</small>
              </div>
            ))}
          </div>
          <div className="dashboard-middle">
            <section className="card revenue-card">
              <div className="card-heading">
                <div>
                  <h2>Doanh thu bán hàng</h2>
                  <p>Nhịp bán hàng trong 7 ngày gần nhất</p>
                </div>
                <span className="subtle-chip">
                  <CalendarDays size={14} /> 7 ngày
                </span>
              </div>
              <div className="chart-legend">
                <span /> Doanh thu <small>Đơn vị: VNĐ</small>
              </div>
              <div className="revenue-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.chart}
                    margin={{ top: 15, right: 15, bottom: 5, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3b82f6"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#e7edf5"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                        })
                      }
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#8792a6" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#8792a6" }}
                      tickFormatter={(v) =>
                        v >= 1000000
                          ? `${(v / 1000000).toFixed(1)}tr`
                          : `${v / 1000}k`
                      }
                    />
                    <Tooltip
                      formatter={(v: number) => [money(v), "Doanh thu"]}
                      labelFormatter={(v) =>
                        new Date(v).toLocaleDateString("vi-VN")
                      }
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#e2e8f0",
                        fontSize: 13,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fill="url(#revenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="card best-sellers">
              <div className="card-heading">
                <div>
                  <h2>Sản phẩm bán chạy</h2>
                  <p>Được yêu thích tại điểm bán</p>
                </div>
                <span className="subtle-chip">Top 5</span>
              </div>
              {data.topProducts.length ? (
                data.topProducts.slice(0, 5).map((product, i) => (
                  <div className="top-product" key={product.name}>
                    <span className={`rank rank-${i}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{product.name}</strong>
                      <small>{product.quantity} sản phẩm đã bán</small>
                    </div>
                    <b>{money(product.revenue)}</b>
                  </div>
                ))
              ) : (
                <Empty
                  text="Sẵn sàng cho đơn đầu tiên"
                  hint="Sản phẩm bán chạy sẽ xuất hiện tại đây."
                />
              )}
            </section>
          </div>
          {data.expiryAlerts.length > 0 && (
            <section className="expiry-dashboard-card">
              <div className="expiry-dashboard-icon">
                <CalendarClock size={22} />
              </div>
              <div>
                <strong>
                  {
                    data.expiryAlerts.filter(
                      (lot) => lot.expiryStatus === "EXPIRED",
                    ).length
                  }{" "}
                  lô đã hết hạn ·{" "}
                  {
                    data.expiryAlerts.filter(
                      (lot) => lot.expiryStatus !== "EXPIRED",
                    ).length
                  }{" "}
                  lô cần theo dõi
                </strong>
                <p>
                  {data.expiryAlerts
                    .slice(0, 3)
                    .map((lot) => `${lot.productName} · ${lot.batchCode}`)
                    .join(", ")}
                </p>
              </div>
              <Link href="/inventory" className="button secondary">
                Xem hạn sử dụng <ArrowRight size={15} />
              </Link>
            </section>
          )}
          <section className="card">
            <div className="card-heading">
              <div>
                <h2>Giao dịch gần đây</h2>
                <p>Theo dõi các giao dịch mới nhất tại điểm bán</p>
              </div>
              <Link href="/orders" className="text-button">
                Xem tất cả <ArrowRight size={16} />
              </Link>
            </div>
            <OrderTable orders={data.recentOrders} onSelect={setSelected} />
          </section>
          {data.lowStock.length > 0 && (
            <section className="low-stock-banner">
              <div className="low-stock-icon">
                <TriangleAlert size={22} />
              </div>
              <div>
                <strong>{data.lowStock.length} sản phẩm sắp hết hàng</strong>
                <p>
                  {data.lowStock
                    .slice(0, 3)
                    .map((item) => item.name)
                    .join(", ")}
                  {data.lowStock.length > 3 ? "…" : ""}
                </p>
              </div>
              <Link href="/inventory" className="button secondary">
                Kiểm tra tồn kho <ArrowRight size={15} />
              </Link>
            </section>
          )}
        </>
      )}
      <OrderDetail order={selected} close={() => setSelected(null)} />
    </>
  );
}
export function OrdersPage({ user }: { user: User }) {
  const { data, loading, error, reload } = useData<Order[]>("/orders");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [toast, setToast] = useState("");
  const filtered = useMemo(
    () =>
      (data || []).filter(
        (o) =>
          o.code.toLowerCase().includes(query.toLowerCase()) &&
          (!status || o.status === status) &&
          (!source || o.source === source),
      ),
    [data, query, status, source],
  );
  function download() {
    const rows = [
      ["Mã đơn", "Ngày", "Kênh", "Phương thức", "Trạng thái", "Tổng tiền"],
      ...filtered.map((o) => [
        o.code,
        dateTime(o.createdAt),
        o.source,
        o.method,
        o.status,
        o.total,
      ]),
    ];
    const csv =
      "\ufeff" +
      rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "easyretail-don-hang.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        title="Quản lý đơn hàng"
        subtitle="Mọi giao dịch bán hàng được lưu và theo dõi trong một nơi."
      >
        <button className="button secondary" onClick={download}>
          <ArrowDownToLine size={16} /> Xuất CSV
        </button>
        <Link href="/pos" className="button primary">
          <Plus size={18} /> Tạo đơn hàng
        </Link>
      </PageHeading>
      <div className="small-stats">
        <div>
          <span>Tổng giao dịch</span>
          <strong>{data?.length || 0}</strong>
        </div>
        <div>
          <span>Đã hoàn thành</span>
          <strong>
            {data?.filter((o) => o.status === "COMPLETED").length || 0}
          </strong>
        </div>
        <div>
          <span>Chờ thanh toán</span>
          <strong>
            {data?.filter((o) => o.status === "PENDING").length || 0}
          </strong>
        </div>
        <div>
          <span>Doanh thu trong danh sách</span>
          <strong>
            {money(
              data
                ?.filter((o) => o.status === "COMPLETED")
                .reduce((sum, o) => sum + Number(o.total), 0),
            )}
          </strong>
        </div>
      </div>
      <section className="card">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              placeholder="Tìm theo mã đơn hàng…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Lọc trạng thái"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="PENDING">Chờ thanh toán</option>
            <option value="CANCELLED">Đã hủy</option>
            <option value="REFUNDED">Đã hoàn tiền</option>
          </select>
          <select
            aria-label="Lọc kênh bán"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Tất cả kênh bán</option>
            <option value="CASHIER">Tại quầy</option>
          </select>
          <button className="icon-button" title="Làm mới" onClick={reload}>
            <RefreshCw size={18} />
          </button>
        </div>
        <ErrorBox message={error} retry={reload} />
        {loading && !data ? (
          <Loading />
        ) : (
          <OrderTable orders={filtered} onSelect={setSelected} />
        )}
        <div className="table-footer">
          Hiển thị {filtered.length} / {data?.length || 0} giao dịch
        </div>
      </section>
      <OrderDetail
        order={selected}
        close={() => setSelected(null)}
        allowRefund={user.role === "ADMIN"}
        onRefund={() => {
          setSelected(null);
          void reload();
          setToast("Đã hoàn đơn và cập nhật lại tồn kho.");
        }}
      />
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}
export function OrderDetail({
  order,
  close,
  allowRefund = false,
  onRefund,
}: {
  order: Order | null;
  close: () => void;
  allowRefund?: boolean;
  onRefund?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refund() {
    if (
      !order ||
      !window.confirm(
        `Hoàn toàn bộ đơn ${order.code}? Hàng hóa sẽ được trả lại tồn kho. Giao dịch payOS phải được hoàn chuyển khoản thủ công trước.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/orders/${order.id}/refund`);
      onRefund?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      opened={!!order}
      onClose={() => {
        setError("");
        close();
      }}
      title="Chi tiết giao dịch"
      centered
      size="lg"
    >
      {order && (
        <div className="order-detail">
          <div className="order-detail-head">
            <div>
              <h2>{order.code}</h2>
              <p>{dateTime(order.createdAt)}</p>
            </div>
            <Badge status={order.status} />
          </div>
          <div className="order-meta">
            <div>
              <span>Kênh bán</span>
              <strong>
                {order.source === "KIOSK" ? "Bán nhanh" : "Quầy thu ngân"}
              </strong>
            </div>
            <div>
              <span>Thanh toán</span>
              <strong>
                {order.method === "QR"
                  ? order.paymentProvider === "PAYOS"
                    ? "VietQR · payOS"
                    : "QR demo"
                  : "Tiền mặt"}
              </strong>
            </div>
            <div>
              <span>Khách hàng</span>
              <strong>{order.customer?.name || "Khách lẻ"}</strong>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>SL</th>
                  <th className="align-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, i) => (
                  <tr key={`${item.productId}-${i}`}>
                    <td>
                      <strong>{item.name}</strong>
                      <small className="block muted">{money(item.price)}</small>
                    </td>
                    <td>{item.quantity}</td>
                    <td className="align-right">
                      {money(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="order-total">
            <span>Tổng thanh toán</span>
            <strong>{money(order.total)}</strong>
          </div>
          <ErrorBox message={error} />
          {allowRefund && order.status === "COMPLETED" && (
            <button
              disabled={busy}
              className="button danger full"
              onClick={refund}
            >
              {busy ? "Đang xử lý…" : "Hoàn toàn bộ đơn hàng"}
            </button>
          )}
          <p className="muted small-text">
            Biên nhận nội bộ của hệ thống thử nghiệm. Không phải hóa đơn điện tử
            thuế.
          </p>
        </div>
      )}
    </Modal>
  );
}
