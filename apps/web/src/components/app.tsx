"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  UsersRound,
} from "lucide-react";
import { api, mutate, User } from "@/lib/api";
import { ErrorBox, Loading } from "./common";
import { DashboardPage, OrdersPage } from "./dashboard";
import {
  ProductsPage,
  InventoryPage,
  PurchasePage,
  CustomersPage,
  StaffPage,
  SettingsPage,
} from "./management";
import { POSPage } from "./pos";
import { BusinessAdvisorWidget } from "./business-advisor";
const nav = [
  { path: "/", label: "Tổng quan", icon: LayoutDashboard },
  { path: "/pos", label: "Bán hàng", icon: ShoppingBag },
  { path: "/orders", label: "Đơn hàng", icon: ReceiptText },
  { path: "/products", label: "Sản phẩm", icon: Package },
  { path: "/inventory", label: "Kho hàng", icon: Boxes },
  { path: "/purchases", label: "Nhập hàng", icon: PackagePlus, admin: true },
  { path: "/customers", label: "Khách hàng", icon: UsersRound },
  { path: "/staff", label: "Nhân viên", icon: Users, admin: true },
  { path: "/settings", label: "Thiết lập", icon: Settings, admin: true },
];
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <img src="/retailflow-logo.svg" alt="Logo EasyRetail" />
      <div>
        <strong>
          Easy<span>Retail</span>
        </strong>
        {!compact && <small>BÁN HÀNG &amp; TỒN KHO</small>}
      </div>
    </div>
  );
}
export default function App() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
    if (path === "/kiosk") {
      setUser(null);
      setChecking(false);
      router.replace("/login");
      return;
    }
    setChecking(true);
    api<{ user: User }>("/auth/me")
      .then((data) => {
        setUser(data.user);
        if (path === "/login") router.replace("/");
      })
      .catch(() => {
        setUser(null);
        if (path !== "/login") router.replace("/login");
      })
      .finally(() => setChecking(false));
  }, [path]);
  async function logout() {
    try {
      await mutate("/auth/logout");
    } finally {
      setUser(null);
      router.push("/login");
    }
  }
  if (path === "/kiosk")
    return (
      <div className="app-loading">
        <Brand />
        <Loading />
      </div>
    );
  if (path === "/login")
    return (
      <Login
        onLogin={(value) => {
          setUser(value);
          router.push("/");
        }}
      />
    );
  if (checking || !user)
    return (
      <div className="app-loading">
        <Brand />
        <Loading />
      </div>
    );
  const current = nav.find((item) => item.path === path);
  return (
    <div className="app-shell">
      {menu && (
        <div className="sidebar-backdrop" onClick={() => setMenu(false)} />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link href="/" className="brand-link">
          <Brand />
        </Link>
        <button
          className="store-switch"
          onClick={() => router.push(user.role === "ADMIN" ? "/settings" : "/")}
        >
          <span className="store-icon">
            <Store size={21} />
          </span>
          <span>
            <strong>EasyRetail Store</strong>
            <small>Không gian quản lý</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-caption">VẬN HÀNH CỬA HÀNG</div>
        <nav>
          {nav
            .filter((item) => !item.admin || user.role === "ADMIN")
            .map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-item ${path === item.path ? "active" : ""}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {path === item.path && <i />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-footer">
            <span className="live-dot" /> Hệ thống demo <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>EasyRetail</span>
            <span className="crumb-slash">/</span>
            <strong>{current?.label || "Trang không tồn tại"}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-chip">
              <span /> Môi trường thử nghiệm
            </span>
            <div className="topbar-divider" />
            <div className="avatar">
              {user.name?.split(" ").pop()?.slice(0, 1) || "N"}
            </div>
            <div className="user-info">
              <strong>{user.name}</strong>
              <span>
                {user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên bán hàng"}
              </span>
            </div>
            <button className="icon-button" title="Đăng xuất" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main
          className={`main-content ${path === "/pos" ? "pos-main-content" : ""}`}
        >
          {path === "/" ? (
            <DashboardPage user={user} />
          ) : path === "/pos" ? (
            <POSPage user={user} />
          ) : path === "/products" ? (
            <ProductsPage user={user} />
          ) : path === "/inventory" ? (
            <InventoryPage user={user} />
          ) : path === "/purchases" && user.role === "ADMIN" ? (
            <PurchasePage />
          ) : path === "/orders" ? (
            <OrdersPage user={user} />
          ) : path === "/customers" ? (
            <CustomersPage />
          ) : path === "/staff" && user.role === "ADMIN" ? (
            <StaffPage />
          ) : path === "/settings" && user.role === "ADMIN" ? (
            <SettingsPage />
          ) : (
            <div className="card not-found">
              <CircleHelp size={36} />
              <h1>Không tìm thấy trang</h1>
              <Link href="/" className="button primary">
                Về tổng quan
              </Link>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>EasyRetail · Quản lý bán hàng và tồn kho</span>
          <span>Prototype phục vụ học tập · Hỗ trợ VietQR qua payOS</span>
        </footer>
        <BusinessAdvisorWidget />
      </div>
    </div>
  );
}
function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("admin@easyretail.local");
  const [password, setPassword] = useState("EasyRetail@2026");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await mutate<{ user: User }>("/auth/login", {
        email,
        password,
      });
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="light-pill">
            <span className="live-dot" /> VẬN HÀNH TẬP TRUNG
          </span>
          <h1>
            Mỗi giao dịch.
            <br />
            Một trải nghiệm
            <br />
            <em>thông minh hơn.</em>
          </h1>
          <p>
            Quản lý bán hàng, nhập hàng và tồn kho trong một không gian. Gọn
            gàng, chủ động và kết nối.
          </p>
          <div className="login-illustration">
            <div className="illustration-receipt">
              <span className="illustration-symbol">
                <ScanBarcode size={34} />
              </span>
              <strong>EasyRetail</strong>
              <small>Sẵn sàng phục vụ</small>
              <div className="receipt-line" />
              <div className="receipt-line short" />
              <div className="illustration-paid">
                <ShieldCheck size={16} /> Kết nối dữ liệu tập trung
              </div>
            </div>
            <div className="floating-label float-one">
              <ShoppingBag size={21} />
              <span>Bán hàng tại quầy</span>
            </div>
            <div className="floating-label float-two">
              <BarChart3 size={21} />
              <span>Theo dõi trong một chạm</span>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          RETAIL MANAGEMENT SYSTEM <span>EASYRETAIL · 2026</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-form-icon">
            <Store size={30} />
          </div>
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập cửa hàng</h2>
          <p className="login-subtitle">
            Một ngày bán hàng hiệu quả bắt đầu từ đây.
          </p>
          <form onSubmit={submit}>
            <label className="field">
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@easyretail.local"
              />
            </label>
            <label className="field">
              Mật khẩu
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ErrorBox message={error} />
            <button className="button primary large full" disabled={busy}>
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="demo-login-box">
            <strong>
              <ShieldCheck size={16} /> Tài khoản trải nghiệm
            </strong>
            <p>
              Mật khẩu chung: <code>EasyRetail@2026</code>
            </p>
            <div>
              <button
                onClick={() => {
                  setEmail("admin@easyretail.local");
                  setPassword("EasyRetail@2026");
                }}
              >
                Quản trị viên
              </button>
              <button
                onClick={() => {
                  setEmail("staff@easyretail.local");
                  setPassword("EasyRetail@2026");
                }}
              >
                Nhân viên
              </button>
            </div>
          </div>
          <p className="login-disclaimer">
            Bản thử nghiệm học tập. VietQR có thể phát sinh chuyển tiền thật;
            <br />
            hãy kiểm tra số tiền trước khi xác nhận trên ứng dụng ngân hàng.
          </p>
        </div>
      </section>
    </div>
  );
}
