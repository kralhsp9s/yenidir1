import { loadOpenCV } from "./opencv.js";

export async function applyDocumentFilter(sourceCanvas, mode = "magic", options = {}) {
  if (!sourceCanvas) throw new Error("Filtre uygulanacak görüntü bulunamadı.");

  const maxDimension = options.maxDimension ?? Infinity;
  const scale = Math.min(1, maxDimension / Math.max(sourceCanvas.width, sourceCanvas.height));
  const width = Math.max(1, Math.round(sourceCanvas.width * scale));
  const height = Math.max(1, Math.round(sourceCanvas.height * scale));

  const inputCanvas = document.createElement("canvas");
  inputCanvas.width = width;
  inputCanvas.height = height;
  inputCanvas.getContext("2d").drawImage(sourceCanvas, 0, 0, width, height);

  if (mode === "original") return inputCanvas;

  const cv = await loadOpenCV();
  const src = cv.imread(inputCanvas);
  const output = new cv.Mat();

  if (mode === "gray") {
    cv.cvtColor(src, output, cv.COLOR_RGBA2GRAY);
    cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
  } 
  else if (mode === "bw") {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.adaptiveThreshold(gray, output, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 12);
    cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
    gray.delete();
  } 
  else if (mode === "magic") {
    const gray = new cv.Mat();
    const enhanced = new cv.Mat();
    const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    clahe.apply(gray, enhanced);
    cv.addWeighted(gray, 0.35, enhanced, 0.65, 0, output);
    cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);

    gray.delete();
    enhanced.delete();
    clahe.delete();
  } 
  else {
    src.delete();
    output.delete();
    throw new Error(`Bilinmeyen filtre: ${mode}`);
  }

  const resultCanvas = document.createElement("canvas");
  cv.imshow(resultCanvas, output);

  src.delete();
  output.delete();

  return resultCanvas;}
      
