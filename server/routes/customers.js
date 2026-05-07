import { Router } from "express";
import { Customer } from "../models/Customer.js";  // ✅ .js extension required for ESM

const router = Router();

// GET all customers — supports ?search= query
router.get("/customers", async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { name:  { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      };
    }
    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single customer
router.get("/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create customer
router.post("/customers", async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: "Name and phone are required" });
  }
  try {
    const exists = await Customer.findOne({ phone });
    if (exists) return res.status(400).json({ success: false, message: "Phone number already registered" });
    const customer = await Customer.create({ name, phone, email: email || "" });
    res.status(201).json(customer);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT update customer
router.put("/customers/:id", async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    // Check if phone is taken by another customer
    if (phone) {
      const existing = await Customer.findOne({ phone, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, message: "Phone number already in use" });
    }
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { name, phone, email },
      { new: true, runValidators: true }
    );
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE customer
router.delete("/customers/:id", async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json({ success: true, message: "Customer deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;