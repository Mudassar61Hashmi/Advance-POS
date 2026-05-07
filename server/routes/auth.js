import { Router }       from "express";
import { User }          from "../models/User.js";
import { RolePermission } from "../models/RolePermission.js";
import { LoginHistory }  from "../models/LoginHistory.js";
import { signToken, requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { logActivity }   from "../middleware/auditLog.js";
import { notifyByRoles } from "../middleware/notifyHelper.js";

const router = Router();

/* ════════════════════════════════════════════════
   PUBLIC ROUTES (no auth required)
════════════════════════════════════════════════ */

/* POST /api/login ─────────────────────────────── */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username?.trim() || !password?.trim())
    return res.status(400).json({ success: false, message: "Username and password required" });

  try {
    /* Find by username OR email — must use .select("+password") because
       the password field has select:false in the schema.               */
    const user = await User.findOne({
      $or: [
        { username: username.trim().toLowerCase() },
        { email:    username.trim().toLowerCase() },
      ],
    }).select("+password");

    const ip        = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? req.ip ?? null;
    const userAgent = req.headers["user-agent"] ?? null;

    if (!user) {
      console.log(`[Login] User not found: "${username}"`);
      await LoginHistory.create({ username: username.trim(), success: false, failReason: "User not found", ip, userAgent });
      await notifyByRoles(["superadmin"], "Failed Login Attempt", `Unknown user "${username.trim()}" tried to log in.`, "login");
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.status === "inactive") {
      console.log(`[Login] Inactive account: "${username}"`);
      await LoginHistory.create({ userId: user._id, username: user.username, role: user.role, success: false, failReason: "Account inactive", ip, userAgent });
      return res.status(403).json({ success: false, message: "Account is inactive. Contact your administrator." });
    }

    /* Verify the password field was actually loaded */
    if (!user.password) {
      console.error(`[Login] Password field missing for user "${username}" — was .select("+password") used?`);
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    /* Compare hashed password */
    const match = await user.comparePassword(password);
    if (!match) {
      console.log(`[Login] Wrong password for: "${username}"`);
      await LoginHistory.create({ userId: user._id, username: user.username, role: user.role, success: false, failReason: "Wrong password", ip, userAgent });
      await notifyByRoles(["superadmin"], "Failed Login Attempt", `Wrong password for user "${user.username}" (${user.role}).`, "login", { excludeId: user._id });
      return res.status(401).json({ success: false, message: "Wrong password" });
    }

    /* Update lastLogin */
    user.lastLogin = new Date();
    await user.save();

    /* Record successful login */
    await LoginHistory.create({ userId: user._id, username: user.username, role: user.role, success: true, ip, userAgent });

    /* Notify superadmin of all successful logins (except their own) */
    if (user.role !== "superadmin") {
      await notifyByRoles(["superadmin"], "User Login", `${user.username} (${user.role}) logged in.`, "login", { actorId: user._id, actorName: user.username, excludeId: user._id });
    }

    /* Sign JWT */
    const token = signToken({ id: user._id, username: user.username, role: user.role });

    console.log(`[Login] ✅ Success: "${username}" (${user.role})`);

    res.json({
      success: true,
      token,
      user: {
        id:       user._id,
        name:     user.name,
        username: user.username,
        email:    user.email,
        role:     user.role,
        status:   user.status,
      },
    });
  } catch (err) {
    console.error("[Login] Error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════
   PROTECTED ROUTES (JWT required)
════════════════════════════════════════════════ */

/* GET /api/me ─────────────────────────────────── */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/users ──────────────────────────────── */
router.get("/users", requireAuth, requireRole("superadmin", "admin", "manager"), async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const query = {};

    const visibleRoles = {
      superadmin: ["superadmin", "admin", "manager", "cashier"],
      admin:      ["admin", "manager", "cashier"],
      manager:    ["cashier"],
    };

    // Start with role-visibility restriction
    query.role = { $in: visibleRoles[req.user.role] || ["cashier"] };

    // Role filter — only allow filtering within visible roles
    if (role && role !== "all") {
      const allowed = visibleRoles[req.user.role] || ["cashier"];
      if (allowed.includes(role)) {
        query.role = role;
      }
    }

    if (status && status !== "all") query.status = status;

    if (search) {
      query.$or = [
        { name:     { $regex: search, $options: "i" } },
        { email:    { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/users/:id ──────────────────────────── */
router.get("/users/:id", requireAuth, requireRole("superadmin", "admin", "manager"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("createdBy", "name email role");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* POST /api/users ─────────────────────────────── */
router.post("/users", requireAuth, requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const { name, email, username, password, role, status } = req.body;

  if (!name || !email || !username || !password || !role)
    return res.status(400).json({ message: "name, email, username, password, role are required" });

  const hierarchy = { superadmin: 4, admin: 3, manager: 2, cashier: 1 };

  if ((hierarchy[role] || 0) >= (hierarchy[req.user.role] || 0))
    return res.status(403).json({ message: `You cannot create a ${role} account` });

  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });

  try {
    const roleProfile = await RolePermission.findOne({ role }).select("enabled");
    if (roleProfile && roleProfile.enabled === false)
      return res.status(400).json({ message: `Role "${role}" is disabled` });

    const exists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });
    if (exists)
      return res.status(400).json({ message: "Email or username already in use" });

    const user = await User.create({
      name, email, username, password, role,
      status: status || "active",
      createdBy: req.user.id,
    });

    await logActivity(req, "CREATE_USER", "User", user._id, { username: user.username, role: user.role });
    await notifyByRoles(["superadmin", "admin"], "New User Created",
      `${req.user.username} created user "${user.username}" (${user.role}).`,
      "user", { actorId: req.user.id, actorName: req.user.username, entityId: String(user._id), entityType: "User", excludeId: req.user.id });

    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* PUT /api/users/:id ──────────────────────────── */
router.put("/users/:id", requireAuth, requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const { name, email, username, role, status } = req.body;

  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    const hierarchy = { superadmin: 4, admin: 3, manager: 2, cashier: 1 };

    if ((hierarchy[target.role] || 0) >= (hierarchy[req.user.role] || 0))
      return res.status(403).json({ message: "Cannot edit this user" });

    if (name)     target.name     = name;
    if (email)    target.email    = email.toLowerCase();
    if (username) target.username = username.toLowerCase();
    if (status)   target.status   = status;

    if (role) {
      if ((hierarchy[role] || 0) >= (hierarchy[req.user.role] || 0))
        return res.status(403).json({ message: `Cannot assign ${role} role` });

      const roleProfile = await RolePermission.findOne({ role }).select("enabled");
      if (roleProfile && roleProfile.enabled === false)
        return res.status(400).json({ message: `Role "${role}" is disabled` });

      target.role = role;
    }

    await target.save();
    const updated = await User.findById(target._id).populate("createdBy", "name email role");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* PATCH /api/users/:id/password ──────────────── */
router.patch("/users/:id/password", requireAuth, requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const { password } = req.body;

  if (!password || password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters" });

  try {
    const target = await User.findById(req.params.id).select("+password");
    if (!target) return res.status(404).json({ message: "User not found" });

    const hierarchy = { superadmin: 4, admin: 3, manager: 2, cashier: 1 };
    if ((hierarchy[target.role] || 0) >= (hierarchy[req.user.role] || 0))
      return res.status(403).json({ message: "Cannot reset this user's password" });

    target.password = password; // pre-save hook hashes it
    await target.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* PATCH /api/users/:id/status ────────────────── */
router.patch("/users/:id/status", requireAuth, requireRole("superadmin", "admin", "manager"), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    target.status = target.status === "active" ? "inactive" : "active";
    await target.save();

    res.json({ success: true, status: target.status });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/users/:id/permissions ─────────────── */
router.get("/users/:id/permissions", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select("role permissionOverrides");
    if (!target) return res.status(404).json({ message: "User not found" });

    const roleRow = await RolePermission.findOne({ role: target.role });
    const rolePermissions = roleRow?.permissions
      ? (typeof roleRow.permissions.toObject === "function" ? roleRow.permissions.toObject() : { ...roleRow.permissions })
      : {};

    const rawOverrides = target.permissionOverrides
      ? (typeof target.permissionOverrides.toObject === "function"
          ? target.permissionOverrides.toObject()
          : { ...target.permissionOverrides })
      : {};
    const userOverrides = Object.fromEntries(
      Object.entries(rawOverrides).filter(([, v]) => v !== null && v !== undefined)
    );

    res.json({ role: target.role, rolePermissions, userOverrides });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* PUT /api/users/:id/permissions ─────────────── */
router.put("/users/:id/permissions", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target.role === "superadmin") {
      return res.status(400).json({ message: "Cannot override superadmin permissions" });
    }

    const VALID_KEYS = ["pos","inventory","salesReports","customers","orders","taxes","payments","userMgmt"];
    const filtered = {};
    for (const [k, v] of Object.entries(req.body.permissionOverrides || {})) {
      if (VALID_KEYS.includes(k) && typeof v === "boolean") filtered[k] = v;
    }

    target.permissionOverrides = filtered;
    await target.save();
    res.json({ success: true, permissionOverrides: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* DELETE /api/users/:id ──────────────────────── */
router.delete("/users/:id", requireAuth, requireRole("superadmin", "admin"), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    const hierarchy = { superadmin: 4, admin: 3, manager: 2, cashier: 1 };
    if ((hierarchy[target.role] || 0) >= (hierarchy[req.user.role] || 0))
      return res.status(403).json({ message: "Cannot delete this user" });

    const deletedName = target.username;
    const deletedRole = target.role;
    await User.findByIdAndDelete(req.params.id);

    await logActivity(req, "DELETE_USER", "User", req.params.id, { username: deletedName, role: deletedRole });
    await notifyByRoles(["superadmin", "admin"], "User Deleted",
      `${req.user.username} deleted user "${deletedName}" (${deletedRole}).`,
      "user", { actorId: req.user.id, actorName: req.user.username, excludeId: req.user.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* PATCH /api/change-password ─────────────────── */
router.patch("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: "currentPassword and newPassword required" });

  if (newPassword.length < 6)
    return res.status(400).json({ message: "New password must be at least 6 characters" });

  try {
    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: "Current password is incorrect" });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;