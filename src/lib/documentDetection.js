
import { loadOpenCV } from "./opencv";

function orderCorners(points) {
  const sums = points.map((p) => p.x + p.y);
  const diffs = points.map((p) => p.y - p.x);

  return [
    points[sums.indexOf(Math.min(...sums))], // Sol üst
    points[diffs.indexOf(Math.min(...diffs))], // Sağ üst
    points[sums.indexOf(Math.max(...sums))], // Sağ alt
    points[diffs.indexOf(Math.max(...diffs))], // Sol alt
  ];
}

async function runDetection(image, options = {}) {
  const cv = await loadOpenCV();

  const width = image.naturalWidth || image.videoWidth || image.width;
  const height = image.naturalHeight || image.videoHeight || image.height;

  if (!width || !height) {
    throw new Error("Fotoğraf henüz yüklenmedi.");
  }

  // Büyük fotoğrafları analizden önce küçült.
  const maxDimension = options.maxDimension || 700;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const smallWidth = Math.max(1, Math.round(width * scale));
  const smallHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = smallWidth;
  canvas.height = smallHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, smallWidth, smallHeight);

  let src, gray, blurred, edges, contours, hierarchy;

  try {
    src = cv.imread(canvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    let bestPoints = null;
    let bestArea = 0;
    const imageArea = smallWidth * smallHeight;

    // Büyük ve dört köşeli şekiller arasından en uygun adayı seç.
    for (let i = 0; i < contours.size(); i++) {
      let contour, approx;

      try {
        contour = contours.get(i);
        const area = Math.abs(cv.contourArea(contour));

        if (area < imageArea * 0.08 || area <= bestArea) continue;

        approx = new cv.Mat();
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue;

        const points = [];
        for (let j = 0; j < 4; j++) {
          points.push({
            x: approx.data32S[j * 2],
            y: approx.data32S[j * 2 + 1],
          });
        }

        bestPoints = orderCorners(points);
        bestArea = area;
      } finally {
        if (approx) approx.delete();
        if (contour) contour.delete();
      }
    }

    if (!bestPoints) {
      return {
        found: false,
        corners: null,
        message: "Belge otomatik bulunamadı. Köşeleri elle ayarlayabilirsin.",
      };
    }

    // Küçük görüntüdeki koordinatları orijinal fotoğrafa çevir.
    const factorX = width / smallWidth;
    const factorY = height / smallHeight;

    const corners = bestPoints.map((p) => ({
      x: p.x * factorX,
      y: p.y * factorY,
    }));

    return { found: true, corners };
  } finally {
    if (hierarchy) hierarchy.delete();
    if (contours) contours.delete();
    if (edges) edges.delete();
    if (blurred) blurred.delete();
    if (gray) gray.delete();
    if (src) src.delete();
  }
}

// Önceki bileşenlerle uyumluluk için iki fonksiyon adı da mevcut.
export async function detectDocumentCorners(image, options = {}) {
  return runDetection(image, options);
}

export async function detectDocument(sourceCanvas, options = {}) {
  const result = await runDetection(sourceCanvas, options);
  return result.found ? result.corners : null;
}
