import { Router }   from "express";
import { Product }   from "../models/Product.js";
import { Customer }  from "../models/Customer.js";

const router = Router();

/* ════════════════════════════════════════════
   POST /api/import/products
   Body: { records: [{ name, barcode, category, price, cost, quantity, lowStockThreshold }] }
════════════════════════════════════════════ */
router.post("/products", async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length)
    return res.status(400).json({ message: "No records provided" });

  let created = 0, updated = 0, failed = 0;
  const errors = [];

  for (const rec of records) {
    try {
      const name = rec.name?.toString().trim();
      if (!name) { errors.push("Row skipped: missing name"); failed++; continue; }

      const price    = parseFloat(rec.price)    || 0;
      const quantity = parseInt(rec.quantity)   || 0;
      const barcode  = rec.barcode?.toString().trim() || undefined;

      const payload = {
        name,
        category:          rec.category?.toString().trim()          || "General",
        price:             price,
        quantity:          quantity,
        lowStockThreshold: parseInt(rec.lowStockThreshold) || 10,
        ...(barcode ? { barcode } : {}),
      };

      /* Upsert: match by barcode first, then by exact name */
      let existing = null;
      if (barcode) existing = await Product.findOne({ barcode });
      if (!existing) existing = await Product.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });

      if (existing) {
        await Product.findByIdAndUpdate(existing._id, payload, { runValidators: false });
        updated++;
      } else {
        await Product.create(payload);
        created++;
      }
    } catch (err) {
      failed++;
      errors.push(`${rec.name || "?"}: ${err.message}`);
    }
  }

  res.json({ created, updated, failed, errors: errors.slice(0, 15) });
});

/* ════════════════════════════════════════════
   POST /api/import/customers
   Body: { records: [{ name, phone, email }] }
════════════════════════════════════════════ */
router.post("/customers", async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length)
    return res.status(400).json({ message: "No records provided" });

  let created = 0, updated = 0, failed = 0;
  const errors = [];

  for (const rec of records) {
    try {
      const name  = rec.name?.toString().trim();
      const phone = rec.phone?.toString().trim();
      if (!name)  { errors.push("Row skipped: missing name");  failed++; continue; }
      if (!phone) { errors.push(`${name}: missing phone`);     failed++; continue; }

      const payload = {
        name,
        phone,
        email: rec.email?.toString().trim() || "",
      };

      const existing = await Customer.findOne({ phone });

      if (existing) {
        await Customer.findByIdAndUpdate(existing._id, payload, { runValidators: false });
        updated++;
      } else {
        await Customer.create(payload);
        created++;
      }
    } catch (err) {
      failed++;
      errors.push(`${rec.name || "?"}: ${err.message}`);
    }
  }

  res.json({ created, updated, failed, errors: errors.slice(0, 15) });
});

export default router;
