import './Dashboard.css';
import logo from '../assets/logo.png';
import singleHangmanImg from '../assets/singlehangman.png';
import multiHangmanImg from '../assets/multiplayerhangman.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaBell } from 'react-icons/fa';

export default function Dashboard() {
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

    // load username & friend-IDs
    (async () => {
      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) setUsername(uSnap.data().username);

      const fSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriendsList(fSnap.docs.map(d => d.id));
    })();

    // realtime notifications (hangman + ttt invites, etc.)
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

    const userQ = query(
      collection(db, 'users'),
      where('username', '>=', q),
      where('username', '<=', q + '\uf8ff')
    );
    const snap = await getDocs(userQ);
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
        requestedAt: new Date(),
      });
      await setDoc(
        doc(db, `users/${u.uid}/notifications/${me}-request`),
        {
          type: 'friend_request',
          message: `📬 @${username} sent you a friend request!`,
          timestamp: new Date(),
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
    await updateDoc(doc(db, `hangman_games/${notif.gameId}`), { status: 'active' });
    markNotificationRead(notif.id);
    navigate(`/hangman/multiplayer/${notif.gameId}`);
  };

  const acceptTicTacToeInvite = async notif => {
    await updateDoc(doc(db, `tictactoe_games/${notif.gameId}`), { status: 'active' });
    markNotificationRead(notif.id);
    navigate(`/tictactoe/multiplayer/${notif.gameId}`);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          onClick={() => { auth.signOut(); navigate('/'); }}
        />
        <div className="header-controls">
          <FaSearch className="search-icon" onClick={() => setShowSearch(!showSearch)} />
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
                        {!isFriend
                          ? <button onClick={() => handleSendRequest(u)}>Add</button>
                          : <span>Already a friend</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="notif-container">
            <FaBell className="notif-bell" onClick={() => setShowNotifications(!showNotifications)} />
            {notifications.length > 0 && <span className="notif-count">{notifications.length}</span>}
            {showNotifications && (
              <div className="notif-dropdown">
                {notifications.length === 0 ? (
                  <p>No new notifications.</p>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="notif-item">
                      <p>{notif.message}</p>
                      {notif.type === 'hangman_invite' && (
                        <button onClick={() => acceptHangmanInvite(notif)}>
                          Join Hangman
                        </button>
                      )}
                      {notif.type === 'tictactoe_invite' && (
                        <button onClick={() => acceptTicTacToeInvite(notif)}>
                          Join Tic-Tac-Toe
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

      {actionMessage && <p className="action-msg">{actionMessage}</p>}

      <main className="dashboard-main">
        <h2>🎮 Games</h2>

        {/* Hangman row */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/hangman/single')}>
            <img src={singleHangmanImg} alt="Single Player Hangman" />
            <p>Single Player Hangman</p>
          </div>
          <div className="game-card" onClick={() => navigate('/hangman/multiplayer')}>
            <img src={multiHangmanImg} alt="Multiplayer Hangman" />
            <p>Multiplayer Hangman</p>
          </div>
        </div>

        {/* Tic-Tac-Toe row */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/tictactoe/single')}>
            <img src="https://via.placeholder.com/150" alt="Single Player Tic-Tac-Toe" />
            <p>Single Player Tic-Tac-Toe</p>
          </div>
          <div className="game-card" onClick={() => navigate('/tictactoe/multiplayer')}>
            <img src="https://via.placeholder.com/150" alt="Multiplayer Tic-Tac-Toe" />
            <p>Multiplayer Tic-Tac-Toe</p>
          </div>
        </div>
      </main>

      <footer className="dashboard-footer">
        © {new Date().getFullYear()} PlayPal. Built with ❤️ by{' '}
        <a href="https://github.com/usmanAfzalKhan" target="_blank" rel="noopener noreferrer" className="footer-link">
          Usman Khan
        </a>.
      </footer>
    </div>
);
}
