import './Profile.css';
import logo from '../assets/logo.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import {
  collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc, query, where, Timestamp
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';

function Profile() {
  const [username, setUsername] = useState('');
  const [friends, setFriends] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return navigate('/');

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

    const unsub = onSnapshot(collection(db, `users/${user.uid}/notifications`), snapshot => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, []);

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

  const handleDeclineRequest = async (requestUid) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/requests/${requestUid}`));
    setRequests(requests.filter(req => req.uid !== requestUid));
  };

  const handleUnfriend = async (friendUid) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/friends/${friendUid}`));
    await deleteDoc(doc(db, `users/${friendUid}/friends/${currentUid}`));
    setFriends(friends.filter(friend => friend.uid !== friendUid));
  };

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

  const handleUnblock = async (blockedUid) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/blocked/${blockedUid}`));
    setBlocked(blocked.filter(user => user.uid !== blockedUid));
  };

  const markNotificationRead = async (notifId) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/notifications/${notifId}`));
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
                {notifications.length === 0 ? (
                  <p>No new notifications.</p>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="notif-item">
                      {notif.type === 'message' ? (
                        <>
                          <p><strong>@{notif.senderUsername}</strong> sent you a message</p>
                          <button onClick={() => {
                            navigate(`/messages/${notif.senderUid}`);
                            markNotificationRead(notif.id);
                          }}>View Message</button>
                        </>
                      ) : notif.type === 'hangman_invite' ? (
                        <>
                          <p>{notif.message}</p>
                          <button onClick={() => {
                            navigate(`/hangman/game/${notif.gameId}`);
                            markNotificationRead(notif.id);
                          }}>Accept Challenge</button>
                        </>
                      ) : (
                        <>
                          <p>{notif.message}</p>
                          <button onClick={() => markNotificationRead(notif.id)}>Mark as Read</button>
                        </>
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
                <button onClick={() => handleAcceptRequest(request.uid, request.username)}>Accept</button>
                <button onClick={() => handleDeclineRequest(request.uid)}>Decline</button>
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
        </a>
        .
      </footer>
    </div>
  );
}

export default Profile;
