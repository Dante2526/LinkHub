import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();

export const isFirebaseConfigured = Boolean(rawApiKey && rawProjectId);

if (import.meta.env.PROD && !isFirebaseConfigured) {
  throw new Error('Firebase config ausente em producao. Defina VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID.');
}

const firebaseConfig = isFirebaseConfigured ? {
  apiKey: rawApiKey!,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || 'linkhub-preview.firebaseapp.com',
  projectId: rawProjectId!,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || 'linkhub-preview.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || '1:123456789012:web:abcdef123456'
} : null;

export const app = firebaseConfig ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)) : null as any;
export const db = app ? getFirestore(app) : null as any;
export const storage = app ? getStorage(app) : null as any;

