"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import DocumentDossierModal from "@/components/DocumentDossierModal";
import {
  ShieldCheck,
  CheckCircle2,
  Building2,
  Users,
  Settings,
  AlertTriangle,
  Lock,
  Unlock,
  Edit2,
  Save,
  Plus,
  RefreshCw,
  Search,
  Mail,
  KeyRound,
  ShieldAlert,
  LogIn,
  Eye,
} from "lucide-react";
import { AdminKPIs, PlatoonInspectorAccount, SecretariatAccount, CorpsMember, SubmissionRecord } from "@/lib/types";

export default function AdminPortal() {
  // Authentication State
  const [authState, setAuthState] = useState<"LOGIN" | "OTP" | "LOGGED_IN">("LOGIN");
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Tabs & Data
  const [activeTab, setActiveTab] = useState<"KPIS" | "PLATOONS" | "SECRETARIAT" | "CORPERS" | "LOGS">("KPIS");
  const [data, setData] = useState<{
    kpis: AdminKPIs;
    platoons: Record<string, PlatoonInspectorAccount>;
    secretariat: SecretariatAccount;
    recentAuditLogs: any[];
  } | null>(null);

  const [nominalRoll, setNominalRoll] = useState<CorpsMember[]>([]);
  const [editingPlatoon, setEditingPlatoon] = useState<number | null>(null);
  const [platoonEmailInput, setPlatoonEmailInput] = useState("");
  const [editingSecEmail, setEditingSecEmail] = useState(false);
  const [secEmailInput, setSecEmailInput] = useState("");

  // Edit corper modal
  const [editingCorper, setEditingCorper] = useState<Partial<CorpsMember> | null>(null);
  const [searchCorper, setSearchCorper] = useState("");
  const [inspectingDossier, setInspectingDossier] = useState<{ corpsMember: CorpsMember; submission: SubmissionRecord | null } | null>(null);
  const [loadingDossierCode, setLoadingDossierCode] = useState<string | null>(null);

  useEffect(() => {
    // Check local session & pending OTP
    if (typeof window !== "undefined") {
      const isAuth = localStorage.getItem("nysc_admin_session") || sessionStorage.getItem("nysc_admin_session");
      if (isAuth === "true") {
        setAuthState("LOGGED_IN");
        fetchAdminOverview();
        fetchNominalRoll();
        return;
      }

      const pending = localStorage.getItem("nysc_admin_auth_pending");
      if (pending) {
        try {
          const parsed = JSON.parse(pending);
          const ageMs = Date.now() - (parsed.timestamp || 0);
          if (parsed.email && ageMs < 15 * 60 * 1000) {
            setAdminEmailInput(parsed.email);
            setTargetEmail(parsed.email);
            setMaskedEmail(parsed.maskedEmail || "");
            setDevOtp(parsed.devOtp || null);
            setAuthState("OTP");
          } else {
            localStorage.removeItem("nysc_admin_auth_pending");
          }
        } catch { }
      }
    }
  }, []);

  // 1. Request Admin OTP
  const handleRequestAdminOtp = async (overrideEmail?: string) => {
    const emailToUse = (overrideEmail || adminEmailInput).trim();
    if (!emailToUse) {
      setAuthError("Please enter your registered Camp Admin email.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN", email: emailToUse }),
      });

      const d = await res.json();
      if (!res.ok || !d.success) {
        setAuthError(d.error || "Unauthorized email. This email does not match the configured Camp Administrator account.");
        setAuthLoading(false);
        return;
      }

      setTargetEmail(d.email);
      setMaskedEmail(d.maskedEmail);
      setDevOtp(d.devOtp);
      setAuthState("OTP");

      localStorage.setItem(
        "nysc_admin_auth_pending",
        JSON.stringify({
          email: d.email,
          maskedEmail: d.maskedEmail,
          devOtp: d.devOtp,
          timestamp: Date.now(),
        })
      );
    } catch (err: any) {
      setAuthError(err.message || "Failed to contact authorization server.");
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Verify Admin OTP
  const handleVerifyAdminOtp = async (codeToUse?: string) => {
    const code = (codeToUse || otpInput).trim();
    if (!code) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          code,
          role: "ADMIN",
        }),
      });

      const d = await res.json();
      if (!res.ok || !d.success) {
        setAuthError(d.error || "Invalid verification code.");
        setAuthLoading(false);
        return;
      }

      localStorage.removeItem("nysc_admin_auth_pending");
      localStorage.setItem("nysc_admin_session", "true");
      sessionStorage.setItem("nysc_admin_session", "true");
      setAuthState("LOGGED_IN");
      await fetchAdminOverview();
      await fetchNominalRoll();
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("nysc_admin_session");
    localStorage.removeItem("nysc_admin_auth_pending");
    sessionStorage.removeItem("nysc_admin_session");
    setAuthState("LOGIN");
    setData(null);
    setNominalRoll([]);
    setAdminEmailInput("");
    setOtpInput("");
  };

  const fetchAdminOverview = async () => {
    try {
      const res = await fetch("/api/admin/overview");
      const d = await res.json();
      if (d.success) {
        setData(d);
        setSecEmailInput(d.secretariat.email);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNominalRoll = async () => {
    try {
      const res = await fetch("/api/admin/corpers");
      const d = await res.json();
      if (d.success) {
        setNominalRoll(d.nominalRoll);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle or Update Platoon
  const handleUpdatePlatoon = async (pNum: number, email?: string, active?: boolean) => {
    try {
      const res = await fetch("/api/admin/platoons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platoon: pNum,
          email,
          active,
        }),
      });
      const d = await res.json();
      if (d.success) {
        fetchAdminOverview();
        setEditingPlatoon(null);
      } else {
        alert(d.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Update Secretariat
  const handleUpdateSecretariat = async (email?: string, active?: boolean) => {
    try {
      const res = await fetch("/api/admin/secretariat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, active }),
      });
      const d = await res.json();
      if (d.success) {
        fetchAdminOverview();
        setEditingSecEmail(false);
      } else {
        alert(d.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Save Corper
  const handleSaveCorper = async () => {
    if (!editingCorper || !editingCorper.state_code || !editingCorper.full_name || !editingCorper.email) {
      alert("State code, full name, and email are required.");
      return;
    }

    try {
      const res = await fetch("/api/admin/corpers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCorper),
      });
      const d = await res.json();
      if (d.success) {
        alert(d.message);
        fetchNominalRoll();
        fetchAdminOverview();
        setEditingCorper(null);
      } else {
        alert(d.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0c1a13] text-slate-100">
      <Navbar
        userRole={authState === "LOGGED_IN" ? "CAMP_ADMIN" : undefined}
        userName="Camp Director / Admin"
        onLogout={handleAdminLogout}
      />

      <main className="flex-1 w-full">
        {/* ================= ADMIN AUTH GATE ================= */}
        {authState !== "LOGGED_IN" ? (
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
            <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Camp Directorate Admin
                </h1>
                <p className="text-xs text-slate-400">
                  Restricted command access. Enter your administrator email configured in the system environment.
                </p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>{authError}</div>
                </div>
              )}

              {/* Step 1: Email Input */}
              {authState === "LOGIN" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Administrator Email:
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                      <input
                        type="email"
                        placeholder="e.g. admin@nysc.gov.ng"
                        value={adminEmailInput}
                        onChange={(e) => setAdminEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRequestAdminOtp()}
                        className="w-full pl-10 pr-4 py-3.5 bg-[#0c1a13] border border-[#1e382b] focus:border-amber-500 rounded-2xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Configured via <code className="text-slate-300 font-mono">.env</code>.
                    </p>
                  </div>

                  <button
                    onClick={() => handleRequestAdminOtp()}
                    disabled={authLoading || !adminEmailInput.trim()}
                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {authLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4" />
                    )}
                    <span>Request Directorate OTP</span>
                  </button>

                </div>
              )}

              {/* Step 2: OTP Verification */}
              {authState === "OTP" && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-[#0c1a13] border border-[#1e382b] text-xs space-y-1">
                    <div className="text-slate-400">Passcode dispatched to your email:</div>
                    <div className="font-mono font-bold text-amber-400 text-sm">{maskedEmail}</div>
                    <div className="text-[11px] text-slate-500">Check your inbox. Valid for 5 minutes.</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Enter 6-Digit OTP:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="••••••"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyAdminOtp()}
                      className="w-full text-center tracking-[8px] font-mono text-xl py-3.5 bg-[#0c1a13] border border-[#1e382b] focus:border-amber-500 rounded-2xl text-white outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAuthState("LOGIN")}
                      className="w-1/3 py-3.5 bg-[#0c1a13] hover:bg-slate-800 text-slate-300 font-bold rounded-2xl text-xs border border-[#1e382b]"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleVerifyAdminOtp()}
                      disabled={authLoading || otpInput.length !== 6}
                      className="w-2/3 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl text-xs shadow-lg shadow-amber-950/40 disabled:opacity-50"
                    >
                      {authLoading ? "Verifying..." : "Unlock Dashboard"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= AUTHENTICATED DASHBOARD ================= */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full">
            {/* Top Header */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs uppercase mb-2">
                  CAMP DIRECTORATE ADMINISTRATION
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Camp Operations & System Control
                </h1>
                <p className="text-xs text-slate-400">
                  Real-time kit disbursement tracking, platoon account management, and nominal roll configuration.
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#1e382b] pb-2 text-xs font-bold">
              <button
                onClick={() => setActiveTab("KPIS")}
                className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "KPIS"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                  }`}
              >
                Camp KPIs & Analytics
              </button>
              <button
                onClick={() => setActiveTab("PLATOONS")}
                className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "PLATOONS"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                  }`}
              >
                Platoon Inspectors (P1 - P10)
              </button>
              <button
                onClick={() => setActiveTab("SECRETARIAT")}
                className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "SECRETARIAT"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                  }`}
              >
                Secretariat Settings
              </button>
              <button
                onClick={() => setActiveTab("CORPERS")}
                className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "CORPERS"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                  }`}
              >
                Nominal Roll / Mock Data
              </button>
              <button
                onClick={() => setActiveTab("LOGS")}
                className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "LOGS"
                  ? "bg-[#008751] text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-[#12271c]"
                  }`}
              >
                System Audit Log
              </button>
            </div>

            {/* ================= TAB 1: CAMP KPIS ================= */}
            {activeTab === "KPIS" && data && (
              <div className="space-y-6 animate-in fade-in">
                {/* Top Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-[#12271c] p-5 rounded-2xl border border-[#1e382b]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Total Mobilized</div>
                    <div className="text-3xl font-black text-white mt-1">{data.kpis.totalMobilized}</div>
                    <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
                      {data.kpis.totalLoggedIn} Logged in ({Math.round((data.kpis.totalLoggedIn / data.kpis.totalMobilized) * 100)}%)
                    </div>
                  </div>

                  <div className="bg-[#12271c] p-5 rounded-2xl border border-emerald-900/60">
                    <div className="text-[11px] text-emerald-400 uppercase tracking-wider font-bold">Kits Disbursed</div>
                    <div className="text-3xl font-black text-emerald-400 mt-1">{data.kpis.totalKitsDisbursed}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {data.kpis.disbursedPercentage}% Camp Completion
                    </div>
                  </div>

                  <div className="bg-[#12271c] p-5 rounded-2xl border border-amber-900/60">
                    <div className="text-[11px] text-amber-400 uppercase tracking-wider font-bold">Ready for Pickup</div>
                    <div className="text-3xl font-black text-amber-400 mt-1">{data.kpis.totalReadyForKit}</div>
                    <div className="text-[11px] text-slate-400 mt-1">Pending at Platoon Desks</div>
                  </div>

                  <div className="bg-[#12271c] p-5 rounded-2xl border border-[#1e382b]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold">Exeat Requests</div>
                    <div className="text-3xl font-black text-white mt-1">{data.kpis.totalExeatRequested}</div>
                    <div className="text-[11px] text-emerald-400 mt-1">
                      {data.kpis.totalExeatDelivered} Issued by Secretariat
                    </div>
                  </div>
                </div>

                {/* Platoon Comparison Progress Bars */}
                <div className="bg-[#12271c] p-6 rounded-3xl border border-[#1e382b] space-y-4">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Platoon-by-Platoon Kit Disbursement Progress (P1 to P10)
                  </h2>
                  <div className="space-y-3">
                    {data.kpis.platoonsProgress.map((p) => (
                      <div key={p.platoon} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">Platoon {p.platoon}</span>
                          <span className="text-slate-400 font-mono">
                            {p.disbursed} / {p.total} Disbursed ({p.disbursedPct}%) • {p.ready} Ready
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#0c1a13] overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${p.disbursedPct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: PLATOON INSPECTORS ================= */}
            {activeTab === "PLATOONS" && data && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">Platoon Inspector Accounts</h2>
                    <p className="text-xs text-slate-400">
                      Update login email addresses or temporarily suspend inspectors.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pNum) => {
                    const p = data.platoons[String(pNum)] || {
                      platoon: pNum,
                      name: `Inspector Platoon ${pNum}`,
                      email: `platoon${pNum}.inspector@nysc.gov.ng`,
                      active: true,
                    };

                    const isEditing = editingPlatoon === pNum;

                    return (
                      <div
                        key={pNum}
                        className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${p.active ? "bg-[#12271c] border-[#1e382b]" : "bg-red-950/20 border-red-900/40"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
                                PLATOON {pNum}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                  }`}
                              >
                                {p.active ? "Active" : "SUSPENDED"}
                              </span>
                            </div>
                            <h3 className="text-sm font-bold text-white mt-1.5">{p.name}</h3>
                          </div>

                          {/* Shutdown toggle */}
                          <button
                            onClick={() => handleUpdatePlatoon(pNum, undefined, !p.active)}
                            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${p.active
                              ? "bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800"
                              : "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800"
                              }`}
                            title={p.active ? "Temporarily Shut Down Inspector" : "Re-activate Inspector"}
                          >
                            {p.active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            <span>{p.active ? "Suspend" : "Activate"}</span>
                          </button>
                        </div>

                        {/* Email Input / Display */}
                        <div className="pt-2 border-t border-[#1e382b]">
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                            Inspector OTP Email:
                          </div>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="email"
                                value={platoonEmailInput}
                                onChange={(e) => setPlatoonEmailInput(e.target.value)}
                                className="flex-1 bg-[#0c1a13] border border-[#1e382b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                              />
                              <button
                                onClick={() => handleUpdatePlatoon(pNum, platoonEmailInput)}
                                className="p-2 bg-[#008751] hover:bg-emerald-600 text-white rounded-lg text-xs"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-semibold text-emerald-400">{p.email}</span>
                              <button
                                onClick={() => {
                                  setEditingPlatoon(pNum);
                                  setPlatoonEmailInput(p.email);
                                }}
                                className="p-1 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= TAB 3: SECRETARIAT SETTINGS ================= */}
            {activeTab === "SECRETARIAT" && data && (
              <div className="max-w-xl mx-auto bg-[#12271c] p-6 rounded-3xl border border-[#1e382b] space-y-4 animate-in fade-in">
                <h2 className="text-base font-bold text-white">Secretariat Configuration</h2>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Secretariat Officer Name:
                    </label>
                    <input
                      type="text"
                      value={data.secretariat.officer_name}
                      disabled
                      className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-xl px-3 py-2 text-xs text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Official Secretariat Email:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={secEmailInput}
                        onChange={(e) => setSecEmailInput(e.target.value)}
                        className="flex-1 bg-[#0c1a13] border border-[#1e382b] rounded-xl px-3 py-2 text-xs text-white"
                      />
                      <button
                        onClick={() => handleUpdateSecretariat(secEmailInput)}
                        className="px-4 py-2 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl"
                      >
                        Save Email
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0c1a13] border border-[#1e382b] mt-4">
                    <div>
                      <div className="text-xs font-bold text-white">Secretariat Access Status</div>
                      <div className="text-[11px] text-slate-400">Enable or suspend secretariat portal logins</div>
                    </div>
                    <button
                      onClick={() => handleUpdateSecretariat(undefined, !data.secretariat.active)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold ${data.secretariat.active
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                    >
                      {data.secretariat.active ? "Active" : "Suspended"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: NOMINAL ROLL / MOCK DATA ================= */}
            {activeTab === "CORPERS" && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Camp Nominal Roll (Mock & Test Database)</h2>
                    <p className="text-xs text-slate-400">
                      Edit or add Corps Members. Put your personal email to test live OTP delivery.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setEditingCorper({
                        state_code: "LA/26C/",
                        full_name: "",
                        email: "",
                        course_of_study: "",
                        institution: "University of Lagos",
                        institution_type: "UNIVERSITY",
                        is_medical: false,
                      })
                    }
                    className="px-4 py-2.5 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md shadow-emerald-950/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Corps Member</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search corper or email..."
                    value={searchCorper}
                    onChange={(e) => setSearchCorper(e.target.value)}
                    className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[#1e382b] bg-[#12271c]">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0a1811] text-slate-400 border-b border-[#1e382b] uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">State Code</th>
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Platoon</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Course / Discipline</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e382b]">
                      {nominalRoll
                        .filter(
                          (c) =>
                            c.full_name.toLowerCase().includes(searchCorper.toLowerCase()) ||
                            c.state_code.toLowerCase().includes(searchCorper.toLowerCase()) ||
                            c.email.toLowerCase().includes(searchCorper.toLowerCase())
                        )
                        .map((c) => (
                          <tr key={c.state_code} className="hover:bg-[#163324]/50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">{c.state_code}</td>
                            <td className="py-3 px-4 font-semibold text-white">{c.full_name}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
                                P{c.platoon}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">{c.email}</td>
                            <td className="py-3 px-4">
                              <span>{c.course_of_study}</span>
                              {c.is_medical && (
                                <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-900/60 text-blue-200">
                                  Medical
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-400">{c.institution_type}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={loadingDossierCode === c.state_code}
                                  onClick={async () => {
                                    setLoadingDossierCode(c.state_code);
                                    try {
                                      const res = await fetch(`/api/corpers/profile?stateCode=${encodeURIComponent(c.state_code)}`);
                                      const d = await res.json();
                                      if (d.success) {
                                        setInspectingDossier({ corpsMember: d.corpsMember, submission: d.submission });
                                      } else {
                                        alert(d.error || "Failed to load documents.");
                                      }
                                    } catch (err: any) {
                                      alert("Network error: " + err.message);
                                    } finally {
                                      setLoadingDossierCode(null);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{loadingDossierCode === c.state_code ? "Loading..." : "View Docs"}</span>
                                </button>
                                <button
                                  onClick={() => setEditingCorper(c)}
                                  className="text-slate-400 hover:text-white font-semibold text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ================= TAB 5: AUDIT LOGS ================= */}
            {activeTab === "LOGS" && data && (
              <div className="space-y-4 animate-in fade-in">
                <h2 className="text-base font-bold text-white">Audit Trail (Last 30 Events)</h2>
                <div className="space-y-2">
                  {data.recentAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-[#12271c] border border-[#1e382b] flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400">{log.action}</span>
                          <span className="text-[10px] text-slate-400">by {log.actor}</span>
                        </div>
                        <div className="text-slate-300 text-[11px]">{log.details}</div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Corper Modal */}
            {editingCorper && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                <div className="relative w-full max-w-lg bg-[#12271c] border border-[#1e382b] rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-bold text-white">Edit / Add Corps Member</h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                        State Code (last digit maps to Platoon):
                      </label>
                      <input
                        type="text"
                        value={editingCorper.state_code || ""}
                        onChange={(e) => setEditingCorper({ ...editingCorper, state_code: e.target.value.toUpperCase() })}
                        className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-lg px-3 py-2 font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Full Name:
                      </label>
                      <input
                        type="text"
                        value={editingCorper.full_name || ""}
                        onChange={(e) => setEditingCorper({ ...editingCorper, full_name: e.target.value })}
                        className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Registered Email (Where OTP is delivered):
                      </label>
                      <input
                        type="email"
                        value={editingCorper.email || ""}
                        onChange={(e) => setEditingCorper({ ...editingCorper, email: e.target.value })}
                        className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Course of Study:
                      </label>
                      <input
                        type="text"
                        value={editingCorper.course_of_study || ""}
                        onChange={(e) => setEditingCorper({ ...editingCorper, course_of_study: e.target.value })}
                        className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-lg px-3 py-2 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Institution Type:
                        </label>
                        <select
                          value={editingCorper.institution_type || "UNIVERSITY"}
                          onChange={(e) =>
                            setEditingCorper({ ...editingCorper, institution_type: e.target.value as any })
                          }
                          className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-lg px-3 py-2 text-white"
                        >
                          <option value="UNIVERSITY">University</option>
                          <option value="POLYTECHNIC">Polytechnic (Requires ND+HND)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Medical Personnel?
                        </label>
                        <select
                          value={editingCorper.is_medical ? "YES" : "NO"}
                          onChange={(e) =>
                            setEditingCorper({ ...editingCorper, is_medical: e.target.value === "YES" })
                          }
                          className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-lg px-3 py-2 text-white"
                        >
                          <option value="NO">No</option>
                          <option value="YES">Yes (Exeat Blocked)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-[#1e382b]">
                    <button
                      onClick={() => setEditingCorper(null)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCorper}
                      className="px-5 py-2 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl"
                    >
                      Save to Database
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Full Document Dossier Inspection Modal for Admin */}
            {inspectingDossier && (
              <DocumentDossierModal
                corpsMember={inspectingDossier.corpsMember}
                submission={inspectingDossier.submission}
                viewerRole="CAMP_ADMIN"
                onClose={() => setInspectingDossier(null)}
                onUpdated={() => {
                  fetchNominalRoll();
                  fetchAdminOverview();
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
