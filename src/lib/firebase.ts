import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();

export const isFirebaseConfigured = Boolean(rawApiKey && rawProjectId);

const firebaseConfig = {
  apiKey: rawApiKey || 'AIzaSyDummyKeyForLocalPreview1234567890',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || 'linkhub-preview.firebaseapp.com',
  projectId: rawProjectId || 'linkhub-preview',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || 'linkhub-preview.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '1:123456789012:web:abcdef123456'
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

