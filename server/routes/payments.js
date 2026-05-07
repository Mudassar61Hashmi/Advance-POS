
import { Router }                 from "express";
import { Payment, PaymentMethod } from "../models/Payment.js";
import { Sale }                   from "../models/Sale.js";
import { Product }                from "../models/Product.js";

const router = Router();

/* ─── DEBUG: shows exact error in browser ───────────────── */
router.get("/payments-debug", async (req, res) => {
  try {
    const count = await PaymentMethod.countDocuments();
    res.json({ ok: true, paymentMethodCount: count });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, stack: err.stack });
  }
});

/* ════════════════════════════════════════════════════════════
   PAYMENT METHODS — seed-defaults BEFORE :id
════════════════════════════════════════════════════════════ */

router.post("/payment-methods/seed-defaults", async (req, res) => {
  try {
    const count = await PaymentMethod.countDocuments();
    if (count > 0)
      return res.json({ message: "Methods already exist", count });

    await PaymentMethod.insertMany([
      { name:"Cash",         type:"cash",          provider:"",         isDefault:true,  isActive:true, icon:"💵", color:"#22c55e", processingFee:0   },
      { name:"Credit Card",  type:"card_credit",   provider:"Visa/MC",  isDefault:false, isActive:true, icon:"💳", color:"#3b82f6", processingFee:2.5 },
      { name:"Debit Card",   type:"card_debit",    provider:"Visa/MC",  isDefault:false, isActive:true, icon:"💳", color:"#6366f1", processingFee:1.5 },
      { name:"Bank Transfer",type:"bank_transfer", provider:"",         isDefault:false, isActive:true, icon:"🏦", color:"#f59e0b", processingFee:0   },
      { name:"JazzCash",     type:"mobile_wallet", provider:"Jazz",     isDefault:false, isActive:true, icon:"📱", color:"#ef4444", processingFee:1.0 },
      { name:"Easypaisa",    type:"mobile_wallet", provider:"Telenor",  isDefault:false, isActive:true, icon:"📱", color:"#10b981", processingFee:1.0 },
      { name:"SadaPay",      type:"mobile_wallet", provider:"SadaPay",  isDefault:false, isActive:true, icon:"📱", color:"#8b5cf6", processingFee:0   },
      { name:"NayaPay",      type:"mobile_wallet", provider:"NayaPay",  isDefault:false, isActive:true, icon:"📱", color:"#f97316", processingFee:0   },
      { name:"HBL Konnect",  type:"mobile_wallet", provider:"HBL",      isDefault:false, isActive:true, icon:"📱", color:"#0ea5e9", processingFee:1.0 },
      { name:"Other",        type:"other",         provider:"",         isDefault:false, isActive:true, icon:"💰", color:"#94a3b8", processingFee:0   },
    ]);

    res.json({ success: true, message: "Default payment methods seeded" });
  } catch (err) {
    console.error("[seed-defaults] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/payment-methods", async (req, res) => {
  try {
    const methods = await PaymentMethod.find().sort({ isDefault: -1, name: 1 });
    res.json(methods);
  } catch (err) {
    console.error("[GET /payment-methods] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/payment-methods", async (req, res) => {
  try {
    if (req.body.isDefault)
      await PaymentMethod.updateMany({}, { isDefault: false });
    const method = await PaymentMethod.create(req.body);
    res.status(201).json(method);
  } catch (err) {
    console.error("[POST /payment-methods] ERROR:", err.message);
    res.status(400).json({ message: err.message });
  }
});

router.put("/payment-methods/:id", async (req, res) => {
  try {
    if (req.body.isDefault)
      await PaymentMethod.updateMany({ _id: { $ne: req.params.id } }, { isDefault: false });
    const method = await PaymentMethod.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!method) return res.status(404).json({ message: "Method not found" });
    res.json(method);
  } catch (err) {
    console.error("[PUT /payment-methods/:id] ERROR:", err.message);
    res.status(400).json({ message: err.message });
  }
});

router.patch("/payment-methods/:id/set-default", async (req, res) => {
  try {
    await PaymentMethod.updateMany({}, { isDefault: false });
    const method = await PaymentMethod.findByIdAndUpdate(
      req.params.id, { isDefault: true }, { new: true }
    );
    if (!method) return res.status(404).json({ message: "Method not found" });
    res.json(method);
  } catch (err) {
    console.error("[set-default] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/payment-methods/:id", async (req, res) => {
  try {
    await PaymentMethod.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /payment-methods/:id] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

/* ════════════════════════════════════════════════════════════
   PAYMENTS — stats BEFORE :id
════════════════════════════════════════════════════════════ */

router.get("/payments/stats", async (req, res) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) { const e = new Date(to); e.setHours(23,59,59,999); match.createdAt.$lte = e; }
    }
    const [total, byMethod, byStatus, revenue] = await Promise.all([
      Payment.countDocuments(match),
      Payment.aggregate([{ $match: match }, { $group: { _id: "$methodType", count: { $sum: 1 }, total: { $sum: "$amount" } } }]),
      Payment.aggregate([{ $match: match }, { $group: { _id: "$status",     count: { $sum: 1 }, total: { $sum: "$amount" } } }]),
      Payment.aggregate([{ $match: { ...match, status: "completed" } }, { $group: { _id: null, total: { $sum: "$netAmount" }, fees: { $sum: "$processingFee" } } }]),
    ]);
    res.json({ total, byMethod, byStatus, revenue: revenue[0]?.total||0, totalFees: revenue[0]?.fees||0 });
  } catch (err) {
    console.error("[GET /payments/stats] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const { status, methodType, from, to, search, limit = 100 } = req.query;
    const query = {};
    if (status     && status     !== "all") query.status     = status;
    if (methodType && methodType !== "all") query.methodType = methodType;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) { const e = new Date(to); e.setHours(23,59,59,999); query.createdAt.$lte = e; }
    }
    if (search) {
      query.$or = [
        { customerName:   { $regex: search, $options: "i" } },
        { transactionRef: { $regex: search, $options: "i" } },
        { methodName:     { $regex: search, $options: "i" } },
      ];
    }
    const payments = await Payment.find(query)
      .populate("methodId",    "name type color icon")
      .populate("processedBy", "username")
      .populate("customer",    "name phone")
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json(payments);
  } catch (err) {
    console.error("[GET /payments] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/payments/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("methodId",    "name type color icon")
      .populate("processedBy", "username")
      .populate("customer",    "name phone");
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (err) {
    console.error("[GET /payments/:id] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/payments", async (req, res) => {
  try {
    const { saleId, orderId, referenceType, amount, methodId, methodName, methodType, transactionRef, accountNumber, cashReceived, changeDue, customer, customerName, note, processedBy } = req.body;
    if (!amount || !methodName || !methodType)
      return res.status(400).json({ message: "amount, methodName, methodType are required" });
    let processingFee = 0;
    if (methodId) {
      const method = await PaymentMethod.findById(methodId);
      if (method) processingFee = (Number(amount) * (method.processingFee || 0)) / 100;
    }
    const payment = await Payment.create({
      saleId: saleId||null, orderId: orderId||null, referenceType: referenceType||"sale",
      amount: Number(amount), processingFee, netAmount: Number(amount)-processingFee,
      methodId: methodId||null, methodName, methodType,
      transactionRef: transactionRef||"", accountNumber: accountNumber||"",
      cashReceived: cashReceived||0, changeDue: changeDue||0,
      customer: customer||null, customerName: customerName||"Walk-in Customer",
      note: note||"", processedBy: processedBy||null, status: "completed",
    });
    res.status(201).json(payment);
  } catch (err) {
    console.error("[POST /payments] ERROR:", err.message);
    res.status(400).json({ message: err.message });
  }
});

router.patch("/payments/:id/refund", async (req, res) => {
  try {
    const { refundAmount, refundReason } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status === "refunded") return res.status(400).json({ message: "Already refunded" });
    if (payment.status !== "completed") return res.status(400).json({ message: "Only completed payments can be refunded" });
    const rAmt = refundAmount ? Number(refundAmount) : payment.amount;
    if (rAmt > payment.amount) return res.status(400).json({ message: "Refund exceeds payment amount" });
    const isPartial      = rAmt < payment.amount;
    payment.status       = isPartial ? "partial_refund" : "refunded";
    payment.refundAmount = rAmt;
    payment.refundReason = refundReason || "";
    payment.refundedAt   = new Date();
    await payment.save();
    if (payment.saleId && !isPartial) {
      const sale = await Sale.findById(payment.saleId);
      if (sale) {
        for (const item of sale.items)
          await Product.findByIdAndUpdate(item.product_id||item.product, { $inc: { quantity: item.quantity } });
        sale.status = "refunded";
        await sale.save();
      }
    }
    res.json(payment);
  } catch (err) {
    console.error("[PATCH /payments/:id/refund] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.patch("/payments/:id/cancel", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.status !== "pending") return res.status(400).json({ message: "Only pending payments can be cancelled" });
    payment.status = "cancelled";
    await payment.save();
    res.json(payment);
  } catch (err) {
    console.error("[PATCH /payments/:id/cancel] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.patch("/payments/:id/status", async (req, res) => {
  try {
    const { status, failureReason } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status, ...(failureReason ? { failureReason } : {}) },
      { new: true }
    );
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (err) {
    console.error("[PATCH /payments/:id/status] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/payments/:id", async (req, res) => {
  try {
    await Payment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /payments/:id] ERROR:", err.message);
    res.status(500).json({ message: err.message });
  }
});

export default router;