import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJ7EDUS4JcZN0GoYCzUuaj1SZcLAqUFjU",
  authDomain: "playpal-5a832.firebaseapp.com",
  projectId: "playpal-5a832",
  storageBucket: "playpal-5a832.appspot.com",
  messagingSenderId: "653665274946",
  appId: "1:653665274946:web:dd492b06e198118ffd31db",
  measurementId: "G-H91KHTMDKL"
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(app);
export const db   = getFirestore(app);

if (window.location.hostname === "localhost") {
  //  ⬅ make sure this runs in both windows
  connectFirestoreEmulator(db, "localhost", 8080);
}
