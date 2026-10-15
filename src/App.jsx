
import { useState } from "react";
import CropEditor from "./components/CropEditor";
import PdfExportPanel from "./components/PdfExportPanel";
import "./index.css";

function imageToCanvas(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);

      URL.revokeObjectURL(url);

      resolve({
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        name: file.name,
        canvas,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} açılamadı.`));
    };

    image.src = url;
  });
}

export default function App() {
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [error, setError] = useState("");

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    setError("");

    try {
      const added = await Promise.all(files.map(imageToCanvas));

      setPages((current) => [...current, ...added]);

      if (added.length > 0) {
        setSelectedPageId(added[0].id);
      }
    } catch (err) {
      setError(err.message || "Görseller yüklenemedi.");
    }

    event.target.value = "";
  }

  function removePage(id) {
    setPages((current) => current.filter((page) => page.id !== id));

    if (selectedPageId === id) {
      setSelectedPageId(null);
    }
  }

  function movePage(index, direction) {
    setPages((current) => {
      const next = [...current];
      const target = index + direction;

      if (target < 0 || target >= next.length) return current;

      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleCropped(canvas) {
    setPages((current) =>
      current.map((page) =>
        page.id === selectedPageId
          ? { ...page, canvas }
          : page
      )
    );

    setSelectedPageId(null);
  }

  const selectedPage = pages.find(
    (page) => page.id === selectedPageId
  );

  return (
    <main className="app">
      <h1>Belge Tarayıcı</h1>
      <p>Görsel yükle, belgeni kırp, sayfaları sırala ve PDF indir.</p>

      <label className="upload">
        Görsel seç
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
        />
      </label>

      {error && <p role="alert">{error}</p>}

      <section className="page-list">
        {pages.map((page, index) => (
          <article className="page-card" key={page.id}>
            <img
              src={page.canvas.toDataURL("image/jpeg", 0.9)}
              alt={`${index + 1}. sayfa`}
            />

            <p>{index + 1}. sayfa — {page.name}</p>

            <div className="page-actions">
              <button
                type="button"
                onClick={() => setSelectedPageId(page.id)}
              >
                Kırp / düzenle
              </button>

              <button
                type="button"
                onClick={() => movePage(index, -1)}
                disabled={index === 0}
              >
                ↑
              </button>

              <button
                type="button"
                onClick={() => movePage(index, 1)}
                disabled={index === pages.length - 1}
              >
                ↓
              </button>

              <button
                type="button"
                onClick={() => removePage(page.id)}
              >
                Sil
              </button>
            </div>
          </article>
        ))}
      </section>

      {selectedPage && (
        <CropEditor
          key={selectedPage.id}
          imageCanvas={selectedPage.canvas}
          onCropped={handleCropped}
          onCancel={() => setSelectedPageId(null)}
        />
      )}

      <PdfExportPanel pages={pages} />
    </main>
  );
}
