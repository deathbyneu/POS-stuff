"use client";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Modal } from "@mantine/core";
import {
  Boxes,
  CalendarClock,
  Edit3,
  ImagePlus,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  api,
  Category,
  Customer,
  dateTime,
  InventoryLot,
  money,
  mutate,
  Product,
  Store,
  User,
} from "@/lib/api";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  PageHeading,
  Toast,
  useData,
} from "./common";

const blankProduct = {
  name: "",
  sku: "",
  barcode: "",
  price: 10000,
  cost: 7000,
  stock: 10,
  minStock: 5,
  categoryId: "",
  emoji: "📦",
  imageUrl: "",
  active: true,
};
type ProductForm = typeof blankProduct;

export function ProductsPage({ user }: { user: User }) {
  const { data, loading, error, reload } = useData<Product[]>("/products");
  const { data: categories, reload: reloadCategories } =
    useData<Category[]>("/categories");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const filtered = useMemo(
    () =>
      (data || []).filter((item) =>
        `${item.name} ${item.sku} ${item.barcode}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [data, query],
  );
  function create() {
    setEditing(null);
    setForm({ ...blankProduct, categoryId: categories?.[0]?.id || "" });
    setImageFile(null);
    setImagePreview("");
    setFormError("");
    setOpen(true);
  }
  function edit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.price,
      cost: product.cost || 0,
      stock: product.stock,
      minStock: product.minStock,
      categoryId: product.categoryId,
      emoji: product.emoji || "📦",
      imageUrl: product.imageUrl || "",
      active: product.active,
    });
    setImageFile(null);
    setImagePreview(product.imageUrl || "");
    setFormError("");
    setOpen(true);
  }
  function chooseImage(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setFormError("Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Ảnh tối đa 3 MB.");
      return;
    }
    setImageFile(file);
    setFormError("");
    const reader = new FileReader();
    reader.onload = () => setImagePreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }
  async function uploadImage(file: File) {
    const response = await fetch("/api/uploads/product-image", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.message || "Không thể tải ảnh sản phẩm.");
    return String(data.imageUrl);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : form.imageUrl;
      const payload = { ...form, imageUrl };
      if (editing)
        await mutate(
          `/products/${editing.id}`,
          { ...payload, stock: undefined },
          "PATCH",
        );
      else await mutate("/products", payload);
      setOpen(false);
      await reload();
      setToast(
        editing
          ? "Đã cập nhật sản phẩm và hình ảnh."
          : "Đã thêm sản phẩm và tồn đầu kỳ.",
      );
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function archive(product: Product) {
    if (!window.confirm(`Ngừng bán “${product.name}”?`)) return;
    try {
      await mutate(`/products/${product.id}`, undefined, "DELETE");
      await reload();
      setToast("Sản phẩm đã chuyển sang ngừng bán.");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function addCategory(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await mutate("/categories", {
        name: categoryName,
        color: "#2563eb",
        icon: "🏷️",
      });
      setCategoryName("");
      setCategoryOpen(false);
      await reloadCategories();
      setToast("Đã thêm danh mục.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Sản phẩm & danh mục"
        subtitle="Quản lý mã vạch, giá bán, hình ảnh và hàng hóa tại điểm bán."
      >
        {user.role === "ADMIN" && (
          <>
            <button
              className="button secondary"
              onClick={() => setCategoryOpen(true)}
            >
              Danh mục
            </button>
            <button className="button primary" onClick={create}>
              <Plus size={18} /> Thêm sản phẩm
            </button>
          </>
        )}
      </PageHeading>
      <section className="card">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên, SKU hoặc mã vạch…"
            />
          </div>
          <span className="toolbar-count">{filtered.length} sản phẩm</span>
          <button className="icon-button" onClick={reload} title="Làm mới">
            <RefreshCw size={18} />
          </button>
        </div>
        <ErrorBox message={error} retry={reload} />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Mã hàng</th>
                  <th>Danh mục</th>
                  <th className="align-right">Giá bán</th>
                  <th className="align-right">Tồn</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" />
                          ) : (
                            product.emoji || "📦"
                          )}
                        </span>
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.barcode}</small>
                        </div>
                      </div>
                    </td>
                    <td>{product.sku}</td>
                    <td>{product.category?.name}</td>
                    <td className="align-right strong">
                      {money(product.price)}
                    </td>
                    <td
                      className={`align-right strong ${product.stock <= product.minStock ? "text-warning" : ""}`}
                    >
                      {product.stock}
                    </td>
                    <td>
                      <span
                        className={`state-dot ${product.active ? "on" : "off"}`}
                      />
                      {product.active ? "Đang bán" : "Ngừng bán"}
                    </td>
                    <td>
                      {user.role === "ADMIN" && (
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            onClick={() => edit(product)}
                            title="Sửa"
                          >
                            <Edit3 size={16} />
                          </button>
                          {product.active && (
                            <button
                              className="text-button danger-text"
                              onClick={() => archive(product)}
                            >
                              Ngừng bán
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty text="Không tìm thấy sản phẩm" />}
          </div>
        )}
      </section>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={editing ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}
        centered
        size="lg"
      >
        <form className="form-grid" onSubmit={save}>
          <label className="field span-2">
            Tên sản phẩm
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field">
            SKU
            <input
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </label>
          <label className="field">
            Mã vạch
            <input
              required
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </label>
          <label className="field">
            Giá bán
            <input
              type="number"
              min="1"
              required
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Giá vốn
            <input
              type="number"
              min="0"
              required
              value={form.cost}
              onChange={(e) =>
                setForm({ ...form, cost: Number(e.target.value) })
              }
            />
          </label>
          {!editing && (
            <label className="field">
              Tồn đầu kỳ
              <input
                type="number"
                min="0"
                required
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: Number(e.target.value) })
                }
              />
            </label>
          )}
          <label className="field">
            Tồn tối thiểu
            <input
              type="number"
              min="0"
              required
              value={form.minStock}
              onChange={(e) =>
                setForm({ ...form, minStock: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Danh mục
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Chọn danh mục</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Biểu tượng dự phòng
            <input
              maxLength={20}
              value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
            />
          </label>
          <div className="image-upload span-2">
            <div className="image-preview">
              {imagePreview ? (
                <img src={imagePreview} alt="Xem trước sản phẩm" />
              ) : (
                <span>{form.emoji || "📦"}</span>
              )}
            </div>
            <div>
              <strong>Ảnh sản phẩm</strong>
              <p>
                PNG, JPEG hoặc WebP · tối đa 3 MB. Ảnh mới sẽ hiển thị tại quầy
                bán hàng.
              </p>
              <div className="image-actions">
                <label className="button secondary">
                  <ImagePlus size={16} />
                  {imagePreview ? "Thay ảnh" : "Chọn ảnh"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => chooseImage(event.target.files?.[0])}
                  />
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    className="button ghost danger-text"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview("");
                      setForm({ ...form, imageUrl: "" });
                    }}
                  >
                    <Trash2 size={15} /> Bỏ ảnh
                  </button>
                )}
              </div>
            </div>
          </div>
          {editing && (
            <label className="check-field span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />{" "}
              Đang bán trên POS
            </label>
          )}
          <div className="span-2">
            <ErrorBox message={formError} />
            <button className="button primary full" disabled={busy}>
              {busy ? "Đang tải ảnh và lưu…" : "Lưu sản phẩm"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        opened={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Danh mục sản phẩm"
        centered
      >
        <div className="category-list">
          {categories?.map((c) => (
            <div key={c.id}>
              <span style={{ background: c.color }}>{c.icon}</span>
              <strong>{c.name}</strong>
            </div>
          ))}
        </div>
        <form onSubmit={addCategory} className="inline-form">
          <input
            required
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Tên danh mục mới"
          />
          <button className="button primary" disabled={busy}>
            <Plus size={16} /> Thêm
          </button>
        </form>
        <ErrorBox message={formError} />
      </Modal>
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}

type Movement = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  type: string;
  note: string;
  batchCode?: string;
  createdAt: string;
};
const movementLabels: Record<string, string> = {
  OPENING: "Tồn đầu kỳ",
  PURCHASE: "Nhập hàng",
  ADJUSTMENT: "Kiểm kê",
  DAMAGE: "Xuất hủy",
  RESERVE: "Giữ hàng",
  SALE: "Bán hàng",
  RELEASE: "Trả hàng giữ",
  REFUND: "Hoàn đơn",
};

type PurchaseLine = {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  batchCode: string;
  manufacturedAt: string;
  expiryDate: string;
};

const newPurchaseLine = (productId = ""): PurchaseLine => ({
  id: `${Date.now()}-${Math.random()}`,
  productId,
  quantity: 1,
  unitCost: 0,
  batchCode: "",
  manufacturedAt: "",
  expiryDate: "",
});

type GoodsReceipt = {
  id: string;
  code: string;
  supplier: string;
  reference: string;
  note: string;
  totalQuantity: number;
  totalCost: number;
  createdAt: string;
  lines: {
    productId: string;
    productName: string;
    sku: string;
    batchCode: string;
    quantity: number;
    unitCost: number;
    expiryDate?: string | null;
  }[];
};

export function PurchasePage() {
  const { data, loading, error, reload } = useData<Product[]>("/inventory");
  const { data: receipts, reload: reloadReceipts } = useData<GoodsReceipt[]>(
    "/inventory/purchases",
  );
  const [lines, setLines] = useState<PurchaseLine[]>([newPurchaseLine()]);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("Nhập hàng từ nhà cung cấp");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const products = (data || []).filter((product) => product.active);
  const totalQuantity = lines.reduce(
    (sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0),
    0,
  );
  const estimatedCost = lines.reduce((sum, line) => {
    return sum + (line.unitCost || 0) * (line.quantity || 0);
  }, 0);

  function updateLine(id: string, patch: Partial<PurchaseLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function generateBatchCode(line: PurchaseLine) {
    const product = products.find((item) => item.id === line.productId);
    const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    updateLine(line.id, {
      batchCode: `NK-${product?.sku || "LO"}-${day}`.slice(0, 80),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (lines.some((line) => !line.productId)) {
      setFormError("Hãy chọn sản phẩm cho tất cả các dòng.");
      return;
    }
    setBusy(true);
    try {
      const result = await mutate<GoodsReceipt>("/inventory/purchases", {
        supplier,
        reference,
        note,
        lines: lines.map(({ id: _id, ...line }) => line),
      });
      setLines([
        {
          ...newPurchaseLine(products[0]?.id || ""),
          unitCost: products[0]?.cost || 0,
        },
      ]);
      setSupplier("");
      setReference("");
      setNote("Nhập hàng từ nhà cung cấp");
      await Promise.all([reload(), reloadReceipts()]);
      setToast(`Đã lưu ${result.code} với ${result.totalQuantity} sản phẩm.`);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Nhập hàng"
        subtitle="Tạo phiếu nhập nhiều mặt hàng và cập nhật tồn kho trong một lần."
      >
        <button className="button secondary" onClick={reload}>
          <RefreshCw size={16} /> Làm mới tồn kho
        </button>
      </PageHeading>
      <form onSubmit={submit} className="purchase-layout">
        <section className="card purchase-card">
          <div className="card-heading">
            <div>
              <h2>Chi tiết phiếu nhập</h2>
              <p>Mỗi dòng tương ứng với một sản phẩm và một lô hàng</p>
            </div>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    ...newPurchaseLine(products[0]?.id || ""),
                    unitCost: products[0]?.cost || 0,
                  },
                ])
              }
            >
              <Plus size={17} /> Thêm dòng
            </button>
          </div>
          <ErrorBox message={error} retry={reload} />
          <div className="purchase-meta">
            <label className="field">
              Nhà cung cấp
              <input
                maxLength={160}
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
                placeholder="Ví dụ: Công ty phân phối ABC"
              />
            </label>
            <label className="field">
              Số chứng từ nhà cung cấp
              <input
                maxLength={80}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Không bắt buộc"
              />
            </label>
          </div>
          {loading && !data ? (
            <Loading />
          ) : (
            <div className="table-scroll purchase-table">
              <table>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="align-right">Tồn hiện tại</th>
                    <th>Số lượng nhập</th>
                    <th>Giá nhập</th>
                    <th>Mã lô</th>
                    <th>Ngày sản xuất</th>
                    <th>Hạn sử dụng</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const product = products.find(
                      (item) => item.id === line.productId,
                    );
                    return (
                      <tr key={line.id}>
                        <td>
                          <select
                            required
                            value={line.productId}
                            onChange={(event) => {
                              const selectedProduct = products.find(
                                (item) => item.id === event.target.value,
                              );
                              updateLine(line.id, {
                                productId: event.target.value,
                                batchCode: "",
                                unitCost: selectedProduct?.cost || 0,
                              });
                            }}
                            aria-label="Sản phẩm"
                          >
                            <option value="">Chọn sản phẩm</option>
                            {products.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} · {item.sku}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="align-right strong">
                          {product?.stock ?? "—"}
                        </td>
                        <td>
                          <input
                            required
                            type="number"
                            min={1}
                            max={1_000_000}
                            value={line.quantity}
                            onChange={(event) =>
                              updateLine(line.id, {
                                quantity: Number(event.target.value),
                              })
                            }
                            aria-label="Số lượng nhập"
                          />
                        </td>
                        <td>
                          <input
                            required
                            type="number"
                            min={0}
                            max={100_000_000}
                            value={line.unitCost}
                            onChange={(event) =>
                              updateLine(line.id, {
                                unitCost: Number(event.target.value),
                              })
                            }
                            aria-label="Giá nhập"
                          />
                        </td>
                        <td>
                          <div className="batch-input">
                            <input
                              required
                              maxLength={80}
                              value={line.batchCode}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  batchCode: event.target.value,
                                })
                              }
                              placeholder="Mã lô"
                              aria-label="Mã lô"
                            />
                            <button
                              type="button"
                              className="icon-button"
                              title="Tạo mã lô"
                              onClick={() => generateBatchCode(line)}
                            >
                              <RefreshCw size={15} />
                            </button>
                          </div>
                        </td>
                        <td>
                          <input
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={line.manufacturedAt}
                            onChange={(event) =>
                              updateLine(line.id, {
                                manufacturedAt: event.target.value,
                              })
                            }
                            aria-label="Ngày sản xuất"
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
                            value={line.expiryDate}
                            onChange={(event) =>
                              updateLine(line.id, {
                                expiryDate: event.target.value,
                              })
                            }
                            aria-label="Hạn sử dụng"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-button danger"
                            title="Xóa dòng"
                            disabled={lines.length === 1}
                            onClick={() =>
                              setLines((current) =>
                                current.filter((item) => item.id !== line.id),
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="card purchase-summary">
          <div>
            <PackagePlus size={22} />
            <h2>Tổng phiếu nhập</h2>
          </div>
          <dl>
            <div>
              <dt>Số dòng hàng</dt>
              <dd>{lines.length}</dd>
            </div>
            <div>
              <dt>Tổng số lượng</dt>
              <dd>{totalQuantity}</dd>
            </div>
            <div>
              <dt>Giá vốn dự kiến</dt>
              <dd>{money(estimatedCost)}</dd>
            </div>
          </dl>
          <label className="field">
            Ghi chú phiếu nhập
            <textarea
              required
              minLength={3}
              maxLength={300}
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <ErrorBox message={formError} />
          <button
            className="button primary purchase-submit"
            disabled={busy || loading || !products.length}
          >
            <PackagePlus size={18} />
            {busy ? "Đang nhập kho…" : "Hoàn tất nhập hàng"}
          </button>
          <small className="muted">
            Phiếu chỉ được ghi khi tất cả dòng đều hợp lệ.
          </small>
        </aside>
      </form>
      <section className="card receipt-history">
        <div className="card-heading">
          <div>
            <h2>Lịch sử phiếu nhập</h2>
            <p>Mỗi phiếu lưu toàn bộ mặt hàng và lô được nhập cùng lúc</p>
          </div>
          <span className="subtle-chip">{receipts?.length || 0} phiếu</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Thời gian</th>
                <th>Nhà cung cấp</th>
                <th>Chứng từ</th>
                <th>Mặt hàng</th>
                <th className="align-right">Số lượng</th>
                <th className="align-right">Giá trị nhập</th>
              </tr>
            </thead>
            <tbody>
              {receipts?.map((receipt) => (
                <tr key={receipt.id}>
                  <td className="strong text-blue">{receipt.code}</td>
                  <td className="nowrap">{dateTime(receipt.createdAt)}</td>
                  <td>{receipt.supplier || "—"}</td>
                  <td>{receipt.reference || "—"}</td>
                  <td>
                    {receipt.lines
                      .slice(0, 2)
                      .map((line) => `${line.productName} · ${line.batchCode}`)
                      .join(", ")}
                    {receipt.lines.length > 2
                      ? ` và ${receipt.lines.length - 2} dòng khác`
                      : ""}
                  </td>
                  <td className="align-right strong">
                    {receipt.totalQuantity}
                  </td>
                  <td className="align-right strong">
                    {money(receipt.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!receipts?.length && (
            <Empty
              text="Chưa có phiếu nhập"
              hint="Phiếu đầu tiên sẽ xuất hiện tại đây sau khi hoàn tất nhập hàng."
            />
          )}
        </div>
      </section>
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}

export function InventoryPage({ user }: { user: User }) {
  const { data, loading, error, reload } = useData<Product[]>("/inventory");
  const { data: movements, reload: reloadMoves } = useData<Movement[]>(
    "/inventory/movements",
  );
  const { data: lots, reload: reloadLots } =
    useData<InventoryLot[]>("/inventory/lots");
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [movementType, setMovementType] = useState<"ADJUSTMENT" | "DAMAGE">(
    "ADJUSTMENT",
  );
  const [note, setNote] = useState("Điều chỉnh sau kiểm kê");
  const [lotId, setLotId] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const low = (data || []).filter(
    (p) => p.active && (p.availableStock ?? p.stock) <= p.minStock,
  );
  const expiryAlerts = (lots || []).filter((lot) =>
    ["EXPIRED", "URGENT", "WARNING"].includes(lot.expiryStatus),
  );
  const productLots = (lots || []).filter(
    (lot) => lot.productId === selected?.id && lot.quantity > 0,
  );
  const selectedLot = productLots.find((lot) => lot.id === lotId);
  async function adjust(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setFormError("");
    try {
      await mutate("/inventory/adjust", {
        productId: selected.id,
        quantity,
        type: movementType,
        note,
        ...(movementType === "DAMAGE" ? { lotId } : {}),
      });
      setSelected(null);
      await Promise.all([reload(), reloadMoves(), reloadLots()]);
      setToast("Đã cập nhật tồn kho và lưu lịch sử.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Quản lý kho"
        subtitle="Theo dõi tồn thực tế và mọi biến động hàng hóa."
      >
        {user.role === "ADMIN" && (
          <Link href="/purchases" className="button primary">
            <PackagePlus size={17} /> Tạo phiếu nhập
          </Link>
        )}
        <button
          className="button secondary"
          onClick={() => {
            void reload();
            void reloadMoves();
            void reloadLots();
          }}
        >
          <RefreshCw size={16} /> Làm mới
        </button>
      </PageHeading>
      {low.length > 0 && (
        <div className="alert-banner">
          <Boxes size={22} />
          <div>
            <strong>{low.length} sản phẩm chạm mức tồn tối thiểu</strong>
            <span>
              {low
                .slice(0, 4)
                .map((p) => p.name)
                .join(", ")}
            </span>
          </div>
        </div>
      )}
      {expiryAlerts.length > 0 && (
        <div className="alert-banner expiry-alert-banner">
          <CalendarClock size={22} />
          <div>
            <strong>
              {
                expiryAlerts.filter((lot) => lot.expiryStatus === "EXPIRED")
                  .length
              }{" "}
              lô đã hết hạn ·{" "}
              {
                expiryAlerts.filter((lot) => lot.expiryStatus !== "EXPIRED")
                  .length
              }{" "}
              lô sắp hết hạn
            </strong>
            <span>
              {expiryAlerts
                .slice(0, 4)
                .map((lot) => `${lot.product.name} (${lot.batchCode})`)
                .join(", ")}
            </span>
          </div>
        </div>
      )}
      <div className="inventory-grid">
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Tồn kho hiện tại</h2>
              <p>{data?.length || 0} mặt hàng</p>
            </div>
          </div>
          <ErrorBox message={error} />
          {loading && !data ? (
            <Loading />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="align-right">Tồn</th>
                    <th className="align-right">Có thể bán</th>
                    <th className="align-right">Mức tối thiểu</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data?.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <small className="block muted">{p.sku}</small>
                      </td>
                      <td
                        className={`align-right strong ${(p.availableStock ?? p.stock) <= p.minStock ? "text-warning" : ""}`}
                      >
                        {p.stock}
                      </td>
                      <td className="align-right strong">
                        {p.availableStock ?? p.stock}
                      </td>
                      <td className="align-right">{p.minStock}</td>
                      <td>
                        {user.role === "ADMIN" && (
                          <button
                            className="button tiny secondary"
                            onClick={() => {
                              setSelected(p);
                              setQuantity(1);
                              setMovementType("ADJUSTMENT");
                              setNote("Điều chỉnh sau kiểm kê");
                              setLotId("");
                            }}
                          >
                            Kiểm kê / xuất hủy
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Biến động gần đây</h2>
              <p>Lịch sử nhập, bán, hoàn và giữ hàng</p>
            </div>
          </div>
          <div className="movement-list">
            {movements?.slice(0, 18).map((m) => (
              <div key={m.id}>
                <span
                  className={m.quantity > 0 ? "movement-in" : "movement-out"}
                >
                  {m.quantity > 0 ? "+" : ""}
                  {m.quantity}
                </span>
                <div>
                  <strong>{m.productName}</strong>
                  <small>
                    <b className={`movement-kind kind-${m.type.toLowerCase()}`}>
                      {movementLabels[m.type] || m.type}
                    </b>
                    {m.note}
                    {m.batchCode ? ` · Lô ${m.batchCode}` : ""}
                  </small>
                </div>
                <time>{new Date(m.createdAt).toLocaleString("vi-VN")}</time>
              </div>
            ))}
            {!movements?.length && <Empty text="Chưa có biến động kho" />}
          </div>
        </section>
      </div>
      <section className="card lot-card">
        <div className="card-heading">
          <div>
            <h2>Lô hàng & hạn sử dụng</h2>
            <p>Ưu tiên xuất lô gần hết hạn trước theo nguyên tắc FEFO</p>
          </div>
          <span className="subtle-chip">{lots?.length || 0} lô còn hàng</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Mã lô</th>
                <th>Ngày nhập</th>
                <th>Ngày sản xuất</th>
                <th>Hạn sử dụng</th>
                <th className="align-right">Số lượng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {lots?.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <strong>{lot.product.name}</strong>
                    <small className="block muted">{lot.product.sku}</small>
                  </td>
                  <td className="strong">{lot.batchCode}</td>
                  <td>
                    {new Date(lot.receivedAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td>
                    {lot.manufacturedAt
                      ? new Date(lot.manufacturedAt).toLocaleDateString("vi-VN")
                      : "—"}
                  </td>
                  <td>
                    {lot.expiryDate
                      ? new Date(lot.expiryDate).toLocaleDateString("vi-VN")
                      : "Không áp dụng"}
                  </td>
                  <td className="align-right strong">{lot.quantity}</td>
                  <td>
                    <span
                      className={`expiry-state expiry-${lot.expiryStatus.toLowerCase()}`}
                    >
                      {lot.expiryStatus === "EXPIRED"
                        ? "Đã hết hạn"
                        : lot.expiryStatus === "URGENT"
                          ? `Còn ${lot.daysUntilExpiry} ngày`
                          : lot.expiryStatus === "WARNING"
                            ? `Còn ${lot.daysUntilExpiry} ngày`
                            : lot.expiryStatus === "NO_EXPIRY"
                              ? "Không HSD"
                              : "Còn hạn"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lots?.length && <Empty text="Chưa có lô hàng" />}
        </div>
      </section>
      <Modal
        opened={!!selected}
        onClose={() => setSelected(null)}
        title={`Xử lý kho · ${selected?.name || ""}`}
        centered
      >
        <form onSubmit={adjust}>
          <div className="stock-now">
            Tồn hiện tại <strong>{selected?.stock}</strong>
          </div>
          <label className="field">
            Loại nghiệp vụ
            <select
              value={movementType}
              onChange={(e) => {
                const type = e.target.value as typeof movementType;
                setMovementType(type);
                if (type === "DAMAGE") {
                  setQuantity(Math.max(1, Math.abs(quantity)));
                  setNote("Xuất hủy hàng hỏng/hết hạn");
                  setLotId(productLots[0]?.id || "");
                } else {
                  setQuantity(Math.max(1, Math.abs(quantity)));
                  setNote("Điều chỉnh sau kiểm kê");
                  setLotId("");
                }
              }}
            >
              <option value="ADJUSTMENT">Kiểm kê / điều chỉnh</option>
              <option value="DAMAGE">Xuất hủy</option>
            </select>
          </label>
          {movementType === "DAMAGE" && (
            <label className="field">
              Lô cần xuất hủy
              <select
                required
                value={lotId}
                onChange={(event) => {
                  const nextLotId = event.target.value;
                  const nextLot = productLots.find(
                    (lot) => lot.id === nextLotId,
                  );
                  setLotId(nextLotId);
                  if (nextLot)
                    setQuantity((current) =>
                      Math.min(Math.max(1, Math.abs(current)), nextLot.quantity),
                    );
                }}
              >
                <option value="">Chọn lô hàng</option>
                {productLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.batchCode} · còn {lot.quantity}
                    {lot.expiryDate
                      ? ` · HSD ${new Date(lot.expiryDate).toLocaleDateString("vi-VN")}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            {movementType === "DAMAGE"
              ? "Số lượng xuất hủy"
              : "Số lượng thay đổi"}
            <input
              type="number"
              required
              min={movementType === "DAMAGE" ? 1 : undefined}
              max={movementType === "DAMAGE" ? selectedLot?.quantity : undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <small>
              {movementType === "DAMAGE"
                ? `Nhập số lượng cần hủy (tối đa ${selectedLot?.quantity ?? 0}). Hệ thống sẽ tự trừ kho.`
                : "Số dương để tăng, số âm để giảm."}
            </small>
          </label>
          <label className="field">
            Lý do
            <input
              required
              minLength={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <ErrorBox message={formError} />
          <button className="button primary full" disabled={busy}>
            <PackagePlus size={17} />
            {busy ? "Đang cập nhật…" : "Ghi nhận biến động kho"}
          </button>
        </form>
      </Modal>
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}

export function CustomersPage() {
  const { data, loading, error, reload } = useData<Customer[]>("/customers");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const filtered = (data || []).filter((c) =>
    `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      editing
        ? await mutate(`/customers/${editing.id}`, form, "PATCH")
        : await mutate("/customers", form);
      setOpen(false);
      await reload();
      setToast(editing ? "Đã cập nhật khách hàng." : "Đã thêm khách hàng.");
    } catch (x) {
      setFormError((x as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        title="Khách hàng"
        subtitle="Lưu thông tin khách quen và điểm tích lũy."
      >
        <button
          className="button primary"
          onClick={() => {
            setEditing(null);
            setForm({ name: "", phone: "", email: "" });
            setOpen(true);
          }}
        >
          <Plus size={18} /> Thêm khách hàng
        </button>
      </PageHeading>
      <section className="card">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên hoặc số điện thoại…"
            />
          </div>
        </div>
        <ErrorBox message={error} />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Điện thoại</th>
                  <th>Email</th>
                  <th className="align-right">Điểm</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.phone}</td>
                    <td>{c.email || "—"}</td>
                    <td className="align-right strong">{c.points}</td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => {
                          setEditing(c);
                          setForm({
                            name: c.name,
                            phone: c.phone,
                            email: c.email || "",
                          });
                          setOpen(true);
                        }}
                      >
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty text="Chưa có khách hàng" />}
          </div>
        )}
      </section>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={editing ? "Cập nhật khách hàng" : "Thêm khách hàng"}
        centered
      >
        <form onSubmit={save}>
          <label className="field">
            Họ tên
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field">
            Số điện thoại
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <ErrorBox message={formError} />
          <button className="button primary full">Lưu khách hàng</button>
        </form>
      </Modal>
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}

type Staff = User & { createdAt?: string };
export function StaffPage() {
  const { data, loading, error, reload } = useData<Staff[]>("/users");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "EasyRetail@2026",
    role: "STAFF",
    active: true,
  });
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await mutate("/users", form);
      setOpen(false);
      await reload();
      setToast("Đã tạo tài khoản nhân viên.");
    } catch (x) {
      setFormError((x as Error).message);
    }
  }
  async function toggle(u: Staff) {
    try {
      await mutate(`/users/${u.id}`, { active: !u.active }, "PATCH");
      await reload();
      setToast("Đã cập nhật trạng thái tài khoản.");
    } catch (x) {
      setToast((x as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        title="Nhân viên & phân quyền"
        subtitle="Quản lý tài khoản vận hành điểm bán."
      >
        <button className="button primary" onClick={() => setOpen(true)}>
          <UserPlus size={18} /> Thêm nhân viên
        </button>
      </PageHeading>
      <section className="card">
        <ErrorBox message={error} />
        {loading && !data ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data?.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <Badge status={u.role} />
                    </td>
                    <td>
                      <span
                        className={`state-dot ${u.active ? "on" : "off"}`}
                      />
                      {u.active ? "Hoạt động" : "Đã khóa"}
                    </td>
                    <td>
                      <button
                        className="button tiny secondary"
                        onClick={() => toggle(u)}
                      >
                        {u.active ? "Khóa" : "Mở khóa"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Thêm tài khoản"
        centered
      >
        <form onSubmit={create}>
          <label className="field">
            Họ tên
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="field">
            Mật khẩu
            <input
              type="password"
              minLength={8}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label className="field">
            Vai trò
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="STAFF">Nhân viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </label>
          <ErrorBox message={formError} />
          <button className="button primary full">Tạo tài khoản</button>
        </form>
      </Modal>
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}

export function SettingsPage() {
  const { data, error, loading, reload } = useData<Store>("/store");
  const [form, setForm] = useState<Store>({
    name: "",
    address: "",
    phone: "",
    receiptNote: "",
  });
  const [synced, setSynced] = useState("");
  const [toast, setToast] = useState("");
  if (data && synced !== JSON.stringify(data)) {
    setForm(data);
    setSynced(JSON.stringify(data));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const next = await mutate<Store>("/store", form, "PATCH");
      setForm(next);
      setSynced(JSON.stringify(next));
      setToast("Đã lưu thiết lập điểm bán.");
      void reload();
    } catch (x) {
      setToast((x as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        title="Thiết lập điểm bán"
        subtitle="Thông tin hiển thị tại quầy bán hàng và trên biên nhận."
      />
      <div className="settings-layout">
        <section className="card settings-card">
          <div className="settings-title">
            <Settings size={22} />
            <div>
              <h2>Thông tin cửa hàng</h2>
              <p>Được lưu trực tiếp trong database.</p>
            </div>
          </div>
          <ErrorBox message={error} />
          {loading && !data ? (
            <Loading />
          ) : (
            <form onSubmit={save}>
              <label className="field">
                Tên điểm bán
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="field">
                Địa chỉ
                <input
                  required
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Số điện thoại
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="field">
                Lời nhắn trên biên nhận
                <textarea
                  rows={3}
                  value={form.receiptNote}
                  onChange={(e) =>
                    setForm({ ...form, receiptNote: e.target.value })
                  }
                />
              </label>
              <button className="button primary">Lưu thay đổi</button>
            </form>
          )}
        </section>
        <aside className="card prototype-note">
          <ShieldCheck size={28} />
          <h2>Cấu hình thanh toán</h2>
          <p>
            Hệ thống hỗ trợ VietQR thật qua payOS hoặc chế độ demo. Biên nhận
            bán hàng không phải hóa đơn điện tử thuế.
          </p>
          <div>
            <span className="live-dot" /> Database MongoDB đang lưu dữ liệu
          </div>
        </aside>
      </div>
      <Toast message={toast} clear={() => setToast("")} />
    </>
  );
}
