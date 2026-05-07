import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code:        { type: String, required: true, unique: true, uppercase: true, trim: true },
  name:        { type: String, required: true, trim: true },
  type:        { type: String, enum: ["percentage", "fixed"], required: true },
  value:       { type: Number, required: true, min: 0 },
  minOrder:    { type: Number, default: 0 },
  maxUses:     { type: Number, default: 0 },       // 0 = unlimited
  usedCount:   { type: Number, default: 0 },
  expiresAt:   { type: Date, default: null },
  active:      { type: Boolean, default: true },
}, { timestamps: true });

export const Coupon = mongoose.model("Coupon", couponSchema);
