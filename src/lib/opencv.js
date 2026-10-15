
let loadingPromise;

export function loadOpenCV() {
  if (window.cv?.Mat) {
    return Promise.resolve(window.cv);
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("#opencv-script");

    const script = existing || document.createElement("script");
    script.id = "opencv-script";
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;

    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;

      if (error) {
        loadingPromise = null;
        reject(error);
      } else {
        resolve(window.cv);
      }
    };

    script.onerror = () => {
      finish(new Error("OpenCV yüklenemedi. İnternet bağlantını kontrol et."));
    };

    script.onload = () => {
      const startedAt = Date.now();

      const waitForRuntime = () => {
        const cv = window.cv;

        if (cv?.Mat && cv?.getPerspectiveTransform) {
          finish();
          return;
        }

        if (Date.now() - startedAt > 30000) {
          finish(new Error("OpenCV başlatılamadı."));
          return;
        }

        setTimeout(waitForRuntime, 100);
      };

      waitForRuntime();
    };

    if (!existing) {
      document.head.appendChild(script);
    } else if (window.cv?.Mat) {
      finish();
    }
  });

  return loadingPromise;
}
