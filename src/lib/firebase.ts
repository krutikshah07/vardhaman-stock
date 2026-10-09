import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

export const firebaseConfig = firebaseConfigJson;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

try {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    console.warn('Firestore multi-tab persistence warning:', err);
  });
} catch (error) {
  console.warn('Could not enable Firestore persistence:', error);
}

