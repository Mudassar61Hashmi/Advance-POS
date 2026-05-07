import React, { useState, useEffect, useCallback } from "react";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  CreditCard, Plus, Edit2, Trash2, Check, X, Loader2,
  Star, StarOff, ToggleLeft, ToggleRight, DollarSign,
  Smartphone, Building2, Banknote, Wallet,
  RefreshCw, Search, RotateCcw,
  CheckCircle2, AlertCircle, Eye, TrendingUp, Zap,
  User, Calendar, Hash, ArrowDownLeft, MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────── TYPES ─────────────────────── */
interface PaymentMethod {
  _id:           string;
  name:          string;
  type:          "cash" | "card_credit" | "card_debit" | "bank_transfer" | "mobile_wallet" | "other";
  provider:      string;
  accountNumber: string;
  accountTitle:  string;
  isActive:      boolean;
  isDefault:     boolean;
  icon:          string;
  color:         string;
  processingFee: number;
  notes:         string;
}

interface Payment {
  _id:           string;
  amount:        number;
  processingFee: number;
  netAmount:     number;
  methodName:    string;
  methodType:    string;
  transactionRef:string;
  accountNumber: string;
  cashReceived:  number;
  changeDue:     number;
  status:        string;
  refundAmount:  number;
  refundReason:  string;
  refundedAt:    string | null;
  customerName:  string;
  note:          string;
  createdAt:     string;
  methodId?:     { name: string; color: string; icon: string };
}

/* ─────────────────────── CONSTANTS ─────────────────────── */
const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  cash:           { label: "Cash",           icon: Banknote,    color: "#22c55e" },
  card_credit:    { label: "Credit Card",    icon: CreditCard,  color: "#3b82f6" },
  card_debit:     { label: "Debit Card",     icon: CreditCard,  color: "#6366f1" },
  bank_transfer:  { label: "Bank Transfer",  icon: Building2,   color: "#f59e0b" },
  mobile_wallet:  { label: "Mobile Wallet",  icon: Smartphone,  color: "#ec4899" },
  other:          { label: "Other",          icon: Wallet,      color: "#94a3b8" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  completed:      { label: "Completed",     color: "#059669", bg: "#d1fae5", border: "#a7f3d0" },
  pending:        { label: "Pending",       color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
  failed:         { label: "Failed",        color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
  refunded:       { label: "Refunded",      color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  partial_refund: { label: "Partial Refund",color: "#9333ea", bg: "#f3e8ff", border: "#d8b4fe" },
  cancelled:      { label: "Cancelled",     color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
};

/* ─────────────────────── TOAST ─────────────────────── */
const Toast: React.FC<{ toast: { msg: string; type: "success" | "error" } | null }> = ({ toast }) => (
  <AnimatePresence>
    {toast && (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold text-white ${
          toast.type === "success" ? "bg-zinc-900" : "bg-red-500"
        }`}
      >
        {toast.type === "success" ? <Check size={15} className="text-emerald-400" /> : <X size={15} />}
        {toast.msg}
      </motion.div>
    )}
  </AnimatePresence>
);

/* ─────────────────────── STATUS BADGE ─────────────────────── */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {m.label}
    </span>
  );
};

/* ════════════════════════════════════════════════
   METHOD FORM MODAL
════════════════════════════════════════════════ */
const MethodModal: React.FC<{
  method:   PaymentMethod | null;
  onClose:  () => void;
  onSaved:  (msg: string) => void;
  onError:  (msg: string) => void;
}> = ({ method, onClose, onSaved, onError }) => {
  const [form, setForm] = useState({
    name:          method?.name          || "",
    type:          method?.type          || "cash",
    provider:      method?.provider      || "",
    accountNumber: method?.accountNumber || "",
    accountTitle:  method?.accountTitle  || "",
    icon:          method?.icon          || "💰",
    color:         method?.color         || "#6b7280",
    processingFee: method?.processingFee || 0,
    isDefault:     method?.isDefault     || false,
    isActive:      method?.isActive      ?? true,
    notes:         method?.notes         || "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) { onError("Name is required"); return; }
    setBusy(true);
    try {
      const url    = method ? `/api/payment-methods/${method._id}` : "/api/payment-methods";
      const mthd   = method ? "PUT" : "POST";
      const res    = await fetch(url, { method: mthd, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.message);
      onSaved(method ? "Method updated" : "Method created");
    } catch (e: any) { onError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-black/5 flex-shrink-0">
          <h2 className="text-lg font-bold text-zinc-900">{method ? "Edit Method" : "Add Payment Method"}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-4">
          {/* Name + Icon */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. JazzCash"
                className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Icon</label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="📱"
                className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_META).map(([key, val]) => {
                const Icon = val.icon;
                return (
                  <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key as any }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      form.type === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}>
                    <Icon size={12} />{val.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Provider + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Provider</label>
              <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                placeholder="e.g. Jazz, HBL"
                className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Processing Fee %</label>
              <input type="number" min="0" max="100" step="0.1" value={form.processingFee}
                onChange={e => setForm(f => ({ ...f, processingFee: +e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Account #</label>
              <input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder="Last 4 / IBAN"
                className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Account Title</label>
              <input value={form.accountTitle} onChange={e => setForm(f => ({ ...f, accountTitle: e.target.value }))}
                placeholder="Name on account"
                className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-10 h-10 rounded-xl border-none cursor-pointer bg-zinc-50 p-1" />
              <div className="flex gap-2 flex-wrap">
                {["#22c55e","#3b82f6","#6366f1","#f59e0b","#ef4444","#ec4899","#8b5cf6","#0ea5e9","#94a3b8"].map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-lg border-2 transition-all"
                    style={{ background: c, borderColor: form.color === c ? "#000" : "transparent" }} />
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Optional notes..."
              className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/8" />
          </div>

          {/* Toggles */}
          <div className="flex gap-6">
            {[
              { label: "Set as Default", key: "isDefault" as const, onColor: "#f59e0b" },
              { label: "Active",         key: "isActive"  as const, onColor: "#22c55e" },
            ].map(({ label, key, onColor }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                  className="w-10 h-6 rounded-full transition-all relative"
                  style={{ background: form[key] ? onColor : "#e5e7eb" }}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form[key] ? "translate-x-4" : ""}`} />
                </div>
                <span className="text-xs font-semibold text-zinc-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-7 pb-7 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="flex-[2] py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? "Saving..." : method ? "Update" : "Create"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   PAYMENT DETAIL MODAL
════════════════════════════════════════════════ */
const PaymentDetailModal: React.FC<{
  payment: Payment;
  onClose: () => void;
  onRefund: (p: Payment) => void;
  formatCurrency: (n: number) => string;
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
}> = ({ payment: p, onClose, onRefund, formatCurrency, formatDate, formatTime }) => {
  const TypeIcon = TYPE_META[p.methodType]?.icon || Wallet;
  const typeMeta = TYPE_META[p.methodType] || TYPE_META.other;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96, y: 14  }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-7 pt-6 pb-5 border-b border-black/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: (p.methodId?.color || typeMeta.color) + "18" }}>
              {p.methodId?.icon || <TypeIcon size={20} style={{ color: p.methodId?.color || typeMeta.color }} />}
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-base">{p.methodName}</p>
              <StatusBadge status={p.status} />
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
          {/* Amount block */}
          <div className="bg-zinc-50 rounded-2xl p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Amount Charged</p>
            <p className="text-4xl font-black text-zinc-900">{formatCurrency(p.amount)}</p>
            {p.processingFee > 0 && (
              <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-zinc-200">
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Fee</p>
                  <p className="text-sm font-bold text-orange-500">{formatCurrency(p.processingFee)}</p>
                </div>
                <div className="w-px h-8 bg-zinc-200" />
                <div className="text-center">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Net</p>
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.netAmount)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="space-y-3">
            {[
              { icon: User,          label: "Customer",     value: p.customerName                               },
              { icon: Calendar,      label: "Date & Time",  value: `${formatDate(p.createdAt)} · ${formatTime(p.createdAt)}` },
              { icon: Hash,          label: "Transaction Ref", value: p.transactionRef || "—"                  },
              { icon: TypeIcon,      label: "Method Type",  value: typeMeta.label                               },
              ...(p.accountNumber ? [{ icon: CreditCard, label: "Account", value: p.accountNumber }] : []),
              ...(p.cashReceived > 0 ? [
                { icon: Banknote, label: "Cash Received", value: formatCurrency(p.cashReceived) },
                { icon: ArrowDownLeft, label: "Change Given", value: formatCurrency(p.changeDue) },
              ] : []),
              ...(p.note ? [{ icon: MessageCircle, label: "Note", value: p.note }] : []),
            ].map(({ icon: Icon, label, value }, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-zinc-100">
                  <Icon size={13} className="text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
                  <p className="text-sm font-semibold text-zinc-800 mt-0.5 break-all">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Refund info if refunded */}
          {(p.status === "refunded" || p.status === "partial_refund") && p.refundAmount > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-violet-400">Refund Details</p>
              <p className="text-sm font-bold text-violet-700">Refunded: {formatCurrency(p.refundAmount)}</p>
              {p.refundReason && <p className="text-xs text-violet-600">{p.refundReason}</p>}
              {p.refundedAt && <p className="text-xs text-violet-400">{formatDate(p.refundedAt)} {formatTime(p.refundedAt)}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-7 pt-4 border-t border-black/5 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">
            Close
          </button>
          {p.status === "completed" && (
            <button onClick={() => { onClose(); onRefund(p); }}
              className="flex-[2] py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-all text-sm flex items-center justify-center gap-2">
              <RotateCcw size={14} /> Refund Payment
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   MAIN PAYMENTS PAGE
════════════════════════════════════════════════ */
export const Payments: React.FC = () => {
  const { formatCurrency, formatDate, formatTime } = useAppSettings();
  const [activeSection, setActiveSection] = useState<"methods" | "transactions">("methods");
  const [methods,  setMethods]  = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [search,   setSearch]   = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [typeFilter,   setType]   = useState("all");
  const [showMethodModal,  setShowMethodModal]  = useState(false);
  const [editingMethod,    setEditingMethod]    = useState<PaymentMethod | null>(null);
  const [detailPayment,    setDetailPayment]    = useState<Payment | null>(null);
  const [stats, setStats] = useState({ total: 0, revenue: 0, totalFees: 0, byMethod: [] as any[], byStatus: [] as any[] });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchMethods = useCallback(async () => {
    try {
      const res  = await fetch("/api/payment-methods");
      const data = await res.json();
      setMethods(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load methods", "error"); }
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (typeFilter   !== "all") p.set("methodType", typeFilter);
      if (search)                  p.set("search", search);
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/payments?${p}`),
        fetch("/api/payments/stats"),
      ]);
      const pData = await pRes.json();
      const sData = await sRes.json();
      setPayments(Array.isArray(pData) ? pData : []);
      if (sData) setStats(sData);
    } catch { showToast("Failed to load payments", "error"); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);
  useEffect(() => { if (activeSection === "transactions") fetchPayments(); }, [activeSection, fetchPayments]);
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, activeSection]);

  const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPayments = payments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const seedDefaults = async () => {
    try {
      await fetch("/api/payment-methods/seed-defaults", { method: "POST" });
      fetchMethods();
      showToast("Default methods loaded");
    } catch { showToast("Seed failed", "error"); }
  };

  const deleteMethod = async (id: string) => {
    if (!confirm("Delete this payment method?")) return;
    try {
      await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      showToast("Method deleted");
      fetchMethods();
    } catch { showToast("Delete failed", "error"); }
  };

  const setDefault = async (id: string) => {
    try {
      await fetch(`/api/payment-methods/${id}/set-default`, { method: "PATCH" });
      showToast("Default updated");
      fetchMethods();
    } catch { showToast("Failed", "error"); }
  };

  const toggleActive = async (method: PaymentMethod) => {
    try {
      await fetch(`/api/payment-methods/${method._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...method, isActive: !method.isActive }),
      });
      fetchMethods();
    } catch { showToast("Failed", "error"); }
  };

  const handleRefund = async (payment: Payment) => {
    const reason = window.prompt("Refund reason (optional):") ?? "";
    if (reason === null) return; // cancelled
    try {
      const res  = await fetch(`/api/payments/${payment._id}/refund`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundReason: reason }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      showToast("Payment refunded and stock restored");
      fetchPayments();
    } catch (e: any) { showToast(e.message || "Refund failed", "error"); }
  };

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden" style={{ background: "var(--theme-bg)" }}>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-5 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Payments</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Configure methods and view transactions</p>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => activeSection === "methods" ? fetchMethods() : fetchPayments()}
            className="p-2.5 bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 transition-all shadow-sm">
            <RefreshCw size={15} />
          </button>
          {activeSection === "methods" && (
            <>
              {methods.length === 0 && (
                <button onClick={seedDefaults}
                  className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm border border-zinc-200">
                  <Zap size={14} /> Load Defaults
                </button>
              )}
              <button onClick={() => { setEditingMethod(null); setShowMethodModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-lg shadow-black/10 text-sm">
                <Plus size={16} /> Add Method
              </button>
            </>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 mb-5 flex-shrink-0">
        {[
          { key: "methods",      label: "Payment Methods" },
          { key: "transactions", label: "Transactions"    },
        ].map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key as any)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeSection === s.key ? "bg-zinc-900 text-white shadow-lg shadow-black/10" : "bg-white text-zinc-500 border border-zinc-100 hover:border-zinc-300"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ══ METHODS section ══ */}
      {activeSection === "methods" && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {methods.length === 0 ? (
            <div className="bg-white rounded-3xl border border-black/5 p-16 flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center"><CreditCard size={28} className="text-zinc-400" /></div>
              <p className="font-bold text-zinc-700">No payment methods configured</p>
              <p className="text-zinc-400 text-sm text-center">Load the defaults to get Cash, Card, JazzCash, Easypaisa and more pre-configured.</p>
              <button onClick={seedDefaults} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold text-sm hover:bg-zinc-800 transition-all">
                <Zap size={14} /> Load Default Methods
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {methods.map((m, i) => {
                const TypeIcon = TYPE_META[m.type]?.icon || Wallet;
                return (
                  <motion.div key={m._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-white rounded-2xl border border-black/5 p-5 shadow-sm group relative">

                    {/* Default star */}
                    {m.isDefault && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                        <Star size={10} className="text-white fill-white" />
                      </div>
                    )}

                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: m.color + "18" }}>
                        {m.icon || <TypeIcon size={20} style={{ color: m.color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-zinc-900 truncate">{m.name}</p>
                        <p className="text-[10px] text-zinc-400">{TYPE_META[m.type]?.label || m.type}</p>
                        {m.provider && <p className="text-[10px] text-zinc-500 font-medium">{m.provider}</p>}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      {m.accountNumber && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">Account</span>
                          <span className="font-mono font-semibold text-zinc-700">{m.accountNumber}</span>
                        </div>
                      )}
                      {m.processingFee > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">Fee</span>
                          <span className="font-semibold text-orange-500">{m.processingFee}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <button onClick={() => toggleActive(m)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          m.isActive ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                        }`}>
                        {m.isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        {m.isActive ? "Active" : "Inactive"}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!m.isDefault && (
                          <button onClick={() => setDefault(m._id)} className="p-1.5 text-zinc-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="Set default">
                            <StarOff size={13} />
                          </button>
                        )}
                        <button onClick={() => { setEditingMethod(m); setShowMethodModal(true); }} className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteMethod(m._id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TRANSACTIONS section ══ */}
      {activeSection === "transactions" && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 gap-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
            {[
              { label: "Total Txns",    value: stats.total,                    icon: TrendingUp, color: "text-zinc-600",   bg: "bg-zinc-100"   },
              { label: "Revenue",       value: formatCurrency(stats.revenue || 0), icon: DollarSign,  color: "text-emerald-600",bg: "bg-emerald-50" },
              { label: "Completed",     value: (stats.byStatus.find((s:any)=>s._id==="completed")?.count || 0), icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-50" },
              { label: "Processing Fees",value: formatCurrency(stats.totalFees || 0), icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50" },
            ].map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm">
                <div className={`w-9 h-9 ${c.bg} ${c.color} rounded-xl flex items-center justify-center mb-3`}>
                  <c.icon size={16} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{c.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Table card */}
          <div className="bg-white rounded-3xl border border-black/5 shadow-sm flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Toolbar */}
            <div className="p-5 border-b border-black/5 flex gap-3 items-center flex-shrink-0 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search customer, ref..."
                  className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8 placeholder:text-zinc-400" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"><X size={13} /></button>}
              </div>
              {/* Status pills */}
              <div className="flex gap-2 flex-wrap">
                {[{ key: "all", label: "All" }, ...Object.entries(STATUS_META).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => (
                  <button key={key} onClick={() => setStatus(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === key ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {/* Method type filter */}
              <select value={typeFilter} onChange={e => setType(e.target.value)}
                className="px-3 py-2.5 bg-zinc-50 border border-transparent rounded-xl text-xs font-semibold text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black/8">
                <option value="all">All Types</option>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Payments table */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-48 gap-3 text-zinc-400">
                  <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading...</span>
                </div>
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
                    <CreditCard size={22} className="text-zinc-400" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-500">No payments found</p>
                </div>
              ) : (
                <table className="w-full min-w-[900px] text-left border-collapse">
                  <thead className="sticky top-0 bg-white border-b border-black/5 z-10">
                    <tr>
                      {["Customer","Method","Amount","Fee","Net","Ref","Status","Date","Actions"].map(h => (
                        <th key={h} className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPayments.map((p, i) => (
                      <motion.tr key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="border-b border-black/[0.04] hover:bg-zinc-50/60 transition-colors group">
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-zinc-900">{p.customerName}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{p.methodId?.icon || "💰"}</span>
                            <span className="text-xs font-semibold text-zinc-700">{p.methodName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><span className="font-bold text-sm text-zinc-900">{formatCurrency(p.amount)}</span></td>
                        <td className="px-4 py-3.5"><span className="text-xs text-orange-500 font-semibold">{p.processingFee > 0 ? formatCurrency(p.processingFee) : "—"}</span></td>
                        <td className="px-4 py-3.5"><span className="font-bold text-sm text-emerald-600">{formatCurrency(p.netAmount)}</span></td>
                        <td className="px-4 py-3.5"><span className="text-xs font-mono text-zinc-400">{p.transactionRef || "—"}</span></td>
                        <td className="px-4 py-3.5"><StatusBadge status={p.status} /></td>
                        <td className="px-4 py-3.5">
                          <p className="text-xs text-zinc-500">{formatDate(p.createdAt)}</p>
                          <p className="text-[10px] text-zinc-400">{formatTime(p.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setDetailPayment(p)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all"
                              title="View details">
                              <Eye size={13} />
                            </button>
                            {p.status === "completed" && (
                              <button onClick={() => handleRefund(p)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-50 text-violet-600 rounded-lg text-[10px] font-bold hover:bg-violet-100 transition-all whitespace-nowrap">
                                <RotateCcw size={11} /> Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!loading && payments.length > 0 && (
              <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Showing <span className="font-semibold text-zinc-600">{paginatedPayments.length}</span> of{" "}
                  <span className="font-semibold text-zinc-600">{payments.length}</span> transactions
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40">Prev</button>
                  <span className="text-[11px] font-semibold text-zinc-500">{currentPage}/{totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showMethodModal && (
          <MethodModal
            method={editingMethod}
            onClose={() => { setShowMethodModal(false); setEditingMethod(null); }}
            onSaved={(msg) => { setShowMethodModal(false); setEditingMethod(null); showToast(msg); fetchMethods(); }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailPayment && (
          <PaymentDetailModal
            payment={detailPayment}
            onClose={() => setDetailPayment(null)}
            onRefund={(p) => handleRefund(p)}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        )}
      </AnimatePresence>
    </div>
  );
};