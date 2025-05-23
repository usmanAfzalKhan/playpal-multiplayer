import './AuthPage.css';
import logo from '../assets/logo.png';
import { useState } from 'react';
import { auth, db } from '../firebase-config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        // 🔍 Lookup email using username
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          throw new Error('No user found with that username.');
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        const userEmail = userData.email;

        await signInWithEmailAndPassword(auth, userEmail, password);
        alert(`✅ Welcome back, @${userData.username}!`);
      } else {
        // 🧾 Sign up and store user
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          email,
          username,
          createdAt: new Date().toISOString()
        });
        alert(`✅ Account created for @${username}`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    const userEmail = prompt('Enter your email to receive a password reset link:');
    if (!userEmail) return;

    try {
      await sendPasswordResetEmail(auth, userEmail);
      alert('📩 Password reset email sent!');
    } catch (err) {
      alert('❌ ' + err.message);
    }
  };

  return (
    <div className="auth-container">
      <a
        href="https://github.com/usmanAfzalKhan/playpal-multiplayer"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src={logo} alt="PlayPal Logo" className="auth-logo" />
      </a>

      <div className="auth-box">
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {!isLogin && (
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>

          {/* 🔐 Forgot password link (only on login) */}
          {isLogin && (
            <p
              style={{
                marginTop: '0.75rem',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              onClick={handleForgotPassword}
            >
              Forgot password?
            </p>
          )}
        </form>

        {error && (
          <p style={{ color: 'red', marginTop: '0.5rem', fontSize: '0.9rem' }}>{error}</p>
        )}

        <p className="switch-mode">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <span
            style={{ cursor: 'pointer', color: '#38bdf8' }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setPassword('');
            }}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default AuthPage;
