"use client";

import { useState } from "react";
import { X, QrCode, AlertOctagon, CheckCircle2, RefreshCw, KeyRound, ArrowRight } from "lucide-react";
import { CorpsMember, SubmissionRecord } from "@/lib/types";

interface QRScannerModalProps {
  inspectorPlatoon: number;
  onClose: () => void;
  onKitDispatched: (stateCode: string) => void;
}

export default function QRScannerModal({
  inspectorPlatoon,
  onClose,
  onKitDispatched,
}: QRScannerModalProps) {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedCorper, setVerifiedCorper] = useState<CorpsMember | null>(null);
  const [verifiedSubmission, setVerifiedSubmission] = useState<SubmissionRecord | null>(null);
  const [wrongPlatoonError, setWrongPlatoonError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);

  const handleVerify = async (val?: string) => {
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
          setGeneralError(data.error || "Verification failed. Check token or PIN.");
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
  };

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
        alert(data.error || "Failed to dispatch kit.");
        setDispatching(false);
        return;
      }

      onKitDispatched(verifiedCorper.state_code);
      alert(`Kit marked as DISBURSED for ${verifiedCorper.full_name}! Confirmation email has been sent.`);
      onClose();
    } catch (err: any) {
      alert(err.message || "Error dispatching kit.");
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#12271c] border border-[#1e382b] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0a1811] border-b border-[#1e382b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                Platoon {inspectorPlatoon} Kit Verification
              </h3>
              <p className="text-[11px] text-slate-400">Scan QR Pass or enter 4-digit verification PIN</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Wrong Platoon Alert */}
          {wrongPlatoonError && (
            <div className="p-4 rounded-xl bg-red-950/50 border-2 border-red-600 text-xs text-red-200 flex items-start gap-3 animate-in shake">
              <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-black text-red-300 text-sm tracking-wide uppercase">
                  SECURITY ALERT: WRONG PLATOON
                </div>
                <div className="leading-relaxed font-semibold">{wrongPlatoonError}</div>
                <div className="text-[11px] text-red-300/80 pt-1">
                  Please direct this Corps Member to their assigned platoon desk.
                </div>
              </div>
            </div>
          )}

          {/* General Error */}
          {generalError && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800 text-xs text-amber-200">
              {generalError}
            </div>
          )}

          {/* Input Controls if not yet verified */}
          {!verifiedCorper && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Enter 4-Digit PIN, State Code, or QR Token:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-emerald-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="e.g. 4821 or LA/26C/18388"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                      className="w-full bg-[#0c1a13] border border-[#1e382b] focus:border-emerald-500 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={() => handleVerify()}
                    disabled={loading || !tokenInput.trim()}
                    className="py-2.5 px-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Verify</span>
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons for testing demo records */}
              <div className="pt-2 border-t border-[#1e382b]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                  Demo Fast Fill:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setTokenInput("4821");
                      handleVerify("4821");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0c1a13] hover:bg-emerald-950/40 text-[11px] font-mono text-emerald-400 border border-[#1e382b]"
                  >
                    PIN: 4821 (Celestine - P8)
                  </button>
                  <button
                    onClick={() => {
                      setTokenInput("8371");
                      handleVerify("8371");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0c1a13] hover:bg-emerald-950/40 text-[11px] font-mono text-emerald-400 border border-[#1e382b]"
                  >
                    PIN: 8371 (Akanbi - P8)
                  </button>
                  <button
                    onClick={() => {
                      setTokenInput("LA/26C/10041");
                      handleVerify("LA/26C/10041");
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0c1a13] hover:bg-red-950/40 text-[11px] font-mono text-amber-300 border border-amber-900/40"
                  >
                    Test Wrong Platoon (Chioma - P1)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Verified Corper Details Preview */}
          {verifiedCorper && verifiedSubmission && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-xl bg-[#0c1a13] border border-[#1e382b] flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border-2 border-emerald-500 shrink-0">
                  <img
                    src={verifiedSubmission.documents["passport"]?.fileUrl || "/assets/nysc_logo.png"}
                    alt={verifiedCorper.full_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">{verifiedCorper.full_name}</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">
                    {verifiedCorper.state_code}
                  </div>
                  <div className="text-[11px] text-slate-400">{verifiedCorper.course_of_study}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
                      PLATOON {verifiedCorper.platoon}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      {verifiedSubmission.kit_status === "KIT_DISBURSED"
                        ? "ALREADY COLLECTED"
                        : "READY FOR KIT"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setVerifiedCorper(null);
                    setVerifiedSubmission(null);
                    setTokenInput("");
                  }}
                  className="py-2.5 px-4 bg-[#0c1a13] hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-[#1e382b] text-xs"
                >
                  Scan Another
                </button>
                <button
                  onClick={handleDispatchKit}
                  disabled={dispatching || verifiedSubmission.kit_status === "KIT_DISBURSED"}
                  className="flex-1 py-3 px-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
                >
                  {dispatching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {verifiedSubmission.kit_status === "KIT_DISBURSED"
                      ? "Kit Already Disbursed"
                      : "Confirm & Dispatch Kit Now"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
