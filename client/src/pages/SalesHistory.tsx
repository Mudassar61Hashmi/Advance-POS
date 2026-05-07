import React, { useState, useEffect } from "react";
import {
  Search, DollarSign, Eye, FileText, RefreshCw,
  X, Check, Loader2, ChevronDown, RotateCcw,
  Ban, CheckCircle2, Clock, Package, Printer,
  Tag, User, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAppSettings } from "../hooks/useAppSettings";

interface SaleItem {
  id:         string;
  name:       string;
  quantity:   number;
  price:      number;
  lineTotal?: number;
}

interface Sale {
  id:            string;
  _id:           string;
  invoiceNumber: string;
  cashier:       string;
  customerName?: string;
  customerPhone?:string;
  subtotal?:     number;
  discount?:     number;
  discountType?: "fixed" | "percent";
  tax?:          number;
  taxName?:      string;
  taxRate?:      number;
  total:         number;
  paymentMethod?:string;
  status:        string;
  note?:         string;
  refundNote?:   string;
  refundedAt?:   string;
  timestamp:     string;
  itemCount?:    number;
  items?:        SaleItem[];
}

interface SalesHistoryProps {
  onShowReceipt: (sale: any) => void;
}

/* ─────────────────────── STATUS META ─────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  completed:  { label: "Completed",  color: "#059669", bg: "#d1fae5", border: "#a7f3d0", icon: CheckCircle2 },
  pending:    { label: "Pending",    color: "#d97706", bg: "#fef3c7", border: "#fde68a", icon: Clock        },
  cancelled:  { label: "Cancelled",  color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", icon: Ban          },
  refunded:   { label: "Refunded",   color: "#dc2626", bg: "#fee2e2", border: "#fecaca", icon: RotateCcw    },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.completed;
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <Icon size={9} />{m.label}
    </span>
  );
};

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

/* ─────────────────────── STATUS DROPDOWN ─────────────────────── */
const StatusDropdown: React.FC<{
  sale: Sale;
  onUpdate: (id: string, status: string, note?: string) => Promise<void>;
}> = ({ sale, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const transitions: Record<string, string[]> = {
    pending:    ["completed", "cancelled"],
    completed:  ["cancelled", "refunded"],
    cancelled:  [],
    refunded:   [],
  };

  const available = transitions[sale.status] || [];
  if (available.length === 0) return null;

  const handle = async (s: string) => {
    setOpen(false);
    setBusy(true);
    const note = s === "refunded" ? window.prompt("Refund reason (optional):") || "" : undefined;
    await onUpdate(sale.id || sale._id, s, note);
    setBusy(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all disabled:opacity-40">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-8 bg-white border border-zinc-100 rounded-2xl shadow-2xl z-50 min-w-[160px] overflow-hidden p-1.5">
            {available.map(s => {
              const m = STATUS_META[s]; const Icon = m.icon;
              return (
                <button key={s} onClick={() => handle(s)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left"
                  style={{ color: m.color }}
                  onMouseEnter={e => (e.currentTarget.style.background = m.bg)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <Icon size={12} /> Mark {m.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ═════════════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════════════ */
export const SalesHistory: React.FC<SalesHistoryProps> = ({ onShowReceipt }) => {
  const { formatCurrency, formatDate, formatTime } = useAppSettings();
  const [sales, setSales]       = useState<Sale[]>([]);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 10;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { fetchSales(); }, [statusFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res  = await fetch(`/api/sales?${params}`);
      const data = await res.json();
      setSales(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load sales", "error"); }
    finally { setLoading(false); }
  };

  /* ── View receipt — fetch full sale details ── */
  const handleViewReceipt = async (sale: Sale) => {
    try {
      const id  = sale._id || sale.id;
      const res = await fetch(`/api/sales/${id}`);
      if (!res.ok) throw new Error("Failed to fetch sale");
      const fullSale = await res.json();

      /* Build the shape the ReceiptModal expects */
      onShowReceipt({
        id:           fullSale.id || fullSale._id,
        invoiceNumber:fullSale.invoiceNumber,
        cashier:      fullSale.cashier      || sale.cashier,
        customerName: fullSale.customerName || sale.customerName || "Walk-in Customer",
        subtotal:     fullSale.subtotal     ?? sale.subtotal ?? sale.total,
        discount:     fullSale.discount     ?? 0,
        discountType: fullSale.discountType ?? "fixed",
        tax:          fullSale.tax          ?? 0,
        taxName:      fullSale.taxName      ?? "",
        taxRate:      fullSale.taxRate      ?? 0,
        total:        fullSale.total        ?? sale.total,
        paymentMethod:fullSale.paymentMethod,
        cashReceived: fullSale.cashReceived,
        change:       fullSale.change,
        status:       fullSale.status,
        note:         fullSale.note,
        timestamp:    fullSale.timestamp    || sale.timestamp,
        items:        Array.isArray(fullSale.items) ? fullSale.items : [],
      });
    } catch { showToast("Failed to load receipt", "error"); }
  };

  /* ── Update status ── */
  const updateStatus = async (id: string, status: string, refundNote?: string) => {
    try {
      const res  = await fetch(`/api/sales/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, refundNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSales(prev => prev.map(s => (s.id === id || s._id === id) ? { ...s, status } : s));
      showToast(`Sale marked as ${STATUS_META[status]?.label || status}`);
    } catch (err: any) { showToast(err.message || "Failed to update", "error"); }
  };

  const filtered = sales.filter(s =>
    (s.invoiceNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.cashier       || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.customerName  || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.filter(s => s.status === "completed")
    .reduce((sum, s) => sum + s.total, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden" style={{ background: "var(--theme-bg)" }}>
      <Toast msg={toast?.msg || null} type={toast?.type} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sales History</h1>
          <p className="text-zinc-400 text-sm mt-0.5">All transactions and receipts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-100 rounded-xl shadow-sm">
            <DollarSign size={14} className="text-emerald-500" />
            <span className="text-sm font-bold text-zinc-900">
              Revenue: <span className="text-emerald-600">{formatCurrency(totalRevenue)}</span>
            </span>
          </div>
          <button onClick={fetchSales} className="p-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 transition-all shadow-sm">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-3xl shadow-sm border border-black/5 flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Toolbar */}
        <div className="p-5 border-b border-black/5 flex gap-3 items-center flex-shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice, cashier, customer..."
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8 placeholder:text-zinc-400" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"><X size={13} /></button>}
          </div>
          {/* Status filter pills */}
          <div className="flex gap-2 flex-wrap">
            {[{ key: "all", label: "All" }, ...Object.entries(STATUS_META).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-zinc-400">
              <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading transactions...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
                <FileText size={24} className="text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-500">No transactions found</p>
            </div>
          ) : (
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead className="sticky top-0 bg-white border-b border-black/5 z-10">
                <tr>
                  {["Invoice","Customer","Date & Time","Total","Payment","Status","Actions"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((sale, i) => (
                  <motion.tr key={sale.id || sale._id}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                    className="border-b border-black/[0.04] hover:bg-zinc-50/60 transition-colors group">

                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-zinc-700">
                        {sale.invoiceNumber || `#${String(sale.id || sale._id).slice(-8).toUpperCase()}`}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-semibold text-sm text-zinc-900">{sale.customerName || "Walk-in"}</p>
                      {sale.cashier && <p className="text-[10px] text-zinc-400">{sale.cashier}</p>}
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-zinc-700">{formatDate(sale.timestamp)}</p>
                      <p className="text-[10px] text-zinc-400">{formatTime(sale.timestamp)}</p>
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-bold text-sm text-zinc-900">{formatCurrency(sale.total)}</span>
                      {(sale.discount || 0) > 0 && (
                        <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                          <Tag size={9} /> −{formatCurrency(sale.discount || 0)}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                        {sale.paymentMethod || "cash"}
                      </span>
                    </td>

                    <td className="px-5 py-4"><StatusBadge status={sale.status || "completed"} /></td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-100">
                        <button onClick={() => handleViewReceipt(sale)}
                          className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all" title="View Receipt">
                          <Eye size={13} />
                        </button>
                        <StatusDropdown sale={sale} onUpdate={updateStatus} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-zinc-400">
              <span className="font-semibold text-zinc-600">{paginated.length}</span> of{" "}
              <span className="font-semibold text-zinc-600">{filtered.length}</span> transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-[11px] font-semibold text-zinc-500">{currentPage}/{totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40"
              >
                Next
              </button>
              <p className="text-xs font-bold text-zinc-700 ml-3">
                Completed Revenue: <span className="text-emerald-600">{formatCurrency(totalRevenue)}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};