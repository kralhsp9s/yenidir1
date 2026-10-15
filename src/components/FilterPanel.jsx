
import { useEffect, useRef, useState } from "react";
import { applyDocumentFilter } from "../lib/documentFilters";

const FILTERS = [
  { id: "original", label: "Orijinal" },
  { id: "magic", label: "Sihirli" },
  { id: "gray", label: "Gri tonlama" },
  { id: "bw", label: "Siyah-beyaz" },
];

export default function FilterPanel({ image, onApply }) {
  const [mode, setMode] = useState("magic");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    const currentRequest = ++requestId.current;

    async function createPreview() {
      setBusy(true);
      setError("");

      try {
        // Önizleme hızlı olsun diye en fazla 1400 piksel kullan.
        const canvas = await applyDocumentFilter(image, mode, {
          maxDimension: 1400,
        });

        if (!cancelled && currentRequest === requestId.current) {
          setPreview(canvas);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Filtre uygulanamadı.");
        }
      } finally {
        if (!cancelled && currentRequest === requestId.current) {
          setBusy(false);
        }
      }
    }

    createPreview();

    return () => {
      cancelled = true;
    };
  }, [image, mode]);

  function applyFilter() {
    if (!preview || busy) return;
    onApply(preview, mode);
  }

  if (!image) {
    return <p>Önce bir belge seçmelisin.</p>;
  }

  return (
    <section className="filter-panel">
      <h2>Belge filtresi</h2>

      <div className="filter-options">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={mode === filter.id ? "active" : ""}
            onClick={() => {
              setMode(filter.id);
              setPreview(null);
            }}
            disabled={busy && mode === filter.id}
            aria-pressed={mode === filter.id}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {busy && <p>Önizleme hazırlanıyor...</p>}
      {error && <p role="alert">{error}</p>}

      {preview && !busy && (
        <div className="filter-preview">
          <img
            src={preview.toDataURL("image/jpeg", 0.85)}
            alt={`${mode} filtre önizlemesi`}
          />
        </div>
      )}

      <button
        type="button"
        className="apply-filter-button"
        onClick={applyFilter}
        disabled={!preview || busy}
      >
        Bu filtreyi seç
      </button>
    </section>
  );
}
