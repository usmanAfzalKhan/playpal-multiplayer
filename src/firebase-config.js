// src/firebase-config.js

// ────────────────────────────────────────────────────────────────────────────────
// Firebase SDK Imports
// ────────────────────────────────────────────────────────────────────────────────

// Initialize and retrieve Firebase app instances
import { initializeApp, getApps, getApp } from "firebase/app";

// Firebase Authentication service
import { getAuth } from "firebase/auth";

// Firebase Cloud Firestore service
import { getFirestore } from "firebase/firestore";

// ────────────────────────────────────────────────────────────────────────────────
// Firebase Configuration
// ────────────────────────────────────────────────────────────────────────────────
// This object contains all the keys and identifiers needed to connect to your
// Firebase project. It is provided by Firebase when you create your project.
const firebaseConfig = {
  apiKey: "AIzaSyCJ7EDUS4JcZN0GoYCzUuaj1SZcLAqUFjU",
  authDomain: "playpal-5a832.firebaseapp.com",
  projectId: "playpal-5a832",
  storageBucket: "playpal-5a832.appspot.com",
  messagingSenderId: "653665274946",
  appId: "1:653665274946:web:dd492b06e198118ffd31db",
  measurementId: "G-H91KHTMDKL",
};

// ────────────────────────────────────────────────────────────────────────────────
// Initialize Firebase App
// ────────────────────────────────────────────────────────────────────────────────
// Firebase allows multiple app instances. `getApps()` returns a list of already
// initialized apps. If no app has been initialized, we call `initializeApp(...)`
// with our config. Otherwise, we retrieve the existing app using `getApp()`.
const app = !getApps().length
  ? // If there are no initialized apps, create a new one:
    initializeApp(firebaseConfig)
  : // If an app already exists, reuse it:
    getApp();

// ────────────────────────────────────────────────────────────────────────────────
// Export Firebase Services
// ────────────────────────────────────────────────────────────────────────────────

// Export the Authentication service, which provides methods for login, signup, and user management.
// `auth` will be used in other parts of the app to check the current user, sign in, sign out, etc.
export const auth = getAuth(app);

// Export the Firestore database service for reading/writing documents.
// `db` will be used throughout the app to interact with Firestore collections and documents.
export const db = getFirestore(app);
