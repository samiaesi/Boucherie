import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuration du projet Firebase (Console Firebase > Paramètres du projet > Vos applications).
// Ces valeurs sont publiques par nature : la sécurité est assurée par firestore.rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyBN9HORxPXiOq5_DLTnqacLONlBBkvifbo',
  authDomain: 'boucherie-bcf8f.firebaseapp.com',
  projectId: 'boucherie-bcf8f',
  storageBucket: 'boucherie-bcf8f.firebasestorage.app',
  messagingSenderId: '443612094785',
  appId: '1:443612094785:web:99f2e053f58c14c6a801c0',
  measurementId: 'G-ZLHYMCT6SP',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
