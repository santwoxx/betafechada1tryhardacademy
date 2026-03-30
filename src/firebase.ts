import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAnrVBhSx-3XLwxvyFlPs4TBPEScWiTSK0",
  authDomain: "tryhard-academy-59e76.firebaseapp.com",
  projectId: "tryhard-academy-59e76",
  storageBucket: "tryhard-academy-59e76.firebasestorage.app",
  messagingSenderId: "378020596434",
  appId: "1:378020596434:web:6ec1e1ccbc4fb26c50fb0b",
  measurementId: "G-QZ1YWETCDM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
