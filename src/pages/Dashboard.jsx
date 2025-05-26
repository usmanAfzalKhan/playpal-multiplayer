import './Dashboard.css';
import logo from '../assets/logo.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, deleteDoc, setDoc, Timestamp } from 'firebase/firestore';
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

    const fetchUserData = async () => {
      const docRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(docRef);
      if (userSnap.exists()) {
        setUsername(userSnap.data().username);
      }

      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriendsList(friendsSnap.docs.map(doc => doc.id));
    };

    fetchUserData();

    const unsub = onSnapshot(collection(db, `users/${user.uid}/notifications`), snapshot => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [navigate]);

  const handleSearchChange = async (e) => {
    const queryInput = e.target.value;
    setSearchQuery(queryInput);
    setSuggestions([]);
    setActionMessage('');

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

  const handleSendRequest = async (user) => {
    try {
      const currentUid = auth.currentUser.uid;
      const targetUid = user.uid;

      await setDoc(doc(db, `users/${targetUid}/requests/${currentUid}`), {
        username,
        requestedAt: Timestamp.now(),
      });

      await setDoc(doc(db, `users/${targetUid}/notifications/${currentUid}-request`), {
        message: `📬 @${username} sent you a friend request!`,
        createdAt: Timestamp.now(),
      });

      setActionMessage(`✅ Friend request sent to @${user.username}`);
      setTimeout(() => setActionMessage(''), 3000);
      setSearchQuery('');
      setSuggestions([]);
    } catch (err) {
      setActionMessage('❌ Error sending friend request.');
      setTimeout(() => setActionMessage(''), 3000);
    }
  };

  const markNotificationRead = async (notifId) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/notifications/${notifId}`));
  };

  return (
    <div className="dashboard-container">
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
                  {suggestions.map(user => {
                    const isAlreadyFriend = friendsList.includes(user.uid);
                    return (
                      <div key={user.uid} className="suggestion-item">
                        @{user.username}
                        {!isAlreadyFriend ? (
                          <button onClick={() => handleSendRequest(user)}>Add</button>
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
              title="Notifications"
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
                      {notif.type === 'hangman_invite' && (
                        <button onClick={() => {
                          navigate(`/hangman/multiplayer/${notif.gameId}`);
                          markNotificationRead(notif.id);
                        }}>Join Game</button>
                      )}
                      <button onClick={() => markNotificationRead(notif.id)}>Mark as Read</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <span
            className="profile-icon"
            title={`Logged in as @${username}`}
            onClick={() => navigate('/profile')}
          >
            👤
          </span>
        </div>
      </header>

      {actionMessage && <p style={{ color: 'white', textAlign: 'center' }}>{actionMessage}</p>}

      <main className="dashboard-main">
        <h2 style={{ textAlign: 'center' }}>🎮 Games</h2>
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/hangman/multiplayer')}>
            <img src="https://via.placeholder.com/150" alt="Hangman Multiplayer" />
            <p>Multiplayer Hangman</p>
          </div>
          <div className="game-card" onClick={() => navigate('/hangman/single')}>
            <img src="https://via.placeholder.com/150" alt="Hangman Single Player" />
            <p>Single Player Hangman</p>
          </div>
          <div className="game-card">
            <img src="https://via.placeholder.com/150" alt="Coming Soon" />
            <p>More Games Coming</p>
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

export default Dashboard;
