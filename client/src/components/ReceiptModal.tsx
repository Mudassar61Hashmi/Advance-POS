import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  X, Printer, CheckCircle2, Package,
  User as UserIcon, Receipt, Tag,
} from "lucide-react";
import { useAppSettings } from "../hooks/useAppSettings";

interface SaleItem {
  id:         string;
  name:       string;
  quantity:   number;
  price:      number;
  lineTotal?: number;
}

interface Sale {
  id:           string;
  invoiceNumber?: string;
  cashier:      string;
  customerName?: string;
  paymentMethod?: string;
  cashReceived?: number;
  change?: number;
  subtotal?:    number;
  discount?:    number;
  discountType?: "fixed" | "percent";
  tax?:         number;
  taxName?:     string;
  taxRate?:     number;
  total:        number;
  note?:        string;
  timestamp:    string;
  items:        SaleItem[];
}

interface ReceiptModalProps {
  sale:    Sale;
  onClose: () => void;
}


/* QR code encodes a small JSON blob so it's machine-readable */
const buildQRData = (sale: Sale) =>
  JSON.stringify({
    inv:      String(sale.id).slice(-8).toUpperCase(),
    total:    sale.total,
    items:    sale.items.length,
    cashier:  sale.cashier,
    ts:       sale.timestamp,
  });

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const { formatCurrency, formatDate, formatTime, storeName, storeAddress, storePhone, receiptFooter, showQRCode, autoPrint } = useAppSettings();
  const fmt = formatCurrency;
  const printRef  = useRef<HTMLDivElement>(null);
  const qrRef     = useRef<HTMLDivElement>(null);
  const didAutoPrint = useRef(false);
  const logoDataUrl = (() => { try { return localStorage.getItem("pos_logo") || ""; } catch { return ""; } })();
  const invoiceNo   = sale.invoiceNumber || String(sale.id).slice(-8).toUpperCase();
  const itemCount = sale.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal     = sale.subtotal     ?? sale.total;
  const discount     = sale.discount     ?? 0;
  const tax          = sale.tax          ?? 0;
  const cashReceived = sale.cashReceived ?? 0;
  const change       = sale.change       ?? 0;

  useEffect(() => {
    if (autoPrint && !didAutoPrint.current) {
      didAutoPrint.current = true;
      const t = setTimeout(() => handlePrint(), 500);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Print: opens a proper 80mm thermal receipt window ── */
  const handlePrint = () => {
    const w = window.open("", "_blank", "width=380,height=720");
    if (!w) return;

    const itemRows = sale.items.map(item => {
      const lt = item.lineTotal ?? item.price * item.quantity;
      return `<tr>
        <td class="name">${item.name}</td>
        <td class="qty">${item.quantity}</td>
        <td class="price">${fmt(item.price)}</td>
        <td class="total">${fmt(lt)}</td>
      </tr>`;
    }).join("");

    /* Capture QR SVG via dedicated ref so we always get the right element */
    const rawSvg  = showQRCode ? (qrRef.current?.querySelector("svg") ?? null) : null;
    let   qrSvg   = "";
    if (rawSvg) {
      const clone = rawSvg.cloneNode(true) as SVGElement;
      clone.setAttribute("width",  "120");
      clone.setAttribute("height", "120");
      clone.style.display = "block";
      clone.style.margin  = "6px auto 0";
      qrSvg = clone.outerHTML;
    }

    w.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<title>Invoice #${invoiceNo}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',Courier,monospace; font-size:11.5px; color:#000; background:#fff; width:80mm; padding:6mm 5mm 10mm; }
  .center { text-align:center; }
  .right  { text-align:right; }
  .bold   { font-weight:bold; }
  .muted  { color:#555; }
  .xs     { font-size:9.5px; color:#555; }
  .dash   { border:none; border-top:1px dashed #999; margin:6px 0; }
  .solid  { border:none; border-top:2px solid #000; margin:6px 0; }
  .store  { font-size:18px; font-weight:bold; letter-spacing:1px; margin-bottom:3px; }
  table   { width:100%; border-collapse:collapse; margin:4px 0; }
  thead th{ font-size:9px; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #ccc; padding:3px 1px; }
  th.name,td.name { text-align:left; max-width:110px; word-break:break-word; }
  th.qty, td.qty  { text-align:center; width:22px; }
  th.price,td.price,th.total,td.total { text-align:right; }
  td { padding:3.5px 1px; font-size:11px; vertical-align:top; }
  .row    { display:flex; justify-content:space-between; padding:2px 0; font-size:11px; }
  .row.discount { color:#166534; }
  .row.grand    { font-weight:bold; font-size:14px; padding-top:5px; border-top:2px solid #000; margin-top:4px; }
  svg     { display:block; margin:6px auto 0; }
  .footer { text-align:center; font-size:9.5px; color:#666; margin-top:8px; }
  .cut    { border-top:1px dashed #bbb; margin-top:12px; padding-top:5px; text-align:center; font-size:9px; color:#bbb; letter-spacing:2px; }
  @media print { body { padding:0; } }
</style>
</head><body>
<div class="center" style="margin-bottom:8px">
  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="logo" style="max-width:80px;max-height:60px;object-fit:contain;margin:0 auto 6px;display:block;"/>` : ""}
  <div class="store">${storeName || "ProPOS"}</div>
  ${storeAddress ? `<div class="xs">${storeAddress}</div>` : ""}
  ${storePhone   ? `<div class="xs">${storePhone}</div>`   : ""}
</div>
<hr class="solid"/>
<div style="display:flex;justify-content:space-between;margin:4px 0">
  <span class="xs">Invoice: <strong>#${invoiceNo}</strong></span>
  <span class="xs">${formatDate(sale.timestamp)} ${formatTime(sale.timestamp)}</span>
</div>
<div style="display:flex;justify-content:space-between;margin:4px 0">
  <span class="xs">Customer: <strong>${sale.customerName || "Walk-in"}</strong></span>
  <span class="xs">Cashier: <strong>${sale.cashier}</strong></span>
</div>
<hr class="dash"/>
<table>
  <thead><tr>
    <th class="name">Item</th><th class="qty">Qty</th>
    <th class="price">Rate</th><th class="total">Total</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr class="dash"/>
<div class="row muted"><span>Payment</span><span class="bold">${(sale.paymentMethod || "Cash").toUpperCase()}</span></div>
<div class="row muted"><span>Subtotal (${itemCount} item${itemCount !== 1 ? "s" : ""})</span><span>${fmt(subtotal)}</span></div>
${discount > 0 ? `<div class="row discount"><span>Discount${sale.discountType === "percent" ? ` (${sale.discount}%)` : ""}</span><span>-${fmt(discount)}</span></div>` : ""}
${tax > 0 ? `<div class="row muted"><span>${sale.taxName || "Tax"}${sale.taxRate ? ` (${sale.taxRate}%)` : ""}</span><span>${fmt(tax)}</span></div>` : ""}
<div class="row grand"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
${cashReceived > 0 ? `
<div class="row muted" style="margin-top:4px"><span>Cash Received</span><span>${fmt(cashReceived)}</span></div>
<div class="row muted"><span>Change</span><span>${fmt(change)}</span></div>` : ""}
${discount > 0 ? `<div style="text-align:right;font-size:10px;color:#166534;margin-top:3px">You saved ${fmt(discount)} 🎉</div>` : ""}
${sale.note ? `<hr class="dash"/><div class="xs">Note: ${sale.note}</div>` : ""}
<hr class="dash"/>
<div class="center xs" style="margin-bottom:3px">Scan to Verify</div>
${qrSvg}
<div class="center xs" style="margin-top:4px">#${invoiceNo} · ${fmt(sale.total)}</div>
<div class="footer">
  <div class="bold" style="font-size:11px;margin-bottom:2px">${receiptFooter || "Thank you for your business!"}</div>
  <div>Powered by ProPOS</div>
</div>
<div class="cut">✂ &nbsp; CUT HERE &nbsp; ✂</div>
<script>window.onload=function(){setTimeout(function(){window.print();},280);}</script>
</body></html>`);
    w.document.close();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => e.target === e.currentTarget && onClose()}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{   opacity: 0, y: 14, scale: 0.97  }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col"
          style={{ maxWidth: 460, maxHeight: "92vh" }}
        >
          {/* ── Modal header ── */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={18} className="text-white" />
              </div>
              <div>
                <p className="font-black text-zinc-900 text-sm">Payment Successful</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">Invoice #{invoiceNo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
              >
                <Printer size={13} /> Print
              </motion.button>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* ── Scrollable receipt body ── */}
          <div className="overflow-y-auto flex-1 px-6 py-5" ref={printRef}>

            {/* Store header */}
            <div className="text-center mb-5 receipt-print">
              {logoDataUrl && (
                <img src={logoDataUrl} alt="logo" className="mx-auto mb-2 object-contain" style={{ maxWidth:80, maxHeight:60 }}/>
              )}
              <div className="flex items-center justify-center gap-2 mb-1">
                <Receipt size={16} className="text-zinc-400" />
                <span className="font-black text-base text-zinc-900 tracking-tight">{storeName || "ProPOS Terminal"}</span>
              </div>
              {storeAddress && <p className="text-[10px] text-zinc-400 font-mono">{storeAddress}</p>}
              {storePhone && <p className="text-[10px] text-zinc-400 font-mono">{storePhone}</p>}
              <p className="text-[10px] text-zinc-400 font-mono">Invoice #{invoiceNo}</p>
              <p className="text-[10px] text-zinc-400 font-mono">{formatDate(sale.timestamp)} · {formatTime(sale.timestamp)}</p>
            </div>

            {/* Dashed divider */}
            <div className="border-t border-dashed border-zinc-200 mb-4" />

            {/* Customer + Cashier */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserIcon size={12} className="text-zinc-400" />
                <div>
                  <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Customer</p>
                  <p className="text-xs font-bold text-zinc-900">{sale.customerName || "Walk-in Customer"}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Cashier</p>
                <p className="text-xs font-bold text-zinc-900">{sale.cashier}</p>
              </div>
            </div>

            {/* Items header */}
            <div className="grid grid-cols-12 gap-1 mb-2 pb-2 border-b border-zinc-100">
              <p className="col-span-5 text-[9px] font-bold uppercase tracking-widest text-zinc-400">Item</p>
              <p className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400 text-right">Qty</p>
              <p className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-zinc-400 text-right">Price</p>
              <p className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 text-right">Total</p>
            </div>

            {/* Items list */}
            <div className="space-y-2 mb-4">
              {sale.items.map((item, i) => {
                const lineTotal = item.lineTotal ?? item.price * item.quantity;
                return (
                  <div key={item.id ?? i} className="grid grid-cols-12 gap-1 items-center">
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package size={10} className="text-zinc-400" />
                      </div>
                      <p className="text-xs font-semibold text-zinc-900 truncate">{item.name}</p>
                    </div>
                    <p className="col-span-2 text-xs text-zinc-600 font-mono text-right">{item.quantity}</p>
                    <p className="col-span-2 text-xs text-zinc-600 font-mono text-right">{fmt(item.price)}</p>
                    <p className="col-span-3 text-xs font-bold text-zinc-900 font-mono text-right">{fmt(lineTotal)}</p>
                  </div>
                );
              })}
            </div>

            {/* Totals block */}
            <div className="border-t border-dashed border-zinc-200 pt-4 space-y-2">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Payment Method</span>
                <span className="font-semibold uppercase">{sale.paymentMethod || "cash"}</span>
              </div>

              <div className="flex justify-between text-xs text-zinc-500">
                <span>Subtotal ({itemCount} item{itemCount !== 1 ? "s" : ""})</span>
                <span className="font-semibold font-mono">{fmt(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <Tag size={10} />
                    Discount{sale.discountType === "percent" ? ` (${sale.discount}%)` : ""}
                  </span>
                  <span className="font-mono">−{fmt(discount)}</span>
                </div>
              )}

              {tax > 0 && (
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>{sale.taxName ? `${sale.taxName}` : "Tax"}{sale.taxRate ? ` (${sale.taxRate}%)` : ""}</span>
                  <span className="font-mono">{fmt(tax)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-zinc-200">
                <span className="text-sm font-black text-zinc-900">TOTAL</span>
                <span className="text-2xl font-black text-zinc-900 font-mono">{fmt(sale.total)}</span>
              </div>

              {cashReceived > 0 && (
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Cash Received</span>
                  <span className="font-semibold font-mono">{fmt(cashReceived)}</span>
                </div>
              )}
              {(cashReceived > 0 || change > 0) && (
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Change</span>
                  <span className="font-semibold font-mono">{fmt(change)}</span>
                </div>
              )}

              {discount > 0 && (
                <p className="text-[10px] text-emerald-600 font-bold text-right">
                  You saved {fmt(discount)} on this order 🎉
                </p>
              )}
            </div>

            {/* Note */}
            {sale.note && (
              <div className="mt-4 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Note</p>
                <p className="text-xs text-zinc-600 italic">{sale.note}</p>
              </div>
            )}

            {/* QR Code */}
            {showQRCode && (
              <div className="mt-6 border-t border-dashed border-zinc-200 pt-5 flex flex-col items-center gap-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Scan to Verify</p>
                <div ref={qrRef} className="p-3 bg-white border-2 border-zinc-100 rounded-2xl shadow-sm">
                  <QRCodeSVG
                    value={buildQRData(sale)}
                    size={120}
                    bgColor="#ffffff"
                    fgColor="#18181b"
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 font-mono text-center">
                  #{invoiceNo} · {fmt(sale.total)}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 border-t border-dashed border-zinc-200 pt-4 text-center">
              <p className="text-[10px] font-bold text-zinc-400">{receiptFooter || "Thank you for your business!"}</p>
              <p className="text-[9px] text-zinc-300 mt-1">Powered by ProPOS · Keep this receipt for your records</p>
            </div>

          </div>

          {/* ── Action bar ── */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-100 flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-2xl text-sm font-bold hover:bg-zinc-200 transition-all">
              Close
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handlePrint}
              className="flex-[2] py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-black/10"
            >
              <Printer size={15} /> Print Receipt
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};