import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  type:        { type: String, enum: ["sale", "user", "inventory", "login", "order", "system"], default: "system" },
  read:        { type: Boolean, default: false },
  actorId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorName:   { type: String, default: null },
  entityId:    { type: String, default: null },
  entityType:  { type: String, default: null },
}, { timestamps: true });

/* Auto-expire after 14 days, fast lookup by recipient */
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
