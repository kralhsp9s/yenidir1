// Worker for OpenCV heavy tasks. Runs in a dedicated thread and uses OffscreenCanvas.
// Messages: { id, type, payload }

let cvReady = false;
let initPromise = null;

function loadOpenCV(timeoutMs = 20000) {
  if (cvReady) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    try {
      // Prefer local copy to avoid CDN/network/CORS problems in production.
      try {
        importScripts('/opencv.js');
      } catch (e) {
        // Fallback to CDN if local file not present
        importScripts('https://docs.opencv.org/4.x/opencv.js');
      }
    } catch (e) {
      reject(e);
      return;
    }

    const start = Date.now();
    const check = () => {
      if (self.cv && self.cv.Mat && typeof self.cv.Mat === 'function') {
        cvReady = true;
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error('OpenCV yüklenemedi (worker).'));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });

  return initPromise;
}

// Helper: render ImageBitmap into OffscreenCanvas and get ImageData -> mat
function imageBitmapToMat(bitmap) {
  const w = bitmap.width;
  const h = bitmap.height;
  const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null;
  const canvas2d = off ? off.getContext('2d') : null;

  if (canvas2d) {
    canvas2d.drawImage(bitmap, 0, 0, w, h);
    const imageData = canvas2d.getImageData(0, 0, w, h);
    const mat = cv.matFromImageData(imageData);
    return { mat, off };
  }

  // Fallback: create an in-worker canvas via OffscreenCanvas polyfill is unlikely, so throw
  throw new Error('OffscreenCanvas desteklenmiyor (worker).');
}

async function applyFilterWorker(id, payload) {
  const { imageBitmap, mode } = payload;

  try {
    await loadOpenCV();

    const { mat: src, off } = imageBitmapToMat(imageBitmap);
    // release the bitmap (transferable already moved)
    try { imageBitmap.close?.(); } catch (e) {}

    const output = new cv.Mat();

    try {
      if (mode === 'gray') {
        cv.cvtColor(src, output, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
      } else if (mode === 'bw') {
        const gray = new cv.Mat();
        try {
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
          cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
          cv.adaptiveThreshold(gray, output, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 12);
          cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
        } finally {
          gray.delete();
        }
      } else if (mode === 'magic') {
        const gray = new cv.Mat();
        const enhanced = new cv.Mat();
        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        try {
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
          clahe.apply(gray, enhanced);
          cv.addWeighted(gray, 0.35, enhanced, 0.65, 0, output);
          cv.cvtColor(output, output, cv.COLOR_GRAY2RGBA);
        } finally {
          gray.delete();
          enhanced.delete();
          clahe.delete();
        }
      } else {
        // original -> draw src back to offscreen canvas
        cv.imshow(off, src);
        const resultBitmap = off.transferToImageBitmap();
        postMessage({ id, success: true, imageBitmap: resultBitmap }, [resultBitmap]);
        return;
      }

      cv.imshow(off, output);
      const resultBitmap = off.transferToImageBitmap();
      postMessage({ id, success: true, imageBitmap: resultBitmap }, [resultBitmap]);
    } finally {
      try { output.delete(); } catch (e) {}
      try { src.delete(); } catch (e) {}
    }
  } catch (err) {
    postMessage({ id, success: false, error: err.message || String(err) });
  }
}

async function perspectiveCropWorker(id, payload) {
  const { imageBitmap, corners, maxOutputDimension = 2400 } = payload;

  try {
    await loadOpenCV();

    const { mat: src, off: tmpOff } = imageBitmapToMat(imageBitmap);
    try { imageBitmap.close?.(); } catch (e) {}

    try {
      const [tl, tr, br, bl] = corners;

      function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      const outputWidth = Math.round(Math.max(distance(tl, tr), distance(bl, br)));
      const outputHeight = Math.round(Math.max(distance(tl, bl), distance(tr, br)));

      const outputScale = Math.min(1, maxOutputDimension / Math.max(outputWidth, outputHeight));
      const safeWidth = Math.max(2, Math.round(outputWidth * outputScale));
      const safeHeight = Math.max(2, Math.round(outputHeight * outputScale));

      const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
      const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, safeWidth - 1, 0, safeWidth - 1, safeHeight - 1, 0, safeHeight - 1]);

      const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
      const result = new cv.Mat();

      try {
        cv.warpPerspective(src, result, transform, new cv.Size(safeWidth, safeHeight), cv.INTER_CUBIC, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));

        const outOff = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(safeWidth, safeHeight) : null;
        if (!outOff) throw new Error('OffscreenCanvas desteklenmiyor (worker).');
        cv.imshow(outOff, result);
        const resultBitmap = outOff.transferToImageBitmap();
        postMessage({ id, success: true, imageBitmap: resultBitmap }, [resultBitmap]);
      } finally {
        try { result.delete(); } catch (e) {}
        try { transform.delete(); } catch (e) {}
        try { dstPoints.delete(); } catch (e) {}
        try { srcPoints.delete(); } catch (e) {}
      }
    } finally {
      try { src.delete(); } catch (e) {}
    }
  } catch (err) {
    postMessage({ id, success: false, error: err.message || String(err) });
  }
}

// Message router
self.onmessage = (e) => {
  const { id, type, payload } = e.data || {};
  if (!id || !type) {
    postMessage({ id: id || null, success: false, error: 'Invalid message' });
    return;
  }

  if (type === 'applyFilter') {
    applyFilterWorker(id, payload);
  } else if (type === 'perspectiveCrop') {
    perspectiveCropWorker(id, payload);
  } else if (type === 'ping') {
    postMessage({ id, success: true, pong: true });
  } else {
    postMessage({ id, success: false, error: 'Unknown type: ' + type });
  }
};
