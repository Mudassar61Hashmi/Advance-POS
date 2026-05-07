import { Router }           from "express";
import { randomBytes }      from "crypto";
import { networkInterfaces } from "os";

const router = Router();

/* In-memory scan sessions: sessionId → { barcodes: string[], createdAt: number } */
const sessions = new Map();

/* Cleanup sessions older than 2 hours */
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 10 * 60 * 1000);

/* Get LAN IP so the QR code is reachable from phones on the same WiFi */
function getLanIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of (nets[name] || [])) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

/* POST /api/scan/start — create a new scan session, return the session ID */
router.post("/start", (req, res) => {
  const sessionId = randomBytes(12).toString("hex");
  sessions.set(sessionId, { barcodes: [], createdAt: Date.now() });

  /* Mobile scan page must be served over HTTPS so the phone browser allows camera.
     Use APP_URL in production, otherwise build https:// LAN IP + HTTPS_PORT. */
  const appUrl = (process.env.APP_URL && !process.env.APP_URL.startsWith("MY_"))
    ? process.env.APP_URL
    : `https://${getLanIP()}:${process.env.HTTPS_PORT || 3443}`;

  res.json({ sessionId, url: `${appUrl}/mobile-scan?session=${sessionId}` });
});

/* POST /api/scan/:sessionId/submit — mobile submits a scanned barcode */
router.post("/:sessionId/submit", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ message: "Session not found or expired" });
  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ message: "barcode required" });
  session.barcodes.push(barcode);
  res.json({ ok: true });
});

/* GET /api/scan/:sessionId/poll — POS polls for pending barcodes, clears queue */
router.get("/:sessionId/poll", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ barcodes: [] });
  const barcodes = [...session.barcodes];
  session.barcodes = [];
  res.json({ barcodes });
});

/* DELETE /api/scan/:sessionId — close session */
router.delete("/:sessionId", (req, res) => {
  sessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

export default router;
