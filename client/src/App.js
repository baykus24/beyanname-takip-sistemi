import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import { Puff } from 'react-loader-spinner';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import DeclarationList from './DeclarationList';
import EditDeclarationsModal from './EditDeclarationsModal';
import { exportToExcel, exportToPdf } from './exportUtils';
import ConfirmationModal from './ConfirmationModal';

// Constants
const LEDGER_TYPES = [
  { value: 'İşletme', label: 'İşletme' },
  { value: 'Bilanço', label: 'Bilanço' },
  { value: 'Basit Usul', label: 'Basit Usul' },
];
const DEFAULT_DECLARATION_TYPES = [
  'KDV', 'Muhtasar', 'Geçici Vergi', 'Yıllık Gelir', 'Kurumlar', 'Ba-Bs', 'Damga', 'Diğer',
];
const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

function App() {
  // Form State
  const [name, setName] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [ledgerType, setLedgerType] = useState('İşletme');
  const [selectedDeclarations, setSelectedDeclarations] = useState([]);
  const [declarationMonths, setDeclarationMonths] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Customer List State
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Declaration & Modal State
  const [allDeclarations, setAllDeclarations] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  
  // Onay Modalı için State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  
  // Dynamic Declaration Types State
  const [customDeclInput, setCustomDeclInput] = useState('');
  const [declarationTypes, setDeclarationTypes] = useState(() => {
    const saved = localStorage.getItem('declarationTypes');
    return saved ? JSON.parse(saved) : DEFAULT_DECLARATION_TYPES;
  });

  useEffect(() => {
    localStorage.setItem('declarationTypes', JSON.stringify(declarationTypes));
  }, [declarationTypes]);

  // Data Fetching
    const fetchCustomers = async (loadMore = false) => {
    if (!hasMore && loadMore) return;
    if (!loadMore) setIsLoading(true);

    try {
      let url = 'https://beyanname-takip-sistemi.onrender.com/api/customers';
      if (loadMore && lastVisible) {
        url += `?lastVisible=${lastVisible}`;
      }

      const response = await axios.get(url);
      const { customers: newCustomers, lastVisible: newLastVisible } = response.data;

      if (loadMore) {
        setCustomers(prev => [...prev, ...newCustomers]);
      } else {
        setCustomers(newCustomers);
      }

      setLastVisible(newLastVisible);
      if (!newLastVisible || newCustomers.length === 0) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Müşteriler yüklenirken bir hata oluştu.');
    } finally {
      if (!loadMore) setIsLoading(false);
    }
  };

    const fetchAllDeclarations = async () => {
    try {
      const res = await axios.get('https://beyanname-takip-sistemi.onrender.com/api/declarations');
      setAllDeclarations(res.data);
    } catch (error) {
      console.error('Error fetching declarations:', error);
      toast.error('Beyanname listesi yüklenirken bir hata oluştu.');
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchAllDeclarations();
  }, []);

  // Handlers
  const handleDeclarationChange = (type) => {
    setSelectedDeclarations(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
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

  const handleSelectAllMonths = (type) => {
    const allSelected = declarationMonths[type]?.length === MONTHS.length;
    setDeclarationMonths(prev => ({
      ...prev,
      [type]: allSelected ? [] : MONTHS,
    }));
  };

  const handleCustomDeclAdd = () => {
    const val = customDeclInput.trim();
    if (val && !declarationTypes.includes(val)) {
      setDeclarationTypes(prev => [...prev, val]);
      setSelectedDeclarations(prev => [...prev, val]);
      setCustomDeclInput('');
    }
  };

  const handleDeclRemove = (type) => {
    setDeclarationTypes(prev => prev.filter(t => t !== type));
    setSelectedDeclarations(prev => prev.filter(t => t !== type));
    setDeclarationMonths(prev => {
      const copy = { ...prev };
      delete copy[type];
      return copy;
    });
  };

    const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !taxNo || selectedDeclarations.length === 0) {
      toast.error('Tüm alanları doldurun ve en az bir beyanname seçin.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await axios.post('https://beyanname-takip-sistemi.onrender.com/api/customers', {
        name, tax_no: taxNo, ledger_type: ledgerType
      });
      const customerId = res.data.id;
      for (const type of selectedDeclarations) {
        const months = declarationMonths[type] || [];
        for (const month of months) {
          await axios.post('https://beyanname-takip-sistemi.onrender.com/api/declarations', {
            customer_id: customerId,
            type,
            month: MONTHS.indexOf(month) + 1,
            year: new Date().getFullYear(),
            status: 'Bekliyor'
          });
        }
      }
      toast.success('Kayıt başarılı!');
      setName(''); setTaxNo(''); setLedgerType('İşletme');
      setSelectedDeclarations([]); setDeclarationMonths({});
      fetchCustomers(); // Refresh customer list
      fetchAllDeclarations();
    } catch (err) {
      toast.error('Kayıt sırasında hata oluştu.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

    // Silme işlemini başlatan fonksiyon (modalı açar)
  const handleDeleteCustomer = (customerId) => {
    setCustomerToDelete(customerId);
    setIsConfirmModalOpen(true);
  };

  // Modal'dan gelen onayla asıl silme işlemini yapan fonksiyon
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;

    setIsLoading(true);
    try {
      await axios.delete(`https://beyanname-takip-sistemi.onrender.com/api/customers/${customerToDelete}`);
      toast.success('Müşteri başarıyla silindi!');
      fetchCustomers(); // Listeyi yenile
      fetchAllDeclarations();
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Müşteri silinirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
      setCustomerToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const openEditModal = (customer) => {
    setEditCustomer(customer);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditCustomer(null);
    setEditModalOpen(false);
  };

  

  const handleLoadMore = () => {
    fetchCustomers(true);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.tax_no.includes(customerSearch)
  );

  const handleExportExcel = () => {
    const dataToExport = filteredCustomers.map(({ name, tax_no, ledger_type }) => ({ 'Müşteri Adı': name, 'Vergi No': tax_no, 'Defter Türü': ledger_type }));
    exportToExcel(dataToExport, 'musteri_listesi', 'Müşteriler');
  };

  const handleExportPdf = () => {
    const columns = [
        { header: 'Müşteri Adı', dataKey: 'name' },
        { header: 'Vergi No', dataKey: 'tax_no' },
        { header: 'Defter Türü', dataKey: 'ledger_type' },
    ];
    exportToPdf('Müşteri Listesi', columns, filteredCustomers, 'musteri_listesi');
  };

  return (
    <>
      <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} />

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmDelete}
        message="Bu müşteri ve tüm beyannameleri silinsin mi? Bu işlem geri alınamaz."
      />

      {isLoading && (
        <div className="loader-overlay">
          <Puff color="#007bff" height={100} width={100} />
        </div>
      )}
      <div className="container">
        <h2>Müşteri Kayıt</h2>
        <form onSubmit={handleSubmit} className="form">
          {/* Form Inputs: Name, TaxNo, LedgerType */}
          <div>
            <label>Müşteri Adı</label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label>Vergi No</label>
            <input value={taxNo} onChange={e => setTaxNo(e.target.value)} required />
          </div>
          <div>
            <label>Defter Türü</label>
            <select value={ledgerType} onChange={e => setLedgerType(e.target.value)}>
              {LEDGER_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* Dynamic Declaration Type Checkboxes */}
          <div>
            <label>Tabi Olduğu Beyannameler</label>
            <div className="checkbox-group">
              {declarationTypes.map(type => (
                <span key={type} style={{ display: 'inline-flex', alignItems: 'center', marginRight: 10, marginBottom: 6 }}>
                  <label style={{ marginRight: 4 }}>
                    <input type="checkbox" checked={selectedDeclarations.includes(type)} onChange={() => handleDeclarationChange(type)} /> {type}
                  </label>
                  <button type="button" onClick={() => handleDeclRemove(type)} style={{ marginLeft: 2, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>Sil</button>
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 6 }}>
                <input
                  type="text"
                  value={customDeclInput}
                  onChange={e => setCustomDeclInput(e.target.value)}
                  placeholder="Yeni beyanname türü"
                  style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', marginRight: 4, fontSize: 13 }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomDeclAdd(); } }}
                />
                <button type="button" onClick={handleCustomDeclAdd} style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 12 }}>Ekle</button>
              </span>
            </div>
          </div>

          {/* Month Selection for selected declarations */}
          {selectedDeclarations.map(type => (
            <div key={type} className="months-select">
              <label>{type} için Aylar:</label>
              <button type="button" onClick={() => handleSelectAllMonths(type)} style={{ marginLeft: '10px', fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}>
                {declarationMonths[type]?.length === MONTHS.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
              </button>
              <div className="checkbox-group" style={{ marginTop: '5px' }}>
                {MONTHS.map(month => (
                  <label key={month}>
                    <input type="checkbox" checked={declarationMonths[type]?.includes(month) || false} onChange={() => handleMonthChange(type, month)} /> {month}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button type="submit" disabled={isLoading}>{isLoading ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </form>

                <div className="list-header">
          <h3>Kayıtlı Müşteriler</h3>
          <div className="export-buttons">
            <button onClick={handleExportExcel} className="export-btn excel">Excel'e Aktar</button>
            <button onClick={handleExportPdf} className="export-btn pdf">PDF'e Aktar</button>
          </div>
        </div>
        <input
          type="text"
          placeholder="Müşteri Ara (Ad veya Vergi No)..."
          className="search-input"
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
        />
        <ul>
          {filteredCustomers.map(c => (
            <li key={c.id}>
              {c.name} - {c.tax_no} - {c.ledger_type}
              <button style={{ marginLeft: 10, padding: '2px 10px' }} className='edit-btn' onClick={() => openEditModal(c)}>Düzenle</button>
              <button style={{ marginLeft: 6, padding: '2px 10px' }} className='delete-btn' onClick={() => handleDeleteCustomer(c.id)}>Sil</button>
            </li>
          ))}
        </ul>
        {hasMore && !customerSearch && (
          <button onClick={() => fetchCustomers(true)} className="load-more-btn">
            Daha Fazla Yükle
          </button>
        )}

        <EditDeclarationsModal
          open={editModalOpen}
          customer={editCustomer}
          declarations={allDeclarations}
          onSave={async (selected, months) => {
            if (!editCustomer) return;
            const customerDecls = allDeclarations.filter(d => d.customer_id === editCustomer.id);
            for (const decl of customerDecls) {
              await axios.delete(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${decl.id}`);
            }
            const year = new Date().getFullYear();
            for (const type of selected) {
              for (const month of (months[type] || [])) {
                await axios.post('https://beyanname-takip-sistemi.onrender.com/api/declarations', {
                  customer_id: editCustomer.id,
                  type,
                  month: MONTHS.indexOf(month) + 1,
                  year,
                  status: 'Bekliyor'
                });
              }
            }
            closeEditModal();
            fetchAllDeclarations();
          }}
          onClose={closeEditModal}
        />
      </div>

      {/* Render DeclarationList separately below the main container */}
      <DeclarationList declarations={allDeclarations} refetchDeclarations={fetchAllDeclarations} declarationTypes={declarationTypes} ledgerTypes={LEDGER_TYPES} />
    </>
  );
}

export default App;
