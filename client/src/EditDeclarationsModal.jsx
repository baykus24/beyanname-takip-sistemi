import React, { useEffect, useState } from 'react';

const DECLARATION_TYPES = [
  'KDV',
  'Muhtasar',
  'Geçici Vergi',
  'Yıllık Gelir',
  'Kurumlar',
  'Ba-Bs',
  'Damga',
  'Diğer',
];
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

function EditDeclarationsModal({ open, customer, declarations, onSave, onClose }) {
  const [selectedDeclarations, setSelectedDeclarations] = useState([]);
  const [declarationMonths, setDeclarationMonths] = useState({});
  const [customDeclInput, setCustomDeclInput] = useState('');

  useEffect(() => {
    if (!customer || !declarations) return;
    // Müşterinin mevcut beyannamelerini modal açıldığında seçili yap
    const customerDecls = declarations.filter(d => d.customer_id === customer.id);
    const declTypes = [...new Set(customerDecls.map(d => d.type))];
    setSelectedDeclarations(declTypes);
    const monthsObj = {};
    declTypes.forEach(type => {
      monthsObj[type] = customerDecls.filter(d => d.type === type).map(d => MONTHS[d.month - 1]);
    });
    setDeclarationMonths(monthsObj);
  }, [customer, declarations]);

  const handleDeclarationChange = (type) => {
    setSelectedDeclarations(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  const handleMonthChange = (type, month) => {
    setDeclarationMonths(prev => ({
      ...prev,
      [type]: prev[type]?.includes(month)
        ? prev[type].filter(m => m !== month)
        : [...(prev[type] || []), month],
    }));
  };
  const handleCustomDeclAdd = () => {
    const val = customDeclInput.trim();
    if (val && !selectedDeclarations.includes(val)) {
      setSelectedDeclarations(prev => [...prev, val]);
      setCustomDeclInput('');
    }
  };
  const handleDeclRemove = (type) => {
    setSelectedDeclarations(prev => prev.filter(t => t !== type));
    setDeclarationMonths(prev => {
      const copy = { ...prev };
      delete copy[type];
      return copy;
    });
  };
  const handleSave = () => {
    onSave(selectedDeclarations, declarationMonths);
  };

  if (!open || !customer) return null;
  // Sabit ve manuel eklenen tüm beyanname tiplerini göster
  const allTypes = Array.from(new Set([...DECLARATION_TYPES, ...selectedDeclarations]));
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.3)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 8, padding: 28, minWidth: 340, boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
        <h3 style={{marginTop: 0}}>{customer.name} - Beyannameleri Düzenle</h3>
        <div className="checkbox-group">
          {allTypes.map(type => (
            <div key={type} style={{display: 'flex', alignItems: 'center', marginBottom: 6}}>
              <label style={{flex: 1}}>
                <input
                  type="checkbox"
                  checked={selectedDeclarations.includes(type)}
                  onChange={() => handleDeclarationChange(type)}
                /> {type}
              </label>
              {selectedDeclarations.includes(type) && (
                <button onClick={() => handleDeclRemove(type)} style={{marginLeft: 8, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer'}}>Sil</button>
              )}
            </div>
          ))}
        </div>
        <div style={{margin: '10px 0 18px 0', display: 'flex', gap: 8}}>
          <input
            type="text"
            value={customDeclInput}
            onChange={e => setCustomDeclInput(e.target.value)}
            placeholder="Yeni beyanname türü girin"
            style={{flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc'}}
            onKeyDown={e => { if (e.key === 'Enter') handleCustomDeclAdd(); }}
          />
          <button type="button" onClick={handleCustomDeclAdd} style={{background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer'}}>Ekle</button>
        </div>
        {selectedDeclarations.map(type => (
          <div key={type} className="months-select" style={{marginLeft: 12, marginBottom: 10}}>
            <label>{type} için Aylar:</label>
            <div className="checkbox-group">
              {MONTHS.map(month => (
                <label key={month} style={{marginRight: 8}}>
                  <input
                    type="checkbox"
                    checked={declarationMonths[type]?.includes(month) || false}
                    onChange={() => handleMonthChange(type, month)}
                  /> {month}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div style={{display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18}}>
          <button onClick={onClose} style={{background: '#aaa', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer'}}>İptal</button>
          <button onClick={handleSave} style={{background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', cursor: 'pointer'}}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

export default EditDeclarationsModal;
