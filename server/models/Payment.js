import mongoose from "mongoose";

/* ══════════════════════════════════════════
   PAYMENT METHOD SCHEMA
══════════════════════════════════════════ */
const paymentMethodSchema = new mongoose.Schema({
  name:          { type: String,  required: true, trim: true },
  type:          { type: String,  enum: ["cash","card_credit","card_debit","bank_transfer","mobile_wallet","other"], default: "cash" },
  provider:      { type: String,  default: "" },
  accountNumber: { type: String,  default: "" },
  accountTitle:  { type: String,  default: "" },
  isActive:      { type: Boolean, default: true  },
  isDefault:     { type: Boolean, default: false },
  icon:          { type: String,  default: "💰"  },
  color:         { type: String,  default: "#6b7280" },
  processingFee: { type: Number,  default: 0, min: 0, max: 100 },
  notes:         { type: String,  default: "" },
}, { timestamps: true });

/* ══════════════════════════════════════════
   PAYMENT SCHEMA
══════════════════════════════════════════ */
const paymentSchema = new mongoose.Schema({
  saleId:        { type: mongoose.Schema.Types.ObjectId, ref: "Sale",          default: null },
  orderId:       { type: mongoose.Schema.Types.ObjectId, ref: "Order",         default: null },
  referenceType: { type: String,  enum: ["sale","order","manual"],              default: "sale" },
  amount:        { type: Number,  required: true, min: 0 },
  processingFee: { type: Number,  default: 0, min: 0 },
  netAmount:     { type: Number,  default: 0 },
  methodId:      { type: mongoose.Schema.Types.ObjectId, ref: "PaymentMethod", default: null },
  methodName:    { type: String,  required: true },
  methodType:    { type: String,  required: true, enum: ["cash","card_credit","card_debit","bank_transfer","mobile_wallet","other"] },
  transactionRef:{ type: String,  default: "" },
  accountNumber: { type: String,  default: "" },
  cashReceived:  { type: Number,  default: 0 },
  changeDue:     { type: Number,  default: 0 },
  status:        { type: String,  enum: ["pending","completed","failed","refunded","partial_refund","cancelled"], default: "completed" },
  failureReason: { type: String,  default: "" },
  refundAmount:  { type: Number,  default: 0 },
  refundReason:  { type: String,  default: "" },
  refundedAt:    { type: Date,    default: null },
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: "Customer",      default: null },
  customerName:  { type: String,  default: "Walk-in Customer" },
  processedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User",          default: null },
  note:          { type: String,  default: "" },
}, { timestamps: true });

/* Auto-calculate netAmount */
paymentSchema.pre("save", function (next) {
  this.netAmount = Math.max(0, (this.amount || 0) - (this.processingFee || 0));
  next();
});

/* ══════════════════════════════════════════
   SAFE MODEL EXPORT
   Prevents "OverwriteModelError" on HMR
══════════════════════════════════════════ */
export const PaymentMethod =
  mongoose.models.PaymentMethod ||
  mongoose.model("PaymentMethod", paymentMethodSchema);

export const Payment =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);