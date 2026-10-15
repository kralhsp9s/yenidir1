
import { useEffect, useRef, useState } from "react";
import { detectDocument } from "../lib/documentDetection";
import { perspectiveCrop } from "../lib/perspectiveCrop";

export default function CropEditor({
  image,
  onCrop,
  onCancel,
}) {
  const canvasRef = useRef(null);
  const [corners, setCorners] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeCorner, setActiveCorner] = useState(-1);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const detected = await detectDocument(image);

        if (cancelled) return;

        setCorners(
          detected || [
            { x: image.width * 0.05, y: image.height * 0.05 },
            { x: image.width * 0.95, y: image.height * 0.05 },
            { x: image.width * 0.95, y: image.height * 0.95 },
            { x: image.width * 0.05, y: image.height * 0.95 },
          ]
        );
      } catch (err) {
        if (cancelled) return;

        setError(
          "Otomatik köşe algılanamadı. Köşeleri elle ayarlayabilirsin."
        );

        setCorners([
          { x: image.width * 0.05, y: image.height * 0.05 },
          { x: image.width * 0.95, y: image.height * 0.05 },
          { x: image.width * 0.95, y: image.height * 0.95 },
          { x: image.width * 0.05, y: image.height * 0.95 },
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [image]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !corners || !image) return;

    const ctx = canvas.getContext("2d");
    const displayWidth = canvas.clientWidth;
    const displayHeight =
      displayWidth * (image.height / image.width);

    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.round(displayWidth * pixelRatio);
    canvas.height = Math.round(displayHeight * pixelRatio);
    canvas.style.height = `${displayHeight}px`;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

    const sx = displayWidth / image.width;
    const sy = displayHeight / image.height;

    ctx.beginPath();

    corners.forEach((point, index) => {
      const x = point.x * sx;
      const y = point.y * sy;

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.closePath();
    ctx.fillStyle = "rgba(37, 99, 235, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.stroke();

    corners.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x * sx, point.y * sy, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#2563eb";
      ctx.stroke();
    });
  }, [image, corners]);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * image.width,
      y: ((event.clientY - rect.top) / rect.height) * image.height,
    };
  }

  function handlePointerDown(event) {
    if (!corners || loading || busy) return;

    const point = getPoint(event);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const hitRadius = Math.max(
      18,
      (24 / rect.width) * image.width
    );

    const index = corners.findIndex(
      (corner) =>
        Math.hypot(corner.x - point.x, corner.y - point.y) < hitRadius
    );

    if (index !== -1) {
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      setActiveCorner(index);
    }
  }

  function handlePointerMove(event) {
    if (activeCorner === -1 || !corners) return;

    const point = getPoint(event);

    const updated = corners.map((corner, index) =>
      index === activeCorner
        ? {
            x: Math.max(0, Math.min(image.width, point.x)),
            y: Math.max(0, Math.min(image.height, point.y)),
          }
        : corner
    );

    setCorners(updated);
  }

  function handlePointerUp() {
    setActiveCorner(-1);
  }

  async function handleCrop() {
    if (!corners || busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await perspectiveCrop(image, corners);
      onCrop(result);
    } catch (err) {
      console.error(err);
      setError(err.message || "Belge kırpılamadı.");
    } finally {
      setBusy(false);
    }
  }

  if (!image) {
    return <p>Görüntü bulunamadı.</p>;
  }

  return (
    <section className="crop-editor">
      <h2>Belge köşelerini ayarla</h2>

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Belge köşeleri algılanıyor...</p>
      ) : (
        <>
          <p>
            Mavi noktaları sürükleyerek belgenin dört köşesine yerleştir.
          </p>

          <canvas
            ref={canvasRef}
            className="crop-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          <div className="crop-actions">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
            >
              İptal
            </button>

            <button
              type="button"
              onClick={handleCrop}
              disabled={busy || !corners}
            >
              {busy ? "Düzeltiliyor..." : "Belgeyi düzleştir"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
