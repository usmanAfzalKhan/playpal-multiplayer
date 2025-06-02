// src/pages/Dashboard.jsx
import './Dashboard.css';
import logo                   from '../assets/logo.png';
import singleHangmanImg       from '../assets/singlehangman.png';
import multiHangmanImg        from '../assets/multiplayerhangman.png';
import singleTicTacToeImg     from '../assets/singleplayertictactoe.png';
import multiTicTacToeImg      from '../assets/multiplayertictactoe.png';
import singleConnectFourImg   from '../assets/connectfoursingleplayer.png';
import multiConnectFourImg    from '../assets/connectfourmultiplayer.png';
import singleBattleshipImg    from '../assets/singleplayerbattleship.png';
import multiBattleshipImg     from '../assets/multiplayerbattleship.png';
import singleDuelImg          from '../assets/singleplayerduelshots.png';
import { useEffect, useState } from 'react';
import { auth, db }            from '../firebase-config';
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
import { useNavigate }         from 'react-router-dom';
import { FaSearch, FaBell }    from 'react-icons/fa';

export default function Dashboard() {
  const [username, setUsername]                   = useState('');
  const [searchQuery, setSearchQuery]             = useState('');
  const [showSearch, setShowSearch]               = useState(false);
  const [suggestions, setSuggestions]             = useState([]);
  const [friendsList, setFriendsList]             = useState([]);
  const [actionMessage, setActionMessage]         = useState('');
  const [notifications, setNotifications]         = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();

  // ─── Load user info + subscribe to notifications ───
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return navigate('/');
    (async () => {
      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) setUsername(uSnap.data().username);
      const fSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriendsList(fSnap.docs.map(d => d.id));
    })();

    // Subscribe to notifications under "users/{uid}/notifications"
    const unsub = onSnapshot(
      collection(db, `users/${auth.currentUser.uid}/notifications`),
      snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [navigate]);

  // ─── Friend search ────────────────────────────────────────
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

  // ─── Send friend request ───────────────────────────────────
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

  // ─── Remove a notification ─────────────────────────────────
  const removeNotification = async (notifId) => {
    await deleteDoc(doc(db, `users/${auth.currentUser.uid}/notifications/${notifId}`));
  };

  // ─── Accept game invites ──────────────────────────────────
  const acceptHangmanInvite = async notif => {
    await updateDoc(doc(db, `hangman_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/hangman/multiplayer/${notif.gameId}`);
  };
  const acceptTicTacToeInvite = async notif => {
    await updateDoc(doc(db, `tictactoe_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/tictactoe/multiplayer/${notif.gameId}`);
  };
  const acceptConnectFourInvite = async notif => {
    await updateDoc(doc(db, `connect4_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/connect4/multiplayer/${notif.gameId}`);
  };
  const acceptBattleshipInvite = async notif => {
    await updateDoc(doc(db, `battleship_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/battleship/multiplayer/${notif.gameId}`);
  };
  const acceptDuelInvite = async notif => {
    await updateDoc(doc(db, `duelGames/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/duel/multiplayer/${notif.gameId}`);
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
          <FaSearch onClick={() => setShowSearch(!showSearch)} className="search-icon" />
          {showSearch && (
            <div className="search-container">
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="search-box"
              />
              {suggestions.length > 0 && (
                <div className="search-suggestions">
                  {suggestions.map(u => (
                    <div key={u.uid} className="suggestion-item">
                      @{u.username}
                      {!friendsList.includes(u.uid)
                        ? <button onClick={() => handleSendRequest(u)}>Add</button>
                        : <span>Already a friend</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="notif-container">
            <FaBell onClick={() => setShowNotifications(!showNotifications)} className="notif-bell" />
            {notifications.length > 0 && <span className="notif-count">{notifications.length}</span>}
            {showNotifications && (
              <div className="notif-dropdown">
                {notifications.length === 0
                  ? <p>No new notifications.</p>
                  : notifications.map(notif => (
                      <div key={notif.id} className="notif-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                        <p style={{ margin: 0 }}>{notif.message}</p>

                        {notif.type === 'message' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                navigate(`/messages/${notif.senderUid}`);
                                removeNotification(notif.id);
                              }}
                            >
                              Open Message
                            </button>
                            <button onClick={() => removeNotification(notif.id)}>
                              Remove
                            </button>
                          </div>
                        )}

                        {notif.type === 'hangman_invite' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => acceptHangmanInvite(notif)}>Join Hangman</button>
                            <button onClick={() => removeNotification(notif.id)}>Remove</button>
                          </div>
                        )}

                        {notif.type === 'tictactoe_invite' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => acceptTicTacToeInvite(notif)}>Join Tic-Tac-Toe</button>
                            <button onClick={() => removeNotification(notif.id)}>Remove</button>
                          </div>
                        )}

                        {notif.type === 'connect4_invite' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => acceptConnectFourInvite(notif)}>Join Connect Four</button>
                            <button onClick={() => removeNotification(notif.id)}>Remove</button>
                          </div>
                        )}

                        {notif.type === 'battleship_invite' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => acceptBattleshipInvite(notif)}>Join Battleship</button>
                            <button onClick={() => removeNotification(notif.id)}>Remove</button>
                          </div>
                        )}

                        {notif.type === 'duel_invite' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => acceptDuelInvite(notif)}>Join Duel Shots</button>
                            <button onClick={() => removeNotification(notif.id)}>Remove</button>
                          </div>
                        )}

                      </div>
                    ))
                }
              </div>
            )}
          </div>
          <span className="profile-icon" onClick={() => navigate('/profile')}>👤</span>
        </div>
      </header>

      {actionMessage && <p className="action-msg">{actionMessage}</p>}

      <main className="dashboard-main">
        <h2>🎮 Games</h2>

        {/* Hangman */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/hangman/single')}>
            <img src={singleHangmanImg} alt="Single Player Hangman" />
          </div>
          <div className="game-card" onClick={() => navigate('/hangman/multiplayer')}>
            <img src={multiHangmanImg} alt="Multiplayer Hangman" />
          </div>
        </div>

        {/* Tic-Tac-Toe */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/tictactoe/single')}>
            <img src={singleTicTacToeImg} alt="Single Player Tic-Tac-Toe" />
          </div>
          <div className="game-card" onClick={() => navigate('/tictactoe/multiplayer')}>
            <img src={multiTicTacToeImg} alt="Multiplayer Tic-Tac-Toe" />
          </div>
        </div>

        {/* Connect Four */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/connect4/single')}>
            <img src={singleConnectFourImg} alt="Single Player Connect Four" />
          </div>
          <div className="game-card" onClick={() => navigate('/connect4/multiplayer')}>
            <img src={multiConnectFourImg} alt="Multiplayer Connect Four" />
          </div>
        </div>

        {/* Battleship */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/battleship/single')}>
            <img src={singleBattleshipImg} alt="Single Player Battleship" />
          </div>
          <div className="game-card" onClick={() => navigate('/battleship/multiplayer')}>
            <img src={multiBattleshipImg} alt="Multiplayer Battleship" />
          </div>
        </div>

        {/* Duel Shots */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/duel/single')}>
            <img src={singleDuelImg} alt="Single Player Duel Shots" />
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
        </a>.
      </footer>
    </div>
  );
}
