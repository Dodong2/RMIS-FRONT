import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportSection {
  heading: string;
  head: string[];
  body: (string | number)[][];
}

export interface ExportDoc {
  title: string;
  scope: string;
  sections: ExportSection[];
}

const pdfSafe = (v: string | number) => String(v).replace(/₱/g, "PHP ");

function fileBase(doc: ExportDoc) {
  const date = new Date().toISOString().slice(0, 10);
  return `${doc.title}_${doc.scope}_${date}`.replace(/[^a-z0-9]+/gi, "_");
}

export function exportPdf(doc: ExportDoc) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(13, 42, 94);
  pdf.rect(0, 0, pageW, 14, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("Laguna State Polytechnic University — Research Management Information System", 10, 9.5);

  let y = 22;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(13);
  pdf.text(doc.title, 10, y);
  y += 7;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Scope: ${doc.scope}  |  Generated: ${new Date().toLocaleString("en-PH")}`, 10, y);
  pdf.setTextColor(0, 0, 0);
  y += 6;

  for (const section of doc.sections) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(section.heading, 10, y + 2);
    autoTable(pdf, {
      startY: y + 4,
      head: [section.head],
      body: section.body.length
        ? section.body.map((row) => row.map(pdfSafe))
        : [["No actual data", ...section.head.slice(1).map(() => "")]],
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [13, 42, 94], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  pdf.save(`${fileBase(doc)}.pdf`);
}

export function exportXlsx(doc: ExportDoc) {
  const rows: (string | number)[][] = [
    ["LSPU Research Management Information System"],
    [doc.title],
    [`Scope: ${doc.scope}  |  Generated: ${new Date().toLocaleString("en-PH")}`],
  ];
  for (const section of doc.sections) {
    rows.push([], [section.heading], section.head, ...(section.body.length ? section.body : [["No actual data"]]));
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 50 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${fileBase(doc)}.xlsx`);
}
