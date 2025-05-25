import './Messaging.css';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { collection, addDoc, query, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

function Messaging() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [friendUsername, setFriendUsername] = useState('Loading...');
  const user = auth.currentUser;
  const chatId = user ? [user.uid, friendId].sort().join('_') : null;

  useEffect(() => {
    if (!user || !friendId) return;

    const fetchFriendName = async () => {
      const friendDoc = await getDoc(doc(db, 'users', friendId));
      setFriendUsername(friendDoc.exists() ? friendDoc.data().username : 'Unknown User');
    };
    fetchFriendName();

    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setMessages(msgs);

      msgs.forEach(async msg => {
        if (msg.receiverId === user.uid && !msg.isSeen) {
          await updateDoc(doc(db, `chats/${chatId}/messages/${msg.id}`), { isSeen: true });
        }
      });
    });

    return () => unsubscribe();
  }, [friendId, chatId, user]);

const sendMessage = async () => {
  if (!newMessage.trim() || !chatId) return;

  // 🔥 Retrieve sender username from Firestore
  const senderDoc = await getDoc(doc(db, 'users', user.uid));
  const senderUsername = senderDoc.exists() ? senderDoc.data().username : 'Unknown';

  await addDoc(collection(db, `chats/${chatId}/messages`), {
    senderId: user.uid,
    receiverId: friendId,
    content: newMessage,
    timestamp: new Date().toISOString(),
    isSeen: false,
    isSavedBySender: false,
    isSavedByReceiver: false,
  });

  await addDoc(collection(db, `users/${friendId}/notifications`), {
    message: `New message from @${senderUsername}`,
    senderUsername: senderUsername, // 🔥 Use actual username
    senderUid: user.uid,
    type: 'message',
    timestamp: new Date().toISOString(),
  });

  setNewMessage('');
};


  const toggleSave = async (msg) => {
    const isSender = msg.senderId === user.uid;
    const field = isSender ? 'isSavedBySender' : 'isSavedByReceiver';
    const newSaveState = !(msg[field] ?? false);

    await updateDoc(doc(db, `chats/${chatId}/messages/${msg.id}`), {
      [field]: newSaveState,
    });
  };

  const handleLeaveChat = async () => {
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy('timestamp'));
    const snapshot = await getDocs(q);
    snapshot.forEach(async docSnap => {
      const msg = docSnap.data();
      if (!msg.isSavedBySender && !msg.isSavedByReceiver && msg.isSeen) {
        await deleteDoc(doc(db, `chats/${chatId}/messages/${docSnap.id}`));
      }
    });
    navigate('/profile');
  };

  return (
    <div className="messaging-container">
      <h2>@{friendUsername}</h2>
      <button onClick={handleLeaveChat}>← Back to Profile</button>
      <p style={{ textAlign: 'center', fontSize: '0.8rem', margin: '0.5rem 0' }}>
        Click on a message to save or unsave it. Unsaved messages disappear after being seen.
      </p>
      {user ? (
        <>
          <div className="messages-list">
            {messages.length === 0 ? (
              <p>No messages yet. Start the conversation!</p>
            ) : (
              messages.map(msg => {
                const isSender = msg.senderId === user.uid;
                const isSaved = msg.isSavedBySender || msg.isSavedByReceiver;
                return (
                  <div
                    key={msg.id}
                    className={`message ${isSender ? 'sent' : 'received'} ${isSaved ? 'saved' : ''}`}
                    onClick={() => toggleSave(msg)}
                  >
                    <div className="message-header">
                      @{isSender ? (auth.currentUser.displayName || 'You') : friendUsername}
                    </div>
                    <p>{msg.content}</p>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {msg.isSeen && <span className="seen-indicator">✅ Seen</span>}
                  </div>
                );
              })
            )}
          </div>
          <div className="message-input">
            <input
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </>
      ) : (
        <p>Please log in to start messaging.</p>
      )}
    </div>
  );
}

export default Messaging;
