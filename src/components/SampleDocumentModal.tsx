"use client";

import { X, CheckCircle2, AlertTriangle, ShieldCheck, FileCheck } from "lucide-react";
import { DocumentDefinition } from "@/lib/types";

interface SampleModalProps {
  docDef: DocumentDefinition | null;
  onClose: () => void;
}

export default function SampleDocumentModal({ docDef, onClose }: SampleModalProps) {
  if (!docDef) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-[#12271c] border border-[#1e382b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#0a1811] border-b border-[#1e382b]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  Official Specification: {docDef.title}
                </h3>
                <p className="text-xs text-slate-400">National Youth Service Corps document validation guideline</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto space-y-6">
                {/* Dynamic Vector Blueprint of the Document */}
                <div className="relative rounded-2xl border-2 border-dashed border-emerald-600/40 bg-gradient-to-b from-[#0c1a13] to-[#07130e] p-6 flex flex-col items-center justify-center min-h-[280px] shadow-inner text-slate-200">
                  {/* Top Seal & Heading */}
                  <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl p-5 space-y-4 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
                      <div className="flex items-center gap-2.5">
                        <img src="/assets/NYSC_LOGO.svg" alt="NYSC Crest" width={28} height={28} className="w-7 h-7 object-contain" />
                        <div>
                          <div className="text-[11px] font-black tracking-wider text-emerald-400 uppercase">
                            NATIONAL YOUTH SERVICE CORPS
                          </div>
                          <div className="text-[9px] text-slate-400 font-mono">
                            OFFICIAL TEMPLATE SPECIFICATION
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                        {docDef.category === "AUTO_VERIFIED" ? "AI CLASSIFIED" : "INSPECTOR VERIFIED"}
                      </span>
                    </div>

                    {/* Schematic document layout */}
                    <div className="space-y-2 py-2">
                      <div className="text-center font-bold text-sm text-white tracking-wide uppercase border-b border-white/5 pb-2">
                        {docDef.title}
                      </div>

                      {/* Visual layout mock lines */}
                      <div className="space-y-1.5 pt-1 text-[11px] text-slate-400">
                        <div className="flex items-center justify-between text-slate-300 bg-white/5 px-2.5 py-1.5 rounded">
                          <span className="font-semibold text-slate-300">Target Header:</span>
                          <span className="font-mono text-emerald-400">{docDef.title}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 bg-white/5 px-2.5 py-1.5 rounded">
                          <span className="font-semibold text-slate-300">Identification:</span>
                          <span className="font-mono text-amber-400">State Code & Call-Up Number</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300 bg-white/5 px-2.5 py-1.5 rounded">
                          <span className="font-semibold text-slate-300">Validation Mode:</span>
                          <span className="text-xs text-slate-300">{docDef.category === "AUTO_VERIFIED" ? "Automated 3-line OCR Fingerprint" : "Physical PI Inspection Checklist"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Stamp / Seal mockup */}
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-900/60 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Legible & CamScanned</span>
                      </div>
                      <div className="font-mono text-slate-400">
                        [Official NYSC Batch C 2026]
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guidelines & Anchors */}
                <div className="bg-[#0c1a13] p-4 rounded-xl border border-[#1e382b] space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    What the system and inspector verify:
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-300">
                    {docDef.instructions.map((ins, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                  {/* Compliance Warning */}
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Compliance Note:</span> Please ensure your uploaded file is crisp, flat, and legible. The system automatically converts images to standard PDF format with CamScanner contrast enhancements.
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-[#0a1811] border-t border-[#1e382b] flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#008751] hover:bg-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-900/30"
                  >
                    Understood, Proceed
                  </button>
                </div>
              </div>
            </div>
            );
}
