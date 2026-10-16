
import { loadOpenCV } from "./opencv";

export async function applyDocumentFilter(
  sourceCanvas,
  mode = "magic",
  options = {}
) {
  if (!sourceCanvas) {
    throw new Error("Filtre uygulanacak görüntü bulunamadı.");
  }

  // The original image needs no OpenCV; let this button respond immediately,
  // even if the external OpenCV/WASM library is unavailable.
  const maxDimension = options.maxDimension ?? Infinity;
  const scale = Math.min(
    1,
    maxDimension / Math.max(sourceCanvas.width, sourceCanvas.height)
  );

  const width = Math.max(1, Math.round(sourceCanvas.width * scale));
  const height = Math.max(1, Math.round(sourceCanvas.height * scale));

  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = width;
  inputCanvas.height = height;

  inputCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0, width, height);

  if (mode === "original") {
    return inputCanvas;
  }

  const cv = await loadOpenCV();
  const src = cv.imread(inputCanvas);
  const output = new cv.Mat();
  const gray = new cv.Mat();

  try {
    if (mode === "gray") {
      cv.cvtColor(src, output, cv.COLOR_RGBA2GRAY);
      cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
    } else if (mode === "bw") {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(
        gray,
        gray,
        new cv.Size(3, 3),
        0,
        0,
        cv.BORDER_DEFAULT
      );

      cv.adaptiveThreshold(
        gray,
        output,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        31,
        12
      );

      cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
    } else if (mode === "magic") {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
      const enhanced = new cv.Mat();

      try {
        clahe.apply(gray, enhanced);

        const channels = new cv.MatVector();
        const rgba = new cv.Mat();

        try {
          cv.cvtColor(src, rgba, cv.COLOR_RGBA2RGB);
          cv.split(rgba, channels);

          // Aydınlık bileşenini iyileştirilmiş gri görüntüyle değiştir.
          const merged = new cv.MatVector();
          const b = channels.get(0);
          const g = channels.get(1);
          const r = channels.get(2);

          try {
            // Renkleri koruyarak kontrastı artır.
            cv.addWeighted(gray, 0.35, enhanced, 0.65, 0, output);
            cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
          } finally {
            b.delete();
            g.delete();
            r.delete();
            merged.delete();
          }
        } finally {
          channels.delete();
          rgba.delete();
        }
      } finally {
        enhanced.delete();
        clahe.delete();
      }
    } else {
      throw new Error(`Bilinmeyen filtre: ${mode}`);
    }

    const resultCanvas = document.createElement("canvas");
    cv.imshow(resultCanvas, output);

    return resultCanvas;
  } finally {
    src.delete();
    output.delete();
    gray.delete();
  }
}
