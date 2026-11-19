"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import QRScannerModal from "@/components/QRScannerModal";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  QrCode,
  Users,
  PackageCheck,
  AlertCircle,
  Eye,
  RefreshCw,
  Search,
  Check,
  Mail,
  KeyRound,
} from "lucide-react";
import { CorpsMember, SubmissionRecord } from "@/lib/types";

export default function PlatoonInspectorPortal() {
  const [authState, setAuthState] = useState<"EMAIL" | "OTP" | "LOGGED_IN">("EMAIL");
  const [inputEmail, setInputEmail] = useState("");
  const [selectedPlatoon, setSelectedPlatoon] = useState<number>(8);
  const [targetEmail, setTargetEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Queue state
  const [activeTab, setActiveTab] = useState<"READY" | "INCOMPLETE" | "DISBURSED">("READY");
  const [searchQuery, setSearchQuery] = useState("");
  const [queueData, setQueueData] = useState<{
    platoon: number;
    stats: { total: number; readyCount: number; incompleteCount: number; disbursedCount: number };
    ready: any[];
    incomplete: any[];
    disbursed: any[];
  } | null>(null);

  // Modals
  const [scannerOpen, setScannerOpen] = useState(false);
  const [inspectingCorper, setInspectingCorper] = useState<any | null>(null);

    // 1. Send OTP for Platoon via Inspector's email
    const handleRequestOtp = async (overrideEmail?: string) => {
      const emailToUse = (overrideEmail || inputEmail).trim();
      if (!emailToUse) {
        setAuthError("Please enter your official Platoon Inspector email address.");
        return;
      }

      setLoading(true);
      setAuthError(null);

      try {
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "PLATOON_INSPECTOR", email: emailToUse }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setAuthError(data.error || "This email is not registered for any platoon. Please contact the Camp Admin to configure your email.");
          setLoading(false);
          return;
        }

        setTargetEmail(data.email);
        setMaskedEmail(data.maskedEmail);
        setDevOtp(data.devOtp);
        if (data.metadata?.platoon) {
          setSelectedPlatoon(data.metadata.platoon);
        }
        setAuthState("OTP");
      } catch (err: any) {
        setAuthError(err.message || "Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    // 2. Verify OTP
    const handleVerifyOtp = async (codeToUse?: string) => {
      const code = (codeToUse || otpInput).trim();
      if (!code) return;

      setLoading(true);
      setAuthError(null);

      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: targetEmail,
            code,
            role: "PLATOON_INSPECTOR",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setAuthError(data.error || "Invalid verification code.");
          setLoading(false);
          return;
        }

        const activePlatoon = data.platoon || selectedPlatoon;
        setSelectedPlatoon(activePlatoon);
        await fetchQueue(activePlatoon);
        setAuthState("LOGGED_IN");
      } catch (err: any) {
        setAuthError(err.message || "Verification failed.");
      } finally {
        setLoading(false);
      }
    };

    // 3. Fetch Platoon Queue
    const fetchQueue = async (p: number) => {
      try {
        const res = await fetch(`/api/inspector/queue?platoon=${p}`);
        const data = await res.json();
        if (data.success) {
          setQueueData(data);
        }
      } catch (err) {
        console.error("fetchQueue error:", err);
      }
    };

    // Dispatch kit directly from list
    const handleDispatchKit = async (stateCode: string, name: string) => {
      if (!confirm(`Are you sure you want to mark official kit as DISBURSED to ${name} (${stateCode})?`)) {
        return;
      }

      try {
        const res = await fetch("/api/inspector/dispatch-kit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stateCode, inspectorPlatoon: selectedPlatoon }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          alert(data.error || "Failed to dispatch kit.");
          return;
        }

        alert(data.message);
        fetchQueue(selectedPlatoon);
      } catch (err: any) {
        alert(err.message || "Error dispatching kit.");
      }
    };

    // Toggle Medical Exeat
    const handleToggleExeat = async (stateCode: string, currentVal: boolean) => {
      const newVal = !currentVal;
      try {
        const res = await fetch("/api/inspector/toggle-exeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stateCode, inspectorPlatoon: selectedPlatoon, unlocked: newVal }),
        });
        const data = await res.json();
        if (data.success) {
          fetchQueue(selectedPlatoon);
        }
      } catch (err) {
        console.error(err);
      }
    };

    // Toggle Re-upload for a document
    const handleToggleReupload = async (stateCode: string, docKey: string, currentCanReupload: boolean) => {
      const newVal = !currentCanReupload;
      if (
        newVal &&
        !confirm(
          `Are you sure you want to allow this Corps Member to re-upload their ${docKey}? This will reset its verification status.`
        )
      ) {
        return;
      }

      try {
        const res = await fetch("/api/inspector/toggle-reupload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stateCode,
            documentKey: docKey,
            inspectorPlatoon: selectedPlatoon,
            canReupload: newVal,
          }),
        });
        const data = await res.json();
        if (data.success) {
          fetchQueue(selectedPlatoon);
          alert(data.message);
        }
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <div className="min-h-screen flex flex-col bg-[#0c1a13] text-slate-100">
        <Navbar
          userRole={authState === "LOGGED_IN" ? "PLATOON_INSPECTOR" : undefined}
          userName={`Platoon ${selectedPlatoon} Inspector`}
          platoon={selectedPlatoon}
          onLogout={() => {
            setAuthState("EMAIL");
            setQueueData(null);
          }}
        />

        <main className="flex-1 pb-16">
          {/* ================= LOGIN SCREENS ================= */}
          {authState !== "LOGGED_IN" && (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
              <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 rounded-2xl bg-white shadow-md border border-emerald-500/20 mb-1">
                    <img src="/assets/NYSC_LOGO.svg" alt="NYSC Crest" width={48} height={48} className="w-12 h-12 object-contain" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Platoon Inspector Login
                  </h1>
                  <p className="text-xs text-slate-400">
                    Enter your official inspector email configured by the Camp Admin.
                  </p>
                </div>

                {authError && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>{authError}</div>
                  </div>
                )}

                  {/* Step 1: Email Input */ }
              {authState === "EMAIL" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                        Inspector Official Email:
                      </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                          <input
                            type="email"
                            placeholder="e.g. platoon8.inspector@nysc.gov.ng"
                            value={inputEmail}
                            onChange={(e) => setInputEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                            className="w-full pl-10 pr-4 py-3.5 bg-[#0c1a13] border border-[#1e382b] focus:border-emerald-500 rounded-2xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Must match the email configured by Camp Admin. If unrecognized, contact Admin.
                        </p>
                      </div>

                      <button
                        onClick={() => handleRequestOtp()}
                        disabled={loading || !inputEmail.trim()}
                        className="w-full py-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <KeyRound className="w-4 h-4" />
                        )}
                        <span>Request Inspector OTP</span>
                      </button>

                      <div className="pt-2 border-t border-white/5">
                        <span className="text-[10px] text-slate-500 block mb-1.5">
                          Demo Accounts (Click to test):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {["platoon8.inspector@nysc.gov.ng", "platoon1.inspector@nysc.gov.ng", "platoon5.inspector@nysc.gov.ng"].map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => {
                                setInputEmail(em);
                                handleRequestOtp(em);
                              }}
                              className="text-[10px] px-2.5 py-1 rounded-md bg-[#0c1a13] hover:bg-emerald-950/50 text-emerald-400 border border-emerald-900/60 transition-all"
                            >
                              {em.split("@")[0]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
              )}

                    {/* Step 2: OTP Verification */}
                    {authState === "OTP" && (
                      <div className="space-y-4">
                        <div className="p-3.5 rounded-2xl bg-[#0c1a13] border border-[#1e382b] text-xs space-y-1">
                          <div className="text-slate-400">OTP sent to Platoon {selectedPlatoon} Inspector:</div>
                          <div className="font-mono font-bold text-emerald-400 text-sm">{maskedEmail}</div>
                        </div>

                        {devOtp && (
                          <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
                            <span>Dev Auto-Code:</span>
                            <button
                              onClick={() => {
                                setOtpInput(devOtp);
                                handleVerifyOtp(devOtp);
                              }}
                              className="font-mono font-black text-sm px-2 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                            >
                              Fill {devOtp}
                            </button>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                            Enter 6-Digit OTP:
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="e.g. 123456"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                            className="w-full bg-[#0c1a13] border-2 border-[#1e382b] focus:border-[#008751] rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest font-bold text-white placeholder-slate-600 focus:outline-none"
                          />
                        </div>

                        <button
                          onClick={() => handleVerifyOtp()}
                          disabled={loading || otpInput.length < 6}
                          className="w-full py-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 disabled:opacity-50 transition-all cursor-pointer"
                        >
                          <span>Enter Platoon Dashboard</span>
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
          </div>
        )}

              {/* ================= INSPECTOR DASHBOARD ================= */}
              {authState === "LOGGED_IN" && queueData && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
                  {/* Top Inspector Bar & KPIs */}
                  <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-xl space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="inline-block px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs uppercase mb-2">
                          PLATOON {selectedPlatoon} COMMAND DESK
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          Kit Handover & Document Review
                        </h1>
                        <p className="text-xs text-slate-400">
                          Isolate to Platoon {selectedPlatoon}. Cross-platoon verification security active.
                        </p>
                      </div>

                      {/* Big Action: Open QR Scanner */}
                      <button
                        onClick={() => setScannerOpen(true)}
                        className="w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-[#008751] to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/60 transition-all text-sm cursor-pointer"
                      >
                        <QrCode className="w-5 h-5" />
                        <span>Scan Corper Pass / Enter PIN</span>
                      </button>
                    </div>

                    {/* KPI Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="bg-[#0c1a13] p-4 rounded-2xl border border-[#1e382b]">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider">Total in Platoon</div>
                        <div className="text-2xl font-black text-white mt-1">{queueData.stats.total}</div>
                      </div>
                      <div className="bg-[#0c1a13] p-4 rounded-2xl border border-emerald-900/60">
                        <div className="text-[11px] text-emerald-400 uppercase tracking-wider font-bold">
                          Ready for Kit
                        </div>
                        <div className="text-2xl font-black text-emerald-400 mt-1">{queueData.stats.readyCount}</div>
                      </div>
                      <div className="bg-[#0c1a13] p-4 rounded-2xl border border-amber-900/50">
                        <div className="text-[11px] text-amber-400 uppercase tracking-wider font-bold">
                          Incomplete Uploads
                        </div>
                        <div className="text-2xl font-black text-amber-400 mt-1">{queueData.stats.incompleteCount}</div>
                      </div>
                      <div className="bg-[#0c1a13] p-4 rounded-2xl border border-[#1e382b]">
                        <div className="text-[11px] text-slate-400 uppercase tracking-wider">Kits Disbursed</div>
                        <div className="text-2xl font-black text-slate-300 mt-1">{queueData.stats.disbursedCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Queue Navigation Tabs */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1e382b] pb-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setActiveTab("READY")}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "READY"
                            ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                            : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                          }`}
                      >
                        <PackageCheck className="w-4 h-4" />
                        <span>Ready for Kit ({queueData.stats.readyCount})</span>
                      </button>

                      <button
                        onClick={() => setActiveTab("INCOMPLETE")}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "INCOMPLETE"
                            ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                            : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                          }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>Incomplete ({queueData.stats.incompleteCount})</span>
                      </button>

                      <button
                        onClick={() => setActiveTab("DISBURSED")}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "DISBURSED"
                            ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                            : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                          }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Disbursed ({queueData.stats.disbursedCount})</span>
                      </button>
                    </div>

                    {/* Search filter */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search name or state code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Corps Member List Cards */}
                  {(() => {
                    const currentList =
                      activeTab === "READY"
                        ? queueData.ready
                        : activeTab === "INCOMPLETE"
                          ? queueData.incomplete
                          : queueData.disbursed;

                    const filtered = currentList.filter(
                      (item) =>
                        item.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.state_code.toLowerCase().includes(searchQuery.toLowerCase())
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-16 text-slate-500 text-xs">
                          No Corps Members found in this category.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((item) => {
                          const sub = item.submission;
                          const isDisbursed = sub?.kit_status === "KIT_DISBURSED";

                          return (
                            <div
                              key={item.state_code}
                              className="bg-[#12271c] border border-[#1e382b] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-emerald-500/40 shrink-0">
                                    <img
                                      src={sub?.documents?.passport?.fileUrl || "/assets/nysc_logo.png"}
                                      alt={item.full_name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white truncate">{item.full_name}</div>
                                    <div className="text-xs font-mono font-bold text-emerald-400">
                                      {item.state_code}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">{item.course_of_study}</div>
                                  </div>
                                </div>

                                {/* 4 Manual Eye-Check Docs Preview */}
                                <div className="bg-[#0c1a13] p-2.5 rounded-xl border border-[#1e382b] space-y-1.5 text-[11px]">
                                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    Manual Inspection Items:
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                    <span className={sub?.documents?.passport ? "text-emerald-400" : "text-slate-500"}>
                                      • Passport: {sub?.documents?.passport ? "Ready" : "Missing"}
                                    </span>
                                    <span
                                      className={
                                        sub?.documents?.school_certificate ? "text-emerald-400" : "text-slate-500"
                                      }
                                    >
                                      • Certificate: {sub?.documents?.school_certificate ? "Ready" : "Missing"}
                                    </span>
                                    <span
                                      className={
                                        sub?.documents?.medical_fitness ? "text-emerald-400" : "text-slate-500"
                                      }
                                    >
                                      • Med Fitness: {sub?.documents?.medical_fitness ? "Ready" : "Missing"}
                                    </span>
                                    <span className={sub?.documents?.bank_slip ? "text-emerald-400" : "text-slate-500"}>
                                      • Bank Slip: {sub?.documents?.bank_slip ? "Ready" : "Missing"}
                                    </span>
                                  </div>
                                </div>

                                {/* Medical Exeat Override Toggle if Medical Corper */}
                                {item.is_medical && (
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-blue-950/30 border border-blue-900/40 text-[11px]">
                                    <span className="text-blue-300">Medical Exeat Slot:</span>
                                    <button
                                      onClick={() => handleToggleExeat(item.state_code, sub?.exeat?.unlockedByPi)}
                                      className={`px-2 py-1 rounded text-[10px] font-bold ${sub?.exeat?.unlockedByPi
                                          ? "bg-emerald-600 text-white"
                                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                        }`}
                                    >
                                      {sub?.exeat?.unlockedByPi ? "Unlocked" : "Locked (Click to Unlock)"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Card Actions */}
                              <div className="pt-3 border-t border-[#1e382b] flex items-center gap-2">
                                {isDisbursed ? (
                                  <div className="w-full py-2 text-center text-xs text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
                                    ✓ Kit Disbursed
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleDispatchKit(item.state_code, item.full_name)}
                                    className="flex-1 py-2 px-3 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                                  >
                                    <PackageCheck className="w-4 h-4" />
                                    <span>Confirm Dispatched Kit</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </main>

      {/* QR Scanner / PIN Verification Modal */}
          {scannerOpen && (
            <QRScannerModal
              inspectorPlatoon={selectedPlatoon}
              onClose={() => setScannerOpen(false)}
              onKitDispatched={(stateCode) => {
                fetchQueue(selectedPlatoon);
              }}
            />
          )}
      </div>
    );
  }
