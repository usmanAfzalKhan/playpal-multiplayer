import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCJ7EDUS4JcZN0GoYCzUuaj1SZcLAqUFjU",
  authDomain: "playpal-5a832.firebaseapp.com",
  projectId: "playpal-5a832",
  storageBucket: "playpal-5a832.appspot.com", // 🔥 Corrected from .app to .appspot.com
  messagingSenderId: "653665274946",
  appId: "1:653665274946:web:dd492b06e198118ffd31db",
  measurementId: "G-H91KHTMDKL"
};

// 🔥 Initialize Firebase once, re-use the app instance if it exists
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
