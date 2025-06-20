const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Firebase Admin SDK'yı başlat
// Hizmet hesabı anahtar dosyanızın doğru yolda olduğundan emin olun
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Render'da (canlıda) ortam değişkeninden al
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (e) {
    console.error('Firebase service account parsing error:', e);
    process.exit(1);
  }
} else {
  // Yerelde dosyadan oku
  try {
    serviceAccount = require('./firebase-service-account-key.json');
  } catch (e) {
    console.error('Could not find or read firebase-service-account-key.json. Make sure the file exists in the /server directory for local development.');
    process.exit(1);
  }
} // BU YOLU KONTROL EDİN!

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Müşteri ekle
app.post('/api/customers', async (req, res) => {
  try {
    const { name, tax_no, ledger_type } = req.body;
    if (!name || !tax_no || !ledger_type) {
      return res.status(400).json({ error: 'Missing required fields: name, tax_no, ledger_type' });
    }
    const customerRef = await db.collection('customers').add({
      name,
      tax_no,
      ledger_type
    });
    res.status(201).json({ id: customerRef.id });
  } catch (error) {
    console.error('Error adding customer:', error);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

// Müşterileri getir
app.get('/api/customers', async (req, res) => {
  try {
    const { limit = 15, lastVisible } = req.query;
    let query = db.collection('customers').orderBy('name').limit(Number(limit));

    if (lastVisible) {
      const lastVisibleDoc = await db.collection('customers').doc(lastVisible).get();
      if (lastVisibleDoc.exists) {
        query = query.startAfter(lastVisibleDoc);
      } 
    }

    const snapshot = await query.get();
    const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const newLastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;

    res.json({ 
      customers,
      lastVisible: newLastVisible
    });

  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).send('Server Error');
  }
});

// Beyanname ekle
app.post('/api/declarations', async (req, res) => {
  try {
    const { customer_id, type, month, year } = req.body;
    if (!customer_id || !type || !month || !year) {
      return res.status(400).json({ error: 'Missing required fields: customer_id, type, month, year' });
    }
    // İsteğe bağlı: customer_id'nin geçerli bir müşteri olup olmadığını kontrol et
    // const customerDoc = await db.collection('customers').doc(customer_id).get();
    // if (!customerDoc.exists) {
    //   return res.status(404).json({ error: 'Customer not found' });
    // }

    const declarationRef = await db.collection('declarations').add({
      customer_id, // Bu, 'customers' koleksiyonundaki bir dokümanın ID'si olmalı
      type,
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      status: 'Bekliyor', // Varsayılan durum
      created_at: admin.firestore.FieldValue.serverTimestamp(), // Oluşturulma zamanı
      completed_at: null,
      note: ''
    });
    res.status(201).json({ id: declarationRef.id });
  } catch (error) {
    console.error('Error adding declaration:', error);
    res.status(500).json({ error: 'Failed to add declaration' });
  }
});

// Beyannameleri getir
app.get('/api/declarations', async (req, res) => {
  try {
    const declarationsSnapshot = await db.collection('declarations').orderBy('created_at', 'desc').get();
    const declarations = [];
    // Müşteri bilgilerini de almak için (performans açısından dikkatli olun)
    // Her beyanname için ayrı müşteri sorgusu yapmak yerine,
    // istemci tarafında müşteri listesini alıp birleştirmek daha verimli olabilir
    // veya beyanname dokümanına müşteri adını da ekleyebilirsiniz (denormalizasyon).
    // Bu örnekte basit tutulmuştur.
    for (const doc of declarationsSnapshot.docs) {
      const declarationData = doc.data();
      let customerName = 'N/A';
      let ledgerType = 'N/A';
      if (declarationData.customer_id) {
        const customerDoc = await db.collection('customers').doc(declarationData.customer_id).get();
        if (customerDoc.exists) {
          customerName = customerDoc.data().name;
          ledgerType = customerDoc.data().ledger_type;
        }
      }
      declarations.push({ 
        id: doc.id, 
        ...declarationData,
        customer_name: customerName, // İstemcinin beklediği alan
        ledger_type: ledgerType // İstemcinin beklediği alan
      });
    }
    res.json(declarations);
  } catch (error) {
    console.error('Error fetching declarations:', error);
    res.status(500).json({ error: 'Failed to fetch declarations' });
  }
});

// Durum güncelle
app.put('/api/declarations/:id', async (req, res) => {
  try {
    const { status, completed_at, note } = req.body;
    const declarationRef = db.collection('declarations').doc(req.params.id);
    
    const updateData = {
      status,
      note
    };

    if (completed_at) {
      // completed_at string ise Firestore Timestamp'e çevir
      // Eğer istemciden zaten Timestamp geliyorsa bu adıma gerek yok
      updateData.completed_at = admin.firestore.Timestamp.fromDate(new Date(completed_at));
    } else if (status === 'Tamamlandı' && !completed_at) {
        updateData.completed_at = admin.firestore.FieldValue.serverTimestamp(); // Veya null bırakılabilir
    }


    await declarationRef.update(updateData);
    res.json({ updated: req.params.id });
  } catch (error) {
    console.error('Error updating declaration:', error);
    res.status(500).json({ error: 'Failed to update declaration' });
  }
});

// Beyanname sil
app.delete('/api/declarations/:id', async (req, res) => {
  try {
    await db.collection('declarations').doc(req.params.id).delete();
    res.json({ deleted: req.params.id });
  } catch (error) {
    console.error('Error deleting declaration:', error);
    res.status(500).json({ error: 'Failed to delete declaration' });
  }
});

// Müşteri ve ilişkili beyannameleri sil
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const customerRef = db.collection('customers').doc(customerId);

    // 1. Müşteriye ait beyannameleri bul ve sil
    const declarationsQuery = db.collection('declarations').where('customer_id', '==', customerId);
    const declarationsSnapshot = await declarationsQuery.get();

    if (!declarationsSnapshot.empty) {
      const batch = db.batch();
      declarationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // 2. Müşteriyi sil
    await customerRef.delete();

    res.json({ deleted: customerId, message: 'Customer and associated declarations deleted.' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Sunucunun beklenmedik şekilde kapanmasını engelleyen 'hayatta tutma' mekanizması
function keepAlive() {
  setTimeout(keepAlive, 1000 * 60 * 30); // 30 dakikada bir
}
keepAlive();
