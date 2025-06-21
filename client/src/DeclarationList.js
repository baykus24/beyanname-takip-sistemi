import React, { useState } from 'react';
import axios from 'axios';
import { exportToExcel, exportToPdf } from './exportUtils';
import './DeclarationList.css';
import ConfirmModal from './ConfirmModal';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];
const STATUS_OPTIONS = [
  { value: 'Bekliyor', label: 'Bekliyor' },
  { value: 'Tamamlandı', label: 'Tamamlandı' },
];

const YEARS = Array.from({ length: new Date().getFullYear() - 2019 }, (_, i) => new Date().getFullYear() - i);



const formatFirestoreTimestamp = (timestamp) => {
  if (!timestamp) {
    return '-';
  }
  // Firestore Timestamps have a toDate() method.
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('tr-TR');
  }
  // Fallback for serialized timestamps.
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toLocaleDateString('tr-TR');
  }
  // Handle ISO strings which might come from older data or direct updates.
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('tr-TR');
    }
  }
  // If it's not a recognizable format.
  return 'Geçersiz Tarih';
};

function DeclarationList({ declarations, refetchDeclarations, declarationTypes = [], ledgerTypes = [] }) {

  const [filters, setFilters] = useState({
    month: '',
    year: '',
    type: '',
    ledger: '',
    status: '',
  });
  const [noteEdit, setNoteEdit] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);



  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const filteredDeclarations = (declarations || [])
    .filter(d => {
      const m = filters.month ? d.month === parseInt(filters.month) : true;
      const y = filters.year ? d.year === parseInt(filters.year) : true;
      const t = filters.type ? d.type === filters.type : true;
      const l = filters.ledger ? d.ledger_type === filters.ledger : true;
      const s = filters.status ? d.status === filters.status : true;
      return m && y && t && l && s;
    })
    .sort((a, b) => {
      if (a.customer_name && b.customer_name) {
        return a.customer_name.localeCompare(b.customer_name, 'tr');
      }
      return 0;
    });

  const handleStatusChange = async (id, newStatus) => {
    const completedAt = newStatus === 'Tamamlandı' ? new Date().toISOString().slice(0, 10) : null;
    await axios.put(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${id}`, {
      status: newStatus,
      completed_at: completedAt,
      note: declarations.find(d => d.id === id)?.note || ''
    });
    refetchDeclarations();
  };

  const handleNoteChange = (id, value) => {
    setNoteEdit({ ...noteEdit, [id]: value });
  };

  const handleNoteSave = async (id) => {
    const note = noteEdit[id] || '';
    await axios.put(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${id}`, {
      status: declarations.find(d => d.id === id)?.status,
      completed_at: declarations.find(d => d.id === id)?.completed_at,
      note,
    });
    refetchDeclarations();
    setNoteEdit({ ...noteEdit, [id]: undefined });
  };

  const openDeleteModal = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${deleteId}`);
      refetchDeclarations();
    } catch (err) {
      alert('Silme işlemi sırasında hata oluştu.');
    }
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  const handleExportExcel = () => {
    const dataToExport = filteredDeclarations.map(d => ({
      'Müşteri Adı': d.customer_name,
      'Beyanname Türü': d.type,
      'Dönem': `${d.month}/${d.year}`,
      'Durum': d.status,
    }));
    exportToExcel(dataToExport, 'beyanname_listesi', 'Beyannameler');
  };

  const handleExportPdf = () => {
    const columns = [
      { header: 'Müşteri Adı', dataKey: 'customer_name' },
      { header: 'Beyanname Türü', dataKey: 'type' },
      { header: 'Dönem', dataKey: 'period' }, 
      { header: 'Durum', dataKey: 'status' },
    ];
    const dataToExport = filteredDeclarations.map(d => ({ ...d, period: `${d.month}/${d.year}` }));
    exportToPdf('Beyanname Listesi', columns, dataToExport, 'beyanname_listesi');
  };

  return (
    <div className="decl-list-container">
      <h2>Beyanname Takip Listesi</h2>
      <ConfirmModal
        open={showDeleteModal}
        title="Beyanname Silme Onayı"
        message="Bu beyannamenin silinmesini onaylıyor musunuz?"
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeleteId(null); }}
      />
      <div className="export-buttons">
        <button onClick={handleExportExcel} className="export-btn excel">Excel'e Aktar</button>
        <button onClick={handleExportPdf} className="export-btn pdf">PDF'e Aktar</button>
      </div>
      <div className="filters">
        <select name="month" value={filters.month} onChange={handleFilterChange}>
          <option value="">Ay Seçin</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select name="year" value={filters.year} onChange={handleFilterChange}>
          <option value="">Yıl Seçin</option>
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select name="type" value={filters.type} onChange={handleFilterChange}>
          <option value="">Beyanname Türü Seçin</option>
          {declarationTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select name="ledger" value={filters.ledger} onChange={handleFilterChange}>
          <option value="">Defter Türü Seçin</option>
          {ledgerTypes.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">Durum Seçin</option>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <table className="decl-table">
        <thead>
          <tr>
            <th>Dönem</th>
            <th>Beyanname Türü</th>
            <th>Müşteri Adı</th>
            <th>Defter Türü</th>
            <th>Durum</th>
            <th>Tamamlanma Tarihi</th>
            <th>Not</th>
          </tr>
        </thead>
        <tbody>
          {filteredDeclarations.map(d => (
            <tr key={d.id}>
              <td>{MONTHS[d.month - 1]} / {d.year}</td>
              <td>{d.type}</td>
              <td>{d.customer_name}</td>
              <td>{d.ledger_type}</td>
              <td>
                <select value={d.status} onChange={e => handleStatusChange(d.id, e.target.value)}>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </td>
                            <td>{formatFirestoreTimestamp(d.completed_at)}</td>
              <td>
                {noteEdit[d.id] !== undefined ? (
                  <>
                    <input value={noteEdit[d.id]} onChange={e => handleNoteChange(d.id, e.target.value)} />
                    <button onClick={() => handleNoteSave(d.id)}>Kaydet</button>
                  </>
                ) : (
                  <>
                    {d.note || ''} <button onClick={() => setNoteEdit({ ...noteEdit, [d.id]: d.note || '' })}>Düzenle</button>
                  </>
                )}
              </td>
              <td>
                <button style={{color: 'white', background: '#dc3545', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer'}} onClick={() => openDeleteModal(d.id)}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DeclarationList;
