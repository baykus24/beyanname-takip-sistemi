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
  'https://lively-malasada-eba26f.netlify.app', // Netlify'daki ana siteniz
  'https://68625625e6b73300080011f9--lively-malasada-eba26f.netlify.app' // Son dağıtım önizlemesi
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
    // Explicitly create the object to be saved to prevent any issues.
    const newCustomer = {
      name: name,
      tax_no: tax_no,
      ledger_type: ledger_type,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    const customerRef = await db.collection('customers').add(newCustomer);
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

// Müşteri sayısını getir
app.get('/api/customers/count', async (req, res) => {
  try {
    const snapshot = await db.collection('customers').get();
    res.json({ count: snapshot.size });
  } catch (error) {
    console.error('Error fetching customer count:', error);
    res.status(500).json({ error: 'Failed to fetch customer count' });
  }
});

// Beyanname ekle
app.post('/api/declarations', async (req, res) => {
  try {
    // ledger_type is now accepted directly from the body for robustness.
    const { customer_id, type, month, year, ledger_type: direct_ledger_type } = req.body;
    if (!customer_id || !type || !month || !year) {
      return res.status(400).json({ error: 'Missing required fields: customer_id, type, month, year' });
    }

    let final_ledger_type = direct_ledger_type;

    // If the ledger_type was not passed directly (for older clients or other uses), fetch it from the customer as a fallback.
    if (!final_ledger_type) {
        console.log(`[SERVER-LOG] Ledger type not passed directly for customer ${customer_id}, fetching from customer doc...`);
        const customerDoc = await db.collection('customers').doc(customer_id).get();
        if (!customerDoc.exists) {
          return res.status(404).json({ error: 'Customer not found' });
        }
        const customerData = customerDoc.data();
        final_ledger_type = customerData.ledger_type;
    }

    // Enforce data integrity. Every declaration must have a ledger_type.
    if (!final_ledger_type) {
      console.error(`[SERVER-ERROR] Critical data integrity issue: Could not determine ledger_type for customer ${customer_id}.`);
      return res.status(500).json({ error: `Customer data is incomplete and missing a ledger_type.` });
    }

    const declarationRef = await db.collection('declarations').add({
      customer_id,
      type,
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      status: 'Bekliyor', // Default status
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      completed_at: null,
      note: '',
      ledger_type: final_ledger_type // Use the determined ledger_type
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
      // New logic: Directly query by the denormalized 'ledger_type' field.
      // This avoids the 30-item limit of 'in' queries and is more performant.
      // This requires a one-time data migration to add 'ledger_type' to all declarations.
      query = query.where('ledger_type', '==', ledger);
    }

    if (month) query = query.where('month', '==', parseInt(month, 10));
    if (year) query = query.where('year', '==', parseInt(year, 10));
    if (type) query = query.where('type', '==', type);
    if (status) query = query.where('status', '==', status);

    // query = query.orderBy('created_at', 'desc').orderBy('__name__', 'desc'); // Hata ayıklama için geçici olarak devre dışı bırakıldı

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
      // The customer's name is fetched for display purposes.
      // The declaration's own ledger_type is trusted as the source of truth.
      const customerData = customersMap.get(declarationData.customer_id) || { name: 'Bilinmeyen Müşteri' };
      return {
        id: doc.id,
        ...declarationData, // This correctly includes the ledger_type from the declaration itself
        customer_name: customerData.name,
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
    if (error.details) {
      console.error(`[SERVER-LOG] Firestore Index Creation Hint: ${error.details}`);
    }

    res.status(500).json({ 
      error: 'Failed to fetch declarations', 
      details: error.details || error.message 
    });
  }
});



// Temporary Migration Endpoint to backfill 'ledger_type' in existing declarations.
// This should be removed after the one-time migration is complete.




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





const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Sunucunun beklenmedik şekilde kapanmasını engelleyen 'hayatta tutma' mekanizması
function keepAlive() {
  setTimeout(keepAlive, 1000 * 60 * 30); // 30 dakikada bir
}
keepAlive();
