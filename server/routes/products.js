import { Router }  from "express";
import { Product } from "../models/Product.js";

const router = Router();

/* ── GET /api/products ─────────────────────────── */
router.get("/products", async (req, res) => {
  try {
    const { category, search, lowStock } = req.query;
    const query = {};
    if (category && category !== "all") query.category = category;
    if (search) query.$or = [
      { name:    { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
    ];
    if (lowStock === "true") query.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };

    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products.map(p => ({
      _id:               p._id.toString(),
      id:                p._id.toString(),
      name:              p.name,
      price:             p.price,
      quantity:          p.quantity,
      category:          p.category,
      barcode:           p.barcode || "",
      lowStockThreshold: p.lowStockThreshold || 10,
      image:             p.image || null,
      tax:               p.tax,
      taxOverride:       p.taxOverride,
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── GET /api/products/:id ─────────────────────── */
router.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── POST /api/products ────────────────────────── */
router.post("/products", async (req, res) => {
  const { name, price, quantity, category, barcode, lowStockThreshold, image, tax, taxOverride } = req.body;
  try {
    const product = await Product.create({
      name, price, quantity, category,
      barcode:           barcode           || undefined,
      lowStockThreshold: lowStockThreshold || 10,
      image:             image             || null,
      tax:               tax               || null,
      taxOverride:       taxOverride       || false,
    });
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ── PUT /api/products/:id ─────────────────────── */
router.put("/products/:id", async (req, res) => {
  const { name, price, quantity, category, barcode, lowStockThreshold, image, tax, taxOverride } = req.body;
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, quantity, category, barcode, lowStockThreshold, image, tax, taxOverride },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/* ── DELETE /api/products/:id ──────────────────── */
router.delete("/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;