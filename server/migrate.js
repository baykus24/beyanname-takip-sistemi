const admin = require('firebase-admin');
// Servis hesabı anahtarınızın doğru yolda olduğundan emin olun
const serviceAccount = require('./firebase-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Bu betik, 'declarations' koleksiyonundaki veri tutarsızlığını düzeltir.
 * 'completed_at' alanı olan ancak 'created_at' alanı olmayan belgeleri bulur,
 * 'completed_at' alanını 'created_at' olarak yeniden adlandırır.
 */
async function migrateData() {
  console.log('Veri düzeltme işlemi başlıyor...');
  const declarationsRef = db.collection('declarations');
  const snapshot = await declarationsRef.get();

  if (snapshot.empty) {
    console.log('Declarations koleksiyonunda hiç belge bulunamadı.');
    return;
  }

  // Toplu işlem (batch) performansı artırır
  const batch = db.batch();
  let updatedCount = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    // Anahtar koşul: 'completed_at' var, 'created_at' yok
    if (data.completed_at && !data.created_at) {
      console.log(`Belge güncelleniyor: ${doc.id}`);
      // 'completed_at' alanını sil ve değerini 'created_at' alanına ata
      batch.update(doc.ref, {
        created_at: data.completed_at,
        completed_at: admin.firestore.FieldValue.delete()
      });
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`Başarıyla ${updatedCount} belge güncellendi.`);
  } else {
    console.log('Güncellenmesi gereken hiçbir belge bulunamadı.');
  }
  console.log('Veri düzeltme işlemi tamamlandı.');
}

migrateData().catch(error => {
  console.error('Veri düzeltme sırasında bir hata oluştu:', error);
});
