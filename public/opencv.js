(() => {
  if (typeof window === "undefined") return;
  if (window.cv && window.cv.Mat && typeof window.cv.Mat === "function") return;
  if (document.querySelector('script[data-opencv-loader="true"]')) return;

  const script = document.createElement("script");
  script.async = true;
  script.dataset.opencvLoader = "true";
  script.src = "https://docs.opencv.org/4.13.0/opencv.js";
  script.onerror = () => {
    console.error("OpenCV loader failed: could not load https://docs.opencv.org/4.13.0/opencv.js");
  };

  document.head.appendChild(script);
})();
