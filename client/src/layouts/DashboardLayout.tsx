import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  DollarSign, ShoppingBag, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Package, LayoutDashboard,
  ShoppingCart, History, LogOut, Sun, Moon, Zap, Bell,
  TrendingUp, Shield, UserCog, Store, Lock,
  Eye, EyeOff, Clock, RefreshCw, Plus, ClipboardList, Receipt,
  UserCog2, Search, Trash2, KeyRound, UserCircle2,
  CheckCircle2, XCircle, X, Wallet, Loader2, Database, Tag,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useThemeConfig } from "../theme";
import { subscribeAppNotifications } from "../notifications";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type Role   = "superadmin" | "admin" | "manager" | "cashier";
type Status = "active" | "inactive";
interface SessionUser { username: string; role: Role; }
interface AppUser {
  _id: string; name: string; email: string; username: string;
  role: Role; status: Status; createdAt: string; lastLogin: string | null;
  createdBy?: { name: string; email: string; role: Role } | null;
}
interface UserFormData { name: string; email: string; username: string; password: string; role: Role; status: Status; }
interface FormErrors   { name?: string; email?: string; username?: string; password?: string; role?: string; submit?: string; }
interface ToastItem    { id: number; msg: string; type: "success"|"error"; }
interface ModalState   { create: boolean; edit: AppUser|null; delete: AppUser|null; reset: AppUser|null; detail: AppUser|null; }
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

type Tab = "pos"|"inventory"|"sales"|"customers"|"orders"|"taxes"|"payments"|"coupons"|"users"|"settings"|"data";

interface Props {
  user: SessionUser;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

/* ═══════════════════════════════════════════════════════════
   ROLE CONFIG
═══════════════════════════════════════════════════════════ */
const ROLE_CONFIG: Record<Role, {
  label: string; color: string; gradient: string; icon: React.ElementType;
  navItems: Tab[];
  canSeeRevenue: boolean; canSeeUsers: boolean; canSeeReports: boolean;
  canSeeInventory: boolean; canSeeCustomers: boolean;
  canSeeSystem: boolean; canSeeBranches: boolean;
  canCreate: Role[];
}> = {
  superadmin: {
    label: "Super Admin", color: "#f59e0b",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)", icon: Shield,
    navItems: ["pos","inventory","sales","customers","payments","orders","taxes","coupons","users","data","settings"],
    canSeeRevenue: true, canSeeUsers: true, canSeeReports: true,
    canSeeInventory: true, canSeeCustomers: true, canSeeSystem: true, canSeeBranches: true,
    canCreate: ["admin","manager","cashier"],
  },
  admin: {
    label: "Admin", color: "#22d3ee",
    gradient: "linear-gradient(135deg,#22d3ee,#a78bfa)", icon: UserCog,
    navItems: ["pos","inventory","sales","customers","orders","taxes","payments","coupons","users","data","settings"],
    canSeeRevenue: true, canSeeUsers: true, canSeeReports: true,
    canSeeInventory: true, canSeeCustomers: true, canSeeSystem: false, canSeeBranches: false,
    canCreate: ["manager","cashier"],
  },
  manager: {
    label: "Manager", color: "#34d399",
    gradient: "linear-gradient(135deg,#34d399,#22d3ee)", icon: Store,
    navItems: ["pos","inventory","sales","customers","orders","taxes","payments","coupons","data","settings"],
    canSeeRevenue: true, canSeeUsers: false, canSeeReports: true,
    canSeeInventory: true, canSeeCustomers: true, canSeeSystem: false, canSeeBranches: false,
    canCreate: ["cashier"],
  },
  cashier: {
    label: "Cashier", color: "#a78bfa",
    gradient: "linear-gradient(135deg,#a78bfa,#ec4899)", icon: ShoppingCart,
    navItems: ["pos"],
    canSeeRevenue: false, canSeeUsers: false, canSeeReports: false,
    canSeeInventory: false, canSeeCustomers: false, canSeeSystem: false, canSeeBranches: false,
    canCreate: [],
  },
};

const ROLE_ACCENT: Record<Role,string> = {
  superadmin: "#f59e0b", admin: "#22d3ee", manager: "#34d399", cashier: "#a78bfa",
};

const TAB_TO_PERM_KEY: Partial<Record<Tab, string>> = {
  pos: "pos", inventory: "inventory", sales: "salesReports",
  customers: "customers", orders: "orders", taxes: "taxes",
  payments: "payments", coupons: "payments", users: "userMgmt", data: "inventory",
};

const ALL_NAV_TABS: Tab[] = ["pos","inventory","sales","customers","orders","taxes","payments","coupons","users","data","settings"];

type ThemePreset = "ubuntu" | "windows11" | "linux" | "ocean" | "ember" | "custom";
/* Ambient glow colors (a/b/c) + page base bg per preset */
const PRESET_PAGE: Record<ThemePreset, { a:string; b:string; c:string; dark:string; light:string }> = {
  ubuntu:    { a:"#e95420", b:"#772953", c:"#f47424", dark:"#180600", light:"#fff7f4" },
  windows11: { a:"#0078d4", b:"#005a9e", c:"#0099bc", dark:"#202020", light:"#f3f3f3" },
  linux:     { a:"#22d3ee", b:"#a78bfa", c:"#34d399", dark:"#070b12", light:"#edf3fa" },
  ocean:     { a:"#0ea5e9", b:"#06b6d4", c:"#38bdf8", dark:"#030d1f", light:"#f0f9ff" },
  ember:     { a:"#f59e0b", b:"#ef4444", c:"#fbbf24", dark:"#1a0f00", light:"#fffbeb" },
  custom:    { a:"#22d3ee", b:"#a78bfa", c:"#34d399", dark:"#070b12", light:"#edf3fa" },
};

/* ═══════════════════════════════════════════════════════════
   CHART / MOCK CONSTANTS
═══════════════════════════════════════════════════════════ */
const DONUT_COLORS  = ["#111827","#374151","#6b7280","#9ca3af","#d1d5db"];
const ACCENT_COLORS = ["#22d3ee","#a78bfa","#34d399","#fb923c","#f87171","#fbbf24"];

/* ═══════════════════════════════════════════════════════════
   API HELPER (reads JWT from localStorage)
═══════════════════════════════════════════════════════════ */
let _layoutToastSeq = 0;
const nextLayoutToastId = () => ++_layoutToastSeq;

const apiCall = async (method: string, path: string, body?: unknown) => {
  let token: string | null = null;
  try {
    const stored = localStorage.getItem("pos_user");
    token = stored ? JSON.parse(stored)?.token : null;
  } catch { /* ignore */ }
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    localStorage.removeItem("pos_user");
    window.location.reload();
    throw new Error("Session expired — please log in again.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const umInitials = (name: string) => name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
const umTimeAgo  = (date: string|null): string => {
  if (!date) return "Never";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)     return "Just now";
  if (s < 3600)   return `${Math.floor(s/60)}m ago`;
  if (s < 86400)  return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(date).toLocaleDateString("en-US",{ month:"short", day:"numeric" });
};
const umFmtDate = (date: string|null) =>
  !date ? "—" : new Date(date).toLocaleDateString("en-US",{ year:"numeric", month:"short", day:"numeric" });
const AV_PAL = ["#f59e0b","#22d3ee","#34d399","#a78bfa","#fb923c","#f87171","#fbbf24","#6ee7b7"];
const avColor = (name: string) => AV_PAL[(name?.charCodeAt(0)??0) % AV_PAL.length];

/* ═══════════════════════════════════════════════════════════
   CHART TOOLTIP
═══════════════════════════════════════════════════════════ */
const ChartTooltip = ({ active, payload, label, dark }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: dark ? "rgba(16,18,27,0.92)" : "rgba(255,255,255,0.95)",
      border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
      borderRadius: 18, padding: "12px 14px", fontSize: 12,
      color: dark ? "#fff" : "#111",
      boxShadow: dark ? "0 18px 40px rgba(0,0,0,0.4)" : "0 18px 40px rgba(15,23,42,0.12)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>
      {label && <p style={{ color: dark?"#9aa3b2":"#64748b", marginBottom:6, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1.4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color, fontWeight: 700, margin: "4px 0" }}>
          {p.name}: {p.name?.toLowerCase().includes("rev")||p.name?.toLowerCase().includes("amount") ? "$" : ""}
          {typeof p.value === "number" ? p.value.toFixed(p.name?.toLowerCase().includes("rev")||p.name?.toLowerCase().includes("amount") ? 2 : 0) : p.value}
        </p>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   USER MANAGEMENT MODAL SHELL
═══════════════════════════════════════════════════════════ */
const ModalShell: React.FC<{ open:boolean; onClose:()=>void; title:string; width?:number; dark:boolean; children:React.ReactNode }> =
  ({ open, onClose, title, width=480, dark, children }) => {
  const card    = dark ? "rgba(16,18,27,0.96)"     : "rgba(255,255,255,0.98)";
  const border  = dark ? "rgba(255,255,255,0.08)"  : "#e4e4e7";
  const divider = dark ? "rgba(255,255,255,0.07)"  : "#f1f5f9";
  const text    = dark ? "#f0f0f8"                 : "#18181b";
  const sub     = dark ? "#94a3b8"                 : "#64748b";
  const inputBg = dark ? "rgba(255,255,255,0.06)"  : "#f8fafc";
  const overlay = dark ? "rgba(2,6,23,0.74)"       : "rgba(15,23,42,0.35)";
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          onClick={e=>e.target===e.currentTarget&&onClose()}
          style={{ position:"fixed",inset:0,zIndex:1000,background:overlay,backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <motion.div initial={{opacity:0,y:18,scale:0.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10,scale:0.97}}
            transition={{type:"spring",stiffness:300,damping:28}}
            style={{ background:card,border:`1px solid ${border}`,borderRadius:28,width:"100%",maxWidth:width,overflow:"hidden",boxShadow:dark?"0 32px 80px rgba(0,0,0,0.58)":"0 28px 70px rgba(15,23,42,0.18)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",position:"relative",maxHeight:"92vh",display:"flex",flexDirection:"column" }}>
            <div style={{ position:"absolute",inset:0,pointerEvents:"none",background:dark?"linear-gradient(180deg,rgba(255,255,255,0.045),transparent 40%)":"linear-gradient(180deg,rgba(255,255,255,0.8),transparent 38%)" }}/>
            <div style={{ position:"relative",zIndex:1,padding:"20px 26px 16px",borderBottom:`1px solid ${divider}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
              <span style={{ fontSize:15,fontWeight:700,color:text }}>{title}</span>
              <button onClick={onClose} style={{ border:"none",background:inputBg,borderRadius:"50%",width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:sub }}>
                <X size={14}/>
              </button>
            </div>
            <div style={{ position:"relative",zIndex:1,padding:26,overflowY:"auto",flex:1 }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ═══════════════════════════════════════════════════════════
   FORM INPUTS
═══════════════════════════════════════════════════════════ */
const UMField: React.FC<{ label:string; error?:string; children:React.ReactNode }> = ({ label, error, children }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:"block",fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#94a3b8",marginBottom:7 }}>{label}</label>
    {children}
    {error && <p style={{ margin:"5px 0 0",fontSize:11,color:"#ef4444" }}>{error}</p>}
  </div>
);

const UMInput: React.FC<{ value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; disabled?:boolean; dark:boolean }> =
  ({ value, onChange, placeholder, type="text", disabled, dark }) => {
  const [foc, setFoc] = useState(false);
  const border = dark ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const bg = dark ? "rgba(255,255,255,0.05)" : "#f8fafc";
  const textColor = dark ? "#f0f0f8" : "#18181b";
  return (
    <input type={type} value={value} placeholder={placeholder} disabled={disabled}
      onChange={e=>onChange(e.target.value)} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
      style={{ width:"100%",padding:"11px 13px",border:`1.5px solid ${foc?"#22d3ee":border}`,borderRadius:14,fontSize:13,outline:"none",color:textColor,background:foc?(dark?"rgba(16,18,27,0.96)":"#ffffff"):bg,fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.2s,background 0.2s,box-shadow 0.2s",opacity:disabled?0.5:1,boxShadow:foc?"0 0 0 4px rgba(34,211,238,0.12)":"none" }}/>
  );
};

const UMSelect: React.FC<{ value:string; onChange:(v:string)=>void; options:{value:string;label:string}[]; dark:boolean }> =
  ({ value, onChange, options, dark }) => {
  const border = dark ? "rgba(255,255,255,0.1)" : "#e2e8f0";
  const bg = dark ? "rgba(255,255,255,0.05)" : "#f8fafc";
  const textColor = dark ? "#f0f0f8" : "#18181b";
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{ width:"100%",padding:"11px 13px",border:`1.5px solid ${border}`,borderRadius:14,fontSize:13,outline:"none",color:textColor,background:bg,fontFamily:"inherit",boxSizing:"border-box",cursor:"pointer",appearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 12px center" }}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

/* ═══════════════════════════════════════════════════════════
   USER MANAGEMENT SMALL COMPONENTS
═══════════════════════════════════════════════════════════ */
const UMAvatar: React.FC<{ name:string; size?:number }> = ({ name, size=36 }) => {
  const c = avColor(name);
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",flexShrink:0,background:`linear-gradient(135deg,${c}ee,${c}55)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:size*0.33,fontFamily:"monospace",letterSpacing:"0.04em",boxShadow:`0 10px 24px ${c}33` }}>
      {umInitials(name)}
    </div>
  );
};

const UMRoleBadge: React.FC<{ role:Role }> = ({ role }) => {
  const c = ROLE_ACCENT[role]; const cfg = ROLE_CONFIG[role]; const Icon = cfg.icon;
  return (
    <span style={{ fontSize:9,fontWeight:700,padding:"4px 10px",borderRadius:20,background:c+"18",color:c,textTransform:"uppercase",letterSpacing:0.8,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap",border:`1px solid ${c}24` }}>
      <Icon size={9}/> {cfg.label}
    </span>
  );
};

const UMStatusDot: React.FC<{ status:Status }> = ({ status }) => (
  <span style={{ display:"inline-flex",alignItems:"center",gap:6 }}>
    <span style={{ width:7,height:7,borderRadius:"50%",background:status==="active"?"#22c55e":"#6b7280",boxShadow:status==="active"?"0 0 0 4px #22c55e22":"none" }}/>
    <span style={{ fontSize:11,fontWeight:700,color:status==="active"?"#22c55e":"#6b7280",textTransform:"capitalize" }}>{status}</span>
  </span>
);

/* ═══════════════════════════════════════════════════════════
   USER MANAGEMENT MODALS
═══════════════════════════════════════════════════════════ */
const UMFormModal: React.FC<{
  open:boolean; onClose:()=>void; dark:boolean;
  onSave:(d:UserFormData)=>Promise<void>; editUser:AppUser|null; currentRole:Role;
}> = ({ open, onClose, dark, onSave, editUser, currentRole }) => {
  const isEdit = !!editUser;
  const cfg = ROLE_CONFIG[currentRole];
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const textSub = dark ? "#94a3b8" : "#64748b";
  const [form, setForm] = useState<UserFormData>({ name:"",email:"",username:"",password:"",role:"cashier",status:"active" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (editUser) setForm({ name:editUser.name,email:editUser.email,username:editUser.username||"",password:"",role:editUser.role,status:editUser.status });
    else          setForm({ name:"",email:"",username:"",password:"",role:"cashier",status:"active" });
    setErrors({});
  }, [editUser, open]);
  const set = <K extends keyof UserFormData>(k:K) => (v:UserFormData[K]) => setForm(f=>({...f,[k]:v}));
  const roleOpts = cfg.canCreate.map(r=>({ value:r, label:ROLE_CONFIG[r].label }));
  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim())                                          e.name     = "Required";
    if (!form.email.trim()||!/\S+@\S+\.\S+/.test(form.email))      e.email    = "Valid email required";
    if (!form.username.trim())                                       e.username = "Required";
    if (!isEdit && form.password.length < 6)                        e.password = "Min 6 characters";
    setErrors(e); return !Object.keys(e).length;
  }
  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) delete (payload as Partial<UserFormData>).password;
      await onSave(payload); onClose();
    } catch(err) { setErrors({ submit:(err as Error).message }); }
    finally { setLoading(false); }
  }
  return (
    <ModalShell open={open} onClose={onClose} title={isEdit?"Edit User":"Create New User"} dark={dark}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <UMField label="Full Name" error={errors.name}><UMInput value={form.name} onChange={set("name")} placeholder="e.g. Sarah Johnson" dark={dark}/></UMField>
        <UMField label="Username" error={errors.username}><UMInput value={form.username} onChange={set("username")} placeholder="e.g. sarah_j" dark={dark}/></UMField>
      </div>
      <UMField label="Email" error={errors.email}><UMInput value={form.email} onChange={set("email")} placeholder="user@store.com" type="email" dark={dark}/></UMField>
      <UMField label={isEdit?"New Password (leave blank to keep)":"Password"} error={errors.password}>
        <UMInput value={form.password} onChange={set("password")} type="password" placeholder={isEdit?"Leave blank to keep":"Min 6 characters"} dark={dark}/>
      </UMField>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <UMField label="Role"><UMSelect value={form.role} onChange={v=>set("role")(v as Role)} options={roleOpts} dark={dark}/></UMField>
        <UMField label="Status"><UMSelect value={form.status} onChange={v=>set("status")(v as Status)} options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]} dark={dark}/></UMField>
      </div>
      {errors.submit && <div style={{ padding:"10px 14px",borderRadius:14,marginBottom:14,background:"#ef444418",border:"1px solid #ef444433",fontSize:12,color:"#ef4444" }}>{errors.submit}</div>}
      <div style={{ display:"flex",gap:10,marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:14,border:`1px solid ${cardBorder}`,background:"transparent",cursor:"pointer",fontSize:13,fontWeight:700,color:textSub }}>Cancel</button>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={submit} disabled={loading}
          style={{ flex:2,padding:"11px 0",borderRadius:14,border:"none",cursor:loading?"not-allowed":"pointer",fontSize:13,fontWeight:700,color:"#fff",background:loading?cfg.color+"66":cfg.gradient,boxShadow:`0 10px 24px ${cfg.color}33`,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          {loading&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
          {loading?"Saving…":isEdit?"Save Changes":"Create User"}
        </motion.button>
      </div>
    </ModalShell>
  );
};

const UMResetModal: React.FC<{ open:boolean; onClose:()=>void; dark:boolean; user:AppUser|null; onReset:(id:string,pwd:string)=>Promise<void> }> =
  ({ open, onClose, dark, user, onReset }) => {
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const textSub = dark ? "#94a3b8" : "#64748b";
  const textColor = dark ? "#f0f0f8" : "#18181b";
  const [pwd, setPwd] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(()=>{ setPwd(""); setConfirm(""); setError(""); },[open]);
  async function submit() {
    if (pwd.length<6) { setError("Min 6 characters"); return; }
    if (pwd!==confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try { await onReset(user!._id,pwd); onClose(); } catch(e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <ModalShell open={open} onClose={onClose} title="Reset Password" dark={dark} width={420}>
      <p style={{ margin:"0 0 20px",fontSize:13,color:textSub,lineHeight:1.6 }}>Set a new password for <strong style={{ color:textColor }}>{user?.name}</strong>.</p>
      <UMField label="New Password"><UMInput value={pwd} onChange={setPwd} type="password" placeholder="Min 6 characters" dark={dark}/></UMField>
      <UMField label="Confirm Password" error={error}><UMInput value={confirm} onChange={setConfirm} type="password" placeholder="Repeat password" dark={dark}/></UMField>
      <div style={{ display:"flex",gap:10,marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:14,border:`1px solid ${cardBorder}`,background:"transparent",cursor:"pointer",fontSize:13,fontWeight:700,color:textSub }}>Cancel</button>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={submit} disabled={loading}
          style={{ flex:2,padding:"11px 0",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff",background:dark?"linear-gradient(135deg,#f8fafc,#cbd5e1)":"linear-gradient(135deg,#18181b,#334155)",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          {loading&&<Loader2 size={13}/>} {loading?"Resetting…":"Reset Password"}
        </motion.button>
      </div>
    </ModalShell>
  );
};

const UMDeleteModal: React.FC<{ open:boolean; onClose:()=>void; dark:boolean; user:AppUser|null; onDelete:(id:string)=>Promise<void> }> =
  ({ open, onClose, dark, user, onDelete }) => {
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const textSub = dark ? "#94a3b8" : "#64748b";
  const textColor = dark ? "#f0f0f8" : "#18181b";
  const [loading, setLoading] = useState(false);
  async function submit() { setLoading(true); try { await onDelete(user!._id); onClose(); } finally { setLoading(false); } }
  return (
    <ModalShell open={open} onClose={onClose} title="Delete User" dark={dark} width={400}>
      <div style={{ textAlign:"center",padding:"8px 0 20px" }}>
        <div style={{ width:60,height:60,borderRadius:"50%",background:"#ef444418",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:"0 12px 28px rgba(239,68,68,0.18)" }}>
          <Trash2 size={24} style={{ color:"#ef4444" }}/>
        </div>
        <p style={{ margin:"0 0 6px",fontSize:15,fontWeight:700,color:textColor }}>Delete this user?</p>
        <p style={{ margin:0,fontSize:13,color:textSub,lineHeight:1.6 }}><strong style={{ color:textColor }}>{user?.name}</strong>'s account will be permanently removed.</p>
      </div>
      <div style={{ display:"flex",gap:10 }}>
        <button onClick={onClose} style={{ flex:1,padding:"11px 0",borderRadius:14,border:`1px solid ${cardBorder}`,background:"transparent",cursor:"pointer",fontSize:13,fontWeight:700,color:textSub }}>Cancel</button>
        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={submit} disabled={loading}
          style={{ flex:1,padding:"11px 0",borderRadius:14,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#ef4444,#dc2626)",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          {loading&&<Loader2 size={13}/>} {loading?"Deleting…":"Delete"}
        </motion.button>
      </div>
    </ModalShell>
  );
};

const UMDetailModal: React.FC<{ open:boolean; onClose:()=>void; dark:boolean; user:AppUser|null }> =
  ({ open, onClose, dark, user }) => {
  const cardBorder = dark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const divider = dark ? "rgba(255,255,255,0.07)" : "#f1f5f9";
  const textColor = dark ? "#f0f0f8" : "#18181b";
  const textMuted = dark ? "#94a3b8" : "#94a3b8";
  const inputBg = dark ? "rgba(255,255,255,0.04)" : "#f8fafc";
  if (!user) return null;
  const cfg = ROLE_CONFIG[user.role];
  const rows: [string, React.ReactNode][] = [
    ["Username", <span style={{ fontFamily:"monospace",fontSize:12 }}>@{user.username}</span>],
    ["Email",    <span style={{ fontFamily:"monospace",fontSize:12 }}>{user.email}</span>],
    ["Role",     <UMRoleBadge role={user.role}/>],
    ["Status",   <UMStatusDot status={user.status}/>],
    ["Joined",   umFmtDate(user.createdAt)],
    ["Last Login", umTimeAgo(user.lastLogin)],
    ["Created By", user.createdBy?.name ?? "System"],
    ["Password", <span style={{ fontSize:11,color:"#22c55e",fontWeight:700 }}>🔒 bcrypt encrypted</span>],
  ];
  return (
    <ModalShell open={open} onClose={onClose} title="User Details" dark={dark} width={440}>
      <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:22,padding:"16px 18px",borderRadius:18,background:cfg.color+(dark?"16":"0e"),border:`1px solid ${cfg.color}22`,boxShadow:`0 12px 32px ${cfg.color}12` }}>
        <UMAvatar name={user.name} size={52}/>
        <div>
          <div style={{ fontWeight:800,fontSize:18,color:textColor }}>{user.name}</div>
          <div style={{ fontSize:12,color:textMuted,marginTop:2 }}>@{user.username} · {user.email}</div>
          <div style={{ marginTop:7 }}><UMRoleBadge role={user.role}/></div>
        </div>
      </div>
      <div style={{ borderRadius:16,border:`1px solid ${cardBorder}`,overflow:"hidden" }}>
        {rows.map(([k,v],i)=>(
          <div key={String(k)} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:i%2===0?inputBg:"transparent",borderBottom:i<rows.length-1?`1px solid ${divider}`:"none" }}>
            <span style={{ fontSize:10,color:textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5 }}>{k}</span>
            <span style={{ fontSize:12,color:textColor,fontWeight:500 }}>{v}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};

/* ═══════════════════════════════════════════════════════════
   UM TOAST
═══════════════════════════════════════════════════════════ */
const UMToast: React.FC<{ toasts:ToastItem[]; remove:(id:number)=>void }> = ({ toasts, remove }) => (
  <div style={{ position:"fixed",bottom:24,right:24,zIndex:2000,display:"flex",flexDirection:"column",gap:8 }}>
    <AnimatePresence>
      {toasts.map(item=>(
        <motion.div key={item.id} initial={{opacity:0,x:30,scale:0.9}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:30,scale:0.9}}
          style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:16,maxWidth:320,minWidth:220,background:item.type==="error"?"rgba(239,68,68,0.12)":"rgba(34,197,94,0.12)",border:`1px solid ${item.type==="error"?"rgba(239,68,68,0.22)":"rgba(34,197,94,0.22)"}`,boxShadow:"0 14px 34px rgba(15,23,42,0.16)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)" }}>
          {item.type==="error" ? <XCircle size={15} style={{ color:"#ef4444",flexShrink:0 }}/> : <CheckCircle2 size={15} style={{ color:"#22c55e",flexShrink:0 }}/>}
          <span style={{ fontSize:13,fontWeight:600,color:item.type==="error"?"#ef4444":"#22c55e",flex:1 }}>{item.msg}</span>
          <button onClick={()=>remove(item.id)} style={{ border:"none",background:"none",cursor:"pointer",color:"#94a3b8",padding:0 }}><X size={13}/></button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   USER MANAGEMENT COMPONENT — REAL API
═══════════════════════════════════════════════════════════ */
const UserManagementComponent: React.FC<{ dark: boolean }> = ({ dark }) => {
  const { preset } = useThemeConfig();
  const pg = PRESET_PAGE[preset] ?? PRESET_PAGE.linux;
  const stored      = localStorage.getItem("pos_user");
  const parsedUser  = stored ? JSON.parse(stored) : null;
  const sessionRole = (parsedUser?.role || "admin") as Role;
  const cfg = ROLE_CONFIG[sessionRole];
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const t = dark ? {
    bg: pg.dark,
    page:`radial-gradient(circle at top right, ${pg.a}22, transparent 32%), radial-gradient(circle at bottom left, ${pg.b}22, transparent 30%), ${pg.dark}`,
    card:"rgba(15,18,28,0.76)", cardBorder:"rgba(255,255,255,0.08)", cardBorderStrong:"rgba(255,255,255,0.12)",
    text:"#f8fafc", textMuted:"#8ea0b7", textSub:"#b3bfce",
    divider:"rgba(255,255,255,0.07)", tableHead:"rgba(255,255,255,0.03)",
    input:"rgba(255,255,255,0.05)", rowHover:"rgba(255,255,255,0.03)",
    inputBorder:"rgba(255,255,255,0.12)", inputText:"#f8fafc",
    shadow:"0 20px 50px rgba(0,0,0,0.3)",
  } : {
    bg: pg.light,
    page:`radial-gradient(circle at top right, ${pg.a}2e, transparent 28%), radial-gradient(circle at bottom left, ${pg.b}26, transparent 28%), ${pg.light}`,
    card:"rgba(255,255,255,0.86)", cardBorder:"rgba(15,23,42,0.08)", cardBorderStrong:"rgba(15,23,42,0.12)",
    text:"#0f172a", textMuted:"#64748b", textSub:"#475569",
    divider:"#eef2f7", tableHead:"rgba(15,23,42,0.03)",
    input:"#f8fafc", rowHover:"#f8fafc",
    inputBorder:"#dbe4f0", inputText:"#0f172a",
    shadow:"0 16px 40px rgba(15,23,42,0.08)",
  };
  const [users, setUsers]                   = useState<AppUser[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [roleFilter, setRoleFilter]         = useState<Role|"all">("all");
  const [statusFilter, setStatusFilter]     = useState<Status|"all">("all");
  const [toasts, setToasts]                 = useState<ToastItem[]>([]);
  const [modals, setModals]                 = useState<ModalState>({ create:false,edit:null,delete:null,reset:null,detail:null });

  const addToast = useCallback((msg:string, type:"success"|"error"="success")=>{
    const id = nextLayoutToastId();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(x=>x.id!==id)),3500);
  },[]);

  const cm = useCallback(<K extends keyof ModalState>(k:K, v:ModalState[K])=>
    setModals(m=>({...m,[k]:v})),[]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter   !== "all") params.set("role",   roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search)                  params.set("search", search);
      const data = await apiCall("GET", `/users?${params}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch(err:any) { addToast(err.message||"Failed to load users","error"); }
    finally { setLoading(false); }
  }, [roleFilter, statusFilter, search, addToast]);

  useEffect(()=>{ fetchUsers(); },[fetchUsers]);

  const handleCreate = async (data:UserFormData) => {
    await apiCall("POST","/users",data);
    addToast(`${data.name} created successfully`);
    fetchUsers();
  };
  const handleEdit = async (data:UserFormData) => {
    await apiCall("PUT",`/users/${modals.edit!._id}`,data);
    addToast("User updated successfully");
    fetchUsers();
  };
  const handleDelete = async (id:string) => {
    await apiCall("DELETE",`/users/${id}`);
    addToast("User deleted");
    fetchUsers();
  };
  const handleToggle = async (user:AppUser) => {
    await apiCall("PATCH",`/users/${user._id}/status`);
    addToast(`${user.name} status toggled`);
    fetchUsers();
  };
  const handleReset = async (id:string, pwd:string) => {
    await apiCall("PATCH",`/users/${id}/password`,{ password:pwd });
    addToast("Password reset successfully");
  };

  const filtered = users.filter(u => u.role !== "superadmin" || sessionRole === "superadmin");
  const stats = {
    total:    users.length,
    active:   users.filter(u=>u.status==="active").length,
    admins:   users.filter(u=>u.role==="admin").length,
    managers: users.filter(u=>u.role==="manager").length,
    cashiers: users.filter(u=>u.role==="cashier").length,
  };

  const Surface: React.FC<{ children:React.ReactNode; style?:React.CSSProperties }> = ({ children, style }) => (
    <div style={{ background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:28,boxShadow:t.shadow,backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",position:"relative",overflow:"hidden",...style }}>
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",background:dark?"linear-gradient(180deg,rgba(255,255,255,0.035),transparent 38%)":"linear-gradient(180deg,rgba(255,255,255,0.75),transparent 38%)" }}/>
      <div style={{ position:"relative",zIndex:1 }}>{children}</div>
    </div>
  );

  const ABtn: React.FC<{ icon:React.ElementType; title:string; onClick:()=>void; danger?:boolean }> = ({ icon:Icon, title, onClick, danger=false }) => {
    const [hov,setHov] = useState(false);
    return (
      <button title={title} onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{ border:`1px solid ${hov?(danger?"rgba(239,68,68,0.25)":t.cardBorderStrong):"transparent"}`,cursor:"pointer",borderRadius:10,padding:"6px 7px",background:hov?(danger?"rgba(239,68,68,0.12)":t.input):"transparent",color:danger?"#ef4444":t.textSub,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>
        <Icon size={13}/>
      </button>
    );
  };

  const SC: React.FC<{ label:string; value:number; accent:string; icon:React.ElementType; sub:string }> = ({ label,value,accent,icon:Icon,sub }) => (
    <Surface style={{ padding:24 }}>
      <div style={{ position:"absolute",top:-16,right:-10,width:72,height:72,borderRadius:"50%",background:accent,opacity:dark?0.12:0.09,filter:"blur(20px)" }}/>
      <div style={{ position:"absolute",left:0,top:0,width:"100%",height:4,background:`linear-gradient(90deg,${accent},transparent)` }}/>
      <div style={{ width:48,height:48,borderRadius:16,background:accent+(dark?"20":"14"),display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,border:`1px solid ${accent}22` }}>
        <Icon size={21} style={{ color:accent }}/>
      </div>
      <div style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:2,color:t.textMuted,marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:30,fontWeight:800,color:t.text,lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11,color:accent,marginTop:7,fontWeight:700 }}>{sub}</div>
    </Surface>
  );

  return (
    <div style={{ height:"100%",overflowY:"auto",background:t.page,transition:"background 0.3s" }}>
      {/* Header */}
      <div style={{ padding:isMobile?"12px 14px":"18px 28px",borderBottom:`1px solid ${t.divider}`,background:dark?"rgba(11,15,24,0.72)":"rgba(243,247,251,0.76)",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",justifyContent:"space-between",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",position:"sticky",top:0,zIndex:50 }}>
        <div>
          <h1 style={{ margin:0,color:t.text,fontSize:22,fontWeight:800,letterSpacing:-0.4 }}>User Management</h1>
          <p style={{ margin:"4px 0 0",color:t.textMuted,fontSize:12 }}>Manage staff · passwords are bcrypt-encrypted · changes sync to database</p>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:14,background:cfg.color+"14",border:`1px solid ${cfg.color}30` }}>
            {React.createElement(cfg.icon,{size:12,style:{color:cfg.color}})}
            <span style={{ fontSize:11,fontWeight:700,color:cfg.color }}>{cfg.label}</span>
          </div>
          <button onClick={fetchUsers} style={{ padding:10,background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",backdropFilter:"blur(12px)" }}>
            <RefreshCw size={14} style={{ color:t.textSub }}/>
          </button>
          {cfg.canCreate.length > 0 && (
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>cm("create",true)}
              style={{ display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:14,border:"none",background:cfg.gradient,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:`0 10px 24px ${cfg.color}33` }}>
              <Plus size={15}/> New User
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ padding:isMobile?"16px 14px 24px":"26px 28px 30px",display:"flex",flexDirection:"column",gap:22 }}>
        {/* Security badge */}
        <div style={{ background:dark?"#22c55e10":"#f0fdf4",border:"1px solid #22c55e30",borderRadius:14,padding:"11px 18px",display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e88",flexShrink:0 }}/>
          <span style={{ fontSize:12,color:"#22c55e",fontWeight:600 }}>🔒 Passwords are stored using bcrypt (cost 12) — never plain text. All changes are saved to MongoDB in real-time.</span>
        </div>

        {/* Stat cards */}
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:18 }}>
          {[
            { label:"Total Staff",  value:stats.total,    accent:"#22d3ee", icon:Users,        sub:`${stats.active} active`  },
            { label:"Admins",       value:stats.admins,   accent:"#f59e0b", icon:Shield,       sub:"Full access"             },
            { label:"Managers",     value:stats.managers, accent:"#34d399", icon:Store,        sub:"Reports & staff"         },
            { label:"Cashiers",     value:stats.cashiers, accent:"#a78bfa", icon:ShoppingCart, sub:"POS terminal only"       },
          ].map((c,i)=>(
            <motion.div key={c.label} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:i*0.07,type:"spring",stiffness:200}}>
              <SC {...c}/>
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <Surface style={{ padding:"16px 18px",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center" }}>
          <div style={{ flex:"1 1 220px",position:"relative" }}>
            <Search size={13} style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:t.textMuted,pointerEvents:"none" }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, username or email…"
              style={{ width:"100%",padding:"10px 13px 10px 34px",border:`1.5px solid ${t.inputBorder}`,borderRadius:14,fontSize:13,outline:"none",color:t.inputText,background:t.input,fontFamily:"inherit",boxSizing:"border-box",transition:"border-color 0.2s,box-shadow 0.2s" }}
              onFocus={e=>{e.target.style.borderColor="#22d3ee";e.target.style.boxShadow="0 0 0 4px rgba(34,211,238,0.12)"}}
              onBlur={e=>{e.target.style.borderColor=t.inputBorder;e.target.style.boxShadow="none"}}/>
          </div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {(["all",...cfg.canCreate] as (Role|"all")[]).map(r=>{
              const active = roleFilter===r;
              const color  = r==="all"?(dark?"#f8fafc":"#0f172a"):ROLE_ACCENT[r];
              return (
                <button key={r} onClick={()=>setRoleFilter(r)}
                  style={{ padding:"7px 13px",borderRadius:999,border:`1.5px solid ${active?color:t.cardBorder}`,background:active?color:"transparent",color:active?"#fff":t.textMuted,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.18s" }}>
                  {r==="all"?"All Roles":ROLE_CONFIG[r].label}
                </button>
              );
            })}
          </div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as Status|"all")}
            style={{ padding:"10px 13px",border:`1.5px solid ${t.inputBorder}`,borderRadius:14,fontSize:12,outline:"none",color:t.inputText,background:t.input,fontFamily:"inherit",cursor:"pointer" }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div style={{ color:t.textMuted,fontSize:11,marginLeft:"auto",fontWeight:700 }}>
            {loading?"Loading…":`${filtered.length} user${filtered.length!==1?"s":""}`}
          </div>
        </Surface>

        {/* Table */}
        <Surface style={{ overflow:"hidden" }}>
          <div style={{ display:"grid",gridTemplateColumns:"2fr 1.6fr 1.1fr 1fr 1fr 120px",padding:"13px 24px",background:t.tableHead,borderBottom:`1px solid ${t.divider}` }}>
            {["User","Email / Username","Role","Status","Last Login","Actions"].map(h=>(
              <span key={h} style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:2,color:t.textMuted }}>{h}</span>
            ))}
          </div>
          {loading ? (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 20px",gap:12,color:t.textMuted }}>
              <Loader2 size={20} style={{ animation:"spin 1s linear infinite" }}/> Loading users…
            </div>
          ) : filtered.length===0 ? (
            <div style={{ textAlign:"center",padding:"60px 20px" }}>
              <div style={{ width:56,height:56,borderRadius:"50%",background:t.input,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px" }}>
                <Search size={22} style={{ color:t.textMuted }}/>
              </div>
              <div style={{ fontWeight:700,fontSize:15,color:t.text }}>No users found</div>
              <div style={{ fontSize:12,color:t.textMuted,marginTop:5 }}>Try adjusting your search or filters</div>
            </div>
          ) : filtered.map((u,i)=>(
            <motion.div key={u._id} initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
              style={{ display:"grid",gridTemplateColumns:"2fr 1.6fr 1.1fr 1fr 1fr 120px",padding:"14px 24px",alignItems:"center",borderBottom:i<filtered.length-1?`1px solid ${t.divider}`:"none",transition:"background 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.background=t.rowHover)}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <div style={{ display:"flex",alignItems:"center",gap:11 }}>
                <UMAvatar name={u.name} size={38}/>
                <div>
                  <div style={{ fontWeight:700,fontSize:13,color:t.text }}>{u.name}</div>
                  <div style={{ fontSize:10,color:t.textMuted,marginTop:2 }}>Joined {umFmtDate(u.createdAt)}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:12,color:t.textSub,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{u.email}</div>
                <div style={{ fontSize:10,color:t.textMuted,marginTop:1 }}>@{u.username}</div>
              </div>
              <UMRoleBadge role={u.role}/>
              <button onClick={()=>void handleToggle(u)} title="Click to toggle" style={{ border:"none",background:"none",cursor:"pointer",padding:0,textAlign:"left" }}>
                <UMStatusDot status={u.status}/>
              </button>
              <span style={{ fontSize:11,color:t.textMuted,display:"flex",alignItems:"center",gap:4 }}>
                <Clock size={10} style={{ color:t.textMuted }}/>{umTimeAgo(u.lastLogin)}
              </span>
              <div style={{ display:"flex",gap:2 }}>
                <ABtn icon={Eye}         title="View details"   onClick={()=>cm("detail",u)}/>
                <ABtn icon={UserCircle2} title="Edit user"      onClick={()=>cm("edit",u)}/>
                <ABtn icon={KeyRound}    title="Reset password" onClick={()=>cm("reset",u)}/>
                <ABtn icon={Trash2}      title="Delete user"    onClick={()=>cm("delete",u)} danger/>
              </div>
            </motion.div>
          ))}
          {filtered.length>0 && (
            <div style={{ padding:"12px 24px",borderTop:`1px solid ${t.divider}`,background:t.tableHead,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <span style={{ fontSize:11,color:t.textMuted }}>Showing {filtered.length} of {users.length} users</span>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 6px #22c55e88" }}/>
                <span style={{ fontSize:10,color:"#22c55e",fontWeight:700 }}>{stats.active} active</span>
              </div>
            </div>
          )}
        </Surface>

        {/* Permissions matrix */}
        {(sessionRole==="superadmin"||sessionRole==="admin") && (
          <Surface style={{ padding:28 }}>
            <div style={{ color:t.text,fontWeight:800,fontSize:18,marginBottom:4 }}>Role Permissions</div>
            <div style={{ color:t.textMuted,fontSize:11,marginBottom:20 }}>Access matrix for each role in your POS system</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                <thead>
                  <tr style={{ background:t.tableHead }}>
                    {["Role","POS","Inventory","Sales","Customers","Payments","Orders","Taxes","User Mgmt"].map(h=>(
                      <th key={h} style={{ padding:"10px 16px",textAlign:"left",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:t.textMuted,borderBottom:`1px solid ${t.divider}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["superadmin","admin","manager","cashier"] as Role[]).map(role=>{
                    const perms: Record<Role,boolean[]> = {
                      superadmin:[true,true,true,true,true,true,true,true],
                      admin:     [true,true,true,true,true,true,true,true],
                      manager:   [true,true,true,true,true,true,true,false],
                      cashier:   [true,false,false,false,false,false,false,false],
                    };
                    return (
                      <tr key={role} style={{ borderBottom:`1px solid ${t.divider}` }}
                        onMouseEnter={e=>(e.currentTarget.style.background=t.rowHover)}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <td style={{ padding:"12px 16px" }}><UMRoleBadge role={role}/></td>
                        {perms[role].map((ok,pi)=>(
                          <td key={pi} style={{ padding:"12px 16px" }}>
                            {ok ? <CheckCircle2 size={14} style={{ color:"#22c55e" }}/> : <XCircle size={14} style={{ color:dark?"rgba(255,255,255,0.18)":"rgba(15,23,42,0.16)" }}/>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Surface>
        )}
      </div>

      {/* Modals */}
      <UMFormModal   open={modals.create}   onClose={()=>cm("create",false)} dark={dark} onSave={handleCreate} editUser={null}        currentRole={sessionRole}/>
      <UMFormModal   open={!!modals.edit}   onClose={()=>cm("edit",null)}    dark={dark} onSave={handleEdit}   editUser={modals.edit} currentRole={sessionRole}/>
      <UMDeleteModal open={!!modals.delete} onClose={()=>cm("delete",null)}  dark={dark} user={modals.delete}  onDelete={handleDelete}/>
      <UMResetModal  open={!!modals.reset}  onClose={()=>cm("reset",null)}   dark={dark} user={modals.reset}   onReset={handleReset}/>
      <UMDetailModal open={!!modals.detail} onClose={()=>cm("detail",null)}  dark={dark} user={modals.detail}/>
      <UMToast toasts={toasts} remove={id=>setToasts(p=>p.filter(x=>x.id!==id))}/>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN LAYOUT
═══════════════════════════════════════════════════════════ */
export const DashboardLayout: React.FC<Props> = ({
  user, activeTab, setActiveTab, onLogout, children,
}) => {
  const { mode, preset, isDark, setMode } = useThemeConfig();
  const { formatCurrency } = useAppSettings();
  const role   = (user.role in ROLE_CONFIG ? user.role : "cashier") as Role;
  const config = ROLE_CONFIG[role];
  const pg = PRESET_PAGE[preset] ?? PRESET_PAGE.linux;

  const [stats, setStats]             = useState({ revenue:0, salesCount:0, customerCount:0, lowStockCount:0, myTodaySales:0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [allSales, setAllSales]       = useState<any[]>([]);
  const [products, setProducts]       = useState<any[]>([]);
  const [chartData, setChartData]     = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [staffUsers, setStaffUsers]   = useState<any[]>([]);
  const [userPerms, setUserPerms]     = useState<Record<string,boolean>|null>(null);
  const [loading, setLoading]         = useState(true);
  const [showDash, setShowDash]       = useState(false);
  const [time, setTime]               = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [serverNotifs, setServerNotifs]   = useState<any[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("pos_sidebar_collapsed") === "true"
  );
  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(v => {
      localStorage.setItem("pos_sidebar_collapsed", String(!v));
      return !v;
    });
  };
  const unreadCount = notifications.filter(n=>!n.read).length + serverNotifs.filter(n=>!n.read).length;
  const dark = isDark;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* Derive which tabs the logged-in user can actually access.
     Superadmin always gets every tab — no overrides apply. */
  const accessibleTabs = useMemo(()=>{
    if (role === "superadmin") return ALL_NAV_TABS;
    if (!userPerms) return config.navItems;
    return ALL_NAV_TABS.filter(tab=>{
      const permKey = TAB_TO_PERM_KEY[tab];
      if (!permKey) return config.navItems.includes(tab); // settings — role-based only
      return userPerms[permKey] === true;
    });
  },[role, userPerms, config.navItems]);

  useEffect(()=>{
    loadData();
    const tick = setInterval(()=>setTime(new Date()),60000);
    return ()=>clearInterval(tick);
  },[]);

  /* Fetch effective permissions (role defaults merged with per-user overrides) */
  useEffect(()=>{
    const fetchPerms = async () => {
      try {
        const stored = localStorage.getItem("pos_user");
        const token = stored ? JSON.parse(stored)?.token : null;
        if (!token) return;
        const res = await fetch("/api/my-permissions",{ headers:{ Authorization:`Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.permissions) setUserPerms(data.permissions);
      } catch { /* ignore */ }
    };
    fetchPerms();
  },[]);

  /* If the current tab is locked after permissions load, redirect to first accessible */
  useEffect(()=>{
    if (!userPerms) return;
    if (!accessibleTabs.includes(activeTab) && accessibleTabs.length > 0) {
      setActiveTab(accessibleTabs[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userPerms]);

  const notificationKey = `pos_notifications_${user.username}`;
  const pushNotification = useCallback((title: string, message: string) => {
    setNotifications((prev) => {
      const next: NotificationItem[] = [
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, title, message, createdAt: new Date().toISOString(), read: false },
        ...prev,
      ].slice(0, 100);
      localStorage.setItem(notificationKey, JSON.stringify(next));
      return next;
    });
  }, [notificationKey]);

  /* ── Server-side notification helpers ── */
  const getToken = () => { try { const s=localStorage.getItem("pos_user"); return s?JSON.parse(s)?.token:null; } catch{ return null; } };

  const fetchServerNotifs = useCallback(async () => {
    const token = getToken(); if (!token) return;
    try {
      const res = await fetch("/api/notifications?limit=50", { headers:{ Authorization:`Bearer ${token}` } });
      if (res.ok) setServerNotifs(await res.json());
    } catch { /* ignore */ }
  }, []);

  const markServerNotifRead = useCallback(async (id: string) => {
    const token = getToken(); if (!token) return;
    setServerNotifs(prev => prev.map(n => n._id===id ? {...n, read:true} : n));
    try { await fetch(`/api/notifications/${id}/read`, { method:"PATCH", headers:{ Authorization:`Bearer ${token}` } }); } catch { /* ignore */ }
  }, []);

  const markAllServerNotifsRead = useCallback(async () => {
    const token = getToken(); if (!token) return;
    setServerNotifs(prev => prev.map(n => ({...n, read:true})));
    try { await fetch("/api/notifications/read-all", { method:"PATCH", headers:{ Authorization:`Bearer ${token}` } }); } catch { /* ignore */ }
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem(notificationKey, JSON.stringify(next));
      return next;
    });
    markAllServerNotifsRead();
  }, [notificationKey, markAllServerNotifsRead]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem(notificationKey, JSON.stringify(next));
      return next;
    });
  }, [notificationKey]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(notificationKey);
      if (saved) setNotifications(JSON.parse(saved));
    } catch {
      setNotifications([]);
    }
  }, [notificationKey]);

  useEffect(() => subscribeAppNotifications((title, message) => {
    pushNotification(title, message);
  }), [pushNotification]);


  /* Poll server notifications every 30 s */
  useEffect(() => {
    fetchServerNotifs();
    const interval = setInterval(fetchServerNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchServerNotifs]);

  const safeJson = async (res: Response): Promise<any> => {
    try {
      const text = await res.text();
      if (!text||text.trimStart().startsWith("<")) return null;
      return JSON.parse(text);
    } catch { return null; }
  };

  const loadData = async () => {
    try {
      const today=new Date(), lastWeek=new Date(today);
      lastWeek.setDate(today.getDate()-7);
      const startDate=lastWeek.toISOString().split("T")[0];
      const endDate=today.toISOString().split("T")[0];
      const todayStr=today.toISOString().split("T")[0];

      const [customersRes,productsRes,salesRes,reportsRes] = await Promise.all([
        fetch("/api/customers").catch(()=>null),
        fetch("/api/products").catch(()=>null),
        fetch("/api/sales?limit=100").catch(()=>null),
        fetch(`/api/sales/reports/summary?from=${startDate}&to=${endDate}`).catch(()=>null),
      ]);

      const customersData = customersRes ? await safeJson(customersRes) : null;
      const productsData  = productsRes  ? await safeJson(productsRes)  : null;
      const salesData     = salesRes     ? await safeJson(salesRes)     : null;
      const reportsData   = reportsRes   ? await safeJson(reportsRes)   : null;

      const salesArray     = Array.isArray(salesData)     ? salesData     : [];
      const productsArray  = Array.isArray(productsData)  ? productsData  : [];
      const customersArray = Array.isArray(customersData) ? customersData : [];

      const todaySales = salesArray.filter((s:any)=>
        (s.timestamp||s.createdAt||"").startsWith(todayStr)
      );

      const revenue    = reportsData?.totalRevenue   ?? todaySales.reduce((s:number,x:any)=>s+(x.total||0),0);
      const salesCount = reportsData?.totalTransactions ?? todaySales.length;

      setStats({
        revenue,
        salesCount,
        customerCount:  customersArray.length,
        lowStockCount:  productsArray.filter((p:any)=>p.quantity<=(p.lowStockThreshold??10)).length,
        myTodaySales:   todaySales.length,
      });

      const apiChartData = reportsData?.revenueChartData
        ?? reportsData?.dailySales?.map((d:any)=>({ date:d._id, amount:d.revenue, sales:d.count }))
        ?? [];
      setChartData(apiChartData);
      setTopProducts(reportsData?.topProducts ?? []);
      setRecentSales(salesArray.slice(0,6));
      setAllSales(salesArray);
      setProducts(productsArray);
    } catch(e){ console.error("Dashboard load error:",e); }
    finally { setLoading(false); }
  };

  const trendData = useMemo(()=>{
    if (chartData.length>0) return chartData;
    const map: Record<string,{revenue:number;sales:number}> = {};
    allSales.forEach((s:any)=>{
      const d=(s.timestamp||s.createdAt||"").slice(0,10);
      if(!map[d]) map[d]={revenue:0,sales:0};
      map[d].revenue+=s.total||0;
      map[d].sales+=1;
    });
    return Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const key=d.toISOString().split("T")[0];
      return { date:key, day:d.toLocaleDateString("en-US",{weekday:"short"}), amount:map[key]?.revenue||0, revenue:map[key]?.revenue||0, sales:map[key]?.sales||0 };
    });
  },[chartData,allSales]);

  const categoryData = useMemo(()=>{
    const map:Record<string,number>={};
    products.forEach((p:any)=>{ map[p.category||"Other"]=(map[p.category||"Other"]||0)+1; });
    return Object.entries(map).map(([name,value])=>({name,value}));
  },[products]);

  const stockData = useMemo(()=>
    [...products].sort((a:any,b:any)=>a.quantity-b.quantity).slice(0,6)
    .map((p:any)=>({ name:p.name?.slice(0,10), qty:p.quantity, threshold:p.lowStockThreshold||10 }))
  ,[products]);

  // ✅ Payment data with friendly label names (JazzCash, Easypaisa, etc.)
  const paymentData = useMemo(()=>{
    const map:Record<string,number>={};
    const labelMap:Record<string,string> = {
      cash:"Cash", card:"Card", card_credit:"Credit Card", card_debit:"Debit Card",
      mobile_wallet:"Mobile Wallet", bank_transfer:"Bank Transfer",
      jazzcash:"JazzCash", easypaisa:"Easypaisa",
      sadapay:"SadaPay", nayapay:"NayaPay", other:"Other",
    };
    allSales.forEach((s:any)=>{
      const raw=s.paymentMethod||"cash";
      const m=labelMap[raw]||(raw.charAt(0).toUpperCase()+raw.slice(1));
      map[m]=(map[m]||0)+1;
    });
    return Object.entries(map).map(([name,value])=>({ name, value }));
  },[allSales]);

  const weekTrends = useMemo(()=>{
    const now = Date.now();
    const sevenDays = 7*24*60*60*1000;
    const curStart  = now - sevenDays;
    const prevStart = now - 2*sevenDays;
    const cur  = allSales.filter((s:any)=>new Date(s.timestamp||s.createdAt||0).getTime()>=curStart);
    const prev = allSales.filter((s:any)=>{ const ts=new Date(s.timestamp||s.createdAt||0).getTime(); return ts>=prevStart&&ts<curStart; });
    const curRev  = cur.reduce((s:number,x:any)=>s+(x.total||0),0);
    const prevRev = prev.reduce((s:number,x:any)=>s+(x.total||0),0);
    const revD  = prevRev===0 ? (curRev>0?100:0) : ((curRev-prevRev)/prevRev*100);
    const salD  = prev.length===0 ? (cur.length>0?100:0) : ((cur.length-prev.length)/prev.length*100);
    return {
      revenueChange:`${revD>=0?"+":""}${revD.toFixed(1)}%`, revenueUp:revD>=0,
      salesChange:`${salD>=0?"+":""}${salD.toFixed(1)}%`,   salesUp:salD>=0,
    };
  },[allSales]);

  useEffect(()=>{
    if (role==="superadmin"||role==="admin") {
      const stored = localStorage.getItem("pos_user");
      const token  = stored ? JSON.parse(stored)?.token : null;
      fetch("/api/users?limit=10", { headers:{ "Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) } })
        .then(r=>r.ok?r.json():null)
        .then(data=>{ if(Array.isArray(data)) setStaffUsers(data.slice(0,6)); })
        .catch(()=>{});
    }
  },[role]);

  const t = dark ? {
    bg: pg.dark,
    page:`radial-gradient(circle at 15% 10%,${pg.a}22,transparent 25%),radial-gradient(circle at 85% 18%,${pg.b}26,transparent 25%),radial-gradient(circle at 50% 85%,${pg.c}22,transparent 22%),${pg.dark}`,
    card:"rgba(15,18,28,0.76)", cardSolid:"#111622",
    cardBorder:"rgba(255,255,255,0.08)", cardBorderStrong:"rgba(255,255,255,0.12)",
    text:"#f8fafc", textMuted:"#7f8ea3", textSub:"#b3bfce",
    divider:"rgba(255,255,255,0.07)", tableHead:"rgba(255,255,255,0.03)",
    sidebar:"rgba(10,13,20,0.76)", sidebarBorder:"rgba(255,255,255,0.08)",
    pill:{ activeBg:"rgba(255,255,255,0.92)", activeText:pg.dark, text:"#94a3b8", hover:"rgba(255,255,255,0.06)" },
    chartGrid:"rgba(255,255,255,0.06)", chartAxis:"#7f8ea3",
    badge:{ bg:`${pg.a}18`, text:`${pg.a}ee`, border:`${pg.a}30` },
    input:"rgba(255,255,255,0.05)", restricted:"rgba(239,68,68,0.08)", rowHover:"rgba(255,255,255,0.03)",
    shadow:"0 20px 50px rgba(0,0,0,0.32)",
  } : {
    bg: pg.light,
    page:`radial-gradient(circle at 15% 10%,${pg.a}33,transparent 25%),radial-gradient(circle at 85% 18%,${pg.b}2a,transparent 25%),radial-gradient(circle at 50% 85%,${pg.c}2a,transparent 22%),${pg.light}`,
    card:"rgba(255,255,255,0.86)", cardSolid:"#ffffff",
    cardBorder:"rgba(15,23,42,0.08)", cardBorderStrong:"rgba(15,23,42,0.12)",
    text:"#0f172a", textMuted:"#64748b", textSub:"#475569",
    divider:"#e9eef5", tableHead:"rgba(15,23,42,0.03)",
    sidebar:"rgba(255,255,255,0.78)", sidebarBorder:"rgba(15,23,42,0.08)",
    pill:{ activeBg:"#0f172a", activeText:"#fff", text:"#64748b", hover:"rgba(15,23,42,0.04)" },
    chartGrid:"#edf2f7", chartAxis:"#64748b",
    badge:{ bg:"#ecfdf5", text:"#059669", border:"#a7f3d0" },
    input:"#f8fafc", restricted:"#fff1f2", rowHover:"#f8fafc",
    shadow:"0 16px 40px rgba(15,23,42,0.08)",
  };

  const greeting = ()=>{ const h=time.getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; };
  useEffect(() => {
    if (stats.lowStockCount > 0) {
      pushNotification("Low stock alert", `${stats.lowStockCount} items are currently low on stock.`);
    }
  }, [stats.lowStockCount, pushNotification]);

  const DCard = ({ children, style={} }: { children:React.ReactNode; style?:React.CSSProperties }) => (
    <div style={{ background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:30,padding:28,transition:"all 0.3s",position:"relative",overflow:"hidden",boxShadow:t.shadow,backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",...style }}>
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",background:dark?"linear-gradient(180deg,rgba(255,255,255,0.035),transparent 38%)":"linear-gradient(180deg,rgba(255,255,255,0.78),transparent 38%)" }}/>
      <div style={{ position:"relative",zIndex:1 }}>{children}</div>
    </div>
  );

  const SectionHead = ({ title, sub }: { title:string; sub?:string }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ color:t.text,fontWeight:800,fontSize:17,marginBottom:4 }}>{title}</div>
      {sub && <div style={{ color:t.textMuted,fontSize:11 }}>{sub}</div>}
    </div>
  );

  const RoleBadge = ({ r }: { r:string }) => {
    const colors:Record<string,string> = { superadmin:"#f59e0b",admin:"#22d3ee",manager:"#34d399",cashier:"#a78bfa" };
    const c = colors[r]||"#888";
    return <span style={{ fontSize:9,fontWeight:700,padding:"4px 9px",borderRadius:20,background:c+"18",color:c,textTransform:"uppercase",letterSpacing:0.8,border:`1px solid ${c}22` }}>{r}</span>;
  };

  const TxTable = ({ sales }: { sales:any[] }) => (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
        <thead><tr style={{ background:t.tableHead }}>
          {["Invoice","Customer","Total","Status"].map(h=>(
            <th key={h} style={{ padding:"14px 28px",textAlign:"left",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:2,color:t.textMuted }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {sales.map((s:any)=>(
            <tr key={s._id||s.id} style={{ borderBottom:`1px solid ${t.divider}` }}
              onMouseEnter={e=>(e.currentTarget.style.background=t.rowHover)}
              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <td style={{ padding:"14px 28px",fontFamily:"monospace",fontSize:10,color:t.textMuted }}>
                {s.invoiceNumber||`#${(s._id||s.id||"").slice(-8).toUpperCase()}`}
              </td>
              <td style={{ padding:"14px 28px" }}>
                <div style={{ fontWeight:700,fontSize:13,color:t.text }}>{s.customerName||"Walk-in Customer"}</div>
                {s.cashier&&<div style={{ fontSize:10,color:t.textMuted,marginTop:2 }}>by {s.cashier}</div>}
              </td>
              <td style={{ padding:"14px 28px",fontWeight:700,fontSize:13,color:t.text }}>{formatCurrency(s.total||0)}</td>
              <td style={{ padding:"14px 28px" }}>
                <span style={{ padding:"5px 12px",borderRadius:20,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1,background:s.status==="refunded"?"#ede9fe":s.status==="cancelled"?"#f3f4f6":t.badge.bg,color:s.status==="refunded"?"#7c3aed":s.status==="cancelled"?"#6b7280":t.badge.text,border:`1px solid ${s.status==="refunded"?"#c4b5fd":s.status==="cancelled"?"#e5e7eb":t.badge.border}` }}>
                  {s.status||"Completed"}
                </span>
              </td>
            </tr>
          ))}
          {sales.length===0&&(
            <tr><td colSpan={4} style={{ padding:"48px 28px",textAlign:"center",color:t.textMuted,fontSize:13,fontStyle:"italic" }}>No recent transactions found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  /* ── Cashier Dashboard ── */
  const CashierDashboard = () => (
    <div style={{ height:"100%",overflowY:"auto",background:t.bg,padding:28 }}>
      <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:0.25}}>
        <DCard style={{ marginBottom:22,background:dark?"linear-gradient(135deg,rgba(167,139,250,0.18),rgba(236,72,153,0.12),rgba(255,255,255,0.03))":"linear-gradient(135deg,rgba(245,243,255,0.96),rgba(253,242,248,0.96),rgba(255,255,255,0.96))",border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(15,23,42,0.08)"}` }}>
          <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1.5fr 1fr",gap:20,alignItems:"center" }}>
            <div>
              <div style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,background:config.color+"14",border:`1px solid ${config.color}22`,color:config.color,fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",marginBottom:14 }}>Terminal workspace</div>
              <h1 style={{ margin:0,color:t.text,fontSize:30,fontWeight:800,letterSpacing:-0.8 }}>{greeting()}, {user.username}</h1>
              <p style={{ margin:"8px 0 0",color:t.textMuted,fontSize:13 }}>{time.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              {[{ label:"Sales Today",value:stats.myTodaySales },{ label:"Store Status",value:"Live" },{ label:"Queue",value:recentSales.length },{ label:"Access",value:"POS" }].map(item=>(
                <div key={item.label} style={{ padding:"14px 16px",borderRadius:18,background:dark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.72)",border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(15,23,42,0.06)"}` }}>
                  <div style={{ color:t.textMuted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.6,marginBottom:4 }}>{item.label}</div>
                  <div style={{ color:t.text,fontSize:22,fontWeight:800 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </DCard>
      </motion.div>
      <motion.button whileHover={{scale:1.01}} whileTap={{scale:0.98}} onClick={()=>{ setActiveTab("pos"); setShowDash(false); }}
        style={{ width:"100%",padding:18,borderRadius:22,border:"none",cursor:"pointer",fontSize:15,fontWeight:800,color:"#fff",background:config.gradient,display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 14px 30px ${config.color}33` }}>
        <Zap size={18}/> Start New Sale
      </motion.button>
    </div>
  );

  /* ── Full Dashboard ── */
  const FullDashboard = () => (
    <div style={{ height:"100%",overflowY:"auto",background:t.bg,transition:"background 0.3s" }}>
      {/* Topbar */}
      <div style={{ padding:isMobile?"12px 14px":"18px 28px",borderBottom:`1px solid ${t.divider}`,background:dark?"rgba(11,15,24,0.72)":"rgba(243,247,251,0.76)",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.3s",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",position:"sticky",top:0,zIndex:20 }}>
        <div>
          <h1 style={{ margin:0,color:t.text,fontSize:22,fontWeight:800,letterSpacing:-0.4 }}>Store Analytics</h1>
          <p style={{ margin:"4px 0 0",color:t.textMuted,fontSize:12 }}>Real-time data from your MongoDB database.</p>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:14,background:config.color+"14",border:`1px solid ${config.color}30` }}>
            <config.icon size={12} style={{ color:config.color }}/><span style={{ fontSize:11,fontWeight:700,color:config.color }}>{config.label}</span>
          </div>
          <button onClick={loadData} style={{ padding:10,background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)" }}>
            <RefreshCw size={15} style={{ color:t.textSub }}/>
          </button>
          {stats.lowStockCount>0&&(
            <div style={{ position:"relative" }}>
              <button onClick={()=>setShowNotifications(v=>!v)} style={{ padding:10,background:t.card,border:`1px solid ${t.cardBorder}`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(12px)" }} title="Low stock alerts">
                <Bell size={15} style={{ color:"#ef4444" }}/>
              </button>
              <span style={{ position:"absolute",top:-2,right:-2,width:9,height:9,borderRadius:"50%",background:"#ef4444",border:`2px solid ${dark?"#10131c":"#ffffff"}` }}/>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding:isMobile?"16px 14px 24px":"26px 28px 30px",display:"flex",flexDirection:"column",gap:22 }}>
        {/* Hero */}
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
          <DCard style={{ background:dark?"linear-gradient(135deg,rgba(34,211,238,0.14),rgba(167,139,250,0.14),rgba(52,211,153,0.08),rgba(255,255,255,0.02))":"linear-gradient(135deg,rgba(236,254,255,0.96),rgba(238,242,255,0.98),rgba(240,253,244,0.96))",border:`1px solid ${dark?"rgba(255,255,255,0.1)":"rgba(15,23,42,0.08)"}` }}>
            <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1.45fr 1fr",gap:24,alignItems:"center" }}>
              <div>
                <div style={{ display:"inline-flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:999,background:config.color+"14",border:`1px solid ${config.color}22`,color:config.color,fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",marginBottom:14 }}>Live business overview</div>
                <div style={{ color:t.text,fontSize:30,fontWeight:800,letterSpacing:-0.8,lineHeight:1.15 }}>{greeting()}, {user.username}</div>
                <div style={{ color:t.textMuted,fontSize:13,marginTop:8 }}>Here's what your store performance looks like today.</div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                {[
                  { label:"7D Revenue",  value: formatCurrency(stats.revenue||0) },
                  { label:"Customers",   value:stats.customerCount },
                  { label:"Today Sales", value:stats.myTodaySales },
                  { label:"Products",    value:products.length||0 },
                ].map(item=>(
                  <div key={item.label} style={{ padding:"14px 16px",borderRadius:18,background:dark?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.72)",border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(15,23,42,0.06)"}` }}>
                    <div style={{ color:t.textMuted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.6,marginBottom:4 }}>{item.label}</div>
                    <div style={{ color:t.text,fontSize:22,fontWeight:800 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </DCard>
        </motion.div>

        {/* KPI cards */}
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:18 }}>
          {[
            { label:"Revenue (7d)",    value: formatCurrency(stats.revenue||0), icon:DollarSign,   accent:dark?"#22d3ee":"#0f172a", bg:dark?"#22d3ee":"#0f172a", trend:weekTrends.revenueChange, up:weekTrends.revenueUp  },
            { label:"Sales (7d)",      value:stats.salesCount,                          icon:ShoppingBag,  accent:"#3b82f6", bg:"#3b82f6", trend:weekTrends.salesChange,   up:weekTrends.salesUp    },
            { label:"Total Customers", value:stats.customerCount,                       icon:Users,        accent:"#f97316", bg:"#f97316", trend:stats.customerCount>0?`${stats.customerCount} total`:"No data", up:true  },
            { label:"Low Stock Items", value:stats.lowStockCount,                       icon:AlertTriangle,accent:"#ef4444", bg:"#ef4444", trend:stats.lowStockCount>0?"Needs attention":"All stocked", up:stats.lowStockCount===0 },
          ].map((c,i)=>(
            <motion.div key={i} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:i*0.08,type:"spring",stiffness:200}}>
              <DCard style={{ position:"relative",overflow:"hidden" }}>
                <div style={{ position:"absolute",top:-8,right:-8,width:56,height:56,borderRadius:"50%",background:c.bg,opacity:dark?0.1:0.06,filter:"blur(14px)" }}/>
                <div style={{ position:"absolute",left:0,top:0,width:"100%",height:4,background:`linear-gradient(90deg,${c.bg},transparent)` }}/>
                <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16 }}>
                  <div style={{ width:48,height:48,borderRadius:16,background:dark?c.bg+"18":c.bg+"10",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${c.bg}18` }}>
                    <c.icon size={20} style={{ color:dark?c.accent:c.bg }}/>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:3,fontSize:11,fontWeight:700,padding:"5px 10px",borderRadius:20,background:c.up?"#ecfdf5":"#fef2f2",color:c.up?"#059669":"#dc2626" }}>
                    {c.up?<ArrowUpRight size={11}/>:<ArrowDownRight size={11}/>}{c.trend}
                  </div>
                </div>
                <div style={{ color:t.textMuted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:4 }}>{c.label}</div>
                <div style={{ color:t.text,fontSize:28,fontWeight:800 }}>{c.value}</div>
              </DCard>
            </motion.div>
          ))}
        </div>

        {/* Area chart + Top Products */}
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:18 }}>
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:0.32}}>
            <DCard>
              <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:28 }}>
                <div><div style={{ color:t.text,fontWeight:800,fontSize:17 }}>Revenue Trend</div><div style={{ color:t.textMuted,fontSize:11,marginTop:3 }}>Daily revenue for the last 7 days</div></div>
                <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:t.textMuted }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:dark?"#22d3ee":"#0f172a" }}/> Revenue
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={dark?"#22d3ee":"#0f172a"} stopOpacity={dark?0.22:0.1}/>
                      <stop offset="95%" stopColor={dark?"#22d3ee":"#0f172a"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={t.chartGrid}/>
                  <XAxis dataKey={trendData[0]?.date?"date":"day"} axisLine={false} tickLine={false} tick={{fontSize:10,fill:t.chartAxis}}
                    tickFormatter={v=>{ try{ return new Date(v).toLocaleDateString("en-US",{weekday:"short"}); } catch{ return v; } }}/>
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:t.chartAxis}} tickFormatter={v=>`$${v}`}/>
                  <Tooltip content={<ChartTooltip dark={dark}/>}/>
                  <Area type="monotone" dataKey={trendData[0]?.amount!==undefined?"amount":"revenue"} name="Revenue"
                    stroke={dark?"#22d3ee":"#0f172a"} strokeWidth={3} fillOpacity={1} fill="url(#revGrad)"
                    dot={{fill:dark?"#22d3ee":"#0f172a",r:3,strokeWidth:0}} activeDot={{r:5,fill:dark?"#22d3ee":"#0f172a"}}/>
                </AreaChart>
              </ResponsiveContainer>
            </DCard>
          </motion.div>
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:0.36}}>
            <DCard style={{ display:"flex",flexDirection:"column",height:"100%" }}>
              <div style={{ color:t.text,fontWeight:800,fontSize:17,marginBottom:4 }}>Top Products</div>
              <div style={{ color:t.textMuted,fontSize:11,marginBottom:24 }}>Best performing items by quantity sold</div>
              <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={topProducts.length>0?topProducts:categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" strokeWidth={0}>
                      {(topProducts.length>0?topProducts:categoryData).map((_,i)=>(
                        <Cell key={i} fill={dark?ACCENT_COLORS[i%ACCENT_COLORS.length]:DONUT_COLORS[i%DONUT_COLORS.length]}/>
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip dark={dark}/>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ width:"100%",display:"flex",flexDirection:"column",gap:10,marginTop:16 }}>
                  {(topProducts.length>0?topProducts:categoryData).slice(0,5).map((item:any,i:number)=>(
                    <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ width:8,height:8,borderRadius:3,background:dark?ACCENT_COLORS[i%ACCENT_COLORS.length]:DONUT_COLORS[i%DONUT_COLORS.length],flexShrink:0 }}/>
                        <span style={{ fontSize:11,fontWeight:500,color:t.textSub,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize:11,fontWeight:700,color:t.text }}>{item.value} sold</span>
                    </div>
                  ))}
                  {topProducts.length===0&&categoryData.length===0&&(
                    <div style={{ color:t.textMuted,fontSize:12,textAlign:"center",padding:16,fontStyle:"italic" }}>No product data yet</div>
                  )}
                </div>
              </div>
            </DCard>
          </motion.div>
        </div>

        {/* Stock + Payments */}
        <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:18 }}>
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:0.4}}>
            <DCard>
              <div style={{ color:t.text,fontWeight:800,fontSize:17,marginBottom:4 }}>Stock Levels</div>
              <div style={{ color:t.textMuted,fontSize:11,marginBottom:20 }}>Lowest 6 products — color coded by urgency</div>
              {stockData.length>0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stockData} margin={{top:4,right:4,left:-24,bottom:0}} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false}/>
                      <XAxis dataKey="name" tick={{fontSize:9,fill:t.chartAxis}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:t.chartAxis}} axisLine={false} tickLine={false}/>
                      <Tooltip content={<ChartTooltip dark={dark}/>}/>
                      <Bar dataKey="qty" name="Stock" radius={[8,8,0,0]}>
                        {stockData.map((e:any,i:number)=>(
                          <Cell key={i} fill={e.qty<=e.threshold?"#ef4444":e.qty<=e.threshold*2?"#f59e0b":dark?"#34d399":"#22c55e"}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex",gap:16,marginTop:12 }}>
                    {[{color:"#ef4444",label:"Critical"},{color:"#f59e0b",label:"Low"},{color:dark?"#34d399":"#22c55e",label:"OK"}].map(l=>(
                      <div key={l.label} style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:t.textSub }}>
                        <div style={{ width:8,height:8,borderRadius:3,background:l.color }}/>{l.label}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height:200,display:"flex",alignItems:"center",justifyContent:"center",color:t.textMuted,fontSize:12,fontStyle:"italic" }}>No products yet</div>
              )}
            </DCard>
          </motion.div>
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:0.44}}>
            <DCard>
              <div style={{ color:t.text,fontWeight:800,fontSize:17,marginBottom:4 }}>Payment Methods</div>
              <div style={{ color:t.textMuted,fontSize:11,marginBottom:20 }}>Transaction breakdown by payment type</div>
              {paymentData.length>0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={74} paddingAngle={5} dataKey="value" strokeWidth={0}>
                        {paymentData.map((_,i)=><Cell key={i} fill={ACCENT_COLORS[i%ACCENT_COLORS.length]}/>)}
                      </Pie>
                      <Tooltip content={<ChartTooltip dark={dark}/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:12,marginTop:12 }}>
                    {paymentData.map((p,i)=>(
                      <div key={p.name} style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <div style={{ width:8,height:8,borderRadius:3,background:ACCENT_COLORS[i%ACCENT_COLORS.length] }}/>
                        <span style={{ fontSize:11,color:t.textSub }}>{p.name}</span>
                        <span style={{ fontSize:11,fontWeight:700,color:t.text }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height:180,display:"flex",alignItems:"center",justifyContent:"center",color:t.textMuted,fontSize:12,fontStyle:"italic" }}>No sales data yet</div>
              )}
            </DCard>
          </motion.div>
        </div>

        {/* Staff activity — visible to superadmin & admin */}
        {(role==="superadmin"||role==="admin")&&staffUsers.length>0&&(
          <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:0.48}}>
            <DCard>
              <div style={{ color:t.text,fontWeight:800,fontSize:17,marginBottom:4 }}>User Activity</div>
              <div style={{ color:t.textMuted,fontSize:11,marginBottom:20 }}>Staff accounts in system</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:t.tableHead }}>{["User","Role","Last Active","Status"].map(h=><th key={h} style={{ padding:"10px 14px",textAlign:"left",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,color:t.textMuted }}>{h}</th>)}</tr></thead>
                  <tbody>{staffUsers.map((u:any,i:number)=>(
                    <tr key={u._id||i} style={{ borderBottom:`1px solid ${t.divider}` }}
                      onMouseEnter={e=>(e.currentTarget.style.background=t.rowHover)}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <td style={{ padding:"12px 14px",fontWeight:700,color:t.text,fontSize:12 }}>{u.name||u.username}</td>
                      <td style={{ padding:"12px 14px" }}><RoleBadge r={u.role}/></td>
                      <td style={{ padding:"12px 14px",color:t.textMuted,fontSize:11 }}>{umTimeAgo(u.lastLogin)}</td>
                      <td style={{ padding:"12px 14px" }}><div style={{ display:"flex",alignItems:"center",gap:5 }}><div style={{ width:6,height:6,borderRadius:"50%",background:u.status==="active"?"#22c55e":"#6b7280" }}/><span style={{ fontSize:10,fontWeight:600,color:u.status==="active"?"#22c55e":"#6b7280",textTransform:"capitalize" }}>{u.status||"active"}</span></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </DCard>
          </motion.div>
        )}

        {/* Recent Transactions + Quick Actions */}
        <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:0.52}} style={{ display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:18 }}>
          <DCard style={{ padding:0,overflow:"hidden" }}>
            <div style={{ padding:"24px 28px",borderBottom:`1px solid ${t.divider}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div><div style={{ color:t.text,fontWeight:800,fontSize:17 }}>Recent Transactions</div><div style={{ color:t.textMuted,fontSize:11,marginTop:2 }}>Latest sales from your database</div></div>
              <button onClick={()=>{ setActiveTab("sales"); setShowDash(false); }} style={{ padding:"9px 16px",background:t.input,border:`1px solid ${t.cardBorder}`,borderRadius:14,fontSize:10,fontWeight:700,color:t.textSub,cursor:"pointer",textTransform:"uppercase",letterSpacing:1.5 }}>View History</button>
            </div>
            <TxTable sales={recentSales}/>
          </DCard>
          <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
            <div style={{ background:dark?"linear-gradient(180deg,rgba(17,24,39,0.95),rgba(10,13,20,0.95))":"linear-gradient(180deg,#0f172a,#111827)",borderRadius:30,padding:28,flex:1,boxShadow:t.shadow,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(15,23,42,0.08)"}`,position:"relative",overflow:"hidden" }}>
              <div style={{ position:"absolute",top:-40,right:-30,width:140,height:140,borderRadius:"50%",background:"rgba(34,211,238,0.18)",filter:"blur(36px)" }}/>
              <div style={{ position:"absolute",bottom:-30,left:-20,width:120,height:120,borderRadius:"50%",background:"rgba(167,139,250,0.14)",filter:"blur(30px)" }}/>
              <div style={{ position:"relative",zIndex:1 }}>
                <div style={{ color:"#fff",fontWeight:800,fontSize:17,marginBottom:20 }}>Quick Actions</div>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {([
                    { label:"Launch POS",     tab:"pos"       as Tab, icon:Zap        },
                    { label:"Add Inventory",  tab:"inventory" as Tab, icon:Plus       },
                    { label:"View Customers", tab:"customers" as Tab, icon:Users      },
                    { label:"Orders",         tab:"orders"    as Tab, icon:ClipboardList },
                    { label:"Tax Rates",      tab:"taxes"     as Tab, icon:Receipt    },
                    { label:"Payments",       tab:"payments"  as Tab, icon:Wallet     },
                    { label:"Manage Users",   tab:"users"     as Tab, icon:UserCog2   },
                    { label:"Settings",       tab:"settings"  as Tab, icon:Shield     },
                  ] as { label:string; tab:Tab; icon:React.ElementType }[]).filter(a=>accessibleTabs.includes(a.tab)).map(a=>(
                    <motion.button key={a.tab} whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                      onClick={()=>{ setActiveTab(a.tab); setShowDash(false); }}
                      style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderRadius:18,border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.08)",transition:"background 0.15s" }}
                      onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.14)")}
                      onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.08)")}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}><a.icon size={15}/>{a.label}</div>
                      <ArrowUpRight size={15}/>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
            <DCard>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
                <div style={{ color:t.text,fontWeight:800,fontSize:15 }}>System Status</div>
                <div style={{ width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e88" }}/>
              </div>
              {[{label:"Database",status:"Active"},{label:"API Gateway",status:"Online"},{label:"Auth Service",status:"Stable"}].map(s=>(
                <div key={s.label} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:14,background:t.input,marginBottom:8,border:`1px solid ${t.cardBorder}` }}>
                  <span style={{ fontSize:11,fontWeight:700,color:t.textSub }}>{s.label}</span>
                  <span style={{ fontSize:10,fontWeight:700,color:"#22c55e",textTransform:"uppercase",letterSpacing:1 }}>{s.status}</span>
                </div>
              ))}
            </DCard>
          </div>
        </motion.div>
      </div>
    </div>
  );

  /* ── Sidebar ── */
  const Sidebar = ({ onNavClick }: { onNavClick?: () => void }) => {
    const collapsed = !isMobile && sidebarCollapsed;
    const NAV_META: Record<string,{ icon:React.ElementType; label:string; accent:string }> = {
      pos:       { icon:ShoppingCart,  label:"POS",       accent:"#22d3ee" },
      inventory: { icon:Package,       label:"Inventory", accent:"#a78bfa" },
      sales:     { icon:History,       label:"Sales",     accent:"#34d399" },
      customers: { icon:Users,         label:"Customers", accent:"#fb923c" },
      orders:    { icon:ClipboardList, label:"Orders",    accent:"#f59e0b" },
      taxes:     { icon:Receipt,       label:"Taxes",     accent:"#8b5cf6" },
      payments:  { icon:Wallet,        label:"Payments",  accent:"#22d3ee" },
      coupons:   { icon:Tag,           label:"Coupons",   accent:"#f97316" },
      users:     { icon:UserCog2,      label:"Users",     accent:"#f59e0b" },
      data:      { icon:Database,      label:"Data",      accent:"#34d399" },
      settings:  { icon:Shield,        label:"Settings",  accent:"#64748b" },
    };
    const LOCKED_LABELS: Record<string,string> = { pos:"POS",inventory:"Inventory",sales:"Sales",customers:"Customers",orders:"Orders",taxes:"Taxes",payments:"Payments",coupons:"Coupons",users:"Users",data:"Data",settings:"Settings" };

    return (
    <aside style={{ width:collapsed?68:248,height:"100%",flexShrink:0,background:t.sidebar,border:`1px solid ${t.sidebarBorder}`,borderRadius:28,display:"flex",flexDirection:"column",transition:"width 0.25s cubic-bezier(0.4,0,0.2,1), background 0.3s",overflow:"hidden",boxShadow:t.shadow,backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",position:"relative",zIndex:1 }}>
      <div style={{ position:"absolute",top:-30,right:-20,width:120,height:120,borderRadius:"50%",background:config.color+"22",filter:"blur(32px)",pointerEvents:"none" }}/>
      <div style={{ position:"absolute",bottom:-40,left:-25,width:120,height:120,borderRadius:"50%",background:"#a78bfa22",filter:"blur(32px)",pointerEvents:"none" }}/>

      {/* Logo */}
      <div style={{ position:"relative",zIndex:1,padding:collapsed?"14px 10px":"20px",borderBottom:`1px solid ${t.divider}`,flexShrink:0,transition:"padding 0.25s" }}>
        {collapsed ? (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
            <div style={{ width:38,height:38,borderRadius:14,background:config.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#fff",boxShadow:`0 10px 24px ${config.color}33` }}>P</div>
            <button onClick={()=>setShowNotifications(v=>!v)} title="Notifications"
              style={{ width:34,height:34,borderRadius:12,border:`1px solid ${showNotifications?t.cardBorderStrong:t.cardBorder}`,background:showNotifications?t.input:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all 0.2s" }}>
              <Bell size={14} style={{ color:unreadCount>0?"#ef4444":t.textSub }}/>
              {unreadCount>0&&<span style={{ position:"absolute",top:-4,right:-4,minWidth:16,height:16,padding:"0 4px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,background:"#ef4444",color:"#fff",border:`2px solid ${dark?pg.dark:"#ffffff"}` }}>{unreadCount>9?"9+":unreadCount}</span>}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
              <div style={{ width:38,height:38,borderRadius:14,background:config.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#fff",boxShadow:`0 10px 24px ${config.color}33`,flexShrink:0 }}>P</div>
              <div style={{ flex:1,minWidth:0 }}><div style={{ color:t.text,fontWeight:800,fontSize:14 }}>PointOS</div><div style={{ color:t.textMuted,fontSize:9,textTransform:"uppercase",letterSpacing:1.5 }}>{role==="superadmin"?"Enterprise":role==="admin"?"Admin":role==="manager"?"Store Mgmt":"POS Terminal"}</div></div>
              <button onClick={()=>setShowNotifications(v=>!v)} title="Notifications"
                style={{ width:34,height:34,borderRadius:12,border:`1px solid ${showNotifications?t.cardBorderStrong:t.cardBorder}`,background:showNotifications?t.input:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0,transition:"all 0.2s" }}>
                <Bell size={14} style={{ color:unreadCount>0?"#ef4444":t.textSub }}/>
                {unreadCount>0&&<span style={{ position:"absolute",top:-4,right:-4,minWidth:16,height:16,padding:"0 4px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,background:"#ef4444",color:"#fff",border:`2px solid ${dark?pg.dark:"#ffffff"}` }}>{unreadCount>9?"9+":unreadCount}</span>}
              </button>
            </div>
            <div style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:14,background:config.color+"10",border:`1px solid ${config.color}22` }}>
              <config.icon size={12} style={{ color:config.color }}/><span style={{ fontSize:11,fontWeight:700,color:config.color }}>{config.label}</span>
            </div>
          </>
        )}
      </div>

      {/* Overview button */}
      <div style={{ padding:collapsed?"8px 8px 4px":"12px 12px 4px",position:"relative",zIndex:1,flexShrink:0,transition:"padding 0.25s" }}>
        <button onClick={()=>{ setShowDash(v=>!v); onNavClick?.(); }}
          title={collapsed?"Overview":undefined}
          style={{ width:"100%",display:"flex",alignItems:"center",gap:collapsed?0:10,justifyContent:collapsed?"center":"flex-start",padding:collapsed?"11px 0":"11px 12px",borderRadius:16,border:`1px solid ${showDash?t.cardBorderStrong:"transparent"}`,cursor:"pointer",fontSize:12,fontWeight:700,background:showDash?t.pill.activeBg:"transparent",color:showDash?t.pill.activeText:t.pill.text,transition:"all 0.2s" }}>
          <div style={{ width:30,height:30,borderRadius:10,background:showDash?"rgba(15,23,42,0.08)":(dark?"rgba(255,255,255,0.06)":"rgba(15,23,42,0.04)"),display:"flex",alignItems:"center",justifyContent:"center",color:showDash?t.pill.activeText:config.color,flexShrink:0 }}>
            <LayoutDashboard size={14}/>
          </div>
          {!collapsed && <>Overview{showDash&&<span style={{ marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:config.color }}/>}</>}
        </button>
      </div>

      {/* Nav — scrollable when items overflow */}
      <nav style={{ flex:1,padding:collapsed?"4px 8px 10px":"4px 12px 10px",position:"relative",zIndex:1,overflowY:"auto",overflowX:"hidden",minHeight:0,transition:"padding 0.25s" }}>
        {!collapsed && <p style={{ fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:2,color:t.textMuted,padding:"8px 12px 10px" }}>Modules</p>}
        {collapsed && <div style={{ height:8 }}/>}
        {accessibleTabs.map(key=>{
          const m=NAV_META[key]; if(!m) return null;
          const Icon=m.icon;
          const active=!showDash&&activeTab===key;
          return (
            <button key={key} onClick={()=>{ setActiveTab(key); setShowDash(false); onNavClick?.(); }}
              title={collapsed?m.label:undefined}
              style={{ width:"100%",display:"flex",alignItems:"center",gap:collapsed?0:10,justifyContent:collapsed?"center":"flex-start",padding:collapsed?"10px 0":"11px 12px",borderRadius:16,border:`1px solid ${active?t.cardBorderStrong:"transparent"}`,cursor:"pointer",fontSize:12,fontWeight:700,marginBottom:4,background:active?t.pill.activeBg:"transparent",color:active?t.pill.activeText:t.pill.text,transition:"all 0.2s" }}
              onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=t.pill.hover; }}
              onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}>
              <div style={{ width:30,height:30,borderRadius:10,background:active?"rgba(15,23,42,0.08)":m.accent+"15",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Icon size={14} style={{ color:active?t.pill.activeText:m.accent }}/>
              </div>
              {!collapsed && <>{m.label}{active&&<span style={{ marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:m.accent }}/>}</>}
            </button>
          );
        })}
        {/* Locked tabs */}
        {ALL_NAV_TABS.filter(k=>!accessibleTabs.includes(k)).map(key=>(
          <div key={key} title={collapsed?LOCKED_LABELS[key]:undefined}
            style={{ display:"flex",alignItems:"center",gap:collapsed?0:10,justifyContent:collapsed?"center":"flex-start",padding:collapsed?"10px 0":"11px 12px",borderRadius:16,fontSize:12,fontWeight:700,color:t.textMuted,opacity:0.4,cursor:"not-allowed",marginBottom:4 }}>
            <div style={{ width:30,height:30,borderRadius:10,background:dark?"rgba(255,255,255,0.04)":"rgba(15,23,42,0.04)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <Lock size={11} style={{ color:t.textMuted }}/>
            </div>
            {!collapsed && LOCKED_LABELS[key]}
          </div>
        ))}
      </nav>

      {/* Bottom: dark mode + user + collapse toggle */}
      <div style={{ borderTop:`1px solid ${t.divider}`,padding:collapsed?"10px 8px":"12px",display:"flex",flexDirection:"column",gap:8,position:"relative",zIndex:1,flexShrink:0,transition:"padding 0.25s" }}>
        {/* Dark mode toggle */}
        <button onClick={() => setMode(dark ? "light" : "dark")}
          title={collapsed?(dark?"Light mode":"Dark mode"):undefined}
          style={{ display:"flex",alignItems:"center",gap:collapsed?0:10,justifyContent:collapsed?"center":"flex-start",padding:collapsed?"10px 0":"10px 12px",borderRadius:14,border:`1px solid ${t.cardBorder}`,cursor:"pointer",fontSize:11,fontWeight:700,background:dark?"rgba(255,255,255,0.04)":"rgba(15,23,42,0.03)",color:t.pill.text,width:"100%",transition:"all 0.2s" }}>
          <AnimatePresence mode="wait">
            <motion.span key={dark?"sun":"moon"} initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}} transition={{duration:0.2}}>
              {dark?<Sun size={13} style={{ color:"#fbbf24" }}/>:<Moon size={13} style={{ color:"#818cf8" }}/>}
            </motion.span>
          </AnimatePresence>
          {!collapsed && (mode === "system" ? `System (${dark ? "Dark" : "Light"})` : dark ? "Light mode" : "Dark mode")}
        </button>

        {/* User row */}
        {collapsed ? (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
            <div title={user.username} style={{ width:34,height:34,borderRadius:12,background:config.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff",cursor:"default",boxShadow:`0 6px 14px ${config.color}24` }}>
              {user.username[0].toUpperCase()}
            </div>
            <button onClick={onLogout} title="Sign out" style={{ background:"none",border:`1px solid ${t.cardBorder}`,cursor:"pointer",color:t.textMuted,padding:"6px",borderRadius:8,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",transition:"color 0.2s,background 0.2s" }}
              onMouseEnter={e=>{ e.currentTarget.style.color="#ef4444"; e.currentTarget.style.background=dark?"rgba(239,68,68,0.08)":"rgba(239,68,68,0.06)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.color=t.textMuted; e.currentTarget.style.background="transparent"; }}>
              <LogOut size={13}/>
            </button>
          </div>
        ) : (
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px",borderRadius:18,background:dark?"rgba(255,255,255,0.05)":"rgba(15,23,42,0.03)",border:`1px solid ${t.cardBorder}` }}>
            <div style={{ width:34,height:34,borderRadius:12,background:config.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#fff",flexShrink:0,boxShadow:`0 10px 20px ${config.color}24` }}>
              {user.username[0].toUpperCase()}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ color:t.text,fontSize:11,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.username}</div>
              <div style={{ color:config.color,fontSize:9,textTransform:"uppercase",letterSpacing:0.8,fontWeight:700 }}>{config.label}</div>
            </div>
            <button onClick={onLogout} style={{ background:"none",border:"none",cursor:"pointer",color:t.textMuted,padding:6,borderRadius:8,transition:"color 0.2s,background 0.2s" }}
              onMouseEnter={e=>{ e.currentTarget.style.color="#ef4444"; e.currentTarget.style.background=dark?"rgba(239,68,68,0.08)":"rgba(239,68,68,0.06)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.color=t.textMuted; e.currentTarget.style.background="transparent"; }}>
              <LogOut size={13}/>
            </button>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button onClick={toggleSidebarCollapse}
            title={collapsed?"Expand sidebar":"Collapse sidebar"}
            style={{ display:"flex",alignItems:"center",gap:collapsed?0:8,justifyContent:collapsed?"center":"flex-start",padding:collapsed?"9px 0":"9px 12px",borderRadius:12,border:`1px solid ${t.cardBorder}`,cursor:"pointer",fontSize:11,fontWeight:700,background:"transparent",color:t.textMuted,width:"100%",transition:"all 0.2s" }}
            onMouseEnter={e=>{ e.currentTarget.style.background=dark?"rgba(255,255,255,0.05)":"rgba(15,23,42,0.04)"; e.currentTarget.style.color=t.text; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=t.textMuted; }}>
            {collapsed ? <ChevronRight size={14}/> : <><ChevronLeft size={14}/><span>Collapse</span></>}
          </button>
        )}
      </div>
    </aside>
    );
  };

  /* ── Root render ── */
  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",fontFamily:"var(--theme-font,'Sora','DM Sans',system-ui,sans-serif)",transition:"background 0.3s",background:t.page,padding:isMobile?0:12,gap:isMobile?0:12,position:"relative" }}>
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:"-8%",left:"-6%",width:320,height:320,borderRadius:"50%",background:"rgba(34,211,238,0.12)",filter:"blur(60px)" }}/>
        <div style={{ position:"absolute",top:"10%",right:"-5%",width:320,height:320,borderRadius:"50%",background:"rgba(167,139,250,0.12)",filter:"blur(60px)" }}/>
        <div style={{ position:"absolute",bottom:"-10%",left:"30%",width:300,height:300,borderRadius:"50%",background:"rgba(52,211,153,0.10)",filter:"blur(60px)" }}/>
      </div>

      {/* Mobile backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div onClick={() => setMobileSidebarOpen(false)}
          style={{ position:"fixed",inset:0,zIndex:90,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)" }} />
      )}

      {/* Sidebar — always visible on desktop, drawer on mobile */}
      <div style={{
        position: isMobile ? "fixed" : "relative",
        left: isMobile ? 0 : "auto",
        top: isMobile ? 0 : "auto",
        height: isMobile ? "100vh" : "100%",
        zIndex: isMobile ? 100 : 1,
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        transform: isMobile ? (mobileSidebarOpen ? "translateX(0)" : "translateX(-300px)") : "none",
        pointerEvents: isMobile && !mobileSidebarOpen ? "none" : "auto",
        flexShrink: 0,
      }}>
        <Sidebar onNavClick={() => isMobile && setMobileSidebarOpen(false)} />
      </div>

      {/* Notification dropdown — anchored below sidebar bell button */}
      <div style={{ position:"absolute", top:78, left: isMobile ? 16 : (sidebarCollapsed ? 80 : 260), zIndex:200, pointerEvents:"none" }}>
        <AnimatePresence>
          {showNotifications && (
            <motion.div
              initial={{ opacity:0, y:-8, scale:0.98 }}
              animate={{ opacity:1, y:0, scale:1 }}
              exit={{ opacity:0, y:-8, scale:0.98 }}
              transition={{ duration:0.15 }}
              style={{ pointerEvents:"auto", width:360, maxHeight:420, borderRadius:16, border:`1px solid ${t.cardBorder}`, background:t.cardSolid, overflow:"hidden", boxShadow:t.shadow }}
            >
              <div style={{ padding:"12px 14px", borderBottom:`1px solid ${t.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:14, fontWeight:800, color:t.text }}>Notifications</span>
                <button onClick={markAllNotificationsRead} style={{ border:"none", background:"transparent", cursor:"pointer", fontSize:11, fontWeight:700, color:"#3b82f6" }}>
                  Mark all as read
                </button>
              </div>
              <div style={{ maxHeight:360, overflowY:"auto" }}>
                {serverNotifs.length === 0 && notifications.length === 0 ? (
                  <div style={{ padding:"16px 14px", fontSize:12, color:t.textMuted }}>No notifications yet.</div>
                ) : (
                  <>
                    {/* Server notifications (activity events) */}
                    {serverNotifs.length > 0 && (
                      <>
                        <div style={{ padding:"8px 14px 4px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:t.textMuted }}>Activity</div>
                        {serverNotifs.map((n:any) => (
                          <button key={n._id} onClick={() => markServerNotifRead(n._id)}
                            style={{ width:"100%", border:"none", borderBottom:`1px solid ${t.divider}`, background:n.read ? "transparent" : t.input, textAlign:"left", padding:"12px 14px", cursor:"pointer", display:"flex", gap:10 }}>
                            <span style={{ width:10, height:10, borderRadius:"50%", background:n.read ? "transparent" : "#22d3ee", marginTop:6, flexShrink:0 }}/>
                            <span style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:700, color:t.text }}>{n.title}</div>
                              <div style={{ fontSize:11, color:t.textMuted, marginTop:2, lineHeight:1.4 }}>{n.message}</div>
                              <div style={{ fontSize:10, color:t.textMuted, marginTop:5 }}>{new Date(n.createdAt).toLocaleString()}</div>
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                    {/* Client notifications (local events: theme, stock alerts) */}
                    {notifications.length > 0 && (
                      <>
                        <div style={{ padding:"8px 14px 4px", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:t.textMuted }}>System</div>
                        {notifications.map((n) => (
                          <button key={n.id} onClick={() => markNotificationRead(n.id)}
                            style={{ width:"100%", border:"none", borderBottom:`1px solid ${t.divider}`, background:n.read ? "transparent" : t.input, textAlign:"left", padding:"12px 14px", cursor:"pointer", display:"flex", gap:10 }}>
                            <span style={{ width:10, height:10, borderRadius:"50%", background:n.read ? "transparent" : "#3b82f6", marginTop:6, flexShrink:0 }}/>
                            <span style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:700, color:t.text }}>{n.title}</div>
                              <div style={{ fontSize:11, color:t.textMuted, marginTop:2, lineHeight:1.4 }}>{n.message}</div>
                              <div style={{ fontSize:10, color:t.textMuted, marginTop:5 }}>{new Date(n.createdAt).toLocaleString()}</div>
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main style={{ flex:1,overflow:"hidden",background:t.bg,transition:"background 0.3s",borderRadius:isMobile?0:28,border:isMobile?"none":`1px solid ${t.cardBorder}`,boxShadow:isMobile?"none":t.shadow,position:"relative",zIndex:1,display:"flex",flexDirection:"column" }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:`1px solid ${t.divider}`,flexShrink:0,background:t.sidebar,backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)" }}>
            <button onClick={() => setMobileSidebarOpen(v => !v)}
              style={{ width:38,height:38,borderRadius:12,border:`1px solid ${t.cardBorder}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:t.text,flexShrink:0 }}>
              <LayoutDashboard size={16} />
            </button>
            <div style={{ flex:1,display:"flex",alignItems:"center",gap:8 }}>
              <div style={{ width:30,height:30,borderRadius:10,background:config.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,color:"#fff",flexShrink:0 }}>P</div>
              <span style={{ color:t.text,fontWeight:800,fontSize:14 }}>PointOS</span>
            </div>
            <button onClick={() => setShowNotifications(v=>!v)} title="Notifications"
              style={{ width:34,height:34,borderRadius:12,border:`1px solid ${t.cardBorder}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative" }}>
              <Bell size={14} style={{ color:unreadCount>0?"#ef4444":t.textSub }}/>
              {unreadCount>0&&<span style={{ position:"absolute",top:-4,right:-4,minWidth:16,height:16,padding:"0 4px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,background:"#ef4444",color:"#fff" }}>{unreadCount>9?"9+":unreadCount}</span>}
            </button>
          </div>
        )}
        <div style={{ flex:1, overflow:"hidden", minHeight:0 }}>
          <AnimatePresence mode="wait">
            {showDash ? (
              <motion.div key="dash" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.2}} style={{ height:"100%" }}>
                {role==="cashier" ? <CashierDashboard/> : <FullDashboard/>}
              </motion.div>
            ) : activeTab==="payments" || activeTab==="settings" ? (
              <motion.div key={activeTab} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.18}} style={{ height:"100%" }}>
                {children}
              </motion.div>
            ) : (
              <motion.div key="page" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.18}} style={{ height:"100%" }}>
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;