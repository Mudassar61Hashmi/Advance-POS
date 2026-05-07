import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name:              { type: String, required: true },
  price:             { type: Number, required: true },
  cost:              { type: Number, default: 0 },
  quantity:          { type: Number, required: true, default: 0 },
  category:          { type: String, required: true },
  barcode:           { type: String, unique: true, sparse: true },
  lowStockThreshold: { type: Number, default: 10 },
  image:             { type: String, default: null },
  tax:               { type: mongoose.Schema.Types.ObjectId, ref: "Tax", default: null },
  taxOverride:       { type: Boolean, default: false },
}, { timestamps: true });

export const Product = mongoose.model("Product", productSchema);