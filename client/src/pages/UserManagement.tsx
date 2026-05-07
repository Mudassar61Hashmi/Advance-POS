import React, { useState, useEffect, useCallback } from "react";
import {
  Shield, UserCog, Store, ShoppingCart,
  Plus, Search, Eye, Trash2, KeyRound,
  UserCircle2, Users, CheckCircle2, XCircle,
  Clock, Sun, Moon, X, Loader2, RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getPresetPalette, useThemeConfig } from "../theme";

/* ═══════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════ */
type Role   = "superadmin" | "admin" | "manager" | "cashier";
type Status = "active" | "inactive";

interface AppUser {
  _id:       string;
  name:      string;
  email:     string;
  username:  string;
  role:      Role;
  status:    Status;
  createdAt: string;
  lastLogin: string | null;
  createdBy?: { name: string; email: string; role: Role } | null;
}

interface UserFormData {
  name: string; email: string; username: string;
  password: string; role: Role; status: Status;
}

interface FormErrors {
  name?: string; email?: string; username?: string;
  password?: string; role?: string; submit?: string;
}

interface ToastItem { id: number; msg: string; type: "success" | "error"; }
type PermissionKey = "pos" | "inventory" | "salesReports" | "customers" | "orders" | "taxes" | "payments" | "userMgmt";
interface RolePermissionProfile {
  _id?: string;
  role: string;
  isSystem: boolean;
  enabled: boolean;
  permissions: Record<PermissionKey, boolean>;
}

interface ModalState {
  create:      boolean;
  edit:        AppUser | null;
  delete:      AppUser | null;
  reset:       AppUser | null;
  detail:      AppUser | null;
  permissions: AppUser | null;
}

/* ═══════════════════════════════════════════════
   ROLE CONFIG
═══════════════════════════════════════════════ */
const ROLE_CONFIG: Record<Role, {
  label: string; color: string; gradient: string;
  icon: React.ElementType; canCreate: Role[];
}> = {
  superadmin: { label:"Super Admin", color:"#f59e0b", gradient:"linear-gradient(135deg,#f59e0b,#ef4444)", icon:Shield,       canCreate:["admin","manager","cashier"] },
  admin:      { label:"Admin",       color:"#22d3ee", gradient:"linear-gradient(135deg,#22d3ee,#a78bfa)", icon:UserCog,      canCreate:["manager","cashier"]         },
  manager:    { label:"Manager",     color:"#34d399", gradient:"linear-gradient(135deg,#34d399,#22d3ee)", icon:Store,        canCreate:["cashier"]                   },
  cashier:    { label:"Cashier",     color:"#a78bfa", gradient:"linear-gradient(135deg,#a78bfa,#ec4899)", icon:ShoppingCart, canCreate:[]                            },
};

const ROLE_ACCENT: Record<Role,string> = {
  superadmin:"#f59e0b", admin:"#22d3ee", manager:"#34d399", cashier:"#a78bfa",
};
const PERMISSION_KEYS: PermissionKey[] = ["pos","inventory","salesReports","customers","orders","taxes","payments","userMgmt"];
const PERM_LABELS: Record<PermissionKey,string> = {
  pos:"POS", inventory:"Inventory", salesReports:"Sales Reports",
  customers:"Customers", orders:"Orders", taxes:"Taxes",
  payments:"Payments", userMgmt:"User Mgmt",
};
const DEFAULT_ROLE_PERMISSIONS: RolePermissionProfile[] = [
  { role: "superadmin", isSystem: true, enabled: true, permissions: { pos:true, inventory:true, salesReports:true, customers:true, orders:true, taxes:true, payments:true,  userMgmt:true  } },
  { role: "admin",      isSystem: true, enabled: true, permissions: { pos:true, inventory:true, salesReports:true, customers:true, orders:true, taxes:true, payments:true,  userMgmt:true  } },
  { role: "manager",    isSystem: true, enabled: true, permissions: { pos:true, inventory:true, salesReports:true, customers:true, orders:true, taxes:true, payments:true,  userMgmt:false } },
  { role: "cashier",    isSystem: true, enabled: true, permissions: { pos:true, inventory:false, salesReports:false, customers:false, orders:false, taxes:false, payments:false, userMgmt:false } },
];

/* ═══════════════════════════════════════════════
   API HELPER — reads JWT from localStorage
═══════════════════════════════════════════════ */
let _umToastSeq = 0;
const nextToastId = () => ++_umToastSeq;

const api = async (method: string, path: string, body?: unknown) => {
  let token: string | null = null;
  try {
    const stored = localStorage.getItem("pos_user");
    token = stored ? JSON.parse(stored)?.token : null;
  } catch { /* ignore parse errors */ }

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

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */
function initials(name: string): string {
  return name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
}
function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)     return "Just now";
  if (s < 3600)   return `${Math.floor(s/60)}m ago`;
  if (s < 86400)  return `${Math.floor(s/3600)}h ago`;
  if (s < 604800) return `${Math.floor(s/86400)}d ago`;
  return new Date(date).toLocaleDateString("en-US",{ month:"short", day:"numeric" });
}
function fmtDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US",{ year:"numeric", month:"short", day:"numeric" });
}
const AV_PAL = ["#f59e0b","#22d3ee","#34d399","#a78bfa","#fb923c","#f87171","#fbbf24","#6ee7b7"];
const avColor = (name: string) => AV_PAL[(name?.charCodeAt(0) ?? 0) % AV_PAL.length];

/* ═══════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════ */
const T = (dark: boolean) => dark ? {
  bg:"#0c0c0f", card:"#13131a", cardBorder:"#ffffff0a",
  text:"#f0f0f8", textMuted:"#4a4a5a", textSub:"#888899",
  divider:"#ffffff08", tableHead:"#0a0a12",
  pill:{ activeBg:"#f0f0f8", activeText:"#0c0c0f", text:"#4a4a5a" },
  input:"#ffffff05", rowHover:"#ffffff03",
  inputBorder:"#ffffff12", inputText:"#f0f0f8",
  modalBg:"#13131a", overlayBg:"rgba(0,0,0,0.72)",
} : {
  bg:"#f8f9fa", card:"#ffffff", cardBorder:"#e4e4e7",
  text:"#18181b", textMuted:"#94a3b8", textSub:"#64748b",
  divider:"#f4f4f5", tableHead:"#fafafa",
  pill:{ activeBg:"#18181b", activeText:"#fff", text:"#94a3b8" },
  input:"#f4f4f5", rowHover:"#fafafa",
  inputBorder:"#e4e4e7", inputText:"#18181b",
  modalBg:"#ffffff", overlayBg:"rgba(10,10,20,0.55)",
};

/* ═══════════════════════════════════════════════
   SMALL UI COMPONENTS
═══════════════════════════════════════════════ */
const Avatar: React.FC<{ name:string; size?:number }> = ({ name, size=36 }) => {
  const c = avColor(name);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg,${c}ee,${c}55)`, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:size*0.33, letterSpacing:"0.04em" }}>
      {initials(name)}
    </div>
  );
};

const RoleBadge: React.FC<{ role:Role }> = ({ role }) => {
  const c = ROLE_ACCENT[role]; const cfg = ROLE_CONFIG[role]; const Icon = cfg.icon;
  return (
    <span style={{ fontSize:9, fontWeight:700, padding:"3px 10px", borderRadius:20, background:c+"18", color:c, textTransform:"uppercase", letterSpacing:0.8, display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
      <Icon size={9}/> {cfg.label}
    </span>
  );
};

const StatusDot: React.FC<{ status:Status }> = ({ status }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background:status==="active"?"#22c55e":"#6b7280", boxShadow:status==="active"?"0 0 0 2px #22c55e33":"none" }}/>
    <span style={{ fontSize:11, fontWeight:700, color:status==="active"?"#22c55e":"#6b7280", textTransform:"capitalize" }}>{status}</span>
  </span>
);

/* ═══════════════════════════════════════════════
   MODAL SHELL
═══════════════════════════════════════════════ */
const ModalShell: React.FC<{ open:boolean; onClose:()=>void; title:string; width?:number; dark:boolean; children:React.ReactNode }> = ({ open, onClose, title, width=480, dark, children }) => {
  const t = T(dark);
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          onClick={e => e.target===e.currentTarget && onClose()}
          style={{ position:"fixed", inset:0, zIndex:1000, background:t.overlayBg, backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <motion.div initial={{ opacity:0, y:18, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:10, scale:0.97 }}
            transition={{ type:"spring", stiffness:300, damping:28 }}
            style={{ background:t.modalBg, border:`1px solid ${t.cardBorder}`, borderRadius:24, width:"100%", maxWidth:width, overflow:"hidden", boxShadow:dark?"0 32px 80px rgba(0,0,0,0.7)":"0 24px 64px rgba(0,0,0,0.18)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ padding:"20px 26px 16px", borderBottom:`1px solid ${t.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:t.modalBg, zIndex:1 }}>
              <span style={{ fontSize:15, fontWeight:700, color:t.text }}>{title}</span>
              <button onClick={onClose} style={{ border:"none", background:t.input, borderRadius:"50%", width:30, height:30, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:t.textSub }}>
                <X size={14}/>
              </button>
            </div>
            <div style={{ padding:26 }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ═══════════════════════════════════════════════
   FIELD / INPUT / SELECT
═══════════════════════════════════════════════ */
const Field: React.FC<{ label:string; error?:string; children:React.ReactNode }> = ({ label, error, children }) => (
  <div style={{ marginBottom:16 }}>
    <label style={{ display:"block", fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#888899", marginBottom:7 }}>{label}</label>
    {children}
    {error && <p style={{ margin:"5px 0 0", fontSize:11, color:"#ef4444" }}>{error}</p>}
  </div>
);

const SInput: React.FC<{ value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; disabled?:boolean; dark:boolean; }> = ({ value, onChange, placeholder, type="text", disabled, dark }) => {
  const t = T(dark); const [foc, setFoc] = useState(false);
  return (
    <input type={type} value={value} placeholder={placeholder} disabled={disabled}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
      style={{ width:"100%", padding:"10px 13px", border:`1.5px solid ${foc?"#22d3ee":t.inputBorder}`, borderRadius:12, fontSize:13, outline:"none", color:t.inputText, background:foc?t.card:t.input, fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.2s, background 0.2s", opacity:disabled?0.5:1 }}/>
  );
};

const SSelect: React.FC<{ value:string; onChange:(v:string)=>void; options:{value:string;label:string}[]; dark:boolean; }> = ({ value, onChange, options, dark }) => {
  const t = T(dark);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width:"100%", padding:"10px 13px", border:`1.5px solid ${t.inputBorder}`, borderRadius:12, fontSize:13, outline:"none", color:t.inputText, background:t.input, fontFamily:"inherit", boxSizing:"border-box", cursor:"pointer", appearance:"none", backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888899' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat:"no-repeat", backgroundPosition:"right 12px center" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

/* ═══════════════════════════════════════════════
   STAT CARD
═══════════════════════════════════════════════ */
const StatCard: React.FC<{ label:string; value:number|string; accent:string; icon:React.ElementType; sub?:string; dark:boolean; }> = ({ label, value, accent, icon:Icon, sub, dark }) => {
  const t = T(dark);
  return (
    <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:28, padding:24, position:"relative", overflow:"hidden", transition:"all 0.3s" }}>
      <div style={{ position:"absolute", top:-10, right:-10, width:54, height:54, borderRadius:"50%", background:accent, opacity:dark?0.1:0.07, filter:"blur(14px)" }}/>
      <div style={{ width:44, height:44, borderRadius:14, background:accent+(dark?"22":"14"), display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
        <Icon size={20} style={{ color:accent }}/>
      </div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, color:t.textMuted, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, color:t.text, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:accent, marginTop:5, fontWeight:700 }}>{sub}</div>}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   USER FORM MODAL
═══════════════════════════════════════════════ */
const UserFormModal: React.FC<{
  open:boolean; onClose:()=>void; dark:boolean;
  onSave:(d:UserFormData)=>Promise<void>;
  editUser:AppUser|null; currentRole:Role; roleProfiles: RolePermissionProfile[];
}> = ({ open, onClose, dark, onSave, editUser, currentRole, roleProfiles }) => {
  const isEdit = !!editUser;
  const cfg = ROLE_CONFIG[currentRole];
  const [form, setForm] = useState<UserFormData>({ name:"", email:"", username:"", password:"", role:"cashier", status:"active" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editUser) setForm({ name:editUser.name, email:editUser.email, username:editUser.username, password:"", role:editUser.role, status:editUser.status });
    else          setForm({ name:"", email:"", username:"", password:"", role:"cashier", status:"active" });
    setErrors({});
  }, [editUser, open]);

  const set = <K extends keyof UserFormData>(k:K) => (v:UserFormData[K]) => setForm(f=>({...f,[k]:v}));
  const enabledRoles = new Set(roleProfiles.filter(r => r.enabled).map(r => r.role));
  const roleOpts = cfg.canCreate
    .filter(r => enabledRoles.has(r))
    .map(r => ({ value:r, label:ROLE_CONFIG[r].label }));

  useEffect(() => {
    if (roleOpts.length > 0 && !roleOpts.some(o => o.value === form.role)) {
      setForm(prev => ({ ...prev, role: roleOpts[0].value as Role }));
    }
  }, [form.role, roleOpts]);

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim())                                      e.name     = "Required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email   = "Valid email required";
    if (!form.username.trim())                                   e.username = "Required";
    if (!isEdit && form.password.length < 6)                    e.password = "Min 6 characters";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) delete (payload as Partial<UserFormData>).password;
      await onSave(payload);
      onClose();
    } catch (err) { setErrors({ submit: (err as Error).message }); }
    finally { setLoading(false); }
  }

  return (
    <ModalShell open={open} onClose={onClose} title={isEdit?"Edit User":"Create New User"} dark={dark}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Full Name" error={errors.name}>
          <SInput value={form.name} onChange={set("name")} placeholder="e.g. Sarah Johnson" dark={dark}/>
        </Field>
        <Field label="Username" error={errors.username}>
          <SInput value={form.username} onChange={set("username")} placeholder="e.g. sarah_j" dark={dark}/>
        </Field>
      </div>
      <Field label="Email" error={errors.email}>
        <SInput value={form.email} onChange={set("email")} placeholder="user@store.com" type="email" dark={dark}/>
      </Field>
      <Field label={isEdit?"New Password (leave blank to keep)":"Password"} error={errors.password}>
        <SInput value={form.password} onChange={set("password")} type="password"
          placeholder={isEdit?"Leave blank to keep":"Min 6 characters"} dark={dark}/>
      </Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="Role">
          <SSelect value={form.role} onChange={v => set("role")(v as Role)} options={roleOpts} dark={dark}/>
        </Field>
        <Field label="Status">
          <SSelect value={form.status} onChange={v => set("status")(v as Status)}
            options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]} dark={dark}/>
        </Field>
      </div>
      {errors.submit && (
        <div style={{ padding:"10px 14px", borderRadius:12, marginBottom:14, background:"#ef444418", border:"1px solid #ef444433", fontSize:12, color:"#ef4444" }}>
          {errors.submit}
        </div>
      )}
      <div style={{ display:"flex", gap:10, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:"11px 0", borderRadius:14, border:`1px solid ${T(dark).cardBorder}`, background:"transparent", cursor:"pointer", fontSize:13, fontWeight:700, color:T(dark).textSub }}>Cancel</button>
        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={submit} disabled={loading}
          style={{ flex:2, padding:"11px 0", borderRadius:14, border:"none", cursor:loading?"not-allowed":"pointer", fontSize:13, fontWeight:700, color:"#fff", background:loading?cfg.color+"66":cfg.gradient, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {loading && <Loader2 size={13} className="animate-spin"/>}
          {loading?"Saving…":isEdit?"Save Changes":"Create User"}
        </motion.button>
      </div>
    </ModalShell>
  );
};

/* ═══════════════════════════════════════════════
   RESET PASSWORD MODAL
═══════════════════════════════════════════════ */
const ResetPasswordModal: React.FC<{
  open:boolean; onClose:()=>void; dark:boolean;
  user:AppUser|null; onReset:(id:string, pwd:string)=>Promise<void>;
}> = ({ open, onClose, dark, user, onReset }) => {
  const t = T(dark);
  const [pwd, setPwd]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setPwd(""); setConfirm(""); setError(""); }, [open]);

  async function submit() {
    if (pwd.length < 6)  { setError("Min 6 characters"); return; }
    if (pwd !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try { await onReset(user!._id, pwd); onClose(); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="Reset Password" dark={dark} width={420}>
      <p style={{ margin:"0 0 20px", fontSize:13, color:t.textSub, lineHeight:1.6 }}>
        Set a new password for <strong style={{ color:t.text }}>{user?.name}</strong>.
        The new password will be encrypted and stored securely.
      </p>
      <Field label="New Password">
        <SInput value={pwd} onChange={setPwd} type="password" placeholder="Min 6 characters" dark={dark}/>
      </Field>
      <Field label="Confirm Password" error={error}>
        <SInput value={confirm} onChange={setConfirm} type="password" placeholder="Repeat password" dark={dark}/>
      </Field>
      <div style={{ display:"flex", gap:10, marginTop:4 }}>
        <button onClick={onClose} style={{ flex:1, padding:"11px 0", borderRadius:14, border:`1px solid ${t.cardBorder}`, background:"transparent", cursor:"pointer", fontSize:13, fontWeight:700, color:t.textSub }}>Cancel</button>
        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={submit} disabled={loading}
          style={{ flex:2, padding:"11px 0", borderRadius:14, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"#fff", background:dark?"#f0f0f8":"#18181b", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {loading && <Loader2 size={13}/>}
          {loading?"Resetting…":"Reset Password"}
        </motion.button>
      </div>
    </ModalShell>
  );
};

/* ═══════════════════════════════════════════════
   DELETE MODAL
═══════════════════════════════════════════════ */
const DeleteModal: React.FC<{
  open:boolean; onClose:()=>void; dark:boolean;
  user:AppUser|null; onDelete:(id:string)=>Promise<void>;
}> = ({ open, onClose, dark, user, onDelete }) => {
  const t = T(dark);
  const [loading, setLoading] = useState(false);
  async function submit() { setLoading(true); try { await onDelete(user!._id); onClose(); } finally { setLoading(false); } }
  return (
    <ModalShell open={open} onClose={onClose} title="Delete User" dark={dark} width={400}>
      <div style={{ textAlign:"center", padding:"8px 0 20px" }}>
        <div style={{ width:60, height:60, borderRadius:"50%", background:"#ef444418", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
          <Trash2 size={24} style={{ color:"#ef4444" }}/>
        </div>
        <p style={{ margin:"0 0 6px", fontSize:15, fontWeight:700, color:t.text }}>Delete this user?</p>
        <p style={{ margin:0, fontSize:13, color:t.textSub, lineHeight:1.6 }}>
          <strong style={{ color:t.text }}>{user?.name}</strong>'s account will be permanently removed. This cannot be undone.
        </p>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={onClose} style={{ flex:1, padding:"11px 0", borderRadius:14, border:`1px solid ${t.cardBorder}`, background:"transparent", cursor:"pointer", fontSize:13, fontWeight:700, color:t.textSub }}>Cancel</button>
        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={submit} disabled={loading}
          style={{ flex:1, padding:"11px 0", borderRadius:14, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"#fff", background:"#ef4444", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {loading && <Loader2 size={13}/>}
          {loading?"Deleting…":"Delete"}
        </motion.button>
      </div>
    </ModalShell>
  );
};

/* ═══════════════════════════════════════════════
   DETAIL MODAL
═══════════════════════════════════════════════ */
const DetailModal: React.FC<{ open:boolean; onClose:()=>void; dark:boolean; user:AppUser|null }> = ({ open, onClose, dark, user }) => {
  const t = T(dark);
  if (!user) return null;
  const cfg = ROLE_CONFIG[user.role];
  const rows: [string, React.ReactNode][] = [
    ["Username",   <span style={{ fontFamily:"monospace", fontSize:12 }}>{user.username}</span>],
    ["Email",      <span style={{ fontFamily:"monospace", fontSize:12 }}>{user.email}</span>],
    ["Role",       <RoleBadge role={user.role}/>],
    ["Status",     <StatusDot status={user.status}/>],
    ["Joined",     fmtDate(user.createdAt)],
    ["Last Login", timeAgo(user.lastLogin)],
    ["Created By", user.createdBy?.name ?? "System"],
    ["Password",   <span style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>🔒 Bcrypt encrypted</span>],
  ];
  return (
    <ModalShell open={open} onClose={onClose} title="User Details" dark={dark} width={440}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:22, padding:"16px 18px", borderRadius:16, background:cfg.color+(dark?"14":"0d"), border:`1px solid ${cfg.color}22` }}>
        <Avatar name={user.name} size={52}/>
        <div>
          <div style={{ fontWeight:800, fontSize:18, color:t.text }}>{user.name}</div>
          <div style={{ fontSize:12, color:t.textMuted, marginTop:2 }}>@{user.username}</div>
          <div style={{ marginTop:7 }}><RoleBadge role={user.role}/></div>
        </div>
      </div>
      <div style={{ borderRadius:14, border:`1px solid ${t.cardBorder}`, overflow:"hidden" }}>
        {rows.map(([k,v],i) => (
          <div key={String(k)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 16px", background:i%2===0?t.input:"transparent", borderBottom:i<rows.length-1?`1px solid ${t.divider}`:"none" }}>
            <span style={{ fontSize:10, color:t.textMuted, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5 }}>{k}</span>
            <span style={{ fontSize:12, color:t.text, fontWeight:500 }}>{v}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
};

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
const Toast: React.FC<{ toasts:ToastItem[]; remove:(id:number)=>void }> = ({ toasts, remove }) => (
  <div style={{ position:"fixed", bottom:24, right:24, zIndex:2000, display:"flex", flexDirection:"column", gap:8 }}>
    <AnimatePresence>
      {toasts.map(item => (
        <motion.div key={item.id} initial={{ opacity:0, x:30, scale:0.9 }} animate={{ opacity:1, x:0, scale:1 }} exit={{ opacity:0, x:30, scale:0.9 }}
          style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", borderRadius:14, maxWidth:320, minWidth:220, background:item.type==="error"?"#ef444418":"#22c55e18", border:`1px solid ${item.type==="error"?"#ef444433":"#22c55e33"}`, boxShadow:"0 8px 24px rgba(0,0,0,0.25)" }}>
          {item.type==="error" ? <XCircle size={15} style={{ color:"#ef4444", flexShrink:0 }}/> : <CheckCircle2 size={15} style={{ color:"#22c55e", flexShrink:0 }}/>}
          <span style={{ fontSize:13, fontWeight:600, color:item.type==="error"?"#ef4444":"#22c55e", flex:1 }}>{item.msg}</span>
          <button onClick={() => remove(item.id)} style={{ border:"none", background:"none", cursor:"pointer", color:"#888899", padding:0 }}><X size={13}/></button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

/* ═══════════════════════════════════════════════
   USER PERMISSIONS MODAL
═══════════════════════════════════════════════ */
const UserPermissionsModal: React.FC<{
  open: boolean; onClose: () => void; dark: boolean;
  user: AppUser | null; onSaved: (msg: string) => void;
}> = ({ open, onClose, dark, user, onSaved }) => {
  const t = T(dark);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [errMsg,   setErrMsg]   = useState("");
  const [roleDefaults, setRoleDefaults] = useState<Record<PermissionKey,boolean>>({} as Record<PermissionKey,boolean>);
  const [overrides,    setOverrides]    = useState<Partial<Record<PermissionKey,boolean>>>({});

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true); setErrMsg("");
    api("GET", `/users/${user._id}/permissions`)
      .then(data => {
        setRoleDefaults(data.rolePermissions || {});
        setOverrides(data.userOverrides || {});
      })
      .catch((err: Error) => setErrMsg(err.message || "Failed to load permissions"))
      .finally(() => setLoading(false));
  }, [open, user?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getEffective = (key: PermissionKey) =>
    key in overrides && overrides[key] !== undefined ? overrides[key]! : (roleDefaults[key] ?? false);

  const togglePerm = (key: PermissionKey) => {
    const next = !getEffective(key);
    if (next === (roleDefaults[key] ?? false)) {
      setOverrides(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setOverrides(prev => ({ ...prev, [key]: next }));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true); setErrMsg("");
    try {
      await api("PUT", `/users/${user._id}/permissions`, { permissionOverrides: overrides });
      onSaved(`Permissions updated for ${user.name}`);
      onClose();
    } catch (err: any) {
      setErrMsg(err.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const roleColor = user ? (ROLE_ACCENT[user.role] ?? "#22d3ee") : "#22d3ee";

  return (
    <ModalShell open={open} onClose={onClose} title="Feature Access Control" width={520} dark={dark}>
      {loading ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:40, gap:10, color:t.textMuted }}>
          <Loader2 size={18} style={{ animation:"spin 1s linear infinite" }}/> Loading…
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:11, color:t.textMuted, marginBottom:3 }}>Override role permissions for</div>
              <div style={{ fontSize:14, fontWeight:700, color:t.text, display:"flex", alignItems:"center", gap:8 }}>
                {user?.name}
                <span style={{ fontSize:9, padding:"2px 9px", borderRadius:8, background:roleColor+"18", color:roleColor, fontWeight:700, textTransform:"uppercase", letterSpacing:0.6 }}>
                  {user?.role}
                </span>
              </div>
            </div>
            <button onClick={() => setOverrides({})}
              style={{ fontSize:11, fontWeight:700, padding:"5px 12px", borderRadius:10, border:`1px solid ${t.cardBorder}`, background:t.input, color:t.textSub, cursor:"pointer" }}>
              Reset All
            </button>
          </div>

          {/* Permission rows */}
          <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:20 }}>
            {PERMISSION_KEYS.map(key => {
              const effective   = getEffective(key);
              const isCustom    = key in overrides && overrides[key] !== undefined;
              const roleDefault = roleDefaults[key] ?? false;
              return (
                <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderRadius:14, background:t.input, border:`1px solid ${isCustom ? (effective ? "#22c55e44" : "#ef444444") : t.cardBorder}`, transition:"border-color 0.2s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:9, background:effective ? "#22c55e15" : "#ef444415", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {effective
                        ? <CheckCircle2 size={14} style={{ color:"#22c55e" }}/>
                        : <XCircle      size={14} style={{ color:"#ef4444" }}/>
                      }
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:t.text }}>{PERM_LABELS[key]}</div>
                      <div style={{ fontSize:10, color:t.textMuted, display:"flex", alignItems:"center", gap:5 }}>
                        Role default: {roleDefault ? "Allowed" : "Denied"}
                        {isCustom && (
                          <span style={{ padding:"1px 6px", borderRadius:6, background:"#f59e0b18", color:"#f59e0b", fontWeight:700, fontSize:9, letterSpacing:0.4, border:"1px solid #f59e0b22" }}>
                            CUSTOM
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Toggle */}
                  <button onClick={() => togglePerm(key)} title={effective ? "Click to deny" : "Click to allow"}
                    style={{ width:42, height:22, borderRadius:11, border:"none", cursor:"pointer", position:"relative", background:effective ? "#22c55e" : "#6b7280", transition:"background 0.2s", flexShrink:0 }}>
                    <span style={{ position:"absolute", top:2, left:effective ? 20 : 2, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.25)", display:"block" }}/>
                  </button>
                </div>
              );
            })}
          </div>

          {errMsg && <div style={{ color:"#ef4444", fontSize:12, marginBottom:12 }}>{errMsg}</div>}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button onClick={onClose}
              style={{ padding:"9px 18px", borderRadius:12, border:`1px solid ${t.cardBorder}`, background:"transparent", color:t.textSub, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding:"9px 20px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#f59e0b,#ef4444)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", opacity:saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Save Permissions"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
};

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
const UserManagement: React.FC = () => {
  const { isDark, preset, setMode } = useThemeConfig();
  const palette = getPresetPalette(preset);
  /* Read current user from localStorage (set during login) */
  const stored     = localStorage.getItem("pos_user");
  const parsedUser = stored ? JSON.parse(stored) : null;
  const currentUser = parsedUser || { role: "admin", username: "admin" };
  const cfg = ROLE_CONFIG[currentUser.role as Role] || ROLE_CONFIG.admin;
  const canEditRoles = currentUser.role === "superadmin" || currentUser.role === "admin";
  const ROLE_HIERARCHY: Record<string,number> = { superadmin:4, admin:3, manager:2, cashier:1 };
  const canEditProfile = (profileRole: string) => {
    if (!canEditRoles) return false;
    const myLevel = ROLE_HIERARCHY[currentUser.role] ?? 0;
    const targetLevel = ROLE_HIERARCHY[profileRole] ?? 0;
    return targetLevel < myLevel; // can only edit roles below yourself
  };

  const dark = isDark;
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const [users, setUsers]           = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState<Role|"all">("all");
  const [statusFilter, setStatusFilter] = useState<Status|"all">("all");
  const [toasts, setToasts]         = useState<ToastItem[]>([]);
  const [modals, setModals]         = useState<ModalState>({ create:false, edit:null, delete:null, reset:null, detail:null, permissions:null });
  const [roleProfiles, setRoleProfiles] = useState<RolePermissionProfile[]>(DEFAULT_ROLE_PERMISSIONS);
  const [newRoleName, setNewRoleName] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const t = T(dark);

  const addToast = useCallback((msg:string, type:"success"|"error"="success") => {
    const id = nextToastId();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3500);
  }, []);

  const fetchRoleProfiles = useCallback(async () => {
    try {
      const data = await api("GET", "/role-permissions");
      if (Array.isArray(data) && data.length > 0) setRoleProfiles(data);
    } catch (err: any) {
      addToast(err.message || "Failed to load role permissions", "error");
    }
  }, [addToast]);
  useEffect(() => {
    if (currentUser.role === "superadmin" || currentUser.role === "admin") fetchRoleProfiles();
  }, [currentUser.role, fetchRoleProfiles]);

  const cm = useCallback(<K extends keyof ModalState>(k:K, v:ModalState[K]) => {
    setModals(m => ({ ...m, [k]:v }));
  }, []);

  /* ── Fetch users from API ── */
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter   !== "all") params.set("role",   roleFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search)                  params.set("search", search);
      const data = await api("GET", `/users?${params}`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addToast(err.message || "Failed to load users", "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [roleFilter, statusFilter, search, addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u => u.role !== "superadmin" || currentUser.role === "superadmin");
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter, users.length]);

  const stats = {
    total:    users.length,
    active:   users.filter(u => u.status === "active").length,
    admins:   users.filter(u => u.role === "admin").length,
    managers: users.filter(u => u.role === "manager").length,
    cashiers: users.filter(u => u.role === "cashier").length,
  };

  /* ── CRUD handlers ── */
  const handleCreate = async (data: UserFormData) => {
    await api("POST", "/users", data);
    addToast(`${data.name} created successfully`);
    fetchUsers();
  };

  const handleEdit = async (data: UserFormData) => {
    await api("PUT", `/users/${modals.edit!._id}`, data);
    addToast("User updated successfully");
    fetchUsers();
  };

  const handleDelete = async (id: string) => {
    await api("DELETE", `/users/${id}`);
    addToast("User deleted");
    fetchUsers();
  };

  const handleToggle = async (user: AppUser) => {
    await api("PATCH", `/users/${user._id}/status`);
    const ns = user.status === "active" ? "inactive" : "active";
    addToast(`${user.name} marked ${ns}`);
    fetchUsers();
  };

  const handleReset = async (id: string, pwd: string) => {
    await api("PATCH", `/users/${id}/password`, { password: pwd });
    addToast("Password reset and encrypted successfully");
  };
  const addRoleProfile = async () => {
    const role = newRoleName.trim().toLowerCase();
    if (!role) return;
    if (roleProfiles.some(r => r.role === role)) { addToast("Role already exists", "error"); return; }
    try {
      await api("POST", "/role-permissions", {
        role,
        enabled: true,
        permissions: { pos:false, inventory:false, salesReports:false, customers:false, orders:false, taxes:false, userMgmt:false },
      });
      setNewRoleName("");
      addToast(`Role "${role}" created`);
      fetchRoleProfiles();
    } catch (err: any) {
      addToast(err.message || "Failed to create role", "error");
    }
  };
  const togglePermission = async (profile: RolePermissionProfile, key: PermissionKey) => {
    if (!profile._id) return;
    if (!profile.enabled) {
      addToast(`Enable "${profile.role}" role first`, "error");
      return;
    }
    const nextPermissions = { ...profile.permissions, [key]: !profile.permissions[key] };
    setRoleProfiles(prev => prev.map(r => r._id === profile._id ? { ...r, permissions: nextPermissions } : r));
    try {
      await api("PUT", `/role-permissions/${profile._id}`, { permissions: nextPermissions });
    } catch (err: any) {
      addToast(err.message || "Failed to update role permission", "error");
      fetchRoleProfiles();
    }
  };
  const toggleRoleEnabled = async (profile: RolePermissionProfile) => {
    if (!profile._id || profile.role === "superadmin") return;
    const nextEnabled = !profile.enabled;
    setRoleProfiles(prev => prev.map(r => r._id === profile._id ? { ...r, enabled: nextEnabled } : r));
    try {
      await api("PUT", `/role-permissions/${profile._id}`, { enabled: nextEnabled });
      addToast(`Role "${profile.role}" ${nextEnabled ? "enabled" : "disabled"}`);
    } catch (err: any) {
      addToast(err.message || "Failed to update role status", "error");
      fetchRoleProfiles();
    }
  };
  const removeRoleProfile = async (profile: RolePermissionProfile) => {
    if (!profile._id || profile.isSystem) return;
    try {
      await api("DELETE", `/role-permissions/${profile._id}`);
      addToast(`Role "${profile.role}" removed`);
      fetchRoleProfiles();
    } catch (err: any) {
      addToast(err.message || "Failed to delete role", "error");
    }
  };

  /* ── Action button ── */
  const ABtn: React.FC<{ icon:React.ElementType; title:string; onClick:()=>void; danger?:boolean }> = ({ icon:Icon, title, onClick, danger=false }) => {
    const [hov, setHov] = useState(false);
    return (
      <button title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ border:"none", cursor:"pointer", borderRadius:8, padding:"5px 6px", background:hov?(danger?"#ef444420":t.input):"transparent", color:danger?"#ef4444":t.textSub, display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
        <Icon size={13}/>
      </button>
    );
  };

  return (
    <div style={{ height:"100%", overflowY:"auto", background:t.bg, transition:"background 0.3s", fontFamily:"'Sora','DM Sans',system-ui,sans-serif" }}>

      {/* ── Topbar ── */}
      <div style={{ padding:isMobile?"12px 14px":"20px 32px", borderBottom:`1px solid ${t.divider}`, background:t.card, transition:"background 0.3s", display:"flex", flexWrap:"wrap", gap:10, alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div>
          <h1 style={{ margin:0, color:t.text, fontSize:22, fontWeight:700, letterSpacing:-0.3 }}>User Management</h1>
          <p style={{ margin:"3px 0 0", color:t.textMuted, fontSize:12 }}>Manage staff accounts — passwords are bcrypt encrypted</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:12, background:cfg.color+"14", border:`1px solid ${cfg.color}30` }}>
            {React.createElement(cfg.icon, { size:12, style:{ color:cfg.color } })}
            <span style={{ fontSize:11, fontWeight:700, color:cfg.color }}>{cfg.label}</span>
          </div>
          <button onClick={fetchUsers} style={{ padding:9, background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center" }}>
            <RefreshCw size={14} style={{ color:t.textSub }}/>
          </button>
          <motion.button whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }} onClick={() => setMode(dark ? "light" : "dark")}
            style={{ padding:9, background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <AnimatePresence mode="wait">
              <motion.span key={dark?"sun":"moon"} initial={{ rotate:-90, opacity:0 }} animate={{ rotate:0, opacity:1 }} exit={{ rotate:90, opacity:0 }} transition={{ duration:0.18 }}>
                {dark ? <Sun size={14} style={{ color:palette.accent }}/> : <Moon size={14} style={{ color:palette.accentSoft }}/>}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          {cfg.canCreate.length > 0 && (
            <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={() => cm("create",true)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:12, border:"none", background:cfg.gradient, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:`0 4px 14px ${cfg.color}33` }}>
              <Plus size={15}/> New User
            </motion.button>
          )}
        </div>
      </div>

      <div style={{ padding:isMobile?"14px 14px 24px":"26px 32px", display:"flex", flexDirection:"column", gap:22 }}>

        {/* ── Stat cards ── */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:18 }}>
          {[
            { label:"Total Staff",  value:stats.total,    accent:"#22d3ee", icon:Users,        sub:`${stats.active} active`  },
            { label:"Admins",       value:stats.admins,   accent:"#f59e0b", icon:Shield,       sub:"Full access"             },
            { label:"Managers",     value:stats.managers, accent:"#34d399", icon:Store,        sub:"Reports & staff"         },
            { label:"Cashiers",     value:stats.cashiers, accent:"#a78bfa", icon:ShoppingCart, sub:"POS terminal only"       },
          ].map((c,i) => (
            <motion.div key={c.label} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07, type:"spring", stiffness:200 }}>
              <StatCard {...c} dark={dark}/>
            </motion.div>
          ))}
        </div>

        {/* ── Security notice ── */}
        <div style={{ background:dark?"#22c55e10":"#f0fdf4", border:"1px solid #22c55e30", borderRadius:16, padding:"12px 18px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px #22c55e88", flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"#22c55e", fontWeight:600 }}>
            🔒 All passwords are stored using bcrypt (cost factor 12) — plain text passwords are never stored in the database.
          </span>
        </div>

        {/* ── Toolbar ── */}
        <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:20, padding:"14px 18px", display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
          <div style={{ flex:"1 1 200px", position:"relative" }}>
            <Search size={13} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:t.textMuted, pointerEvents:"none" }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, username or email…"
              style={{ width:"100%", padding:"9px 13px 9px 34px", border:`1.5px solid ${t.inputBorder}`, borderRadius:12, fontSize:13, outline:"none", color:t.inputText, background:t.input, fontFamily:"inherit", boxSizing:"border-box", transition:"border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor="#22d3ee"}
              onBlur={e  => e.target.style.borderColor=t.inputBorder}/>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {(["all", ...cfg.canCreate] as (Role|"all")[]).map(r => {
              const active = roleFilter === r;
              const color  = r==="all" ? t.pill.activeBg : ROLE_ACCENT[r];
              return (
                <button key={r} onClick={() => setRoleFilter(r)} style={{ padding:"6px 13px", borderRadius:20, border:`1.5px solid ${active?color:t.cardBorder}`, background:active?color:"transparent", color:active?(r==="all"?t.pill.activeText:"#fff"):t.textMuted, fontSize:10, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", transition:"all 0.18s" }}>
                  {r==="all"?"All Roles":ROLE_CONFIG[r].label}
                </button>
              );
            })}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status|"all")}
            style={{ padding:"9px 13px", border:`1.5px solid ${t.inputBorder}`, borderRadius:12, fontSize:12, outline:"none", color:t.inputText, background:t.input, fontFamily:"inherit", cursor:"pointer" }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span style={{ color:t.textMuted, fontSize:11, marginLeft:"auto" }}>
            {loadingUsers ? "Loading…" : `${filtered.length} user${filtered.length!==1?"s":""}`}
          </span>
        </div>

        {/* ── Table ── */}
        <div style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:28, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2.2fr 1.8fr 1.1fr 1fr 1fr 120px", padding:"12px 24px", background:t.tableHead, borderBottom:`1px solid ${t.divider}`, minWidth:700 }}>
            {["User","Email / Username","Role","Status","Last Login","Actions"].map(h => (
              <span key={h} style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, color:t.textMuted }}>{h}</span>
            ))}
          </div>

          {loadingUsers ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 20px", gap:12, color:t.textMuted }}>
              <Loader2 size={20} style={{ animation:"spin 1s linear infinite" }}/> Loading users…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"60px 20px" }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:t.input, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                <Search size={22} style={{ color:t.textMuted }}/>
              </div>
              <div style={{ fontWeight:700, fontSize:15, color:t.text }}>No users found</div>
              <div style={{ fontSize:12, color:t.textMuted, marginTop:5 }}>Try adjusting your search or filters</div>
            </div>
          ) : paginatedUsers.map((user, i) => (
            <motion.div key={user._id} initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.03 }}
              style={{ display:"grid", gridTemplateColumns:"2.2fr 1.8fr 1.1fr 1fr 1fr 120px", padding:"14px 24px", alignItems:"center", borderBottom:i<filtered.length-1?`1px solid ${t.divider}`:"none", transition:"background 0.15s", minWidth:700 }}
              onMouseEnter={e => (e.currentTarget.style.background=t.rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <Avatar name={user.name} size={36}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:t.text }}>{user.name}</div>
                  <div style={{ fontSize:10, color:t.textMuted, marginTop:1 }}>Joined {fmtDate(user.createdAt)}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:t.textSub, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</div>
                <div style={{ fontSize:10, color:t.textMuted, marginTop:1 }}>@{user.username}</div>
              </div>
              <RoleBadge role={user.role}/>
              <button onClick={() => void handleToggle(user)} title="Click to toggle" style={{ border:"none", background:"none", cursor:"pointer", padding:0, textAlign:"left" }}>
                <StatusDot status={user.status}/>
              </button>
              <span style={{ fontSize:11, color:t.textMuted, display:"flex", alignItems:"center", gap:4 }}>
                <Clock size={10}/>{timeAgo(user.lastLogin)}
              </span>
              <div style={{ display:"flex", gap:2 }}>
                <ABtn icon={Eye}         title="View details"   onClick={() => cm("detail",user)}/>
                <ABtn icon={UserCircle2} title="Edit user"      onClick={() => cm("edit",user)}/>
                <ABtn icon={KeyRound}    title="Reset password" onClick={() => cm("reset",user)}/>
                {currentUser.role === "superadmin" && user.role !== "superadmin" && (
                  <ABtn icon={SlidersHorizontal} title="Manage feature access" onClick={() => cm("permissions",user)}/>
                )}
                <ABtn icon={Trash2}      title="Delete user"    onClick={() => cm("delete",user)} danger/>
              </div>
            </motion.div>
          ))}
          </div>

          {filtered.length > 0 && (
            <div style={{ padding:"11px 24px", borderTop:`1px solid ${t.divider}`, background:t.tableHead, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:11, color:t.textMuted }}>Showing {paginatedUsers.length} of {filtered.length} users</span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  style={{ padding:"5px 9px", borderRadius:8, border:`1px solid ${t.cardBorder}`, background:"transparent", color:t.textSub, fontSize:10, fontWeight:700, cursor:"pointer", opacity:currentPage===1?0.4:1 }}>Prev</button>
                <span style={{ fontSize:10, color:t.textMuted, fontWeight:700 }}>{currentPage}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  style={{ padding:"5px 9px", borderRadius:8, border:`1px solid ${t.cardBorder}`, background:"transparent", color:t.textSub, fontSize:10, fontWeight:700, cursor:"pointer", opacity:currentPage===totalPages?0.4:1 }}>Next</button>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 6px #22c55e88" }}/>
                <span style={{ fontSize:10, color:"#22c55e", fontWeight:700 }}>{stats.active} active</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Role permissions matrix (superadmin full control, admin read-only) ── */}
        {(currentUser.role === "superadmin" || currentUser.role === "admin") && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.42 }}
            style={{ background:t.card, border:`1px solid ${t.cardBorder}`, borderRadius:28, padding:26 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
              <div style={{ color:t.text, fontWeight:700, fontSize:16 }}>Role Permissions Matrix</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {currentUser.role === "admin" && (
                  <span style={{ fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:20, background:"#22d3ee18", color:"#22d3ee", border:"1px solid #22d3ee22" }}>
                    Can edit Manager & Cashier
                  </span>
                )}
                {!canEditRoles && (
                  <span style={{ fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:20, background:"#f59e0b18", color:"#f59e0b", border:"1px solid #f59e0b22" }}>
                    View Only
                  </span>
                )}
              </div>
            </div>
            <div style={{ color:t.textMuted, fontSize:11, marginBottom:14 }}>
              Toggle permissions to control which pages each role can access. Changes take effect on next login.
            </div>
            {currentUser.role === "superadmin" && (
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="new custom role name"
                  style={{ flex:1, padding:"9px 12px", border:`1px solid ${t.cardBorder}`, borderRadius:10, background:t.input, color:t.text, fontSize:12 }} />
                <button onClick={addRoleProfile}
                  style={{ padding:"9px 14px", borderRadius:10, border:"none", background:"#18181b", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  Add Role
                </button>
              </div>
            )}
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:t.tableHead }}>
                    {["Role","Status", ...PERMISSION_KEYS.map(k => PERM_LABELS[k]), "Actions"].map(h => (
                      <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:t.textMuted, borderBottom:`1px solid ${t.divider}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roleProfiles.map(profile => {
                    const role = profile.role as Role;
                    const editable = canEditProfile(profile.role);
                    return (
                      <tr key={profile.role} style={{ borderBottom:`1px solid ${t.divider}` }}
                        onMouseEnter={e => (e.currentTarget.style.background=t.rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
                        <td style={{ padding:"12px 16px" }}>
                          {ROLE_CONFIG[role]
                            ? <RoleBadge role={role}/>
                            : <span style={{ fontSize:11, fontWeight:700, color:t.text }}>{profile.role}</span>}
                        </td>
                        <td style={{ padding:"12px 16px" }}>
                          <button
                            onClick={() => editable && toggleRoleEnabled(profile)}
                            disabled={profile.role === "superadmin" || !editable}
                            style={{
                              border:"none",
                              cursor: (!editable || profile.role === "superadmin") ? "not-allowed" : "pointer",
                              fontSize:10, fontWeight:700, borderRadius:999, padding:"5px 10px",
                              background: profile.enabled ? "#22c55e20" : "#ef444420",
                              color: profile.enabled ? "#22c55e" : "#ef4444",
                              opacity: (!editable || profile.role === "superadmin") ? 0.6 : 1
                            }}
                            title={!editable ? "Insufficient permissions" : profile.role === "superadmin" ? "Superadmin cannot be disabled" : "Toggle role status"}
                          >
                            {profile.enabled ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        {PERMISSION_KEYS.map((key) => (
                          <td key={key} style={{ padding:"12px 16px" }}>
                            <button
                              onClick={() => editable && togglePermission(profile, key)}
                              disabled={!profile.enabled || !editable}
                              style={{ border:"none", background:"transparent", cursor:(profile.enabled && editable) ? "pointer" : "not-allowed", padding:0, opacity: profile.enabled ? 1 : 0.45 }}
                              title={!editable ? "Insufficient permissions" : `Toggle ${PERM_LABELS[key]}`}
                            >
                              {profile.permissions[key]
                                ? <CheckCircle2 size={16} style={{ color:"#22c55e" }}/>
                                : <XCircle size={16} style={{ color:dark?"rgba(255,255,255,0.18)":"rgba(15,23,42,0.15)" }}/>}
                            </button>
                          </td>
                        ))}
                        <td style={{ padding:"12px 16px" }}>
                          {!profile.isSystem && currentUser.role === "superadmin" && (
                              <button onClick={() => removeRoleProfile(profile)}
                                style={{ border:"none", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11, fontWeight:700 }}>
                                Delete
                              </button>
                            )}
                          </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Modals ── */}
      <UserFormModal open={modals.create}      onClose={() => cm("create",false)} dark={dark} onSave={handleCreate} editUser={null}        currentRole={currentUser.role as Role} roleProfiles={roleProfiles}/>
      <UserFormModal open={!!modals.edit}       onClose={() => cm("edit",null)}   dark={dark} onSave={handleEdit}   editUser={modals.edit} currentRole={currentUser.role as Role} roleProfiles={roleProfiles}/>
      <DeleteModal   open={!!modals.delete}     onClose={() => cm("delete",null)} dark={dark} user={modals.delete}  onDelete={handleDelete}/>
      <ResetPasswordModal open={!!modals.reset} onClose={() => cm("reset",null)}  dark={dark} user={modals.reset}   onReset={handleReset}/>
      <DetailModal   open={!!modals.detail}     onClose={() => cm("detail",null)} dark={dark} user={modals.detail}/>
      <UserPermissionsModal open={!!modals.permissions} onClose={() => cm("permissions",null)} dark={dark} user={modals.permissions} onSaved={msg => addToast(msg)}/>
      <Toast toasts={toasts} remove={id => setToasts(p => p.filter(x => x.id !== id))}/>
    </div>
  );
};

export default UserManagement;