// src/pages/Messaging.jsx

import "./Messaging.css";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

/**
 * Messaging component:
 * - Displays a chat between the current user and a friend.
 * - Supports real-time message fetching, sending new messages, marking as seen,
 *   saving/unsaving messages, and sending notifications for new messages.
 * - On leaving the chat, deletes any messages that are unseen and unsaved.
 */
function Messaging() {
  const { friendId } = useParams(); // friendId from URL params
  const navigate = useNavigate(); // navigation hook
  const [messages, setMessages] = useState([]); // list of chat messages
  const [newMessage, setNewMessage] = useState(""); // current message input
  const [friendUsername, setFriendUsername] = useState("Loading..."); // friend's display name
  const user = auth.currentUser; // currently authenticated user

  // Unique chat ID is combination of both UIDs sorted lexicographically
  const chatId = user ? [user.uid, friendId].sort().join("_") : null;

  /**
   * useEffect: runs when component mounts or friendId changes
   * - Fetch friend's username from Firestore
   * - Set up a real-time listener on 'chats/{chatId}/messages' ordered by timestamp
   * - When new snapshot arrives:
   *   1) Update local messages state
   *   2) Mark any incoming, unseen messages (receiverId === current user) as seen
   */
  useEffect(() => {
    if (!user || !friendId) return;

    // Fetch and display friend's username
    const fetchFriendName = async () => {
      const friendDoc = await getDoc(doc(db, "users", friendId));
      setFriendUsername(
        friendDoc.exists() ? friendDoc.data().username : "Unknown User"
      );
    };
    fetchFriendName();

    // Build Firestore query for this chat's messages, ordering by timestamp
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy("timestamp")
    );

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      // Map snapshot docs to local state
      const msgs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setMessages(msgs);

      // For any message that is addressed to the current user and not yet seen:
      // update 'isSeen' field to true
      msgs.forEach(async (msg) => {
        if (msg.receiverId === user.uid && !msg.isSeen) {
          await updateDoc(doc(db, `chats/${chatId}/messages/${msg.id}`), {
            isSeen: true,
          });
        }
      });
    });

    // Cleanup subscription on unmount or when dependencies change
    return () => unsubscribe();
  }, [friendId, chatId, user]);

  /**
   * sendMessage:
   * - Adds a new message document to 'chats/{chatId}/messages'
   * - Also adds a notification document under the friend's 'users/{friendId}/notifications'
   *   so they get alerted of the new message.
   */
  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId) return;

    // Retrieve current user's username for notification text
    const senderDoc = await getDoc(doc(db, "users", user.uid));
    const senderUsername = senderDoc.exists()
      ? senderDoc.data().username
      : "Unknown";

    // Add the message to the chat
    await addDoc(collection(db, `chats/${chatId}/messages`), {
      senderId: user.uid,
      receiverId: friendId,
      content: newMessage,
      timestamp: new Date().toISOString(),
      isSeen: false,
      isSavedBySender: false,
      isSavedByReceiver: false,
    });

    // Send a notification to the friend
    await addDoc(collection(db, `users/${friendId}/notifications`), {
      type: "message",
      senderUid: user.uid,
      senderUsername: senderUsername,
      message: `New message from @${senderUsername}`,
      timestamp: new Date().toISOString(),
    });

    // Clear input field
    setNewMessage("");
  };

  /**
   * toggleSave:
   * - Toggles the "saved" flag on a message.
   * - If the user is the sender, toggles 'isSavedBySender'; otherwise toggles 'isSavedByReceiver'.
   * - Saved messages persist even after being seen/deleted by the other user.
   */
  const toggleSave = async (msg) => {
    const isSender = msg.senderId === user.uid;
    const field = isSender ? "isSavedBySender" : "isSavedByReceiver";
    const newSaveState = !(msg[field] ?? false);

    await updateDoc(doc(db, `chats/${chatId}/messages/${msg.id}`), {
      [field]: newSaveState,
    });
  };

  /**
   * handleLeaveChat:
   * - Called when user navigates away from chat (back to profile).
   * - Fetches all messages in this chat; for each message:
   *   * If message has been seen, and neither side has it "saved", delete it from Firestore.
   * - Finally, navigate back to '/profile'
   */
  const handleLeaveChat = async () => {
    const q = query(
      collection(db, `chats/${chatId}/messages`),
      orderBy("timestamp")
    );
    const snapshot = await getDocs(q);

    snapshot.forEach(async (docSnap) => {
      const msg = docSnap.data();
      // If both isSavedBySender and isSavedByReceiver are false, and message is seen, delete
      const savedBySender = msg.isSavedBySender ?? false;
      const savedByReceiver = msg.isSavedByReceiver ?? false;
      if (!savedBySender && !savedByReceiver && msg.isSeen) {
        await deleteDoc(doc(db, `chats/${chatId}/messages/${docSnap.id}`));
      }
    });

    navigate("/profile");
  };

  return (
    <div className="messaging-container">
      {/* Header with friend's handle and back button */}
      <h2>@{friendUsername}</h2>
      <button onClick={handleLeaveChat}>← Back to Profile</button>

      <p
        style={{ textAlign: "center", fontSize: "0.8rem", margin: "0.5rem 0" }}
      >
        Click on a message to save or unsave it. Unsaved messages disappear
        after being seen.
      </p>

      {user ? (
        <>
          {/* Messages list */}
          <div className="messages-list">
            {messages.length === 0 ? (
              <p>No messages yet. Start the conversation!</p>
            ) : (
              messages.map((msg) => {
                const isSender = msg.senderId === user.uid;
                const isSaved = msg.isSavedBySender || msg.isSavedByReceiver;

                return (
                  <div
                    key={msg.id}
                    className={`
                      message 
                      ${isSender ? "sent" : "received"} 
                      ${isSaved ? "saved" : ""}
                    `}
                    onClick={() => toggleSave(msg)}
                  >
                    {/* Message header: displays "You" for sender or friend's handle */}
                    <div className="message-header">
                      @
                      {isSender
                        ? auth.currentUser.displayName || "You"
                        : friendUsername}
                    </div>
                    <p>{msg.content}</p>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    {/* Show 'Seen' indicator if receiver has seen this message */}
                    {msg.isSeen && (
                      <span className="seen-indicator">✅ Seen</span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Input area for new message */}
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
