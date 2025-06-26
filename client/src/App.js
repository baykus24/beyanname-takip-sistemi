import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [selectedDeclarations, setSelectedDeclarations] = useState({});
  const [declarations, setDeclarations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Customer List State
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
    const [lastVisible, setLastVisible] = useState(null);
  const lastVisibleRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);

  // Declaration & Modal State
  const [hasMoreDeclarations, setHasMoreDeclarations] = useState(true);
  const lastVisibleDeclarationRef = useRef(null);
  const hasMoreDeclarationsRef = useRef(true);
  const fetchingDeclarationsRef = useRef(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [filters, setFilters] = useState({
    month: '',
    year: '',
    type: '',
    ledger: '',
    status: '',
  });
  const filtersRef = useRef(filters);
  
  // Onay Modalı için State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  
  // Dynamic Declaration Types State
  const [customDeclInput, setCustomDeclInput] = useState('');
  const [declarationTypes, setDeclarationTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('declarationTypes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Failed to parse declarationTypes from localStorage", error);
    }
    return DEFAULT_DECLARATION_TYPES;
  });

  useEffect(() => {
    localStorage.setItem('declarationTypes', JSON.stringify(declarationTypes));
  }, [declarationTypes]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Data Fetching
    const fetchCustomers = useCallback(async (loadMore = false) => {
    if (loadMore && !hasMore) return;
    
    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      lastVisibleRef.current = null; // Reset for new fetch/filter
    }

    try {
      let url = 'https://beyanname-takip-sistemi.onrender.com/api/customers';
      if (loadMore && lastVisibleRef.current) {
        url += `?lastVisible=${lastVisibleRef.current}`;
      }

      const response = await axios.get(url, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
      });
      
      const newCustomers = Array.isArray(response.data.customers) ? response.data.customers : [];
      const newLastVisible = response.data.lastVisible;

      lastVisibleRef.current = newLastVisible;
      setLastVisible(newLastVisible);

      if (loadMore) {
        setCustomers(prev => [...(Array.isArray(prev) ? prev : []), ...newCustomers]);
      } else {
        setCustomers(newCustomers);
      }

      if (!newCustomers.length || newCustomers.length < 20) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Müşteriler yüklenirken bir hata oluştu.');
    } finally {
      if (loadMore) {
        setIsFetchingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [hasMore]);

  const fetchDeclarations = useCallback(async (loadMore = false) => {
    if (fetchingDeclarationsRef.current) return;
    if (loadMore && !hasMoreDeclarationsRef.current) return;

    fetchingDeclarationsRef.current = true;
    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      lastVisibleDeclarationRef.current = null;
      hasMoreDeclarationsRef.current = true; 
    }

    const currentFilters = filtersRef.current;
    const currentLastVisible = lastVisibleDeclarationRef.current;

    try {
      const params = new URLSearchParams({ limit: 20, ...currentFilters });
      if (currentLastVisible) {
        params.append('lastVisible', currentLastVisible);
      }

      for (const [key, value] of Object.entries(currentFilters)) {
        if (!value) {
          params.delete(key);
        }
      }

      const requestUrl = `https://beyanname-takip-sistemi.onrender.com/api/declarations?${params.toString()}`;
      const response = await axios.get(requestUrl, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
      });

      const responseData = response.data || {};
      const newDeclarations = Array.isArray(responseData.declarations) ? responseData.declarations : [];
      const newLastVisible = responseData.lastVisible;

      if (loadMore) {
        setDeclarations(prev => [...prev, ...newDeclarations]);
      } else {
        setDeclarations(newDeclarations);
      }

      lastVisibleDeclarationRef.current = newLastVisible;

      const hasMore = newDeclarations.length >= 20;
      hasMoreDeclarationsRef.current = hasMore;
      setHasMoreDeclarations(hasMore);

    } catch (error) {
      console.error('Fetch declarations failed:', error);
      toast.error('Beyannameler yüklenirken bir hata oluştu.');
    } finally {
      fetchingDeclarationsRef.current = false;
      if (loadMore) {
        setIsFetchingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchDeclarations(false);
  }, [filters, fetchDeclarations]);

  // Handlers
  const handleDeclarationChange = (type) => {
    setSelectedDeclarations(prev => {
      const newDeclarations = { ...prev };
      if (newDeclarations[type]) {
        delete newDeclarations[type];
      } else {
        newDeclarations[type] = []; // Initialize with empty months array
      }
      return newDeclarations;
    });
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
      fetchDeclarations(false);
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
      fetchDeclarations(false);
    } catch (error) {
      console.error('Error deleting customer:', error);
      if (error.response && error.response.data && error.response.data.details) {
        console.error('Server Error Details:', error.response.data.details);
        toast.error(`Müşteri silinirken hata oluştu: ${error.response.data.details}`);
      } else {
        toast.error('Müşteri silinirken bir hata oluştu.');
      }
    } finally {
      setIsLoading(false);
      setCustomerToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const handleDeclarationStatusUpdate = useCallback(async (declarationId, newStatus) => {
    let originalDeclaration;

    setDeclarations(prevDeclarations => {
      const declarationIndex = prevDeclarations.findIndex(d => d.id === declarationId);
      if (declarationIndex === -1) {
        toast.error("Güncellenecek beyanname bulunamadı.");
        return prevDeclarations;
      }
      originalDeclaration = prevDeclarations[declarationIndex];
      const updatedDeclarations = [...prevDeclarations];
      const completedAt = newStatus === 'Tamamlandı' ? new Date().toISOString() : null;
      updatedDeclarations[declarationIndex] = { ...originalDeclaration, status: newStatus, completed_at: completedAt };
      return updatedDeclarations;
    });

    try {
      await axios.put(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${declarationId}`, {
        status: newStatus,
        completed_at: newStatus === 'Tamamlandı' ? new Date().toISOString() : null,
        note: originalDeclaration?.note || ''
      });
    } catch (error) {
      toast.error('Durum güncellenemedi. Değişiklikler geri alınıyor.');
      setDeclarations(prevDeclarations => {
        const declarationIndex = prevDeclarations.findIndex(d => d.id === declarationId);
        if (declarationIndex === -1) return prevDeclarations;
        const revertedDeclarations = [...prevDeclarations];
        revertedDeclarations[declarationIndex] = originalDeclaration;
        return revertedDeclarations;
      });
    }
  }, []);

  const handleDeclarationNoteUpdate = useCallback(async (declarationId, newNote) => {
    let originalDeclaration;

    setDeclarations(prevDeclarations => {
        const declarationIndex = prevDeclarations.findIndex(d => d.id === declarationId);
        if (declarationIndex === -1) return prevDeclarations;
        originalDeclaration = prevDeclarations[declarationIndex];
        const updatedDeclarations = [...prevDeclarations];
        updatedDeclarations[declarationIndex] = { ...originalDeclaration, note: newNote };
        return updatedDeclarations;
    });

    try {
      await axios.put(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${declarationId}`, {
        status: originalDeclaration?.status,
        completed_at: originalDeclaration?.completed_at,
        note: newNote,
      });
    } catch (error) {
      toast.error('Not güncellenemedi. Değişiklikler geri alınıyor.');
      setDeclarations(prevDeclarations => {
        const declarationIndex = prevDeclarations.findIndex(d => d.id === declarationId);
        if (declarationIndex === -1) return prevDeclarations;
        const revertedDeclarations = [...prevDeclarations];
        revertedDeclarations[declarationIndex] = originalDeclaration;
        return revertedDeclarations;
      });
    }
  }, []);

  const openEditModal = (customer) => {
    setEditCustomer(customer);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditCustomer(null);
    setEditModalOpen(false);
  };

  

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const loadMoreDeclarations = () => {
    fetchDeclarations(true);
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
                    <input type="checkbox" checked={selectedDeclarations[type]?.length > 0} onChange={() => handleDeclarationChange(type)} /> {type}
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
          {Object.keys(selectedDeclarations).map(type => (
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
      </div>

      <div className="list-container">
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
          declarations={declarations}
          onSave={async (selected, months) => {
            if (!editCustomer) return;
            const customerDecls = declarations.filter(d => d.customer_id === editCustomer.id);
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
            fetchDeclarations();
          }}
          onClose={closeEditModal}
        />
    </div>

    <div className="right-panel">
      <DeclarationList 
        declarations={declarations} 
        refetchDeclarations={() => fetchDeclarations(false, filters)} 
        isLoading={isLoading}
        isFetchingMore={isFetchingMore}
        declarationTypes={declarationTypes}
        ledgerTypes={LEDGER_TYPES}
        loadMoreDeclarations={loadMoreDeclarations}
        hasMoreDeclarations={hasMoreDeclarations}
        onStatusChange={handleDeclarationStatusUpdate}
        onNoteUpdate={handleDeclarationNoteUpdate}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </div>
    </>
  );
}

export default App;
