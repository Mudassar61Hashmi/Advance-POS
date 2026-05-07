import { Notification } from "../models/Notification.js";
import { User }         from "../models/User.js";

/**
 * Send a notification to an explicit list of user IDs.
 */
export const notifyUsers = async (recipientIds, title, message, type = "system", opts = {}) => {
  try {
    if (!recipientIds?.length) return;
    await Notification.insertMany(
      recipientIds.map(id => ({
        recipientId: id,
        title,
        message,
        type,
        actorId:    opts.actorId    ?? null,
        actorName:  opts.actorName  ?? null,
        entityId:   opts.entityId   ?? null,
        entityType: opts.entityType ?? null,
      }))
    );
  } catch (err) {
    console.error("[Notify] notifyUsers failed:", err.message);
  }
};

/**
 * Send a notification to every active user whose role is in the given array.
 * Optionally exclude one user ID (e.g. the actor themselves).
 */
export const notifyByRoles = async (roles, title, message, type = "system", opts = {}) => {
  try {
    const query = { role: { $in: roles }, status: "active" };
    if (opts.excludeId) query._id = { $ne: opts.excludeId };
    const users = await User.find(query).select("_id");
    await notifyUsers(users.map(u => u._id), title, message, type, opts);
  } catch (err) {
    console.error("[Notify] notifyByRoles failed:", err.message);
  }
};
