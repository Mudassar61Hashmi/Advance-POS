import React, { useState, useEffect, useRef } from "react";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  Search, X, Check, Loader2, Trash2, RefreshCw,
  ChevronDown, Printer, Package, ClipboardList, Plus,
  Ban, RotateCcw, CheckCircle2, Clock, Zap,
  DollarSign, ShoppingBag, AlertTriangle, User, Phone,
  Mail, CreditCard, Truck, Globe, MessageCircle, MapPin,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/* ─────────────────────── TYPES ─────────────────────── */
interface OrderItem {
  product:  string;
  name:     string;
  price:    number;
  quantity: number;
  subtotal: number;
}

interface Order {
  _id:              string;
  orderNumber:      string;
  customerName:     string;
  customerPhone?:   string;
  customerEmail?:   string;
  customer?:        { name: string; phone: string; email?: string };
  deliveryAddress?: string;
  source?:          "online" | "in-store";
  items:            OrderItem[];
  subtotal:         number;
  discount:         number;
  discountType:     "fixed" | "percent";
  discountAmount:   number;
  tax:              number;
  taxAmount:        number;
  total:            number;
  paymentMethod:    "cash" | "card" | "other";
  cashReceived?:    number;
  change?:          number;
  status:           "pending" | "processing" | "completed" | "cancelled" | "refunded";
  note?:            string;
  refundNote?:      string;
  refundedAt?:      string;
  cancelledAt?:     string;
  servedBy?:        { username: string; role?: string };
  createdAt:        string;
  updatedAt:        string;
}

/* ─────────────────────── CONSTANTS ─────────────────────── */
const STATUS_META: Record<string, {
  label: string; color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  pending:    { label: "Pending",    color: "#d97706", bg: "#fef3c7", border: "#fde68a", icon: Clock        },
  processing: { label: "Processing", color: "#2563eb", bg: "#dbeafe", border: "#bfdbfe", icon: RefreshCw    },
  completed:  { label: "Completed",  color: "#059669", bg: "#d1fae5", border: "#a7f3d0", icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb", icon: Ban          },
  refunded:   { label: "Refunded",   color: "#dc2626", bg: "#fee2e2", border: "#fecaca", icon: RotateCcw    },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:    ["processing", "completed", "cancelled"],
  processing: ["completed", "cancelled"],
  completed:  ["refunded"],
  cancelled:  [],
  refunded:   [],
};

const PAYMENT_LABELS: Record<string, string> = { cash: "Cash", card: "Card", other: "Other" };

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

/* ─────────────────────── STATUS BADGE ─────────────────────── */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.pending;
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <Icon size={9} />{m.label}
    </span>
  );
};

/* ─────────────────────── STATUS DROPDOWN ─────────────────────── */
const StatusDropdown: React.FC<{
  order: Order;
  onUpdate: (id: string, status: string, note?: string) => Promise<void>;
}> = ({ order, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const transitions = STATUS_TRANSITIONS[order.status] || [];
  if (transitions.length === 0) return null;

  const handle = async (s: string) => {
    setOpen(false); setBusy(true);
    const note = s === "refunded" ? window.prompt("Refund reason (optional):") || "" : undefined;
    await onUpdate(order._id, s, note);
    setBusy(false);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={busy}
        className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all disabled:opacity-40"
        title="Change status">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.95        }}
            className="absolute right-0 top-8 bg-white border border-zinc-100 rounded-2xl shadow-2xl z-50 min-w-[175px] overflow-hidden">
            <div className="p-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-2 py-1.5">Change Status</p>
              {transitions.map(s => {
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─────────────────────── CREATE ORDER MODAL ─────────────────────── */
interface CreateOrderModalProps {
  onClose: () => void;
  onCreated: (msg: string) => void;
  onError: (msg: string) => void;
}

const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ onClose, onCreated, onError }) => {
  const { formatCurrency } = useAppSettings();
  const [step, setStep]               = useState<1 | 2>(1);
  const [products, setProducts]       = useState<any[]>([]);
  const [loadingProds, setLoadingProds] = useState(true);
  const [submitting, setSubmitting]   = useState(false);

  const [form, setForm] = useState({
    customerName:    "",
    customerPhone:   "",
    customerEmail:   "",
    deliveryAddress: "",
    source:          "in-store" as "online" | "in-store",
    paymentMethod:   "cash" as "cash" | "card" | "other",
    cashReceived:    0,
    discount:        0,
    discountType:    "fixed" as "fixed" | "percent",
    tax:             0,
    note:            "",
  });
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [prodSearch, setProdSearch] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingProds(false));
  }, []);

  const filteredProds = products.filter(p =>
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    (p.barcode || "").includes(prodSearch)
  );

  const addToCart = (p: any) => {
    setCart(prev => {
      const ex = prev.find(i => i.product === p._id);
      if (ex) return prev.map(i => i.product === p._id
        ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
      return [...prev, { product: p._id, name: p.name, price: p.price, quantity: 1, subtotal: p.price }];
    });
  };

  const updateQty = (pid: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.product !== pid)); return; }
    setCart(prev => prev.map(i => i.product === pid ? { ...i, quantity: qty, subtotal: qty * i.price } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const discountAmount = form.discountType === "percent" ? (subtotal * form.discount) / 100 : form.discount;
  const taxAmount      = ((subtotal - discountAmount) * form.tax) / 100;
  const total          = Math.max(0, subtotal - discountAmount + taxAmount);

  const handleSubmit = async () => {
    if (!form.customerName.trim()) { onError("Customer name is required"); return; }
    if (cart.length === 0)         { onError("Add at least one product"); return; }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: cart }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onCreated("Order created successfully!");
    } catch (err: any) { onError(err.message || "Failed to create order"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96, y: 14  }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-black/5 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Create New Order</h2>
            <p className="text-zinc-400 text-sm mt-0.5">Step {step} of 2 — {step === 1 ? "Add Products" : "Customer & Payment"}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicators */}
            <div className="flex items-center gap-2">
              {[1, 2].map(n => (
                <div key={n} className={`w-2 h-2 rounded-full transition-all ${step >= n ? "bg-zinc-900" : "bg-zinc-200"}`} />
              ))}
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {step === 1 ? (
            /* ── STEP 1: Products ── */
            <div className="flex flex-1 overflow-hidden">
              {/* Product grid */}
              <div className="flex-1 flex flex-col border-r border-black/5 overflow-hidden">
                <div className="p-4 border-b border-black/5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                      placeholder="Search products..." type="text"
                      className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
                  {loadingProds ? (
                    <div className="col-span-2 flex items-center justify-center h-32 text-zinc-400 gap-2">
                      <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading...</span>
                    </div>
                  ) : filteredProds.map(p => (
                    <button key={p._id} onClick={() => addToCart(p)}
                      disabled={p.quantity === 0}
                      className="text-left p-3 rounded-2xl border border-zinc-100 hover:border-zinc-300 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                      style={{ cursor: p.quantity > 0 ? "pointer" : "not-allowed" }}>
                      <div className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{p.category}</div>
                      <div className="font-semibold text-sm text-zinc-900 leading-tight mb-1.5">{p.name}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{formatCurrency(p.price)}</span>
                        <span className={`text-[10px] font-semibold ${p.quantity <= 5 ? "text-red-400" : "text-zinc-400"}`}>
                          {p.quantity} left
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div className="w-64 flex flex-col">
                <div className="p-4 border-b border-black/5">
                  <p className="font-bold text-sm text-zinc-900">Cart {cart.length > 0 && `(${cart.length})`}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-zinc-300 gap-2">
                      <ShoppingBag size={24} /><span className="text-xs">No items yet</span>
                    </div>
                  ) : cart.map(item => (
                    <div key={item.product} className="bg-zinc-50 rounded-xl p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-zinc-800 truncate flex-1 mr-2">{item.name}</span>
                        <button onClick={() => updateQty(item.product, 0)} className="text-zinc-300 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => updateQty(item.product, item.quantity - 1)}
                            className="w-6 h-6 bg-white rounded-lg text-zinc-600 hover:bg-zinc-200 transition-all text-sm font-bold flex items-center justify-center border border-zinc-200">−</button>
                          <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product, item.quantity + 1)}
                            className="w-6 h-6 bg-white rounded-lg text-zinc-600 hover:bg-zinc-200 transition-all text-sm font-bold flex items-center justify-center border border-zinc-200">+</button>
                        </div>
                        <span className="text-xs font-bold text-zinc-900">{formatCurrency(item.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="p-3 border-t border-black/5">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-zinc-900">
                      <span>Est. Total</span><span>{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── STEP 2: Customer & Payment ── */
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Order Source */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Order Source</p>
                <div className="flex gap-3">
                  {([
                    { val:"in-store" as const, icon:ShoppingBag, label:"In-Store",  desc:"Walk-in or counter sale"    },
                    { val:"online"   as const, icon:Globe,        label:"Online",    desc:"Website, app, or WhatsApp"  },
                  ]).map(({ val, icon:Icon, label, desc }) => (
                    <button key={val} type="button" onClick={() => setForm(f => ({ ...f, source: val }))}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                        form.source === val ? "border-zinc-900 bg-zinc-50" : "border-zinc-100 bg-white hover:border-zinc-200"
                      }`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${form.source === val ? "bg-zinc-900" : "bg-zinc-100"}`}>
                        <Icon size={15} className={form.source === val ? "text-white" : "text-zinc-400"} />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${form.source === val ? "text-zinc-900" : "text-zinc-500"}`}>{label}</p>
                        <p className="text-[10px] text-zinc-400">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Customer Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                      placeholder="e.g. John Doe" type="text"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Phone</label>
                    <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                      placeholder="+1 234 567 890" type="tel"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                  </div>
                  <div className={form.source === "online" ? "" : "col-span-2"}>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Email (optional)</label>
                    <input value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                      placeholder="john@example.com" type="email"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                  </div>
                  {form.source === "online" && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-500 mb-1.5 flex items-center gap-1.5">
                        <MapPin size={11} className="text-zinc-400" /> Delivery Address
                      </label>
                      <input value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))}
                        placeholder="Street, City, Zip" type="text"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Pricing</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Discount</label>
                    <input value={form.discount || ""} onChange={e => setForm(f => ({ ...f, discount: +e.target.value || 0 }))}
                      type="number" min="0" placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Type</label>
                    <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "fixed" | "percent" }))}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8">
                      <option value="fixed">$ Fixed</option>
                      <option value="percent">% Percent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">Tax %</label>
                    <input value={form.tax || ""} onChange={e => setForm(f => ({ ...f, tax: +e.target.value || 0 }))}
                      type="number" min="0" max="100" placeholder="0"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Payment</p>
                <div className="flex gap-2 mb-3">
                  {(["cash", "card", "other"] as const).map(m => (
                    <button key={m} onClick={() => setForm(f => ({ ...f, paymentMethod: m }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                        form.paymentMethod === m ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                      }`}>
                      {PAYMENT_LABELS[m]}
                    </button>
                  ))}
                </div>
                {form.paymentMethod === "cash" && (
                  <input value={form.cashReceived || ""} onChange={e => setForm(f => ({ ...f, cashReceived: +e.target.value || 0 }))}
                    type="number" placeholder="Cash received..."
                    className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/8" />
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Note (optional)</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  rows={2} placeholder="Any special instructions..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/8" />
              </div>

              {/* Order summary */}
              <div className="bg-zinc-50 rounded-2xl p-5 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Order Summary</p>
                {cart.map(i => (
                  <div key={i.product} className="flex justify-between text-xs text-zinc-500">
                    <span>{i.name} ×{i.quantity}</span><span>{formatCurrency(i.subtotal)}</span>
                  </div>
                ))}
                <div className="border-t border-black/5 pt-2 space-y-1.5">
                  <div className="flex justify-between text-sm text-zinc-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Discount</span><span>−{formatCurrency(discountAmount)}</span></div>}
                  {taxAmount > 0 && <div className="flex justify-between text-sm text-zinc-500"><span>Tax</span><span>+{formatCurrency(taxAmount)}</span></div>}
                  <div className="flex justify-between font-bold text-base text-zinc-900 pt-1"><span>Total</span><span>{formatCurrency(total)}</span></div>
                  {form.paymentMethod === "cash" && form.cashReceived > 0 && (
                    <div className="flex justify-between text-sm text-zinc-500">
                      <span>Change</span><span>{formatCurrency(Math.max(0, form.cashReceived - total))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between flex-shrink-0">
          <button onClick={() => step === 1 ? onClose() : setStep(1)}
            className="px-5 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          {step === 1 ? (
            <button onClick={() => setStep(2)} disabled={cart.length === 0}
              className="px-6 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Continue → ({cart.length} item{cart.length !== 1 ? "s" : ""})
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-all text-sm disabled:opacity-50">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Creating..." : `Create Order — ${formatCurrency(total)}`}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

/* ─────────────────────── ORDER DETAIL MODAL ─────────────────────── */
const OrderDetailModal: React.FC<{
  order: Order;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string, note?: string) => Promise<void>;
  onPrint: (order: Order) => void;
  onDelete: (id: string) => void;
}> = ({ order, onClose, onUpdateStatus, onPrint, onDelete }) => {
  const { formatCurrency } = useAppSettings();
  const [busy, setBusy]   = useState<string | null>(null);
  const transitions       = STATUS_TRANSITIONS[order.status] || [];

  const handleStatus = async (s: string) => {
    setBusy(s);
    const note = s === "refunded" ? window.prompt("Refund reason (optional):") || "" : undefined;
    await onUpdateStatus(order._id, s, note);
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96, y: 14  }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 pt-7 pb-5 border-b border-black/5 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h2 className="font-mono text-xl font-bold text-zinc-900">{order.orderNumber}</h2>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-zinc-400 text-xs">
              Created {new Date(order.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

          {/* Source badge */}
          <div className="flex items-center gap-2">
            {order.source === "online" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                <Globe size={11} /> Online Order
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-500">
                <ShoppingBag size={11} /> In-Store
              </span>
            )}
            {order.customerPhone && (
              <a href={`https://wa.me/${order.customerPhone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 transition-colors">
                <MessageCircle size={11} /> WhatsApp
              </a>
            )}
          </div>

          {/* Customer */}
          <div className="bg-zinc-50 rounded-2xl p-5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Customer</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-sm text-zinc-600">{order.customerName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 text-sm">{order.customerName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {order.customerPhone && <span className="text-zinc-400 text-xs">{order.customerPhone}</span>}
                    {order.customerEmail && <span className="text-zinc-400 text-xs">{order.customerEmail}</span>}
                  </div>
                </div>
              </div>
              {order.servedBy && (
                <div className="text-right">
                  <p className="text-[9px] text-zinc-400 uppercase tracking-widest">Served by</p>
                  <p className="text-xs font-semibold text-zinc-700">{order.servedBy.username}</p>
                </div>
              )}
            </div>
            {order.deliveryAddress && (
              <div className="mt-3 pt-3 border-t border-zinc-200 flex items-start gap-2">
                <MapPin size={12} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Delivery Address</p>
                  <p className="text-xs text-zinc-700">{order.deliveryAddress}</p>
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Items ({order.items.length})</p>
            <div className="space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package size={13} className="text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{item.name}</p>
                      <p className="text-xs text-zinc-400">{formatCurrency(item.price)} × {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-bold text-sm text-zinc-900">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-zinc-50 rounded-2xl p-5 space-y-2.5">
            <div className="flex justify-between text-sm text-zinc-500"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.discountAmount > 0 && <div className="flex justify-between text-sm text-emerald-600 font-medium"><span>Discount</span><span>−{formatCurrency(order.discountAmount)}</span></div>}
            {order.taxAmount > 0 && <div className="flex justify-between text-sm text-zinc-500"><span>Tax</span><span>+{formatCurrency(order.taxAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base text-zinc-900 pt-2 border-t border-black/5"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
            <div className="flex justify-between text-sm text-zinc-500 pt-1">
              <span>Payment</span>
              <span className="font-semibold">{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</span>
            </div>
            {order.paymentMethod === "cash" && (order.cashReceived ?? 0) > 0 && (
              <>
                <div className="flex justify-between text-sm text-zinc-500"><span>Cash</span><span>{formatCurrency(order.cashReceived ?? 0)}</span></div>
                <div className="flex justify-between text-sm text-zinc-500"><span>Change</span><span>{formatCurrency(order.change || 0)}</span></div>
              </>
            )}
          </div>

          {/* Note */}
          {order.note && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500 mb-1.5">Note</p>
              <p className="text-sm text-amber-900">{order.note}</p>
            </div>
          )}

          {/* Refund info */}
          {order.status === "refunded" && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-400 mb-1.5">Refund Details</p>
              {order.refundNote && <p className="text-sm text-red-800 mb-1">{order.refundNote}</p>}
              {order.refundedAt && <p className="text-xs text-red-400">{new Date(order.refundedAt).toLocaleString()}</p>}
            </div>
          )}

          {/* Cancelled info */}
          {order.status === "cancelled" && order.cancelledAt && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Cancelled</p>
              <p className="text-xs text-zinc-500">{new Date(order.cancelledAt).toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-7 pt-5 border-t border-black/5 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onPrint(order)}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl font-semibold hover:bg-zinc-200 transition-all text-sm">
              <Printer size={14} /> Print
            </button>
            {transitions.map(s => {
              const m = STATUS_META[s]; const Icon = m.icon;
              return (
                <button key={s} onClick={() => handleStatus(s)} disabled={busy === s}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                  {busy === s ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                  Mark {m.label}
                </button>
              );
            })}
            <button onClick={() => onDelete(order._id)}
              className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-500 rounded-xl font-semibold hover:bg-red-100 transition-all text-sm border border-red-100">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   MAIN ORDERS PAGE
════════════════════════════════════════════════ */
export const Orders: React.FC = () => {
  const { formatCurrency, formatDate, formatTime } = useAppSettings();
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 10;
  const [fromDate, setFrom]       = useState("");
  const [toDate, setTo]           = useState("");
  const [selected, setSelected]   = useState<Order | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast]         = useState<ToastState | null>(null);
  const [stats, setStats]         = useState({
    total: 0, todayCount: 0, completedRevenue: 0, refundCount: 0,
  });

  useEffect(() => { fetchOrders(); fetchStats(); }, [statusFilter, fromDate, toDate]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "all") p.set("status", statusFilter);
      if (fromDate) p.set("from", fromDate);
      if (toDate)   p.set("to",   toDate);
      const res  = await fetch(`/api/orders?${p}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch { showToast("Failed to load orders", "error"); }
    finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res  = await fetch("/api/orders/stats");
      if (!res.ok) return;
      const data = await res.json();
      const refunded = data.byStatus?.find((s: any) => s._id === "refunded");
      setStats({
        total:            data.total            || 0,
        todayCount:       data.todayCount       || 0,
        completedRevenue: data.completedRevenue || 0,
        refundCount:      refunded?.count       || 0,
      });
    } catch {}
  };

  const updateStatus = async (id: string, status: string, refundNote?: string) => {
    const res  = await fetch(`/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, refundNote }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || "Failed to update", "error"); throw new Error(data.message); }
    setOrders(prev => prev.map(o => o._id === id ? { ...o, status: status as Order["status"] } : o));
    if (selected?._id === id) setSelected(prev => prev ? { ...prev, status: status as Order["status"] } : null);
    showToast(`Order marked as ${STATUS_META[status]?.label || status}`);
    fetchStats();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("Permanently delete this order?")) return;
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (!res.ok) { showToast("Delete failed", "error"); return; }
    setOrders(prev => prev.filter(o => o._id !== id));
    if (selected?._id === id) setSelected(null);
    showToast("Order deleted");
    fetchStats();
  };

  const printReceipt = (order: Order) => {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${order.orderNumber}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:320px;margin:auto}
    h2{text-align:center;font-size:18px;font-weight:bold;margin-bottom:4px}.sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}
    .div{border-top:1px dashed #aaa;margin:12px 0}.row{display:flex;justify-content:space-between;margin:5px 0}
    .bold{font-weight:bold}.total{font-size:15px;font-weight:bold;margin-top:6px}@media print{body{padding:0}}</style></head><body>
    <h2>ORDER RECEIPT</h2>
    <div class="sub"><div style="font-weight:bold;font-size:14px">${order.orderNumber}</div>
    <div>${new Date(order.createdAt).toLocaleString()}</div></div>
    <div class="div"></div>
    <div class="row"><span>Customer</span><span class="bold">${order.customerName}</span></div>
    ${order.customerPhone ? `<div class="row"><span>Phone</span><span>${order.customerPhone}</span></div>` : ""}
    ${order.servedBy ? `<div class="row"><span>Served by</span><span>${order.servedBy.username}</span></div>` : ""}
    <div class="div"></div>
    ${order.items.map(i => `<div class="row"><span>${i.name} &times;${i.quantity}</span><span class="bold">$${i.subtotal.toFixed(2)}</span></div>`).join("")}
    <div class="div"></div>
    <div class="row"><span>Subtotal</span><span>$${order.subtotal.toFixed(2)}</span></div>
    ${order.discountAmount > 0 ? `<div class="row" style="color:#059669"><span>Discount</span><span>-$${order.discountAmount.toFixed(2)}</span></div>` : ""}
    ${order.taxAmount > 0 ? `<div class="row"><span>Tax</span><span>$${order.taxAmount.toFixed(2)}</span></div>` : ""}
    <div class="row total"><span>TOTAL</span><span>$${order.total.toFixed(2)}</span></div>
    <div class="div"></div>
    <div class="row"><span>Payment</span><span class="bold">${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</span></div>
    ${order.paymentMethod === "cash" && (order.cashReceived ?? 0) > 0 ? `
      <div class="row"><span>Cash</span><span>$${(order.cashReceived ?? 0).toFixed(2)}</span></div>
      <div class="row"><span>Change</span><span>$${(order.change || 0).toFixed(2)}</span></div>` : ""}
    ${order.note ? `<div class="div"></div><div class="row"><span>Note</span><span>${order.note}</span></div>` : ""}
    <div class="div"></div>
    <p style="text-align:center;color:#666;font-size:11px">Thank you for your business!</p>
    <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  const filtered = orders.filter(o =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (o.customerPhone || "").includes(search)
  );
  const hasFilters   = statusFilter !== "all" || fromDate || toDate || search;
  const clearFilters = () => { setStatus("all"); setFrom(""); setTo(""); setSearch(""); };
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, statusFilter, fromDate, toDate, orders.length]);

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden" style={{ background: "var(--theme-bg)" }}>
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Order Management</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {loading ? "Loading..." : `${filtered.length} order${filtered.length !== 1 ? "s" : ""}${hasFilters ? " (filtered)" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchOrders(); fetchStats(); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-xl font-semibold hover:bg-zinc-50 active:scale-95 transition-all text-sm shadow-sm">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 active:scale-95 transition-all shadow-lg shadow-black/10 text-sm">
            <Plus size={16} /> New Order
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        {[
          { label: "Total Orders",  value: stats.total,                              icon: ClipboardList, color: "text-zinc-600",   bg: "bg-zinc-100"   },
          { label: "Today",         value: stats.todayCount,                         icon: ShoppingBag,   color: "text-blue-500",   bg: "bg-blue-50"    },
          { label: "Revenue",       value: formatCurrency(stats.completedRevenue),   icon: DollarSign,    color: "text-emerald-500",bg: "bg-emerald-50" },
          { label: "Refunds",       value: stats.refundCount,                        icon: RotateCcw,     color: "text-red-500",    bg: "bg-red-50"     },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="bg-white rounded-2xl p-5 border border-black/5 shadow-sm">
            <div className={`w-10 h-10 ${c.bg} ${c.color} rounded-xl flex items-center justify-center mb-3`}>
              <c.icon size={18} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-zinc-900">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main card */}
      <div className="bg-white rounded-3xl shadow-sm border border-black/5 flex-1 flex flex-col overflow-hidden min-h-0">

        {/* Toolbar */}
        <div className="p-5 border-b border-black/5 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search order # or customer..."
                className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-black/8 text-sm placeholder:text-zinc-400" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"><X size={13} /></button>}
            </div>
            <input type="date" value={fromDate} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2.5 bg-zinc-50 border border-transparent rounded-xl text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black/8" />
            <span className="text-zinc-400 text-xs font-medium">to</span>
            <input type="date" value={toDate} onChange={e => setTo(e.target.value)}
              className="px-3 py-2.5 bg-zinc-50 border border-transparent rounded-xl text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-black/8" />
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2.5 text-zinc-400 hover:text-red-500 text-sm font-medium transition-colors">
                <X size={13} /> Clear
              </button>
            )}
          </div>
          {/* Status tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {[{ key: "all", label: "All" }, ...Object.entries(STATUS_META).map(([k, v]) => ({ key: k, label: v.label }))].map(({ key, label }) => {
              const count  = key === "all" ? orders.length : orders.filter(o => o.status === key).length;
              const active = statusFilter === key;
              return (
                <button key={key} onClick={() => setStatus(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"}`}>
                  {label} <span className={`ml-1 text-[10px] ${active ? "opacity-70" : "opacity-50"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-zinc-400">
              <Loader2 size={20} className="animate-spin" /><span className="text-sm">Loading orders...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
                <ClipboardList size={24} className="text-zinc-400" />
              </div>
              <p className="font-semibold text-zinc-700 text-sm">No orders found</p>
              <p className="text-zinc-400 text-xs">{hasFilters ? "Try adjusting filters" : 'Click "New Order" to create one'}</p>
              {!hasFilters && (
                <button onClick={() => setShowCreate(true)} className="mt-1 px-4 py-2 bg-black text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all">
                  + New Order
                </button>
              )}
            </div>
          ) : (
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-white border-b border-black/5">
                <tr>
                  {["Order #", "Source", "Customer", "Items", "Total", "Payment", "Status", "Date", "Actions"].map(h => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginatedOrders.map((order, i) => (
                    <motion.tr key={order._id}
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-black/[0.04] hover:bg-zinc-50/60 transition-colors group">
                      <td className="px-5 py-4"><span className="font-mono text-xs font-bold text-zinc-700">{order.orderNumber}</span></td>
                      <td className="px-5 py-4">
                        {order.source === "online" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                            <Globe size={9} /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-zinc-100 text-zinc-500">
                            <ShoppingBag size={9} /> In-Store
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-sm text-zinc-900">{order.customerName}</p>
                        {order.customerPhone && <p className="text-xs text-zinc-400">{order.customerPhone}</p>}
                      </td>
                      <td className="px-5 py-4"><span className="text-sm text-zinc-500">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</span></td>
                      <td className="px-5 py-4"><span className="font-bold text-sm text-zinc-900">{formatCurrency(order.total)}</span></td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-lg text-[10px] font-bold uppercase tracking-wide">
                          {PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-zinc-500">{formatDate(order.createdAt)}</p>
                        <p className="text-[10px] text-zinc-400">{formatTime(order.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 opacity-100">
                          <button onClick={() => setSelected(order)} className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all" title="View"><Eye size={13} /></button>
                          <button onClick={() => printReceipt(order)} className="p-1.5 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-all" title="Print"><Printer size={13} /></button>
                          <StatusDropdown order={order} onUpdate={updateStatus} />
                          <button onClick={() => deleteOrder(order._id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-black/5 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-zinc-400">
              Showing <span className="font-semibold text-zinc-600">{paginatedOrders.length}</span> of{" "}
              <span className="font-semibold text-zinc-600">{filtered.length}</span> orders
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40">Prev</button>
              <span className="text-[11px] font-semibold text-zinc-500">{currentPage}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold text-zinc-600 disabled:opacity-40">Next</button>
              <p className="text-xs font-bold text-zinc-700 ml-3">
                Total: {formatCurrency(filtered.reduce((s, o) => s + o.total, 0))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && (
          <CreateOrderModal
            onClose={() => setShowCreate(false)}
            onCreated={(msg) => { setShowCreate(false); showToast(msg); fetchOrders(); fetchStats(); }}
            onError={(msg) => showToast(msg, "error")}
          />
        )}
        {selected && (
          <OrderDetailModal
            order={selected}
            onClose={() => setSelected(null)}
            onUpdateStatus={updateStatus}
            onPrint={printReceipt}
            onDelete={(id) => { deleteOrder(id); setSelected(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};