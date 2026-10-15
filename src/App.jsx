
import { useEffect, useState } from "react";
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

      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);

      URL.revokeObjectURL(url);
      resolve({
        id: `${Date.now()}-${Math.random()}`,
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
  const [error, setError] = useState("");

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    setError("");

    try {
      const newPages = await Promise.all(files.map(imageToCanvas));
      setPages((current) => [...current, ...newPages]);
    } catch (err) {
      setError(err.message || "Görseller yüklenemedi.");
    }

    // Aynı dosyayı tekrar seçebilmeye izin verir.
    event.target.value = "";
  }

  function removePage(id) {
    setPages((current) => current.filter((page) => page.id !== id));
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

  useEffect(() => {
    return () => {
      // Sayfalar kaldırılırken ayrıca oluşturulmuş nesne URL'leri
      // kullanıyorsan onları da temizlemelisin.
    };
  }, []);

  return (
    <main className="app">
      <h1>Belge Tarayıcı</h1>
      <p>Görsellerini seç, sırala ve PDF olarak indir.</p>

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

            <p>
              {index + 1}. sayfa — {page.name}
            </p>

            <div className="page-actions">
              <button
                onClick={() => movePage(index, -1)}
                disabled={index === 0}
              >
                ↑ Yukarı
              </button>

              <button
                onClick={() => movePage(index, 1)}
                disabled={index === pages.length - 1}
              >
                ↓ Aşağı
              </button>

              <button onClick={() => removePage(page.id)}>
                Sil
              </button>
            </div>
          </article>
        ))}
      </section>

      <PdfExportPanel pages={pages} />
    </main>
  );
}
