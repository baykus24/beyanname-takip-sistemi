import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Exports an array of objects to an Excel file.
 * @param {Array<Object>} data The data to export.
 * @param {string} fileName The name of the file (without extension).
 * @param {string} sheetName The name of the worksheet.
 */
export const exportToExcel = (data, fileName, sheetName = 'Sheet1') => {
  if (!data || data.length === 0) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/**
 * Exports an array of objects to a PDF file.
 * @param {string} title The title of the document.
 * @param {Array<{header: string, dataKey: string}>} columns The column definitions for jspdf-autotable.
 * @param {Array<Object>} data The data to export.
 * @param {string} fileName The name of the file (without extension).
 */
export const exportToPdf = (title, columns, data, fileName) => {
  if (!data || data.length === 0) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  
  const doc = new jsPDF();

  // Türkçe karakter sorununu önlemek için bir font dosyası eklemek en iyi yöntemdir,
  // ancak şimdilik standart fontlarla deniyoruz.
  doc.text(title, 14, 15);

  doc.autoTable({
    startY: 20,
    head: [columns.map(col => col.header)],
    body: data.map(row => columns.map(col => row[col.dataKey] || '')),
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(`${fileName}.pdf`);
};
