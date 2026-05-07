import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Package, Users, History, CreditCard,
  Download, Upload, Check, X, AlertTriangle,
  RefreshCw, Loader2, Database, FileSpreadsheet,
  ArrowDownToLine, ArrowUpFromLine, Eye, Trash2,
} from "lucide-react";
import { useAppSettings } from "../hooks/useAppSettings";
import { useThemeConfig, getPresetPalette } from "../theme";

/* ══════════════════════════════════════════════
   CSV UTILITIES
══════════════════════════════════════════════ */
function toCSV(headers: string[], rows: unknown[][]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
}

function dlCSV(name: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob), download: name,
  });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(a.href);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const parse = (l: string) => {
    const r: string[] = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { q && l[i + 1] === '"' ? (cur += '"', i++) : (q = !q); }
      else if (c === "," && !q) { r.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    r.push(cur.trim()); return r;
  };
  const headers = parse(lines[0]);
  return lines.slice(1)
    .filter(l => l.replace(/,/g, "").trim())
    .map(l => {
      const vals = parse(l);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
}

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
type DataTab = "products" | "customers" | "sales" | "payments";
interface ImportResult { created: number; updated: number; failed: number; errors: string[] }

const TABS: { key: DataTab; label: string; icon: React.ElementType; color: string; canImport: boolean }[] = [
  { key: "products",  label: "Products",  icon: Package,     color: "#a78bfa", canImport: true  },
  { key: "customers", label: "Customers", icon: Users,       color: "#fb923c", canImport: true  },
  { key: "sales",     label: "Sales",     icon: History,     color: "#34d399", canImport: false },
  { key: "payments",  label: "Payments",  icon: CreditCard,  color: "#22d3ee", canImport: false },
];

const PRODUCT_TEMPLATE_HEADERS = ["name","barcode","category","price","cost","quantity","lowStockThreshold"];
const CUSTOMER_TEMPLATE_HEADERS = ["name","phone","email"];

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export const DataManager: React.FC = () => {
  const { formatCurrency, formatDate } = useAppSettings();
  const { preset, isDark, customPalette } = useThemeConfig();
  const palette = getPresetPalette(preset, customPalette);
  const dark = isDark;

  const ui = dark ? {
    page:"#0b1220", card:"#131d32", cardAlt:"#0f1728",
    border:"#1e2d46", text:"#e6edf8", muted:"#7a8fa8", sub:"#9db0cf",
    input:"#0d1525", inputBorder:"#1e2d46", divider:"rgba(255,255,255,0.06)",
    shadow:"0 16px 40px rgba(0,0,0,0.35)",
  } : {
    page:"#f1f5fb", card:"#ffffff", cardAlt:"#f7f9fd",
    border:"#dde5f0", text:"#0f1e38", muted:"#5c6f8e", sub:"#7a8fa8",
    input:"#f7f9fd", inputBorder:"#dde5f0", divider:"rgba(15,23,42,0.06)",
    shadow:"0 8px 24px rgba(15,23,42,0.08)",
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  React.useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const [tab, setTab]                     = useState<DataTab>("products");
  const [exporting, setExporting]         = useState(false);
  const [importing, setImporting]         = useState(false);
  const [importRows, setImportRows]       = useState<Record<string, string>[]>([]);
  const [importFile, setImportFile]       = useState<string>("");
  const [importResult, setImportResult]   = useState<ImportResult | null>(null);
  const [dragOver, setDragOver]           = useState(false);
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);
  const [showPreview, setShowPreview]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const showMsg = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const getToken = () => {
    try { return JSON.parse(localStorage.getItem("pos_user") || "{}")?.token || ""; } catch { return ""; }
  };

  /* ── Reset import state when tab changes ── */
  const switchTab = (t: DataTab) => {
    setTab(t); setImportRows([]); setImportFile(""); setImportResult(null); setShowPreview(false);
  };

  /* ── Parse a dropped/selected file ── */
  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      showMsg("Please upload a .csv file", false); return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (!rows.length) { showMsg("File is empty or has no valid rows", false); return; }
      setImportRows(rows); setImportFile(file.name); setImportResult(null); setShowPreview(true);
    };
    reader.readAsText(file, "utf-8");
  };

  /* ── EXPORT handlers ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      if (tab === "products") {
        const res  = await fetch("/api/products", { headers });
        const data = await res.json() as any[];
        const csv  = toCSV(
          ["name","barcode","category","price","quantity","lowStockThreshold"],
          data.map(p => [p.name, p.barcode || "", p.category || "", p.price, p.quantity, p.lowStockThreshold || 10])
        );
        dlCSV(`products_${new Date().toISOString().slice(0,10)}.csv`, csv);
        showMsg(`Exported ${data.length} products`);

      } else if (tab === "customers") {
        const res  = await fetch("/api/customers?limit=5000", { headers });
        const data = await res.json() as any[];
        const rows = Array.isArray(data) ? data : (data.customers || []);
        const csv  = toCSV(
          ["name","phone","email","createdAt"],
          rows.map((c: any) => [c.name, c.phone || "", c.email || "", formatDate(c.createdAt)])
        );
        dlCSV(`customers_${new Date().toISOString().slice(0,10)}.csv`, csv);
        showMsg(`Exported ${rows.length} customers`);

      } else if (tab === "sales") {
        const res  = await fetch("/api/sales?limit=5000", { headers });
        const data = await res.json() as any[];
        const rows = Array.isArray(data) ? data : [];
        const csv  = toCSV(
          ["invoiceNumber","date","cashier","customerName","paymentMethod","subtotal","discount","tax","total","status","itemCount"],
          rows.map((s: any) => [
            s.invoiceNumber || s._id?.slice(-8) || "",
            formatDate(s.createdAt || s.timestamp),
            s.cashier || "",
            s.customerName || "Walk-in",
            s.paymentMethod || "cash",
            s.subtotal || s.total,
            s.discount || 0,
            s.tax || 0,
            s.total,
            s.status || "completed",
            s.items?.length || s.itemCount || 0,
          ])
        );
        dlCSV(`sales_${new Date().toISOString().slice(0,10)}.csv`, csv);
        showMsg(`Exported ${rows.length} sales`);

      } else if (tab === "payments") {
        const res  = await fetch("/api/payments?limit=5000", { headers });
        const data = await res.json() as any[];
        const rows = Array.isArray(data) ? data : [];
        const csv  = toCSV(
          ["date","transactionRef","methodName","methodType","amount","processingFee","netAmount","customerName","status","note"],
          rows.map((p: any) => [
            formatDate(p.createdAt),
            p.transactionRef || "",
            p.methodName || "",
            p.methodType || "",
            p.amount,
            p.processingFee || 0,
            p.netAmount || p.amount,
            p.customerName || "Walk-in",
            p.status || "completed",
            p.note || "",
          ])
        );
        dlCSV(`payments_${new Date().toISOString().slice(0,10)}.csv`, csv);
        showMsg(`Exported ${rows.length} payments`);
      }
    } catch (e: any) {
      showMsg(e?.message || "Export failed", false);
    } finally {
      setExporting(false);
    }
  };

  /* ── TEMPLATE download ── */
  const handleTemplate = () => {
    if (tab === "products") {
      dlCSV("products_template.csv", toCSV(PRODUCT_TEMPLATE_HEADERS, [
        ["Sample Product", "1234567890", "General", "9.99", "0.00", "50", "5"],
        ["Another Item",   "0987654321", "Electronics", "49.99", "30.00", "10", "3"],
      ]));
    } else if (tab === "customers") {
      dlCSV("customers_template.csv", toCSV(CUSTOMER_TEMPLATE_HEADERS, [
        ["Ahmed Khan",  "+92-300-0000000", "ahmed@example.com"],
        ["Sara Malik",  "+92-321-1111111", ""],
      ]));
    }
  };

  /* ── IMPORT handler ── */
  const handleImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const endpoint = tab === "products" ? "/api/import/products" : "/api/import/customers";
      const token = getToken();
      const res  = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ records: importRows }),
      });
      const data = await res.json() as ImportResult;
      if (!res.ok) throw new Error((data as any).message || "Import failed");
      setImportResult(data);
      showMsg(`Import complete: ${data.created} created, ${data.updated} updated`, data.failed === 0);
    } catch (e: any) {
      showMsg(e?.message || "Import failed", false);
    } finally {
      setImporting(false);
    }
  };

  /* ── Clear import ── */
  const clearImport = () => {
    setImportRows([]); setImportFile(""); setImportResult(null); setShowPreview(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const tabMeta = TABS.find(t => t.key === tab)!;

  return (
    <div style={{ height:"100%", overflowY:"auto", background:ui.page, fontFamily:"var(--theme-font,'Sora','DM Sans',system-ui,sans-serif)" }}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:16 }}
            style={{ position:"fixed", bottom:24, right:24, zIndex:2000, padding:"12px 18px", borderRadius:16,
              display:"flex", alignItems:"center", gap:10,
              background: toast.ok ? `${palette.accent}18` : "rgba(239,68,68,0.12)",
              border: `1px solid ${toast.ok ? palette.accent + "44" : "rgba(239,68,68,0.3)"}`,
              boxShadow:"0 14px 32px rgba(0,0,0,0.18)", backdropFilter:"blur(12px)" }}>
            {toast.ok ? <Check size={14} style={{ color:palette.accent }}/> : <X size={14} style={{ color:"#ef4444" }}/>}
            <span style={{ fontSize:13, fontWeight:700, color: toast.ok ? palette.accent : "#ef4444" }}>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding:isMobile?"14px 14px 32px":"28px 28px 40px", maxWidth:1100, margin:"0 auto", display:"flex", flexDirection:"column", gap:24 }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Database size={20} style={{ color:palette.accent }}/>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:24, fontWeight:800, color:ui.text, letterSpacing:-0.4 }}>Data Manager</h1>
            <p style={{ margin:"3px 0 0", fontSize:12, color:ui.muted }}>Export records to CSV or bulk-import from a spreadsheet</p>
          </div>
        </div>

        {/* Tab selector */}
        <div style={{ display:"flex", gap:8 }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <motion.button key={t.key} whileTap={{ scale:0.97 }} onClick={() => switchTab(t.key)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderRadius:14,
                  border:`2px solid ${active ? t.color : ui.border}`,
                  background: active ? `${t.color}14` : ui.card,
                  color: active ? t.color : ui.muted,
                  cursor:"pointer", fontSize:13, fontWeight:700, transition:"all 0.2s" }}>
                <Icon size={15}/>
                {t.label}
              </motion.button>
            );
          })}
        </div>

        {/* Content grid */}
        <div style={{ display:"grid", gridTemplateColumns: (isMobile || !tabMeta.canImport) ? "1fr" : "1fr 1fr", gap:20 }}>

          {/* ── EXPORT CARD ── */}
          <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:26, boxShadow:ui.shadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
              <div style={{ width:36, height:36, borderRadius:12, background:`${tabMeta.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <ArrowDownToLine size={16} style={{ color:tabMeta.color }}/>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Export {tabMeta.label}</div>
                <div style={{ fontSize:11, color:ui.muted }}>Download all records as a CSV file</div>
              </div>
            </div>

            {/* What's included */}
            <div style={{ padding:"14px 16px", borderRadius:14, background:ui.cardAlt, border:`1px solid ${ui.divider}`, marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:ui.muted, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>
                Fields included
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {(tab === "products"  ? ["name","barcode","category","price","quantity","lowStockThreshold"]
                : tab === "customers" ? ["name","phone","email","createdAt"]
                : tab === "sales"     ? ["invoiceNumber","date","cashier","customer","payment","subtotal","discount","tax","total","status"]
                :                      ["date","reference","method","amount","fee","net","customer","status","note"]
                ).map(f => (
                  <span key={f} style={{ padding:"3px 10px", borderRadius:8, background:`${tabMeta.color}14`, color:tabMeta.color, fontSize:10, fontWeight:700 }}>{f}</span>
                ))}
              </div>
            </div>

            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={handleExport} disabled={exporting}
              style={{ width:"100%", padding:"13px", borderRadius:16, border:"none", cursor:exporting?"wait":"pointer",
                fontSize:13, fontWeight:800, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                background:`linear-gradient(135deg,${tabMeta.color},${tabMeta.color}cc)`,
                boxShadow:`0 8px 24px ${tabMeta.color}33`, opacity:exporting?0.7:1 }}>
              {exporting ? <><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>Exporting…</> : <><Download size={16}/>Download CSV</>}
            </motion.button>

            {tabMeta.canImport && (
              <button onClick={handleTemplate}
                style={{ width:"100%", marginTop:10, padding:"11px", borderRadius:14, border:`1px dashed ${ui.border}`,
                  cursor:"pointer", fontSize:12, fontWeight:700, color:ui.muted, background:"transparent",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <FileSpreadsheet size={14}/> Download Import Template
              </button>
            )}
          </div>

          {/* ── IMPORT CARD ── */}
          {tabMeta.canImport && (
            <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:26, boxShadow:ui.shadow }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
                <div style={{ width:36, height:36, borderRadius:12, background:`${tabMeta.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <ArrowUpFromLine size={16} style={{ color:tabMeta.color }}/>
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Import {tabMeta.label}</div>
                  <div style={{ fontSize:11, color:ui.muted }}>Upload CSV to create or update records</div>
                </div>
              </div>

              {!importRows.length ? (
                /* Drop zone */
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileRef.current?.click()}
                  style={{ padding:"32px 24px", borderRadius:16, border:`2px dashed ${dragOver ? tabMeta.color : ui.border}`,
                    background: dragOver ? `${tabMeta.color}08` : ui.cardAlt,
                    cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}>
                  <Upload size={28} style={{ color: dragOver ? tabMeta.color : ui.muted, margin:"0 auto 12px", display:"block" }}/>
                  <div style={{ fontSize:14, fontWeight:700, color: dragOver ? tabMeta.color : ui.text, marginBottom:4 }}>
                    Drop CSV file here
                  </div>
                  <div style={{ fontSize:11, color:ui.muted }}>or click to browse • UTF-8 encoded CSV</div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display:"none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
                </div>
              ) : (
                /* File loaded state */
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

                  {/* File info bar */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:12,
                    background:`${tabMeta.color}10`, border:`1px solid ${tabMeta.color}30` }}>
                    <FileSpreadsheet size={16} style={{ color:tabMeta.color, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:ui.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{importFile}</div>
                      <div style={{ fontSize:10, color:ui.muted }}>{importRows.length} rows detected</div>
                    </div>
                    <button onClick={clearImport} style={{ border:"none", background:"none", cursor:"pointer", padding:4, borderRadius:6 }}>
                      <Trash2 size={14} style={{ color:"#ef4444" }}/>
                    </button>
                  </div>

                  {/* Preview toggle */}
                  <button onClick={() => setShowPreview(v => !v)}
                    style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:10, border:`1px solid ${ui.border}`,
                      background:"transparent", cursor:"pointer", fontSize:11, fontWeight:700, color:ui.muted }}>
                    <Eye size={12}/>{showPreview ? "Hide" : "Show"} preview (first 5 rows)
                  </button>

                  {/* Preview table */}
                  <AnimatePresence>
                    {showPreview && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                        style={{ overflow:"hidden" }}>
                        <div style={{ overflowX:"auto", borderRadius:12, border:`1px solid ${ui.border}` }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                            <thead>
                              <tr style={{ background:ui.cardAlt }}>
                                {Object.keys(importRows[0]).map(h => (
                                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontWeight:700, color:ui.muted, whiteSpace:"nowrap", borderBottom:`1px solid ${ui.border}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {importRows.slice(0, 5).map((row, i) => (
                                <tr key={i} style={{ borderBottom:`1px solid ${ui.divider}` }}>
                                  {Object.values(row).map((val, j) => (
                                    <td key={j} style={{ padding:"7px 12px", color:ui.text, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{val || <span style={{ color:ui.muted }}>—</span>}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importRows.length > 5 && (
                            <div style={{ padding:"8px 12px", fontSize:10, color:ui.muted, borderTop:`1px solid ${ui.border}` }}>
                              +{importRows.length - 5} more rows not shown
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Import result */}
                  <AnimatePresence>
                    {importResult && (
                      <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                        style={{ padding:"14px 16px", borderRadius:14,
                          background: importResult.failed > 0 ? "rgba(245,158,11,0.08)" : "rgba(52,211,153,0.08)",
                          border: `1px solid ${importResult.failed > 0 ? "rgba(245,158,11,0.3)" : "rgba(52,211,153,0.3)"}` }}>
                        <div style={{ display:"flex", gap:16, marginBottom: importResult.errors.length ? 10 : 0 }}>
                          {[
                            { label:"Created", val:importResult.created, color:"#34d399" },
                            { label:"Updated", val:importResult.updated, color:"#60a5fa" },
                            { label:"Failed",  val:importResult.failed,  color:"#f87171" },
                          ].map(s => (
                            <div key={s.label} style={{ textAlign:"center" }}>
                              <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.val}</div>
                              <div style={{ fontSize:9, fontWeight:700, color:ui.muted, textTransform:"uppercase", letterSpacing:1 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>
                        {importResult.errors.length > 0 && (
                          <div style={{ fontSize:10, color:"#f59e0b" }}>
                            {importResult.errors.slice(0,3).map((e, i) => <div key={i}>• {e}</div>)}
                            {importResult.errors.length > 3 && <div>…and {importResult.errors.length - 3} more</div>}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Import button */}
                  {!importResult && (
                    <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={handleImport} disabled={importing}
                      style={{ width:"100%", padding:"13px", borderRadius:16, border:"none", cursor:importing?"wait":"pointer",
                        fontSize:13, fontWeight:800, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                        background:`linear-gradient(135deg,${tabMeta.color},${tabMeta.color}cc)`,
                        boxShadow:`0 8px 24px ${tabMeta.color}33`, opacity:importing?0.7:1 }}>
                      {importing
                        ? <><Loader2 size={16} style={{ animation:"spin 1s linear infinite" }}/>Importing {importRows.length} rows…</>
                        : <><Upload size={16}/>Import {importRows.length} {tabMeta.label}</>}
                    </motion.button>
                  )}

                  {importResult && (
                    <button onClick={clearImport}
                      style={{ width:"100%", padding:"11px", borderRadius:14, border:`1px solid ${ui.border}`,
                        cursor:"pointer", fontSize:12, fontWeight:700, color:ui.muted, background:ui.cardAlt,
                        display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                      <RefreshCw size={13}/> Import another file
                    </button>
                  )}
                </div>
              )}

              {/* Rules hint */}
              <div style={{ marginTop:14, padding:"12px 14px", borderRadius:12, background:ui.cardAlt, border:`1px solid ${ui.divider}` }}>
                <div style={{ fontSize:10, fontWeight:700, color:ui.muted, textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Import rules</div>
                {tab === "products" ? (
                  <ul style={{ margin:0, paddingLeft:14, fontSize:11, color:ui.sub, lineHeight:1.9 }}>
                    <li><strong>name</strong> (required), <strong>barcode</strong>, category, price, quantity</li>
                    <li>If barcode matches an existing product → <strong>updates</strong> it</li>
                    <li>Otherwise checks by exact name → updates or creates</li>
                    <li>Download the template for the correct column names</li>
                  </ul>
                ) : (
                  <ul style={{ margin:0, paddingLeft:14, fontSize:11, color:ui.sub, lineHeight:1.9 }}>
                    <li><strong>name</strong> and <strong>phone</strong> are required</li>
                    <li>If phone matches an existing customer → <strong>updates</strong> it</li>
                    <li>Otherwise creates a new customer</li>
                    <li>Download the template for the correct column names</li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick tips */}
        <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:22, boxShadow:ui.shadow }}>
          <div style={{ fontSize:13, fontWeight:800, color:ui.text, marginBottom:12 }}>Tips for CSV import</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:12 }}>
            {[
              { icon:"📥", title:"Use the template", desc:"Download the template first — it has the exact column names needed" },
              { icon:"💾", title:"Save as CSV", desc:"Export from Excel/Google Sheets as CSV (UTF-8 if available)" },
              { icon:"🔄", title:"Safe to re-import", desc:"Records are matched by barcode/phone and updated, not duplicated" },
            ].map((tip, i) => (
              <div key={i} style={{ padding:"14px", borderRadius:16, background:ui.cardAlt, border:`1px solid ${ui.divider}` }}>
                <div style={{ fontSize:20, marginBottom:6 }}>{tip.icon}</div>
                <div style={{ fontSize:12, fontWeight:800, color:ui.text, marginBottom:3 }}>{tip.title}</div>
                <div style={{ fontSize:11, color:ui.muted, lineHeight:1.5 }}>{tip.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
