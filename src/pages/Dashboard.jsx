import './Dashboard.css';
import logo from '../assets/logo.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import {
  doc, getDoc, collection, query, where, getDocs, setDoc, Timestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';

function Dashboard() {
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsername = async () => {
      const user = auth.currentUser;
      if (!user) return navigate('/');

      const docRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(docRef);
      if (userSnap.exists()) {
        setUsername(userSnap.data().username);
      }
    };

    fetchUsername();
  }, []);

  const handleSearchChange = async (e) => {
    const queryInput = e.target.value;
    setSearchQuery(queryInput);
    setSuggestions([]);

    if (queryInput.trim() === '') return;

    const q = query(collection(db, 'users'), where('username', '>=', queryInput), where('username', '<=', queryInput + '\uf8ff'));
    const snapshot = await getDocs(q);

    const results = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (doc.id !== auth.currentUser.uid) {
        results.push({ ...data, uid: doc.id });
      }
    });

    setSuggestions(results);
  };

  const handleAddFriend = async (user) => {
    try {
      const currentUid = auth.currentUser.uid;
      const friendUid = user.uid;

      await setDoc(doc(db, `users/${currentUid}/friends/${friendUid}`), {
        username: user.username,
        addedAt: Timestamp.now()
      });

      setSearchQuery('');
      setSuggestions([]);
    } catch (err) {
      console.error('❌ Error adding friend:', err);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          title="Logout"
          onClick={() => { auth.signOut(); navigate('/'); }}
          style={{ cursor: 'pointer' }}
        />
        <div className="header-controls">
          <FaSearch
            className="search-icon"
            onClick={() => setShowSearch(!showSearch)}
            title="Search users"
          />
          {showSearch && (
            <div className="search-container">
              <input
                type="text"
                placeholder="Search by username..."
                className="search-box"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {suggestions.length > 0 && (
                <div className="search-suggestions">
                  {suggestions.map(user => (
                    <div key={user.uid} className="suggestion-item">
                      @{user.username}
                      <button onClick={() => handleAddFriend(user)}>Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <span
            className="profile-icon"
            title={`Logged in as @${username}`}
            onClick={() => navigate('/profile')}
          >
            👤
          </span>
        </div>
      </header>

      {/* Game Gallery */}
      <main className="dashboard-main">
        <h2 style={{ textAlign: 'center' }}>🎮 Games</h2>
        <div className="game-grid">
          <div className="game-card">
            <img src="https://via.placeholder.com/150" alt="Tic Tac Toe" />
            <p>Tic Tac Toe</p>
          </div>
          <div className="game-card">
            <img src="https://via.placeholder.com/150" alt="Coming Soon" />
            <p>More Games Coming</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        © {new Date().getFullYear()} PlayPal. Built with ❤️ by{' '}
        <a
          href="https://github.com/usmanAfzalKhan"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          Usman Khan
        </a>
        .
      </footer>
    </div>
  );
}

export default Dashboard;
