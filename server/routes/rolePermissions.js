import { Router } from "express";
import { RolePermission } from "../models/RolePermission.js";
import { User } from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

const DEFAULTS = [
  { role: "superadmin", isSystem: true, enabled: true, permissions: { pos: true,  inventory: true,  salesReports: true,  customers: true,  orders: true,  taxes: true,  payments: true,  userMgmt: true  } },
  { role: "admin",      isSystem: true, enabled: true, permissions: { pos: true,  inventory: true,  salesReports: true,  customers: true,  orders: true,  taxes: true,  payments: true,  userMgmt: true  } },
  { role: "manager",    isSystem: true, enabled: true, permissions: { pos: true,  inventory: true,  salesReports: true,  customers: true,  orders: true,  taxes: true,  payments: true,  userMgmt: false } },
  { role: "cashier",    isSystem: true, enabled: true, permissions: { pos: true,  inventory: false, salesReports: false, customers: false, orders: false, taxes: false, payments: false, userMgmt: false } },
];

/* Ensure default role records exist, and migrate any missing fields on existing records */
const ensureDefaults = async () => {
  const count = await RolePermission.countDocuments();
  if (count === 0) {
    await RolePermission.insertMany(DEFAULTS);
    return;
  }
  /* Add any newly-added permission fields to existing records */
  for (const def of DEFAULTS) {
    const existing = await RolePermission.findOne({ role: def.role });
    if (!existing) {
      await RolePermission.create(def);
      continue;
    }
    const missing = {};
    for (const [key, val] of Object.entries(def.permissions)) {
      if (existing.permissions[key] === undefined || existing.permissions[key] === null) {
        missing[`permissions.${key}`] = val;
      }
    }
    if (Object.keys(missing).length > 0) {
      await RolePermission.updateOne({ role: def.role }, { $set: missing });
    }
  }
};

const ALL_TRUE_PERMS = { pos: true, inventory: true, salesReports: true, customers: true, orders: true, taxes: true, payments: true, userMgmt: true };

/* ── GET /api/my-permissions — any authenticated user ── */
router.get("/my-permissions", requireAuth, async (req, res) => {
  try {
    /* Superadmin always gets every permission — no overrides apply */
    if (req.user.role === "superadmin") {
      return res.json({ role: "superadmin", enabled: true, permissions: ALL_TRUE_PERMS, hasOverrides: false });
    }

    await ensureDefaults();
    const [row, userDoc] = await Promise.all([
      RolePermission.findOne({ role: req.user.role }),
      User.findById(req.user.id).select("permissionOverrides"),
    ]);

    const def = DEFAULTS.find(d => d.role === req.user.role);
    const basePerms = row
      ? (typeof row.permissions.toObject === "function" ? row.permissions.toObject() : { ...row.permissions })
      : def?.permissions ?? { pos: true, inventory: true, salesReports: true, customers: true, orders: true, taxes: true, payments: true, userMgmt: false };

    /* Merge user-level overrides on top of role defaults */
    const rawOverrides = userDoc?.permissionOverrides
      ? (typeof userDoc.permissionOverrides.toObject === "function"
          ? userDoc.permissionOverrides.toObject()
          : { ...userDoc.permissionOverrides })
      : {};
    const overrides = Object.fromEntries(
      Object.entries(rawOverrides).filter(([, v]) => v !== null && v !== undefined)
    );
    const mergedPerms = { ...basePerms, ...overrides };

    res.json({
      role:         req.user.role,
      enabled:      row?.enabled ?? true,
      permissions:  mergedPerms,
      hasOverrides: Object.keys(overrides).length > 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /api/role-permissions — superadmin + admin ── */
router.get("/role-permissions", requireAuth, requireRole("superadmin", "admin"), async (_req, res) => {
  try {
    await ensureDefaults();
    const rows = await RolePermission.find().sort({ isSystem: -1, role: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── POST /api/role-permissions — create custom role (superadmin only) ── */
router.post("/role-permissions", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const role = String(req.body.role || "").trim().toLowerCase();
    if (!role) return res.status(400).json({ message: "Role is required" });
    const exists = await RolePermission.findOne({ role });
    if (exists) return res.status(400).json({ message: "Role already exists" });

    const created = await RolePermission.create({
      role,
      isSystem: false,
      enabled: true,
      permissions: req.body.permissions || {},
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ── PUT /api/role-permissions/:id — superadmin can edit any, admin can edit manager/cashier ── */
router.put("/role-permissions/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const patch = {};
    if (req.body.permissions) patch.permissions = req.body.permissions;
    if (typeof req.body.enabled === "boolean") patch.enabled = req.body.enabled;

    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const current = await RolePermission.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Role not found" });

    /* Superadmin role can never be disabled */
    if (current.role === "superadmin" && patch.enabled === false) {
      return res.status(400).json({ message: "Superadmin role cannot be disabled" });
    }
    /* Admin role can only be changed by superadmin */
    if (current.role === "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can modify admin permissions" });
    }
    /* Superadmin role permissions can only be changed by superadmin */
    if (current.role === "superadmin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can modify superadmin permissions" });
    }

    const row = await RolePermission.findByIdAndUpdate(
      req.params.id,
      patch,
      { new: true, runValidators: true }
    );
    if (!row) return res.status(404).json({ message: "Role not found" });
    res.json(row);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ── DELETE /api/role-permissions/:id — superadmin only, non-system roles ── */
router.delete("/role-permissions/:id", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const row = await RolePermission.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Role not found" });
    if (row.isSystem) return res.status(400).json({ message: "System roles cannot be deleted" });
    await RolePermission.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
