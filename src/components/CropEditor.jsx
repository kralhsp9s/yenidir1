
import { useEffect, useRef, useState } from "react";
import { detectDocumentCorners } from "../lib/documentDetection";
import { cropPerspective } from "../lib/perspectiveCrop";

export default function CropEditor({ imageCanvas, onCropped, onCancel }) {
  const canvasRef = useRef(null);
  const [corners, setCorners] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("Belge aranıyor...");
  const [error, setError] = useState("");
  const dragging = useRef(-1);

  useEffect(() => {
    if (!imageCanvas) return;

    let cancelled = false;
    const view = canvasRef.current;
    const ctx = view.getContext("2d");

    view.width = imageCanvas.width;
    view.height = imageCanvas.height;
    ctx.drawImage(imageCanvas, 0, 0);

    async function detect() {
      setLoading(true);
      setError("");

      try {
        const result = await detectDocumentCorners(imageCanvas);

        if (cancelled) return;

        if (result.found) {
          setCorners(result.corners);
          setMessage(result.message);
        } else {
          // Algılama başarısızsa düzenlenebilir başlangıç köşeleri.
          const w = imageCanvas.width;
          const h = imageCanvas.height;
          const insetX = w * 0.06;
          const insetY = h * 0.06;

          setCorners([
            { x: insetX, y: insetY },
            { x: w - insetX, y: insetY },
            { x: w - insetX, y: h - insetY },
            { x: insetX, y: h - insetY },
          ]);
          setMessage(result.message);
        }
      } catch (err) {
        if (cancelled) return;

        const w = imageCanvas.width;
        const h = imageCanvas.height;

        setCorners([
          { x: w * 0.06, y: h * 0.06 },
          { x: w * 0.94, y: h * 0.06 },
          { x: w * 0.94, y: h * 0.94 },
          { x: w * 0.06, y: h * 0.94 },
        ]);

        setMessage("Otomatik algılama kullanılamadı; köşeleri elle ayarla.");
        setError(err.message || "OpenCV yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    detect();

    return () => {
      cancelled = true;
    };
  }, [imageCanvas]);

  useEffect(() => {
    if (!corners || !canvasRef.current || !imageCanvas) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageCanvas, 0, 0);

    ctx.beginPath();
    corners.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();

    ctx.fillStyle = "rgba(20, 120, 255, 0.16)";
    ctx.fill();

    ctx.strokeStyle = "#1683ff";
    ctx.lineWidth = Math.max(3, canvas.width / 500);
    ctx.stroke();

    corners.forEach((point) => {
      ctx.beginPath();
      ctx.arc(
        point.x,
        point.y,
        Math.max(12, canvas.width / 70),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = Math.max(3, canvas.width / 500);
      ctx.strokeStyle = "#1683ff";
      ctx.stroke();
    });
  }, [corners, imageCanvas]);

  function getPosition(event) {
    const rect = canvasRef.current.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) *
        (canvasRef.current.width / rect.width),
      y: (event.clientY - rect.top) *
        (canvasRef.current.height / rect.height),
    };
  }

  function handlePointerDown(event) {
    if (!corners) return;

    const position = getPosition(event);
    const hitRadius = Math.max(30, canvasRef.current.width / 25);

    const index = corners.findIndex(
      (point) => Math.hypot(
        point.x - position.x,
        point.y - position.y
      ) < hitRadius
    );

    if (index !== -1) {
      dragging.current = index;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event) {
    if (dragging.current === -1) return;

    const position = getPosition(event);
    const index = dragging.current;

    setCorners((previous) =>
      previous.map((point, i) =>
        i === index
          ? {
              x: Math.max(0, Math.min(imageCanvas.width, position.x)),
              y: Math.max(0, Math.min(imageCanvas.height, position.y)),
            }
          : point
      )
    );
  }

  function handlePointerUp() {
    dragging.current = -1;
  }

  async function handleCrop() {
    setError("");

    if (!corners) {
      setError("Köşeler henüz hazır değil.");
      return;
    }

    setProcessing(true);

    try {
      const cropped = await cropPerspective(imageCanvas, corners);
      onCropped(cropped);
    } catch (err) {
      setError(err.message || "Kırpma işlemi başarısız.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="crop-editor">
      <h2>Belgeyi kırp</h2>
      <p>{message}</p>

      <div className="crop-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="crop-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {loading && <p>Belge köşeleri aranıyor...</p>}
      {error && <p className="crop-error" role="alert">{error}</p>}

      <div className="crop-actions">
        <button
          type="button"
          onClick={handleCrop}
          disabled={loading || processing || !corners}
        >
          {processing ? "Kırpılıyor..." : "Belgeyi kırp"}
        </button>

        {onCancel && (
          <button type="button" onClick={onCancel}>
            Vazgeç
          </button>
        )}
      </div>
    </section>
  );
}

