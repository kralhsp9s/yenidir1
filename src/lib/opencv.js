
let loadingPromise;

export function loadOpenCV() {
  if (window.cv?.Mat && window.cv?.getPerspectiveTransform) {
    return Promise.resolve(window.cv);
  }

  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      loadingPromise = null;
      reject(new Error("OpenCV yüklenemedi. İnternet bağlantını kontrol et."));
    }, 30000);

    function checkReady() {
      if (window.cv?.Mat && window.cv?.getPerspectiveTransform) {
        clearTimeout(timeout);
        resolve(window.cv);
        return true;
      }
      return false;
    }

    const existing = document.querySelector('script[data-opencv="true"]');

    if (existing) {
      const started = Date.now();
      const poll = setInterval(() => {
        if (checkReady()) clearInterval(poll);
        else if (Date.now() - started > 30000) {
          clearInterval(poll);
          clearTimeout(timeout);
          loadingPromise = null;
          reject(new Error("OpenCV başlatılamadı."));
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    script.dataset.opencv = "true";

    script.onload = () => {
      const started = Date.now();
      const poll = setInterval(() => {
        if (checkReady()) clearInterval(poll);
        else if (Date.now() - started > 30000) {
          clearInterval(poll);
          clearTimeout(timeout);
          loadingPromise = null;
          reject(new Error("OpenCV başlatılamadı."));
        }
      }, 100);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      loadingPromise = null;
      reject(new Error("OpenCV dosyası indirilemedi."));
    };

    document.head.appendChild(script);
  });

  return loadingPromise;
}
