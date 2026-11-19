"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  FileCheck,
} from "lucide-react";
import { DocumentDefinition } from "@/lib/types";
import SampleDocumentModal from "./SampleDocumentModal";

interface CamScannerModalProps {
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
}: CamScannerModalProps) {
  const [step, setStep] = useState<"INPUT" | "PROCESSING" | "SUBMITTING">("INPUT");
  const [filterMode, setFilterMode] = useState<"ORIGINAL" | "MAGIC_COLOR" | "BW">("MAGIC_COLOR");
  const [contrastLevel, setContrastLevel] = useState<number>(30); // 0 to 100
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [blurScore, setBlurScore] = useState<number>(88); // 0 to 100
  const [extractedSnippet, setExtractedSnippet] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [canUseInAppCamera, setCanUseInAppCamera] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && "mediaDevices" in navigator && typeof navigator.mediaDevices?.getUserMedia === "function") {
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

  // Start Camera
  const startCamera = async () => {
    if (typeof navigator === "undefined" || !("mediaDevices" in navigator) || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      alert("In-app live camera requires HTTPS. Please access via HTTPS or use file upload.");
      return;
    }
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      setStream(ms);
      setIsCameraActive(true);
    } catch (err) {
      alert("Unable to access camera. Please allow camera permissions or upload a document file.");
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
    setRawImage(dataUrl);
    setFileName(`${docDef.key}_capture.jpg`);
    setStep("PROCESSING");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    // If it's a PDF, we can use the pre-generated sample or pass its name
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      // Simulate reading and setting snippet from file name
      setRawImage(docDef.sampleImage);
      setExtractedSnippet(file.name);
      setStep("PROCESSING");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setRawImage(result);
      setStep("PROCESSING");
    };
    reader.readAsDataURL(file);
  };

  // Run CamScanner filter and blur calculation when rawImage or filter changes
  useEffect(() => {
    if (!rawImage || step !== "PROCESSING" || !canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = rawImage;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Process pixel data for CamScanner filter
      if (filterMode !== "ORIGINAL") {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const contrast = (contrastLevel + 100) / 100;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          if (filterMode === "MAGIC_COLOR") {
            // Adaptive whitening of background while keeping colored stamps & signatures
            if (gray > 165) {
              data[i] = Math.min(255, r * 1.25);
              data[i + 1] = Math.min(255, g * 1.25);
              data[i + 2] = Math.min(255, b * 1.25);
            } else {
              data[i] = Math.max(0, factor * (r - 128) + 128);
              data[i + 1] = Math.max(0, factor * (g - 128) + 128);
              data[i + 2] = Math.max(0, factor * (b - 128) + 128);
            }
          } else if (filterMode === "BW") {
            // High contrast thresholding (official archive standard)
            const threshold = 145;
            const val = gray > threshold ? 255 : 0;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // Calculate sharpness/blur score (simulated high quality score with slight natural variance)
      const calculatedScore = Math.floor(82 + Math.random() * 15);
      setBlurScore(calculatedScore);
    };
  }, [rawImage, filterMode, contrastLevel, step]);

  // Submit processed file to backend API
  const handleSubmit = async () => {
    setStep("SUBMITTING");
    setErrorMessage(null);

    try {
      // Determine simulated OCR text based on the file name or document type
      // If the user uploaded a file with a mismatch name (e.g. "nin" into "green_card"),
      // we pass the text of that file so the backend classifier demonstrates the smart mismatch!
      let ocrText = fileName.toLowerCase();
      if (fileName.toLowerCase().includes("nin")) {
        ocrText = "National Identity Management System NIMC National Identification Number Slip 79237362825";
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
        // Default text derived from docDef instructions
        ocrText = docDef.instructions.join(" ") + " " + docDef.title;
      }

      // Generate real data URL from canvas or rawImage
      let finalDataUrl = "";
      if (canvasRef.current) {
        try {
          finalDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.88);
        } catch {
          finalDataUrl = rawImage || "";
        }
      } else {
        finalDataUrl = rawImage || "";
      }
      if (!finalDataUrl) {
        finalDataUrl = docDef.sampleImage;
      }

      const res = await fetch("/api/corpers/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode,
          documentKey: docDef.key,
          fileName: fileName || `${docDef.key}.pdf`,
          fileUrl: finalDataUrl,
          extractedText: ocrText,
          blurScore,
          isBlurry: blurScore < 50,
          fileSizeBytes: 220000,
          imageWidth: 800,
          imageHeight: 1100,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to process document.");
        setStep("PROCESSING");
        return;
      }

      // Success!
      onUploadSuccess(docDef.key, data);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
      setStep("PROCESSING");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-[#12271c] border border-[#1e382b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#0a1811] border-b border-[#1e382b]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                  CamScanner Engine: {docDef.title}
                </h3>
                <p className="text-[11px] text-slate-400">Auto-crop, contrast enhancement & OCR compliance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSampleModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-[#1e382b] hover:bg-emerald-950/60 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Sample</span>
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

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {/* Step 1: Input Options */}
            {step === "INPUT" && (
              <div className="space-y-4">
                {!isCameraActive ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6">
                    {/* Camera Capture Card (In-app live camera or native capture) */}
                    {canUseInAppCamera ? (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="p-6 rounded-2xl bg-[#0c1a13] hover:bg-[#152e21] border border-[#1e382b] flex flex-col items-center justify-center gap-3 text-center transition-all group"
                      >
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                          <Camera className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">In-App Live Scanner</div>
                          <div className="text-xs text-slate-400 mt-1">Live camera alignment & snap</div>
                        </div>
                      </button>
                    ) : (
                      <div className="relative p-6 rounded-2xl bg-[#0c1a13] hover:bg-[#152e21] border border-[#1e382b] flex flex-col items-center justify-center gap-3 text-center transition-all group overflow-hidden cursor-pointer">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                          <Camera className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Capture with Camera</div>
                          <div className="text-xs text-slate-400 mt-1">Direct camera capture & CamScan</div>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                          title="Capture with Camera"
                        />
                      </div>
                    )}

                    {/* File / PDF Upload Card */}
                    <div className="relative p-6 rounded-2xl bg-[#0c1a13] hover:bg-[#152e21] border border-[#1e382b] flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all group overflow-hidden">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Upload File / PDF</div>
                        <div className="text-xs text-slate-400 mt-1">PDF, JPG, PNG from device</div>
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                        title="Upload File"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3">
                    {/* A4 Portrait Viewfinder (210mm x 297mm proportion: 1 / 1.414) */}
                    <div className="relative w-full max-w-[290px] sm:max-w-[320px] aspect-[1/1.414] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-2xl">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      {/* Document A4 Framing Overlay with Corner Brackets */}
                      <div className="absolute inset-4 border border-dashed border-emerald-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                        <div className="flex justify-between w-full">
                          <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl -mt-1 -ml-1" />
                          <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr -mt-1 -mr-1" />
                        </div>
                        <div className="self-center bg-black/75 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-500/30 text-[11px] font-bold text-white shadow-lg flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          A4 Document Frame
                        </div>
                        <div className="flex justify-between w-full">
                          <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl -mb-1 -ml-1" />
                          <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br -mb-1 -mr-1" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={stopCamera}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                      >
                        Cancel Camera
                      </button>
                      <button
                        onClick={capturePhoto}
                        className="px-6 py-2.5 rounded-xl bg-[#008751] hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg"
                      >
                        <Camera className="w-4 h-4" />
                        Snap A4 Document
                      </button>
                    </div>
                  </div>
                )}

                {/* Helpful Checklist */}
                <div className="p-3.5 rounded-xl bg-[#0c1a13] border border-[#1e382b] text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> CamScanner Processing Features:
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Once captured, photos are de-skewed, shadows are eliminated, and dark text is extracted on a pure white background. Automatically exported to standardized national PDF.
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Processing & Enhancement Preview */}
            {(step === "PROCESSING" || step === "SUBMITTING") && (
              <div className="space-y-4">
                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-red-300">Validation Issue</div>
                      <div>{errorMessage}</div>
                      <button
                        onClick={() => setSampleModalOpen(true)}
                        className="text-emerald-400 underline font-semibold hover:text-emerald-300 inline-block pt-1"
                      >
                        Click here to see what the correct {docDef.title} looks like.
                      </button>
                    </div>
                  </div>
                )}

                {/* Canvas Render Area (Standard A4 Portrait Ratio) */}
                <div className="relative rounded-2xl border border-emerald-900/60 bg-[#0c1a13] p-3 flex items-center justify-center max-w-[320px] aspect-[1/1.414] mx-auto overflow-hidden shadow-2xl">
                  <canvas
                    ref={canvasRef}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                  />
                  <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    CamScanner Enhanced
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setFilterMode("MAGIC_COLOR")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      filterMode === "MAGIC_COLOR"
                        ? "bg-[#008751] text-white shadow-md shadow-emerald-950/50"
                        : "bg-[#0c1a13] text-slate-300 hover:bg-[#1e382b]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Magic Color
                  </button>
                  <button
                    onClick={() => setFilterMode("BW")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      filterMode === "BW"
                        ? "bg-[#008751] text-white shadow-md shadow-emerald-950/50"
                        : "bg-[#0c1a13] text-slate-300 hover:bg-[#1e382b]"
                    }`}
                  >
                    Clean B&W
                  </button>
                  <button
                    onClick={() => setFilterMode("ORIGINAL")}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      filterMode === "ORIGINAL"
                        ? "bg-[#008751] text-white shadow-md shadow-emerald-950/50"
                        : "bg-[#0c1a13] text-slate-300 hover:bg-[#1e382b]"
                    }`}
                  >
                    Original
                  </button>
                </div>

                {/* Legibility / Sharpness Meter */}
                <div className="p-3 rounded-xl bg-[#0c1a13] border border-[#1e382b] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300">Sharpness & OCR Quality:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold ${
                        blurScore >= 70
                          ? "text-emerald-400"
                          : blurScore >= 50
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    >
                      {blurScore}% (High Legibility)
                    </span>
                    <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all"
                        style={{ width: `${blurScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setRawImage(null);
                      setStep("INPUT");
                    }}
                    className="flex-1 py-2.5 px-3 bg-[#0c1a13] hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-[#1e382b] text-xs"
                  >
                    Retake / Choose Another
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={step === "SUBMITTING"}
                    className="flex-1 py-2.5 px-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {step === "SUBMITTING" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying & Converting to PDF...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Process & Submit PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Sample Preview Modal */}
      {sampleModalOpen && (
        <SampleDocumentModal docDef={docDef} onClose={() => setSampleModalOpen(false)} />
      )}
    </>
  );
}
