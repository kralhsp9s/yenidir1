
import { loadOpenCV } from "./opencv";

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export async function perspectiveCrop(sourceCanvas, corners) {
  if (!sourceCanvas || !corners || corners.length !== 4) {
    throw new Error("Belge görüntüsü veya dört köşe eksik.");
  }

  const cv = await loadOpenCV();

  const [tl, tr, br, bl] = corners;

  const outputWidth = Math.round(
    Math.max(distance(tl, tr), distance(bl, br))
  );

  const outputHeight = Math.round(
    Math.max(distance(tl, bl), distance(tr, br))
  );

  if (outputWidth < 2 || outputHeight < 2) {
    throw new Error("Belge boyutları geçersiz.");
  }

  const src = cv.imread(sourceCanvas);
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    tl.x, tl.y,
    tr.x, tr.y,
    br.x, br.y,
    bl.x, bl.y,
  ]);

  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    outputWidth - 1, 0,
    outputWidth - 1, outputHeight - 1,
    0, outputHeight - 1,
  ]);

  const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
  const result = new cv.Mat();

  try {
    cv.warpPerspective(
      src,
      result,
      transform,
      new cv.Size(outputWidth, outputHeight),
      cv.INTER_CUBIC,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    const outputCanvas = document.createElement("canvas");
    cv.imshow(outputCanvas, result);

    return outputCanvas;
  } finally {
    src.delete();
    srcPoints.delete();
    dstPoints.delete();
    transform.delete();
    result.delete();
  }
}
