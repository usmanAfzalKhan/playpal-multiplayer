import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import './Profile.css';

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
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(userSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));

      const blockedSnap = await getDocs(collection(db, `users/${user.uid}/blocked`));
      setBlocked(blockedSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));

      const requestsSnap = await getDocs(collection(db, `users/${user.uid}/requests`));
      setRequests(requestsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));

      const notifSnap = await getDocs(collection(db, `users/${user.uid}/notifications`));
      setNotifications(notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      setUsername(user.displayName || 'Player');
    };

    fetchProfileData();
  }, [navigate]);

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

  const markNotificationRead = async (notifId) => {
    const currentUid = auth.currentUser.uid;
    await deleteDoc(doc(db, `users/${currentUid}/notifications/${notifId}`));
    setNotifications(notifications.filter(notif => notif.id !== notifId));
  };

  return (
    <div className="profile-container">
      <header className="dashboard-header">
        <h2>@{username}</h2>
        <button onClick={() => { auth.signOut(); navigate('/'); }}>Logout</button>
      </header>

      <main className="profile-main">
        <h3>Friend Requests</h3>
        {requests.length > 0 ? requests.map(req => (
          <div key={req.uid}>
            @{req.username}
            <button onClick={() => handleAcceptRequest(req.uid, req.username)}>Accept</button>
            <button onClick={() => handleDeclineRequest(req.uid)}>Decline</button>
          </div>
        )) : <p>No friend requests.</p>}

        <h3>Friends</h3>
        {friends.length > 0 ? friends.map(friend => (
          <p key={friend.uid}>@{friend.username}</p>
        )) : <p>No friends yet.</p>}

        <h3>Notifications</h3>
        {notifications.length > 0 ? notifications.map(notif => (
          <div key={notif.id}>
            <p>{notif.message}</p>
            {notif.type === 'hangman_invite' ? (
              <button onClick={() => navigate(`/hangman/game/${notif.gameId}`)}>Join Game</button>
            ) : (
              <button onClick={() => markNotificationRead(notif.id)}>Mark as Read</button>
            )}
          </div>
        )) : <p>No notifications.</p>}
      </main>
    </div>
  );
}

export default Profile;
