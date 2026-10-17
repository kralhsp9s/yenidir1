let worker;
let pending = new Map();
let idCounter = 1;

function ensureWorker() {
  if (worker) return worker;

  // Use a classic worker so importScripts inside the worker works.
  worker = new Worker(new URL('../workers/opencvWorker.js', import.meta.url), { type: 'classic' });

  worker.onmessage = (e) => {
    const data = e.data || {};
    const { id, success, error, imageBitmap } = data;
    const entry = pending.get(id);
    if (!entry) {
      console.error(`opencvWorker: received message for unknown id ${id}`, data);
      return;
    }

    clearTimeout(entry.timeout);
    pending.delete(id);

    if (success) {
      // imageBitmap may be present (transferable). Convert to canvas.
      if (imageBitmap) {
        const canvas = imageBitmapToCanvas(imageBitmap);
        try { imageBitmap.close?.(); } catch (e) {}
        entry.resolve(canvas);
      } else {
        entry.resolve(null);
      }
    } else {
      console.error(`opencvWorker ${id} error:`, error);
      entry.reject(new Error(error || 'Worker error'));
    }
  };

  worker.onerror = (err) => {
    console.error('opencvWorker.onerror', err);
    // reject all pending
    for (const [id, entry] of pending) {
      clearTimeout(entry.timeout);
      try {
        entry.reject(err.error || new Error('Worker error'));
      } catch (e) {
        console.error('Error rejecting pending task', id, e);
      }
    }
    pending.clear();
  };

  return worker;
}

function imageBitmapToCanvas(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

async function toImageBitmap(source) {
  // source can be: HTMLCanvasElement, ImageBitmap, File/Blob, HTMLImageElement
  if (!source) throw new Error('No source');
  if (source instanceof ImageBitmap) return source;
  if (source instanceof HTMLCanvasElement) return await createImageBitmap(source);
  if (source instanceof HTMLImageElement) return await createImageBitmap(source);
  if (source instanceof Blob) return await createImageBitmap(source);
  // fallback try to create from source
  return await createImageBitmap(source);
}

function postTask(type, payload, timeoutMs = 45000) {
  ensureWorker();
  const id = String(idCounter++);

  return new Promise(async (resolve, reject) => {
    try {
      // If there's an image in payload, convert to ImageBitmap and transfer
      const sendPayload = { ...payload };

      if (payload && payload.image) {
        const bmp = await toImageBitmap(payload.image);
        sendPayload.imageBitmap = bmp;
        delete sendPayload.image;

        // postMessage with transferable
        const t = [bmp];
        worker.postMessage({ id, type, payload: sendPayload }, t);
      } else if (payload && payload.imageBitmap) {
        // already a bitmap
        const bmp = payload.imageBitmap;
        worker.postMessage({ id, type, payload }, [bmp]);
      } else {
        worker.postMessage({ id, type, payload });
      }

      const timeout = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          console.error(`opencvWorker ${id} timed out after ${timeoutMs}ms`);
          reject(new Error('Worker timeout'));
        }
      }, timeoutMs);

      pending.set(id, { resolve, reject, timeout });
    } catch (err) {
      console.error('postTask error', err);
      reject(err);
    }
  });
}

export async function applyFilter(source, mode = 'magic', options = {}) {
  try {
    const payload = { image: source, mode, options };
    const canvas = await postTask('applyFilter', payload, options.timeoutMs || 60000);
    return canvas;
  } catch (err) {
    console.error('applyFilter error', err);
    // fallback: rethrow, caller can fallback to sync implementation
    throw err;
  }
}

export async function perspectiveCrop(source, corners, options = {}) {
  try {
    const payload = { image: source, corners, maxOutputDimension: options.maxOutputDimension };
    const canvas = await postTask('perspectiveCrop', payload, options.timeoutMs || 60000);
    return canvas;
  } catch (err) {
    console.error('perspectiveCrop error', err);
    throw err;
  }
}
