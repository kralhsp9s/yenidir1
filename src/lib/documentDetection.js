
import { loadOpenCV } from "./opencv";

// Köşeleri sol üst, sağ üst, sağ alt, sol alt sırasına koyar.
function orderCorners(points) {
  const sum = points.map((p) => p.x + p.y);
  const diff = points.map((p) => p.x - p.y);

  const topLeft = points[sum.indexOf(Math.min(...sum))];
  const bottomRight = points[sum.indexOf(Math.max(...sum))];
  const topRight = points[diff.indexOf(Math.max(...diff))];
  const bottomLeft = points[diff.indexOf(Math.min(...diff))];

  return [topLeft, topRight, bottomRight, bottomLeft];
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export async function detectDocument(sourceCanvas) {
  const cv = await loadOpenCV();

  const maxDimension = 1000;
  const scale = Math.min(
    1,
    maxDimension / Math.max(sourceCanvas.width, sourceCanvas.height)
  );

  const width = Math.max(1, Math.round(sourceCanvas.width * scale));
  const height = Math.max(1, Math.round(sourceCanvas.height * scale));

  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = width;
  smallCanvas.height = height;

  const context = smallCanvas.getContext("2d");
  context.drawImage(sourceCanvas, 0, 0, width, height);

  const src = cv.imread(smallCanvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const dilated = new cv.Mat();
  const hierarchy = new cv.Mat();
  const contours = new cv.MatVector();
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);

  let bestCorners = null;
  let bestArea = 0;

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(
      gray,
      blurred,
      new cv.Size(5, 5),
      0,
      0,
      cv.BORDER_DEFAULT
    );

    cv.Canny(blurred, edges, 50, 150);
    cv.dilate(edges, dilated, kernel);

    cv.findContours(
      dilated,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );

    const imageArea = width * height;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      const approx = new cv.Mat();

      try {
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        if (approx.rows !== 4 || !cv.isContourConvex(approx)) {
          continue;
        }

        const area = Math.abs(cv.contourArea(approx));

        if (area < imageArea * 0.08 || area <= bestArea) {
          continue;
        }

        const points = [];

        for (let j = 0; j < 4; j++) {
          points.push({
            x: approx.data32S[j * 2] / scale,
            y: approx.data32S[j * 2 + 1] / scale,
          });
        }

        const ordered = orderCorners(points);

        const top = distance(ordered[0], ordered[1]);
        const bottom = distance(ordered[3], ordered[2]);
        const left = distance(ordered[0], ordered[3]);
        const right = distance(ordered[1], ordered[2]);

        if (Math.min(top, bottom, left, right) < 20) {
          continue;
        }

        bestArea = area;
        bestCorners = ordered;
      } finally {
        approx.delete();
        contour.delete();
      }
    }
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    dilated.delete();
    hierarchy.delete();
    contours.delete();
    kernel.delete();
  }

  return bestCorners;
}
