import { AuditLog } from "../models/AuditLog.js";

export const logActivity = async (req, action, entity = null, entityId = null, details = {}, status = "success") => {
  try {
    await AuditLog.create({
      userId:   req.user?.id   ?? null,
      username: req.user?.username ?? "anonymous",
      role:     req.user?.role     ?? "unknown",
      action,
      entity,
      entityId: entityId != null ? String(entityId) : null,
      details,
      ip:       req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? req.ip ?? null,
      status,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to record:", err.message);
  }
};
