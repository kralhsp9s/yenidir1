
import { loadOpenCV } from "./opencv";

function orderCorners(points) {
  const sum = (p) => p.x + p.y;
  const diff = (p) => p.x - p.y;

  const topLeft = points.reduce((a, b) => sum(a) < sum(b) ? a : b);
  const bottomRight = points.reduce((a, b) => sum(a) > sum(b) ? a : b);
  const topRight = points.reduce((a, b) => diff(a) > diff(b) ? a : b);
  const bottomLeft = points.reduce((a, b) => diff(a) < diff(b) ? a : b);

  return [topLeft, topRight, bottomRight, bottomLeft];
}

export async function detectDocumentCorners(sourceCanvas) {
  const cv = await loadOpenCV();

  let src;
  let gray;
  let blurred;
  let edges;
  let hierarchy;
  let contours;
  let kernel;
  let bestApprox;
  let bestArea = 0;

  const maxDimension = 1000;
  const scale = Math.min(
    1,
    maxDimension / Math.max(sourceCanvas.width, sourceCanvas.height)
  );

  const workCanvas = document.createElement("canvas");
  workCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  workCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));

  workCanvas.getContext("2d").drawImage(
    sourceCanvas, 0, 0, workCanvas.width, workCanvas.height
  );

  try {
    src = cv.imread(workCanvas);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    hierarchy = new cv.Mat();
    contours = new cv.MatVector();
    kernel = cv.Mat.ones(3, 3, cv.CV_8U);

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.dilate(edges, edges, kernel);

    cv.findContours(
      edges, contours, hierarchy,
      cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE
    );

    const imageArea = workCanvas.width * workCanvas.height;

    for (let i = 0; i < contours.size(); i++) {
      let contour;
      let perimeter;
      let approx;

      try {
        contour = contours.get(i);
        perimeter = cv.arcLength(contour, true);
        approx = new cv.Mat();

        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const area = Math.abs(cv.contourArea(approx));

          if (area > bestArea && area > imageArea * 0.08) {
            bestArea = area;
            if (bestApprox) bestApprox.delete();
            bestApprox = approx;
            approx = null;
          }
        }
      } finally {
        if (contour) contour.delete();
        if (perimeter !== undefined) {
          // arcLength dönen sayı için bellek temizliği gerekmez.
        }
        if (approx) approx.delete();
      }
    }

    if (!bestApprox) {
      return {
        found: false,
        corners: null,
        message: "Belge otomatik bulunamadı. Köşeleri elle belirleyebilirsin.",
      };
    }

    const data = bestApprox.data32S;
    const points = [];

    for (let i = 0; i < bestApprox.rows; i++) {
      points.push({
        x: data[i * 2] / scale,
        y: data[i * 2 + 1] / scale,
      });
    }

    return {
      found: true,
      corners: orderCorners(points),
      message: "Belge köşeleri bulundu.",
    };
  } finally {
    if (bestApprox) bestApprox.delete();
    if (src) src.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (edges) edges.delete();
    if (hierarchy) hierarchy.delete();
    if (contours) contours.delete();
    if (kernel) kernel.delete();
  }
}
