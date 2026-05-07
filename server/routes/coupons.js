import { Router }    from "express";
import { Coupon }    from "../models/Coupon.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = Router();

/* GET /api/coupons */
router.get("/coupons", requireAuth, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* POST /api/coupons */
router.post("/coupons", requireAuth, requireRole("manager", "admin", "superadmin"), async (req, res) => {
  try {
    const coupon = await Coupon.create({ ...req.body, code: req.body.code?.toUpperCase().trim() });
    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* PUT /api/coupons/:id */
router.put("/coupons/:id", requireAuth, requireRole("manager", "admin", "superadmin"), async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json(coupon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* DELETE /api/coupons/:id */
router.delete("/coupons/:id", requireAuth, requireRole("manager", "admin", "superadmin"), async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* POST /api/coupons/validate — lightweight check used at checkout */
router.post("/coupons/validate", requireAuth, async (req, res) => {
  try {
    const { code, orderTotal } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (!coupon)            return res.status(404).json({ message: "Coupon not found" });
    if (!coupon.active)     return res.status(400).json({ message: "Coupon is inactive" });
    if (coupon.expiresAt && new Date() > coupon.expiresAt)
                            return res.status(400).json({ message: "Coupon has expired" });
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)
                            return res.status(400).json({ message: "Coupon usage limit reached" });
    if (orderTotal !== undefined && orderTotal < coupon.minOrder)
                            return res.status(400).json({ message: `Minimum order of ${coupon.minOrder} required` });

    const discount = coupon.type === "percentage"
      ? Math.min((orderTotal || 0) * (coupon.value / 100), orderTotal || Infinity)
      : Math.min(coupon.value, orderTotal || Infinity);

    res.json({ valid: true, coupon, discount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
