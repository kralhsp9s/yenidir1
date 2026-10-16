let loadingPromise;

/**
 * Load OpenCV once and wait for its WASM runtime. Start polling immediately,
 * not only from script.onload: when a script tag already exists, load may
 * have fired before this module attached its listener, leaving the UI stuck.
 */
export function loadOpenCV(timeoutMs = 20000) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV yalnızca tarayıcıda çalışır."));
  }

  if (window.cv?.Mat && window.cv?.getPerspectiveTransform) {
    return Promise.resolve(window.cv);
  }
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    let settled = false;
    let pollId;
    let timeoutId;
    let script = document.querySelector("#opencv-script");

    const cleanup = () => {
      if (pollId) clearInterval(pollId);
      if (timeoutId) clearTimeout(timeoutId);
      if (script) script.removeEventListener("error", onError);
    };

    const finish = (error, cv) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        loadingPromise = null;
        reject(error);
      } else {
        resolve(cv);
      }
    };

    const onError = () => finish(new Error(
      "OpenCV yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenile."
    ));

    if (!script) {
      script = document.createElement("script");
      script.id = "opencv-script";
      script.src = "https://docs.opencv.org/4.x/opencv.js";
      script.async = true;
    }

    script.addEventListener("error", onError, { once: true });

    // Poll even if the script tag already existed and its load event has passed.
    pollId = setInterval(() => {
      const cv = window.cv;
      if (cv?.Mat && cv?.getPerspectiveTransform) finish(null, cv);
    }, 100);

    timeoutId = setTimeout(() => finish(new Error(
      "OpenCV başlatılamadı (zaman aşımı). Manuel köşe ayarını kullanabilir veya sayfayı yenileyebilirsin."
    )), timeoutMs);

    if (!script.isConnected) document.head.appendChild(script);
  });

  return loadingPromise;
}
