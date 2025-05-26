import './Dashboard.css';
import logo from '../assets/logo.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  deleteDoc,
  setDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaBell } from 'react-icons/fa';

function Dashboard() {
  const [username, setUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [actionMessage, setActionMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return navigate('/');

    // Fetch username & friends list
    (async () => {
      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) setUsername(uSnap.data().username);

      const fSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriendsList(fSnap.docs.map(d => d.id));
    })();

    // Listen for notifications
    const unsub = onSnapshot(
      collection(db, `users/${auth.currentUser.uid}/notifications`),
      snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [navigate]);

  const handleSearchChange = async e => {
    const q = e.target.value;
    setSearchQuery(q);
    setSuggestions([]);
    setActionMessage('');
    if (!q.trim()) return;

    const usersQ = query(
      collection(db, 'users'),
      where('username', '>=', q),
      where('username', '<=', q + '\uf8ff')
    );
    const snap = await getDocs(usersQ);
    const res = [];
    snap.forEach(d => {
      if (d.id !== auth.currentUser.uid) res.push({ uid: d.id, ...d.data() });
    });
    setSuggestions(res);
  };

  const handleSendRequest = async u => {
    try {
      const me = auth.currentUser.uid;
      await setDoc(doc(db, `users/${u.uid}/requests/${me}`), {
        username,
        requestedAt: Timestamp.now()
      });
      await setDoc(
        doc(db, `users/${u.uid}/notifications/${me}-request`),
        {
          type: 'friend_request',
          message: `📬 @${username} sent you a friend request!`,
          timestamp: Timestamp.now()
        }
      );
      setActionMessage(`✅ Friend request sent to @${u.username}`);
      setTimeout(() => setActionMessage(''), 3000);
      setSearchQuery('');
      setSuggestions([]);
    } catch {
      setActionMessage('❌ Error sending friend request.');
      setTimeout(() => setActionMessage(''), 3000);
    }
  };

  const markNotificationRead = async id => {
    await deleteDoc(doc(db, `users/${auth.currentUser.uid}/notifications/${id}`));
  };

  const acceptHangmanInvite = async notif => {
    // Activate the game (invite OR rematch)
    await updateDoc(doc(db, `hangman_games/${notif.gameId}`), { status: 'active' });
    markNotificationRead(notif.id);
    navigate(`/hangman/multiplayer/${notif.gameId}`);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          onClick={() => (auth.signOut(), navigate('/'))}
          style={{ cursor: 'pointer' }}
        />
        <div className="header-controls">
          <FaSearch
            className="search-icon"
            onClick={() => setShowSearch(!showSearch)}
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
                  {suggestions.map(u => {
                    const isFriend = friendsList.includes(u.uid);
                    return (
                      <div key={u.uid} className="suggestion-item">
                        @{u.username}
                        {!isFriend ? (
                          <button onClick={() => handleSendRequest(u)}>Add</button>
                        ) : (
                          <span>Already a friend</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="notif-container">
            <FaBell
              className="notif-bell"
              onClick={() => setShowNotifications(!showNotifications)}
            />
            {notifications.length > 0 && (
              <span className="notif-count">{notifications.length}</span>
            )}
            {showNotifications && (
              <div className="notif-dropdown">
                {notifications.length === 0 ? (
                  <p>No new notifications.</p>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="notif-item">
                      <p>{notif.message}</p>
                      {(notif.type === 'hangman_invite' ||
                        notif.type === 'hangman_rematch') && (
                        <button onClick={() => acceptHangmanInvite(notif)}>
                          {notif.type === 'hangman_invite'
                            ? 'Join Game'
                            : 'Join Rematch'}
                        </button>
                      )}
                      <button onClick={() => markNotificationRead(notif.id)}>
                        Mark as Read
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <span className="profile-icon" onClick={() => navigate('/profile')}>
            👤
          </span>
        </div>
      </header>

      {actionMessage && (
        <p style={{ color: 'white', textAlign: 'center' }}>
          {actionMessage}
        </p>
      )}

      <main className="dashboard-main">
        <h2 style={{ textAlign: 'center' }}>🎮 Games</h2>
        <div className="game-grid">
          <div
            className="game-card"
            onClick={() => navigate('/hangman/single')}
          >
            <img
              src="https://via.placeholder.com/150"
              alt="Single Player Hangman"
            />
            <p>Single Player Hangman</p>
          </div>
          <div
            className="game-card"
            onClick={() => navigate('/hangman/multiplayer')}
          >
            <img
              src="https://via.placeholder.com/150"
              alt="Multiplayer Hangman"
            />
            <p>Multiplayer Hangman</p>
          </div>
        </div>
      </main>

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
      </footer>
    </div>
  );
}

export default Dashboard;
