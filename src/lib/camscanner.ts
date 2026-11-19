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
