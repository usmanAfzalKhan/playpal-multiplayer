import './Profile.css';
import logo from '../assets/logo.png';
import { useEffect, useState } from 'react';
import { auth, db } from '../firebase-config';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc, query, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';

function Profile() {
  const [username, setUsername] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return navigate('/');

    const fetchProfileData = async () => {
      const docRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(docRef);
      if (userDoc.exists()) setUsername(userDoc.data().username);
    };
    fetchProfileData();

    const unsub = onSnapshot(collection(db, `users/${auth.currentUser.uid}/notifications`), snapshot => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [navigate]);

  const handleNotificationAction = (notif) => {
    if (notif.type === 'hangman_invite' && notif.gameId) {
      navigate(`/hangman/game/${notif.gameId}`);
      markNotificationRead(notif.id);
    } else {
      alert('Invalid or missing game information.');
    }
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
          <button className="dashboard-button" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
            Dashboard
          </button>
          <div className="notif-container">
            <FaBell className="notif-bell" onClick={() => setShowNotifications(!showNotifications)} title="Notifications" />
            {notifications.length > 0 && <span className="notif-count">{notifications.length}</span>}
            {showNotifications && (
              <div className="notif-dropdown">
                {notifications.length === 0 ? (
                  <p>No new notifications.</p>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="notif-item">
                      <p>{notif.message}</p>
                      <button onClick={() => handleNotificationAction(notif)}>Accept Challenge</button>
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
      </main>

      <footer className="dashboard-footer">
        © {new Date().getFullYear()} PlayPal. Built with ❤️ by <a href="https://github.com/usmanAfzalKhan" target="_blank" rel="noopener noreferrer" className="footer-link">Usman Khan</a>.
      </footer>
    </div>
  );
}

export default Profile;
