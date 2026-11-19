"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export interface SystemToastProps {
  message: string | null;
  type?: "success" | "error" | "info";
  onClose: () => void;
  durationMs?: number;
}

export default function SystemToast({
  message,
  type = "success",
  onClose,
  durationMs = 3500,
}: SystemToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onClose]);

  if (!message) return null;

  const getBorderAndBg = () => {
    switch (type) {
      case "error":
        return "bg-red-950/95 border-red-700 text-red-200 shadow-red-950/50";
      case "info":
        return "bg-blue-950/95 border-blue-700 text-blue-200 shadow-blue-950/50";
      default:
        return "bg-[#0b2416]/95 border-emerald-600 text-emerald-100 shadow-emerald-950/50";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92vw] animate-in slide-in-from-top-4 fade-in duration-200">
      <div
        className={`p-3.5 px-4 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-xs font-semibold ${getBorderAndBg()}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {getIcon()}
          <span className="truncate">{message}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-black/30 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
