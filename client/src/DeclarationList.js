import React, { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import DeclarationRow from './DeclarationRow';
import DeclarationRowSkeleton from './DeclarationRowSkeleton';
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

function DeclarationList({ declarations, refetchDeclarations, isLoading, declarationTypes, ledgerTypes, loadMoreDeclarations, hasMoreDeclarations, onStatusChange, onNoteUpdate, isFetchingMore, filters, onFilterChange }) {

  const [noteEdit, setNoteEdit] = useState({});
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);





  const sortedDeclarations = useMemo(() => 
    (declarations || []).sort((a, b) => {
      if (a.customer_name && b.customer_name) {
        return a.customer_name.localeCompare(b.customer_name, 'tr');
      }
      return 0;
    }),
    [declarations]
  );



  const handleNoteChange = useCallback((id, value) => {
    setNoteEdit(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleNoteEditStart = useCallback((id, currentNote) => {
    setNoteEdit(prev => ({ ...prev, [id]: currentNote }));
  }, []);

  const handleNoteSave = useCallback(async (id) => {
    if (!onNoteUpdate) return;

    const noteToSave = noteEdit[id] || '';

    await onNoteUpdate(id, noteToSave);

    // Clear the edit state for this id
    setNoteEdit(prev => {
      const newNotes = { ...prev };
      delete newNotes[id];
      return newNotes;
    });
  }, [onNoteUpdate, noteEdit]);

  const openDeleteModal = useCallback((id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  }, []);

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
    const dataToExport = sortedDeclarations.map(d => ({
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
    const dataToExport = sortedDeclarations.map(d => ({ ...d, period: `${d.month}/${d.year}` }));
    exportToPdf('Beyanname Listesi', columns, dataToExport, 'beyanname_listesi');
  };

  return (
    <div className="decl-list-container">
      <h2>Beyanname Takip Listesi</h2>
      {isLoading && <div style={{ textAlign: 'center', padding: '20px', color: '#007bff' }}>Yükleniyor...</div>}
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
        <select name="month" value={filters.month} onChange={onFilterChange}>
          <option value="">Ay Seçin</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select name="year" value={filters.year} onChange={onFilterChange}>
          <option value="">Yıl Seçin</option>
          {YEARS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select name="type" value={filters.type} onChange={onFilterChange}>
          <option value="">Beyanname Türü Seçin</option>
          {declarationTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select name="ledger" value={filters.ledger} onChange={onFilterChange}>
          <option value="">Defter Türü Seçin</option>
          {ledgerTypes.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select name="status" value={filters.status} onChange={onFilterChange}>
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
          {(isLoading && declarations.length === 0) ? (
            Array.from({ length: 10 }).map((_, index) => <DeclarationRowSkeleton key={`initial-skeleton-${index}`} />)
          ) : (
            sortedDeclarations.map(d => (
              <DeclarationRow
                key={d.id}
                declaration={d}
                noteEditValue={noteEdit[d.id]}
                onStatusChange={onStatusChange}
                onNoteChange={handleNoteChange}
                onNoteSave={handleNoteSave}
                onNoteEditStart={handleNoteEditStart}
                onDelete={openDeleteModal}
              />
            ))
          )}
          {isFetchingMore && (
            Array.from({ length: 5 }).map((_, index) => <DeclarationRowSkeleton key={`more-skeleton-${index}`} />)
          )}
        </tbody>
      </table>
      {!isLoading && sortedDeclarations.length === 0 && (
        <div className="no-declarations-message">Gösterilecek beyanname bulunamadı.</div>
      )}

      {hasMoreDeclarations && (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <button onClick={loadMoreDeclarations} disabled={isFetchingMore || isLoading} className="load-more-btn">
            {isFetchingMore ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
          </button>
        </div>
      )}
    </div>
  );
}

export default DeclarationList;
