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
import StatsCounter from './StatsCounter';
import './StatsCounter.css';

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
  const [totalCustomerCount, setTotalCustomerCount] = useState(0);

  useEffect(() => {
    const fetchTotalCustomerCount = async () => {
      try {
        // Bu endpoint'in toplam müşteri sayısını { count: number } formatında döndürdüğünü varsayıyoruz.
        const response = await axios.get('https://beyanname-takip-sistemi.onrender.com/api/customers/count');
        if (response.data && typeof response.data.count !== 'undefined') {
          setTotalCustomerCount(response.data.count);
        }
      } catch (error) {
        console.error("Toplam müşteri sayısı alınamadı:", error);
        // Hata durumunda sayaç 0 olarak kalır, kullanıcıya hata göstermeye gerek yok.
      }
    };

    fetchTotalCustomerCount();
    // Veriyi güncel tutmak için periyodik olarak tekrar çek
    const intervalId = setInterval(fetchTotalCustomerCount, 60000); // 1 dakikada bir

    return () => clearInterval(intervalId); // Component unmount olduğunda interval'i temizle
  }, []);

  // Form State
  const [name, setName] = useState('');
  const [taxNo, setTaxNo] = useState('');
  const [ledgerType, setLedgerType] = useState('İşletme');
  const [selectedDeclarations, setSelectedDeclarations] = useState({});
  const [declarationMonths, setDeclarationMonths] = useState({});
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
  const [declarationTypes, setDeclarationTypes] = useState(DEFAULT_DECLARATION_TYPES);
  const [allDeclarationTypes, setAllDeclarationTypes] = useState([]); // From server

  // Data Fetching
  const fetchCustomers = useCallback(async (loadMore = false, forceUpdateCount = false) => {
    if (loadMore && !hasMore) return;
    
    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      lastVisibleRef.current = null; // Reset for new fetch/filter
    }

    try {
      let url = 'https://beyanname-takip-sistemi.onrender.com/api/customers';
const params = new URLSearchParams();
params.append('limit', '15');
if (loadMore && lastVisibleRef.current) {
  params.append('lastVisible', lastVisibleRef.current);
}
console.log('[FETCH] lastVisible gönderilen:', lastVisibleRef.current);
const response = await axios.get(url + '?' + params.toString(), {
  headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' },
});
      
      const newCustomers = Array.isArray(response.data.customers) ? response.data.customers : [];
const newLastVisible = response.data.lastVisible;

console.log('[FETCH] Gelen müşteri IDleri:', newCustomers.map(c => c.id || c._id));
console.log('[FETCH] newLastVisible:', newLastVisible);

lastVisibleRef.current = newLastVisible;
setLastVisible(newLastVisible);

if (loadMore) {
  setCustomers(prev => {
    // Deduplication: Önceki ve yeni müşteri ID'lerini birleştir, tekrarları çıkar
    const existingIds = new Set((prev || []).map(c => c.id || c._id));
    const uniqueNew = newCustomers.filter(c => !existingIds.has(c.id || c._id));
    return [...(Array.isArray(prev) ? prev : []), ...uniqueNew];
  });
} else {
  setCustomers(newCustomers);
}

if (!newCustomers.length || newCustomers.length < 15) {
  setHasMore(false);
}

      // Müşteri sayısı sayacını güncelle (eğer yeni bir yükleme yapılıyorsa veya zorlandıysa)
      if (!loadMore || forceUpdateCount) {
        try {
          const countResponse = await axios.get('https://beyanname-takip-sistemi.onrender.com/api/customers/count');
          if (countResponse.data && typeof countResponse.data.count !== 'undefined') {
            setTotalCustomerCount(countResponse.data.count);
          }
        } catch (error) {
          console.error("Toplam müşteri sayısı alınamadı:", error);
        }
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

  const fetchDeclarations = async (loadMore = false) => {
    if (fetchingDeclarationsRef.current) return;
    if (loadMore && !hasMoreDeclarationsRef.current) return;

    fetchingDeclarationsRef.current = true;
    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
      // For a new fetch/filter, we reset the cursor, but NOT the data.
      // The data will be replaced atomically in setDeclarations.
      lastVisibleDeclarationRef.current = null;
      hasMoreDeclarationsRef.current = true;
    }

    try {
      const params = new URLSearchParams({ limit: 20, ...filters });
      if (loadMore && lastVisibleDeclarationRef.current) {
        params.append('lastVisible', lastVisibleDeclarationRef.current);
      }

      // Clean up empty filter parameters
      for (const [key, value] of Object.entries(filters)) {
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

      setDeclarations(prev => {
        // If it's a new fetch (not 'loadMore'), completely replace the data.
        if (!loadMore) {
          return newDeclarations;
        }
        // If it is a 'loadMore', append only new, unique items.
        const existingIds = new Set(prev.map(d => d.id));
        const uniqueNewDeclarations = newDeclarations.filter(d => !existingIds.has(d.id));
        return [...prev, ...uniqueNewDeclarations];
      });

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
  };

  useEffect(() => {
    // This effect runs once on mount to fetch all necessary initial data.
    const fetchInitialData = async () => {
      try {
        const response = await axios.get('https://beyanname-takip-sistemi.onrender.com/api/declarations/types');
        setAllDeclarationTypes(response.data);
      } catch (error) {
        console.error('Failed to fetch all declaration types:', error);
      }
    };
    
    fetchInitialData();
    fetchCustomers();
    fetchDeclarations();
  }, []); // Empty dependency array means this runs only once on mount.

  useEffect(() => {
    // Bu kanca, varsayılan, sunucudan gelen ve yerel olarak kaydedilen beyanname türlerini birleştirir.
    try {
      const saved = localStorage.getItem('declarationTypes');
      // Yerel olarak kaydedilmiş türleri al, yoksa boş bir dizi kullan.
      const localTypes = saved ? JSON.parse(saved) : [];
      
      // Üç kaynağı da birleştir: Varsayılanlar, sunucudan gelenler ve yereldekiler.
      // Set yapısı, mükerrer kayıtları otomatik olarak engeller.
      const combined = [...new Set([...DEFAULT_DECLARATION_TYPES, ...allDeclarationTypes, ...localTypes])].sort();
      
      setDeclarationTypes(combined);
    } catch (error) {
      console.error("localStorage'dan beyanname türleri okunurken hata oluştu:", error);
      // Hata durumunda, sadece varsayılan ve sunucu türlerini birleştir.
      const combined = [...new Set([...DEFAULT_DECLARATION_TYPES, ...allDeclarationTypes])].sort();
      setDeclarationTypes(combined);
    }
  }, [allDeclarationTypes]); // Sunucudan türler geldiğinde yeniden çalışır.

  useEffect(() => {
    // This effect saves the combined list back to localStorage whenever it changes.
    localStorage.setItem('declarationTypes', JSON.stringify(declarationTypes));
  }, [declarationTypes]);

  useEffect(() => {
    // This effect keeps a ref to the filters to be used in callbacks.
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    // This effect refetches declarations when filters change.
    fetchDeclarations(false); 
  }, [filters]);

  // Handlers
  const handleDeclarationChange = (type) => {
    setSelectedDeclarations(prev => {
      const newSelected = { ...prev };
      if (newSelected[type]) {
        // If it's being unchecked, delete it
        delete newSelected[type];
        // Also clear its months from the other state
        setDeclarationMonths(prevMonths => {
          const newMonths = { ...prevMonths };
          delete newMonths[type];
          return newMonths;
        });
      } else {
        // If it's being checked, initialize it. The value is just a placeholder.
        newSelected[type] = []; 
      }
      return newSelected;
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
      // Automatically select the new type
      setSelectedDeclarations(prev => ({...prev, [val]: []}));
      setCustomDeclInput('');
    }
  };

  const handleDeclRemove = (type) => {
    // Remove from the master list of types
    setDeclarationTypes(prev => prev.filter(t => t !== type));
    
    // Remove it from the selected declarations
    setSelectedDeclarations(prev => {
      const newSelected = { ...prev };
      delete newSelected[type];
      return newSelected;
    });

    // Also remove its months
    setDeclarationMonths(prev => {
      const newMonths = { ...prev };
      delete newMonths[type];
      return newMonths;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Gelişmiş doğrulama
    if (!name || !taxNo || Object.keys(selectedDeclarations).length === 0) {
      toast.error('Tüm alanları doldurun ve en az bir beyanname seçin.');
      return;
    }
    // Her beyanname için en az bir ay seçili mi?
    for (const type of Object.keys(selectedDeclarations)) {
      if (!declarationMonths[type] || declarationMonths[type].length === 0) {
        toast.error(`'${type}' için en az bir ay seçmelisiniz.`);
        return;
      }
    }
    setIsLoading(true);
    try {
      const res = await axios.post('https://beyanname-takip-sistemi.onrender.com/api/customers', {
        name, tax_no: taxNo, ledger_type: ledgerType
      });
      const customerId = res.data.id;
      // Corrected loop
      for (const type of Object.keys(selectedDeclarations)) {
        const months = declarationMonths[type] || [];
        // Only create declarations if months have been selected
        if (months.length > 0) {
            for (const month of months) {
                await axios.post('https://beyanname-takip-sistemi.onrender.com/api/declarations', {
                    customer_id: customerId,
                    type,
                    month: MONTHS.indexOf(month) + 1,
                    year: new Date().getFullYear(),
                    status: 'Bekliyor',
                    ledger_type: ledgerType
                });
            }
        }
      }
      toast.success('Kayıt başarılı!');
      setName(''); setTaxNo(''); setLedgerType('İşletme');
      setSelectedDeclarations({}); 
      setDeclarationMonths({});
      fetchCustomers(false, true); // Müşteri listesini ve sayacı yenile
      fetchDeclarations(false);
    } catch (err) {
      // Sunucudan detaylı hata mesajı varsa göster
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(`Kayıt sırasında hata oluştu: ${err.response.data.error}`);
      } else {
        toast.error('Kayıt sırasında hata oluştu.');
      }
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

  // Modal kapatıldığında state sıfırlama
  useEffect(() => {
    if (!isConfirmModalOpen) {
      setCustomerToDelete(null);
    }
  }, [isConfirmModalOpen]);

  // Modal'dan gelen onayla asıl silme işlemini yapan fonksiyon
  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;

    setIsLoading(true);
    try {
      await axios.delete(`https://beyanname-takip-sistemi.onrender.com/api/customers/${customerToDelete}`);
      toast.success('Müşteri başarıyla silindi!');
      fetchCustomers(false, true); // Müşteri listesini ve sayacı yenile
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
    let optimisticError = false;
    setDeclarations(prevDeclarations => {
      const declarationIndex = prevDeclarations.findIndex(d => d.id === declarationId);
      if (declarationIndex === -1) {
        toast.error("Güncellenecek beyanname bulunamadı.");
        optimisticError = true;
        return prevDeclarations;
      }
      originalDeclaration = prevDeclarations[declarationIndex];
      const updatedDeclarations = [...prevDeclarations];
      const completedAt = newStatus === 'Tamamlandı' ? new Date().toISOString() : null;
      updatedDeclarations[declarationIndex] = { ...originalDeclaration, status: newStatus, completed_at: completedAt };
      return updatedDeclarations;
    });
    if (optimisticError) return;
    try {
      await axios.put(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${declarationId}`, {
        status: newStatus,
        completed_at: newStatus === 'Tamamlandı' ? new Date().toISOString() : null,
        note: originalDeclaration?.note || ''
      });
    } catch (error) {
      toast.error('Durum güncellenemedi. Değişiklikler geri alındı. Lütfen sayfayı yenileyin veya tekrar deneyin.');
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
    let optimisticError = false;
    setDeclarations(prevDeclarations => {
      const declarationIndex = prevDeclarations.findIndex(d => d.id === declarationId);
      if (declarationIndex === -1) {
        optimisticError = true;
        return prevDeclarations;
      }
      originalDeclaration = prevDeclarations[declarationIndex];
      const updatedDeclarations = [...prevDeclarations];
      updatedDeclarations[declarationIndex] = { ...originalDeclaration, note: newNote };
      return updatedDeclarations;
    });
    if (optimisticError) return;
    try {
      await axios.put(`https://beyanname-takip-sistemi.onrender.com/api/declarations/${declarationId}`, {
        status: originalDeclaration?.status,
        completed_at: originalDeclaration?.completed_at,
        note: newNote,
      });
    } catch (error) {
      toast.error('Not güncellenemedi. Değişiklikler geri alındı. Lütfen sayfayı yenileyin veya tekrar deneyin.');
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
    // Filtre değiştiğinde sayfalama ve ilgili state'leri sıfırla
    setFilters({ ...filters, [e.target.name]: e.target.value });
    setDeclarations([]);
    setHasMoreDeclarations(true);
    lastVisibleDeclarationRef.current = null;
    hasMoreDeclarationsRef.current = true;
  };

  const loadMoreDeclarations = () => {
    // Yeni veri yüklerken eski veriyle karışmayı önle
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

  const completedCount = declarations.filter(d => d.status === 'Tamamlandı').length;
  const pendingCount = declarations.filter(d => d.status === 'Bekliyor').length;

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
                    <input type="checkbox" checked={selectedDeclarations[type] !== undefined} onChange={() => handleDeclarationChange(type)} /> {type}
                  </label>
                  <button type="button" onClick={() => handleDeclRemove(type)} style={{ marginLeft: 2, background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12 }}>Sil</button>
                </span>
              ))}
            </div>
            {/* Yeni beyanname türü ekleme bölümü */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center' }}>
              <input 
                type="text" 
                value={customDeclInput} 
                onChange={(e) => setCustomDeclInput(e.target.value)} 
                placeholder="Yeni beyanname türü ekle..."
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', marginRight: 4, fontSize: 14 }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomDeclAdd(); } }}
              />
              <button type="button" onClick={handleCustomDeclAdd} style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>Ekle</button>
            </div>
          </div>

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
        <StatsCounter
          completed={completedCount}
          pending={pendingCount}
          totalDeclarations={declarations.length}
          totalCustomers={totalCustomerCount}
        />
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

        <EditDeclarationsModal allDeclarationTypes={declarationTypes}
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
