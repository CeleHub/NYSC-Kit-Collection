/**
 * CamScanner Engine for NYSC Kit Collection & Document Verification
 * 1. 4-Point Perspective Warp & Edge Cropping (Removes desks, backgrounds, beds, floors)
 * 2. Magic Color Adaptive Whitening & Ink/Stamp Preservation
 * 3. Standard A4 PDF Generation (jsPDF)
 */

import { jsPDF } from "jspdf";

export interface CropPoint {
  x: number; // 0.0 to 1.0 (normalized)
  y: number; // 0.0 to 1.0 (normalized)
}

/**
 * Standard A4 Dimensions at 150 DPI
 * 210mm x 297mm -> 1240px x 1754px
 */
export const A4_WIDTH = 1240;
export const A4_HEIGHT = 1754;

/**
 * Automatically detects the 4 corners of a document in an image.
 * Uses adaptive luminance thresholding and directional edge scanning
 * from outside borders inward to isolate the paper boundary from tables/beds/backgrounds.
 * Returns [Top-Left, Top-Right, Bottom-Right, Bottom-Left] in normalized coordinates (0.0 - 1.0).
 */
export function detectDocumentCorners(
  sourceImage: HTMLImageElement | HTMLCanvasElement
): [CropPoint, CropPoint, CropPoint, CropPoint] {
  const fallback: [CropPoint, CropPoint, CropPoint, CropPoint] = [
    { x: 0.05, y: 0.05 },
    { x: 0.95, y: 0.05 },
    { x: 0.95, y: 0.95 },
    { x: 0.05, y: 0.95 },
  ];

  try {
    const rawW = "naturalWidth" in sourceImage ? sourceImage.naturalWidth : sourceImage.width;
    const rawH = "naturalHeight" in sourceImage ? sourceImage.naturalHeight : sourceImage.height;
    if (!rawW || !rawH) return fallback;

    // Downscale for instant analysis (<10ms)
    const scanW = 220;
    const scanH = Math.max(100, Math.round((220 * rawH) / rawW));
    const canvas = document.createElement("canvas");
    canvas.width = scanW;
    canvas.height = scanH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;

    ctx.drawImage(sourceImage, 0, 0, scanW, scanH);
    const imgData = ctx.getImageData(0, 0, scanW, scanH);
    const data = imgData.data;

    // 1. Grayscale luminance array & histogram
    const gray = new Uint8Array(scanW * scanH);
    const hist = new Uint32Array(256);
    let totalLuminance = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      gray[p] = g;
      hist[g]++;
      totalLuminance += g;
    }

    const totalPixels = scanW * scanH;

    // 2. Otsu threshold to separate paper foreground from darker backgrounds
    let sumB = 0;
    let wB = 0;
    let maxVar = 0;
    let threshold = 140; // Default paper threshold

    let sum1 = 0;
    for (let t = 0; t < 256; t++) sum1 += t * hist[t];

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = totalPixels - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum1 - sumB) / wF;
      const betweenVar = wB * wF * (mB - mF) * (mB - mF);
      if (betweenVar > maxVar) {
        maxVar = betweenVar;
        threshold = t;
      }
    }

    // Safety threshold clamp: paper is at least mildly bright
    threshold = Math.max(110, Math.min(threshold, 210));

    // 3. Scan inward from borders to find outer paper edges
    const edgePoints: Array<{ x: number; y: number }> = [];

    // Top scan: sweep y down from top
    for (let x = Math.round(scanW * 0.1); x < Math.round(scanW * 0.9); x += 3) {
      for (let y = 3; y < Math.round(scanH * 0.45); y++) {
        const idx = y * scanW + x;
        const g = gray[idx];
        const prevG = gray[(y - 1) * scanW + x];
        if (g >= threshold && Math.abs(g - prevG) > 15) {
          edgePoints.push({ x, y });
          break;
        }
      }
    }

    // Bottom scan: sweep y up from bottom
    for (let x = Math.round(scanW * 0.1); x < Math.round(scanW * 0.9); x += 3) {
      for (let y = scanH - 4; y > Math.round(scanH * 0.55); y--) {
        const idx = y * scanW + x;
        const g = gray[idx];
        const nextG = gray[(y + 1) * scanW + x];
        if (g >= threshold && Math.abs(g - nextG) > 15) {
          edgePoints.push({ x, y });
          break;
        }
      }
    }

    // Left scan: sweep x right from left
    for (let y = Math.round(scanH * 0.1); y < Math.round(scanH * 0.9); y += 3) {
      for (let x = 3; x < Math.round(scanW * 0.45); x++) {
        const idx = y * scanW + x;
        const g = gray[idx];
        const prevG = gray[y * scanW + (x - 1)];
        if (g >= threshold && Math.abs(g - prevG) > 15) {
          edgePoints.push({ x, y });
          break;
        }
      }
    }

    // Right scan: sweep x left from right
    for (let y = Math.round(scanH * 0.1); y < Math.round(scanH * 0.9); y += 3) {
      for (let x = scanW - 4; x > Math.round(scanW * 0.55); x--) {
        const idx = y * scanW + x;
        const g = gray[idx];
        const nextG = gray[y * scanW + (x + 1)];
        if (g >= threshold && Math.abs(g - nextG) > 15) {
          edgePoints.push({ x, y });
          break;
        }
      }
    }

    // If too few edge points detected (low contrast background), fallback safely
    if (edgePoints.length < 16) {
      return fallback;
    }

    // 4. Find the 4 extreme diagonal corners among edge points:
    let tl = edgePoints[0];
    let tr = edgePoints[0];
    let br = edgePoints[0];
    let bl = edgePoints[0];

    let minSum = tl.x + tl.y;
    let maxSum = br.x + br.y;
    let maxDiff = tr.x - tr.y;
    let minDiff = bl.x - bl.y;

    for (let i = 1; i < edgePoints.length; i++) {
      const p = edgePoints[i];
      const sum = p.x + p.y;
      const diff = p.x - p.y;

      if (sum < minSum) {
        minSum = sum;
        tl = p;
      }
      if (sum > maxSum) {
        maxSum = sum;
        br = p;
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        tr = p;
      }
      if (diff < minDiff) {
        minDiff = diff;
        bl = p;
      }
    }

    // Normalize coordinates (0.0 to 1.0)
    const normTL = { x: Math.max(0.01, Math.min(0.99, tl.x / scanW)), y: Math.max(0.01, Math.min(0.99, tl.y / scanH)) };
    const normTR = { x: Math.max(0.01, Math.min(0.99, tr.x / scanW)), y: Math.max(0.01, Math.min(0.99, tr.y / scanH)) };
    const normBR = { x: Math.max(0.01, Math.min(0.99, br.x / scanW)), y: Math.max(0.01, Math.min(0.99, br.y / scanH)) };
    const normBL = { x: Math.max(0.01, Math.min(0.99, bl.x / scanW)), y: Math.max(0.01, Math.min(0.99, bl.y / scanH)) };

    // Validate polygon area using Shoelace formula
    const area = 0.5 * Math.abs(
      (normTL.x * normTR.y - normTR.x * normTL.y) +
      (normTR.x * normBR.y - normBR.x * normTR.y) +
      (normBR.x * normBL.y - normBL.x * normBR.y) +
      (normBL.x * normTL.y - normTL.x * normBL.y)
    );

    // If detected area is reasonably sized (at least 20% of image), use it!
    if (area >= 0.20) {
      return [normTL, normTR, normBR, normBL];
    }

    return fallback;
  } catch (err) {
    console.warn("Auto edge detection fallback:", err);
    return fallback;
  }
}

/**
 * Warps a 4-point quadrilateral from a source image into a flat, upright A4 canvas
 * Corners order: [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
 */
export function warpQuadrilateralToCanvas(
  sourceImage: HTMLImageElement,
  corners: [CropPoint, CropPoint, CropPoint, CropPoint],
  targetWidth = A4_WIDTH,
  targetHeight = A4_HEIGHT
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imgW = sourceImage.naturalWidth || sourceImage.width;
  const imgH = sourceImage.naturalHeight || sourceImage.height;

  const [tl, tr, br, bl] = corners;
  const x0 = tl.x * imgW, y0 = tl.y * imgH;
  const x1 = tr.x * imgW, y1 = tr.y * imgH;
  const x2 = br.x * imgW, y2 = br.y * imgH;
  const x3 = bl.x * imgW, y3 = bl.y * imgH;

  // Background fill white
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Divide quadrilateral into 2 triangles and warp each via affine transformation:
  // Triangle 1: (TL, TR, BR) -> (0, 0), (targetWidth, 0), (targetWidth, targetHeight)
  drawAffineTriangle(ctx, sourceImage, x0, y0, x1, y1, x2, y2, 0, 0, targetWidth, 0, targetWidth, targetHeight);

  // Triangle 2: (TL, BR, BL) -> (0, 0), (targetWidth, targetHeight), (0, targetHeight)
  drawAffineTriangle(ctx, sourceImage, x0, y0, x2, y2, x3, y3, 0, 0, targetWidth, targetHeight, 0, targetHeight);

  return canvas;
}

/**
 * Affine texture mapping for a single triangle using 2D canvas transforms
 */
function drawAffineTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  u0: number, v0: number,
  u1: number, v1: number,
  u2: number, v2: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(u0, v0);
  ctx.lineTo(u1, v1);
  ctx.lineTo(u2, v2);
  ctx.closePath();
  ctx.clip();

  const delta = x0 * (y1 - y2) - x1 * (y0 - y2) + x2 * (y0 - y1);
  if (Math.abs(delta) < 1e-6) {
    ctx.restore();
    return;
  }

  const deltaA = u0 * (y1 - y2) - u1 * (y0 - y2) + u2 * (y0 - y1);
  const deltaB = x0 * (u1 - u2) - x1 * (u0 - u2) + x2 * (u0 - u1);
  const deltaC = x0 * (y1 * u2 - y2 * u1) - x1 * (y0 * u2 - y2 * u0) + x2 * (y0 * u1 - y1 * u0);

  const deltaD = v0 * (y1 - y2) - v1 * (y0 - y2) + v2 * (y0 - y1);
  const deltaE = x0 * (v1 - v2) - x1 * (v0 - v2) + x2 * (v0 - v1);
  const deltaF = x0 * (y1 * v2 - y2 * v1) - x1 * (y0 * v2 - y2 * v0) + x2 * (y0 * v1 - y1 * v0);

  ctx.transform(
    deltaA / delta,
    deltaD / delta,
    deltaB / delta,
    deltaE / delta,
    deltaC / delta,
    deltaF / delta
  );

  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * CamScanner Filter Processing (Magic Color, Clean B&W, Original)
 */
export function applyCamScannerFilter(
  canvas: HTMLCanvasElement,
  filterMode: "MAGIC_COLOR" | "BW" | "ORIGINAL",
  contrastLevel = 35
) {
  if (filterMode === "ORIGINAL") return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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
      // Magic Color: Adaptively whiten shadows & paper while keeping colored ink & stamps
      if (gray > 155) {
        // Light paper / background -> pure clean white
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        // Dark text / stamps / signatures -> boost contrast & saturation
        data[i] = Math.max(0, Math.min(255, factor * (r - 128) + 128));
        data[i + 1] = Math.max(0, Math.min(255, factor * (g - 128) + 128));
        data[i + 2] = Math.max(0, Math.min(255, factor * (b - 128) + 128));
      }
    } else if (filterMode === "BW") {
      // Clean B&W archive mode
      const threshold = 145;
      const val = gray > threshold ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Generates a real standard A4 PDF document data URI from an image URL
 */
export function generateA4Pdf(imageDataUrl: string, title?: string): string {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Fit image to full standard A4 sheet (210 x 297 mm)
  pdf.addImage(imageDataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");

  if (title) {
    pdf.setProperties({
      title: `${title} - NYSC Verification`,
      subject: "National Youth Service Corps Official Document",
      author: "NYSC Camp Kit Collection System",
      creator: "NYSC Document CamScanner",
    });
  }

  return pdf.output("datauristring");
}
