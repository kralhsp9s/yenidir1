
import { loadOpenCV } from "./opencv";

export async function cropPerspective(sourceCanvas, corners) {
  const cv = await loadOpenCV();

  if (!corners || corners.length !== 4) {
    throw new Error("Kırpmak için dört köşe seçmelisin.");
  }

  const [tl, tr, br, bl] = corners;

  const distance = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const width = Math.max(
    distance(tl, tr),
    distance(bl, br)
  );

  const height = Math.max(
    distance(tl, bl),
    distance(tr, br)
  );

  if (width < 20 || height < 20) {
    throw new Error("Seçilen alan çok küçük.");
  }

  const outputWidth = Math.round(width);
  const outputHeight = Math.round(height);

  let src;
  let srcPoints;
  let dstPoints;
  let transform;
  let output;

  try {
    src = cv.imread(sourceCanvas);

    srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y,
      tr.x, tr.y,
      br.x, br.y,
      bl.x, bl.y,
    ]);

    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      outputWidth - 1, 0,
      outputWidth - 1, outputHeight - 1,
      0, outputHeight - 1,
    ]);

    transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
    output = new cv.Mat();

    cv.warpPerspective(
      src,
      output,
      transform,
      new cv.Size(outputWidth, outputHeight),
      cv.INTER_CUBIC,
      cv.BORDER_REPLICATE
    );

    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = outputWidth;
    resultCanvas.height = outputHeight;

    cv.imshow(resultCanvas, output);
    return resultCanvas;
  } finally {
    if (src) src.delete();
    if (srcPoints) srcPoints.delete();
    if (dstPoints) dstPoints.delete();
    if (transform) transform.delete();
    if (output) output.delete();
  }
}
