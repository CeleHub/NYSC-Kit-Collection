"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  QrCode,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Camera,
  Keyboard,
  PackageCheck,
  ShieldAlert,
} from "lucide-react";
import jsQR from "jsqr";
import { CorpsMember, SubmissionRecord } from "@/lib/types";

interface QRScannerModalProps {
  inspectorPlatoon: number;
  onClose: () => void;
  onKitDispatched: (stateCode: string) => void;
  onShowToast?: (msg: string, type: "success" | "error") => void;
}

export default function QRScannerModal({
  inspectorPlatoon,
  onClose,
  onKitDispatched,
  onShowToast,
}: QRScannerModalProps) {
  const [mode, setMode] = useState<"CAMERA" | "MANUAL">("CAMERA");
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedCorper, setVerifiedCorper] = useState<CorpsMember | null>(null);
  const [verifiedSubmission, setVerifiedSubmission] = useState<SubmissionRecord | null>(null);
  const [wrongPlatoonError, setWrongPlatoonError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);

  // Camera QR Scanner states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScannedTokenRef = useRef<string | null>(null);

  // Verify function
  const handleVerify = useCallback(
    async (val?: string) => {
      const inputVal = (val || tokenInput).trim();
      if (!inputVal) return;

      setLoading(true);
      setWrongPlatoonError(null);
      setGeneralError(null);
      setVerifiedCorper(null);

      try {
        const res = await fetch("/api/inspector/verify-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenOrPin: inputVal,
            inspectorPlatoon,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          if (data.wrongPlatoon) {
            setWrongPlatoonError(data.error);
          } else {
            setGeneralError(data.error || "Verification failed. Check QR token or PIN.");
          }
          setLoading(false);
          return;
        }

        setVerifiedCorper(data.corpsMember);
        setVerifiedSubmission(data.submission);
      } catch (err: any) {
        setGeneralError(err.message || "Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [inspectorPlatoon, tokenInput]
  );

  // Live Camera Stream Lifecycle
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera requires HTTPS or supported browser.");
      setMode("MANUAL");
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraError("Unable to access camera. Please allow camera permissions or enter PIN manually.");
      setMode("MANUAL");
    }
  }, []);

  // Continuous Scan Loop using jsQR
  useEffect(() => {
    if (mode !== "CAMERA" || !cameraActive || verifiedCorper) {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
      return;
    }

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data && code.data.trim()) {
        const token = code.data.trim();
        if (token !== lastScannedTokenRef.current) {
          lastScannedTokenRef.current = token;
          handleVerify(token);
          return;
        }
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    };

    scanLoopRef.current = requestAnimationFrame(scanFrame);

    return () => {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    };
  }, [mode, cameraActive, verifiedCorper, handleVerify]);

  // Start or stop camera based on mode
  useEffect(() => {
    if (mode === "CAMERA" && !verifiedCorper) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, verifiedCorper, startCamera, stopCamera]);

  // Dispatch kit to verified corper
  const handleDispatchKit = async () => {
    if (!verifiedCorper) return;
    setDispatching(true);
    try {
      const res = await fetch("/api/inspector/dispatch-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode: verifiedCorper.state_code,
          inspectorPlatoon,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setGeneralError(data.error || "Failed to dispatch kit.");
        setDispatching(false);
        return;
      }

      onKitDispatched(verifiedCorper.state_code);
      if (onShowToast) {
        onShowToast(`Kit successfully disbursed to ${verifiedCorper.full_name}!`, "success");
      }
      onClose();
    } catch (err: any) {
      setGeneralError(err.message || "Error dispatching kit.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0c1a13] border-2 border-[#1e382b] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#12271c] to-[#0c1a13] border-b border-[#1e382b]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                Platoon {inspectorPlatoon} Kit Verification
              </h3>
              <p className="text-[11px] text-slate-400">Scan digital QR pass or enter 4-digit PIN</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: Camera Scanner vs Manual PIN */}
        {!verifiedCorper && (
          <div className="grid grid-cols-2 p-2 bg-[#08130d] border-b border-[#1e382b] gap-1.5 text-xs font-bold">
            <button
              onClick={() => {
                setMode("CAMERA");
                setWrongPlatoonError(null);
                setGeneralError(null);
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                mode === "CAMERA"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera Scanner</span>
            </button>
            <button
              onClick={() => {
                setMode("MANUAL");
                setWrongPlatoonError(null);
                setGeneralError(null);
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                mode === "MANUAL"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>Enter PIN / Code</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Wrong Platoon Alert Banner */}
          {wrongPlatoonError && (
            <div className="p-4 rounded-2xl bg-red-950/70 border-2 border-red-600 text-xs text-red-200 flex items-start gap-3 animate-in shake">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm text-red-100">CROSS-PLATOON ALERT</div>
                <div className="leading-relaxed">{wrongPlatoonError}</div>
                <div className="text-[11px] text-red-300 font-semibold pt-1">
                  Do NOT hand over kit. Direct this Corps Member to their assigned Platoon Inspector.
                </div>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {generalError && (
            <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-700/60 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>{generalError}</div>
            </div>
          )}

          {/* Mode 1: Live Camera QR Scanner */}
          {!verifiedCorper && mode === "CAMERA" && (
            <div className="space-y-3">
              <div className="relative w-full aspect-[4/3] max-w-sm mx-auto rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-2xl flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanner Target Reticle & Scanline */}
                <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-2xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between w-full">
                    <div className="w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                    <div className="w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                  </div>

                  {/* Animated Laser Scanline */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-pulse" />

                  <div className="flex justify-between w-full">
                    <div className="w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                    <div className="w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />
                  </div>
                </div>

                {/* Bottom Status Pill */}
                <div className="absolute bottom-3 bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/30 text-[11px] font-bold text-white shadow-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Align Corps Member QR Pass</span>
                </div>
              </div>

              {cameraError && (
                <div className="text-center text-xs text-amber-300 font-semibold">
                  {cameraError}
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Manual PIN / Code Entry */}
          {!verifiedCorper && mode === "MANUAL" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Enter 4-Digit PIN or QR Pass Token:
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  <input
                    type="text"
                    placeholder="e.g. 5821 or NYSC-PASS-..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    className="w-full pl-10 pr-4 py-3.5 bg-[#08130d] border border-[#1e382b] focus:border-emerald-500 rounded-2xl text-white text-sm outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loading || !tokenInput.trim()}
                onClick={() => handleVerify()}
                className="w-full py-3.5 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50 transition-all cursor-pointer active:scale-95"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify Pass</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Verified Corper Details & Handover Confirmation */}
          {verifiedCorper && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="p-4 rounded-2xl bg-[#09180f] border-2 border-emerald-500/60 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#008751]/20 border border-emerald-500/40 flex items-center justify-center overflow-hidden shrink-0">
                    {verifiedSubmission?.documents?.passport?.fileUrl ? (
                      <img
                        src={verifiedSubmission.documents.passport.fileUrl}
                        alt={verifiedCorper.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm truncate">
                        {verifiedCorper.full_name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                        Platoon {verifiedCorper.platoon}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-emerald-300 font-semibold mt-0.5">
                      {verifiedCorper.state_code}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e382b]/80 text-[11px]">
                  <div className="text-slate-400">
                    Call-up No: <strong className="text-white">{verifiedCorper.call_up_no}</strong>
                  </div>
                  <div className="text-slate-400">
                    Status: <strong className="text-emerald-400 font-bold">{verifiedSubmission?.kit_status}</strong>
                  </div>
                </div>
              </div>

              {/* Handover Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={dispatching}
                  onClick={() => {
                    setVerifiedCorper(null);
                    setVerifiedSubmission(null);
                    lastScannedTokenRef.current = null;
                  }}
                  className="w-1/3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-95"
                >
                  Scan Next
                </button>

                <button
                  type="button"
                  disabled={dispatching}
                  onClick={handleDispatchKit}
                  className="w-2/3 py-3 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {dispatching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Disbursing Kit...</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" />
                      <span>Hand Over Kit</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
