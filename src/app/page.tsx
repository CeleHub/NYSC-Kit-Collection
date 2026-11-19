"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import CamScannerModal from "@/components/CamScannerModal";
import PassportCaptureModal from "@/components/PassportCaptureModal";
import SampleDocumentModal from "@/components/SampleDocumentModal";
import KitPassModal from "@/components/KitPassModal";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  Upload,
  Camera,
  Eye,
  AlertTriangle,
  QrCode,
  ArrowRight,
  FileText,
  UserCheck,
  Sparkles,
  User,
} from "lucide-react";
import { CorpsMember, DocumentDefinition, SubmissionRecord, DocumentKey } from "@/lib/types";

export default function CorpsMemberPortal() {
  // Auth state
  const [authState, setAuthState] = useState<"STATE_CODE" | "OTP" | "LOGGED_IN">("STATE_CODE");
  const [stateCodeInput, setStateCodeInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(5);
  const [loading, setLoading] = useState(false);

  // Corper data state
  const [corpsMember, setCorpsMember] = useState<CorpsMember | null>(null);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);
  const [docDefs, setDocDefs] = useState<DocumentDefinition[]>([]);

  // Modals state
  const [activeCamDoc, setActiveCamDoc] = useState<DocumentDefinition | null>(null);
  const [activeSampleDoc, setActiveSampleDoc] = useState<DocumentDefinition | null>(null);
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [kitPassModalOpen, setKitPassModalOpen] = useState(false);

  // 1. Request OTP
  const handleRequestOtp = async (codeToUse?: string) => {
    const code = (codeToUse || stateCodeInput).trim();
    if (!code) return;

    setLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CORPS_MEMBER", stateCode: code }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.error || "Failed to find state code.");
        setLoading(false);
        return;
      }

      setTargetEmail(data.email);
      setMaskedEmail(data.maskedEmail);
      setDevOtp(data.devOtp);
      setStateCodeInput(code.toUpperCase());
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
          role: "CORPS_MEMBER",
          stateCode: stateCodeInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setAuthError(data.error || "Invalid verification code.");
        if (data.remainingAttempts !== undefined) {
          setAttemptsRemaining(data.remainingAttempts);
        }
        setLoading(false);
        return;
      }

      // Success! Fetch full profile
      setCorpsMember(data.corpsMember);
      setSubmission(data.submission);
      await fetchProfile(stateCodeInput);
      setAuthState("LOGGED_IN");
    } catch (err: any) {
      setAuthError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Profile & Document Definitions
  const fetchProfile = async (code: string) => {
    try {
      const res = await fetch(`/api/corpers/profile?stateCode=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (data.success) {
        setCorpsMember(data.corpsMember);
        setSubmission(data.submission);
        setDocDefs(data.documentDefinitions);
      }
    } catch (err) {
      console.error("fetchProfile error:", err);
    }
  };

  // Handle successful document upload
  const handleUploadSuccess = (docKey: string, result: any) => {
    if (result.submission) {
      setSubmission(result.submission);
      if (result.kitStatus === "READY_FOR_KIT") {
        setKitPassModalOpen(true);
      }
    }
    fetchProfile(stateCodeInput);
  };

  // Calculate upload progress
  const mandatoryDocs = docDefs.filter((d) => d.key !== "exeat");
  const completedDocsCount = mandatoryDocs.filter((d) => {
    const doc = submission?.documents[d.key];
    return doc && (doc.status === "AUTO_VERIFIED" || doc.status === "PENDING_PI_REVIEW" || doc.status === "APPROVED");
  }).length;
  const progressPercent = mandatoryDocs.length > 0 ? Math.round((completedDocsCount / mandatoryDocs.length) * 100) : 0;
  const isReadyForKit = submission?.kit_status === "READY_FOR_KIT" || submission?.kit_status === "KIT_DISBURSED";

  return (
    <div className="min-h-screen flex flex-col bg-[#0c1a13] text-slate-100">
      <Navbar
        userRole={corpsMember ? "CORPS_MEMBER" : undefined}
        userName={corpsMember?.full_name}
        stateCode={corpsMember?.state_code}
        platoon={corpsMember?.platoon}
        onLogout={() => {
          setAuthState("STATE_CODE");
          setCorpsMember(null);
          setSubmission(null);
          setStateCodeInput("");
          setOtpInput("");
        }}
      />

      <main className="flex-1 pb-16">
        {/* ================= STAGE 1 & 2: LOGIN / ONBOARDING ================= */}
        {authState !== "LOGGED_IN" && (
          <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center p-4 overflow-hidden">
            {/* Subtle NYSC background decoration */}
            <div className="absolute inset-0 opacity-10 pointer-events-none flex items-center justify-center">
              <img src="/assets/NYSC_LOGO.svg" alt="Watermark" width={400} height={400} className="w-[320px] sm:w-[500px] h-auto max-h-[500px] object-contain pointer-events-none select-none" />
            </div>

            <div className="relative w-full max-w-md glass-panel p-6 sm:p-8 rounded-3xl border border-[#1e382b] shadow-2xl space-y-6">
              {/* Header / Crest */}
              <div className="text-center space-y-2">
                <div className="inline-flex p-3 rounded-2xl bg-white shadow-md border border-emerald-500/20 mb-1">
                  <img src="/assets/NYSC_LOGO.svg" alt="NYSC Crest" width={48} height={48} className="w-12 h-12 object-contain" />
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  NYSC Kit Collection Portal
                </h1>
                <p className="text-xs text-slate-400">
                  Submit documents remotely & pick up your kit from your Platoon Inspector without queuing.
                </p>
              </div>

              {/* Error Box */}
              {authError && (
                <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>{authError}</div>
                </div>
              )}

              {/* Step 1: Input State Code */}
              {authState === "STATE_CODE" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Enter Your NYSC State Code:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. LA/26C/18388"
                        value={stateCodeInput}
                        onChange={(e) => setStateCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                        className="w-full bg-[#0c1a13] border-2 border-[#1e382b] focus:border-[#008751] rounded-2xl px-4 py-3.5 text-sm font-mono tracking-wider font-bold text-white placeholder-slate-500 focus:outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Your platoon will be automatically derived from your State Code.
                    </p>
                  </div>

                  <button
                    onClick={() => handleRequestOtp()}
                    disabled={loading || !stateCodeInput.trim()}
                    className="w-full py-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <span>Proceed to Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Step 2: OTP Verification */}
              {authState === "OTP" && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-3.5 rounded-2xl bg-[#0c1a13] border border-[#1e382b] text-xs space-y-1">
                    <div className="text-slate-400">Verification code sent to your email:</div>
                    <div className="font-mono font-bold text-emerald-400 text-sm">{maskedEmail}</div>
                    <div className="text-[11px] text-slate-500">Check your inbox for the 6-digit code. Valid for 5 minutes.</div>
                  </div>

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
                    <div className="text-[11px] text-slate-400 mt-1.5 flex justify-between">
                      <span>Attempts remaining: {attemptsRemaining}/5</span>
                      <span>5 min expiry</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleVerifyOtp()}
                    disabled={loading || otpInput.length < 6}
                    className="w-full py-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <span>Verify & Enter Portal</span>
                    <ShieldCheck className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setAuthState("STATE_CODE");
                      setAuthError(null);
                    }}
                    className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
                  >
                    ← Change State Code
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STAGE 3: LOGGED IN CORPS MEMBER WORKSPACE ================= */}
        {authState === "LOGGED_IN" && corpsMember && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
            {/* Top Member Card (Matching portal.nysc.org.ng/nysc1/corphome.aspx) */}
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[#1e382b] shadow-xl relative overflow-hidden">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                {/* Left Profile Details */}
                <div className="space-y-4 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {corpsMember.batch}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-sm">
                      PLATOON {corpsMember.platoon}
                    </span>
                    {corpsMember.is_medical && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-950/50 text-blue-300 border border-blue-700/50">
                        Medical Personnel
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
                      {corpsMember.full_name}
                    </h1>
                    <p className="text-xs sm:text-sm text-emerald-400 font-mono font-semibold mt-0.5">
                      {corpsMember.state_code} • {corpsMember.call_up_no}
                    </p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="bg-[#0c1a13] p-2.5 rounded-xl border border-[#1e382b]">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Institution</div>
                      <div className="font-semibold text-slate-200 truncate">{corpsMember.institution}</div>
                    </div>
                    <div className="bg-[#0c1a13] p-2.5 rounded-xl border border-[#1e382b]">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Course of Study</div>
                      <div className="font-semibold text-slate-200 truncate">{corpsMember.course_of_study}</div>
                    </div>
                    <div className="bg-[#0c1a13] p-2.5 rounded-xl border border-[#1e382b]">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">Assigned Platoon</div>
                      <div className="font-bold text-emerald-400">Platoon {corpsMember.platoon} Inspector</div>
                    </div>
                  </div>
                </div>

                {/* Right: Passport Avatar & Quick CTA */}
                <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-[#1e382b] pt-4 lg:pt-0 lg:pl-6">
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#07130e] border-2 border-emerald-500 shadow-xl shrink-0 flex items-center justify-center">
                    {submission?.documents["passport"]?.fileUrl ? (
                      <img
                        src={submission.documents["passport"].fileUrl}
                        alt={corpsMember.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-2 text-slate-400">
                        <User className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500 mb-0.5" />
                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">No Photo</span>
                        <span className="text-[8px] text-slate-500">Tap to Snap</span>
                      </div>
                    )}
                    <button
                      onClick={() => setPassportModalOpen(true)}
                      className="absolute bottom-1 right-1 p-2 rounded-lg bg-[#008751] hover:bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-md transition-all cursor-pointer"
                      title="Upload / Snap Passport"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Pass Button if ready */}
                  {isReadyForKit && (
                    <button
                      onClick={() => setKitPassModalOpen(true)}
                      className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-[#008751] to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/60 animate-bounce transition-all"
                    >
                      <QrCode className="w-5 h-5" />
                      <span>View Kit Collection Pass</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6 pt-5 border-t border-[#1e382b] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    Document Verification Progress ({completedDocsCount} of {mandatoryDocs.length} Completed)
                  </span>
                  <span className={progressPercent === 100 ? "text-emerald-400 font-bold" : "text-amber-400"}>
                    {progressPercent}% Complete
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#0c1a13] border border-[#1e382b] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      progressPercent === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-amber-500 to-[#008751]"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Official Notices (Matching desktop portal aesthetic) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#842029]/15 border border-[#842029]/40 text-xs text-red-200 space-y-1">
                <div className="font-bold text-red-300 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" /> Important Camp Notice - Batch C
                </div>
                <p className="text-[11px] text-red-200/90 leading-relaxed">
                  Documents submitted are legally binding and permanent. Once accepted, they are locked. Please inspect your scans with the CamScanner preview before confirming.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#0f5132]/15 border border-[#0f5132]/40 text-xs text-emerald-200 space-y-1">
                <div className="font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Kit Collection Protocol
                </div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  As soon as all 11 core documents are uploaded, your digital pass with a QR code and PIN is instantly generated. Simply present it to Platoon {corpsMember.platoon} Inspector.
                </p>
              </div>
            </div>

            {/* Document Upload Grid (12 Items) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Required Camp Credentials</h2>
                  <p className="text-xs text-slate-400">
                    Upload or snap each document in sequence using the CamScanner engine.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docDefs.map((doc, idx) => {
                  const uploaded = submission?.documents[doc.key];
                  const isVerified = uploaded?.status === "AUTO_VERIFIED" || uploaded?.status === "APPROVED";
                  const isPendingReview = uploaded?.status === "PENDING_PI_REVIEW";
                  const isExeat = doc.key === "exeat";
                  const isMedicalBlocked = isExeat && corpsMember.is_medical && !submission?.exeat?.unlockedByPi;

                  return (
                    <div
                      key={doc.key}
                      className={`relative p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isVerified
                          ? "bg-[#0d2116] border-emerald-700/60 shadow-sm"
                          : isPendingReview
                          ? "bg-[#16291e] border-amber-600/50"
                          : "bg-[#12271c] border-[#1e382b] hover:border-emerald-800/60"
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Card Top: Number & Category */}
                        <div className="flex items-center justify-between">
                          <span className="w-6 h-6 rounded-full bg-[#0c1a13] text-[11px] font-bold text-slate-300 flex items-center justify-center border border-[#1e382b]">
                            {idx + 1}
                          </span>

                          {/* Status Badge */}
                          {isVerified ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Auto-Verified
                            </span>
                          ) : isPendingReview ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Inspector Review
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              Pending Upload
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-sm font-bold text-white leading-tight">{doc.title}</h3>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">{doc.shortDesc}</p>
                        </div>

                        {/* Medical exeat warning */}
                        {isMedicalBlocked && (
                          <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/50 text-[11px] text-blue-200 space-y-1">
                            <span className="font-bold">Medical Restriction:</span> Exeat submissions are blocked for doctors & nurses. Must be unlocked by your Platoon Inspector.
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="pt-4 mt-4 border-t border-[#1e382b] flex items-center gap-2">
                        {doc.key === "passport" ? (
                          <button
                            onClick={() => setPassportModalOpen(true)}
                            className="flex-1 py-2 px-3 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{uploaded ? "Change Passport" : "Snap Passport"}</span>
                          </button>
                        ) : isVerified && !uploaded?.canReupload ? (
                          <div className="flex-1 py-2 px-3 bg-[#0c1a13] text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-900/50 flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Locked & Compliant</span>
                          </div>
                        ) : isMedicalBlocked ? (
                          <button
                            disabled
                            className="flex-1 py-2 px-3 bg-[#0c1a13] text-slate-500 text-xs font-semibold rounded-xl border border-[#1e382b] opacity-60 cursor-not-allowed"
                          >
                            Locked by Rule
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveCamDoc(doc)}
                            className="flex-1 py-2 px-3 bg-[#008751] hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{uploaded ? "Re-upload" : "CamScanner Upload"}</span>
                          </button>
                        )}

                        <button
                          onClick={() => setActiveSampleDoc(doc)}
                          className="p-2 rounded-xl bg-[#0c1a13] hover:bg-[#163324] text-slate-400 hover:text-emerald-400 border border-[#1e382b] transition-all"
                          title="View Sample Template"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CamScanner Engine Modal */}
      {activeCamDoc && corpsMember && (
        <CamScannerModal
          docDef={activeCamDoc}
          stateCode={corpsMember.state_code}
          onClose={() => setActiveCamDoc(null)}
          onUploadSuccess={handleUploadSuccess}
        />
      )}

      {/* Passport Capture Modal */}
      {passportModalOpen && (
        <PassportCaptureModal
          onClose={() => setPassportModalOpen(false)}
          onConfirm={async (fileDataUrl, fileName) => {
            if (!corpsMember) return;
            const res = await fetch("/api/corpers/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stateCode: corpsMember.state_code,
                documentKey: "passport",
                fileName,
                fileUrl: fileDataUrl,
                extractedText: "Passport Photograph Neutral Expression Ears Visible",
                imageWidth: 480,
                imageHeight: 480,
                fileSizeBytes: 120000,
              }),
            });
            const data = await res.json();
            handleUploadSuccess("passport", data);
          }}
        />
      )}

      {/* Sample Document Viewer Modal */}
      {activeSampleDoc && (
        <SampleDocumentModal docDef={activeSampleDoc} onClose={() => setActiveSampleDoc(null)} />
      )}

      {/* Kit Collection Pass Modal */}
      {kitPassModalOpen && corpsMember && submission && (
        <KitPassModal
          corpsMember={corpsMember}
          submission={submission}
          onClose={() => setKitPassModalOpen(false)}
        />
      )}

      {/* Subtle Footer with Official Portals */}
      <footer className="border-t border-[#1e382b] bg-[#0a1811] py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/assets/NYSC_LOGO.svg" alt="NYSC Logo" width={20} height={20} className="w-5 h-5 object-contain" />
            <span>National Youth Service Corps • Orientation Camp Kit Automation System</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <a href="/inspector" className="text-emerald-400 hover:text-emerald-300">
              Platoon Inspector Portal →
            </a>
            <a href="/secretariat" className="text-emerald-400 hover:text-emerald-300">
              Secretariat Exeat Desk →
            </a>
            <a href="/admin" className="text-slate-400 hover:text-white">
              Camp Admin Portal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
