
import { jsPDF } from "jspdf";

export function downloadPdf(pages, fileName = "belgelerim") {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("PDF oluşturmak için en az bir sayfa gerekli.");
  }

  let pdf;

  pages.forEach((page, index) => {
    const canvas = page.canvas;

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error(`${index + 1}. sayfanın görüntüsü geçersiz.`);
    }

    const orientation =
      canvas.width > canvas.height ? "landscape" : "portrait";

    if (index === 0) {
      pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "a4",
        compress: true,
      });
    } else {
      pdf.addPage("a4", orientation);
    }

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 5;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const scale = Math.min(
      availableWidth / canvas.width,
      availableHeight / canvas.height
    );

    const width = canvas.width * scale;
    const height = canvas.height * scale;

    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    const imageData = canvas.toDataURL("image/jpeg", 0.95);

    pdf.addImage(
      imageData,
      "JPEG",
      x,
      y,
      width,
      height,
      undefined,
      "FAST"
    );
  });

  const safeName =
    String(fileName)
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\.pdf$/i, "") || "belgelerim";

  pdf.save(`${safeName}.pdf`);
}
