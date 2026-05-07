import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, User, Phone, Mail, X, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAppSettings } from "../hooks/useAppSettings";

/* ── Type ─────────────────────────────────────── */
interface Customer {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt?: string;
}

/* ── Toast ────────────────────────────────────── */
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
        {toast.type === "success"
          ? <Check size={16} className="text-emerald-400" />
          : <X size={16} />}
        {toast.msg}
      </motion.div>
    )}
  </AnimatePresence>
);

/* ════════════════════════════════════════════════
   CUSTOMERS PAGE
════════════════════════════════════════════════ */
export const Customers: React.FC = () => {
  const { formatDate } = useAppSettings();
  const [customers, setCustomers]           = useState<Customer[]>([]);
  const [search, setSearch]                 = useState("");
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading]               = useState(true);
  const [toast, setToast]                   = useState<ToastState | null>(null);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [page, setPage]                     = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => { fetchCustomers(); }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── API ──────────────────────────────────── */
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast("Failed to load customers", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Delete failed");
      }
      showToast("Customer deleted successfully");
      setCustomers(prev => prev.filter(c => c._id !== id));
    } catch (err: any) {
      showToast(err.message || "Failed to delete", "error");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Filter ───────────────────────────────── */
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, customers.length]);

  /* ── Render ───────────────────────────────── */
  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden" style={{ background: "var(--theme-bg)" }}>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Customer Management</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {loading ? "Loading..." : `${customers.length} customer${customers.length !== 1 ? "s" : ""} total`}
          </p>
        </div>
        <button
          onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 active:scale-95 transition-all shadow-lg shadow-black/10 text-sm"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-black/5 flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Search bar */}
        <div className="p-5 border-b border-black/5 flex-shrink-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-black/8 text-sm transition-all placeholder:text-zinc-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading customers...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
                <User size={24} className="text-zinc-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-zinc-700 text-sm">
                  {search ? "No results found" : "No customers yet"}
                </p>
                <p className="text-zinc-400 text-xs mt-1">
                  {search ? `No customers match "${search}"` : "Add your first customer to get started"}
                </p>
              </div>
              {!search && (
                <button
                  onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
                  className="mt-1 px-4 py-2 bg-black text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all"
                >
                  + Add First Customer
                </button>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-black/5">
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Customer</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Phone</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Email</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Joined</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginated.map((customer, i) => (
                    <motion.tr
                      key={customer._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-black/[0.04] hover:bg-zinc-50/60 transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0 group-hover:bg-zinc-200 transition-colors">
                            <span className="text-xs font-bold text-zinc-500">
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-semibold text-sm text-zinc-900">{customer.name}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Phone size={12} className="flex-shrink-0" />
                          <span className="text-sm">{customer.phone}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4">
                        {customer.email ? (
                          <div className="flex items-center gap-2 text-zinc-500">
                            <Mail size={12} className="flex-shrink-0" />
                            <span className="text-sm truncate max-w-[160px]">{customer.email}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300 text-sm">—</span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="px-6 py-4">
                        <span className="text-xs text-zinc-400">
                          {customer.createdAt ? formatDate(customer.createdAt) : "N/A"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setEditingCustomer(customer); setIsModalOpen(true); }}
                            className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all"
                            title="Edit customer"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(customer._id)}
                            disabled={deletingId === customer._id}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                            title="Delete customer"
                          >
                            {deletingId === customer._id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
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

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-black/5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Showing <span className="font-semibold text-zinc-600">{paginated.length}</span> of{" "}
                <span className="font-semibold text-zinc-600">{filtered.length}</span> customers
                {search && ` for "${search}"`}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40">Prev</button>
                <span className="text-[11px] font-semibold text-zinc-500">{currentPage}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <CustomerModal
            customer={editingCustomer}
            onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }}
            onSave={(msg) => {
              setIsModalOpen(false);
              setEditingCustomer(null);
              showToast(msg);
              fetchCustomers();
            }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ════════════════════════════════════════════════
   CUSTOMER MODAL
════════════════════════════════════════════════ */
interface CustomerModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSave:  (msg: string) => void;
  onError: (msg: string) => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ customer, onClose, onSave, onError }) => {
  const [formData, setFormData] = useState({
    name:  customer?.name  || "",
    phone: customer?.phone || "",
    email: customer?.email || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim())  e.name  = "Name is required";
    if (!formData.phone.trim()) e.phone = "Phone is required";
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      e.email = "Invalid email format";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const url    = customer ? `/api/customers/${customer._id}` : "/api/customers";
    const method = customer ? "PUT" : "POST";
    try {
      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Operation failed");
      onSave(customer ? "Customer updated successfully" : "Customer added successfully");
    } catch (err: any) {
      onError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: "name" | "phone" | "email") => ({
    value: formData[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(f => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors(er => ({ ...er, [key]: "" }));
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96, y: 12  }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-black/5">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">
              {customer ? "Edit Customer" : "Add New Customer"}
            </h2>
            <p className="text-zinc-400 text-sm mt-0.5">
              {customer ? "Update customer information" : "Enter the customer's details below"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              {...field("name")}
              placeholder="e.g. John Doe"
              className={`w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none transition-all border ${
                errors.name ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-transparent focus:ring-2 focus:ring-black/8"
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1.5">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              {...field("phone")}
              placeholder="e.g. +1 234 567 890"
              className={`w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none transition-all border ${
                errors.phone ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-transparent focus:ring-2 focus:ring-black/8"
              }`}
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1.5">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Email <span className="text-zinc-300 font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="email"
              {...field("email")}
              placeholder="e.g. john@example.com"
              className={`w-full px-4 py-3 bg-zinc-50 rounded-xl text-sm outline-none transition-all border ${
                errors.email ? "border-red-300 focus:ring-2 focus:ring-red-100" : "border-transparent focus:ring-2 focus:ring-black/8"
              }`}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email}</p>}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 active:scale-[0.98] transition-all shadow-lg shadow-black/10 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Saving..." : customer ? "Update Customer" : "Add Customer"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};