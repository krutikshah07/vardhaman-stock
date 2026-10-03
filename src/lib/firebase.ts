import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err && typeof err === 'object' && 'code' in err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode !== 'failed-precondition' && errorCode !== 'unimplemented') {
        console.warn('Firestore persistence unavailable:', err);
      }
    } else {
      console.warn('Firestore persistence unavailable:', err);
    }
  });
} catch (error) {
  console.warn('Could not enable Firestore persistence:', error);
}

// Connectivity check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
