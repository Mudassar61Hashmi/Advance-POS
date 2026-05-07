import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Tag, Percent, DollarSign, Calendar, Users,
  Edit2, Trash2, Check, X, Loader2, Copy, ToggleLeft, ToggleRight,
  ShoppingCart, Hash
} from "lucide-react";
import { useAppSettings } from "../hooks/useAppSettings";

interface Coupon {
  _id: string;
  code: string;
  name: string;
  type: "percentage" | "fixed";
  value: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

const getToken = () => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } };

const Toast: React.FC<{ msg: string | null; type?: "success" | "error" }> = ({ msg, type = "success" }) => (
  <AnimatePresence>
    {msg && (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold text-white ${type === "success" ? "bg-zinc-900" : "bg-red-500"}`}
      >
        {type === "success" ? <Check size={15} className="text-emerald-400" /> : <X size={15} />}
        {msg}
      </motion.div>
    )}
  </AnimatePresence>
);

export const Coupons: React.FC = () => {
  const { formatCurrency } = useAppSettings();
  const [coupons, setCoupons]     = useState<Coupon[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Coupon | null>(null);
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filter, setFilter]       = useState<"all" | "active" | "inactive" | "expired">("all");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/coupons", { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setCoupons(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load coupons", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    try {
      await fetch(`/api/coupons/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
      showToast("Coupon deleted");
      load();
    } catch { showToast("Delete failed", "error"); }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      await fetch(`/api/coupons/${coupon._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ active: !coupon.active }),
      });
      load();
    } catch { showToast("Update failed", "error"); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => showToast(`Copied: ${code}`));
  };

  const isExpired = (c: Coupon) => !!(c.expiresAt && new Date(c.expiresAt) < new Date());
  const isLimitReached = (c: Coupon) => c.maxUses > 0 && c.usedCount >= c.maxUses;

  const filtered = coupons.filter(c => {
    if (filter === "active")   return c.active && !isExpired(c) && !isLimitReached(c);
    if (filter === "inactive") return !c.active;
    if (filter === "expired")  return isExpired(c) || isLimitReached(c);
    return true;
  });

  const stats = {
    total:  coupons.length,
    active: coupons.filter(c => c.active && !isExpired(c) && !isLimitReached(c)).length,
    used:   coupons.reduce((s, c) => s + c.usedCount, 0),
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--theme-bg)" }}>
        <Loader2 size={28} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-auto" style={{ background: "var(--theme-bg)" }}>
      <Toast msg={toast?.msg || null} type={toast?.type} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--theme-text)" }}>Discounts & Coupons</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{stats.active} active · {stats.used} total redemptions</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all shadow-lg text-sm">
          <Plus size={16} /> New Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Coupons", value: stats.total,  icon: Tag,          color: "text-zinc-600",    bg: "bg-zinc-50" },
          { label: "Active",        value: stats.active, icon: Check,         color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Uses",    value: stats.used,   icon: ShoppingCart,  color: "text-indigo-600",  bg: "bg-indigo-50" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={20} className={s.color} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-black/5 shadow-sm mb-5 self-start">
        {(["all","active","inactive","expired"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${filter === f ? "bg-zinc-900 text-white shadow" : "text-zinc-500 hover:text-zinc-800"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Coupon grid */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          <Tag size={40} className="text-zinc-200 mb-3" />
          <p className="text-zinc-400 font-medium">No coupons found</p>
          <p className="text-zinc-300 text-sm mt-1">Create your first discount coupon</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((c, i) => {
              const expired     = isExpired(c);
              const limitHit    = isLimitReached(c);
              const statusBad   = expired || limitHit || !c.active;
              return (
                <motion.div key={c._id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden ${statusBad ? "opacity-70" : ""}`}
                >
                  {/* Color bar */}
                  <div className={`h-1.5 ${c.type === "percentage" ? "bg-gradient-to-r from-violet-400 to-indigo-500" : "bg-gradient-to-r from-emerald-400 to-teal-500"}`} />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <button onClick={() => copyCode(c.code)}
                            className="font-mono text-lg font-black text-zinc-900 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                            {c.code}
                            <Copy size={12} className="text-zinc-300" />
                          </button>
                        </div>
                        <p className="text-zinc-500 text-xs">{c.name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black ${c.type === "percentage" ? "text-violet-600" : "text-emerald-600"}`}>
                          {c.type === "percentage" ? `${c.value}%` : formatCurrency(c.value)}
                        </p>
                        <p className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider">
                          {c.type === "percentage" ? "off order" : "flat off"}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 mb-4">
                      {c.minOrder > 0 && (
                        <div className="flex items-center gap-1.5">
                          <ShoppingCart size={11} className="text-zinc-300" />
                          Min: {formatCurrency(c.minOrder)}
                        </div>
                      )}
                      {c.maxUses > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Users size={11} className="text-zinc-300" />
                          {c.usedCount}/{c.maxUses} uses
                        </div>
                      )}
                      {c.expiresAt && (
                        <div className={`flex items-center gap-1.5 ${expired ? "text-red-400" : ""}`}>
                          <Calendar size={11} className={expired ? "text-red-400" : "text-zinc-300"} />
                          {expired ? "Expired" : `Exp: ${new Date(c.expiresAt).toLocaleDateString()}`}
                        </div>
                      )}
                      {!c.expiresAt && c.maxUses === 0 && (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Hash size={11} className="text-zinc-300" />
                          No expiry · Unlimited uses
                        </div>
                      )}
                    </div>

                    {/* Status tags */}
                    <div className="flex items-center gap-2 mb-4">
                      {expired     && <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Expired</span>}
                      {limitHit    && <span className="px-2 py-0.5 bg-orange-50 text-orange-500 text-[10px] font-bold rounded-full uppercase tracking-wider">Limit Reached</span>}
                      {!expired && !limitHit && c.active && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Active</span>}
                      {!c.active   && <span className="px-2 py-0.5 bg-zinc-100 text-zinc-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Disabled</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-black/5">
                      <button onClick={() => toggleActive(c)} title={c.active ? "Disable" : "Enable"}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all">
                        {c.active ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => { setEditing(c); setModalOpen(true); }}
                        className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(c._id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={14} />
                      </button>
                      <div className="ml-auto text-[11px] text-zinc-400">{c.usedCount} use{c.usedCount !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <CouponModal
            coupon={editing}
            onClose={() => setModalOpen(false)}
            onSave={() => { setModalOpen(false); load(); showToast(editing ? "Coupon updated" : "Coupon created"); }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Coupon Modal ── */
interface CouponModalProps {
  coupon:  Coupon | null;
  onClose: () => void;
  onSave:  () => void;
  onError: (msg: string) => void;
}

const CouponModal: React.FC<CouponModalProps> = ({ coupon, onClose, onSave, onError }) => {
  const [form, setForm] = useState({
    code:      coupon?.code      ?? "",
    name:      coupon?.name      ?? "",
    type:      coupon?.type      ?? "percentage" as "percentage" | "fixed",
    value:     coupon?.value     ?? 10,
    minOrder:  coupon?.minOrder  ?? 0,
    maxUses:   coupon?.maxUses   ?? 0,
    expiresAt: coupon?.expiresAt ? new Date(coupon.expiresAt).toISOString().split("T")[0] : "",
    active:    coupon?.active    ?? true,
  });
  const [saving, setSaving] = useState(false);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    setForm(f => ({ ...f, code: Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { onError("Coupon code is required"); return; }
    if (!form.name.trim()) { onError("Coupon name is required"); return; }
    if (form.value <= 0)   { onError("Discount value must be > 0"); return; }
    if (form.type === "percentage" && form.value > 100) { onError("Percentage cannot exceed 100"); return; }

    setSaving(true);
    const body = { ...form, code: form.code.toUpperCase(), expiresAt: form.expiresAt || null };
    try {
      const url    = coupon ? `/api/coupons/${coupon._id}` : "/api/coupons";
      const method = coupon ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save");
      onSave();
    } catch (err: any) { onError(err.message); }
    finally { setSaving(false); }
  };

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">{label}</label>
      {children}
    </div>
  );

  const inp = "w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-black/5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{coupon ? "Edit Coupon" : "New Coupon"}</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Configure discount details</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-5 space-y-4">
          {/* Code */}
          <F label="Coupon Code *">
            <div className="flex gap-2">
              <input type="text" required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SAVE20" maxLength={20}
                className={`${inp} flex-1 font-mono tracking-widest`} />
              <button type="button" onClick={generateCode}
                className="px-3 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all whitespace-nowrap">
                Generate
              </button>
            </div>
          </F>

          {/* Name */}
          <F label="Description *">
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Summer sale 20% off" className={inp} />
          </F>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Type">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} className={inp}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </F>
            <F label={form.type === "percentage" ? "Discount %" : "Amount Off"}>
              <input type="number" min="0" step={form.type === "percentage" ? "1" : "0.01"} required
                value={form.value} onChange={e => setForm(f => ({ ...f, value: +e.target.value }))} className={inp} />
            </F>
          </div>

          {/* Min order + Max uses */}
          <div className="grid grid-cols-2 gap-3">
            <F label="Min Order Amount">
              <input type="number" min="0" step="0.01" value={form.minOrder}
                onChange={e => setForm(f => ({ ...f, minOrder: +e.target.value }))} className={inp} />
            </F>
            <F label="Max Uses (0 = unlimited)">
              <input type="number" min="0" value={form.maxUses}
                onChange={e => setForm(f => ({ ...f, maxUses: +e.target.value }))} className={inp} />
            </F>
          </div>

          {/* Expiry */}
          <F label="Expiry Date (optional)">
            <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className={inp} />
          </F>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className="flex items-center gap-2 text-sm">
              {form.active
                ? <ToggleRight size={24} className="text-emerald-500" />
                : <ToggleLeft size={24} className="text-zinc-300" />}
              <span className={`font-semibold ${form.active ? "text-zinc-900" : "text-zinc-400"}`}>
                {form.active ? "Active" : "Inactive"}
              </span>
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-[2] py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : coupon ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
