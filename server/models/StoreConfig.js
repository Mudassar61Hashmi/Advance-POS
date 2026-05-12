import mongoose from "mongoose";

const storeConfigSchema = new mongoose.Schema({
  storeName:      { type: String, default: "ProPOS" },
  storeAddress:   { type: String, default: "" },
  storePhone:     { type: String, default: "" },
  storeEmail:     { type: String, default: "" },
  taxNumber:      { type: String, default: "" },
  currencySymbol: { type: String, default: "$" },
  receiptFooter:  { type: String, default: "Thank you for your business!" },
  logoDataUrl:    { type: String, default: "" },
}, { timestamps: true });

export const StoreConfig = mongoose.model("StoreConfig", storeConfigSchema);
