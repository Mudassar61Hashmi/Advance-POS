import { Router } from "express";
import { Tax }     from "../models/Tax.js";
import { Product } from "../models/Product.js";

const router = Router();

/* ── GET all taxes ──────────────────────────── */
router.get("/taxes", async (req, res) => {
  try {
    const taxes = await Tax.find().sort({ isDefault: -1, createdAt: -1 });
    res.json(taxes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET single tax ─────────────────────────── */
router.get("/taxes/:id", async (req, res) => {
  try {
    const tax = await Tax.findById(req.params.id);
    if (!tax) return res.status(404).json({ message: "Tax not found" });
    res.json(tax);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── POST create tax ────────────────────────── */
router.post("/taxes", async (req, res) => {
  try {
    const { name, rate, type, appliesTo, categories, isDefault, isActive, description } = req.body;

    // If new tax is default, remove default from others
    if (isDefault) {
      await Tax.updateMany({}, { isDefault: false });
    }

    const tax = await Tax.create({ name, rate, type, appliesTo, categories, isDefault, isActive, description });
    res.status(201).json(tax);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ── PUT update tax ─────────────────────────── */
router.put("/taxes/:id", async (req, res) => {
  try {
    const { isDefault } = req.body;

    // If setting this as default, clear others
    if (isDefault) {
      await Tax.updateMany({ _id: { $ne: req.params.id } }, { isDefault: false });
    }

    const tax = await Tax.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!tax) return res.status(404).json({ message: "Tax not found" });
    res.json(tax);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ── PATCH set as default ───────────────────── */
router.patch("/taxes/:id/set-default", async (req, res) => {
  try {
    await Tax.updateMany({}, { isDefault: false });
    const tax = await Tax.findByIdAndUpdate(req.params.id, { isDefault: true }, { new: true });
    if (!tax) return res.status(404).json({ message: "Tax not found" });
    res.json(tax);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── DELETE tax ─────────────────────────────── */
router.delete("/taxes/:id", async (req, res) => {
  try {
    // Remove tax reference from any products using it
    await Product.updateMany({ tax: req.params.id }, { tax: null, taxOverride: false });
    await Tax.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── GET default tax ────────────────────────── */
router.get("/taxes/meta/default", async (req, res) => {
  try {
    const tax = await Tax.findOne({ isDefault: true, isActive: true });
    res.json(tax || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;