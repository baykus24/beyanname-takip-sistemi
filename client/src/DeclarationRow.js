import React from 'react';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const STATUS_OPTIONS = [
  { value: 'Bekliyor', label: 'Bekliyor' },
  { value: 'Tamamlandı', label: 'Tamamlandı' },
];

const formatFirestoreTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleDateString('tr-TR');
  }
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toLocaleDateString('tr-TR');
  }
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date.toLocaleDateString('tr-TR');
  }
  return 'Geçersiz Tarih';
};

const DeclarationRow = ({ declaration, noteEditValue, onStatusChange, onNoteChange, onNoteSave, onNoteEditStart, onDelete }) => {
  return (
    <tr>
      <td>{MONTHS[declaration.month - 1]} / {declaration.year}</td>
      <td>{declaration.type}</td>
      <td>{declaration.customer_name}</td>
      <td>{declaration.ledger_type}</td>
      <td>
        <select value={declaration.status} onChange={e => onStatusChange(declaration.id, e.target.value)}>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </td>
      <td>{formatFirestoreTimestamp(declaration.completed_at)}</td>
      <td>
        {noteEditValue !== undefined ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <textarea 
              value={noteEditValue} 
              onChange={e => onNoteChange(declaration.id, e.target.value)} 
              rows={3}
              style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <div>
              <button onClick={() => onNoteSave(declaration.id)} style={{ marginRight: '5px' }}>Kaydet</button>
              <button onClick={() => onNoteEditStart(declaration.id, undefined)}>İptal</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginRight: '10px' }}>
              {declaration.note || ''}
            </span>
            <button onClick={() => onNoteEditStart(declaration.id, declaration.note || '')}>Düzenle</button>
          </div>
        )}
      </td>
      <td>
        <button style={{color: 'white', background: '#dc3545', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer'}} onClick={() => onDelete(declaration.id)}>
          Sil
        </button>
      </td>
    </tr>
  );
};

// React.memo, bu component'in propları değişmediği sürece yeniden render edilmesini engeller.
export default React.memo(DeclarationRow);
