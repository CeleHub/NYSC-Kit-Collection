"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import DocumentDossierModal from "@/components/DocumentDossierModal";
import SystemToast from "@/components/SystemToast";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  FileText,
  Eye,
  Check,
  X,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";

export default function SecretariatPortal() {
  const [authState, setAuthState] = useState<"LOGIN" | "OTP" | "LOGGED_IN">("LOGIN");
  const [inputEmail, setInputEmail] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Queue state
  const [queueData, setQueueData] = useState<{
    secretariat: { email: string; officer_name: string };
    stats: { totalRequests: number; pendingCount: number; deliveredCount: number; rejectedCount: number };
    queue: any[];
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [previewExeatItem, setPreviewExeatItem] = useState<any | null>(null);
  const [inspectingDossier, setInspectingDossier] = useState<{ corpsMember: any; submission: any } | null>(null);

  const [toast, setToast] = useState<{
    message: string | null;
    type?: "success" | "error" | "info";
  }>({
    message: null,
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  };

  // Restore session or pending OTP on initial mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedSession = localStorage.getItem("nysc_secretariat_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.email) setInputEmail(parsed.email);
        setAuthState("LOGGED_IN");
        fetchQueue();
        return;
      } catch (e) {
        console.error("Secretariat session restore error:", e);
      }
    }

    const pending = localStorage.getItem("nysc_secretariat_auth_pending");
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        const ageMs = Date.now() - (parsed.timestamp || 0);
        if (parsed.email && ageMs < 15 * 60 * 1000) {
          setInputEmail(parsed.email);
          setTargetEmail(parsed.targetEmail || parsed.email);
          setMaskedEmail(parsed.maskedEmail || "");
          setDevOtp(parsed.devOtp || null);
          setAuthState("OTP");
        } else {
          localStorage.removeItem("nysc_secretariat_auth_pending");
        }
      } catch (e) {
        console.error("Secretariat pending restore error:", e);
      }
    }
  }, []);

  // 1. Request OTP
  const handleRequestOtp = async (overrideEmail?: string) => {
    const emailToUse = (overrideEmail || inputEmail).trim();
    if (!emailToUse) {
      setAuthError("Please enter your Secretariat official email address.");
      return;
    }

    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "SECRETARIAT", email: emailToUse }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || "This email is not authorized for the Camp Secretariat. Please contact the Camp Admin to configure your email.");
        setLoading(false);
        return;
      }
      setTargetEmail(data.email);
      setMaskedEmail(data.maskedEmail);
      setDevOtp(data.devOtp);
      setAuthState("OTP");

      localStorage.setItem(
        "nysc_secretariat_auth_pending",
        JSON.stringify({
          email: emailToUse,
          targetEmail: data.email,
          maskedEmail: data.maskedEmail,
          devOtp: data.devOtp,
          timestamp: Date.now(),
        })
      );
    } catch (err: any) {
      setAuthError(err.message || "Network error.");
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
          role: "SECRETARIAT",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || "Invalid code.");
        setLoading(false);
        return;
      }

      await fetchQueue();
      setAuthState("LOGGED_IN");

      localStorage.removeItem("nysc_secretariat_auth_pending");
      localStorage.setItem(
        "nysc_secretariat_session",
        JSON.stringify({
          email: targetEmail,
          timestamp: Date.now(),
        })
      );
    } catch (err: any) {
      setAuthError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

    // 3. Fetch Secretariat Queue
    const fetchQueue = async () => {
      try {
        const res = await fetch("/api/secretariat/queue");
        const data = await res.json();
        if (data.success) {
          setQueueData(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    // 4. Action Exeat
    const handleAction = async (stateCode: string, action: "DELIVER" | "REJECT") => {
      const notes = prompt(
        action === "DELIVER"
          ? "Enter any departure / return notes (Optional):"
          : "Enter reason for rejection:"
      );
      if (action === "REJECT" && !notes) return;

      try {
        const res = await fetch("/api/secretariat/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stateCode, action, notes }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message || "Exeat updated successfully.", "success");
          fetchQueue();
          setPreviewExeatItem(null);
        } else {
          showToast(data.error || "Action failed.", "error");
        }
      } catch (err: any) {
        showToast(err.message || "Network error.", "error");
      }
    };

    return (
      <div className="min-h-screen flex flex-col bg-[#0c1a13] text-slate-100">
        <Navbar
          userRole={authState === "LOGGED_IN" ? "SECRETARIAT" : undefined}
          userName={queueData?.secretariat?.officer_name || "Secretariat Desk"}
          onLogout={() => {
            localStorage.removeItem("nysc_secretariat_session");
            localStorage.removeItem("nysc_secretariat_auth_pending");
            setAuthState("LOGIN");
            setQueueData(null);
          }}
        />

        <main className="flex-1 pb-16">
          {authState !== "LOGGED_IN" && (
            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
              <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-2xl space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 rounded-2xl bg-white shadow-md border border-emerald-500/20 mb-1">
                    <img src="/assets/NYSC_LOGO.svg" alt="NYSC Crest" width={48} height={48} className="w-12 h-12 object-contain" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Secretariat Exeat Desk
                  </h1>
                  <p className="text-xs text-slate-400">
                    Camp Directorate portal for reviewing and issuing approved exeat passes.
                  </p>
                </div>

                {authError && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200">
                    {authError}
                  </div>
                )}

                {authState === "LOGIN" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Secretariat Official Email:
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. secretariat.lagos@nysc.gov.ng"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                      className="w-full px-4 py-3.5 bg-[#0c1a13] border border-[#1e382b] focus:border-emerald-500 rounded-2xl text-white text-sm outline-none transition-all placeholder:text-slate-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Must match the Directorate email configured by Camp Admin.
                    </p>
                  </div>

                  <button
                    onClick={() => handleRequestOtp()}
                    disabled={loading || !inputEmail.trim()}
                    className="w-full py-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <span>Request Secretariat OTP</span>
                  </button>
                </div>
                )}

                {authState === "OTP" && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-2xl bg-[#0c1a13] border border-[#1e382b] text-xs space-y-1">
                      <div className="text-slate-400">OTP sent to Secretariat Email:</div>
                      <div className="font-mono font-bold text-emerald-400 text-sm">{maskedEmail}</div>
                      <div className="text-[11px] text-slate-500">Check your inbox. Valid for 5 minutes.</div>
                    </div>

                    {devOtp && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-300">Emergency Security Code:</span>
                          <span className="font-mono font-bold text-white bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-500/40 text-sm">
                            {devOtp}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-200/80">
                          Render Free Tier blocked outbound SMTP. Use this emergency code to enter:
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpInput(devOtp);
                            handleVerifyOtp(devOtp);
                          }}
                          className="w-full py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md"
                        >
                          Autofill & Enter Portal
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-Digit OTP"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                      className="w-full bg-[#0c1a13] border-2 border-[#1e382b] focus:border-[#008751] rounded-2xl px-4 py-3.5 text-center text-xl font-mono tracking-widest font-bold text-white placeholder-slate-600 focus:outline-none"
                    />

                    <button
                      onClick={() => handleVerifyOtp()}
                      disabled={loading || otpInput.length < 6}
                      className="w-full py-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <span>Enter Secretariat Portal</span>
                      <ShieldCheck className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= SECRETARIAT DASHBOARD ================= */}
          {authState === "LOGGED_IN" && queueData && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-block px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs uppercase mb-1.5">
                      CAMP SECRETARIAT DIRECTORATE
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      Camp Exeat Authorization Desk
                    </h1>
                    <p className="text-xs text-slate-400">
                      Review minuted exeat slips. Corpers must still have their kits verified & collected before leaving camp.
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-[#0c1a13] p-4 rounded-2xl border border-[#1e382b]">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider">Total Applications</div>
                    <div className="text-2xl font-black text-white mt-1">{queueData.stats.totalRequests}</div>
                  </div>
                  <div className="bg-[#0c1a13] p-4 rounded-2xl border border-amber-900/50">
                    <div className="text-[11px] text-amber-400 uppercase tracking-wider font-bold">
                      Pending Issuance
                    </div>
                    <div className="text-2xl font-black text-amber-400 mt-1">{queueData.stats.pendingCount}</div>
                  </div>
                  <div className="bg-[#0c1a13] p-4 rounded-2xl border border-emerald-900/50">
                    <div className="text-[11px] text-emerald-400 uppercase tracking-wider font-bold">
                      Issued / Delivered
                    </div>
                    <div className="text-2xl font-black text-emerald-400 mt-1">{queueData.stats.deliveredCount}</div>
                  </div>
                  <div className="bg-[#0c1a13] p-4 rounded-2xl border border-red-900/50">
                    <div className="text-[11px] text-red-400 uppercase tracking-wider font-bold">Rejected</div>
                    <div className="text-2xl font-black text-red-400 mt-1">{queueData.stats.rejectedCount}</div>
                  </div>
                </div>
              </div>

              {/* Exeat Applications Queue */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-bold text-white">Submitted Exeat Slips</h2>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search name or state code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#0c1a13] border border-[#1e382b] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                {queueData.queue.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    No Corps Members have uploaded Exeat applications yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {queueData.queue
                      .filter(
                        (x) =>
                          x.corpsMember.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          x.corpsMember.state_code.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((item) => {
                        const cm = item.corpsMember;
                        const ex = item.exeat;
                        const kitCollected = item.kitCollected;

                        return (
                          <div
                            key={cm.state_code}
                            className="bg-[#12271c] border border-[#1e382b] rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
                                  PLATOON {cm.platoon}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ex.status === "DELIVERED"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      : ex.status === "REJECTED"
                                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    }`}
                                >
                                  {ex.status === "DELIVERED"
                                    ? "✓ Issued"
                                    : ex.status === "REJECTED"
                                      ? "Rejected"
                                      : "Pending Approval"}
                                </span>
                              </div>

                              <div>
                                <div className="text-sm font-bold text-white">{cm.full_name}</div>
                                <div className="text-xs font-mono font-bold text-emerald-400">
                                  {cm.state_code} • {cm.phone}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{cm.course_of_study}</div>
                              </div>

                              {/* CRITICAL KIT PRECONDITION BADGE */}
                              <div
                                className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${kitCollected
                                    ? "bg-emerald-950/30 border-emerald-800 text-emerald-300"
                                    : "bg-red-950/40 border-red-700 text-red-200"
                                  }`}
                              >
                                {kitCollected ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="font-semibold text-[11px]">
                                      Kit Collected from Platoon {cm.platoon} Desk (Cleared)
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                    <span className="font-bold text-[11px]">
                                      KIT PENDING: Must collect kit before departure!
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-3 border-t border-[#1e382b] flex items-center gap-2">
                              <button
                                onClick={() => setPreviewExeatItem(item)}
                                className="p-2 rounded-xl bg-[#0c1a13] hover:bg-slate-800 text-slate-300 text-xs flex items-center gap-1 border border-[#1e382b]"
                                title="Inspect Minuted Slip"
                              >
                                <Eye className="w-4 h-4 text-emerald-400" />
                                <span>View Slip</span>
                              </button>

                              {ex.status === "PENDING_SECRETARIAT" && (
                                <>
                                  <button
                                    onClick={() => handleAction(cm.state_code, "DELIVER")}
                                    className="flex-1 py-2 px-3 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Issue Exeat</span>
                                  </button>
                                  <button
                                    onClick={() => handleAction(cm.state_code, "REJECT")}
                                    className="py-2 px-3 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800 font-bold text-xs rounded-xl"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Slip Preview Modal */}
        {previewExeatItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="relative w-full max-w-lg bg-[#12271c] border border-[#1e382b] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1e382b] pb-3">
                <h3 className="text-base font-bold text-white">
                  Exeat Slip: {previewExeatItem.corpsMember.full_name}
                </h3>
                <button onClick={() => setPreviewExeatItem(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-2 bg-[#0c1a13] rounded-xl border border-[#1e382b] flex items-center justify-center min-h-[300px]">
                <img
                  src={previewExeatItem.exeat.fileUrl || "/assets/NYSC_LOGO.svg"}
                  alt="Exeat preview"
                  className="max-h-[380px] w-auto max-w-full object-contain rounded-lg shadow-md"
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                {previewExeatItem.exeat.fileUrl && (
                  <a
                    href={previewExeatItem.exeat.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Full Screen
                  </a>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => {
                      setInspectingDossier({
                        corpsMember: previewExeatItem.corpsMember,
                        submission: previewExeatItem.submission,
                      });
                      setPreviewExeatItem(null);
                    }}
                    className="px-3 py-2 bg-[#0d2618] hover:bg-[#153a25] text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-500/30 flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" /> View All Docs
                  </button>
                  <button
                    onClick={() => setPreviewExeatItem(null)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Document Dossier Inspection Modal for Secretariat */}
        {inspectingDossier && (
          <DocumentDossierModal
            corpsMember={inspectingDossier.corpsMember}
            submission={inspectingDossier.submission}
            viewerRole="SECRETARIAT"
            onClose={() => setInspectingDossier(null)}
            onUpdated={() => fetchQueue()}
          />
        )}

        {/* Styled System Toast Notification */}
        <SystemToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: null })}
        />
      </div>
    );
  }
