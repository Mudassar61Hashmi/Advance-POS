import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  username: { type: String, default: "system" },
  role:     { type: String, default: "system" },
  action:   { type: String, required: true },   // e.g. CREATE_SALE, CREATE_USER, DELETE_USER
  entity:   { type: String, default: null },     // Sale, User, Product, Order
  entityId: { type: String, default: null },
  details:  { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:       { type: String, default: null },
  status:   { type: String, enum: ["success", "failed"], default: "success" },
}, { timestamps: true });

/* Auto-expire after 90 days */
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
