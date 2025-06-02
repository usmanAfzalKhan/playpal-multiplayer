// src/pages/Dashboard.jsx

// Import CSS for styling this component
import './Dashboard.css';

// Import logo and game thumbnail images
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

// Import React hooks for managing state and lifecycle
import { useEffect, useState } from 'react';

// Import Firebase auth and Firestore instances
import { auth, db }            from '../firebase-config';

// Import Firestore methods for document operations
import {
  doc,           // to reference a specific document
  getDoc,        // to fetch a single document
  getDocs,       // to fetch multiple documents
  collection,    // to reference a collection
  query,         // to build a query
  where,         // to add "where" clauses in queries
  onSnapshot,    // to listen in real-time to document or collection changes
  updateDoc,     // to update fields in a document
  deleteDoc,     // to delete a document
  setDoc,        // to create or overwrite a document
} from 'firebase/firestore';

// Import React Router hook for navigation
import { useNavigate }         from 'react-router-dom';

// Import icons for search and notifications
import { FaSearch, FaBell }    from 'react-icons/fa';

export default function Dashboard() {
  // ------------------------ State variables ------------------------

  // Store the current user's username
  const [username, setUsername]                   = useState('');

  // Store the current search text when looking up friends
  const [searchQuery, setSearchQuery]             = useState('');

  // Boolean: whether to show the search input dropdown
  const [showSearch, setShowSearch]               = useState(false);

  // List of user objects matching the search query
  const [suggestions, setSuggestions]             = useState([]);

  // List of UIDs for the current user's friends
  const [friendsList, setFriendsList]             = useState([]);

  // Temporary feedback message shown to the user (e.g., "Friend request sent")
  const [actionMessage, setActionMessage]         = useState('');

  // List of notification objects for the current user
  const [notifications, setNotifications]         = useState([]);

  // Boolean: whether the notifications dropdown is visible
  const [showNotifications, setShowNotifications] = useState(false);

  // Hook to programmatically navigate to different routes
  const navigate = useNavigate();

  // ---------------------- Load user & notifications ----------------------

  useEffect(() => {
    // Get the currently authenticated user
    const user = auth.currentUser;
    // If no user is logged in, redirect to login page
    if (!user) return navigate('/');

    // Fetch user document from Firestore to get username and friends list
    (async () => {
      // Reference users/{uid}
      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) {
        // Set the username state from Firestore data
        setUsername(uSnap.data().username);
      }

      // Fetch the list of friends under users/{uid}/friends
      const fSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      // friendsList is an array of UIDs
      setFriendsList(fSnap.docs.map(d => d.id));
    })();

    // Subscribe to real-time updates on users/{uid}/notifications
    const unsub = onSnapshot(
      collection(db, `users/${auth.currentUser.uid}/notifications`),
      (snap) => {
        // Map each notification document to its data + id
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    // Cleanup subscription on unmount
    return () => unsub();
  }, [navigate]);

  // ------------------------ Friend Search Logic ------------------------

  const handleSearchChange = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSuggestions([]);       // Clear previous suggestions
    setActionMessage('');     // Clear any action messages

    // If query is empty or only whitespace, do nothing further
    if (!q.trim()) return;

    // Build a Firestore query to find usernames starting with 'q'
    const userQ = query(
      collection(db, 'users'),
      where('username', '>=', q),
      where('username', '<=', q + '\uf8ff')
    );

    // Execute the query
    const snap = await getDocs(userQ);
    const res = [];
    snap.forEach((d) => {
      // Exclude current user from suggestions
      if (d.id !== auth.currentUser.uid) {
        res.push({ uid: d.id, ...d.data() });
      }
    });
    setSuggestions(res);
  };

  // ---------------------- Send Friend Request ----------------------

  const handleSendRequest = async (u) => {
    try {
      // Current user's UID
      const me = auth.currentUser.uid;

      // Write a friend request document under users/{recipientUID}/requests/{myUID}
      await setDoc(doc(db, `users/${u.uid}/requests/${me}`), {
        username,             // current user's username
        requestedAt: new Date(), // timestamp of request
      });

      // Also create a notification under users/{recipientUID}/notifications/{id}
      await setDoc(
        doc(db, `users/${u.uid}/notifications/${me}-request`),
        {
          type: 'friend_request',
          message: `📬 @${username} sent you a friend request!`,
          timestamp: new Date(),
        }
      );

      // Show feedback message temporarily
      setActionMessage(`✅ Friend request sent to @${u.username}`);
      setTimeout(() => setActionMessage(''), 3000);

      // Clear search field and suggestions
      setSearchQuery('');
      setSuggestions([]);
    } catch {
      // If any error, show error message briefly
      setActionMessage('❌ Error sending friend request.');
      setTimeout(() => setActionMessage(''), 3000);
    }
  };

  // ---------------------- Notification Helpers ----------------------

  // Remove (mark as read) a notification by its ID
  const removeNotification = async (notifId) => {
    await deleteDoc(doc(db, `users/${auth.currentUser.uid}/notifications/${notifId}`));
  };

  // Handlers to accept different game invites; update game status to 'active' and navigate

  const acceptHangmanInvite = async (notif) => {
    // Update the hangman game document to set status 'active'
    await updateDoc(doc(db, `hangman_games/${notif.gameId}`), { status: 'active' });
    // Remove the notification
    removeNotification(notif.id);
    // Navigate to the multiplayer hangman game
    navigate(`/hangman/multiplayer/${notif.gameId}`);
  };

  const acceptTicTacToeInvite = async (notif) => {
    await updateDoc(doc(db, `tictactoe_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/tictactoe/multiplayer/${notif.gameId}`);
  };

  const acceptConnectFourInvite = async (notif) => {
    await updateDoc(doc(db, `connect4_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/connect4/multiplayer/${notif.gameId}`);
  };

  const acceptBattleshipInvite = async (notif) => {
    await updateDoc(doc(db, `battleship_games/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/battleship/multiplayer/${notif.gameId}`);
  };

  const acceptDuelInvite = async (notif) => {
    await updateDoc(doc(db, `duelGames/${notif.gameId}`), { status: 'active' });
    removeNotification(notif.id);
    navigate(`/duel/multiplayer/${notif.gameId}`);
  };

  // ------------------------- Render -------------------------

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <header className="dashboard-header">
        {/* Logo: clicking logs out and returns to login */}
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          onClick={() => {
            auth.signOut();
            navigate('/');
          }}
        />

        {/* Controls: search, notifications, profile */}
        <div className="header-controls">
          {/* Search Icon: toggles showing the search input */}
          <FaSearch
            onClick={() => setShowSearch(!showSearch)}
            className="search-icon"
          />

          {/* Conditionally display the search input and suggestions */}
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
                  {suggestions.map((u) => (
                    <div key={u.uid} className="suggestion-item">
                      @{u.username}
                      {!friendsList.includes(u.uid) ? (
                        // If not already friends, show "Add" button
                        <button onClick={() => handleSendRequest(u)}>Add</button>
                      ) : (
                        <span>Already a friend</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notification Bell */}
          <div className="notif-container">
            <FaBell
              onClick={() => setShowNotifications(!showNotifications)}
              className="notif-bell"
            />
            {/* Show a red badge if there are unread notifications */}
            {notifications.length > 0 && (
              <span className="notif-count">{notifications.length}</span>
            )}
            {showNotifications && (
              <div className="notif-dropdown">
                {notifications.length === 0 ? (
                  <p>No new notifications.</p>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className="notif-item"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        marginBottom: '1rem',
                      }}
                    >
                      {/* Notification text */}
                      <p style={{ margin: 0 }}>{notif.message}</p>

                      {/* If this notification is a new message */}
                      {notif.type === 'message' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                              // Navigate to the messaging page for that sender
                              navigate(`/messages/${notif.senderUid}`);
                              // Remove the notification
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

                      {/* If this notification is a Hangman game invite */}
                      {notif.type === 'hangman_invite' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => acceptHangmanInvite(notif)}>
                            Join Hangman
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If this notification is a Tic-Tac-Toe invite */}
                      {notif.type === 'tictactoe_invite' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => acceptTicTacToeInvite(notif)}>
                            Join Tic-Tac-Toe
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If this notification is a Connect Four invite */}
                      {notif.type === 'connect4_invite' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => acceptConnectFourInvite(notif)}>
                            Join Connect Four
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If this notification is a Battleship invite */}
                      {notif.type === 'battleship_invite' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => acceptBattleshipInvite(notif)}>
                            Join Battleship
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If this notification is a Duel Shots invite */}
                      {notif.type === 'duel_invite' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => acceptDuelInvite(notif)}>
                            Join Duel Shots
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Profile icon: navigates to Profile page */}
          <span className="profile-icon" onClick={() => navigate('/profile')}>
            👤
          </span>
        </div>
      </header>

      {/* Temporary action message (e.g., "Friend request sent") */}
      {actionMessage && <p className="action-msg">{actionMessage}</p>}

      {/* Main section displaying available games */}
      <main className="dashboard-main">
        <h2>🎮 Games</h2>

        {/* Hangman game cards */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/hangman/single')}>
            <img src={singleHangmanImg} alt="Single Player Hangman" />
          </div>
          <div className="game-card" onClick={() => navigate('/hangman/multiplayer')}>
            <img src={multiHangmanImg} alt="Multiplayer Hangman" />
          </div>
        </div>

        {/* Tic-Tac-Toe game cards */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/tictactoe/single')}>
            <img src={singleTicTacToeImg} alt="Single Player Tic-Tac-Toe" />
          </div>
          <div
            className="game-card"
            onClick={() => navigate('/tictactoe/multiplayer')}
          >
            <img src={multiTicTacToeImg} alt="Multiplayer Tic-Tac-Toe" />
          </div>
        </div>

        {/* Connect Four game cards */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/connect4/single')}>
            <img src={singleConnectFourImg} alt="Single Player Connect Four" />
          </div>
          <div
            className="game-card"
            onClick={() => navigate('/connect4/multiplayer')}
          >
            <img
              src={multiConnectFourImg}
              alt="Multiplayer Connect Four"
            />
          </div>
        </div>

        {/* Battleship game cards */}
        <div className="game-grid">
          <div
            className="game-card"
            onClick={() => navigate('/battleship/single')}
          >
            <img src={singleBattleshipImg} alt="Single Player Battleship" />
          </div>
          <div
            className="game-card"
            onClick={() => navigate('/battleship/multiplayer')}
          >
            <img
              src={multiBattleshipImg}
              alt="Multiplayer Battleship"
            />
          </div>
        </div>

        {/* Duel Shots (Single Player) card */}
        <div className="game-grid">
          <div className="game-card" onClick={() => navigate('/duel/single')}>
            <img src={singleDuelImg} alt="Single Player Duel Shots" />
          </div>
        </div>
      </main>

      {/* Footer section with copyright */}
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
