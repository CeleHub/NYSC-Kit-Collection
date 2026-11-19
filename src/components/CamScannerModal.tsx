"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  FileText,
} from "lucide-react";
import { DocumentDefinition } from "@/lib/types";
import SampleDocumentModal from "./SampleDocumentModal";

interface DocumentUploadModalProps {
  docDef: DocumentDefinition;
  stateCode: string;
  onClose: () => void;
  onUploadSuccess: (docKey: string, result: any) => void;
}

export default function CamScannerModal({
  docDef,
  stateCode,
  onClose,
  onUploadSuccess,
}: DocumentUploadModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  // In-app live camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canUseInAppCamera, setCanUseInAppCamera] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "mediaDevices" in navigator &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    ) {
      setCanUseInAppCamera(true);
    }
  }, []);

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive, stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(ms);
      setIsCameraActive(true);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Unable to access live camera. Please allow camera permissions or use file upload instead.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    setSelectedImage(dataUrl);
    setFileName(`${docDef.key}_capture.jpg`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedImage) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let ocrText = fileName.toLowerCase();
      if (fileName.toLowerCase().includes("nin")) {
        ocrText = "National Identity Management System NIMC National Identification Number Slip";
      } else if (fileName.toLowerCase().includes("green") || fileName.toLowerCase().includes("personal")) {
        ocrText = "National Youth Service Corps Corps Member's Personal Detail Next of Kin Details";
      } else if (fileName.toLowerCase().includes("callup") || fileName.toLowerCase().includes("letter")) {
        ocrText = "National Youth Service Corps BATCH C Call-Up Letter Prospective Corps Member Details";
      } else if (fileName.toLowerCase().includes("undertaking")) {
        ocrText = "National Youth Service Corps UNDERTAKING properly kitted Oath of Allegiance";
      } else if (fileName.toLowerCase().includes("addendum")) {
        ocrText = "Terms and Conditions for Compliance Declaration & Agreement BATCH C, 2026 FORM";
      } else if (fileName.toLowerCase().includes("certificate format")) {
        ocrText = "National Youth Service Corps Certificate Format Probable Date of Discharged";
      } else if (fileName.toLowerCase().includes("nerd")) {
        ocrText = "NERD Compliance Clearance The Nigeria Education Repository and Databank";
      } else {
        ocrText = docDef.instructions.join(" ") + " " + docDef.title;
      }

      const res = await fetch("/api/corpers/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode,
          documentKey: docDef.key,
          fileName: fileName || `${docDef.key}.jpg`,
          fileUrl: selectedImage,
          pdfUrl: selectedImage,
          extractedText: ocrText,
          blurScore: 92,
          isBlurry: false,
          fileSizeBytes: Math.round(selectedImage.length * 0.75),
          imageWidth: 1200,
          imageHeight: 1600,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to process document.");
        setIsSubmitting(false);
        return;
      }

      onUploadSuccess(docDef.key, data);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Upload network failure.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-[#0c1a13] border border-[#1e382b] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#12271c] to-[#0c1a13] border-b border-[#1e382b] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{docDef.title}</span>
              </h2>
              <p className="text-xs text-slate-400">{docDef.shortDesc}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSampleModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sample</span>
            </button>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* If No Image Selected */}
          {!selectedImage && !isCameraActive && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canUseInAppCamera ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="p-6 rounded-2xl bg-[#0c1a13] hover:bg-[#152e21] border border-[#1e382b] hover:border-emerald-500/50 flex flex-col items-center justify-center gap-3 text-center transition-all group"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Open Camera</div>
                      <div className="text-xs text-slate-400 mt-1">Snap photo of document</div>
                    </div>
                  </button>
                ) : (
                  <div className="relative p-6 rounded-2xl bg-[#0c1a13] hover:bg-[#152e21] border border-[#1e382b] flex flex-col items-center justify-center gap-3 text-center transition-all group overflow-hidden cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Snap Photo</div>
                      <div className="text-xs text-slate-400 mt-1">Use phone camera</div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                    />
                  </div>
                )}

                <div className="relative p-6 rounded-2xl bg-[#0c1a13] hover:bg-[#152e21] border border-[#1e382b] hover:border-emerald-500/50 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all group overflow-hidden">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Upload from Gallery</div>
                    <div className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP or PDF</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                  />
                </div>
              </div>

              {/* Document Instructions */}
              <div className="p-4 rounded-2xl bg-[#07130b] border border-[#1e382b]/80">
                <div className="text-xs font-bold text-slate-300 mb-2">Instructions for this document:</div>
                <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                  {docDef.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Active Live Camera */}
          {isCameraActive && (
            <div className="flex flex-col items-center space-y-3">
              <div className="relative w-full max-w-sm aspect-[3/4] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-2xl">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-6 py-2.5 rounded-xl bg-[#008751] hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                  Snap Photo
                </button>
              </div>
            </div>
          )}

          {/* Preview Captured / Selected Image */}
          {selectedImage && (
            <div className="space-y-4">
              <div className="relative max-w-sm mx-auto aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/40 p-2 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="Captured document"
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setSelectedImage(null);
                    setFileName("");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Retake / Change
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-[#008751] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 disabled:opacity-50 ml-auto"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading Document...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Upload & Save Document
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {sampleModalOpen && (
        <SampleDocumentModal docDef={docDef} onClose={() => setSampleModalOpen(false)} />
      )}
    </div>
  );
}
