import React from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

function ExportButtons({ data }) {
  const handleExcel = () => {
    const wsData = [
      ['Dönem', 'Beyanname Türü', 'Müşteri Adı', 'Defter Türü', 'Durum', 'Tamamlanma Tarihi', 'Not']
    ];
    data.forEach(d => {
      wsData.push([
        `${MONTHS[d.month - 1]} / ${d.year}`,
        d.type,
        d.customer_name,
        d.ledger_type,
        d.status,
        d.completed_at || '-',
        d.note || ''
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Beyanname Takip');
    XLSX.writeFile(wb, 'beyanname_takip.xlsx');
  };

  const handlePDF = () => {
    const doc = new jsPDF();
    doc.text('Beyanname Takip Listesi', 14, 16);
    doc.autoTable({
      head: [[
        'Dönem', 'Beyanname Türü', 'Müşteri Adı', 'Defter Türü', 'Durum', 'Tamamlanma Tarihi', 'Not'
      ]],
      body: data.map(d => [
        `${MONTHS[d.month - 1]} / ${d.year}`,
        d.type,
        d.customer_name,
        d.ledger_type,
        d.status,
        d.completed_at || '-',
        d.note || ''
      ]),
      startY: 22
    });
    doc.save('beyanname_takip.pdf');
  };

  return (
    <div style={{ margin: '16px 0', textAlign: 'right' }}>
      <button onClick={handleExcel} style={{ marginRight: 8 }}>Excel Çıktısı</button>
      <button onClick={handlePDF}>PDF Çıktısı</button>
    </div>
  );
}

export default ExportButtons;
