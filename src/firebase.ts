import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCpEyuthFrYyIrKDhG6aSQOVYpEa5pxkY8',
  authDomain: 'essential-topic-356606.firebaseapp.com',
  projectId: 'essential-topic-356606',
  storageBucket: 'essential-topic-356606.firebasestorage.app',
  messagingSenderId: '352990493853',
  appId: '1:352990493853:web:207bd188b2ca3b846be874',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Emails autorizados para crear/editar juegos desde /admin.
 * Editá esta lista y redeploya. La validación real se hace en Firestore/Storage rules.
 */
export const ADMIN_EMAILS = [
  'oswaldosan92@gmail.com',
  'enriquesunsin@gmail.com',
];

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.toLowerCase());
