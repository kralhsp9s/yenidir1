
import { useState } from "react";
import { downloadPdf } from "../lib/pdfExport";

export default function PdfExportPanel({ pages }) {
  const [fileName, setFileName] = useState("belgelerim");
  const [error, setError] = useState("");

  function handleDownload() {
    try {
      setError("");
      downloadPdf(pages, fileName);
    } catch (err) {
      setError(err.message || "PDF oluşturulamadı.");
    }
  }

  return (
    <section className="pdf-panel">
      <label htmlFor="fileName">PDF dosya adı</label>

      <input
        id="fileName"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        placeholder="Örn. ders-notlari"
        maxLength={100}
      />

      <p>PDF'ye eklenecek sayfa: {pages.length}</p>

      {error && <p role="alert">{error}</p>}

      <button
        type="button"
        onClick={handleDownload}
        disabled={pages.length === 0}
      >
        PDF'yi indir
      </button>
    </section>
  );
}
