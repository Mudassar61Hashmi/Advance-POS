import { Router } from "express";
import { Order }   from "../models/Order.js";
import { Product } from "../models/Product.js";

const router = Router();

/* ══════════════════════════════════════════════════
   GET /api/orders
   Query: status, from, to, search, limit
══════════════════════════════════════════════════ */
router.get("/orders", async (req, res) => {
  try {
    const { status, from, to, search, limit = 100 } = req.query;
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { orderNumber:  { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone:{ $regex: search, $options: "i" } },
      ];
    }

    const orders = await Order.find(query)
      .populate("customer", "name phone email")
      .populate("servedBy", "username role")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json(orders);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════
   GET /api/orders/stats
══════════════════════════════════════════════════ */
router.get("/orders/stats", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, byStatus, revenueAgg] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: today } }),
      Order.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$total" } } },
      ]),
      Order.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    res.json({
      total,
      todayCount,
      byStatus,
      completedRevenue: revenueAgg[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════
   GET /api/orders/:id
══════════════════════════════════════════════════ */
router.get("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customer", "name phone email")
      .populate("servedBy", "username role");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════
   POST /api/orders  — create new order
══════════════════════════════════════════════════ */
router.post("/orders", async (req, res) => {
  try {
    const {
      items, customer, customerName, customerPhone, customerEmail,
      discount, discountType, tax,
      paymentMethod, cashReceived, note, servedBy,
    } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: "Order must have at least one item" });

    /* Validate stock */
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product)
        return res.status(404).json({ message: `Product not found: ${item.product}` });
      if (product.quantity < item.quantity)
        return res.status(400).json({ message: `Insufficient stock for "${product.name}". Available: ${product.quantity}` });
    }

    /* Compute totals */
    const subtotal       = items.reduce((s, i) => s + i.subtotal, 0);
    const discountAmount = discountType === "percent"
      ? (subtotal * (discount || 0)) / 100
      : (discount || 0);
    const taxAmount = ((subtotal - discountAmount) * (tax || 0)) / 100;
    const total     = Math.max(0, subtotal - discountAmount + taxAmount);
    const change    = paymentMethod === "cash" && cashReceived
      ? Math.max(0, cashReceived - total) : 0;

    const order = await Order.create({
      items, customer, customerName, customerPhone, customerEmail,
      subtotal,
      discount: discount || 0,
      discountType: discountType || "fixed",
      discountAmount,
      tax: tax || 0,
      taxAmount,
      total,
      paymentMethod,
      cashReceived: cashReceived || 0,
      change,
      note: note || "",
      servedBy,
      status: "pending",
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════
   PATCH /api/orders/:id/status  — update status
══════════════════════════════════════════════════ */
router.patch("/orders/:id/status", async (req, res) => {
  try {
    const { status, refundNote } = req.body;
    const allowed = ["pending", "processing", "completed", "cancelled", "refunded"];

    if (!allowed.includes(status))
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(", ")}` });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    /* Restore stock when cancelling or refunding (only if previously active) */
    const wasActive = !["refunded", "cancelled"].includes(order.status);
    if ((status === "refunded" || status === "cancelled") && wasActive) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: item.quantity } },
          { new: true }
        );
      }
    }

    /* Deduct stock when moving to completed (if coming from pending/processing) */
    if (status === "completed" && ["pending", "processing"].includes(order.status)) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (!product || product.quantity < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for "${item.name}"` });
        }
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
      }
    }

    const update = { status };
    if (status === "refunded") {
      update.refundedAt = new Date();
      update.refundNote = refundNote || "";
    }
    if (status === "cancelled") {
      update.cancelledAt = new Date();
    }

    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("customer", "name phone email")
      .populate("servedBy", "username role");

    res.json(updated);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════
   PUT /api/orders/:id  — edit order (only pending)
══════════════════════════════════════════════════ */
router.put("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!["pending", "processing"].includes(order.status))
      return res.status(400).json({ message: "Can only edit pending or processing orders" });

    const { customerName, customerPhone, customerEmail, note, paymentMethod } = req.body;
    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { customerName, customerPhone, customerEmail, note, paymentMethod },
      { new: true }
    ).populate("customer", "name phone").populate("servedBy", "username");

    res.json(updated);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════
   DELETE /api/orders/:id
══════════════════════════════════════════════════ */
router.delete("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;