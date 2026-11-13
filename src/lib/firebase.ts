import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigurado = Boolean(config.apiKey && config.projectId);

export const app = initializeApp(firebaseConfigurado ? config : { apiKey: 'demo', projectId: 'demo-jeivi', authDomain: 'demo-jeivi.firebaseapp.com' });
export const auth = getAuth(app);
export const db = getFirestore(app);

/** Id de la iglesia. Hoy hay una sola; la estructura ya permite varias (multi-iglesia). */
export const IGLESIA_ID = import.meta.env.VITE_IGLESIA_ID || 'imperio-de-vida';
