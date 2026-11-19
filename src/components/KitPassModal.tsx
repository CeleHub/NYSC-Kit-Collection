"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import confetti from "canvas-confetti";
import { X, CheckCircle2, ShieldCheck, Download, Printer } from "lucide-react";
import { CorpsMember, SubmissionRecord } from "@/lib/types";

interface KitPassModalProps {
  corpsMember: CorpsMember;
  submission: SubmissionRecord;
  onClose: () => void;
}

export default function KitPassModal({ corpsMember, submission, onClose }: KitPassModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    // Trigger confetti on success
    try {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }

    // Generate high quality QR code
    QRCode.toDataURL(submission.qr_token, {
      width: 260,
      margin: 1.5,
      color: {
        dark: "#006039",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [submission.qr_token]);

  const passportDoc = submission.documents["passport"];
  const isDisbursed = submission.kit_status === "KIT_DISBURSED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-emerald-600/30">
        {/* Pass Top Banner */}
        <div className="bg-[#008751] px-6 py-5 text-white text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src="/assets/NYSC_LOGO.svg" alt="NYSC" width={32} height={32} className="w-8 h-8 object-contain" />
              <span className="text-xs font-black uppercase tracking-wider">NYSC ORIENTATION CAMP</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <h2 className="text-lg font-black tracking-tight uppercase">
            Official Kit Collection Pass
          </h2>
          <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
            {isDisbursed ? "✓ KIT DISBURSED & COLLECTED" : "ELIGIBLE FOR KIT HANDOVER"}
          </div>
        </div>

        {/* Pass Content Card */}
        <div className="p-6 space-y-5 bg-gradient-to-b from-emerald-50/50 to-white">
          {/* Member Profile Block */}
          <div className="flex items-center gap-4 bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border-2 border-emerald-600/40 shrink-0 shadow-inner">
              <img
                src={passportDoc?.fileUrl || "/assets/nysc_logo.png"}
                alt={corpsMember.full_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-900 truncate">
                {corpsMember.full_name}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-700">
                {corpsMember.state_code}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-600 text-white">
                  PLATOON {corpsMember.platoon}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {corpsMember.call_up_no}
                </span>
              </div>
            </div>
          </div>

          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border-2 border-dashed border-emerald-200 shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Kit Verification QR Code"
                className="w-48 h-48 object-contain rounded-lg"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                Generating secure pass...
              </div>
            )}

            <div className="text-center mt-3 space-y-0.5">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                4-Digit Fallback Verification PIN
              </div>
              <div className="text-2xl font-black font-mono tracking-widest text-[#008751]">
                {submission.backup_pin}
              </div>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Next Step: Collect Your Kit
            </div>
            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Proceed to your <strong>Platoon {corpsMember.platoon} Inspector Desk</strong>. Present this digital pass or mention your 4-digit PIN to collect your official uniforms and boots.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[10px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Tamper-proof single-use token
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold text-white bg-[#008751] hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save
          </button>
        </div>
      </div>
    </div>
  );
}
