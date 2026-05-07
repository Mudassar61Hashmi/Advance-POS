import { Router }       from "express";
import { AuditLog }     from "../models/AuditLog.js";
import { LoginHistory } from "../models/LoginHistory.js";
import { Notification } from "../models/Notification.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

/* ── GET /api/audit-logs — superadmin only ── */
router.get("/audit-logs", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const { page = 1, limit = 50, role, action, username, from, to } = req.query;
    const query = {};
    if (role)     query.role     = role;
    if (action)   query.action   = { $regex: action, $options: "i" };
    if (username) query.username = { $regex: username, $options: "i" };
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   { const d = new Date(to); d.setHours(23,59,59,999); query.createdAt.$lte = d; }
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      AuditLog.countDocuments(query),
    ]);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /api/login-history — superadmin only ── */
router.get("/login-history", requireAuth, requireRole("superadmin"), async (req, res) => {
  try {
    const { page = 1, limit = 50, username, success, from, to } = req.query;
    const query = {};
    if (username)           query.username = { $regex: username, $options: "i" };
    if (success !== undefined && success !== "") query.success = success === "true";
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   { const d = new Date(to); d.setHours(23,59,59,999); query.createdAt.$lte = d; }
    }
    const skip  = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      LoginHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      LoginHistory.countDocuments(query),
    ]);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /api/notifications — current user's notifications ── */
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;
    const query = { recipientId: req.user.id };
    if (unreadOnly === "true") query.read = false;
    const notifs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET /api/notifications/unread-count ── */
router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipientId: req.user.id, read: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── PATCH /api/notifications/read-all ── */
router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ recipientId: req.user.id, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── PATCH /api/notifications/:id/read ── */
router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, recipientId: req.user.id });
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    notif.read = true;
    await notif.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── DELETE /api/notifications/:id ── */
router.delete("/notifications/:id", requireAuth, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, recipientId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
