"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@mantine/core";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  LoaderCircle,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  Category,
  Customer,
  dateTime,
  money,
  mutate,
  Order,
  Product,
  Store,
  User,
} from "@/lib/api";
import { Empty, ErrorBox, Loading, Toast, useData } from "./common";
type CartItem = { product: Product; quantity: number };
export function POSPage({
  kiosk = false,
  user,
}: {
  kiosk?: boolean;
  user: User | null;
}) {
  const {
    data: products,
    error,
    loading,
    reload,
  } = useData<Product[]>("/products");
  const { data: categories } = useData<Category[]>("/categories");
  const { data: store } = useData<Store>("/store");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"QR" | "CASH">("QR");
  const [order, setOrder] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [qr, setQr] = useState("");
  const [help, setHelp] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [remaining, setRemaining] = useState(0);
  const scanner = useRef<HTMLInputElement>(null);
  const requestId = useRef("");
  const autoScan = useRef({ buffer: "", last: 0 });
  const key = `easyretail-pending-${kiosk ? "kiosk" : "cashier"}`;
  useEffect(() => {
    if (!kiosk && user)
      api<Customer[]>("/customers")
        .then(setCustomers)
        .catch(() => {});
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const pending = JSON.parse(saved) as Order;
        api<Order>(
          `/checkout/${pending.id}?token=${encodeURIComponent(pending.token || "")}`,
        )
          .then((result) => {
            if (result.status === "PENDING")
              setOrder({ ...result, token: pending.token });
            else if (result.status === "COMPLETED") {
              setReceipt(result);
              localStorage.removeItem(key);
            } else localStorage.removeItem(key);
          })
          .catch(() => localStorage.removeItem(key));
      } catch {
        localStorage.removeItem(key);
      }
    }
  }, []);
  useEffect(() => {
    if (order) {
      localStorage.setItem(key, JSON.stringify(order));
      if (order.qrData)
        QRCode.toDataURL(
          typeof order.qrData === "string"
            ? order.qrData
            : JSON.stringify(order.qrData),
          {
            margin: 2,
            width: 260,
            color: { dark: "#172554", light: "#ffffff" },
          },
        ).then(setQr);
    }
  }, [order]);
  useEffect(() => {
    if (!order) return;
    function tick() {
      setRemaining(
        Math.max(
          0,
          Math.ceil(
            (new Date(order!.expiresAt || Date.now() + 300000).getTime() -
              Date.now()) /
              1000,
          ),
        ),
      );
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [order]);
  useEffect(() => {
    if (!order) return;
    const timer = setInterval(() => {
      api<Order>(
        `/checkout/${order.id}?token=${encodeURIComponent(order.token || "")}`,
      )
        .then((result) => {
          if (result.status === "COMPLETED") finish(result);
          else if (result.status === "CANCELLED") {
            setOrder(null);
            localStorage.removeItem(key);
            setCheckoutError(
              "Phiên thanh toán đã hết hạn hoặc đã hủy. Vui lòng tạo lại đơn.",
            );
            void reload();
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [order]);
  function add(product: Product) {
    if (order || busy) return;
    setCheckoutError("");
    requestId.current = "";
    setCart((current) => {
      const item = current.find((row) => row.product.id === product.id);
      const available = product.availableStock ?? product.stock;
      if ((item?.quantity || 0) >= available) {
        setMessage("Đã đạt số lượng tồn kho của sản phẩm.");
        return current;
      }
      return item
        ? current.map((row) =>
            row.product.id === product.id
              ? { ...row, quantity: row.quantity + 1 }
              : row,
          )
        : [...current, { product, quantity: 1 }];
    });
  }
  function scan(code: string) {
    const product = products?.find(
      (item) =>
        item.active &&
        (item.barcode === code.trim() || item.sku === code.trim()),
    );
    if (product) {
      if ((product.availableStock ?? product.stock) <= 0)
        setCheckoutError(`${product.name} hiện đã hết hàng.`);
      else {
        add(product);
        setMessage(`Đã thêm ${product.name}`);
      }
    } else
      setCheckoutError(
        `Không tìm thấy mã “${code.trim()}”. Vui lòng kiểm tra hoặc nhờ nhân viên hỗ trợ.`,
      );
    setBarcode("");
    scanner.current?.focus();
  }
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) ||
        event.ctrlKey ||
        event.metaKey ||
        order ||
        receipt ||
        help
      )
        return;
      const now = Date.now();
      if (event.key === "Enter" && autoScan.current.buffer.length >= 3) {
        event.preventDefault();
        scan(autoScan.current.buffer);
        autoScan.current.buffer = "";
      } else if (event.key.length === 1) {
        autoScan.current.buffer =
          now - autoScan.current.last > 120
            ? event.key
            : autoScan.current.buffer + event.key;
        autoScan.current.last = now;
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [products, order, receipt, help]);
  function quantity(id: string, delta: number) {
    if (order || busy) return;
    requestId.current = "";
    setCart((current) =>
      current
        .map((row) =>
          row.product.id === id
            ? {
                ...row,
                quantity: Math.min(
                  row.product.availableStock ?? row.product.stock,
                  row.quantity + delta,
                ),
              }
            : row,
        )
        .filter((row) => row.quantity > 0),
    );
  }
  const total = cart.reduce(
    (sum, row) => sum + Number(row.product.price) * row.quantity,
    0,
  );
  const count = cart.reduce((sum, row) => sum + row.quantity, 0);
  function finish(value: Order) {
    setReceipt(value);
    setOrder(null);
    setCart([]);
    setCustomerId("");
    setCheckoutError("");
    requestId.current = "";
    localStorage.removeItem(key);
    void reload();
  }
  async function checkout() {
    if (!cart.length || busy) return;
    setBusy(true);
    setCheckoutError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const result = await mutate<Order>("/checkout", {
        items: cart.map((row) => ({
          productId: row.product.id,
          quantity: row.quantity,
        })),
        method,
        source: kiosk ? "KIOSK" : "CASHIER",
        ...(customerId && !kiosk ? { customerId } : {}),
        requestId: requestId.current,
      });
      if (result.status === "COMPLETED") finish(result);
      else if (result.status === "PENDING") setOrder(result);
      else {
        requestId.current = "";
        throw new Error(
          "Đơn cũ đã hủy. Vui lòng bấm thanh toán để tạo đơn mới.",
        );
      }
    } catch (e) {
      setCheckoutError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function payDemo() {
    if (!order || busy || order.paymentMode === "PAYOS") return;
    setBusy(true);
    setCheckoutError("");
    try {
      const result = await mutate<Order>(`/checkout/${order.id}/pay`, {
        token: order.token,
      });
      finish(result);
    } catch (e) {
      setCheckoutError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!order || busy) return;
    setBusy(true);
    try {
      await mutate(`/checkout/${order.id}/cancel`, { token: order.token });
      setOrder(null);
      localStorage.removeItem(key);
      requestId.current = "";
      setCheckoutError("");
      void reload();
    } catch (e) {
      setCheckoutError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = (products || []).filter(
    (product) =>
      product.active &&
      (!category || product.categoryId === category) &&
      `${product.name} ${product.barcode} ${product.sku}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className={kiosk ? "kiosk-page" : "pos-page"}>
      {kiosk && (
        <header className="kiosk-header">
          <Link href="/login" className="brand">
            <img src="/retailflow-logo.svg" alt="Logo EasyRetail" />
            <div>
              <strong>
                Easy<span>Retail</span>
              </strong>
              <small>LÀN TỰ THANH TOÁN</small>
            </div>
          </Link>
          <div className="kiosk-header-center">
            <span className="step-number">1</span> Quét sản phẩm{" "}
            <span className="step-line" />
            <span className="step-number pale">2</span> Thanh toán{" "}
            <span className="step-line" />
            <span className="step-number pale">3</span> Hoàn tất
          </div>
          <button className="button secondary" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Cần hỗ trợ?
          </button>
        </header>
      )}
      <div className="pos-heading">
        <div>
          <span className="eyebrow">
            {kiosk ? "MUA NHANH · THANH TOÁN GỌN" : "QUẦY THU NGÂN"}
          </span>
          <h1>
            {kiosk ? "Xin chào, hôm nay bạn cần gì?" : "Bán hàng tại quầy"}
          </h1>
          <p>
            {kiosk
              ? "Quét mã vạch hoặc chạm vào sản phẩm để bắt đầu."
              : "Quét mã, chọn sản phẩm và hoàn tất đơn hàng."}
          </p>
        </div>
        <span className="subtle-chip">
          <span className="live-dot" /> {store?.name || "EasyRetail Store"}
        </span>
      </div>
      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="scanner-bar">
            <ScanBarcode size={23} />
            <input
              ref={scanner}
              aria-label="Quét mã vạch"
              placeholder="Quét mã vạch tại đây và nhấn Enter…"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && barcode.trim()) {
                  e.preventDefault();
                  scan(barcode);
                }
              }}
              autoFocus
              autoComplete="off"
            />
            <kbd>ENTER</kbd>
          </div>
          <div className="pos-search">
            <div className="search-input">
              <Search size={18} />
              <input
                aria-label="Tìm sản phẩm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên sản phẩm, mã vạch…"
              />
              {search && (
                <button
                  className="icon-button"
                  title="Xóa tìm kiếm"
                  onClick={() => setSearch("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <span>{filtered.length} sản phẩm</span>
          </div>
          <div className="category-tabs">
            <button
              className={!category ? "selected" : ""}
              onClick={() => setCategory("")}
            >
              <ShoppingBasket size={16} /> Tất cả
            </button>
            {categories?.map((item) => (
              <button
                key={item.id}
                className={category === item.id ? "selected" : ""}
                onClick={() => setCategory(item.id)}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.name}
              </button>
            ))}
          </div>
          <ErrorBox message={error} retry={reload} />
          {loading && !products ? (
            <Loading />
          ) : (
            <div className="product-grid">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  className={`product-card ${(product.availableStock ?? product.stock) <= 0 ? "sold-out" : ""}`}
                  disabled={
                    (product.availableStock ?? product.stock) <= 0 ||
                    busy ||
                    !!order
                  }
                  onClick={() => add(product)}
                >
                  <div
                    className="product-visual"
                    style={{
                      background: product.category?.color
                        ? `${product.category.color}13`
                        : undefined,
                    }}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{product.emoji || "🛍️"}</span>
                    )}
                    <span className="product-stock">
                      {(product.availableStock ?? product.stock) > 0
                        ? `Còn ${product.availableStock ?? product.stock}`
                        : "Hết hàng"}
                    </span>
                    {cart.some((row) => row.product.id === product.id) && (
                      <span className="in-cart-count">
                        {
                          cart.find((row) => row.product.id === product.id)
                            ?.quantity
                        }
                      </span>
                    )}
                  </div>
                  <div className="product-card-content">
                    <span className="product-category">
                      {product.category?.name || "Sản phẩm"}
                    </span>
                    <strong>{product.name}</strong>
                    <div>
                      <b>{money(product.price)}</b>
                      <span className="add-product">
                        <Plus size={17} />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!loading && !filtered.length && (
            <Empty
              text="Không tìm thấy sản phẩm"
              hint="Thử tên khác hoặc chọn một danh mục khác."
            />
          )}
          <div className="catalog-note">
            <ShieldCheck size={15} /> Giá và số lượng được kiểm tra lại khi tạo
            đơn.
          </div>
        </section>
        <aside className="cart-panel">
          <div className="cart-heading">
            <div>
              <ShoppingBag size={20} />
              <h2>Giỏ hàng</h2>
              <span>{count}</span>
            </div>
            <button
              className="icon-button"
              title="Xóa giỏ hàng"
              disabled={!cart.length || busy || !!order}
              onClick={() => {
                if (window.confirm("Xóa tất cả sản phẩm trong giỏ?")) {
                  setCart([]);
                  requestId.current = "";
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
          {!kiosk && (
            <div className="customer-select">
              <select
                aria-label="Chọn khách hàng"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Khách lẻ</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="cart-items">
            {cart.length ? (
              cart.map((row) => (
                <div className="cart-item" key={row.product.id}>
                  <span className="cart-item-visual">
                    {row.product.imageUrl ? (
                      <img src={row.product.imageUrl} alt="" />
                    ) : (
                      row.product.emoji || "🛍️"
                    )}
                  </span>
                  <div className="cart-item-main">
                    <strong>{row.product.name}</strong>
                    <small>{money(row.product.price)}</small>
                    <div className="quantity-control">
                      <button
                        aria-label={`Giảm ${row.product.name}`}
                        disabled={busy || !!order}
                        onClick={() => quantity(row.product.id, -1)}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{row.quantity}</span>
                      <button
                        aria-label={`Tăng ${row.product.name}`}
                        disabled={
                          row.quantity >=
                            (row.product.availableStock ?? row.product.stock) ||
                          busy ||
                          !!order
                        }
                        onClick={() => quantity(row.product.id, 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-end">
                    <button
                      className="icon-button"
                      title={`Xóa ${row.product.name}`}
                      disabled={busy || !!order}
                      onClick={() => {
                        setCart((current) =>
                          current.filter(
                            (item) => item.product.id !== row.product.id,
                          ),
                        );
                        requestId.current = "";
                      }}
                    >
                      <X size={14} />
                    </button>
                    <strong>
                      {money(Number(row.product.price) * row.quantity)}
                    </strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-cart">
                <div>
                  <ShoppingBasket size={42} strokeWidth={1.3} />
                </div>
                <h3>Giỏ hàng đang trống</h3>
                <p>
                  Quét mã vạch hoặc chọn sản phẩm.
                  <br />
                  Món bạn chọn sẽ xuất hiện ở đây.
                </p>
              </div>
            )}
          </div>
          <div className="cart-summary">
            <div className="summary-line">
              <span>Tạm tính ({count} sản phẩm)</span>
              <b>{money(total)}</b>
            </div>
            <div className="summary-line">
              <span>Giảm giá</span>
              <span>0 ₫</span>
            </div>
            <div className="summary-total">
              <span>Tổng thanh toán</span>
              <strong>{money(total)}</strong>
            </div>
            <div className="payment-options">
              <button
                className={method === "QR" ? "active" : ""}
                onClick={() => setMethod("QR")}
              >
                <CreditCard size={19} />
                <span>VietQR</span>
                {method === "QR" && <Check size={14} />}
              </button>
              {!kiosk && (
                <button
                  className={method === "CASH" ? "active" : ""}
                  onClick={() => setMethod("CASH")}
                >
                  <Banknote size={19} />
                  <span>Tiền mặt</span>
                  {method === "CASH" && <Check size={14} />}
                </button>
              )}
            </div>
            <ErrorBox message={checkoutError} />
            <button
              className="button primary checkout-button"
              disabled={!cart.length || busy || !!order}
              onClick={checkout}
            >
              {busy ? (
                <LoaderCircle className="spin" size={20} />
              ) : (
                <>
                  <span>
                    {method === "CASH"
                      ? "Đã nhận tiền · Hoàn tất"
                      : "Tiến hành thanh toán"}
                  </span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
            <p className="cart-disclaimer">
              {kiosk
                ? "QR thử nghiệm · Không chuyển tiền thật"
                : method === "CASH"
                  ? "Chỉ hoàn tất sau khi đã nhận đủ tiền từ khách."
                  : "Giao dịch QR ở chế độ thử nghiệm."}
            </p>
          </div>
        </aside>
      </div>
      {kiosk && (
        <footer className="kiosk-footer">
          <span>EasyRetail · Hệ thống quản lý bán hàng</span>
          <span>Giỏ nhỏ 1–5 sản phẩm · Thanh toán không tiền mặt</span>
        </footer>
      )}
      <Modal
        opened={!!order}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        centered
        title={order?.paymentMode === "PAYOS" ? "Thanh toán VietQR" : "Thanh toán QR mô phỏng"}
        size="md"
      >
        <div className="qr-payment">
          <span className="demo-label">
            {order?.paymentMode === "PAYOS"
              ? "VIETQR · THANH TOÁN THẬT"
              : "DEMO · KHÔNG CHUYỂN TIỀN THẬT"}
          </span>
          <h2>{money(order?.total)}</h2>
          <p>
            Đơn hàng <strong>{order?.code}</strong>
          </p>
          {qr ? (
            <img
              className="qr-image"
              src={qr}
              alt={
                order?.paymentMode === "PAYOS"
                  ? "Mã VietQR thanh toán đơn hàng"
                  : "Mã QR chứa thông tin đơn hàng mô phỏng"
              }
            />
          ) : (
            <Loading />
          )}
          <div className="qr-explanation">
            {order?.paymentMode === "PAYOS"
              ? "Mở ứng dụng ngân hàng, quét mã và kiểm tra đúng số tiền. Màn hình sẽ tự xác nhận khi tiền đã được ghi nhận."
              : "QR chỉ chứa dữ liệu thử nghiệm, không phải mã chuyển khoản ngân hàng."}
          </div>
          <div className="countdown">
            Giữ hàng trong{" "}
            {Math.floor(remaining / 60)
              .toString()
              .padStart(2, "0")}
            :{(remaining % 60).toString().padStart(2, "0")}
          </div>
          <ErrorBox message={checkoutError} />
          {order?.paymentMode !== "PAYOS" && (
            <button
              className="button primary full large"
              disabled={busy || remaining <= 0}
              onClick={payDemo}
            >
              <CheckCircle2 size={19} />
              {busy ? "Đang xử lý…" : "Mô phỏng thanh toán thành công"}
            </button>
          )}
          <button
            className="button ghost full"
            disabled={busy}
            onClick={cancel}
          >
            Hủy thanh toán và quay lại giỏ
          </button>
        </div>
      </Modal>
      <Modal
        opened={!!receipt}
        onClose={() => setReceipt(null)}
        title="Giao dịch hoàn tất"
        centered
        size="md"
      >
        <div className="receipt-content" id="print-receipt">
          <div className="receipt-success">
            <CheckCircle2 size={40} />
          </div>
          <h2>Thanh toán thành công!</h2>
          <p className="muted">Cảm ơn bạn đã mua sắm tại cửa hàng.</p>
          <div className="receipt-paper">
            <h3>{store?.name || "EasyRetail Store"}</h3>
            <p>{store?.address || "Điểm bán thử nghiệm"}</p>
            <strong>BIÊN NHẬN BÁN HÀNG</strong>
            <small>
              {receipt?.code} · {receipt && dateTime(receipt.createdAt)}
            </small>
            <div className="receipt-divider" />
            {receipt?.items.map((item, i) => (
              <div className="receipt-row" key={i}>
                <span>
                  {item.name}
                  <small>
                    {item.quantity} × {money(item.price)}
                  </small>
                </span>
                <b>{money(item.quantity * Number(item.price))}</b>
              </div>
            ))}
            <div className="receipt-divider" />
            <div className="receipt-total">
              <strong>TỔNG CỘNG</strong>
              <strong>{money(receipt?.total)}</strong>
            </div>
            <p>
              {receipt?.method === "QR"
                ? receipt.paymentMode === "PAYOS"
                  ? "Thanh toán: VietQR qua payOS"
                  : "QR MÔ PHỎNG · KHÔNG THU TIỀN THẬT"
                : "Thanh toán: Tiền mặt"}
            </p>
            <small>
              {store?.receiptNote || "Chúc bạn một ngày học tập hiệu quả!"}
            </small>
            <small>Biên nhận nội bộ · Không phải hóa đơn điện tử thuế.</small>
          </div>
          <div className="receipt-buttons">
            <button className="button secondary" onClick={() => window.print()}>
              <Printer size={17} /> In biên nhận
            </button>
            <button
              className="button primary"
              onClick={() => {
                setReceipt(null);
                scanner.current?.focus();
              }}
            >
              Đơn tiếp theo <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        opened={help}
        onClose={() => setHelp(false)}
        title="Hướng dẫn tự thanh toán"
        centered
      >
        <div className="help-steps">
          <div>
            <b>1</b>
            <p>
              Đưa mã vạch sản phẩm trước máy quét. Bạn cũng có thể chạm vào sản
              phẩm trên màn hình.
            </p>
          </div>
          <div>
            <b>2</b>
            <p>
              Kiểm tra tên, số lượng và tổng tiền trong giỏ hàng. Điều chỉnh
              bằng nút + và −.
            </p>
          </div>
          <div>
            <b>3</b>
            <p>
              Chọn thanh toán, sau đó bấm “Mô phỏng thanh toán thành công” để
              hoàn tất bản demo.
            </p>
          </div>
        </div>
        <div className="info-box">
          Nếu mã vạch không đọc được, sai giá hoặc cần hỗ trợ, vui lòng gặp nhân
          viên tại quầy thu ngân.
        </div>
        <button className="button primary full" onClick={() => setHelp(false)}>
          Đã hiểu, bắt đầu mua hàng
        </button>
      </Modal>
      <Toast message={message} clear={() => setMessage("")} />
    </div>
  );
}
