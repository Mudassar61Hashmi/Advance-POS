import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  username:   { type: String, required: true },
  role:       { type: String, default: null },
  ip:         { type: String, default: null },
  userAgent:  { type: String, default: null },
  success:    { type: Boolean, required: true },
  failReason: { type: String, default: null },
}, { timestamps: true });

/* Auto-expire after 30 days */
loginHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
loginHistorySchema.index({ userId: 1, createdAt: -1 });

export const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);
