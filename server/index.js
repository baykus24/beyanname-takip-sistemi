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

// --- CORS Ayarları ---
// Gelen isteklerin hangi kaynaklardan kabul edileceğini belirtin.
const allowedOrigins = [
  'http://localhost:3000', // Geliştirme ortamı için
  'https://lively-malasada-eba26f.netlify.app' // Netlify'daki siteniz için
];

const corsOptions = {
  origin: function (origin, callback) {
    // Eğer istek gelen kaynak izinli listesindeyse veya kaynak yoksa (örn. Postman gibi araçlar)
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions)); // CORS'u bu seçeneklerle etkinleştirin
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
    res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
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

// Beyannameleri getir (Filtreleme ve Sayfalama ile)
app.get('/api/declarations', async (req, res) => {
  try {
    const { limit = 20, lastVisible, month, year, type, status, ledger } = req.query;
    console.log(`\n--- [SERVER-LOG] New Request ---`);
    console.log(`[SERVER-LOG] Filters: month=${month}, year=${year}, type=${type}, status=${status}, ledger=${ledger}`);
    
    let query = db.collection('declarations');

    if (ledger) {
      const customersSnapshot = await db.collection('customers').where('ledger_type', '==', ledger).get();
      const customerIds = customersSnapshot.docs.map(doc => doc.id);

      if (customerIds.length === 0) {
        console.log('[SERVER-LOG] No customers found for ledger type. Returning empty.');
        return res.json({ declarations: [], lastVisible: null });
      }
      query = query.where('customer_id', 'in', customerIds);
    }

    if (month) query = query.where('month', '==', parseInt(month, 10));
    if (year) query = query.where('year', '==', parseInt(year, 10));
    if (type) query = query.where('type', '==', type);
    if (status) query = query.where('status', '==', status);

    query = query.orderBy('created_at', 'desc').orderBy('__name__', 'desc');

    if (lastVisible) {
      console.log(`[SERVER-LOG] Received lastVisible cursor ID: ${lastVisible}`);
      const lastVisibleDoc = await db.collection('declarations').doc(lastVisible).get();
      if (lastVisibleDoc.exists) {
        const docData = lastVisibleDoc.data();
        // Defensively check if created_at exists and is a valid Timestamp
        if (docData && docData.created_at && typeof docData.created_at.toDate === 'function') {
            const cursorTimestamp = docData.created_at;
            const cursorId = lastVisibleDoc.id;
            console.log(`[SERVER-LOG] Cursor doc found. Timestamp: ${cursorTimestamp.toDate().toISOString()}, ID: ${cursorId}`);
            query = query.startAfter(cursorTimestamp, cursorId);
        } else {
            // Log a warning if the cursor doc is invalid, and fetch from the beginning
            // This prevents a server crash and still returns data to the user
            console.log(`[SERVER-LOG] WARNING: lastVisible document with id ${lastVisible} has an invalid 'created_at' field. Ignoring cursor and fetching first page.`);
        }
      } else {
        console.log(`[SERVER-LOG] WARNING: lastVisible document with id ${lastVisible} was NOT FOUND.`);
      }
    } else {
        console.log('[SERVER-LOG] No lastVisible cursor received. Fetching first page.');
    }

    query = query.limit(Number(limit));

    const declarationsSnapshot = await query.get();
    if (declarationsSnapshot.empty) {
      console.log('[SERVER-LOG] Query returned no documents.');
      return res.json({ declarations: [], lastVisible: null });
    }

    const customerIds = [...new Set(declarationsSnapshot.docs.map(doc => doc.data().customer_id).filter(id => id))];
    let customersMap = new Map();
    if (customerIds.length > 0) {
      const customerPromises = [];
      for (let i = 0; i < customerIds.length; i += 30) {
        const chunk = customerIds.slice(i, i + 30);
        customerPromises.push(
          db.collection('customers').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
        );
      }
      const customerSnapshots = await Promise.all(customerPromises);
      customerSnapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
          customersMap.set(doc.id, doc.data());
        });
      });
    }

    const declarations = declarationsSnapshot.docs.map(doc => {
      const declarationData = doc.data();
      const customerData = customersMap.get(declarationData.customer_id) || { name: 'Bilinmeyen Müşteri', ledger_type: 'N/A' };
      return {
        id: doc.id,
        ...declarationData,
        customer_name: customerData.name,
        ledger_type: customerData.ledger_type
      };
    });

    const returnedIds = declarations.map(d => d.id);
    console.log(`[SERVER-LOG] Returning ${returnedIds.length} declarations. IDs: [${returnedIds.join(', ')}]`);

    const newLastVisible = declarationsSnapshot.docs.length > 0 ? declarationsSnapshot.docs[declarationsSnapshot.docs.length - 1].id : null;
    console.log(`[SERVER-LOG] Sending new lastVisible cursor to client: ${newLastVisible}`);

    res.json({
      declarations,
      lastVisible: newLastVisible
    });

  } catch (error) {
    console.error('[SERVER-LOG] CRITICAL ERROR in /api/declarations:', error);

    // Firestore often includes a link to create the required index in the error details.
    // We will log this to make it easy to fix.
    let indexCreationUrl = null;
    const errorMessage = error.details || error.message || '';
    
    // Regex to find a URL in the error message, specifically for Firestore indexes
    const urlRegex = /(https?:\/\/[^\s]*console\.firebase\.google\.com[^\s]*)/;
    const match = errorMessage.match(urlRegex);
    
    if (match && match[0]) {
      indexCreationUrl = match[0];
      console.error(`[SERVER-LOG] Firestore Index Creation URL Found: ${indexCreationUrl}`);
    } else if (error.details) {
       console.error(`[SERVER-LOG] Firestore Index Creation Hint: ${error.details}`);
    }

    res.status(500).json({ 
      error: 'Failed to fetch declarations due to a server-side issue, possibly a missing database index.', 
      details: errorMessage,
      // Send the extracted URL to the client to make fixing it easy
      indexCreationUrl: indexCreationUrl 
    });
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
