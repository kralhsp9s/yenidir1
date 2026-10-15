
import { jsPDF } from "jspdf";

export function downloadPdf(pages, fileName = "taranan-belge") {
  if (!pages?.length) {
    throw new Error("PDF oluşturmak için en az bir sayfa gerekli.");
  }

  const safeName =
    String(fileName || "taranan-belge")
      .trim()
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .slice(0, 100) || "taranan-belge";

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  pages.forEach((page, index) => {
    const canvas = page.canvas;

    if (!canvas || !canvas.width || !canvas.height) {
      throw new Error(`${index + 1}. sayfa hazır değil.`);
    }

    const landscape = canvas.width > canvas.height;

    if (index > 0) {
      pdf.addPage("a4", landscape ? "landscape" : "portrait");
    } else if (landscape) {
      pdf.deletePage(1);
      pdf.addPage("a4", "landscape");
    }

    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    const margin = 5;

    const scale = Math.min(
      (pageWidth - margin * 2) / canvas.width,
      (pageHeight - margin * 2) / canvas.height
    );

    const width = canvas.width * scale;
    const height = canvas.height * scale;
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.95),
      "JPEG",
      x,
      y,
      width,
      height,
      undefined,
      "FAST"
    );
  });

  pdf.save(`${safeName}.pdf`);
}
