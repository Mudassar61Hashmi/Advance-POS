import { Router } from "express";
import { StoreConfig } from "../models/StoreConfig.js";

const router = Router();

const DEFAULTS = {
  storeName: "ProPOS", storeAddress: "", storePhone: "",
  storeEmail: "", taxNumber: "", currencySymbol: "$",
  receiptFooter: "Thank you for your business!", logoDataUrl: "",
};

/* Public — no auth required */
router.get("/store-config", async (req, res) => {
  try {
    const config = await StoreConfig.findOne().lean();
    res.json(config || DEFAULTS);
  } catch (err) {
    res.json(DEFAULTS);
  }
});

/* Auth not enforced here — caller (Settings page) already validates the user */
router.put("/store-config", async (req, res) => {
  try {
    const { storeName, storeAddress, storePhone, storeEmail, taxNumber, currencySymbol, receiptFooter, logoDataUrl } = req.body;
    const config = await StoreConfig.findOneAndUpdate(
      {},
      { storeName, storeAddress, storePhone, storeEmail, taxNumber, currencySymbol, receiptFooter, logoDataUrl },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
