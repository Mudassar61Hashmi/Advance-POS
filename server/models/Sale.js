import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema({
  product:    { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, // legacy compat
  name:       { type: String,  required: true },
  quantity:   { type: Number,  required: true },
  price:      { type: Number,  required: true },
  subtotal:   { type: Number,  default: 0 },
});

const saleSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true },
  user_id:       { type: mongoose.Schema.Types.ObjectId, ref: "User"     },
  servedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User"     },
  cashier:       { type: String, default: "" },
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  customerId:    { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  customerName:  { type: String, default: "Walk-in Customer" },
  customerPhone: { type: String, default: "" },
  subtotal:      { type: Number, default: 0 },
  discount:      { type: Number, default: 0 },
  discountType:  { type: String, enum: ["fixed","percent"], default: "fixed" },
  tax:           { type: Number, default: 0 },
  taxName:       { type: String, default: "" },
  taxRate:       { type: Number, default: 0 },
  total:         { type: Number, required: true },
  paymentMethod: { type: String, enum: ["cash","card","mobile_wallet","bank_transfer","other"], default: "cash" },
  cashReceived:  { type: Number, default: 0 },
  change:        { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending","completed","cancelled","refunded"],
    default: "completed",
  },
  note:       { type: String, default: "" },
  refundNote: { type: String, default: "" },
  refundedAt: { type: Date, default: null },
  items:      [saleItemSchema],
}, { timestamps: true });

/* Auto-generate invoice number */
saleSchema.pre("save", async function () {
  if (this.invoiceNumber) return;

  const SaleModel = mongoose.model("Sale");

  // Use the highest existing invoice number to avoid duplicates after deletions.
  const [result] = await SaleModel.aggregate([
    { $match: { invoiceNumber: { $regex: /^INV-\d+$/ } } },
    {
      $project: {
        seq: { $toInt: { $substr: ["$invoiceNumber", 4, -1] } },
      },
    },
    { $sort: { seq: -1 } },
    { $limit: 1 },
  ]);

  const current = result?.seq ?? 0;
  const nextNumber = Number.isFinite(current) ? current + 1 : 1;

  this.invoiceNumber = `INV-${String(nextNumber).padStart(5, "0")}`;
});

export const Sale = mongoose.model("Sale", saleSchema);