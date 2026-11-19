"use client";

import { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  ExternalLink,
  ShieldCheck,
  User,
  PackageCheck,
  FileText,
  RefreshCw,
  Check,
  Ban,
  Unlock,
  Download,
} from "lucide-react";
import { CorpsMember, SubmissionRecord, DocumentKey } from "@/lib/types";
import { DOCUMENT_DEFINITIONS } from "@/lib/constants";
import { generateA4Pdf } from "@/lib/camscanner";

interface DocumentDossierModalProps {
  corpsMember: CorpsMember;
  submission: SubmissionRecord | null;
  viewerRole: "CAMP_ADMIN" | "PLATOON_INSPECTOR" | "SECRETARIAT";
  inspectorPlatoon?: number;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function DocumentDossierModal({
  corpsMember,
  submission,
  viewerRole,
  inspectorPlatoon,
  onClose,
  onUpdated,
}: DocumentDossierModalProps) {
  // Get applicable documents for this corper
  const applicableDocDefs = DOCUMENT_DEFINITIONS.filter((doc) => {
    if (doc.key === "school_certificate_hnd") {
      return corpsMember.institution_type === "POLYTECHNIC";
    }
    return true;
  });

  // Default to first document or passport
  const [selectedKey, setSelectedKey] = useState<string>("passport");
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const currentDocDef = applicableDocDefs.find((d) => d.key === selectedKey) || applicableDocDefs[0];
  const uploadedDoc = submission?.documents?.[selectedKey];

  // Check if Exeat is uploaded
  const hasExeat = submission?.exeat && submission.exeat.status !== "NONE";
  const exeatRecord = submission?.exeat;

  const isSelectedDocExeat = selectedKey === "exeat";
  const activeFileUrl = isSelectedDocExeat
    ? exeatRecord?.fileUrl || ""
    : uploadedDoc?.fileUrl || "";

  // Handle Download Official PDF
  const handleDownloadPdf = () => {
    if (!activeFileUrl) return;
    try {
      let pdfDataUri = uploadedDoc?.pdfUrl;
      if (!pdfDataUri || !pdfDataUri.startsWith("data:application/pdf")) {
        pdfDataUri = generateA4Pdf(activeFileUrl, currentDocDef.title);
      }
      const a = document.createElement("a");
      a.href = pdfDataUri;
      a.download = `${corpsMember.state_code.replace(/\//g, "_")}_${selectedKey}_A4.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      alert("Error generating PDF: " + (e?.message || e));
    }
  };

  // Handle Approve or Request Re-upload
  const handleToggleReupload = async (docKey: string, allowReupload: boolean) => {
    setActionLoading(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/inspector/toggle-reupload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode: corpsMember.state_code,
          documentKey: docKey,
          canReupload: allowReupload,
          inspectorPlatoon: inspectorPlatoon || corpsMember.platoon,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage(allowReupload ? "Re-upload unlocked for Corper." : "Document approved & locked.");
        if (onUpdated) onUpdated();
      } else {
        alert(data.error || "Failed to update document status.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Disburse Kit
  const handleDisburseKit = async () => {
    if (!confirm(`Confirm kit disbursement to ${corpsMember.full_name} (${corpsMember.state_code})?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/inspector/dispatch-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode: corpsMember.state_code,
          inspectorPlatoon: inspectorPlatoon || corpsMember.platoon,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Kit successfully disbursed to ${corpsMember.full_name}!`);
        if (onUpdated) onUpdated();
        onClose();
      } else {
        alert(data.error || "Failed to disburse kit.");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Count uploaded vs total
  const completedCount = applicableDocDefs.filter((d) => {
    const doc = submission?.documents?.[d.key];
    return doc && (doc.status === "AUTO_VERIFIED" || doc.status === "PENDING_PI_REVIEW" || doc.status === "APPROVED");
  }).length;
  const isReadyForKit = submission?.kit_status === "READY_FOR_KIT";
  const isKitDisbursed = submission?.kit_status === "KIT_DISBURSED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[900px] bg-[#0c1a13] border-2 border-[#1e382b] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#12271c] to-[#0c1a13] border-b border-[#1e382b] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#008751]/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 overflow-hidden">
              {submission?.documents?.passport?.fileUrl ? (
                <img
                  src={submission.documents.passport.fileUrl}
                  alt={corpsMember.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white truncate">
                  {corpsMember.full_name}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
                  Platoon {corpsMember.platoon}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-300">
                  {corpsMember.state_code}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {corpsMember.call_up_no} • {corpsMember.course_of_study} • {corpsMember.institution_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Pill */}
            <span
              className={`hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold items-center gap-1.5 ${
                isKitDisbursed
                  ? "bg-slate-800 text-slate-300 border border-slate-700"
                  : isReadyForKit
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              }`}
            >
              {isKitDisbursed ? "✓ Kit Disbursed" : isReadyForKit ? "Ready for Kit" : `Incomplete (${completedCount}/${applicableDocDefs.length})`}
            </span>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: 2 Columns (Document List + Preview Area) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Left Sidebar: Document List */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-[#1e382b] bg-[#08140e] flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 bg-[#0d2217] border-b border-[#1e382b] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Submitted Documents ({completedCount}/{applicableDocDefs.length})
              </span>
              <span className="text-[11px] text-emerald-400 font-bold">
                {Math.round((completedCount / applicableDocDefs.length) * 100)}%
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {applicableDocDefs.map((docDef) => {
                const doc = submission?.documents?.[docDef.key];
                const isSelected = selectedKey === docDef.key;
                const isUploaded = Boolean(doc && doc.fileUrl);

                return (
                  <button
                    key={docDef.key}
                    onClick={() => {
                      setSelectedKey(docDef.key);
                      setFeedbackMessage(null);
                    }}
                    className={`w-full p-3 rounded-2xl text-left transition-all flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? "bg-[#153424] border border-emerald-500/50 shadow-md"
                        : "bg-[#0c1a13]/60 hover:bg-[#12271c] border border-[#1e382b]/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-slate-200"}`}>
                        {docDef.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {doc ? doc.fileName : "Not yet uploaded"}
                      </div>
                    </div>

                    {/* Status Icon */}
                    <div className="shrink-0">
                      {doc?.status === "APPROVED" || doc?.status === "AUTO_VERIFIED" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Ready
                        </span>
                      ) : doc?.status === "PENDING_PI_REVIEW" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Review
                        </span>
                      ) : doc?.canReupload ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                          Re-upload
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-500">
                          Missing
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Exeat Slot if corper applied */}
              {hasExeat && (
                <button
                  onClick={() => {
                    setSelectedKey("exeat");
                    setFeedbackMessage(null);
                  }}
                  className={`w-full p-3 rounded-2xl text-left transition-all flex items-center justify-between gap-2.5 ${
                    selectedKey === "exeat"
                      ? "bg-[#153424] border border-blue-500/50 shadow-md"
                      : "bg-[#0c1a13]/60 hover:bg-[#12271c] border border-[#1e382b]/60"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-blue-300 truncate">
                      Camp Exeat Application
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      Status: {exeatRecord?.status}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Exeat
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Right Main Area: Document High-Res Viewer & Action Bar */}
          <div className="flex-1 flex flex-col bg-[#07130b] overflow-hidden min-h-0">
            
            {/* Viewer Header */}
            <div className="p-3 sm:p-4 bg-[#0c1a13] border-b border-[#1e382b] flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>{isSelectedDocExeat ? "Camp Exeat Application Slip" : currentDocDef.title}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#008751]/80 text-white font-bold border border-emerald-500/30">
                    Standard A4 PDF
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {isSelectedDocExeat
                    ? "Official signed & minuted exeat application submitted to Secretariat"
                    : currentDocDef.shortDesc}
                </p>
              </div>

              {activeFileUrl && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPdf}
                    className="px-3 py-1.5 rounded-xl bg-[#008751] hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-colors"
                    title="Download Official A4 PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download A4 PDF</span>
                    <span className="sm:hidden">PDF</span>
                  </button>

                  <a
                    href={activeFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Full Screen</span>
                  </a>
                </div>
              )}
            </div>

            {/* Document Image / PDF Display Canvas */}
            <div className="flex-1 p-3 sm:p-5 overflow-y-auto flex items-center justify-center min-h-0 bg-[#050f08]">
              {activeFileUrl ? (
                <div className="relative max-w-full max-h-full flex items-center justify-center p-2 rounded-2xl bg-white shadow-2xl border-4 border-slate-200/20">
                  {/* High-res A4 document display */}
                  <img
                    src={activeFileUrl}
                    alt={currentDocDef.title}
                    className="max-h-[68vh] w-auto max-w-full object-contain rounded-lg shadow-inner"
                  />
                </div>
              ) : (
                <div className="text-center p-8 space-y-3 max-w-md">
                  <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 text-slate-500 flex items-center justify-center mx-auto">
                    <FileText className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">Document Not Yet Uploaded</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {corpsMember.full_name} has not submitted the <strong>{currentDocDef.title}</strong> yet.
                  </p>
                </div>
              )}
            </div>

            {/* Action Bar (For Inspector & Admin) */}
            <div className="p-3 sm:p-4 bg-[#0c1a13] border-t border-[#1e382b] shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Feedback Alert */}
              <div className="text-xs">
                {feedbackMessage ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {feedbackMessage}
                  </span>
                ) : uploadedDoc ? (
                  <span className="text-slate-400 text-[11px]">
                    Uploaded: <strong>{uploadedDoc.uploadedAt ? new Date(uploadedDoc.uploadedAt).toLocaleString() : "Recently"}</strong> • Status:{" "}
                    <strong className="text-white">{uploadedDoc.status}</strong>
                  </span>
                ) : (
                  <span className="text-slate-500 text-[11px]">No submission recorded for this slot.</span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {uploadedDoc && (viewerRole === "PLATOON_INSPECTOR" || viewerRole === "CAMP_ADMIN") && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleToggleReupload(selectedKey, true)}
                      className="flex-1 sm:flex-initial px-3.5 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Request Re-upload
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleToggleReupload(selectedKey, false)}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-[#008751] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Document
                    </button>
                  </>
                )}

                {/* Direct Disburse Kit Button if PI and Ready */}
                {viewerRole === "PLATOON_INSPECTOR" && !isKitDisbursed && isReadyForKit && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleDisburseKit}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    Hand Over Kit
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
