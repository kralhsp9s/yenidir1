import { useEffect, useState } from "react";

// Canvas'ı her render'da base64'e çevirmek yerine JPEG'i bir kez üret.
export default function CanvasImage({ canvas, quality = 0.82, className, alt = "" }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!canvas) {
      setSrc("");
      return;
    }

    let objectUrl = "";
    let cancelled = false;
    canvas.toBlob((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    }, "image/jpeg", quality);

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canvas, quality]);

  return <img className={className} src={src || undefined} alt={alt} />;
}
