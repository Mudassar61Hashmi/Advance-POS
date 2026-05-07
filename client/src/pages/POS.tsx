import { useState, useMemo, useEffect, useRef } from "react";
import React from "react";
import type { User, Product } from "../types";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  Search, ShoppingCart, Trash2, Plus, Minus,
  Package, X, Tag, Zap, User as UserIcon,
  UserPlus, ChevronDown, Check, Percent, DollarSign,
  ScanLine, AlertTriangle, Camera, Smartphone, CheckCircle2,
  Loader2, Wifi,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CategoryBar } from "../components/CategoryBar";
import { motion, AnimatePresence } from "motion/react";
import { pushAppNotification } from "../notifications";

/* ── BarcodeDetector is available in Chrome/Edge 83+ ── */
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => {
      detect(source: HTMLVideoElement | HTMLImageElement | ImageBitmap): Promise<{ rawValue: string; format: string }[]>;
    };
  }
}

interface POSProps {
  user: User;
  products: Product[];
  onCheckout: () => void;
  onShowReceipt: (sale: any) => void;
}
interface CartItem extends Product { cartQuantity: number; }
interface Customer {
  _id: string; name: string; phone: string; email?: string; isDefault?: boolean;
}
interface TaxConfig {
  _id: string; name: string; rate: number; type: "inclusive" | "exclusive";
}
interface PaymentMethodOption {
  _id: string;
  name: string;
  type: "cash" | "card_credit" | "card_debit" | "bank_transfer" | "mobile_wallet" | "other";
  isDefault?: boolean;
  isActive?: boolean;
}

const normalizePaymentType = (type?: PaymentMethodOption["type"]) => {
  if (!type) return "cash";
  if (type === "card_credit" || type === "card_debit") return "card";
  if (type === "bank_transfer") return "bank_transfer";
  if (type === "mobile_wallet") return "mobile_wallet";
  if (type === "other") return "other";
  return "cash";
};

const WALKIN: Customer = { _id: "walkin", name: "Walk-in Customer", phone: "", isDefault: true };

/* ════════════════════════════════════════════════
   WALLET PAYMENT MODAL (JazzCash / EasyPaisa / etc.)
════════════════════════════════════════════════ */
interface WalletPaymentModalProps {
  methodName: string;
  amount: number;
  instructions: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const WalletPaymentModal: React.FC<WalletPaymentModalProps> = ({
  methodName, amount, instructions, loading, onConfirm, onCancel,
}) => {
  const { formatCurrency } = useAppSettings();
  const name  = methodName.toLowerCase();
  const color = name.includes("jazzcash")  ? "#d0021b"
              : name.includes("easypaisa") ? "#00a651"
              : "#6366f1";

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      onClick={e => !loading && e.target === e.currentTarget && onCancel()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)" }}
    >
      <motion.div
        initial={{ opacity:0, y:28, scale:0.96 }}
        animate={{ opacity:1, y:0,  scale:1    }}
        exit={{   opacity:0, y:14, scale:0.97  }}
        transition={{ type:"spring", stiffness:320, damping:28 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-white"
      >
        {/* Provider header */}
        <div style={{ padding:"24px 24px 20px", background:`linear-gradient(135deg,${color},${color}bb)` }}>
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width:48, height:48, borderRadius:16, background:"rgba(255,255,255,0.22)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Smartphone size={22} color="#fff"/>
            </div>
            <div>
              <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:"#fff" }}>{methodName}</h2>
              <p style={{ margin:"2px 0 0", fontSize:11, color:"rgba(255,255,255,0.78)" }}>Mobile Wallet Payment</p>
            </div>
            <button onClick={onCancel} disabled={loading}
              style={{ marginLeft:"auto", width:32, height:32, borderRadius:10, border:"none", background:"rgba(255,255,255,0.18)", cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <X size={14} color="#fff"/>
            </button>
          </div>
          <div style={{ padding:"14px 16px", borderRadius:16, background:"rgba(255,255,255,0.18)" }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", marginBottom:2 }}>Amount Due</div>
            <div style={{ fontSize:36, fontWeight:900, color:"#fff", lineHeight:1.1, letterSpacing:-1 }}>{formatCurrency(amount)}</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-6 pt-5 pb-3">
          <div style={{ fontSize:10, fontWeight:800, color:"#9ca3af", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
            Payment Instructions
          </div>
          <div style={{ padding:"14px 16px", borderRadius:14, background:`${color}0e`, border:`1px solid ${color}28`, fontSize:13, color:"#374151", lineHeight:1.65 }}>
            {instructions || `Send the exact amount to the merchant's ${methodName} account and click "Payment Received" once done.`}
          </div>
        </div>

        {/* Step hint */}
        <div className="px-6 pb-4">
          {[
            `Open ${methodName} on your phone`,
            "Send payment to merchant's number",
            "Click 'Payment Received' below",
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <div style={{ width:22, height:22, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:900, color:"#fff" }}>{i+1}</span>
              </div>
              <span style={{ fontSize:12, color:"#4b5563" }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all"
            style={{ background:"#f3f4f6", color:"#6b7280", border:"none", cursor:loading?"not-allowed":"pointer", opacity:loading?0.6:1 }}>
            Cancel
          </button>
          <motion.button
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            onClick={onConfirm} disabled={loading}
            className="flex-[2] py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
            style={{ background:color, color:"#fff", border:"none", cursor:loading?"not-allowed":"pointer", boxShadow:`0 8px 20px ${color}44`, opacity:loading?0.8:1 }}>
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</>
            ) : (
              <><CheckCircle2 size={16}/>Payment Received</>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════
   CHECKOUT PREVIEW MODAL
════════════════════════════════════════════════ */
interface CheckoutPreviewProps {
  cart: CartItem[];
  customer: Customer;
  subtotal: number;
  discountAmt: number;
  discountValue: number | "";
  discountType: "fixed" | "percent";
  couponDiscount: number;
  couponCode: string;
  taxAmt: number;
  taxConfig: TaxConfig | null;
  total: number;
  paymentMethods: PaymentMethodOption[];
  paymentMethodId: string;
  note: string;
  loading: boolean;
  onPaymentMethodChange: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const CheckoutPreview: React.FC<CheckoutPreviewProps> = ({
  cart, customer, subtotal, discountAmt, discountValue, discountType,
  couponDiscount, couponCode,
  taxAmt, taxConfig, total, paymentMethods, paymentMethodId, note, loading, onPaymentMethodChange, onConfirm, onClose,
}) => {
  const { formatCurrency } = useAppSettings();
  const itemCount = cart.reduce((s, i) => s + i.cartQuantity, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{   opacity: 0, y: 12, scale: 0.97  }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-zinc-900 tracking-tight">Order Preview</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Review before confirming payment</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Customer */}
        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserIcon size={13} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-900">{customer.name}</p>
            {customer.phone && <p className="text-[10px] text-zinc-400">{customer.phone}</p>}
          </div>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-white border border-zinc-100 px-2.5 py-1 rounded-full">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Items */}
        <div className="px-6 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">Items</p>
          <div className="space-y-2">
            {cart.map(item => (
              <div key={item._id} className="flex items-center gap-3 py-2 border-b border-zinc-50 last:border-0">
                <div className="w-8 h-8 bg-zinc-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={13} className="text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{item.name}</p>
                  <p className="text-[10px] text-zinc-400">{formatCurrency(item.price)} × {item.cartQuantity}</p>
                </div>
                <p className="text-xs font-black text-zinc-900">{formatCurrency(item.price * item.cartQuantity)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="px-6 pb-4 space-y-2.5 border-t border-zinc-50 pt-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Payment Method
            </label>
            <select
              value={paymentMethodId}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/10"
            >
              {paymentMethods.map((method) => (
                <option key={method._id} value={method._id}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {discountAmt > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 font-semibold">
              <span>Discount {discountType === "percent" ? `(${discountValue}%)` : ""}</span>
              <span>−{formatCurrency(discountAmt)}</span>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="flex justify-between text-xs text-violet-600 font-semibold">
              <span>Coupon {couponCode ? `(${couponCode})` : ""}</span>
              <span>−{formatCurrency(couponDiscount)}</span>
            </div>
          )}
          {taxAmt > 0 && (
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{taxConfig ? `${taxConfig.name} (${taxConfig.rate}%)` : "Tax"}</span>
              <span>{formatCurrency(taxAmt)}</span>
            </div>
          )}
          {note && (
            <div className="flex gap-2 pt-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Note:</span>
              <span className="text-[10px] text-zinc-600 italic">{note}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3 border-t border-zinc-100">
            <span className="text-sm font-bold text-zinc-900">Total Due</span>
            <span className="text-2xl font-black text-zinc-900">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3.5 bg-zinc-100 text-zinc-600 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-all">
            Edit Order
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={onConfirm} disabled={loading}
            className="flex-[2] py-3.5 bg-zinc-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-black/15"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Zap size={15} className="text-yellow-300" />
                Confirm & Pay {formatCurrency(total)}
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════
   CUSTOMER PICKER
════════════════════════════════════════════════ */
const CustomerPicker: React.FC<{
  selected: Customer;
  onSelect: (c: Customer) => void;
}> = ({ selected, onSelect }) => {
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [newForm, setNewForm]     = useState({ name: "", phone: "" });
  const [adding, setAdding]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const fetchCustomers = async (q = "") => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/customers${q ? `?search=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch { setCustomers([]); }
    finally { setLoading(false); }
  };

  const handleOpen = () => { setOpen(true); setSearch(""); setShowAdd(false); fetchCustomers(); };

  const addCustomer = async () => {
    if (!newForm.name.trim() || !newForm.phone.trim()) return;
    setAdding(true);
    try {
      const res  = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onSelect(data); setOpen(false); setNewForm({ name: "", phone: "" });
    } catch (err: any) { alert(err.message || "Failed to add customer"); }
    finally { setAdding(false); }
  };

  const filtered = [WALKIN, ...customers].filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search)
  );

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-all group">
        <div className="w-7 h-7 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0">
          <UserIcon size={12} className="text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-bold text-zinc-900 truncate">{selected.name}</p>
          {selected.phone && <p className="text-[10px] text-zinc-400">{selected.phone}</p>}
        </div>
        <ChevronDown size={13} className="text-zinc-400 flex-shrink-0 group-hover:text-zinc-600 transition-colors" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.97         }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-100 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="p-2.5 border-b border-zinc-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input autoFocus value={search} onChange={e => { setSearch(e.target.value); fetchCustomers(e.target.value); }}
                  placeholder="Search customers..."
                  className="w-full pl-8 pr-3 py-2 bg-zinc-50 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-black/8" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6 text-zinc-400 text-xs gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  Loading...
                </div>
              ) : filtered.map(c => (
                <button key={c._id} onClick={() => { onSelect(c); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-zinc-50 transition-colors text-left ${selected._id === c._id ? "bg-zinc-50" : ""}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c._id === "walkin" ? "bg-zinc-100" : "bg-zinc-900"}`}>
                    {c._id === "walkin"
                      ? <UserIcon size={11} className="text-zinc-400" />
                      : <span className="text-white text-[10px] font-black">{c.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{c.name}</p>
                    {c.phone && <p className="text-[10px] text-zinc-400">{c.phone}</p>}
                  </div>
                  {selected._id === c._id && <Check size={12} className="text-emerald-500 flex-shrink-0" />}
                </button>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="py-4 text-center text-xs text-zinc-400">No customers found</div>
              )}
            </div>
            <div className="border-t border-zinc-50">
              {!showAdd ? (
                <button onClick={() => setShowAdd(true)}
                  className="w-full flex items-center gap-2 px-3.5 py-3 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 transition-colors">
                  <UserPlus size={13} className="text-zinc-400" />
                  Add new customer
                </button>
              ) : (
                <div className="p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">New Customer</p>
                  <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name *" className="w-full px-3 py-2 bg-zinc-50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-black/10" />
                  <input value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Phone number *" type="tel"
                    className="w-full px-3 py-2 bg-zinc-50 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-black/10" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)}
                      className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-semibold hover:bg-zinc-200 transition-all">Cancel</button>
                    <button onClick={addCustomer} disabled={adding || !newForm.name || !newForm.phone}
                      className="flex-1 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all disabled:opacity-40">
                      {adding ? "Adding..." : "Add & Select"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ════════════════════════════════════════════════
   MAIN POS
════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   CAMERA SCANNER MODAL
════════════════════════════════════════════════ */
interface CameraScannerProps {
  products: Product[];
  onFound:    (product: Product) => void;
  onNotFound: (code: string)    => void;
  onClose:    ()                => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ products, onFound, onNotFound, onClose }) => {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const runningRef = useRef(true);
  const streamRef  = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "no-support" | "no-permission">("starting");

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!window.BarcodeDetector) { setStatus("no-support"); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        setStatus("scanning");

        const detector = new window.BarcodeDetector!({
          formats: ["qr_code","code_128","ean_13","ean_8","upc_a","upc_e","code_39","code_93","data_matrix","itf"],
        });

        const scan = async () => {
          if (!runningRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const code    = codes[0].rawValue;
              const product = products.find(p => p.barcode === code);
              runningRef.current = false;
              if (product) onFound(product);
              else         onNotFound(code);
              return;
            }
          } catch { /* frame not ready */ }
          if (runningRef.current) requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);

      } catch { if (!cancelled) setStatus("no-permission"); }
    };

    start();
    return () => {
      cancelled = true;
      runningRef.current = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ width: 380, maxWidth: "100%", background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.08)" }}>
              <ScanLine size={17} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Camera Scanner</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Point at a barcode or QR code
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
          {/* Live video */}
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ display: status === "scanning" ? "block" : "none" }} />

          {/* Scanning overlay */}
          {status === "scanning" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative" style={{ width: 200, height: 200 }}>
                {/* Corner brackets */}
                {[
                  { top: 0, left: 0, bt: "border-t-2", bl: "border-l-2", br: "rounded-tl-lg" },
                  { top: 0, right: 0, bt: "border-t-2", bl: "border-r-2", br: "rounded-tr-lg" },
                  { bottom: 0, left: 0, bt: "border-b-2", bl: "border-l-2", br: "rounded-bl-lg" },
                  { bottom: 0, right: 0, bt: "border-b-2", bl: "border-r-2", br: "rounded-br-lg" },
                ].map((c, i) => (
                  <div key={i} className={`absolute w-7 h-7 border-green-400 ${c.bt} ${c.bl} ${c.br}`}
                    style={{ top: c.top, bottom: c.bottom, left: c.left, right: c.right }} />
                ))}
                {/* Animated scan line */}
                <motion.div
                  className="absolute left-2 right-2 h-0.5 rounded-full"
                  style={{ background: "#4ade80", boxShadow: "0 0 10px #4ade80, 0 0 20px #4ade8066" }}
                  animate={{ top: ["8%", "92%", "8%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}

          {/* Starting spinner */}
          {status === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-2 rounded-full animate-spin"
                style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#fff" }} />
            </div>
          )}

          {/* No support */}
          {status === "no-support" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(251,146,60,0.15)" }}>
                <AlertTriangle size={22} className="text-orange-400" />
              </div>
              <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Camera scanning requires Chrome or Edge. Use a USB barcode scanner instead — just scan while the POS is open.
              </p>
            </div>
          )}

          {/* No permission */}
          {status === "no-permission" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.15)" }}>
                <Camera size={22} className="text-red-400" />
              </div>
              <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                Camera access denied. Allow camera permission in your browser settings, then try again.
              </p>
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {status === "scanning" && (
          <p className="text-center text-[10px] pb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
            Detecting automatically — no button press needed
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════
   POS PAGE
════════════════════════════════════════════════ */
export const POS: React.FC<POSProps> = ({ user, products, onCheckout, onShowReceipt }) => {
  const { formatCurrency, lowStockThreshold } = useAppSettings();
  const [search, setSearch]             = useState("");
  const [showCamera, setShowCamera]     = useState(false);
  const [scanFlash, setScanFlash]       = useState<{ name: string; found: boolean } | null>(null);
  const scanBuf   = useRef<{ key: string; ts: number }[]>([]);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [activeCategory, setCategory]   = useState("All");
  const [note, setNote]                 = useState("");
  const [discountValue, setDiscountVal] = useState<number | "">("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [customer, setCustomer]         = useState<Customer>(WALKIN);
  const [defaultTax, setDefaultTax]     = useState<TaxConfig | null>(null);
  const [showPreview, setShowPreview]       = useState(false);
  const [showWalletModal, setShowWalletModal]   = useState(false);
  const [walletPaymentId, setWalletPaymentId]   = useState<string | null>(null);
  const [walletInstructions, setWalletInstructions] = useState("");
  const [walletMethodName, setWalletMethodName] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([
    { _id: "cash-default", name: "Cash", type: "cash", isDefault: true, isActive: true },
  ]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("cash-default");
  const [couponCode, setCouponCode]           = useState("");
  const [couponLoading, setCouponLoading]     = useState(false);
  const [couponError, setCouponError]         = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon]     = useState<{ code: string; discount: number } | null>(null);
  const [showMobileScan, setShowMobileScan]   = useState(false);
  const [mobileScanUrl, setMobileScanUrl]     = useState<string | null>(null);
  const [mobileScanId, setMobileScanId]       = useState<string | null>(null);
  const [mobileScanning, setMobileScanning]   = useState(false);
  const mobilePollRef                         = useRef<ReturnType<typeof setInterval> | null>(null);
  const productsRef                           = useRef(products);
  const [mobileView, setMobileView]           = useState<"products" | "cart">("products");

  /* Keep productsRef current so the polling setInterval always sees latest products */
  useEffect(() => { productsRef.current = products; }, [products]);

  useEffect(() => {
    fetch("/api/taxes/meta/default")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDefaultTax(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/payment-methods")
      .then((r) => (r.ok ? r.json() : []))
      .then((methods: PaymentMethodOption[]) => {
        const configuredMethods = Array.isArray(methods) ? methods : [];
        if (configuredMethods.length === 0) return;
        setPaymentMethods(configuredMethods);
        const cashMethod = configuredMethods.find((m) => m.type === "cash");
        const defaultMethod = cashMethod || configuredMethods.find((m) => m.isDefault) || configuredMethods[0];
        setSelectedPaymentMethodId(defaultMethod._id);
      })
      .catch(() => {});
  }, []);

  /* ── Hardware barcode/QR scanner: USB or Bluetooth HID ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (scanTimer.current) { clearTimeout(scanTimer.current); scanTimer.current = null; }
        const buf = scanBuf.current; scanBuf.current = [];
        if (buf.length < 3) return;
        const allFast = buf.every((k, i) => i === 0 || k.ts - buf[i - 1].ts < 80);
        if (!allFast) return;
        const barcode = buf.map(k => k.key).join("");
        const product = products.find(p => p.barcode === barcode);
        if (product) {
          setCart(prev => {
            const ex = prev.find(item => item._id === product._id);
            if (ex) {
              if (ex.cartQuantity >= product.quantity) return prev;
              return prev.map(item => item._id === product._id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
            }
            return [...prev, { ...product, cartQuantity: 1 }];
          });
          setScanFlash({ name: product.name, found: true });
        } else {
          setScanFlash({ name: barcode, found: false });
        }
        setTimeout(() => setScanFlash(null), 2200);
      } else if (e.key.length === 1) {
        scanBuf.current.push({ key: e.key, ts: Date.now() });
        if (scanTimer.current) clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => { scanBuf.current = []; }, 500);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [products]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ["All", ...cats];
  }, [products]);

  const categoryCounts = useMemo(() => {
    const c: Record<string, number> = { All: products.length };
    products.forEach(p => { if (p.category) c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, [products]);


  const filteredProducts = useMemo(() => products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.barcode || "").includes(search);
    const matchCat    = activeCategory === "All" || p.category === activeCategory;
    return matchSearch && matchCat;
  }), [products, search, activeCategory]);

  /* Cart ops */
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i._id === product._id);
      if (ex) {
        if (ex.cartQuantity >= product.quantity) return prev;
        return prev.map(i => i._id === product._id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };
  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i._id !== id));
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item._id !== id) return item;
      const newQty = item.cartQuantity + delta;
      if (newQty <= 0 || newQty > item.quantity) return item;
      return { ...item, cartQuantity: newQty };
    }));
  };
  const clearCart = () => {
    setCart([]); setDiscountVal(""); setNote(""); setCustomer(WALKIN);
    setAppliedCoupon(null); setCouponCode(""); setCouponError(null);
  };

  /* ── Coupon validation ── */
  const getToken = () => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true); setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ code: couponCode.trim(), orderTotal: subtotal - discountAmt }),
      });
      const data = await res.json();
      if (!res.ok) { setCouponError(data.message || "Invalid coupon"); return; }
      setAppliedCoupon({ code: data.coupon.code, discount: data.discount });
    } catch { setCouponError("Could not validate coupon"); }
    finally { setCouponLoading(false); }
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(""); setCouponError(null); };

  /* ── Mobile scan session ── */
  const startMobileScan = async () => {
    try {
      const res = await fetch("/api/scan/start", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setMobileScanId(data.sessionId);
      setMobileScanUrl(data.url);
      setShowMobileScan(true);
      setMobileScanning(true);
      mobilePollRef.current = setInterval(async () => {
        try {
          const pollRes  = await fetch(`/api/scan/${data.sessionId}/poll`);
          const pollData = await pollRes.json();
          if (pollData.barcodes?.length > 0) {
            for (const barcode of pollData.barcodes) {
              /* Use ref so we always look up against the latest product list */
              const product = productsRef.current.find(p => p.barcode === barcode);
              if (product) {
                setCart(prev => {
                  const ex = prev.find(item => item._id === product._id);
                  if (ex) {
                    if (ex.cartQuantity >= product.quantity) return prev;
                    return prev.map(item => item._id === product._id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
                  }
                  return [...prev, { ...product, cartQuantity: 1 }];
                });
                setScanFlash({ name: product.name, found: true });
                /* Switch to cart view on mobile so user sees the added item */
                setMobileView("cart");
                setTimeout(() => setScanFlash(null), 2200);
              } else {
                setScanFlash({ name: barcode, found: false });
                setTimeout(() => setScanFlash(null), 2200);
              }
            }
          }
        } catch { /* ignore poll errors */ }
      }, 2000);
    } catch { /* ignore */ }
  };

  /* Just hides the QR dialog — keeps polling alive so phone can keep scanning */
  const hideMobileScanModal = () => setShowMobileScan(false);

  /* Fully ends the session and polling */
  const stopMobileScan = () => {
    if (mobilePollRef.current) { clearInterval(mobilePollRef.current); mobilePollRef.current = null; }
    if (mobileScanId) fetch(`/api/scan/${mobileScanId}`, { method: "DELETE" }).catch(() => {});
    setShowMobileScan(false); setMobileScanId(null); setMobileScanUrl(null); setMobileScanning(false);
  };

  /* Totals */
  const subtotal    = useMemo(() => cart.reduce((s, i) => s + i.price * i.cartQuantity, 0), [cart]);
  const itemCount   = cart.reduce((s, i) => s + i.cartQuantity, 0);
  const discountAmt = useMemo(() => {
    const v = Number(discountValue) || 0;
    return discountType === "percent" ? Math.min((subtotal * v) / 100, subtotal) : Math.min(v, subtotal);
  }, [discountValue, discountType, subtotal]);
  const couponDiscount  = appliedCoupon?.discount ?? 0;
  const taxableAmount   = subtotal - discountAmt;
  const taxAmt = useMemo(() => {
    if (!defaultTax || defaultTax.rate === 0) return 0;
    if (defaultTax.type === "inclusive") return 0;
    return (taxableAmount * defaultTax.rate) / 100;
  }, [defaultTax, taxableAmount]);
  const total = Math.max(0, taxableAmount + taxAmt - couponDiscount);

  /* Step 1: open preview modal */
  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    setShowPreview(true);
  };

  /* Step 2: user confirms → check payment type */
  const handleConfirmCheckout = async () => {
    const selectedPaymentMethod = paymentMethods.find((m) => m._id === selectedPaymentMethodId) || paymentMethods[0];

    /* Mobile wallet path → show wallet payment screen */
    if (selectedPaymentMethod?.type === "mobile_wallet") {
      setLoading(true);
      try {
        let settings: Record<string, string> = {};
        try { settings = JSON.parse(localStorage.getItem("pos_settings") || "{}"); } catch {}
        const merchantPhone = settings.whatsappNumber || settings.storePhone || "";
        const initRes = await fetch("/api/payments/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount:               Number(total.toFixed(2)),
            currency:             settings.currency || "PKR",
            customerName:         customer.name,
            customerPhone:        customer.phone || "",
            methodName:           selectedPaymentMethod.name,
            merchantPhone,
            merchantAccountTitle: settings.storeName || "",
          }),
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData.message || "Failed to init wallet payment");
        setWalletPaymentId(initData.payment._id);
        setWalletInstructions(initData.instructions);
        setWalletMethodName(selectedPaymentMethod.name);
        setShowPreview(false);
        setShowWalletModal(true);
      } catch (err: any) {
        alert(err.message || "Could not start wallet payment");
      } finally {
        setLoading(false);
      }
      return;
    }

    /* Standard payment path */
    setLoading(true);
    try {
      const payload = {
        userId:         String(user.id),
        cashier:        user.username,
        customerId:     customer._id !== "walkin" ? customer._id : null,
        customerName:   customer.name,
        subtotal:       Number(subtotal.toFixed(2)),
        discount:       Number(discountAmt.toFixed(2)),
        discountType,
        couponCode:     appliedCoupon?.code || "",
        couponDiscount: Number(couponDiscount.toFixed(2)),
        tax:            Number(taxAmt.toFixed(2)),
        taxName:        defaultTax?.name || "",
        taxRate:        defaultTax?.rate || 0,
        paymentMethod:  normalizePaymentType(selectedPaymentMethod?.type),
        total:          Number(total.toFixed(2)),
        note,
        items: cart.map(item => ({
          id:       String(item._id),
          name:     item.name,
          quantity: Number(item.cartQuantity),
          price:    Number(item.price),
        })),
      };
      const res  = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Checkout failed"); return; }
      const saleRes  = await fetch(`/api/sales/${data.saleId}`);
      const saleData = await saleRes.json();
      setShowPreview(false);
      onCheckout();
      clearCart();
      onShowReceipt(saleData);
      pushAppNotification("Checkout completed", `Order ${saleData?.invoiceNumber || data.saleId || ""} paid ${selectedPaymentMethod?.name || "successfully"} for ${formatCurrency(Number(total))}.`);
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Checkout error — check console");
    } finally {
      setLoading(false);
    }
  };

  /* Wallet: cashier confirms payment received */
  const confirmWalletAndCheckout = async () => {
    setLoading(true);
    try {
      if (walletPaymentId) {
        await fetch(`/api/payments/${walletPaymentId}/confirm`, { method: "PATCH" }).catch(() => {});
      }
      const selectedPaymentMethod = paymentMethods.find((m) => m._id === selectedPaymentMethodId) || paymentMethods[0];
      const payload = {
        userId:         String(user.id),
        cashier:        user.username,
        customerId:     customer._id !== "walkin" ? customer._id : null,
        customerName:   customer.name,
        subtotal:       Number(subtotal.toFixed(2)),
        discount:       Number(discountAmt.toFixed(2)),
        discountType,
        couponCode:     appliedCoupon?.code || "",
        couponDiscount: Number(couponDiscount.toFixed(2)),
        tax:            Number(taxAmt.toFixed(2)),
        taxName:        defaultTax?.name || "",
        taxRate:        defaultTax?.rate || 0,
        paymentMethod:  "mobile_wallet",
        total:          Number(total.toFixed(2)),
        note,
        items: cart.map(item => ({
          id:       String(item._id),
          name:     item.name,
          quantity: Number(item.cartQuantity),
          price:    Number(item.price),
        })),
      };
      const res  = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Checkout failed"); return; }
      const saleRes  = await fetch(`/api/sales/${data.saleId}`);
      const saleData = await saleRes.json();
      setShowWalletModal(false);
      setWalletPaymentId(null);
      onCheckout();
      clearCart();
      onShowReceipt(saleData);
      pushAppNotification("Wallet payment confirmed", `Order ${saleData?.invoiceNumber || data.saleId || ""} paid via ${walletMethodName} for ${formatCurrency(Number(total))}.`);
    } catch (err) {
      console.error("Wallet checkout error:", err);
      alert("Checkout error — check console");
    } finally {
      setLoading(false);
    }
  };

  /* Wallet: cashier cancels */
  const cancelWalletPayment = () => {
    if (walletPaymentId) {
      fetch(`/api/payments/${walletPaymentId}/cancel`, { method: "PATCH" }).catch(() => {});
    }
    setShowWalletModal(false);
    setWalletPaymentId(null);
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>

      {/* ══ Checkout Preview Modal ══════════════════════════════ */}
      <AnimatePresence>
        {showPreview && (
          <CheckoutPreview
            cart={cart}
            customer={customer}
            subtotal={subtotal}
            discountAmt={discountAmt}
            discountValue={discountValue}
            discountType={discountType}
            couponDiscount={couponDiscount}
            couponCode={appliedCoupon?.code || ""}
            taxAmt={taxAmt}
            taxConfig={defaultTax}
            total={total}
            paymentMethods={paymentMethods}
            paymentMethodId={selectedPaymentMethodId}
            note={note}
            loading={loading}
            onPaymentMethodChange={setSelectedPaymentMethodId}
            onConfirm={handleConfirmCheckout}
            onClose={() => !loading && setShowPreview(false)}
          />
        )}
      </AnimatePresence>

      {/* ══ Camera Scanner Modal ════════════════════════════════ */}
      <AnimatePresence>
        {showCamera && (
          <CameraScanner
            products={products}
            onFound={product => {
              setCart(prev => {
                const ex = prev.find(item => item._id === product._id);
                if (ex) {
                  if (ex.cartQuantity >= product.quantity) return prev;
                  return prev.map(item => item._id === product._id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
                }
                return [...prev, { ...product, cartQuantity: 1 }];
              });
              setScanFlash({ name: product.name, found: true });
              setTimeout(() => setScanFlash(null), 2200);
              setShowCamera(false);
            }}
            onNotFound={code => {
              setScanFlash({ name: code, found: false });
              setTimeout(() => setScanFlash(null), 2200);
              setShowCamera(false);
            }}
            onClose={() => setShowCamera(false)}
          />
        )}
      </AnimatePresence>

      {/* ══ Wallet Payment Modal ═══════════════════════════════ */}
      <AnimatePresence>
        {showWalletModal && (
          <WalletPaymentModal
            methodName={walletMethodName}
            amount={total}
            instructions={walletInstructions}
            loading={loading}
            onConfirm={confirmWalletAndCheckout}
            onCancel={cancelWalletPayment}
          />
        )}
      </AnimatePresence>

      {/* ══ Mobile Scan Modal ═════════════════════════════════ */}
      <AnimatePresence>
        {showMobileScan && mobileScanUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => e.target === e.currentTarget && hideMobileScanModal()}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-zinc-900 px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <Smartphone size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Mobile Scanner</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-zinc-400 text-[11px]">Listening for scans…</p>
                    </div>
                  </div>
                </div>
                <button onClick={hideMobileScanModal} className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white hover:bg-white/20 transition-all">
                  <X size={14} />
                </button>
              </div>
              <div className="p-6 flex flex-col items-center">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-100 mb-4">
                  <QRCodeSVG value={mobileScanUrl} size={180} level="M" />
                </div>
                <p className="text-sm font-bold text-zinc-900 text-center mb-1">Scan with your phone</p>
                <p className="text-zinc-400 text-xs text-center max-w-xs mb-2">Open this QR on your phone, allow camera, then scan product barcodes. Items appear in the cart instantly.</p>
                <div className="w-full bg-zinc-50 rounded-xl p-3 flex items-center gap-2 mb-4">
                  <Wifi size={13} className="text-zinc-400 flex-shrink-0" />
                  <p className="text-[11px] text-zinc-500 font-mono break-all flex-1">{mobileScanUrl}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button onClick={hideMobileScanModal}
                    className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-semibold text-sm hover:bg-black transition-all">
                    Done (keep scanning)
                  </button>
                  <button onClick={stopMobileScan}
                    className="px-4 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-semibold text-sm hover:bg-red-50 hover:text-red-600 transition-all">
                    Stop
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Scan Flash Notification ═════════════════════════════ */}
      <AnimatePresence>
        {scanFlash && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{   opacity: 0, y: -10,  scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl"
            style={{
              background: scanFlash.found ? "#18181b" : "#ef4444",
              minWidth: 260, maxWidth: 400,
            }}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${scanFlash.found ? "bg-emerald-500" : "bg-red-600"}`}>
              {scanFlash.found
                ? <Check size={15} className="text-white" />
                : <AlertTriangle size={15} className="text-white" />}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-black truncate">
                {scanFlash.found ? `Added: ${scanFlash.name}` : "Product not found"}
              </p>
              {!scanFlash.found && (
                <p className="text-red-200 text-[10px] font-mono truncate">{scanFlash.name}</p>
              )}
            </div>
            <ScanLine size={15} className="text-white/40 flex-shrink-0 ml-auto" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ LEFT: Products ══════════════════════════════════════ */}
      <div className={`flex-1 flex-col min-w-0 overflow-hidden ${mobileView === "cart" ? "hidden md:flex" : "flex"}`}>
        <div className="flex-shrink-0 px-6 pt-5 pb-4">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or scan barcode..."
              className="w-full pl-11 pr-10 py-3 bg-white rounded-2xl border border-zinc-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/8 placeholder:text-zinc-400 transition-all" />
            {search ? (
              <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors">
                <X size={14} />
              </button>
            ) : (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button onClick={() => setShowCamera(true)} title="Camera barcode/QR scanner"
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors">
                  <Camera size={15} />
                </button>
                <button
                  onClick={mobileScanning ? () => setShowMobileScan(true) : startMobileScan}
                  title={mobileScanning ? "Mobile scanner active — click to view" : "Start mobile scanner"}
                  className={`p-1.5 rounded-lg transition-colors relative ${mobileScanning ? "text-emerald-600" : "text-zinc-400 hover:text-indigo-600"}`}>
                  {mobileScanning && <span className="absolute inset-0 rounded-lg bg-emerald-400/20 animate-pulse" />}
                  <Smartphone size={15} />
                </button>
              </div>
            )}
          </div>
          <CategoryBar
            categories={categories}
            active={activeCategory}
            onSelect={setCategory}
            counts={categoryCounts}
          />
        </div>

        <div className="px-6 mb-3 flex items-center justify-between flex-shrink-0">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
          </p>
          {defaultTax && (
            <span className="text-[10px] font-semibold text-zinc-400 bg-white border border-zinc-100 px-2.5 py-1 rounded-full">
              Tax: {defaultTax.name} {defaultTax.rate}%
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl border border-zinc-100 flex items-center justify-center">
                <Package size={24} className="text-zinc-300" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map((product, i) => {
                const inCart     = cart.find(c => c._id === product._id);
                const outOfStock = product.quantity <= 0;
                const lowStock   = product.quantity > 0 && product.quantity <= (lowStockThreshold ?? 5);
                return (
                  <motion.button key={product._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.015 }}
                    whileHover={{ y: outOfStock ? 0 : -3, transition: { duration: 0.15 } }}
                    whileTap={{ scale: outOfStock ? 1 : 0.97 }}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`relative flex flex-col p-4 bg-white rounded-2xl border text-left transition-all group ${
                      outOfStock ? "opacity-50 cursor-not-allowed border-zinc-100"
                        : inCart  ? "border-zinc-900 shadow-md"
                        : "border-zinc-100 hover:border-zinc-300 hover:shadow-sm"
                    }`}>
                    {inCart && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-zinc-900 text-white rounded-full text-[10px] font-black flex items-center justify-center z-10">
                        {inCart.cartQuantity}
                      </div>
                    )}
                    <div className={`w-full aspect-square rounded-xl mb-3 flex items-center justify-center transition-colors overflow-hidden ${inCart ? "bg-zinc-900" : "bg-zinc-50 group-hover:bg-zinc-100"}`}>
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={28} className={inCart ? "text-white" : "text-zinc-300"} />
                      )}
                    </div>
                    <h3 className="font-semibold text-xs text-zinc-900 truncate mb-0.5 leading-tight">{product.name}</h3>
                    <p className="text-[10px] text-zinc-400 mb-3 truncate">{product.category}</p>
                    <div className="mt-auto">
                      <div className="font-black text-base text-zinc-900 mb-1.5">{formatCurrency(product.price)}</div>
                      <div className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full w-fit ${
                        outOfStock ? "bg-red-50 text-red-500"
                          : lowStock ? "bg-orange-50 text-orange-500"
                          : "bg-emerald-50 text-emerald-600"
                      }`}>
                        {outOfStock ? "Out of stock" : lowStock ? `${product.quantity} left` : `${product.quantity} in stock`}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT: Cart ═════════════════════════════════════════ */}
      <div className={`w-full md:w-[380px] flex-shrink-0 flex-col bg-white md:border-l border-zinc-100 overflow-hidden ${mobileView === "products" ? "hidden md:flex" : "flex"}`}>
        <div className="flex-shrink-0 px-5 py-4 border-b border-zinc-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setMobileView("products")}
                className="md:hidden p-1.5 -ml-1 mr-1 text-zinc-500 hover:text-zinc-900 rounded-lg transition-colors">
                <X size={16} />
              </button>
              <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center">
                <ShoppingCart size={14} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-zinc-900">Current Order</h2>
                <p className="text-[10px] text-zinc-400">{user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button onClick={clearCart}
                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  <Trash2 size={14} />
                </button>
              )}
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${itemCount > 0 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"}`}>
                {itemCount} {itemCount === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Customer</p>
            <CustomerPicker selected={customer} onSelect={setCustomer} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <AnimatePresence initial={false}>
            {cart.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full gap-3 py-12">
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center">
                  <ShoppingCart size={28} className="text-zinc-200" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-zinc-400">Cart is empty</p>
                  <p className="text-xs text-zinc-300 mt-1">Click products to add them</p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <motion.div key={item._id}
                    initial={{ opacity: 0, x: 20, height: 0 }}
                    animate={{ opacity: 1, x: 0,  height: "auto" }}
                    exit={{   opacity: 0, x: -20, height: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl group">
                    <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={14} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-900 truncate">{item.name}</p>
                      <p className="text-[10px] text-zinc-400">
                        {formatCurrency(item.price)} × {item.cartQuantity} =
                        <span className="font-bold text-zinc-600"> {formatCurrency(item.price * item.cartQuantity)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-white rounded-xl border border-zinc-100 p-0.5">
                      <button onClick={() => updateQuantity(item._id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors text-zinc-600">
                        <Minus size={11} />
                      </button>
                      <span className="text-xs font-black w-5 text-center text-zinc-900">{item.cartQuantity}</span>
                      <button onClick={() => updateQuantity(item._id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors text-zinc-600">
                        <Plus size={11} />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item._id)}
                      className="w-6 h-6 flex items-center justify-center text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                      <X size={12} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {cart.length > 0 && (
          <div className="px-4 pb-2 space-y-2 flex-shrink-0">
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Order note (optional)..."
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-black/8 placeholder:text-zinc-300 transition-all" />
            {/* Coupon input */}
            {appliedCoupon ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Tag size={12} className="text-emerald-600 flex-shrink-0" />
                <span className="text-xs font-bold text-emerald-700 font-mono flex-1">{appliedCoupon.code}</span>
                <span className="text-xs font-black text-emerald-600">−{formatCurrency(appliedCoupon.discount)}</span>
                <button onClick={removeCoupon} className="text-emerald-400 hover:text-emerald-700"><X size={12} /></button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Tag size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={couponCode}
                    onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                    onKeyDown={e => e.key === "Enter" && validateCoupon()}
                    placeholder="COUPON CODE"
                    className="w-full pl-7 pr-3 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-black/8 placeholder:text-zinc-300 uppercase" />
                </div>
                <button onClick={validateCoupon} disabled={couponLoading || !couponCode.trim()}
                  className="px-3 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-700 transition-all disabled:opacity-40 flex items-center gap-1">
                  {couponLoading ? <Loader2 size={11} className="animate-spin" /> : "Apply"}
                </button>
              </div>
            )}
            {couponError && <p className="text-[11px] text-red-500 px-1">{couponError}</p>}
          </div>
        )}

        <div className="flex-shrink-0 border-t border-zinc-50 bg-white">
          <div className="px-5 pt-4 pb-3 space-y-2.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-shrink-0">
                <Tag size={11} className="text-zinc-400" />
                <span className="text-xs text-zinc-500">Discount</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="flex rounded-lg border border-zinc-100 overflow-hidden">
                  <button onClick={() => setDiscountType("fixed")}
                    className={`px-2 py-1 text-[10px] font-bold transition-all flex items-center gap-1 ${discountType === "fixed" ? "bg-zinc-900 text-white" : "bg-white text-zinc-400 hover:text-zinc-600"}`}>
                    <DollarSign size={9} />$
                  </button>
                  <button onClick={() => setDiscountType("percent")}
                    className={`px-2 py-1 text-[10px] font-bold transition-all flex items-center gap-1 ${discountType === "percent" ? "bg-zinc-900 text-white" : "bg-white text-zinc-400 hover:text-zinc-600"}`}>
                    <Percent size={9} />%
                  </button>
                </div>
                <input type="number" min="0"
                  max={discountType === "percent" ? 100 : subtotal}
                  value={discountValue}
                  onChange={e => setDiscountVal(e.target.value === "" ? "" : Math.max(0, +e.target.value))}
                  placeholder="0"
                  className="w-16 px-2 py-1 text-xs font-semibold text-right bg-zinc-50 border border-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-black/10" />
              </div>
            </div>
            {discountAmt > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Discount</span>
                <span>−{formatCurrency(discountAmt)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-xs text-violet-600 font-semibold">
                <span>Coupon ({appliedCoupon?.code})</span>
                <span>−{formatCurrency(couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-zinc-500">
              <span>{defaultTax ? `${defaultTax.name} (${defaultTax.rate}%)` : "Tax (0%)"}</span>
              <span>{formatCurrency(taxAmt)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-zinc-50">
              <span className="text-sm font-bold text-zinc-900">Total</span>
              <span className="text-xl font-black text-zinc-900">{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="px-4 pb-5">
            <motion.button
              whileHover={{ scale: cart.length === 0 ? 1 : 1.01 }}
              whileTap={{ scale: cart.length === 0 ? 1 : 0.98 }}
              disabled={cart.length === 0}
              onClick={handleCheckoutClick}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-black/10"
            >
              <Zap size={16} className="text-yellow-300" />
              Review & Checkout — {formatCurrency(total)}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ══ Mobile Bottom Tab Bar ══════════════════════════════ */}
      <div className="md:hidden flex-shrink-0 flex border-t border-zinc-100 bg-white">
        <button
          onClick={() => setMobileView("products")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-colors ${mobileView === "products" ? "text-zinc-900" : "text-zinc-400"}`}
        >
          <Package size={18} />
          Products
        </button>
        <button
          onClick={() => setMobileView("cart")}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-bold transition-colors relative ${mobileView === "cart" ? "text-zinc-900" : "text-zinc-400"}`}
        >
          <div className="relative">
            <ShoppingCart size={18} />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2.5 min-w-[16px] h-4 bg-zinc-900 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {itemCount}
              </span>
            )}
          </div>
          Cart
        </button>
      </div>
    </div>
  );
};