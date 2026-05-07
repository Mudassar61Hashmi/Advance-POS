/**
 * useAppSettings — reads pos_settings from localStorage and exposes
 * formatting helpers that respect the user's currency, date format,
 * time format, and timezone choices.
 */

export interface AppSettings {
  storeName:          string;
  storeAddress:       string;
  storePhone:         string;
  storeEmail:         string;
  taxNumber:          string;
  currency:           string;
  currencySymbol:     string;
  timezone:           string;
  dateFormat:         string;
  timeFormat:         "12h" | "24h";
  country:            string;
  state:              string;
  city:               string;
  notifyNewSale:      boolean;
  notifyLowStock:     boolean;
  notifyNewOrder:     boolean;
  notifyLogin:        boolean;
  notifyUserCreated:  boolean;
  notifyRefund:       boolean;
  /* Receipt */
  receiptFooter:      string;
  showQRCode:         boolean;
  logoUrl:            string;
  autoPrint:          boolean;
  /* POS Behavior */
  lowStockThreshold:  number;
  requireCustomer:    boolean;
  requireDiscountPin: boolean;
  defaultCategory:    string;
  /* Online / Contact */
  whatsappNumber:     string;
  websiteUrl:         string;
}

const DEFAULTS: AppSettings = {
  storeName: "My POS Store", storeAddress: "", storePhone: "", storeEmail: "", taxNumber: "",
  currency: "USD", currencySymbol: "$",
  timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } })(),
  dateFormat: "MM/DD/YYYY", timeFormat: "12h",
  country: "", state: "", city: "",
  notifyNewSale: true, notifyLowStock: true, notifyNewOrder: true,
  notifyLogin: false, notifyUserCreated: true, notifyRefund: true,
  receiptFooter: "Thank you for shopping with us!", showQRCode: true, logoUrl: "", autoPrint: false,
  lowStockThreshold: 5, requireCustomer: false, requireDiscountPin: false, defaultCategory: "All",
  whatsappNumber: "", websiteUrl: "",
};

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("pos_settings");
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function applyDateFormat(d: Date, fmt: string): string {
  const pad  = (n: number) => String(n).padStart(2, "0");
  const mm   = pad(d.getMonth() + 1);
  const dd   = pad(d.getDate());
  const yyyy = String(d.getFullYear());
  switch (fmt) {
    case "DD/MM/YYYY":    return `${dd}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":    return `${yyyy}-${mm}-${dd}`;
    case "DD-MM-YYYY":    return `${dd}-${mm}-${yyyy}`;
    case "MMM DD, YYYY":  return `${MONTH_SHORT[d.getMonth()]} ${dd}, ${yyyy}`;
    default:              return `${mm}/${dd}/${yyyy}`;
  }
}

function applyTimeFormat(d: Date, fmt: "12h" | "24h"): string {
  if (fmt === "24h") {
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  const h    = d.getHours();
  const m    = String(d.getMinutes()).padStart(2,"0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${ampm}`;
}

export interface AppSettingsHelpers extends AppSettings {
  formatCurrency:  (amount: number | null | undefined) => string;
  formatDate:      (date: string | Date | null | undefined) => string;
  formatTime:      (date: string | Date | null | undefined) => string;
  formatDateTime:  (date: string | Date | null | undefined) => string;
}

/** Call anywhere — reads localStorage directly (no React context needed). */
export function useAppSettings(): AppSettingsHelpers {
  const s = readSettings();

  const formatCurrency = (amount: number | null | undefined): string => {
    const sym = s.currencySymbol || "$";
    return `${sym}${(amount ?? 0).toFixed(2)}`;
  };

  const toDate = (raw: string | Date | null | undefined): Date | null => {
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDate = (raw: string | Date | null | undefined): string => {
    const d = toDate(raw);
    return d ? applyDateFormat(d, s.dateFormat) : "—";
  };

  const formatTime = (raw: string | Date | null | undefined): string => {
    const d = toDate(raw);
    return d ? applyTimeFormat(d, s.timeFormat) : "—";
  };

  const formatDateTime = (raw: string | Date | null | undefined): string => {
    const d = toDate(raw);
    if (!d) return "—";
    return `${applyDateFormat(d, s.dateFormat)} ${applyTimeFormat(d, s.timeFormat)}`;
  };

  return { ...s, formatCurrency, formatDate, formatTime, formatDateTime };
}

/** Standalone (non-hook) formatter for use outside React components. */
export function getSettings(): AppSettingsHelpers {
  return (useAppSettings as unknown as () => AppSettingsHelpers)();
}
