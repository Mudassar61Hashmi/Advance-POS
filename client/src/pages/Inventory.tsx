import React, { useState, useRef } from "react";
import type { Product } from "../types";
import {
  Plus, Search, Edit2, Trash2, Package,
  AlertCircle, Camera, Upload, X, RefreshCw,
  Loader2, Check, ChevronUp, ChevronDown,
  TrendingUp, DollarSign, Minus, ArrowUpDown,
  CheckSquare, Square, Trash, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { CategoryBar } from "../components/CategoryBar";
import { pushAppNotification } from "../notifications";
import { useAppSettings } from "../hooks/useAppSettings";

interface InventoryProps {
  products: Product[];
  onUpdate: () => void;
}

type SortCol = "name" | "category" | "price" | "cost" | "quantity";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "inStock" | "lowStock" | "outOfStock";

/* ─────────────────────── TOAST ─────────────────────── */
const Toast: React.FC<{ msg: string | null; type?: "success" | "error" }> = ({ msg, type = "success" }) => (
  <AnimatePresence>
    {msg && (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold text-white ${
          type === "success" ? "bg-zinc-900" : "bg-red-500"
        }`}
      >
        {type === "success" ? <Check size={15} className="text-emerald-400" /> : <X size={15} />}
        {msg}
      </motion.div>
    )}
  </AnimatePresence>
);

/* ─────────────────────── STATUS BADGE ─────────────────────── */
const StockBadge: React.FC<{ qty: number; threshold?: number }> = ({ qty, threshold = 10 }) => {
  if (qty <= 0)         return <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[9px] font-bold uppercase tracking-widest rounded-full">Out of Stock</span>;
  if (qty <= threshold) return <span className="px-2 py-0.5 bg-orange-50 text-orange-500 text-[9px] font-bold uppercase tracking-widest rounded-full">Low Stock</span>;
  return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest rounded-full">In Stock</span>;
};

/* ─────────────────────── SORT HEADER ─────────────────────── */
const SortTh: React.FC<{ label: string; col: SortCol; sort: { col: SortCol; dir: SortDir }; onSort: (c: SortCol) => void; className?: string }> =
  ({ label, col, sort, onSort, className = "" }) => (
    <th
      onClick={() => onSort(col)}
      className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 cursor-pointer select-none hover:text-zinc-600 transition-colors whitespace-nowrap ${className}`}
    >
      <span className="flex items-center gap-1">
        {label}
        {sort.col === col
          ? (sort.dir === "asc" ? <ChevronUp size={11} className="text-zinc-700" /> : <ChevronDown size={11} className="text-zinc-700" />)
          : <ArrowUpDown size={10} className="text-zinc-300" />}
      </span>
    </th>
  );

export const Inventory: React.FC<InventoryProps> = ({ products, onUpdate }) => {
  const { formatCurrency } = useAppSettings();
  const [search, setSearch]           = useState("");
  const [categoryFilter, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort]               = useState<{ col: SortCol; dir: SortDir }>({ col: "name", dir: "asc" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [page, setPage]               = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjDelta, setAdjDelta]       = useState(0);
  const [adjLoading, setAdjLoading]   = useState(false);
  const PAGE_SIZE = 12;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const categoryCounts = React.useMemo(() => {
    const c: Record<string, number> = { All: products.length };
    products.forEach(p => { if (p.category) c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, [products]);

  const handleSort = (col: SortCol) => {
    setSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" });
    setPage(1);
  };

  const filtered = React.useMemo(() => {
    let list = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || "").includes(search);
      const matchCat    = categoryFilter === "All" || p.category === categoryFilter;
      const thresh      = p.lowStockThreshold ?? 10;
      const matchStatus = statusFilter === "all"
        ? true
        : statusFilter === "inStock"    ? p.quantity > thresh
        : statusFilter === "lowStock"   ? (p.quantity > 0 && p.quantity <= thresh)
        : p.quantity <= 0;
      return matchSearch && matchCat && matchStatus;
    });
    list = [...list].sort((a, b) => {
      let va: string | number, vb: string | number;
      if (sort.col === "name")     { va = a.name.toLowerCase();      vb = b.name.toLowerCase(); }
      else if (sort.col === "category") { va = a.category.toLowerCase(); vb = b.category.toLowerCase(); }
      else if (sort.col === "price")    { va = a.price;                  vb = b.price; }
      else if (sort.col === "cost")     { va = a.cost ?? 0;              vb = b.cost ?? 0; }
      else                              { va = a.quantity;               vb = b.quantity; }
      if (va < vb) return sort.dir === "asc" ? -1 : 1;
      if (va > vb) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [products, search, categoryFilter, statusFilter, sort]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  React.useEffect(() => { setPage(1); }, [search, categoryFilter, statusFilter]);

  const stats = {
    total:      products.length,
    inStock:    products.filter(p => p.quantity > (p.lowStockThreshold ?? 10)).length,
    lowStock:   products.filter(p => p.quantity > 0 && p.quantity <= (p.lowStockThreshold ?? 10)).length,
    outOfStock: products.filter(p => p.quantity <= 0).length,
    totalValue: products.reduce((s, p) => s + p.price * p.quantity, 0),
  };

  /* ── Delete ── */
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await doDelete([id]);
  };

  const doDelete = async (ids: string[]) => {
    const token = (() => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } })();
    let ok = 0;
    for (const id of ids) {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) ok++;
    }
    onUpdate();
    setSelectedIds(new Set());
    if (ok === ids.length) { showToast(`${ok} product${ok > 1 ? "s" : ""} deleted`); pushAppNotification("Inventory updated", `${ok} product${ok > 1 ? "s" : ""} deleted.`); }
    else showToast("Some deletes failed", "error");
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected product${selectedIds.size > 1 ? "s" : ""}?`)) return;
    await doDelete([...selectedIds]);
  };

  /* ── Select ── */
  const toggleSelect = (id: string) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p._id));
  const toggleAll = () => {
    if (allPageSelected) setSelectedIds(s => { const n = new Set(s); paginated.forEach(p => n.delete(p._id)); return n; });
    else setSelectedIds(s => { const n = new Set(s); paginated.forEach(p => n.add(p._id)); return n; });
  };

  /* ── Inline stock adjustment ── */
  const startAdjust = (id: string, current: number) => { setAdjustingId(id); setAdjDelta(0); };
  const commitAdjust = async (product: Product) => {
    if (adjDelta === 0) { setAdjustingId(null); return; }
    setAdjLoading(true);
    const token = (() => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } })();
    try {
      const newQty = Math.max(0, product.quantity + adjDelta);
      const res = await fetch(`/api/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...product, quantity: newQty }),
      });
      if (res.ok) { onUpdate(); showToast(`Stock updated: ${product.name}`); }
      else showToast("Stock update failed", "error");
    } catch { showToast("Stock update failed", "error"); }
    setAdjLoading(false);
    setAdjustingId(null);
    setAdjDelta(0);
  };

  const statusTabs: { key: StatusFilter; label: string; count: number; color: string }[] = [
    { key: "all",        label: "All",         count: products.length,      color: "text-zinc-600"   },
    { key: "inStock",    label: "In Stock",    count: stats.inStock,        color: "text-emerald-600" },
    { key: "lowStock",   label: "Low Stock",   count: stats.lowStock,       color: "text-orange-500"  },
    { key: "outOfStock", label: "Out of Stock",count: stats.outOfStock,     color: "text-red-500"     },
  ];

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden" style={{ background: "var(--theme-bg)" }}>
      <Toast msg={toast?.msg || null} type={toast?.type} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--theme-text)" }}>Inventory</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{products.length} product{products.length !== 1 ? "s" : ""} · {formatCurrency(stats.totalValue)} total value</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onUpdate} className="p-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 transition-all shadow-sm" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 text-sm"
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5 flex-shrink-0">
        {[
          { label: "Total",       value: stats.total,      color: "text-zinc-600",    bg: "bg-zinc-100",   icon: Package },
          { label: "In Stock",    value: stats.inStock,    color: "text-emerald-600", bg: "bg-emerald-50", icon: Check },
          { label: "Low Stock",   value: stats.lowStock,   color: "text-orange-500",  bg: "bg-orange-50",  icon: AlertCircle },
          { label: "Out of Stock",value: stats.outOfStock, color: "text-red-500",     bg: "bg-red-50",     icon: X },
          { label: "Stock Value", value: formatCurrency(stats.totalValue), color: "text-indigo-600", bg: "bg-indigo-50", icon: DollarSign },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{c.label}</p>
            <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main table card */}
      <div className="bg-white rounded-3xl shadow-sm border border-black/5 flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Toolbar */}
        <div className="p-4 border-b border-black/5 flex flex-col gap-3 flex-shrink-0">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or barcode…"
                className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8 placeholder:text-zinc-400" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"><X size={13} /></button>}
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center gap-1 bg-zinc-50 rounded-xl p-1">
              {statusTabs.map(t => (
                <button key={t.key} onClick={() => { setStatusFilter(t.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                    statusFilter === t.key ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                  }`}>
                  {t.label} <span className={`ml-1 ${statusFilter === t.key ? t.color : "text-zinc-300"}`}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Category bar */}
            <div className="flex-1 min-w-0">
              <CategoryBar categories={categories} active={categoryFilter} onSelect={val => { setCategory(val); setPage(1); }} counts={categoryCounts} />
            </div>
          </div>

          {/* Bulk action bar */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900 text-white rounded-xl">
                <span className="text-sm font-semibold">{selectedIds.size} selected</span>
                <button onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all">
                  <Trash size={12} /> Delete Selected
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-zinc-400 hover:text-white text-xs transition-colors">
                  Clear selection
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead className="sticky top-0 bg-white border-b border-black/5 z-10">
              <tr>
                <th className="px-5 py-3.5 w-10">
                  <button onClick={toggleAll} className="text-zinc-300 hover:text-zinc-700 transition-colors">
                    {allPageSelected ? <CheckSquare size={15} className="text-zinc-700" /> : <Square size={15} />}
                  </button>
                </th>
                <SortTh label="Product"  col="name"     sort={sort} onSort={handleSort} />
                <SortTh label="Category" col="category" sort={sort} onSort={handleSort} />
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Barcode</th>
                <SortTh label="Price"    col="price"    sort={sort} onSort={handleSort} />
                <SortTh label="Cost"     col="cost"     sort={sort} onSort={handleSort} />
                <SortTh label="Stock"    col="quantity" sort={sort} onSort={handleSort} />
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Status</th>
                <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-zinc-400 text-sm">
                  <Package size={32} className="mx-auto mb-3 text-zinc-200" />
                  No products found
                </td></tr>
              ) : paginated.map((product, i) => (
                <motion.tr key={product._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
                  className={`border-b border-black/[0.04] hover:bg-zinc-50/60 transition-colors group ${selectedIds.has(product._id) ? "bg-indigo-50/40" : ""}`}>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleSelect(product._id)} className="text-zinc-300 hover:text-zinc-700 transition-colors">
                      {selectedIds.has(product._id) ? <CheckSquare size={15} className="text-indigo-500" /> : <Square size={15} />}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100 flex items-center justify-center">
                        {product.image
                          ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                          : <Package size={16} className="text-zinc-300" />}
                      </div>
                      <span className="font-semibold text-sm text-zinc-900 leading-tight">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="text-xs text-zinc-500">{product.category}</span></td>
                  <td className="px-5 py-3"><span className="text-xs font-mono text-zinc-400">{product.barcode || "—"}</span></td>
                  <td className="px-5 py-3"><span className="font-bold text-sm text-zinc-900">{formatCurrency(product.price)}</span></td>
                  <td className="px-5 py-3"><span className="text-sm text-zinc-400">{product.cost ? formatCurrency(product.cost) : "—"}</span></td>
                  <td className="px-5 py-3">
                    {adjustingId === product._id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setAdjDelta(d => d - 1)} className="w-6 h-6 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold transition-all"><Minus size={11} /></button>
                        <span className="min-w-[40px] text-center text-sm font-bold text-zinc-900">{Math.max(0, product.quantity + adjDelta)}</span>
                        <button onClick={() => setAdjDelta(d => d + 1)} className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center font-bold transition-all"><Plus size={11} /></button>
                        <button onClick={() => commitAdjust(product)} disabled={adjLoading}
                          className="px-2 py-1 bg-black text-white rounded-lg text-[11px] font-bold hover:bg-zinc-800 transition-all disabled:opacity-50">
                          {adjLoading ? <Loader2 size={10} className="animate-spin" /> : "Save"}
                        </button>
                        <button onClick={() => { setAdjustingId(null); setAdjDelta(0); }} className="text-zinc-400 hover:text-zinc-700"><X size={12} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startAdjust(product._id, product.quantity)}
                        className="flex items-center gap-1.5 group/qty hover:bg-zinc-100 rounded-lg px-1.5 py-0.5 transition-all">
                        <span className={`text-sm font-bold ${product.quantity <= 0 ? "text-red-500" : product.quantity <= (product.lowStockThreshold ?? 10) ? "text-orange-500" : "text-zinc-900"}`}>
                          {product.quantity}
                        </span>
                        {product.quantity <= (product.lowStockThreshold ?? 10) && product.quantity > 0 && (
                          <AlertCircle size={11} className="text-orange-400" />
                        )}
                        <TrendingUp size={11} className="text-zinc-300 opacity-0 group-hover/qty:opacity-100 transition-opacity" title="Adjust stock" />
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StockBadge qty={product.quantity} threshold={product.lowStockThreshold} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                        className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(product._id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-black/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Showing <span className="font-semibold text-zinc-600">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-zinc-600">{filtered.length}</span> products
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(1)} disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-30 hover:bg-zinc-50 transition-all">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-30 hover:bg-zinc-50 transition-all">Prev</button>
                <span className="text-[11px] font-semibold text-zinc-500 px-2">{currentPage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-30 hover:bg-zinc-50 transition-all">Next</button>
                <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-30 hover:bg-zinc-50 transition-all">»</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <ProductModal
            product={editingProduct}
            existingCategories={categories.filter(c => c !== "All")}
            onClose={() => setIsModalOpen(false)}
            onSave={() => {
              setIsModalOpen(false);
              onUpdate();
              showToast(editingProduct ? "Product updated" : "Product created");
              pushAppNotification("Inventory updated", editingProduct ? "A product was updated." : "A new product was added.");
            }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═════════════════════════════════════════════════
   PRODUCT MODAL  — with image, camera, cost field
═════════════════════════════════════════════════ */
interface ProductModalProps {
  product:            Product | null;
  existingCategories: string[];
  onClose:            () => void;
  onSave:             () => void;
  onError:            (msg: string) => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ product, existingCategories, onClose, onSave, onError }) => {
  const [form, setForm] = useState({
    name:              product?.name              ?? "",
    price:             product?.price             ?? 0,
    cost:              product?.cost              ?? 0,
    quantity:          product?.quantity          ?? 0,
    category:          product?.category          ?? "",
    barcode:           product?.barcode           ?? "",
    lowStockThreshold: product?.lowStockThreshold ?? 10,
    image:             product?.image             ?? null as string | null,
  });
  const [submitting, setSubmitting]   = useState(false);
  const [imageMode, setImageMode]     = useState<"upload" | "camera" | null>(null);
  const [catOpen, setCatOpen]         = useState(false);
  const [aiScanning, setAiScanning]   = useState(false);
  const [aiFields, setAiFields]       = useState<Set<string>>(new Set());
  const fileRef   = useRef<HTMLInputElement>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const catRef    = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!catOpen) return;
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [catOpen]);

  const filteredCats = existingCategories.filter(c =>
    c.toLowerCase().includes(form.category.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { onError("Image must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else                { width  = Math.round((width  * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        setForm(f => ({ ...f, image: canvas.toDataURL("image/jpeg", 0.75) }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setImageMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { onError("Camera access denied"); setImageMode(null); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const MAX = 600;
    let w = videoRef.current.videoWidth, h = videoRef.current.videoHeight;
    if (w > MAX || h > MAX) {
      if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
      else       { w = Math.round((w * MAX) / h); h = MAX; }
    }
    canvasRef.current.width  = w;
    canvasRef.current.height = h;
    canvasRef.current.getContext("2d")?.drawImage(videoRef.current, 0, 0, w, h);
    setForm(f => ({ ...f, image: canvasRef.current!.toDataURL("image/jpeg", 0.75) }));
    stopCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setImageMode(null);
  };

  const scanWithAI = async () => {
    if (!form.image || aiScanning) return;
    setAiScanning(true);
    try {
      const token = (() => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } })();
      const res = await fetch("/api/ai/scan-product", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ imageBase64: form.image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "AI scan failed");

      const filled = new Set<string>();
      const updates: Partial<typeof form> = {};
      if (data.name     && !form.name.trim())     { updates.name     = data.name;             filled.add("name");     }
      if (data.category && !form.category.trim()) { updates.category = data.category;         filled.add("category"); }
      if (data.barcode  && !form.barcode.trim())  { updates.barcode  = String(data.barcode);  filled.add("barcode");  }
      if (data.estimatedPrice && form.price === 0){ updates.price    = data.estimatedPrice;   filled.add("price");    }

      setForm(f => ({ ...f, ...updates }));
      setAiFields(filled);
    } catch (err: any) {
      onError(err.message || "AI scan failed");
    } finally {
      setAiScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim())     { onError("Product name is required"); return; }
    if (form.price <= 0)       { onError("Price must be greater than 0"); return; }
    if (form.quantity < 0)     { onError("Quantity cannot be negative"); return; }
    if (!form.category.trim()) { onError("Category is required"); return; }
    setSubmitting(true);
    const token = (() => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } })();
    try {
      const url    = product ? `/api/products/${product._id}` : "/api/products";
      const method = product ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, price: +form.price, cost: +form.cost, quantity: +form.quantity, lowStockThreshold: +form.lowStockThreshold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save");
      onSave();
    } catch (err: any) { onError(err.message || "Failed to save product"); }
    finally { setSubmitting(false); }
  };

  const margin = form.price > 0 && form.cost > 0
    ? (((form.price - form.cost) / form.price) * 100).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96, y: 12  }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-black/5 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{product ? "Edit Product" : "New Product"}</h2>
            <p className="text-zinc-400 text-sm mt-0.5">
              {product ? "Update product details below" : "Upload a photo and let AI fill the details"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
          {/* Image */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Product Image</label>
            {imageMode === "camera" ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden bg-zinc-900">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-44 object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={capturePhoto}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all">
                    <Camera size={15} /> Capture
                  </button>
                  <button type="button" onClick={stopCamera}
                    className="px-4 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            ) : form.image ? (
              <div className="space-y-2">
                <div className="relative">
                  <img src={form.image} alt="Product" className="w-full h-44 object-cover rounded-2xl border border-zinc-100" />
                  <button type="button" onClick={() => { setForm(f => ({ ...f, image: null })); setAiFields(new Set()); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black transition-all">
                    <X size={12} />
                  </button>
                </div>
                <motion.button
                  type="button"
                  onClick={scanWithAI}
                  disabled={aiScanning}
                  whileHover={{ scale: aiScanning ? 1 : 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                  style={{ background: aiScanning ? "#7c3aed" : "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
                >
                  {aiScanning
                    ? <><Loader2 size={14} className="animate-spin" /> Scanning product…</>
                    : <><Sparkles size={14} /> AI Scan — Auto-fill Details</>
                  }
                </motion.button>
                {aiFields.size > 0 && (
                  <p className="text-[11px] text-violet-500 font-semibold text-center">
                    AI filled {aiFields.size} field{aiFields.size > 1 ? "s" : ""} — review and adjust below
                  </p>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-5 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all text-sm font-medium">
                  <Upload size={16} /> Upload Image
                </button>
                <button type="button" onClick={startCamera}
                  className="flex-1 flex items-center justify-center gap-2 py-5 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-all text-sm font-medium">
                  <Camera size={16} /> Take Photo
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
              Product Name <span className="text-red-400">*</span>
              {aiFields.has("name") && <span className="bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">AI</span>}
            </label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Whole Milk 1L"
              className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
          </div>

          {/* Price + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                Sale Price <span className="text-red-400">*</span>
                {aiFields.has("price") && <span className="bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">AI</span>}
              </label>
              <input type="number" step="0.01" min="0" required value={form.price}
                onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Cost Price
                {margin && <span className="ml-2 text-emerald-500 font-semibold">{margin}% margin</span>}
              </label>
              <input type="number" step="0.01" min="0" value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: +e.target.value }))}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
          </div>

          {/* Quantity + Threshold */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Quantity <span className="text-red-400">*</span></label>
              <input type="number" min="0" required value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Low Stock Alert</label>
              <input type="number" min="0" value={form.lowStockThreshold}
                onChange={e => setForm(f => ({ ...f, lowStockThreshold: +e.target.value }))}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
          </div>

          {/* Category + Barcode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                Category <span className="text-red-400">*</span>
                {aiFields.has("category") && <span className="bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">AI</span>}
              </label>
              <div ref={catRef} className="relative">
                <div className="flex items-center bg-zinc-50 rounded-xl focus-within:ring-2 focus-within:ring-black/8 overflow-hidden">
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setCatOpen(true); }}
                    onFocus={() => setCatOpen(true)}
                    placeholder="e.g. Dairy"
                    className="flex-1 px-4 py-3 bg-transparent text-sm focus:outline-none min-w-0"
                  />
                  <button type="button" onClick={() => setCatOpen(o => !o)}
                    className="px-3 text-zinc-400 hover:text-zinc-600 transition-colors flex-shrink-0">
                    {catOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                <AnimatePresence>
                  {catOpen && filteredCats.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.12 }}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-y-auto max-h-44"
                    >
                      {filteredCats.map(cat => (
                        <li key={cat}>
                          <button type="button"
                            onMouseDown={e => { e.preventDefault(); setForm(f => ({ ...f, category: cat })); setCatOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 flex items-center gap-2 transition-colors">
                            {form.category === cat
                              ? <Check size={12} className="text-zinc-700 flex-shrink-0" />
                              : <span className="w-3 flex-shrink-0" />}
                            <span className={form.category === cat ? "font-medium text-zinc-900" : "text-zinc-600"}>{cat}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                Barcode
                {aiFields.has("barcode") && <span className="bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">AI</span>}
              </label>
              <input type="text" value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                placeholder="e.g. 1234567890"
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-[2] py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Saving…" : product ? "Update Product" : "Create Product"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
