import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
});

const orderSchema = new mongoose.Schema({
  orderNumber:   { type: String, unique: true },
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  customerName:  { type: String, default: "Walk-in Customer" },
  customerPhone: { type: String, default: "" },
  customerEmail: { type: String, default: "" },
  items:         { type: [orderItemSchema], required: true },
  subtotal:      { type: Number, required: true },
  discount:      { type: Number, default: 0 },
  discountType:  { type: String, enum: ["fixed", "percent"], default: "fixed" },
  discountAmount:{ type: Number, default: 0 },
  tax:           { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  total:         { type: Number, required: true },
  paymentMethod: { type: String, enum: ["cash", "card", "other"], default: "cash" },
  cashReceived:  { type: Number, default: 0 },
  change:        { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "cancelled", "refunded"],
    default: "pending",
  },
  note:       { type: String, default: "" },
  refundNote: { type: String, default: "" },
  refundedAt: { type: Date },
  cancelledAt:{ type: Date },
  servedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

/* Auto-generate order number */
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

export const Order = mongoose.model("Order", orderSchema);