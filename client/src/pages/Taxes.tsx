import React, { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, Check, X, Loader2,
  Star, StarOff, Percent, ToggleLeft, ToggleRight,
  Tag, Globe, Package, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────── TYPES ─────────────────────── */
interface Tax {
  _id:         string;
  name:        string;
  rate:        number;
  type:        "inclusive" | "exclusive";
  appliesTo:   "all" | "category" | "product";
  categories:  string[];
  isDefault:   boolean;
  isActive:    boolean;
  description: string;
  createdAt:   string;
}

/* ─────────────────────── TOAST ─────────────────────── */
interface ToastState { msg: string; type: "success" | "error" }
const Toast: React.FC<{ toast: ToastState | null }> = ({ toast }) => (
  <AnimatePresence>
    {toast && (
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{   opacity: 0, y: 16,  scale: 0.95 }}
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

const EMPTY_FORM = {
  name: "", rate: 0, type: "exclusive" as "inclusive" | "exclusive",
  appliesTo: "all" as "all" | "category" | "product",
  categories: [] as string[], isDefault: false, isActive: true, description: "",
};

/* ════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════ */
export const Taxes: React.FC = () => {
  const [taxes, setTaxes]         = useState<Tax[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Tax | null>(null);
  const [toast, setToast]         = useState<ToastState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => { fetchTaxes(); }, []);
  useEffect(() => { setPage(1); }, [taxes.length]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTaxes = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/taxes");
      const data = await res.json();
      setTaxes(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load taxes", "error"); }
    finally { setLoading(false); }
  };

  const setDefault = async (id: string) => {
    try {
      const res  = await fetch(`/api/taxes/${id}/set-default`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed");
      showToast("Default tax updated");
      fetchTaxes();
    } catch { showToast("Failed to set default", "error"); }
  };

  const deleteTax = async (id: string) => {
    if (!confirm("Delete this tax? It will be removed from all products.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/taxes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      showToast("Tax deleted");
      fetchTaxes();
    } catch { showToast("Failed to delete", "error"); }
    finally { setDeletingId(null); }
  };

  const toggleActive = async (tax: Tax) => {
    try {
      const res = await fetch(`/api/taxes/${tax._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tax, isActive: !tax.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(tax.isActive ? "Tax disabled" : "Tax enabled");
      fetchTaxes();
    } catch { showToast("Failed to toggle", "error"); }
  };

  const defaultTax = taxes.find(t => t.isDefault);

  const totalPages = Math.max(1, Math.ceil(taxes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedTaxes = taxes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden" style={{ background: "var(--theme-bg)" }}>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Tax Management</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Configure global and category-specific tax rates</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 active:scale-95 transition-all shadow-lg shadow-black/10 text-sm"
        >
          <Plus size={16} /> Add Tax Rate
        </button>
      </div>

      {/* Default tax banner */}
      {defaultTax && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex-shrink-0 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Star size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">
              Default Tax: {defaultTax.name} ({defaultTax.rate}%)
            </p>
            <p className="text-xs text-emerald-600">
              Applied to all products without a specific tax rate · {defaultTax.type}
            </p>
          </div>
        </motion.div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        {[
          { label: "Total Rates",   value: taxes.length,                                   icon: Percent, color: "text-zinc-600",   bg: "bg-zinc-100"   },
          { label: "Active",        value: taxes.filter(t => t.isActive).length,           icon: ToggleRight,color: "text-emerald-600",bg: "bg-emerald-50" },
          { label: "Global Rates",  value: taxes.filter(t => t.appliesTo === "all").length,icon: Globe,   color: "text-blue-500",   bg: "bg-blue-50"    },
          { label: "Category Rates",value: taxes.filter(t => t.appliesTo === "category").length, icon: Layers, color: "text-violet-500", bg: "bg-violet-50" },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
            <div className={`w-9 h-9 ${c.bg} ${c.color} rounded-xl flex items-center justify-center mb-3`}>
              <c.icon size={16} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-zinc-900">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-black/5 flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="p-5 border-b border-black/5 flex-shrink-0">
          <p className="text-sm font-bold text-zinc-700">All Tax Rates</p>
          <p className="text-xs text-zinc-400 mt-0.5">Manage your tax configurations below</p>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-3 text-zinc-400">
              <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading...</span>
            </div>
          ) : taxes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
                <Percent size={20} className="text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-500">No tax rates configured</p>
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                className="px-4 py-2 bg-black text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all">
                + Add First Tax Rate
              </button>
            </div>
          ) : (
            <table className="w-full min-w-[700px] border-collapse">
              <thead className="sticky top-0 bg-white border-b border-black/5">
                <tr>
                  {["Name","Rate","Type","Applies To","Status","Default","Actions"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginatedTaxes.map((tax, i) => (
                    <motion.tr key={tax._id}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-black/[0.04] hover:bg-zinc-50/60 transition-colors group">

                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Percent size={13} className="text-zinc-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-zinc-900">{tax.name}</p>
                            {tax.description && <p className="text-xs text-zinc-400 truncate max-w-[140px]">{tax.description}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="px-5 py-4">
                        <span className="font-black text-lg text-zinc-900">{tax.rate}%</span>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                          tax.type === "exclusive"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-violet-50 text-violet-600"
                        }`}>
                          {tax.type}
                        </span>
                      </td>

                      {/* Applies to */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {tax.appliesTo === "all"      && <Globe size={12} className="text-zinc-400" />}
                          {tax.appliesTo === "category" && <Layers size={12} className="text-zinc-400" />}
                          {tax.appliesTo === "product"  && <Package size={12} className="text-zinc-400" />}
                          <span className="text-xs text-zinc-600 font-medium capitalize">{tax.appliesTo}</span>
                          {tax.appliesTo === "category" && tax.categories.length > 0 && (
                            <span className="text-[10px] text-zinc-400">({tax.categories.join(", ")})</span>
                          )}
                        </div>
                      </td>

                      {/* Active toggle */}
                      <td className="px-5 py-4">
                        <button onClick={() => toggleActive(tax)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                            tax.isActive ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                          }`}>
                          {tax.isActive ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                          {tax.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Default */}
                      <td className="px-5 py-4">
                        {tax.isDefault ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                            <Star size={11} className="fill-amber-500 text-amber-500" /> Default
                          </span>
                        ) : (
                          <button onClick={() => setDefault(tax._id)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-zinc-400 hover:text-amber-600 transition-colors opacity-100">
                            <StarOff size={11} /> Set default
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 opacity-100">
                          <button onClick={() => { setEditing(tax); setShowModal(true); }}
                            className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deleteTax(tax._id)} disabled={deletingId === tax._id}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40">
                            {deletingId === tax._id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
        {!loading && taxes.length > 0 && (
          <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Showing <span className="font-semibold text-zinc-600">{paginatedTaxes.length}</span> of{" "}
              <span className="font-semibold text-zinc-600">{taxes.length}</span> tax rates
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

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <TaxModal
            tax={editing}
            onClose={() => { setShowModal(false); setEditing(null); }}
            onSaved={(msg) => { setShowModal(false); setEditing(null); showToast(msg); fetchTaxes(); }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ════════════════════════════════════════════════
   TAX MODAL
════════════════════════════════════════════════ */
const TaxModal: React.FC<{
  tax: Tax | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ tax, onClose, onSaved, onError }) => {
  const [form, setForm]           = useState(tax ? {
    name: tax.name, rate: tax.rate, type: tax.type,
    appliesTo: tax.appliesTo, categories: tax.categories.join(", "),
    isDefault: tax.isDefault, isActive: tax.isActive, description: tax.description,
  } : { ...EMPTY_FORM, categories: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())      e.name = "Name is required";
    if (form.rate < 0)          e.rate = "Rate must be 0 or more";
    if (form.rate > 100)        e.rate = "Rate cannot exceed 100%";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body = {
        ...form,
        rate: Number(form.rate),
        categories: (form.categories as string).split(",").map((s: string) => s.trim()).filter(Boolean),
      };
      const url    = tax ? `/api/taxes/${tax._id}` : "/api/taxes";
      const method = tax ? "PUT" : "POST";
      const res    = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onSaved(tax ? "Tax updated!" : "Tax created!");
    } catch (err: any) { onError(err.message || "Failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96, y: 12  }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-black/5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{tax ? "Edit Tax Rate" : "Add Tax Rate"}</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Configure tax rate details</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. GST, VAT, Sales Tax"
              className={`w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none transition-all border ${errors.name ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-transparent focus:ring-2 focus:ring-black/8"}`} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Rate + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Rate (%) <span className="text-red-400">*</span>
              </label>
              <input type="number" min="0" max="100" step="0.01"
                value={form.rate} onChange={e => setForm(f => ({ ...f, rate: +e.target.value }))}
                placeholder="e.g. 10"
                className={`w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none border ${errors.rate ? "border-red-300" : "border-transparent focus:ring-2 focus:ring-black/8"}`} />
              {errors.rate && <p className="text-red-500 text-xs mt-1">{errors.rate}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none border border-transparent focus:ring-2 focus:ring-black/8">
                <option value="exclusive">Exclusive (added on top)</option>
                <option value="inclusive">Inclusive (included in price)</option>
              </select>
            </div>
          </div>

          {/* Applies to */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Applies To</label>
            <div className="flex gap-2">
              {(["all","category","product"] as const).map(a => (
                <button key={a} onClick={() => setForm(f => ({ ...f, appliesTo: a }))}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    form.appliesTo === a ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}>
                  {a === "all" ? "All Products" : a === "category" ? "Category" : "Per Product"}
                </button>
              ))}
            </div>
          </div>

          {/* Categories field (only if appliesTo === "category") */}
          {form.appliesTo === "category" && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Categories <span className="text-zinc-300">(comma separated)</span>
              </label>
              <input value={form.categories as string}
                onChange={e => setForm(f => ({ ...f, categories: e.target.value }))}
                placeholder="e.g. Dairy, Bakery, Fruits"
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none border border-transparent focus:ring-2 focus:ring-black/8" />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Description <span className="text-zinc-300">(optional)</span></label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description..."
              className="w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none border border-transparent focus:ring-2 focus:ring-black/8" />
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, isDefault: !f.isDefault }))}
                className={`w-10 h-6 rounded-full transition-all relative ${form.isDefault ? "bg-amber-400" : "bg-zinc-200"}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isDefault ? "translate-x-4" : ""}`} />
              </div>
              <span className="text-xs font-semibold text-zinc-700">Set as Default</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                className={`w-10 h-6 rounded-full transition-all relative ${form.isActive ? "bg-emerald-400" : "bg-zinc-200"}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-4" : ""}`} />
              </div>
              <span className="text-xs font-semibold text-zinc-700">Active</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 px-8 pb-8">
          <button onClick={onClose} className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Saving..." : tax ? "Update Tax" : "Create Tax"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// const EMPTY_FORM = {
//   name: "", rate: 0, type: "exclusive" as "inclusive" | "exclusive",
//   appliesTo: "all" as "all" | "category" | "product",
//   categories: "" as string, isDefault: false, isActive: true, description: "",
// };