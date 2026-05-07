import mongoose from "mongoose";

const taxSchema = new mongoose.Schema({
  name:        { type: String, required: true },          // e.g. "GST", "VAT", "Sales Tax"
  rate:        { type: Number, required: true, min: 0, max: 100 }, // percentage
  type:        { type: String, enum: ["inclusive", "exclusive"], default: "exclusive" },
  appliesTo:   { type: String, enum: ["all", "category", "product"], default: "all" },
  categories:  [{ type: String }],                        // if appliesTo === "category"
  isDefault:   { type: Boolean, default: false },         // the global default tax
  isActive:    { type: Boolean, default: true },
  description: { type: String, default: "" },
}, { timestamps: true });

export const Tax = mongoose.model("Tax", taxSchema);