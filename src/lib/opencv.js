let loadingPromise;

export function loadOpenCV(timeoutMs = 20000) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("OpenCV yalnızca tarayıcıda çalışır."));
  }

  // OpenCV ve WASM tam olarak hazır mı?
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
      document.head.appendChild(script);
    }

    script.addEventListener("error", onError, { once: true });

    // WASM runtime hazır olana kadar kontrol et
    pollId = setInterval(() => {
      if (window.cv && window.cv.Mat && typeof window.cv.Mat === "function") {
        finish(null, window.cv);
      }
    }, 100);

    timeoutId = setTimeout(() => finish(new Error(
      "OpenCV başlatılamadı (zaman aşımı). Manuel köşe ayarını kullanabilir veya sayfayı yenileyebilirsin."
    )), timeoutMs);
  })

  return loadingPromise;
