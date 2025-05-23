import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCJ7EDUS4JcZN0GoYCzUuaj1SZcLAqUFjU",
  authDomain: "playpal-5a832.firebaseapp.com",
  projectId: "playpal-5a832",
  storageBucket: "playpal-5a832.firebasestorage.app",
  messagingSenderId: "653665274946",
  appId: "1:653665274946:web:dd492b06e198118ffd31db",
  measurementId: "G-H91KHTMDKL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const analytics = getAnalytics(app);
