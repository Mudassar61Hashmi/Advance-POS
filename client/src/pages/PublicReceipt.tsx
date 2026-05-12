import React, { useState, useEffect } from "react";
import {
  ShieldCheck, AlertCircle, Loader2, Package,
  User as UserIcon, Tag, Receipt,
} from "lucide-react";

interface PublicReceiptProps {
  saleId: string | null;
}

interface SaleData {
  id: string;
  invoiceNumber?: string;
  cashier: string;
  customerName?: string;
  paymentMethod?: string;
  cashReceived?: number;
  change?: number;
  subtotal?: number;
  discount?: number;
  discountType?: string;
  discountInput?: number;
  flatDiscount?: number;
  tax?: number;
  taxName?: string;
  taxRate?: number;
  taxType?: string;
  total: number;
  note?: string;
  timestamp: string;
  items: { id: string; name: string; quantity: number; price: number; lineTotal?: number }[];
}

interface StoreConfigData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  taxNumber: string;
  currencySymbol: string;
  receiptFooter: string;
  logoDataUrl: string;
}

const PublicReceipt: React.FC<PublicReceiptProps> = ({ saleId }) => {
  const [sale, setSale]           = useState<SaleData | null>(null);
  const [store, setStore]         = useState<StoreConfigData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!saleId) { setError("Invalid receipt link."); setLoading(false); return; }

    Promise.all([
      fetch(`/api/sales/${saleId}`).then(r => {
        if (!r.ok) throw new Error("Receipt not found.");
        return r.json();
      }),
      fetch("/api/store-config").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([saleData, configData]) => {
      setSale(saleData);
      setStore(configData);
    }).catch(err => {
      setError(err.message || "Could not load receipt.");
    }).finally(() => setLoading(false));
  }, [saleId]);

  const fmt = (amount: number | null | undefined) => {
    const sym = store?.currencySymbol || "$";
    return `${sym}${(amount ?? 0).toFixed(2)}`;
  };

  const formatDt = (ts: string) => {
    try {
      const d = new Date(ts);
      return {
        date: d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };
    } catch { return { date: ts, time: "" }; }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Loader2 size={32} color="#a1a1aa" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "#a1a1aa", fontSize: 14 }}>Loading receipt…</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  /* ── Error / not found ── */
  if (error || !sale) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <AlertCircle size={28} color="#ef4444" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#18181b", margin: "0 0 8px" }}>Receipt Not Found</h1>
          <p style={{ color: "#71717a", fontSize: 14, lineHeight: 1.5 }}>
            {error || "This receipt link is invalid or the receipt has been removed."}
          </p>
        </div>
      </div>
    );
  }

  const invoiceNo   = sale.invoiceNumber || String(sale.id).slice(-8).toUpperCase();
  const subtotal    = sale.subtotal ?? sale.total;
  const discount    = sale.discount ?? 0;
  const flatDisc    = sale.flatDiscount ?? 0;
  const tax         = sale.tax ?? 0;
  const cashRec     = sale.cashReceived ?? 0;
  const change      = sale.change ?? 0;
  const itemCount   = sale.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const { date, time } = formatDt(sale.timestamp);
  const storeName   = store?.storeName || "ProPOS";

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f4f4f5; }
      `}</style>

      {/* Verified badge */}
      <div style={styles.badge}>
        <ShieldCheck size={15} color="#059669" />
        <span style={{ color: "#047857", fontWeight: 700, fontSize: 13 }}>Verified Receipt</span>
      </div>

      {/* Receipt card */}
      <div style={styles.card}>

        {/* Store header */}
        <div style={{ textAlign: "center", padding: "28px 24px 20px", borderBottom: "1px dashed #e4e4e7" }}>
          {store?.logoDataUrl && (
            <img src={store.logoDataUrl} alt="logo"
              style={{ maxWidth: 72, maxHeight: 56, objectFit: "contain", margin: "0 auto 12px", display: "block" }} />
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
            <Receipt size={16} color="#a1a1aa" />
            <span style={{ fontSize: 18, fontWeight: 900, color: "#18181b", letterSpacing: -0.5 }}>{storeName}</span>
          </div>
          {store?.storeAddress && <p style={styles.meta}>{store.storeAddress}</p>}
          {store?.storePhone   && <p style={styles.meta}>{store.storePhone}</p>}
          {store?.taxNumber    && <p style={styles.meta}>Tax No: {store.taxNumber}</p>}
        </div>

        {/* Invoice info */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
          <div>
            <p style={styles.label}>INVOICE</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#18181b", fontFamily: "monospace" }}>#{invoiceNo}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={styles.label}>DATE & TIME</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#3f3f46" }}>{date}</p>
            <p style={{ fontSize: 12, color: "#a1a1aa" }}>{time}</p>
          </div>
        </div>

        {/* Customer + Cashier */}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid #f4f4f5" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <UserIcon size={14} color="#a1a1aa" style={{ marginTop: 2 }} />
            <div>
              <p style={styles.label}>CUSTOMER</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>{sale.customerName || "Walk-in Customer"}</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={styles.label}>SERVED BY</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>{sale.cashier}</p>
          </div>
        </div>

        {/* Items */}
        <div style={{ padding: "16px 24px", borderBottom: "1px dashed #e4e4e7" }}>
          <p style={{ ...styles.label, marginBottom: 12 }}>ITEMS ({itemCount})</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "4px 12px", marginBottom: 4 }}>
            {["Item", "Qty", "Price", "Total"].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</span>
            ))}
          </div>
          {sale.items.map((item, i) => {
            const lineTotal = item.lineTotal ?? item.price * item.quantity;
            return (
              <div key={item.id ?? i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "4px 12px", padding: "8px 0", borderTop: "1px solid #f4f4f5", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, background: "#f4f4f5", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Package size={12} color="#a1a1aa" />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#18181b" }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 12, color: "#71717a", textAlign: "center", fontFamily: "monospace" }}>{item.quantity}</span>
                <span style={{ fontSize: 12, color: "#71717a", textAlign: "right", fontFamily: "monospace" }}>{fmt(item.price)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#18181b", textAlign: "right", fontFamily: "monospace" }}>{fmt(lineTotal)}</span>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div style={{ padding: "16px 24px" }}>
          <Row label={`Subtotal (${itemCount} item${itemCount !== 1 ? "s" : ""})`} value={fmt(subtotal)} />
          {discount > 0 && (
            <Row
              label={`Discount${sale.discountType === "percent" && sale.discountInput != null ? ` (${sale.discountInput}%)` : ""}`}
              value={`−${fmt(discount)}`}
              color="#059669"
              icon={<Tag size={11} color="#059669" />}
            />
          )}
          {flatDisc > 0 && (
            <Row label="Flat Discount" value={`−${fmt(flatDisc)}`} color="#059669" icon={<Tag size={11} color="#059669" />} />
          )}
          {tax > 0 && (
            <Row
              label={`${sale.taxType === "inclusive" ? "Incl. " : ""}${sale.taxName || "Tax"}${sale.taxRate ? ` (${sale.taxRate}%)` : ""}`}
              value={fmt(tax)}
            />
          )}

          {/* Grand total */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "2px solid #18181b" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#18181b" }}>TOTAL</span>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#18181b", fontFamily: "monospace" }}>{fmt(sale.total)}</span>
          </div>

          <Row label="Payment" value={(sale.paymentMethod || "Cash").replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())} muted />

          {cashRec > 0 && <>
            <Row label="Cash Received" value={fmt(cashRec)} muted />
            <Row label="Change" value={fmt(change)} muted />
          </>}
        </div>

        {/* Note */}
        {sale.note && (
          <div style={{ margin: "0 24px 16px", padding: "10px 14px", background: "#fafafa", borderRadius: 10, border: "1px solid #f0f0f0" }}>
            <p style={styles.label}>NOTE</p>
            <p style={{ fontSize: 12, color: "#52525b", fontStyle: "italic", marginTop: 2 }}>{sale.note}</p>
          </div>
        )}

        {/* Divider + footer */}
        <div style={{ borderTop: "1px dashed #e4e4e7", padding: "20px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#71717a", marginBottom: 4 }}>
            {store?.receiptFooter || "Thank you for your business!"}
          </p>
          <p style={{ fontSize: 11, color: "#a1a1aa" }}>Powered by ProPOS</p>
        </div>
      </div>

      {/* Verification footer */}
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 12 }}>
        <ShieldCheck size={16} color="#059669" />
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>Receipt Verified</p>
          <p style={{ fontSize: 11, color: "#065f46" }}>This receipt is authentic and recorded in our system.</p>
        </div>
      </div>
    </div>
  );
};

/* ── Small helpers ── */
const Row: React.FC<{
  label: string; value: string; color?: string; icon?: React.ReactNode; muted?: boolean;
}> = ({ label, value, color, icon, muted }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: muted ? "#a1a1aa" : color || "#71717a" }}>
      {icon}{label}
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: color || (muted ? "#a1a1aa" : "#3f3f46"), fontFamily: "monospace" }}>
      {value}
    </span>
  </div>
);

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f4f5",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "32px 16px 64px",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    background: "#d1fae5",
    border: "1px solid #6ee7b7",
    borderRadius: 100,
    padding: "7px 16px",
    marginBottom: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "#ffffff",
    borderRadius: 20,
    boxShadow: "0 2px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    color: "#a1a1aa",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
    color: "#a1a1aa",
    marginTop: 2,
    lineHeight: 1.4,
  },
} as const;

export default PublicReceipt;
