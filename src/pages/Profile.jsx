import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';

function Profile() {
  const [username, setUsername] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return navigate('/');

    const fetchData = async () => {
      const docRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(docRef);
      if (userDoc.exists()) setUsername(userDoc.data().username);

      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(friendsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    };

    fetchData();

    const unsub = onSnapshot(collection(db, `users/${user.uid}/notifications`), snapshot => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [navigate]);

  const handleNotificationAction = (notif) => {
    if (notif.type === 'hangman_invite' && notif.gameId) {
      navigate(`/hangman/game/${notif.gameId}`);
    }
  };

  const markNotificationRead = async (notifId) => {
    await deleteDoc(doc(db, `users/${auth.currentUser.uid}/notifications/${notifId}`));
  };

  return (
    <div className="profile-container">
      <header>
        <h2>Profile: @{username}</h2>
        <FaBell onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: 'pointer' }} />
        {showNotifications && (
          <div className="notif-dropdown">
            {notifications.length === 0 ? <p>No notifications</p> :
              notifications.map(notif => (
                <div key={notif.id}>
                  <p>{notif.message}</p>
                  {notif.type === 'hangman_invite' ? (
                    <button onClick={() => handleNotificationAction(notif)}>Join Game</button>
                  ) : (
                    <button onClick={() => markNotificationRead(notif.id)}>Mark as Read</button>
                  )}
                </div>
              ))
            }
          </div>
        )}
      </header>
      <main>
        <h3>Friends</h3>
        {friends.map(f => (
          <div key={f.uid}>@{f.username}</div>
        ))}
      </main>
    </div>
  );
}

export default Profile;
