import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, CheckCircle2, AlertCircle, Loader2, Scan, Send } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

interface MobileScanProps {
  sessionId: string | null;
}

export default function MobileScan({ sessionId }: MobileScanProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef     = useRef<string>("");

  const [status, setStatus]         = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [lastBarcode, setLast]      = useState<string>("");
  const [errorMsg, setErrorMsg]     = useState<string>("");
  const [scanCount, setScanCount]   = useState(0);
  const [cameraErr, setCameraErr]   = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualSent, setManualSent] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg("No session ID in URL. Please scan the QR code from the POS terminal again.");
      setStatus("error");
      return;
    }

    /* navigator.mediaDevices is undefined on plain HTTP (non-secure context) */
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraErr("http");
      return;
    }

    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current!,
        (result, _err) => {
          if (result) handleDetected(result.getText());
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
        setStatus("scanning");
      })
      .catch((err: any) => {
        const msg = (err?.message || "").toLowerCase();
        if (msg.includes("permission") || msg.includes("notallowed") || msg.includes("denied")) {
          setCameraErr("denied");
        } else if (msg.includes("notfound") || msg.includes("devicesnotfound")) {
          setCameraErr("notfound");
        } else {
          setCameraErr(msg || "unknown");
        }
      });

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleDetected = async (barcode: string) => {
    if (barcode === lastRef.current) return;
    lastRef.current = barcode;
    setLast(barcode);
    setStatus("success");
    setScanCount(c => c + 1);
    try {
      await fetch(`/api/scan/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
    } catch { /* best effort */ }
    setTimeout(() => { lastRef.current = ""; setStatus("scanning"); }, 1500);
  };

  const submitManual = async () => {
    const code = manualCode.trim();
    if (!code || !sessionId) return;
    try {
      await fetch(`/api/scan/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      setScanCount(c => c + 1);
      setManualCode("");
      setManualSent(true);
      setTimeout(() => setManualSent(false), 1500);
    } catch { /* best effort */ }
  };

  /* ── session error ── */
  if (status === "error" || errorMsg) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-white font-bold text-lg mb-2">Session Error</p>
        <p className="text-zinc-400 text-sm">{errorMsg}</p>
      </div>
    );
  }

  /* ── camera error with manual fallback ── */
  if (cameraErr) {
    const isHttp = cameraErr === "http";
    const isDenied = cameraErr === "denied";

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <div className="px-5 py-4 flex items-center gap-3 bg-zinc-900 border-b border-zinc-800">
          <Scan size={20} className="text-indigo-400" />
          <div>
            <p className="text-white font-bold text-sm">Mobile Scanner</p>
            <p className="text-zinc-500 text-xs">{scanCount} item{scanCount !== 1 ? "s" : ""} scanned</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start p-6 gap-5">
          <Camera size={44} className="text-zinc-600 mt-4" />
          <div className="text-center">
            <p className="text-white font-bold text-base mb-1">
              {isHttp ? "Camera blocked (HTTP)" : isDenied ? "Camera permission denied" : "Camera unavailable"}
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              {isHttp
                ? "Camera requires HTTPS. Restart the POS server — it will generate a secure certificate automatically."
                : isDenied
                ? "Allow camera access in your browser settings, then refresh this page."
                : `Error: ${cameraErr}`}
            </p>
          </div>

          {isHttp && (
            <div className="bg-zinc-900 rounded-2xl p-4 w-full max-w-xs text-left space-y-1.5">
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">After restarting:</p>
              <p className="text-zinc-500 text-xs">1. Scan the new QR code from POS</p>
              <p className="text-zinc-500 text-xs">2. Tap <span className="text-zinc-300">Advanced → Proceed</span> on the cert warning</p>
              <p className="text-zinc-500 text-xs">3. Allow camera when prompted</p>
            </div>
          )}

          {/* Manual barcode entry — always available as fallback */}
          <div className="w-full max-w-xs mt-2">
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3 text-center">
              Or enter barcode manually
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitManual()}
                placeholder="Scan or type barcode…"
                className="flex-1 bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={submitManual}
                disabled={!manualCode.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl px-4 py-3 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            <AnimatePresence>
              {manualSent && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-emerald-400 text-xs text-center mt-2"
                >
                  ✓ Sent to checkout
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  /* ── normal camera scanning UI ── */
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Scan size={20} className="text-indigo-400" />
          <div>
            <p className="text-white font-bold text-sm">Mobile Scanner</p>
            <p className="text-zinc-500 text-xs">{scanCount} item{scanCount !== 1 ? "s" : ""} scanned</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === "scanning" ? "bg-emerald-400 animate-pulse" :
            status === "success"  ? "bg-blue-400" : "bg-zinc-600"
          }`} />
          <span className="text-zinc-400 text-xs capitalize">{status}</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="relative w-56 h-56">
            {(["top-0 left-0 border-t-2 border-l-2", "top-0 right-0 border-t-2 border-r-2",
               "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"] as const
            ).map((cls, i) => (
              <div key={i} className={`absolute w-10 h-10 ${cls} border-white rounded-sm`} />
            ))}
            <AnimatePresence>
              {status === "scanning" && (
                <motion.div
                  className="absolute inset-x-2 h-0.5 bg-indigo-400/80 rounded-full"
                  animate={{ top: ["10%", "90%", "10%"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
              )}
            </AnimatePresence>
          </div>
          <p className="text-white/70 text-xs mt-4 bg-black/40 px-3 py-1 rounded-full">
            {status === "scanning" ? "Point camera at barcode or QR code" : ""}
          </p>
        </div>

        <AnimatePresence>
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/70"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-emerald-500 rounded-full p-5 mb-4"
              >
                <CheckCircle2 size={40} className="text-white" />
              </motion.div>
              <p className="text-white font-bold text-xl">Scanned!</p>
              <p className="text-zinc-300 text-sm mt-1 font-mono">{lastBarcode}</p>
              <p className="text-zinc-500 text-xs mt-2">Added to checkout automatically</p>
            </motion.div>
          )}
        </AnimatePresence>

        {status === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">Starting camera…</p>
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 bg-zinc-900 border-t border-zinc-800 text-center">
        <p className="text-zinc-500 text-xs">Keep this page open while scanning. Items appear in checkout automatically.</p>
      </div>
    </div>
  );
}
