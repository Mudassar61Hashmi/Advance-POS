import { Router }       from "express";
import { Sale }          from "../models/Sale.js";
import { Product }       from "../models/Product.js";
import { Payment }       from "../models/Payment.js";
import { Coupon }        from "../models/Coupon.js";
import mongoose          from "mongoose";
import { logActivity }   from "../middleware/auditLog.js";
import { notifyByRoles } from "../middleware/notifyHelper.js";

const router = Router();

/* ══════════════════════════════════════════════════
   ⚠️  STATIC routes MUST come BEFORE /:id routes
══════════════════════════════════════════════════ */

/* ── GET /api/sales/reports/summary ─────────────── */
router.get("/sales/reports/summary", async (req, res) => {
  const { from, to } = req.query;
  const dateFilter   = {};
  if (from) { const d = new Date(from); if (!isNaN(d)) dateFilter.$gte = d; }
  if (to)   { const d = new Date(to);   if (!isNaN(d)) { d.setHours(23,59,59,999); dateFilter.$lte = d; } }
  const query = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  try {
    const sales             = await Sale.find(query);
    const totalRevenue      = sales.reduce((s, x) => s + (x.total || 0), 0);
    const totalTransactions = sales.length;
    const avgOrderValue     = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    const productMap = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        const key = item.product_id?.toString() || item.product?.toString() || item.name;
        if (!productMap[key]) productMap[key] = { name: item.name, totalQty: 0, totalRevenue: 0, value: 0 };
        productMap[key].totalQty     += item.quantity || 0;
        productMap[key].totalRevenue += (item.price || 0) * (item.quantity || 0);
        productMap[key].value        += item.quantity || 0;
      }
    }
    const topProducts = Object.values(productMap).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);

    res.json({
      success: true,
      totalRevenue:      parseFloat(totalRevenue.toFixed(2)),
      totalTransactions,
      averageOrderValue: parseFloat(avgOrderValue.toFixed(2)),
      topProducts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET /api/sales  (list) ──────────────────────── */
router.get("/sales", async (req, res) => {
  try {
    const { status, from, to, search, limit = 200 } = req.query;
    const query = {};

    if (status && status !== "all") query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) { const e = new Date(to); e.setHours(23,59,59,999); query.createdAt.$lte = e; }
    }
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { customerName:  { $regex: search, $options: "i" } },
        { cashier:       { $regex: search, $options: "i" } },
      ];
    }

    const sales = await Sale.find(query).sort({ createdAt: -1 }).limit(Number(limit));

    res.json(sales.map(s => ({
      /* Use _id as "id" so SalesHistory can call /api/sales/:id */
      id:           s._id,
      _id:          s._id,
      invoiceNumber:s.invoiceNumber || `#${String(s._id).slice(-6).toUpperCase()}`,
      user_id:      s.user_id,
      cashier:      s.cashier,
      customerName: s.customerName,
      customerPhone:s.customerPhone,
      subtotal:     s.subtotal,
      discount:      s.discount,
      discountType:  s.discountType,
      discountInput: s.discountInput,
      flatDiscount:  s.flatDiscount,
      tax:           s.tax,
      taxName:       s.taxName,
      taxRate:       s.taxRate,
      taxType:       s.taxType,
      total:        s.total,
      paymentMethod:s.paymentMethod,
      cashReceived: s.cashReceived,
      change:       s.change,
      status:       s.status || "completed",
      note:         s.note,
      refundNote:   s.refundNote,
      refundedAt:   s.refundedAt,
      itemCount:    s.items.reduce((n, i) => n + i.quantity, 0),
      timestamp:    s.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET /api/sales/:id  (single sale — receipt data) ── */
router.get("/sales/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return res.status(400).json({ success: false, message: "Invalid sale ID" });

  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });

    /* ✅ Return the FULL sale object the receipt modal needs */
    res.json({
      id:           sale._id,
      _id:          sale._id,
      invoiceNumber:sale.invoiceNumber || `#${String(sale._id).slice(-6).toUpperCase()}`,
      cashier:      sale.cashier,
      customerName: sale.customerName,
      customerPhone:sale.customerPhone,
      subtotal:     sale.subtotal,
      discount:      sale.discount,
      discountType:  sale.discountType,
      discountInput: sale.discountInput,
      flatDiscount:  sale.flatDiscount,
      tax:           sale.tax,
      taxName:       sale.taxName,
      taxRate:       sale.taxRate,
      taxType:       sale.taxType,
      total:        sale.total,
      paymentMethod:sale.paymentMethod,
      cashReceived: sale.cashReceived,
      change:       sale.change,
      status:       sale.status,
      note:         sale.note,
      refundNote:   sale.refundNote,
      refundedAt:   sale.refundedAt,
      timestamp:    sale.createdAt,
      items: sale.items.map(item => ({
        id:         item._id,
        product_id: item.product_id || item.product,
        name:       item.name,
        quantity:   item.quantity,
        price:      item.price,
        lineTotal:  parseFloat(((item.subtotal || item.price * item.quantity) || 0).toFixed(2)),
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── POST /api/checkout ──────────────────────────── */
router.post("/checkout", async (req, res) => {
  const {
    userId, cashier, customerId, customerName, customerPhone,
    subtotal, discount, discountType, discountInput, flatDiscount, couponCode, couponDiscount,
    tax, taxName, taxRate, taxType,
    total, note, items, paymentMethod, cashReceived,
  } = req.body;

  if (!userId || !items || !Array.isArray(items) || items.length === 0 || total == null)
    return res.status(400).json({ success: false, message: "Missing required fields: userId, items, total" });

  for (const item of items) {
    if (!item.id || !item.name || item.quantity == null || item.price == null)
      return res.status(400).json({ success: false, message: `Invalid item: ${JSON.stringify(item)}` });
    if (!mongoose.Types.ObjectId.isValid(item.id))
      return res.status(400).json({ success: false, message: `Invalid product ID: ${item.id}` });
  }

  try {
    /* 1. Stock check */
    for (const item of items) {
      const product = await Product.findById(item.id);
      if (!product)
        return res.status(400).json({ success: false, message: `Product not found: ${item.name}` });
      if (product.quantity < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name} (available: ${product.quantity})`,
        });
    }

    /* 2. Save sale */
    const numericTotal = Number(total) || 0;
    const numericCashReceived = Number(cashReceived) || 0;
    const change = paymentMethod === "cash" && numericCashReceived > 0
      ? Math.max(0, numericCashReceived - numericTotal) : 0;

    const salePayload = {
      user_id:       userId,
      cashier:       cashier      || "Unknown",
      customerName:  customerName || "Walk-in Customer",
      customerPhone: customerPhone|| "",
      customerId:    customerId && mongoose.Types.ObjectId.isValid(customerId) ? customerId : null,
      subtotal:      Number((Number(subtotal) || 0).toFixed(2)),
      discount:      Number((Number(discount) || 0).toFixed(2)),
      discountType:  discountType  || "fixed",
      discountInput: Number(discountInput) || 0,
      flatDiscount:  Number((Number(flatDiscount) || 0).toFixed(2)),
      tax:           Number((Number(tax) || 0).toFixed(2)),
      taxName:       taxName       || "",
      taxRate:       Number(taxRate) || 0,
      taxType:       taxType || "exclusive",
      total:         Number(numericTotal.toFixed(2)),
      paymentMethod: paymentMethod || "cash",
      cashReceived:  numericCashReceived,
      change,
      note:          note || "",
      status:        "completed",
      items: items.map(item => ({
        product:    item.id,
        product_id: item.id,
        name:       item.name,
        quantity:   Number(item.quantity),
        price:      Number(item.price),
        subtotal:   parseFloat((Number(item.price) * Number(item.quantity)).toFixed(2)),
      })),
    };

    let sale;
    for (let attempts = 0; attempts < 3; attempts += 1) {
      try {
        sale = await Sale.create(salePayload);
        break;
      } catch (createErr) {
        const isDuplicateInvoice = createErr?.code === 11000 && createErr?.keyPattern?.invoiceNumber;
        if (!isDuplicateInvoice || attempts === 2) throw createErr;
      }
    }

    /* 3. Deduct stock */
    for (const item of items)
      await Product.findByIdAndUpdate(item.id, { $inc: { quantity: -item.quantity } });

    /* 4a. Increment coupon usage (non-fatal) */
    if (couponCode) {
      try {
        await Coupon.findOneAndUpdate(
          { code: couponCode.toUpperCase() },
          { $inc: { usedCount: 1 } }
        );
      } catch (couponErr) {
        console.warn("[checkout] Coupon increment skipped:", couponErr.message);
      }
    }

    /* 4. Create Payment record (non-fatal) */
    const pmMethodNames = { cash:"Cash", card:"Card", mobile_wallet:"Mobile Wallet", bank_transfer:"Bank Transfer", other:"Other" };
    try {
      await Payment.create({
        saleId:        sale._id,
        referenceType: "sale",
        amount:        Number(numericTotal.toFixed(2)),
        processingFee: 0,
        netAmount:     Number(numericTotal.toFixed(2)),
        methodName:    pmMethodNames[paymentMethod] || paymentMethod || "Cash",
        methodType:    paymentMethod || "cash",
        status:        "completed",
        customerName:  customerName || "Walk-in Customer",
        cashReceived:  numericCashReceived,
        changeDue:     change,
        note:          note || "",
        transactionRef: sale.invoiceNumber || "",
      });
    } catch (payErr) {
      console.warn("[checkout] Payment record skipped:", payErr.message);
    }

    /* 5. Audit + notify */
    const fakeReq = { user: { id: userId, username: cashier || "unknown", role: "cashier" }, headers: {}, ip: null };
    await logActivity(fakeReq, "CREATE_SALE", "Sale", sale._id, {
      invoiceNumber: sale.invoiceNumber, total: sale.total, cashier: sale.cashier,
    });
    await notifyByRoles(["superadmin", "admin", "manager"],
      "New Sale",
      `${sale.cashier} completed sale ${sale.invoiceNumber} — $${sale.total.toFixed(2)}`,
      "sale", { entityId: String(sale._id), entityType: "Sale" });

    res.json({ success: true, saleId: sale._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── PATCH /api/sales/:id/status ─────────────────── */
router.patch("/sales/:id/status", async (req, res) => {
  const { status, refundNote } = req.body;
  const allowed = ["pending","completed","cancelled","refunded"];

  if (!allowed.includes(status))
    return res.status(400).json({ message: `Invalid status. Allowed: ${allowed.join(", ")}` });

  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    const wasActive = !["refunded","cancelled"].includes(sale.status);

    /* Restore stock on refund/cancel */
    if ((status === "refunded" || status === "cancelled") && wasActive) {
      for (const item of sale.items) {
        await Product.findByIdAndUpdate(
          item.product_id || item.product,
          { $inc: { quantity: item.quantity } }
        );
      }
    }

    const update = { status };
    if (status === "refunded") { update.refundedAt = new Date(); update.refundNote = refundNote || ""; }

    const updated = await Sale.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, sale: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── DELETE /api/sales/:id ───────────────────────── */
router.delete("/sales/:id", async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;