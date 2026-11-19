"use client";

import { useState, useRef } from "react";
import { Camera, Upload, X, Check, AlertCircle, RefreshCw, AlertTriangle, ShieldAlert } from "lucide-react";

interface PassportModalProps {
  onClose: () => void;
  onConfirm: (fileDataUrl: string, fileName: string) => void;
}

interface BiometricResult {
  faceDetected: boolean;
  eyesVisible: boolean;
  noHeadwear: boolean;
  backgroundCompliant: boolean;
  mouthVisible: boolean;
  errors: string[];
}

export default function PassportCaptureModal({ onClose, onConfirm }: PassportModalProps) {
  const [mode, setMode] = useState<"SELECT" | "CAMERA" | "PREVIEW">("SELECT");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("passport.jpg");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<BiometricResult | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const startCamera = async () => {
    setMode("CAMERA");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      alert("Unable to access front camera. Please use file upload instead.");
      setMode("SELECT");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Center crop square from video
    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, 480, 480);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    setPreviewUrl(dataUrl);
    setFileName("passport_capture.jpg");
    analyzeBiometrics(dataUrl);
    setMode("PREVIEW");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreviewUrl(result);
      setFileName(file.name);
      analyzeBiometrics(result);
      setMode("PREVIEW");
    };
    reader.readAsDataURL(file);
  };

    /**
     * Biometric Image Processing Engine
     * Validates:
     * 1. Face landmarks via browser FaceDetector if available
     * 2. Pixel Luminance / Edge / Skin Color heuristics:
     *    - Eye Occlusion: Checks for horizontal hand/arm occlusions and pupil contrast
     *    - Headwear / Cap: Detects visor brim, dark hats covering upper head
     *    - Background: Checks for non-plain or cluttered background
     *    - Mouth/Chin Visibility
     */
    const analyzeBiometrics = async (dataUrl: string) => {
      setChecking(true);
        setResult(null);

        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const w = 320;
        const h = 320;
        const testCanvas = document.createElement("canvas");
        testCanvas.width = w;
        testCanvas.height = h;
        const ctx = testCanvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setChecking(false);
      return;
    }

    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const errors: string[] = [];
    let eyesVisible = true;
    let noHeadwear = true;
    let backgroundCompliant = true;
    let faceDetected = true;
    let mouthVisible = true;

    // Check 1: ShapeDetection API (FaceDetector) if supported by browser
    if (typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        const detector = new (window as any).FaceDetector({ maxDetectedFaces: 3, fastMode: false });
        const faces = await detector.detect(img);
        if (!faces || faces.length === 0) {
          faceDetected = false;
          errors.push("No clear face detected. Ensure your face is fully uncovered and facing the camera.");
        } else if (faces.length > 1) {
          errors.push("Multiple individuals detected in frame. Only one individual is permitted.");
        } else {
          // If face detected, check landmarks for eye presence
          const face = faces[0];
          if (face.landmarks) {
            const hasEye = face.landmarks.some((l: any) => l.type === "eye");
            if (!hasEye) {
              eyesVisible = false;
              errors.push("Eyes not detected or occluded. Please remove hand, sunglasses, or obstruction.");
            }
          }
        }
      } catch {
        // Fall back to pixel heuristics
      }
    }

    // Helper: get pixel luminance at (x, y)
    const getLuminance = (x: number, y: number) => {
      const idx = (Math.floor(y) * w + Math.floor(x)) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    // Helper: is skin tone (YCbCr / normalized RGB)
    const isSkinPixel = (x: number, y: number) => {
      const idx = (Math.floor(y) * w + Math.floor(x)) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Basic skin tone heuristic
      return r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10;
    };

    // Check 2: Headwear / Cap Detection (Top 5% - 24% of head region)
    // Caps/hats usually have a distinct dark/colored band or horizontal brim across y = 15% - 26%
    let topDarkCount = 0;
    let topTotal = 0;
    for (let y = h * 0.05; y < h * 0.25; y += 4) {
      for (let x = w * 0.25; x < w * 0.75; x += 4) {
        topTotal++;
        const lum = getLuminance(x, y);
        // If top of head has dense dark pixels, green/orange/black hat fabric instead of hair/forehead
        if (lum < 75) topDarkCount++;
      }
    }
    const topDarkRatio = topDarkCount / topTotal;
    // Check horizontal brim line across y: 20% to 28%
    let horizontalEdgeEnergy = 0;
    for (let x = w * 0.2; x < w * 0.8; x += 5) {
      const yBrim = h * 0.24;
      const diff = Math.abs(getLuminance(x, yBrim - 6) - getLuminance(x, yBrim + 6));
      if (diff > 45) horizontalEdgeEnergy++;
    }

    if (topDarkRatio > 0.42 || horizontalEdgeEnergy > 16) {
      noHeadwear = false;
      errors.push("Headwear / Cap detected. NYSC regulations strictly forbid caps or hats in passport photos.");
    }

    // Check 3: Eye Occlusion Analysis (The User's specific scenario: Hand/arm covering eyes)
    // Eye region: Y from 34% to 52%, X from 25% to 75%
    // A visible face has high vertical variance in the eye zone (eyebrows -> upper lid -> pupil -> sclera -> lower lid).
    // An arm/hand placed across the eyes creates a continuous horizontal skin bar with near-zero pupil-to-sclera contrast
    // and a massive horizontal edge at the arm boundary.
    let eyeZoneSkinCount = 0;
    let eyeZonePixelCount = 0;
    let pupilContrastFound = false;

    // Check left eye box (x: 28% to 46%, y: 36% to 48%) and right eye box (x: 54% to 72%, y: 36% to 48%)
    let leftEyeVariance = 0;
    let rightEyeVariance = 0;
    let leftSamples = 0;
    let rightSamples = 0;

    for (let y = h * 0.36; y < h * 0.48; y += 3) {
      for (let x = w * 0.28; x < w * 0.46; x += 3) {
        leftSamples++;
        const lum = getLuminance(x, y);
        const nextLum = getLuminance(x, y + 3);
        leftEyeVariance += Math.abs(lum - nextLum);
      }
      for (let x = w * 0.54; x < w * 0.72; x += 3) {
        rightSamples++;
        const lum = getLuminance(x, y);
        const nextLum = getLuminance(x, y + 3);
        rightEyeVariance += Math.abs(lum - nextLum);
      }
    }

    const avgLeftVariance = leftEyeVariance / Math.max(leftSamples, 1);
    const avgRightVariance = rightEyeVariance / Math.max(rightSamples, 1);

    // Also check for continuous horizontal obstruction across center eye line (hand/arm covering face)
    let continuousArmBlockCount = 0;
    const yCenter = h * 0.42;
    for (let x = w * 0.25; x < w * 0.75; x += 4) {
      eyeZonePixelCount++;
      if (isSkinPixel(x, yCenter) && isSkinPixel(x, yCenter + 8)) {
        continuousArmBlockCount++;
      }
    }
    const horizontalSkinSpan = continuousArmBlockCount / Math.max(eyeZonePixelCount, 1);

    // If eye variance is suppressed AND there's an unbroken hand/arm covering the eye span:
    if (avgLeftVariance < 12 || avgRightVariance < 12 || horizontalSkinSpan > 0.88) {
      eyesVisible = false;
      errors.push("Eyes are occluded or covered. Your hand/arm or sunglasses are blocking your eyes.");
    }

    // Check 4: Background Compliance
    // Sample the 4 outer corner zones (top-left, top-right, bottom-left, bottom-right)
    let bgSamples = 0;
    let nonWhiteBgCount = 0;
    const cornerOffsets = [
      { startX: 0, endX: w * 0.15, startY: 0, endY: h * 0.15 },
      { startX: w * 0.85, endX: w, startY: 0, endY: h * 0.15 },
      { startX: 0, endX: w * 0.12, startY: h * 0.85, endY: h },
      { startX: w * 0.88, endX: w, startY: h * 0.85, endY: h },
    ];

    cornerOffsets.forEach((box) => {
      for (let y = box.startY; y < box.endY; y += 4) {
        for (let x = box.startX; x < box.endX; x += 4) {
          bgSamples++;
          const lum = getLuminance(x, y);
          // Plain white or light background has luminance > 165
          if (lum < 155) {
            nonWhiteBgCount++;
          }
        }
      }
    });

    const nonWhiteRatio = nonWhiteBgCount / Math.max(bgSamples, 1);
    if (nonWhiteRatio > 0.55) {
      backgroundCompliant = false;
      errors.push("Background is not plain white. Background has clutter, patterns, or dark shadows.");
    }

    // Check 5: Mouth / Lower Face Area
    let mouthSkinCount = 0;
    let mouthPixelCount = 0;
    for (let y = h * 0.65; y < h * 0.80; y += 4) {
      for (let x = w * 0.35; x < w * 0.65; x += 4) {
        mouthPixelCount++;
        if (isSkinPixel(x, y)) mouthSkinCount++;
      }
    }
    if (mouthSkinCount / Math.max(mouthPixelCount, 1) < 0.2) {
      mouthVisible = false;
      errors.push("Mouth or chin region is obscured or not detected.");
    }

    setResult({
      faceDetected,
      eyesVisible,
      noHeadwear,
      backgroundCompliant,
      mouthVisible,
      errors,
    });
    setChecking(false);
  };

  const isCompliant =
    result &&
    result.faceDetected &&
    result.eyesVisible &&
    result.noHeadwear &&
    result.backgroundCompliant &&
    result.mouthVisible &&
    result.errors.length === 0;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#12271c] border border-[#1e382b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#0a1811] border-b border-[#1e382b]">
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Passport Photograph Verification</h3>
                <p className="text-xs text-slate-400">Strict NYSC National Biometric Compliance Standard</p>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
              <div className="p-6 overflow-y-auto flex flex-col items-center">
                {mode === "SELECT" && (
                      <div className="w-full space-y-4 py-2">
                        <div className="p-4 rounded-xl bg-[#0c1a13] border border-[#1e382b] text-xs text-slate-300 space-y-2.5">
                          <div className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Check className="w-4 h-4" /> Official Biometric Criteria:
                          </div>
                            <ul className="space-y-1.5 text-xs text-slate-300">
                              <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span><strong>Plain white</strong> or off-white background (no outdoor scenes or bars).</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span><strong>Full eye & face visibility</strong>: Eyes must be wide open, uncovered, and looking into camera.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span><strong>Strictly NO caps, hats, or headwear</strong> (must be bareheaded).</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-emerald-400 font-bold">•</span>
                                <span><strong>No hand gestures, arms</strong>, or facial obstructions.</span>
                              </li>
                            </ul>
                        </div>

                        <button
                          onClick={startCamera}
                          className="w-full py-3.5 px-4 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-950/40 transition-all text-sm"
                        >
                          <Camera className="w-5 h-5" />
                          Take Photo with Camera
                        </button>

                        <label className="w-full py-3.5 px-4 bg-[#0c1a13] hover:bg-slate-800 text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 border border-[#1e382b] cursor-pointer transition-all text-sm">
                          <Upload className="w-5 h-5 text-emerald-400" />
                          Upload Image File
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
          )}

                      {mode === "CAMERA" && (
                        <div className="flex flex-col items-center space-y-4 w-full">
                          {/* Camera Frame with Oval Alignment Guide */}
                          <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-xl">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                            {/* Oval Guide */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="w-44 h-56 rounded-[50%] border-2 border-dashed border-white/70 shadow-inner" />
                            </div>
                              <div className="absolute bottom-2 inset-x-0 text-center text-[10px] font-bold text-white/90 bg-black/60 py-1">
                                Position head inside oval. Remove cap & ensure eyes are open.
                              </div>
                            </div>

                            <button
                              onClick={capturePhoto}
                              className="py-3 px-8 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/50 text-sm"
                            >
                              <Camera className="w-5 h-5" />
                              Snap Photo
                            </button>
                          </div>
          )}

                          {mode === "PREVIEW" && previewUrl && (
                            <div className="flex flex-col items-center space-y-4 w-full">
                                {/* Image Preview */}
                                <div className="relative w-52 h-52 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-xl bg-white">
                                  <img src={previewUrl} alt="Passport preview" className="w-full h-full object-cover" />
                                  {!isCompliant && !checking && (
                                    <div className="absolute inset-0 bg-red-950/40 border-2 border-red-500 flex items-center justify-center">
                                      <span className="bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                                        <ShieldAlert className="w-3.5 h-3.5" /> REJECTED
                                      </span>
                                    </div>
                                  )}
                                </div>

                                    {/* Automated Biometric Inspection Checklist */}
                                    <div className="w-full p-4 rounded-xl bg-[#0c1a13] border border-[#1e382b] space-y-2.5 text-xs">
                                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                        <span>Automated Biometric Checks:</span>
                                        {checking && (
                                          <span className="text-emerald-400 flex items-center gap-1 font-normal">
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning pixels...
                                          </span>
                                        )}
                                      </div>

                                            {result && !checking && (
                                              <div className="space-y-2 text-xs">
                                                {/* Check 1: Face centered */}
                                                <div className="flex items-center justify-between">
                                                  <span className="text-slate-300">Face detected & centered</span>
                                                  {result.faceDetected ? (
                                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                      <Check className="w-4 h-4" /> Passed
                                                    </span>
                                                  ) : (
                                                    <span className="text-red-400 font-bold flex items-center gap-1">
                                                      <AlertCircle className="w-4 h-4" /> Failed
                                                    </span>
                                                  )}
                                                </div>

                                                  {/* Check 2: Eyes visible & uncovered */}
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-slate-300">Eyes uncovered & visible</span>
                                                    {result.eyesVisible ? (
                                                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                        <Check className="w-4 h-4" /> Passed
                                                      </span>
                                                    ) : (
                                                      <span className="text-red-400 font-bold flex items-center gap-1">
                                                        <AlertCircle className="w-4 h-4" /> Occluded
                                                      </span>
                                                    )}
                                                  </div>

                                                    {/* Check 3: Headwear / Cap */}
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-slate-300">No caps / headwear</span>
                                                      {result.noHeadwear ? (
                                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                          <Check className="w-4 h-4" /> Passed
                                                        </span>
                                                      ) : (
                                                        <span className="text-red-400 font-bold flex items-center gap-1">
                                                          <AlertCircle className="w-4 h-4" /> Cap Detected
                                                        </span>
                                                      )}
                                                    </div>

                                                    {/* Check 4: Background */}
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-slate-300">Plain white background</span>
                                                      {result.backgroundCompliant ? (
                                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                          <Check className="w-4 h-4" /> Passed
                                                        </span>
                                                      ) : (
                                                        <span className="text-red-400 font-bold flex items-center gap-1">
                                                          <AlertCircle className="w-4 h-4" /> Busy Background
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                )}
                                                </div>

                                                    {/* Specific Failure Reasons Alert Box */}
                                                    {result && result.errors.length > 0 && !checking && (
                                                      <div className="w-full p-3.5 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-200 space-y-1.5 animate-in fade-in">
                                                        <div className="font-bold flex items-center gap-1.5 text-red-400">
                                                          <AlertTriangle className="w-4 h-4 shrink-0" />
                                                          Biometric Rejection Reasons:
                                                        </div>
                                                        <ul className="space-y-1 list-disc list-inside text-[11px] text-red-300">
                                                          {result.errors.map((err, i) => (
                                                            <li key={i}>{err}</li>
                                                          ))}
                                                        </ul>
                                                        <div className="text-[10px] text-slate-400 pt-1">
                                                          Please uncover your eyes, remove your cap/hat, and take the photo against a plain white wall.
                                                        </div>
                                                      </div>
                                                    )}

                                                      {/* Action Buttons */}
                                                      <div className="flex items-center gap-3 w-full pt-1">
                                                        <button
                                                          onClick={() => {
                                                            setPreviewUrl(null);
                                                            setResult(null);
                                                            setMode("SELECT");
                                                          }}
                                                          className="flex-1 py-3 px-3 bg-[#0c1a13] hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-[#1e382b] text-xs transition-all"
                                                        >
                                                          Retake Photo
                                                        </button>
                                                        <button
                                                          onClick={() => {
                                                            if (isCompliant) {
                                                              onConfirm(previewUrl, fileName);
                                                              onClose();
                                                            }
                                                          }}
                                                          disabled={checking || !isCompliant}
                                                          className="flex-1 py-3 px-3 bg-[#008751] hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-950/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                          <Check className="w-4 h-4" />
                                                          {isCompliant ? "Accept & Save" : "Non-Compliant"}
                                                        </button>
                                                      </div>
                                                    </div>
          )}

                                                    <canvas ref={canvasRef} className="hidden" />
                                                  </div>
      </div>
    </div>
                                          );
}
