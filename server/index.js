import express from "express";
import https   from "https";
import { createServer as createViteServer } from "vite";
import { createRequire } from "module";
import dotenv from "dotenv";
import connectDB       from "./config/db.js";
import authRoutes      from "./routes/auth.js";
import productRoutes   from "./routes/products.js";
import salesRoutes     from "./routes/sales.js";
import customersRoutes from "./routes/customers.js";
import ordersRoutes    from "./routes/orders.js";
import taxRoutes       from "./routes/taxes.js";
import paymentRoutes   from "./routes/payments.js";
import rolePermissionsRoutes from "./routes/rolePermissions.js";
import activityRoutes        from "./routes/activityRoutes.js";
import aiRoutes              from "./routes/ai.js";
import walletPaymentRoutes   from "./routes/walletPayments.js";
import importExportRoutes    from "./routes/importExport.js";
import couponRoutes          from "./routes/coupons.js";
import scanSessionRoutes     from "./routes/scanSessions.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const require    = createRequire(import.meta.url);

dotenv.config();

async function startServer() {
  await connectDB();

  const app        = express();
  const PORT       = Number(process.env.PORT       || 3000);
  const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);

  app.use(express.json({ limit: "10mb" }));

  app.use("/api", authRoutes);
  app.use("/api", productRoutes);
  app.use("/api", salesRoutes);
  app.use("/api", customersRoutes);
  app.use("/api", ordersRoutes);
  app.use("/api", taxRoutes);
  app.use("/api", paymentRoutes);
  app.use("/api", rolePermissionsRoutes);
  app.use("/api", activityRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/payments", walletPaymentRoutes);
  app.use("/api/import", importExportRoutes);
  app.use("/api", couponRoutes);
  app.use("/api/scan", scanSessionRoutes);

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  if (process.env.NODE_ENV !== "production") {
    /* Vite dev server — HMR stays on HTTP so the desktop browser works normally */
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.resolve(__dirname, "../client"),
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "../dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "../dist/index.html"));
    });
  }

  /* ── HTTP server — desktop POS (http://localhost:3000) ── */
  app.listen(PORT, () => {
    console.log(`🚀 POS running on  http://localhost:${PORT}`);
  });

  /* ── HTTPS server — mobile camera scanning only ── */
  try {
    const selfsigned = require("selfsigned");
    const pems = await selfsigned.generate([{ name: "commonName", value: "POS" }], {
      days: 3650, algorithm: "sha256", keySize: 2048,
    });
    https.createServer({ key: pems.private, cert: pems.cert }, app)
      .listen(HTTPS_PORT, () => {
        console.log(`🔒 HTTPS scanner on https://localhost:${HTTPS_PORT}  (mobile QR codes use this port)`);
      });
  } catch (e) {
    console.warn("⚠️  HTTPS unavailable:", e.message, "— mobile camera scanning will not work");
  }
}

startServer();
