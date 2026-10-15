
import { useState } from "react";
import { applyDocumentFilter } from "../lib/documentFilters";
import { downloadPdf } from "../lib/pdfExport";

export default function PdfExportPanel({ pages }) {
  const [fileName, setFileName] = useState("taranan-belgeler");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    if (!pages?.length) {
      setError("PDF oluşturmak için önce belge eklemelisin.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const finalPages = [];

      for (const page of pages) {
        if (!page.canvas) {
          throw new Error("Bir sayfanın görüntüsü bulunamadı.");
        }

        // Filtreyi küçük önizleme yerine tam çözünürlüklü görüntüye uygula.
        const finalCanvas = await applyDocumentFilter(
          page.canvas,
          page.filter || "original",
          { maxDimension: Math.max(page.canvas.width, page.canvas.height) }
        );

        finalPages.push({ canvas: finalCanvas });
      }

      downloadPdf(finalPages, fileName);
    } catch (err) {
      console.error(err);
      setError(err.message || "PDF oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pdf-export-panel">
      <h2>PDF oluştur</h2>

      <label htmlFor="pdf-file-name">Dosya adı</label>

      <input
        id="pdf-file-name"
        type="text"
        value={fileName}
        onChange={(event) => setFileName(event.target.value)}
        placeholder="taranan-belgeler"
        disabled={busy}
      />

      <button
        type="button"
        onClick={handleDownload}
        disabled={busy || !pages?.length}
      >
        {busy ? "PDF hazırlanıyor..." : "PDF olarak indir"}
      </button>

      {error && <p role="alert">{error}</p>}
    </section>
  );
}
