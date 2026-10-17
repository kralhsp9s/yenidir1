import { useEffect, useRef, useState } from "react";
import CropEditor from "./components/CropEditor";
import FilterPanel from "./components/FilterPanel";
import PageManager from "./components/PageManager";
import PdfExportPanel from "./components/PdfExportPanel";
import CanvasImage from "./components/CanvasImage";
import "./index.css";

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fileToPreviewCanvas(file, maxDimension = 800) {
  let bitmap;

  if ("createImageBitmap" in window) {
    try {
      bitmap = await createImageBitmap(file, {
        resizeWidth: Math.min(maxDimension, 800),
        resizeHeight: Math.min(maxDimension, 800),
        resizeQuality: "low",
      });
    } catch {
      bitmap = await createImageBitmap(file);
    }
  } else {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Görüntü yüklenemedi."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas bağlamı oluşturulamadı.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b)));
    if (!blob) throw new Error("Önizleme canvas üretilemedi.");

    const finalBitmap = await createImageBitmap(blob);
    URL.revokeObjectURL(url);
    return finalBitmap;
  }

  const naturalWidth = bitmap.width || 1;
  const naturalHeight = bitmap.height || 1;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas bağlamı oluşturulamadı.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if (typeof bitmap.close === "function") {
    bitmap.close();
  }

  if ("requestIdleCallback" in window) {
    await new Promise((resolve) => requestIdleCallback(resolve));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return canvas;
}

async function fileToFullCanvas(file, maxDimension = 1800) {
  if (!("createImageBitmap" in window)) {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Görüntü yüklenemedi."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    const naturalWidth = img.naturalWidth || img.width;
    const naturalHeight = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas bağlamı oluşturulamadı.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas;
  }

  const bitmap = await createImageBitmap(file, {
    resizeWidth: Math.min(maxDimension, 1800),
    resizeHeight: Math.min(maxDimension, 1800),
    resizeQuality: "high",
  });

  const naturalWidth = bitmap.width || 1;
  const naturalHeight = bitmap.height || 1;
  const scale = Math.min(1, maxDimension / Math.max(naturalWidth, naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas bağlamı oluşturulamadı.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  if (typeof bitmap.close === "function") {
    bitmap.close();
  }

  if ("requestIdleCallback" in window) {
    await new Promise((resolve) => requestIdleCallback(resolve));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return canvas;
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("belge-tara-theme") || "light";
    } catch {
      return "light";
    }
  });

  const [pages, setPages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [editingPageId, setEditingPageId] = useState(null);
  const [filterPageId, setFilterPageId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const fileQueueRef = useRef([]);
  const processingRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("belge-tara-theme", theme);
    } catch {}
  }, [theme]);

  const selectedPage = pages.find((page) => page.id === selectedId) ?? null;

  async function processNextFile() {
    if (processingRef.current) return;
    processingRef.current = true;

    while (fileQueueRef.current.length > 0) {
      const file = fileQueueRef.current.shift();

      try {
        const previewCanvas = await fileToPreviewCanvas(file, 800);
        const page = {
          id: createId(),
          name: file.name,
          previewCanvas,
          originalFile: file,
          canvas: null,
          filter: "original",
        };

        setPages((current) => [...current, page]);
        setSelectedId((current) => current ?? page.id);

        if ("requestIdleCallback" in window) {
          await new Promise((resolve) => requestIdleCallback(resolve));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      } catch (err) {
        setMessage(err.message || "Fotoğraf işlenemedi.");
      }
    }

    processingRef.current = false;
    setBusy(false);
  }

  function handleFiles(event) {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    event.target.value = "";

    if (files.length === 0) return;

    setBusy(true);
    setMessage("");

    fileQueueRef.current.push(...files);
    setTimeout(() => processNextFile(), 0);
  }

  function updatePage(id, changes) {
    setPages((current) => current.map((page) => (page.id === id ? { ...page, ...changes } : page)));
  }

  async function startEdit(id) {
    const page = pages.find((p) => p.id === id);
    if (!page) return;

    if (page.canvas) {
      setEditingPageId(id);
      return;
    }

    setBusy(true);
    try {
      const full = await fileToFullCanvas(page.originalFile, 1800);
      updatePage(id, { canvas: full });
      setEditingPageId(id);
    } catch (err) {
      setMessage(err.message || "Kırpma için görüntü oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function startFilter(id) {
    const page = pages.find((p) => p.id === id);
    if (!page) return;

    if (page.canvas) {
      setFilterPageId(id);
      return;
    }

    setBusy(true);
    try {
      const full = await fileToFullCanvas(page.originalFile, 1800);
      updatePage(id, { canvas: full });
      setFilterPageId(id);
    } catch (err) {
      setMessage(err.message || "Filtre için görüntü oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  function handleCrop(canvas) {
    if (!editingPageId) return;

    updatePage(editingPageId, {
      canvas,
      filter: "original",
    });

    setSelectedId(editingPageId);
    setEditingPageId(null);
    setMessage("Belge kırpıldı.");
  }

  function deletePage(id) {
    setPages((current) => {
      const remaining = current.filter((page) => page.id !== id);
      setSelectedId((selected) => (selected === id ? remaining[0]?.id ?? null : selected));
      return remaining;
    });

    if (editingPageId === id) setEditingPageId(null);
    if (filterPageId === id) setFilterPageId(null);
  }

  const editingPage = pages.find((page) => page.id === editingPageId) ?? null;
  const filterPage = pages.find((page) => page.id === filterPageId) ?? null;

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">▤</span>
          <div>
            <h1>Belge Tara</h1>
            <p>Belgelerini tara, düzenle ve PDF yap.</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            aria-label={theme === "light" ? "Karanlık temaya geç" : "Aydınlık temaya geç"}
            title={theme === "light" ? "Karanlık tema" : "Aydınlık tema"}
          >
            {theme === "light" ? "🌙 Karanlık" : "☀️ Aydınlık"}
          </button>
          <span className="page-count">{pages.length} sayfa</span>
        </div>
      </header>

      <section className="toolbar">
        <button
          className="primary-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {busy ? "Fotoğraflar ekleniyor..." : "+ Belge ekle"}
        </button>

        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
        />

        <p className="toolbar-hint">
          Telefonundan fotoğraf seçebilir veya galerinden birden fazla belge ekleyebilirsin.
        </p>
      </section>

      {message && (
        <div className="status-message" role="status">
          {message}
          <button
            className="message-close"
            onClick={() => setMessage("")}
            aria-label="Mesajı kapat"
          >
            ×
          </button>
        </div>
      )}

      {pages.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon">📄</div>
          <h2>İlk belgeni ekle</h2>
          <p>Fotoğraf seçerek belge taramaya başlayabilirsin. Ardından köşeleri ayarlayıp filtre uygulayabilirsin.</p>
          <button
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Fotoğraf seç
          </button>
        </section>
      ) : (
        <div className="workspace">
          <section className="editor-panel">
            <div className="section-heading">
              <div>
                <h2>Belge düzenleyici</h2>
                <p>{selectedPage ? selectedPage.name || "Seçili belge" : "Soldan bir sayfa seç"}</p>
              </div>
            </div>

            {selectedPage ? (
              <>
                <div className="preview-area">
                  <CanvasImage
                    canvas={selectedPage.previewCanvas || selectedPage.canvas}
                    quality={0.82}
                    className="document-preview"
                    alt="Seçili belge önizlemesi"
                  />
                </div>

                <div className="action-buttons">
                  <button
                    className="secondary-button"
                    onClick={() => startEdit(selectedPage.id)}
                  >
                    ✂ Köşeleri düzelt / kırp
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => startFilter(selectedPage.id)}
                  >
                    ◐ Filtreler
                  </button>
                </div>

                <p className="current-filter">
                  Aktif filtre: <strong>{selectedPage.filter}</strong>
                </p>
              </>
            ) : (
              <p>Devam etmek için bir sayfa seç.</p>
            )}
          </section>

          <aside className="sidebar">
            <PageManager
              pages={pages}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={deletePage}
              onReorder={setPages}
            />

            <PdfExportPanel pages={pages} />
          </aside>
        </div>
      )}

      {editingPage && (
        <div className="modal-backdrop">
          <section
            className="modal-content crop-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Belge kırpma"
          >
            <CropEditor
              key={editingPage.id}
              image={editingPage.canvas}
              onCrop={handleCrop}
              onCancel={() => setEditingPageId(null)}
            />
          </section>
        </div>
      )}

      {filterPage && (
        <div className="modal-backdrop">
          <section
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Belge filtreleri"
          >
            <button
              className="modal-close"
              onClick={() => setFilterPageId(null)}
              aria-label="Filtre penceresini kapat"
            >
              ×
            </button>

            <FilterPanel
              key={filterPage.id}
              image={filterPage.canvas || filterPage.previewCanvas}
              onApply={(_preview, mode) => {
                updatePage(filterPage.id, { filter: mode });
                setFilterPageId(null);
                setMessage("Filtre seçildi.");
              }}
            />
          </section>
        </div>
      )}

      <footer className="app-footer">
        Belge Tara · Fotoğraflarını düzenle ve PDF olarak kaydet.
      </footer>
    </main>
  );
}
