// src/pages/AuthPage.jsx

// Import required React hooks and libraries
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // For navigation and link
import { auth, db } from '../firebase-config';       // Firebase auth & Firestore instances

// Import Firebase Authentication methods
import {
  signInWithEmailAndPassword,     // Function to log in with email/password
  createUserWithEmailAndPassword, // Function to register a new user
  sendPasswordResetEmail          // Function to send password reset email
} from 'firebase/auth';

// Import Firestore methods
import {
  doc,         // To create a reference to a Firestore document
  setDoc,      // To write data to a Firestore document
  collection,  // To refer to a collection
  query,       // To query Firestore documents
  where,       // To add a 'where' clause to a query
  getDocs      // To execute a query and get documents
} from 'firebase/firestore';

import './AuthPage.css';           // CSS styling for this page
import logo from '../assets/logo.png'; // Path to the logo image

export default function AuthPage() {
  // State to toggle between Login and Sign Up view
  const [isLogin, setIsLogin]   = useState(true);

  // State variables for form inputs
  const [username, setUsername] = useState(''); // Username or login identifier
  const [email, setEmail]       = useState(''); // Email (only used on sign-up)
  const [password, setPassword] = useState(''); // Password input

  // State for displaying error messages
  const [error, setError]       = useState('');

  // React Router hook to programmatically navigate
  const navigate = useNavigate();

  // Form submission handler (login OR registration)
  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setError(''); // Reset error message on new submit

    try {
      if (isLogin) {
        // ─── LOGIN FLOW ───────────────────────────────────
        // 1) Look up Firestore user document by username field
        const usersRef = collection(db, 'users'); 
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // No user with that username exists
          throw new Error('No user found with that username.');
        }

        // Assume username is unique, so take the first matched document
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const userEmail = userData.email; 
        // We stored email at registration; now retrieve it for auth

        // 2) Sign in using Firebase Auth with retrieved email + password
        await signInWithEmailAndPassword(auth, userEmail, password);

        // 3) On successful login, redirect to dashboard
        navigate('/dashboard');
      } else {
        // ─── SIGN-UP FLOW ───────────────────────────────────
        // 1) Create a new Firebase Auth user account
        const userCred = await createUserWithEmailAndPassword(auth, email, password);

        // 2) Immediately store additional user info (username & email) in Firestore
        await setDoc(doc(db, 'users', userCred.user.uid), {
          username: username,
          email: email,
          createdAt: new Date().toISOString() // Save creation timestamp
        });

        // 3) After successful sign-up, redirect to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      // Display any errors that occurred during login or sign-up
      setError(err.message);
    }
  };

  // Handler for "Forgot password?" link
  const handleForgotPassword = async () => {
    // Prompt user for the email associated with their account
    const userEmail = window.prompt('Please enter your email to receive a password reset link:');
    if (!userEmail) return; // If they cancel, do nothing

    try {
      // Send password reset email via Firebase Auth
      await sendPasswordResetEmail(auth, userEmail);
      alert('📩 Password reset email sent!');
    } catch (err) {
      // Alert the user if any error occurs (e.g., invalid email)
      alert('❌ ' + err.message);
    }
  };

  return (
    <div className="auth-container">
      {/* Logo at top, clickable to go to home ("/") */}
      <div className="auth-logo-wrapper">
        <Link to="/">
          <img src={logo} alt="PlayPal Logo" className="auth-logo" />
        </Link>
      </div>

      {/* Form container */}
      <div className="auth-box">
        {/* Heading changes based on login vs. sign-up */}
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>

        {/* Form submission handled by handleSubmit */}
        <form onSubmit={handleSubmit}>
          {/* Username input (required for both login and sign-up) */}
          <input
            type="text"
            placeholder="Username"
            value={username}
            required
            onChange={(e) => setUsername(e.target.value.trim())} 
            // .trim() removes leading/trailing spaces
          />

          {/* Only show Email field when in sign-up mode */}
          {!isLogin && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value.trim())}
            />
          )}

          {/* Password input (required for both modes) */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* Display error message if one exists */}
          {error && <p className="auth-error">{error}</p>}

          {/* Submit button text changes based on mode */}
          <button type="submit" className="auth-submit-button">
            {isLogin ? 'Login' : 'Sign Up'}
          </button>

          {/* "Forgot password?" link only appears in login mode */}
          {isLogin && (
            <p className="forgot-password" onClick={handleForgotPassword}>
              Forgot password?
            </p>
          )}
        </form>

        {/* Toggle between login and sign-up */}
        <p className="switch-mode">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <span
            className="toggle-link"
            onClick={() => {
              setIsLogin(!isLogin); // Switch mode
              setError('');         // Clear any error messages
              setPassword('');      // Clear password field
            }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}
