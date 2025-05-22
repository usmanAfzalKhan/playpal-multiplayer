// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCJ7EDUS4JcZN0GoYCzUuaj1SZcLAqUFjU",
  authDomain: "playpal-5a832.firebaseapp.com",
  projectId: "playpal-5a832",
  storageBucket: "playpal-5a832.firebasestorage.app",
  messagingSenderId: "653665274946",
  appId: "1:653665274946:web:dd492b06e198118ffd31db",
  measurementId: "G-H91KHTMDKL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);