import { Router } from "express";
import { Payment } from "../models/Payment.js";

const router = Router();

/* ══════════════════════════════════════════════════════════════
   POST /api/payments/wallet/init
   Initialise a pending mobile-wallet payment and return
   human-readable payment instructions.
══════════════════════════════════════════════════════════════ */
router.post("/init", async (req, res) => {
  const {
    amount,
    currency = "PKR",
    orderId,
    customerPhone,
    customerName,
    methodName,
    merchantPhone,
    merchantAccountTitle,
  } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "A positive amount is required." });
  }
  if (!methodName) {
    return res.status(400).json({ message: "methodName is required (e.g. JazzCash, EasyPaisa)." });
  }
  if (!merchantPhone) {
    return res.status(400).json({ message: "merchantPhone is required." });
  }

  const transactionRef = `WLT-${Date.now()}`;

  try {
    const payment = await Payment.create({
      amount,
      methodName,
      methodType: "mobile_wallet",
      status: "pending",
      transactionRef,
      customerName: customerName || "Walk-in Customer",
      ...(orderId ? { orderId, referenceType: "order" } : {}),
      note: `${methodName} wallet payment | Phone: ${customerPhone || "N/A"} | Currency: ${currency}`,
    });

    const accountLine = merchantAccountTitle
      ? ` (${merchantAccountTitle})`
      : "";

    const instructions =
      `Send ${currency} ${amount} to ${merchantPhone}${accountLine} via ${methodName}. ` +
      `Use reference "${transactionRef}" as the payment description/remarks. ` +
      `Once sent, share your transaction receipt so the payment can be confirmed.`;

    return res.status(201).json({ payment, instructions });
  } catch (err) {
    console.error("[walletPayments/init] Error:", err);
    return res.status(500).json({ message: "Failed to create wallet payment.", detail: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/payments/wallet/:id/confirm
   Mark the payment as completed. Optionally update transactionRef.
══════════════════════════════════════════════════════════════ */
router.patch("/:id/confirm", async (req, res) => {
  const { transactionRef } = req.body;

  try {
    const update = { status: "completed" };
    if (transactionRef) update.transactionRef = transactionRef;

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    return res.json(payment);
  } catch (err) {
    console.error("[walletPayments/confirm] Error:", err);
    return res.status(500).json({ message: "Failed to confirm payment.", detail: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/payments/wallet/:id/cancel
   Mark the payment as cancelled.
══════════════════════════════════════════════════════════════ */
router.patch("/:id/cancel", async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "cancelled" } },
      { new: true, runValidators: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment not found." });
    }

    return res.json(payment);
  } catch (err) {
    console.error("[walletPayments/cancel] Error:", err);
    return res.status(500).json({ message: "Failed to cancel payment.", detail: err.message });
  }
});

export default router;
