// src/pages/Profile.jsx
import './Profile.css';
import logo from '../assets/logo.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';

export default function Profile() {
  const [username, setUsername]                  = useState('');
  const [friends, setFriends]                    = useState([]);
  const [blocked, setBlocked]                    = useState([]);
  const [notifications, setNotifications]        = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [requests, setRequests]                  = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return navigate('/');

    // Fetch profile info: username, friends, blocked, and pending friend requests
    const fetchProfileData = async () => {
      const docRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(docRef);
      if (userDoc.exists()) {
        setUsername(userDoc.data().username);
      }

      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(friendsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));

      const blockedSnap = await getDocs(collection(db, `users/${user.uid}/blocked`));
      setBlocked(blockedSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));

      const requestsSnap = await getDocs(collection(db, `users/${user.uid}/requests`));
      setRequests(requestsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    };

    fetchProfileData();

    // Subscribe to real-time notifications under users/{uid}/notifications
    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/notifications`),
      snapshot => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => unsub();
  }, [navigate]);

  // Accept a friend request: add each other as friends, remove the request
  const handleAcceptRequest = async (requestUid, requestUsername) => {
    const currentUid = auth.currentUser.uid;

    await setDoc(doc(db, `users/${currentUid}/friends/${requestUid}`), {
      username: requestUsername,
      addedAt: Timestamp.now(),
    });

    await setDoc(doc(db, `users/${requestUid}/friends/${currentUid}`), {
      username: username,
      addedAt: Timestamp.now(),
    });

    await deleteDoc(doc(db, `users/${currentUid}/requests/${requestUid}`));

    setFriends([...friends, { uid: requestUid, username: requestUsername }]);
    setRequests(requests.filter(req => req.uid !== requestUid));
  };

  // Decline a friend request: simply remove it
  const handleDeclineRequest = async (requestUid) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/requests/${requestUid}`));
    setRequests(requests.filter(req => req.uid !== requestUid));
  };

  // Unfriend: remove each other from friends list
  const handleUnfriend = async (friendUid) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/friends/${friendUid}`));
    await deleteDoc(doc(db, `users/${friendUid}/friends/${currentUid}`));
    setFriends(friends.filter(friend => friend.uid !== friendUid));
  };

  // Block a user: add to blocked list, remove from friends if present
  const handleBlock = async (friendUid, friendUsername) => {
    const currentUid = auth.currentUser.uid;
    await setDoc(doc(db, `users/${currentUid}/blocked/${friendUid}`), {
      username: friendUsername,
      blockedAt: Timestamp.now(),
    });
    await deleteDoc(doc(db, `users/${currentUid}/friends/${friendUid}`));
    await deleteDoc(doc(db, `users/${friendUid}/friends/${currentUid}`));
    setFriends(friends.filter(friend => friend.uid !== friendUid));
    setBlocked([...blocked, { uid: friendUid, username: friendUsername }]);
  };

  // Unblock a user: remove from blocked list
  const handleUnblock = async (blockedUid) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/blocked/${blockedUid}`));
    setBlocked(blocked.filter(user => user.uid !== blockedUid));
  };

  // ─── Remove a single notification ─────────────────────────────
  const removeNotification = async (notifId) => {
    await deleteDoc(doc(db, `users/${auth.currentUser.uid}/notifications/${notifId}`));
  };

  // ─── Mark all notifications as read ────────────────────────────
  const markAllAsRead = async () => {
    const currentUid = auth.currentUser.uid;
    const notifSnap = await getDocs(collection(db, `users/${currentUid}/notifications`));
    const batchDeletes = notifSnap.docs.map(docSnap =>
      deleteDoc(doc(db, `users/${currentUid}/notifications/${docSnap.id}`))
    );
    await Promise.all(batchDeletes);
  };

  // ─── Accept various game invites ───────────────────────────────
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
    <div className="profile-container">
      <header className="dashboard-header">
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          title="Logout"
          onClick={() => { auth.signOut(); navigate('/'); }}
          style={{ cursor: 'pointer' }}
        />
        <div className="header-actions">
          <button
            className="dashboard-button"
            onClick={() => navigate('/dashboard')}
            title="Back to Dashboard"
          >
            Dashboard
          </button>

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
                {/* “Mark all as read” button */}
                <button
                  style={{
                    backgroundColor: '#4ade80',
                    border: 'none',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                  onClick={markAllAsRead}
                >
                  Mark All as Read
                </button>

                {notifications.length === 0 ? (
                  <p>No new notifications.</p>
                ) : (
                  notifications.map(notif => (
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
                          <button onClick={() => acceptHangmanInvite(notif)}>
                            Join Hangman
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

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
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-info">
          <span className="profile-icon">👤</span>
          <h2>{username}</h2>
        </div>

        <section className="profile-section">
          <h3>📬 Friend Requests</h3>
          {requests.length === 0 ? (
            <p>No pending requests.</p>
          ) : (
            requests.map(request => (
              <div key={request.uid} className="friend-item">
                <span>@{request.username}</span>
                <button onClick={() => handleAcceptRequest(request.uid, request.username)}>
                  Accept
                </button>
                <button onClick={() => handleDeclineRequest(request.uid)}>
                  Decline
                </button>
              </div>
            ))
          )}
        </section>

        <section className="profile-section">
          <h3>👥 Friends</h3>
          {friends.length === 0 ? (
            <p>No friends yet.</p>
          ) : (
            friends.map(friend => (
              <div key={friend.uid} className="friend-item">
                <span>@{friend.username}</span>
                <button onClick={() => navigate(`/messages/${friend.uid}`)}>Message</button>
                <button onClick={() => handleUnfriend(friend.uid)}>Unfriend</button>
                <button onClick={() => handleBlock(friend.uid, friend.username)}>Block</button>
              </div>
            ))
          )}
        </section>

        <section className="profile-section">
          <h3>🔒 Blocked Users</h3>
          {blocked.length === 0 ? (
            <p>No blocked users.</p>
          ) : (
            blocked.map(user => (
              <div key={user.uid} className="friend-item">
                <span>@{user.username}</span>
                <button onClick={() => handleUnblock(user.uid)}>Unblock</button>
              </div>
            ))
          )}
        </section>
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
