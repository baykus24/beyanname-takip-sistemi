const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://beyanname-takip.firebaseio.com`
}, 'validator'); // Farklı bir isimle başlatarak çakışmaları önle

// Betiğe özel olarak isimlendirilmiş ('validator') uygulama örneğinden veritabanını al
const db = admin.app('validator').firestore();

/**
 * Bu betik, 'declarations' koleksiyonundaki her bir belgeyi kontrol eder.
 * 'created_at' alanının varlığını ve türünün 'timestamp' olup olmadığını doğrular.
 * Sorunlu belgelerin ID'lerini ve sorun nedenini listeler.
 */
async function validateData() {
  console.log('Veri doğrulama işlemi başlıyor...');
  const declarationsRef = db.collection('declarations');
  const snapshot = await declarationsRef.get();

  if (snapshot.empty) {
    console.log('Declarations koleksiyonunda hiç belge bulunamadı.');
    return;
  }

  const problematicDocs = [];
  let checkedCount = 0;

  snapshot.forEach(doc => {
    checkedCount++;
    const data = doc.data();
    const docId = doc.id;

    // Kontrol 1: 'created_at' alanı var mı?
    if (!data.hasOwnProperty('created_at')) {
      // 'completed_at' var mı diye kontrol et, daha spesifik bir neden sun
      if (data.hasOwnProperty('completed_at')) {
        problematicDocs.push({ id: docId, reason: "'created_at' alanı eksik, ancak 'completed_at' alanı bulundu." });
      } else {
        problematicDocs.push({ id: docId, reason: "'created_at' alanı eksik." });
      }
      return; // Sonrakine geç
    }

    // Kontrol 2: 'created_at' alanı bir Timestamp mi?
    if (!(data.created_at instanceof admin.firestore.Timestamp)) {
      const type = typeof data.created_at;
      problematicDocs.push({ id: docId, reason: `'created_at' alanı bir Timestamp değil. Bulunan tür: ${type}` });
    }
  });

  console.log(`Toplam ${checkedCount} belge kontrol edildi.`);

  if (problematicDocs.length > 0) {
    console.error('\n--- SORUNLU BELGELER BULUNDU ---');
    console.error(`Toplam ${problematicDocs.length} sorunlu belge tespit edildi:`);
    problematicDocs.forEach(p => {
      console.error(`- ID: ${p.id}, Neden: ${p.reason}`);
    });
    console.error('---------------------------------');
    console.error("Lütfen bu sorunları gidermek için bir sonraki adımı bekleyin.");
  } else {
    console.log('Tebrikler! Tüm belgelerdeki "created_at" alanı geçerli görünüyor.');
  }

  console.log('Veri doğrulama işlemi tamamlandı.');
}

validateData().catch(error => {
  console.error('Veri doğrulama sırasında bir hata oluştu:', error);
});
