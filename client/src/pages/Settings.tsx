import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Palette, User, Save, Monitor, Moon, Sun, Bell, Store,
  Check, RefreshCw,
  ShoppingBag, Package, Users, LogIn, AlertTriangle,
  CreditCard, ChevronDown, X, Zap,
  FileText, QrCode, Printer, Settings2, MessageCircle, Globe,
  Upload, Wand2, Image as ImageIcon, Sparkles, Search, Tag,
} from "lucide-react";
import {
  PRESET_CONFIGS, getPresetPalette, useThemeConfig,
  type ThemeMode, type ThemePreset, type PresetMeta,
} from "../theme";

/* ── Constants ──────────────────────────────────────── */
const CURRENCIES = [
  { code:"USD", symbol:"$",  name:"US Dollar" },
  { code:"EUR", symbol:"€",  name:"Euro" },
  { code:"GBP", symbol:"£",  name:"British Pound" },
  { code:"PKR", symbol:"₨", name:"Pakistani Rupee" },
  { code:"INR", symbol:"₹", name:"Indian Rupee" },
  { code:"AED", symbol:"د.إ",name:"UAE Dirham" },
  { code:"SAR", symbol:"﷼", name:"Saudi Riyal" },
  { code:"CAD", symbol:"CA$",name:"Canadian Dollar" },
  { code:"AUD", symbol:"A$", name:"Australian Dollar" },
  { code:"JPY", symbol:"¥",  name:"Japanese Yen" },
  { code:"CNY", symbol:"¥",  name:"Chinese Yuan" },
  { code:"BRL", symbol:"R$", name:"Brazilian Real" },
  { code:"MXN", symbol:"$",  name:"Mexican Peso" },
  { code:"SGD", symbol:"S$", name:"Singapore Dollar" },
  { code:"CHF", symbol:"Fr", name:"Swiss Franc" },
  { code:"HKD", symbol:"HK$",name:"Hong Kong Dollar" },
  { code:"SEK", symbol:"kr", name:"Swedish Krona" },
  { code:"NOK", symbol:"kr", name:"Norwegian Krone" },
  { code:"ZAR", symbol:"R",  name:"South African Rand" },
  { code:"NGN", symbol:"₦", name:"Nigerian Naira" },
  { code:"EGP", symbol:"£",  name:"Egyptian Pound" },
  { code:"KWD", symbol:"د.ك",name:"Kuwaiti Dinar" },
  { code:"QAR", symbol:"﷼", name:"Qatari Riyal" },
  { code:"TRY", symbol:"₺", name:"Turkish Lira" },
  { code:"THB", symbol:"฿", name:"Thai Baht" },
  { code:"IDR", symbol:"Rp", name:"Indonesian Rupiah" },
  { code:"MYR", symbol:"RM", name:"Malaysian Ringgit" },
  { code:"PHP", symbol:"₱", name:"Philippine Peso" },
  { code:"KRW", symbol:"₩", name:"South Korean Won" },
];

const TIMEZONES = [
  "UTC",
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "America/Toronto","America/Vancouver","America/Sao_Paulo","America/Mexico_City",
  "Europe/London","Europe/Paris","Europe/Berlin","Europe/Madrid",
  "Europe/Rome","Europe/Amsterdam","Europe/Stockholm","Europe/Moscow",
  "Asia/Dubai","Asia/Karachi","Asia/Kolkata","Asia/Dhaka",
  "Asia/Colombo","Asia/Bangkok","Asia/Singapore","Asia/Hong_Kong",
  "Asia/Shanghai","Asia/Tokyo","Asia/Seoul",
  "Australia/Sydney","Australia/Melbourne",
  "Pacific/Auckland","Pacific/Honolulu",
  "Africa/Cairo","Africa/Lagos","Africa/Johannesburg",
];

const DATE_FORMATS = ["MM/DD/YYYY","DD/MM/YYYY","YYYY-MM-DD","DD-MM-YYYY","MMM DD, YYYY"];

interface SettingsState {
  storeName:        string;
  storeAddress:     string;
  storePhone:       string;
  storeEmail:       string;
  taxNumber:        string;
  currency:         string;
  currencySymbol:   string;
  timezone:         string;
  dateFormat:       string;
  timeFormat:       "12h" | "24h";
  country:          string;
  state:            string;
  city:             string;
  notifyNewSale:    boolean;
  notifyLowStock:   boolean;
  notifyNewOrder:   boolean;
  notifyLogin:      boolean;
  notifyUserCreated:boolean;
  notifyRefund:     boolean;
  /* Receipt */
  receiptFooter:    string;
  showQRCode:       boolean;
  logoUrl:          string;
  autoPrint:        boolean;
  /* POS Behavior */
  lowStockThreshold:number;
  requireCustomer:  boolean;
  requireDiscountPin:boolean;
  defaultCategory:  string;
  /* Online / Contact */
  whatsappNumber:   string;
  websiteUrl:       string;
}

const DEFAULTS: SettingsState = {
  storeName:"My POS Store", storeAddress:"", storePhone:"", storeEmail:"", taxNumber:"",
  currency:"USD", currencySymbol:"$",
  timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } })(),
  dateFormat:"MM/DD/YYYY", timeFormat:"12h",
  country:"", state:"", city:"",
  notifyNewSale:true, notifyLowStock:true, notifyNewOrder:true,
  notifyLogin:false, notifyUserCreated:true, notifyRefund:true,
  receiptFooter:"Thank you for shopping with us!", showQRCode:true, logoUrl:"", autoPrint:false,
  lowStockThreshold:5, requireCustomer:false, requireDiscountPin:false, defaultCategory:"All",
  whatsappNumber:"", websiteUrl:"",
};

/* ── Theme Thumbnail ─────────────────────────────── */
const ThemeThumbnail: React.FC<{ cfg: PresetMeta; dark: boolean }> = ({ cfg, dark }) => {
  const bg      = dark ? cfg.darkBg : cfg.lightBg;
  const sidebar = dark ? "rgba(15,18,28,0.82)" : "rgba(255,255,255,0.88)";
  const card    = dark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.95)";
  const border  = dark ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.07)";
  const bar     = dark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.45)";
  const barDim  = dark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.15)";
  const { accent, accentSoft, accentAlt } = cfg.palette;

  return (
    <div style={{
      width:"100%", aspectRatio:"16/9", borderRadius:10, overflow:"hidden",
      background:`radial-gradient(circle at 18% 22%,${cfg.ambientA}38,transparent 48%),radial-gradient(circle at 82% 78%,${cfg.ambientB}30,transparent 48%),${bg}`,
      display:"flex", padding:7, gap:5, boxSizing:"border-box",
    }}>
      {/* Mini sidebar */}
      <div style={{ width:30, borderRadius:7, background:sidebar, border:`1px solid ${border}`, display:"flex", flexDirection:"column", alignItems:"center", padding:"5px 3px", gap:4, flexShrink:0 }}>
        <div style={{ width:16, height:16, borderRadius:5, background:`linear-gradient(135deg,${accent},${accentSoft})`, marginBottom:3, flexShrink:0 }}/>
        {[accent,barDim,barDim,barDim].map((c,i)=>(
          <div key={i} style={{ width:"88%", height:7, borderRadius:4, background:i===0?`${accent}22`:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:c, opacity:i===0?1:0.45 }}/>
          </div>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:3, height:10, flexShrink:0 }}>
          <div style={{ height:4, width:"32%", borderRadius:3, background:bar }}/>
          <div style={{ flex:1 }}/>
          <div style={{ width:18, height:7, borderRadius:4, background:`${accent}44` }}/>
          <div style={{ width:7, height:7, borderRadius:"50%", background:`${accent}66` }}/>
        </div>
        {/* KPI cards */}
        <div style={{ display:"flex", gap:3, flexShrink:0 }}>
          {[accent,accentSoft,"#22c55e",accentAlt].map((c,i)=>(
            <div key={i} style={{ flex:1, height:20, borderRadius:4, background:card, border:`1px solid ${border}`, padding:"2px 3px", boxSizing:"border-box" }}>
              <div style={{ height:2, width:"55%", borderRadius:2, background:c, marginBottom:2 }}/>
              <div style={{ height:4, width:"82%", borderRadius:2, background:bar }}/>
              <div style={{ height:2, width:"50%", borderRadius:2, background:barDim, marginTop:2 }}/>
            </div>
          ))}
        </div>
        {/* Charts row */}
        <div style={{ flex:1, display:"flex", gap:3, minHeight:0 }}>
          <div style={{ flex:2, borderRadius:4, background:card, border:`1px solid ${border}`, padding:"3px 4px", display:"flex", alignItems:"flex-end", gap:1.5 }}>
            {[28,50,38,70,55,85,62,90].map((h,i)=>(
              <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:"2px 2px 0 0", background:i===7?accent:`${accent}42` }}/>
            ))}
          </div>
          <div style={{ flex:1, borderRadius:4, background:card, border:`1px solid ${border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:`conic-gradient(${accent} 0deg 135deg,${accentSoft} 135deg 210deg,${accentAlt} 210deg 290deg,${barDim} 290deg 360deg)` }}/>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Custom thumbnail for "custom" preset ── */
const CustomThumbPreview: React.FC<{ builder: { accent:string; accentSoft:string; accentAlt:string }; dark: boolean }> = ({ builder, dark }) => {
  const fakeMeta: PresetMeta = {
    label:"Custom", description:"",
    palette: builder,
    ambientA: builder.accent, ambientB: builder.accentSoft, ambientC: builder.accentAlt,
    darkBg: "#070b12", lightBg: "#edf3fa",
  };
  return <ThemeThumbnail cfg={fakeMeta} dark={dark}/>;
};

/* ── Shared style types passed to sub-components ── */
interface UI {
  page:string; card:string; cardAlt:string;
  border:string; borderStrong:string;
  text:string; muted:string; sub:string;
  input:string; inputBorder:string;
  divider:string; shadow:string;
}

/* ── Field label wrapper ── */
const SField: React.FC<{ label:string; children:React.ReactNode; ui:UI }> = ({ label, children, ui }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:"block", fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:ui.muted, marginBottom:6 }}>{label}</label>
    {children}
  </div>
);

/* ── Text input ── */
const SInput: React.FC<{ value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; ui:UI; accent:string }> =
  ({ value, onChange, placeholder, type="text", ui, accent }) => {
  const [foc, setFoc] = useState(false);
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
      style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${foc ? accent : ui.inputBorder}`, borderRadius:12, fontSize:13, outline:"none", color:ui.text, background:ui.input, fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.2s, box-shadow 0.2s", boxShadow:foc ? `0 0 0 3px ${accent}18` : "none" }}/>
  );
};

/* ── Toggle switch ── */
const Toggle: React.FC<{ checked:boolean; onChange:(v:boolean)=>void; accent:string; dark:boolean }> =
  ({ checked, onChange, accent, dark }) => (
  <button onClick={() => onChange(!checked)} style={{ width:44, height:24, borderRadius:12, border:"none", cursor:"pointer", background:checked ? accent : dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.15)", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
    <span style={{ position:"absolute", top:2, left:checked?22:2, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.18s", boxShadow:"0 2px 6px rgba(0,0,0,0.2)" }}/>
  </button>
);

/* ── Custom dropdown ── */
const SDropdown: React.FC<{ value:string; items:{label:string;value:string}[]; open:boolean; onToggle:()=>void; onSelect:(v:string)=>void; ui:UI; accent:string }> =
  ({ value, items, open, onToggle, onSelect, ui, accent }) => (
  <div style={{ position:"relative" }}>
    <button onClick={onToggle} style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${open ? accent : ui.inputBorder}`, borderRadius:12, fontSize:13, outline:"none", color:ui.text, background:ui.input, fontFamily:"inherit", boxSizing:"border-box", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:open ? `0 0 0 3px ${accent}18` : "none", transition:"border-color 0.2s, box-shadow 0.2s" }}>
      <span>{value}</span>
      <ChevronDown size={13} style={{ color:ui.muted, transform:open ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}/>
    </button>
    <AnimatePresence>
      {open && (
        <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:0.12}}
          style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:ui.card, border:`1px solid ${ui.borderStrong}`, borderRadius:12, maxHeight:200, overflowY:"auto", zIndex:100, boxShadow:ui.shadow }}>
          {items.map(it => (
            <button key={it.value} onClick={() => { onSelect(it.value); onToggle(); }}
              style={{ width:"100%", padding:"9px 12px", border:"none", background:it.value===value ? `${accent}14` : "transparent", color:it.value===value ? accent : ui.text, textAlign:"left", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span>{it.label}</span>
              {it.value === value && <Check size={11} style={{ color:accent }}/>}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ── Modern searchable dropdown ── */
const SearchableDropdown: React.FC<{
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; loading?: boolean; disabled?: boolean;
  ui: UI; accent: string; emptyText?: string;
}> = ({ value, onChange, options, placeholder = "Select…", loading, disabled, ui, accent, emptyText = "No results found" }) => {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const pick = (opt: string) => { onChange(opt); setOpen(false); setQuery(""); };

  const isDisabled = disabled || loading;

  return (
    <div ref={ref} style={{ position:"relative" }}>
      {/* Trigger */}
      <button type="button" onClick={() => !isDisabled && setOpen(v => !v)} disabled={isDisabled}
        style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${open ? accent : ui.inputBorder}`, borderRadius:12, fontSize:13, outline:"none", background:isDisabled ? ui.cardAlt : ui.input, fontFamily:"inherit", boxSizing:"border-box", cursor:isDisabled ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, boxShadow:open ? `0 0 0 3px ${accent}18` : "none", transition:"border-color 0.2s, box-shadow 0.2s" }}>
        <span style={{ flex:1, textAlign:"left", color:value ? ui.text : ui.muted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {loading ? "Loading…" : (value || placeholder)}
        </span>
        {loading
          ? <div style={{ width:12, height:12, borderRadius:"50%", border:`2px solid ${accent}44`, borderTopColor:accent, animation:"spin 0.8s linear infinite", flexShrink:0 }}/>
          : <ChevronDown size={13} style={{ color:ui.muted, flexShrink:0, transform:open?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:-6, scale:0.98 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-6, scale:0.98 }} transition={{ duration:0.13 }}
            style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:ui.card, border:`1.5px solid ${ui.borderStrong}`, borderRadius:16, zIndex:600, boxShadow:ui.shadow, overflow:"hidden" }}>
            {/* Search box */}
            <div style={{ padding:"10px 10px 6px" }}>
              <div style={{ position:"relative" }}>
                <Search size={12} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:ui.muted, pointerEvents:"none" }}/>
                <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search…"
                  style={{ width:"100%", padding:"8px 10px 8px 28px", border:`1px solid ${ui.border}`, borderRadius:10, fontSize:12, outline:"none", color:ui.text, background:ui.cardAlt, fontFamily:"inherit", boxSizing:"border-box" }}/>
              </div>
            </div>
            {/* Options */}
            <div style={{ maxHeight:220, overflowY:"auto", padding:"4px 6px 8px" }}>
              {filtered.length === 0 ? (
                <div style={{ padding:"14px 12px", textAlign:"center", fontSize:12, color:ui.muted }}>{emptyText}</div>
              ) : filtered.map(opt => (
                <button key={opt} type="button" onClick={() => pick(opt)}
                  style={{ width:"100%", padding:"9px 12px", border:"none", borderRadius:9, background:opt===value ? `${accent}18` : "transparent", color:opt===value ? accent : ui.text, textAlign:"left", cursor:"pointer", fontSize:13, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background 0.1s" }}>
                  <span>{opt}</span>
                  {opt === value && <Check size={11} style={{ color:accent, flexShrink:0 }}/>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Main component ──────────────────────────────── */
export const Settings: React.FC = () => {
  const { mode, preset, isDark, setMode, setPreset, customPalette, setCustomPalette } = useThemeConfig();
  const palette = getPresetPalette(preset, customPalette);
  const dark    = isDark;

  const ui: UI = dark ? {
    page:"#0b1220", card:"#131d32", cardAlt:"#0f1728",
    border:"#1e2d46", borderStrong:"#2a3d58",
    text:"#e6edf8", muted:"#7a8fa8", sub:"#9db0cf",
    input:"#0d1525", inputBorder:"#1e2d46",
    divider:"rgba(255,255,255,0.06)",
    shadow:"0 16px 40px rgba(0,0,0,0.35)",
  } : {
    page:"#f1f5fb", card:"#ffffff", cardAlt:"#f7f9fd",
    border:"#dde5f0", borderStrong:"#c8d5e8",
    text:"#0f1e38", muted:"#5c6f8e", sub:"#7a8fa8",
    input:"#f7f9fd", inputBorder:"#dde5f0",
    divider:"rgba(15,23,42,0.06)",
    shadow:"0 8px 24px rgba(15,23,42,0.08)",
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const [settings, setSettings]         = useState<SettingsState>(DEFAULTS);
  const [profileName, setProfileName]   = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [detecting, setDetecting]       = useState(false);
  const [toast, setToast]               = useState<{msg:string;ok:boolean}|null>(null);
  const [aiBrandName, setAiBrandName]   = useState("");
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiResult, setAiResult]         = useState<{ accent:string; accentSoft:string; accentAlt:string; description:string }|null>(null);
  const [logoPreview, setLogoPreview]   = useState<string>(() => { try { return localStorage.getItem("pos_logo") || ""; } catch { return ""; } });
  const [countryList, setCountryList]   = useState<string[]>([]);
  const [stateList,   setStateList]     = useState<string[]>([]);
  const [cityList,    setCityList]      = useState<string[]>([]);
  const [loadingStates,  setLoadingStates]  = useState(false);
  const [loadingCities,  setLoadingCities]  = useState(false);
  const [categoryList,   setCategoryList]   = useState<string[]>([]);
  const [builder, setBuilder]           = useState({
    accent:     customPalette?.accent     || palette.accent,
    accentSoft: customPalette?.accentSoft || palette.accentSoft,
    accentAlt:  customPalette?.accentAlt  || palette.accentAlt,
  });
  const [openCurrencyDrop, setOpenCurrencyDrop] = useState(false);
  const [openTzDrop,       setOpenTzDrop]       = useState(false);
  const [openDateDrop,     setOpenDateDrop]      = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos_settings");
      if (saved) setSettings(s => ({ ...s, ...JSON.parse(saved) }));
    } catch {}
    try {
      const u = JSON.parse(localStorage.getItem("pos_user") || "{}");
      setProfileName(u.name || u.username || "");
      setProfileEmail(u.email || "");
    } catch {}
    /* Load country list */
    fetch("https://countriesnow.space/api/v0.1/countries")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.data)) setCountryList(d.data.map((c: any) => c.country as string).sort()); })
      .catch(() => {});
    /* Load categories from products */
    const token = (() => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } })();
    fetch("/api/products", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then((products: any[]) => {
        const cats = [...new Set(products.map((p: any) => p.category).filter(Boolean))].sort();
        setCategoryList(cats as string[]);
      })
      .catch(() => {});
  }, []);

  /* Load states when country changes */
  useEffect(() => {
    const c = settings.country?.trim();
    if (!c || !countryList.includes(c)) { setStateList([]); setCityList([]); return; }
    setLoadingStates(true);
    fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: c }),
    }).then(r => r.json()).then(d => {
      setStateList(Array.isArray(d?.data?.states) ? d.data.states.map((s: any) => s.name as string).sort() : []);
    }).catch(() => setStateList([])).finally(() => setLoadingStates(false));
  }, [settings.country, countryList]);

  /* Load cities when state changes */
  useEffect(() => {
    const st = settings.state?.trim(), c = settings.country?.trim();
    if (!st || !c || !stateList.includes(st)) { setCityList([]); return; }
    setLoadingCities(true);
    fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: c, state: st }),
    }).then(r => r.json()).then(d => {
      setCityList(Array.isArray(d?.data) ? (d.data as string[]).sort() : []);
    }).catch(() => setCityList([])).finally(() => setLoadingCities(false));
  }, [settings.state, settings.country, stateList]);

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const saveSettings = () => {
    localStorage.setItem("pos_settings", JSON.stringify(settings));
    /* Sync store-branding fields to DB so the public receipt page can display them */
    const token = (() => { try { return JSON.parse(localStorage.getItem("pos_user") || "{}").token; } catch { return null; } })();
    fetch("/api/store-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        storeName:      settings.storeName,
        storeAddress:   settings.storeAddress,
        storePhone:     settings.storePhone,
        storeEmail:     settings.storeEmail,
        taxNumber:      settings.taxNumber,
        currencySymbol: settings.currencySymbol,
        receiptFooter:  settings.receiptFooter,
        logoDataUrl:    (() => { try { return localStorage.getItem("pos_logo") || ""; } catch { return ""; } })(),
      }),
    }).catch(() => {});
    showToast("Settings saved successfully");
  };

  const saveProfile = () => {
    try {
      const u = JSON.parse(localStorage.getItem("pos_user") || "{}");
      localStorage.setItem("pos_user", JSON.stringify({ ...u, name: profileName, email: profileEmail }));
      showToast("Profile updated");
    } catch { showToast("Failed to update profile", false); }
  };

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const res  = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.error) throw new Error(data.reason || "Location unavailable");
      const currency = CURRENCIES.find(c => c.code === (data.currency || "").toUpperCase());
      setStateList([]);
      setCityList([]);
      setSettings(s => ({
        ...s,
        country:        data.country_name  || s.country,
        state:          data.region        || s.state,
        city:           data.city          || s.city,
        timezone:       data.timezone      || s.timezone,
        currency:       currency?.code     || s.currency,
        currencySymbol: currency?.symbol   || s.currencySymbol,
      }));
      showToast(`Detected: ${data.city || ""}, ${data.country_name || ""}`);
    } catch (e: any) {
      showToast(e?.message || "Failed to detect location", false);
    }
    finally { setDetecting(false); }
  };

  const applyBuilder = () => {
    setCustomPalette(builder);
    setPreset("custom");
    showToast("Custom brand applied");
  };

  const resetBuilder = () => {
    setCustomPalette(null);
    const base = PRESET_CONFIGS[preset as Exclude<ThemePreset,"custom">] ?? PRESET_CONFIGS.linux;
    setBuilder({ accent: base.palette.accent, accentSoft: base.palette.accentSoft, accentAlt: base.palette.accentAlt });
    showToast("Builder reset to preset");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Please upload an image file", false); return; }
    if (file.size > 2 * 1024 * 1024) { showToast("Image too large (max 2 MB)", false); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      localStorage.setItem("pos_logo", dataUrl);
      setLogoPreview(dataUrl);
      setSettings(s => ({ ...s, logoUrl: dataUrl }));
      showToast("Logo uploaded");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeLogo = () => {
    localStorage.removeItem("pos_logo");
    setLogoPreview("");
    setSettings(s => ({ ...s, logoUrl: "" }));
    showToast("Logo removed");
  };

  const extractColorsFromLogo = () => {
    const src = logoPreview;
    if (!src) { showToast("Upload a logo first", false); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 60; canvas.height = 60;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 60, 60);
      const data = ctx.getImageData(0, 0, 60, 60).data;
      const colors: [number, number, number][] = [];
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a > 128 && !(r > 240 && g > 240 && b > 240) && !(r < 20 && g < 20 && b < 20)) {
          colors.push([r, g, b]);
        }
      }
      if (!colors.length) { showToast("No usable colors found in logo", false); return; }
      const med = (arr: number[]) => { const s = [...arr].sort((a,b) => a-b); return s[Math.floor(s.length/2)]; };
      const r1 = med(colors.map(c => c[0])), g1 = med(colors.map(c => c[1])), b1 = med(colors.map(c => c[2]));
      const hex = (r: number, g: number, b: number) => `#${[r,g,b].map(v => Math.min(255,Math.max(0,v)).toString(16).padStart(2,"0")).join("")}`;
      const accent     = hex(r1, g1, b1);
      const accentSoft = hex(r1+50, g1+20, b1+80);
      const accentAlt  = hex(r1+20, g1+70, b1+40);
      setBuilder({ accent, accentSoft, accentAlt });
      showToast("Colors extracted — scroll up and click Apply Brand");
    };
    img.onerror = () => showToast("Could not read logo image", false);
    img.src = src;
  };

  const handleAIBrandTheme = async () => {
    if (!aiBrandName.trim()) { showToast("Enter a brand name first", false); return; }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch("/api/ai/brand-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName: aiBrandName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "AI service failed");
      const pal = { accent: data.accent, accentSoft: data.accentSoft, accentAlt: data.accentAlt };
      setBuilder(pal);
      setAiResult({ ...pal, description: data.description || "AI-generated palette" });
      showToast("AI palette ready — click Apply Brand to use it");
    } catch (e: any) {
      showToast(e?.message || "AI theme generation failed", false);
    } finally {
      setAiLoading(false);
    }
  };

  const set = <K extends keyof SettingsState>(k: K) => (v: SettingsState[K]) =>
    setSettings(s => ({ ...s, [k]: v }));

  const PRESET_ORDER: ThemePreset[] = ["ubuntu","windows11","linux","ocean","ember","custom"];

  return (
    <div style={{ height:"100%", overflowY:"auto", background:ui.page, fontFamily:"var(--theme-font,'Sora','DM Sans',system-ui,sans-serif)" }}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:16}}
            style={{ position:"fixed", bottom:24, right:24, zIndex:2000, padding:"12px 18px", borderRadius:16, display:"flex", alignItems:"center", gap:10, background:toast.ok?`${palette.accent}18`:"rgba(239,68,68,0.12)", border:`1px solid ${toast.ok?palette.accent+"44":"rgba(239,68,68,0.3)"}`, boxShadow:"0 14px 32px rgba(0,0,0,0.18)", backdropFilter:"blur(12px)" }}>
            {toast.ok ? <Check size={14} style={{ color:palette.accent }}/> : <X size={14} style={{ color:"#ef4444" }}/>}
            <span style={{ fontSize:13, fontWeight:700, color:toast.ok?palette.accent:"#ef4444" }}>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding:isMobile?"14px 14px 32px":"28px 28px 40px", maxWidth:1100, margin:"0 auto", display:"flex", flexDirection:"column", gap:24 }}>
        {/* Header */}
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:800, color:ui.text, letterSpacing:-0.4 }}>Settings</h1>
          <p style={{ margin:"4px 0 0", fontSize:12, color:ui.muted }}>Customize your POS experience, branding, and preferences</p>
        </div>

        {/* ── Section 1: Theme Presets ─────────────────────── */}
        <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Palette size={16} style={{ color:palette.accent }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Theme Preset</div>
              <div style={{ fontSize:11, color:ui.muted }}>Choose a theme — each changes the entire look & feel of your POS</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:14 }}>
            {PRESET_ORDER.map(p => {
              const isCustom  = p === "custom";
              const isActive  = preset === p;
              const meta      = isCustom ? null : PRESET_CONFIGS[p as Exclude<ThemePreset,"custom">];
              const accent    = meta?.palette.accent || builder.accent;

              return (
                <motion.button key={p} whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                  onClick={() => isCustom ? applyBuilder() : setPreset(p)}
                  style={{ border:`2px solid ${isActive?accent:ui.border}`, borderRadius:16, background:isActive?`${accent}0e`:ui.cardAlt, padding:12, cursor:"pointer", textAlign:"left", outline:"none", transition:"border-color 0.2s, background 0.2s", position:"relative", overflow:"hidden" }}>
                  {isActive && (
                    <div style={{ position:"absolute", top:8, right:8, width:20, height:20, borderRadius:"50%", background:accent, display:"flex", alignItems:"center", justifyContent:"center", zIndex:2 }}>
                      <Check size={10} style={{ color:"#fff" }}/>
                    </div>
                  )}
                  {/* Thumbnail */}
                  {isCustom ? (
                    <CustomThumbPreview builder={builder} dark={dark}/>
                  ) : (
                    <ThemeThumbnail cfg={meta!} dark={dark}/>
                  )}
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:isActive?accent:ui.text }}>{meta?.label ?? "Custom"}</div>
                    <div style={{ fontSize:10, color:ui.muted, marginTop:2 }}>{meta?.description ?? "Your brand colors"}</div>
                  </div>
                  <div style={{ display:"flex", gap:6, marginTop:10 }}>
                    {(meta ? [meta.palette.accent, meta.palette.accentSoft, meta.palette.accentAlt] : [builder.accent, builder.accentSoft, builder.accentAlt]).map((c,i) => (
                      <div key={i} style={{ width:16, height:16, borderRadius:5, background:c, boxShadow:`0 2px 6px ${c}44` }}/>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Appearance + Brand ─────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:18 }}>
          {/* Mode toggle */}
          <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {mode==="dark" ? <Moon size={15} style={{ color:palette.accent }}/> : mode==="light" ? <Sun size={15} style={{ color:palette.accent }}/> : <Monitor size={15} style={{ color:palette.accent }}/>}
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Appearance</div>
                <div style={{ fontSize:11, color:ui.muted }}>Light, dark, or follow system</div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {([
                { m:"light"  as ThemeMode, icon:Sun,     label:"Light"  },
                { m:"dark"   as ThemeMode, icon:Moon,    label:"Dark"   },
                { m:"system" as ThemeMode, icon:Monitor, label:"System" },
              ]).map(({ m, icon:Icon, label }) => (
                <motion.button key={m} whileTap={{ scale:0.96 }} onClick={() => setMode(m)}
                  style={{ padding:"16px 8px", borderRadius:16, border:`2px solid ${mode===m?palette.accent:ui.border}`, background:mode===m?`${palette.accent}14`:ui.cardAlt, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8, transition:"all 0.2s", outline:"none" }}>
                  <Icon size={20} style={{ color:mode===m?palette.accent:ui.muted }}/>
                  <span style={{ fontSize:11, fontWeight:800, color:mode===m?palette.accent:ui.muted, textTransform:"uppercase", letterSpacing:0.6 }}>{label}</span>
                </motion.button>
              ))}
            </div>
            <div style={{ marginTop:16, padding:"12px 14px", borderRadius:14, background:ui.cardAlt, border:`1px solid ${ui.divider}`, fontSize:11, color:ui.muted, display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:palette.accent, boxShadow:`0 0 6px ${palette.accent}88` }}/>
              Active: <strong style={{ color:ui.text }}>{preset.charAt(0).toUpperCase()+preset.slice(1)}</strong> / {mode} ({dark?"dark":"light"})
            </div>
          </div>

          {/* Brand Builder */}
          <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Zap size={15} style={{ color:palette.accent }}/>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Brand Colors</div>
                <div style={{ fontSize:11, color:ui.muted }}>Pick your brand palette</div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
              {([
                { key:"accent"     as const, label:"Primary"  },
                { key:"accentSoft" as const, label:"Secondary" },
                { key:"accentAlt"  as const, label:"Tertiary"  },
              ]).map(({ key, label }) => (
                <div key={key}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:ui.muted, marginBottom:6 }}>{label}</div>
                  <label style={{ display:"block", position:"relative", cursor:"pointer" }}>
                    <div style={{ height:48, borderRadius:12, background:builder[key], border:`2px solid ${ui.border}`, cursor:"pointer", boxShadow:`0 4px 12px ${builder[key]}44` }}/>
                    <input type="color" value={builder[key]} onChange={e => setBuilder(b => ({ ...b, [key]: e.target.value }))}
                      style={{ position:"absolute", inset:0, opacity:0, width:"100%", height:"100%", cursor:"pointer" }}/>
                  </label>
                  <div style={{ fontSize:9, color:ui.muted, marginTop:4, fontFamily:"monospace" }}>{builder[key]}</div>
                </div>
              ))}
            </div>
            {/* Preview swatch */}
            <div style={{ height:28, borderRadius:10, background:`linear-gradient(135deg,${builder.accent},${builder.accentSoft},${builder.accentAlt})`, marginBottom:14, boxShadow:`0 4px 14px ${builder.accent}44` }}/>
            <div style={{ display:"flex", gap:8 }}>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={applyBuilder}
                style={{ flex:2, padding:"10px 0", borderRadius:12, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, color:"#fff", background:`linear-gradient(135deg,${builder.accent},${builder.accentSoft})`, boxShadow:`0 8px 20px ${builder.accent}33` }}>
                Apply Brand
              </motion.button>
              <button onClick={resetBuilder}
                style={{ flex:1, padding:"10px 0", borderRadius:12, border:`1px solid ${ui.border}`, cursor:"pointer", fontSize:12, fontWeight:700, color:ui.muted, background:ui.cardAlt }}>
                Reset
              </button>
            </div>

            {/* ── AI Brand Theme ── */}
            <div style={{ height:1, background:ui.divider, margin:"16px 0 14px" }}/>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
              <Sparkles size={13} style={{ color:palette.accent }}/>
              <span style={{ fontSize:11, fontWeight:800, color:ui.text, textTransform:"uppercase", letterSpacing:1 }}>AI Brand Theme</span>
            </div>
            <div style={{ fontSize:10, color:ui.muted, marginBottom:10 }}>Enter your brand name — AI picks the perfect palette for you.</div>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={aiBrandName}
                onChange={e => setAiBrandName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !aiLoading && handleAIBrandTheme()}
                placeholder="e.g. Sunrise Bakery, TechHub…"
                style={{ flex:1, padding:"9px 12px", border:`1.5px solid ${ui.inputBorder}`, borderRadius:10, fontSize:12, outline:"none", color:ui.text, background:ui.input, fontFamily:"inherit" }}
              />
              <motion.button
                whileTap={{ scale:0.95 }}
                onClick={handleAIBrandTheme}
                disabled={aiLoading || !aiBrandName.trim()}
                style={{ padding:"9px 14px", borderRadius:10, border:"none", cursor:aiLoading||!aiBrandName.trim()?"not-allowed":"pointer", fontSize:12, fontWeight:700, color:"#fff", background:aiLoading||!aiBrandName.trim()?ui.muted:`linear-gradient(135deg,${palette.accent},${palette.accentSoft})`, flexShrink:0, display:"flex", alignItems:"center", gap:5 }}>
                <Wand2 size={12}/>
                {aiLoading ? "…" : "Generate"}
              </motion.button>
            </div>
            {aiResult && (
              <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                style={{ marginTop:10, padding:"10px 12px", borderRadius:12, background:ui.cardAlt, border:`1px solid ${ui.border}` }}>
                <div style={{ fontSize:10, color:ui.muted, marginBottom:8 }}>"{aiResult.description}"</div>
                <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                  {[aiResult.accent, aiResult.accentSoft, aiResult.accentAlt].map((c,i) => (
                    <div key={i} style={{ flex:1, height:14, borderRadius:4, background:c, boxShadow:`0 2px 6px ${c}44` }}/>
                  ))}
                </div>
                <div style={{ fontSize:10, color:ui.muted }}>Colors auto-applied to builder above — click <strong style={{ color:palette.accent }}>Apply Brand</strong> to set.</div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Section 3: Store & Regional ───────────────────── */}
        <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Store size={15} style={{ color:palette.accent }}/>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Store & Regional</div>
                <div style={{ fontSize:11, color:ui.muted }}>Business info, currency, and locale settings</div>
              </div>
            </div>
            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={detectLocation} disabled={detecting}
              style={{ padding:"9px 16px", borderRadius:12, border:`1px solid ${ui.border}`, background:ui.cardAlt, cursor:detecting?"wait":"pointer", fontSize:12, fontWeight:700, color:ui.muted, display:"flex", alignItems:"center", gap:6 }}>
              <RefreshCw size={12} style={{ animation:detecting?"spin 1s linear infinite":undefined }}/>{detecting?"Detecting…":"Detect Location"}
            </motion.button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
            <SField label="Store Name" ui={ui}>
              <SInput value={settings.storeName} onChange={set("storeName")} placeholder="e.g. Sunrise Mart" ui={ui} accent={palette.accent}/>
            </SField>
            <SField label="Tax / Registration Number" ui={ui}>
              <SInput value={settings.taxNumber} onChange={set("taxNumber")} placeholder="e.g. NTN-1234567" ui={ui} accent={palette.accent}/>
            </SField>
          </div>
          <SField label="Store Address" ui={ui}>
            <SInput value={settings.storeAddress} onChange={set("storeAddress")} placeholder="Full street address" ui={ui} accent={palette.accent}/>
          </SField>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
            <SField label="Phone Number" ui={ui}>
              <SInput value={settings.storePhone} onChange={set("storePhone")} placeholder="+1 555 000 0000" type="tel" ui={ui} accent={palette.accent}/>
            </SField>
            <SField label="Store Email" ui={ui}>
              <SInput value={settings.storeEmail} onChange={set("storeEmail")} placeholder="store@example.com" type="email" ui={ui} accent={palette.accent}/>
            </SField>
          </div>

          <div style={{ height:1, background:ui.divider, margin:"4px 0 14px" }}/>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:14 }}>
            <SField label="Currency" ui={ui}>
              <SDropdown
                value={`${settings.currency} (${settings.currencySymbol})`}
                items={CURRENCIES.map(c => ({ value:c.code, label:`${c.code} — ${c.name} (${c.symbol})` }))}
                open={openCurrencyDrop}
                onToggle={() => { setOpenCurrencyDrop(v=>!v); setOpenTzDrop(false); setOpenDateDrop(false); }}
                onSelect={v => {
                  const c = CURRENCIES.find(x => x.code === v);
                  setSettings(s => ({ ...s, currency:v, currencySymbol:c?.symbol || s.currencySymbol }));
                }}
                ui={ui} accent={palette.accent}
              />
            </SField>
            <SField label="Timezone" ui={ui}>
              <SDropdown
                value={settings.timezone}
                items={TIMEZONES.map(tz => ({ value:tz, label:tz.replace(/_/g," ") }))}
                open={openTzDrop}
                onToggle={() => { setOpenTzDrop(v=>!v); setOpenCurrencyDrop(false); setOpenDateDrop(false); }}
                onSelect={v => setSettings(s => ({ ...s, timezone:v }))}
                ui={ui} accent={palette.accent}
              />
            </SField>
            <SField label="Date Format" ui={ui}>
              <SDropdown
                value={settings.dateFormat}
                items={DATE_FORMATS.map(f => ({ value:f, label:f }))}
                open={openDateDrop}
                onToggle={() => { setOpenDateDrop(v=>!v); setOpenCurrencyDrop(false); setOpenTzDrop(false); }}
                onSelect={v => setSettings(s => ({ ...s, dateFormat:v }))}
                ui={ui} accent={palette.accent}
              />
            </SField>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:14 }}>
            <SField label="Country" ui={ui}>
              <SearchableDropdown
                value={settings.country}
                onChange={v => setSettings(s => ({ ...s, country: v, state: "", city: "" }))}
                options={countryList}
                placeholder="Select country…"
                emptyText={countryList.length === 0 ? "Loading countries…" : "No country found"}
                ui={ui} accent={palette.accent}
              />
            </SField>
            <SField label="State / Province" ui={ui}>
              <SearchableDropdown
                value={settings.state}
                onChange={v => setSettings(s => ({ ...s, state: v, city: "" }))}
                options={stateList}
                placeholder={settings.country ? "Select state…" : "Choose country first"}
                loading={loadingStates}
                disabled={!settings.country}
                emptyText={settings.country ? "No states found" : "Choose country first"}
                ui={ui} accent={palette.accent}
              />
            </SField>
            <SField label="City" ui={ui}>
              <SearchableDropdown
                value={settings.city}
                onChange={set("city")}
                options={cityList}
                placeholder={settings.state ? "Select city…" : "Choose state first"}
                loading={loadingCities}
                disabled={!settings.state}
                emptyText={settings.state ? "No cities found" : "Choose state first"}
                ui={ui} accent={palette.accent}
              />
            </SField>
          </div>

          {/* Time format toggle */}
          <SField label="Time Format" ui={ui}>
            <div style={{ display:"flex", gap:8 }}>
              {(["12h","24h"] as const).map(f => (
                <button key={f} onClick={() => setSettings(s => ({ ...s, timeFormat:f }))}
                  style={{ padding:"8px 20px", borderRadius:10, border:`1.5px solid ${settings.timeFormat===f?palette.accent:ui.border}`, background:settings.timeFormat===f?`${palette.accent}14`:ui.cardAlt, color:settings.timeFormat===f?palette.accent:ui.muted, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.2s" }}>
                  {f}
                </button>
              ))}
            </div>
          </SField>
        </div>

        {/* ── Section 4: Notifications + Profile ─────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:18 }}>
          {/* Notifications */}
          <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Bell size={15} style={{ color:palette.accent }}/>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Notifications</div>
                <div style={{ fontSize:11, color:ui.muted }}>Choose which events trigger alerts</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {([
                { key:"notifyNewSale"     as const, icon:ShoppingBag,   label:"New Sale",         desc:"Alert on every completed sale"       },
                { key:"notifyLowStock"    as const, icon:AlertTriangle, label:"Low Stock",         desc:"When a product falls below threshold" },
                { key:"notifyNewOrder"    as const, icon:Package,       label:"New Order",         desc:"When a new order is received"         },
                { key:"notifyLogin"       as const, icon:LogIn,         label:"Login Activity",    desc:"Alert on staff sign-ins"              },
                { key:"notifyUserCreated" as const, icon:Users,         label:"User Created",      desc:"When a new user account is created"   },
                { key:"notifyRefund"      as const, icon:CreditCard,    label:"Refund / Return",   desc:"Alert when a sale is refunded"        },
              ]).map(({ key, icon:Icon, label, desc }) => (
                <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:14, background:settings[key]?`${palette.accent}0a`:ui.cardAlt, border:`1px solid ${settings[key]?palette.accent+"22":ui.divider}`, transition:"all 0.2s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:settings[key]?`${palette.accent}18`:dark?"rgba(255,255,255,0.06)":"rgba(15,23,42,0.04)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Icon size={14} style={{ color:settings[key]?palette.accent:ui.muted }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:ui.text }}>{label}</div>
                      <div style={{ fontSize:10, color:ui.muted, marginTop:1 }}>{desc}</div>
                    </div>
                  </div>
                  <Toggle checked={settings[key]} onChange={v => setSettings(s => ({ ...s, [key]:v }))} accent={palette.accent} dark={dark}/>
                </div>
              ))}
            </div>
          </div>

          {/* User Profile */}
          <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow, display:"flex", flexDirection:"column" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <User size={15} style={{ color:palette.accent }}/>
              </div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>User Profile</div>
                <div style={{ fontSize:11, color:ui.muted }}>Update your display name and email</div>
              </div>
            </div>

            {/* Avatar */}
            <div style={{ display:"flex", alignItems:"center", gap:14, padding:"16px", borderRadius:16, background:ui.cardAlt, border:`1px solid ${ui.divider}`, marginBottom:18 }}>
              <div style={{ width:52, height:52, borderRadius:16, background:`linear-gradient(135deg,${palette.accent},${palette.accentSoft})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, color:"#fff", flexShrink:0, boxShadow:`0 8px 20px ${palette.accent}33` }}>
                {(profileName||"U")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:ui.text }}>{profileName || "—"}</div>
                <div style={{ fontSize:11, color:ui.muted, marginTop:2 }}>{profileEmail || "No email set"}</div>
              </div>
            </div>

            <SField label="Display Name" ui={ui}>
              <SInput value={profileName} onChange={setProfileName} placeholder="Your full name" ui={ui} accent={palette.accent}/>
            </SField>
            <SField label="Email Address" ui={ui}>
              <SInput value={profileEmail} onChange={setProfileEmail} placeholder="you@store.com" type="email" ui={ui} accent={palette.accent}/>
            </SField>

            <div style={{ marginTop:"auto", paddingTop:14 }}>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={saveProfile}
                style={{ width:"100%", padding:"11px 0", borderRadius:14, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"#fff", background:`linear-gradient(135deg,${palette.accent},${palette.accentSoft})`, boxShadow:`0 10px 24px ${palette.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <User size={14}/> Update Profile
              </motion.button>
            </div>
          </div>
        </div>

        {/* ── Section 5: Receipt Settings ──────────────────── */}
        <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Printer size={15} style={{ color:palette.accent }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>Receipt Settings</div>
              <div style={{ fontSize:11, color:ui.muted }}>Customise printed and on-screen receipts</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:14 }}>
            <SField label="Receipt Footer Message" ui={ui}>
              <SInput value={settings.receiptFooter} onChange={set("receiptFooter")} placeholder="e.g. Thank you for shopping!" ui={ui} accent={palette.accent}/>
            </SField>
            <SField label="Receipt Logo" ui={ui}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {logoPreview ? (
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <img src={logoPreview} alt="Logo" style={{ width:52, height:52, borderRadius:12, objectFit:"contain", border:`1px solid ${ui.border}`, background:"#fff", padding:3 }}/>
                    <button onClick={removeLogo}
                      style={{ position:"absolute", top:-6, right:-6, width:18, height:18, borderRadius:"50%", background:"#ef4444", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <X size={10} style={{ color:"#fff" }}/>
                    </button>
                  </div>
                ) : (
                  <div style={{ width:52, height:52, borderRadius:12, border:`2px dashed ${ui.inputBorder}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:ui.cardAlt }}>
                    <ImageIcon size={18} style={{ color:ui.muted }}/>
                  </div>
                )}
                <div style={{ flex:1 }}>
                  <label style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:10, border:`1px solid ${ui.border}`, cursor:"pointer", fontSize:12, fontWeight:700, color:ui.text, background:ui.cardAlt }}>
                    <Upload size={12} style={{ color:palette.accent }}/>
                    {logoPreview ? "Replace" : "Upload Logo"}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display:"none" }}/>
                  </label>
                  <div style={{ fontSize:10, color:ui.muted, marginTop:4 }}>PNG/JPG/SVG · max 2 MB</div>
                </div>
                {logoPreview && (
                  <button onClick={extractColorsFromLogo}
                    style={{ padding:"8px 12px", borderRadius:10, border:`1px solid ${palette.accent}44`, background:`${palette.accent}10`, cursor:"pointer", fontSize:11, fontWeight:700, color:palette.accent, whiteSpace:"nowrap", flexShrink:0 }}>
                    Extract Colors
                  </button>
                )}
              </div>
            </SField>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {([
              { key:"showQRCode" as const, icon:QrCode,   label:"Show QR Code on Receipt",    desc:"Print a scannable QR code on every receipt"          },
              { key:"autoPrint"  as const, icon:Printer,  label:"Auto-print after Checkout",  desc:"Automatically open print dialog when sale completes" },
            ]).map(({ key, icon:Icon, label, desc }) => (
              <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:14, background:settings[key]?`${palette.accent}0a`:ui.cardAlt, border:`1px solid ${settings[key]?palette.accent+"22":ui.divider}`, transition:"all 0.2s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:settings[key]?`${palette.accent}18`:dark?"rgba(255,255,255,0.06)":"rgba(15,23,42,0.04)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Icon size={14} style={{ color:settings[key]?palette.accent:ui.muted }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:ui.text }}>{label}</div>
                    <div style={{ fontSize:10, color:ui.muted, marginTop:1 }}>{desc}</div>
                  </div>
                </div>
                <Toggle checked={settings[key] as boolean} onChange={v => setSettings(s => ({ ...s, [key]:v }))} accent={palette.accent} dark={dark}/>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 6: POS Behavior ───────────────────────── */}
        <div style={{ background:ui.card, border:`1px solid ${ui.border}`, borderRadius:24, padding:24, boxShadow:ui.shadow }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`${palette.accent}18`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Settings2 size={15} style={{ color:palette.accent }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:ui.text }}>POS Behavior</div>
              <div style={{ fontSize:11, color:ui.muted }}>Control how the checkout and inventory work</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
            <SField label="Low Stock Alert Threshold" ui={ui}>
              <SInput value={String(settings.lowStockThreshold)} onChange={v => setSettings(s => ({ ...s, lowStockThreshold: Math.max(1, parseInt(v) || 5) }))} placeholder="5" type="number" ui={ui} accent={palette.accent}/>
            </SField>
            <SField label="WhatsApp Number" ui={ui}>
              <SInput value={settings.whatsappNumber} onChange={set("whatsappNumber")} placeholder="+92 300 0000000" type="tel" ui={ui} accent={palette.accent}/>
            </SField>
            <SField label="Website / Store URL" ui={ui}>
              <SInput value={settings.websiteUrl} onChange={set("websiteUrl")} placeholder="https://yourstore.com" ui={ui} accent={palette.accent}/>
            </SField>
          </div>

          {/* Default Category */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <Tag size={13} style={{ color:palette.accent }}/>
              <span style={{ fontSize:12, fontWeight:800, color:ui.text }}>Default Category Filter</span>
              <span style={{ fontSize:10, color:ui.muted, marginLeft:2 }}>— shown first on the POS screen</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 2fr", gap:14 }}>
              <SearchableDropdown
                value={settings.defaultCategory}
                onChange={set("defaultCategory")}
                options={["All", ...categoryList]}
                placeholder="Select default category…"
                emptyText={categoryList.length === 0 ? "No categories yet — add products first" : "No category found"}
                ui={ui} accent={palette.accent}
              />
              <div style={{ padding:"10px 14px", borderRadius:12, background:ui.cardAlt, border:`1px solid ${ui.divider}`, fontSize:11, color:ui.muted, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:palette.accent, boxShadow:`0 0 6px ${palette.accent}88`, flexShrink:0 }}/>
                When a cashier opens the POS, the product grid will open on this category tab automatically.
              </div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {([
              { key:"requireCustomer"   as const, icon:Users,          label:"Require Customer on Checkout", desc:"Force selecting or creating a customer before payment"        },
              { key:"requireDiscountPin" as const, icon:AlertTriangle, label:"Require PIN to Apply Discount", desc:"Managers must approve any discount before it is applied"       },
            ]).map(({ key, icon:Icon, label, desc }) => (
              <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:14, background:settings[key]?`${palette.accent}0a`:ui.cardAlt, border:`1px solid ${settings[key]?palette.accent+"22":ui.divider}`, transition:"all 0.2s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:settings[key]?`${palette.accent}18`:dark?"rgba(255,255,255,0.06)":"rgba(15,23,42,0.04)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Icon size={14} style={{ color:settings[key]?palette.accent:ui.muted }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:ui.text }}>{label}</div>
                    <div style={{ fontSize:10, color:ui.muted, marginTop:1 }}>{desc}</div>
                  </div>
                </div>
                <Toggle checked={settings[key] as boolean} onChange={v => setSettings(s => ({ ...s, [key]:v }))} accent={palette.accent} dark={dark}/>
              </div>
            ))}
          </div>

          {/* WhatsApp quick-test */}
          {settings.whatsappNumber && (
            <div style={{ marginTop:14, padding:"12px 14px", borderRadius:14, background:`#25d36618`, border:`1px solid #25d36630`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <MessageCircle size={16} style={{ color:"#25d366" }}/>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:ui.text }}>WhatsApp Configured</div>
                  <div style={{ fontSize:10, color:ui.muted }}>{settings.whatsappNumber}</div>
                </div>
              </div>
              <a href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                style={{ padding:"6px 14px", borderRadius:10, background:"#25d366", color:"#fff", fontSize:11, fontWeight:700, textDecoration:"none" }}>
                Test
              </a>
            </div>
          )}
          {settings.websiteUrl && (
            <div style={{ marginTop:10, padding:"12px 14px", borderRadius:14, background:`${palette.accent}0a`, border:`1px solid ${palette.accent}22`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Globe size={16} style={{ color:palette.accent }}/>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:ui.text }}>Website Linked</div>
                  <div style={{ fontSize:10, color:ui.muted }}>{settings.websiteUrl}</div>
                </div>
              </div>
              <a href={settings.websiteUrl} target="_blank" rel="noreferrer"
                style={{ padding:"6px 14px", borderRadius:10, background:palette.accent, color:"#fff", fontSize:11, fontWeight:700, textDecoration:"none" }}>
                Visit
              </a>
            </div>
          )}
        </div>

        {/* ── Save All ─────────────────────────────────────── */}
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={saveSettings}
            style={{ padding:"13px 32px", borderRadius:16, border:"none", cursor:"pointer", fontSize:14, fontWeight:800, color:"#fff", background:`linear-gradient(135deg,${palette.accent},${palette.accentSoft})`, boxShadow:`0 14px 32px ${palette.accent}44`, display:"flex", alignItems:"center", gap:10, letterSpacing:0.2 }}>
            <Save size={16}/> Save All Settings
          </motion.button>
        </div>
      </div>
    </div>
  );
};
