// src/pages/Profile.jsx

import "./Profile.css"; // Import the CSS styling for the Profile page
import logo from "../assets/logo.png"; // Import the PlayPal logo image
import { useEffect, useState } from "react"; // React hooks for state and side effects
import { auth, db } from "../firebase-config"; // Firebase authentication and Firestore reference
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
} from "firebase/firestore"; // Firestore functions for reading/writing documents
import { useNavigate } from "react-router-dom"; // Hook to programmatically navigate between routes
import { FaBell } from "react-icons/fa"; // FontAwesome Bell icon for notifications

export default function Profile() {
  // ─── State Variables ───────────────────────────────────────────────────
  const [username, setUsername] = useState(""); // Current user's username
  const [friends, setFriends] = useState([]); // List of friend objects { uid, username }
  const [blocked, setBlocked] = useState([]); // List of blocked users { uid, username }
  const [notifications, setNotifications] = useState([]); // Live list of notification objects
  const [showNotifications, setShowNotifications] = useState(false); // Boolean to toggle the notifications dropdown
  const [requests, setRequests] = useState([]); // List of incoming friend requests { uid, username }

  const navigate = useNavigate(); // React Router function to change routes

  // ─── Side Effect: Fetch Profile Data & Subscribe to Notifications ───
  useEffect(() => {
    const user = auth.currentUser; // Get the currently signed-in user
    if (!user) return navigate("/"); // If no user, redirect to login/auth page

    // Async function to load profile: username, friends, blocked list, and pending requests
    const fetchProfileData = async () => {
      const docRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(docRef);
      if (userDoc.exists()) {
        setUsername(userDoc.data().username); // Set current user's username
      }

      // Retrieve current user's friends collection
      const friendsSnap = await getDocs(
        collection(db, `users/${user.uid}/friends`)
      );
      setFriends(
        friendsSnap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
      );

      // Retrieve current user's blocked collection
      const blockedSnap = await getDocs(
        collection(db, `users/${user.uid}/blocked`)
      );
      setBlocked(
        blockedSnap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
      );

      // Retrieve incoming friend requests for current user
      const requestsSnap = await getDocs(
        collection(db, `users/${user.uid}/requests`)
      );
      setRequests(
        requestsSnap.docs.map((doc) => ({ uid: doc.id, ...doc.data() }))
      );
    };

    fetchProfileData(); // Call the async fetch function

    // Subscribe to real-time notifications under users/{uid}/notifications
    const unsub = onSnapshot(
      collection(db, `users/${user.uid}/notifications`),
      (snapshot) => {
        setNotifications(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      }
    );

    // Cleanup: unsubscribe from the listener on unmount
    return () => unsub();
  }, [navigate]); // Only rerun effect if navigate changes (rare)

  // ─── Friend Request Handlers ────────────────────────────────────────────

  // Accept a friend request
  const handleAcceptRequest = async (requestUid, requestUsername) => {
    const currentUid = auth.currentUser.uid;

    // Add requestUid as a friend under current user's friends collection
    await setDoc(doc(db, `users/${currentUid}/friends/${requestUid}`), {
      username: requestUsername,
      addedAt: Timestamp.now(),
    });

    // Add current user as a friend under requestUid's friends collection
    await setDoc(doc(db, `users/${requestUid}/friends/${currentUid}`), {
      username: username,
      addedAt: Timestamp.now(),
    });

    // Remove the friend request document
    await deleteDoc(doc(db, `users/${currentUid}/requests/${requestUid}`));

    // Update local state: add to friends list, remove from requests list
    setFriends([...friends, { uid: requestUid, username: requestUsername }]);
    setRequests(requests.filter((req) => req.uid !== requestUid));
  };

  // Decline a friend request
  const handleDeclineRequest = async (requestUid) => {
    const currentUid = auth.currentUser.uid;
    // Delete the request document from Firestore
    await deleteDoc(doc(db, `users/${currentUid}/requests/${requestUid}`));
    // Update local state to remove this request
    setRequests(requests.filter((req) => req.uid !== requestUid));
  };

  // ─── Unfriend / Block Handlers ───────────────────────────────────────────

  // Remove (unfriend) a user
  const handleUnfriend = async (friendUid) => {
    const currentUid = auth.currentUser.uid;
    // Delete friendship from both users' lists
    await deleteDoc(doc(db, `users/${currentUid}/friends/${friendUid}`));
    await deleteDoc(doc(db, `users/${friendUid}/friends/${currentUid}`));
    // Update local state to remove the friend
    setFriends(friends.filter((friend) => friend.uid !== friendUid));
  };

  // Block a user (and unfriend them if needed)
  const handleBlock = async (friendUid, friendUsername) => {
    const currentUid = auth.currentUser.uid;
    // Add to blocked collection with timestamp
    await setDoc(doc(db, `users/${currentUid}/blocked/${friendUid}`), {
      username: friendUsername,
      blockedAt: Timestamp.now(),
    });
    // Also remove from both users' friends collections
    await deleteDoc(doc(db, `users/${currentUid}/friends/${friendUid}`));
    await deleteDoc(doc(db, `users/${friendUid}/friends/${currentUid}`));
    // Update local state: remove from friends, add to blocked
    setFriends(friends.filter((friend) => friend.uid !== friendUid));
    setBlocked([...blocked, { uid: friendUid, username: friendUsername }]);
  };

  // Unblock a user
  const handleUnblock = async (blockedUid) => {
    const currentUid = auth.currentUser.uid;
    // Delete the blocked record
    await deleteDoc(doc(db, `users/${currentUid}/blocked/${blockedUid}`));
    // Update local state to remove from blocked list
    setBlocked(blocked.filter((user) => user.uid !== blockedUid));
  };

  // ─── Notification Helpers ────────────────────────────────────────────────

  // Remove a notification (mark as read)
  const removeNotification = async (notifId) => {
    await deleteDoc(
      doc(db, `users/${auth.currentUser.uid}/notifications/${notifId}`)
    );
  };

  // Accept game invitation for Hangman; update game status and navigate
  const acceptHangmanInvite = async (notif) => {
    await updateDoc(doc(db, `hangman_games/${notif.gameId}`), {
      status: "active",
    });
    removeNotification(notif.id);
    navigate(`/hangman/multiplayer/${notif.gameId}`);
  };

  // Accept Tic-Tac-Toe invite
  const acceptTicTacToeInvite = async (notif) => {
    await updateDoc(doc(db, `tictactoe_games/${notif.gameId}`), {
      status: "active",
    });
    removeNotification(notif.id);
    navigate(`/tictactoe/multiplayer/${notif.gameId}`);
  };

  // Accept Connect Four invite
  const acceptConnectFourInvite = async (notif) => {
    await updateDoc(doc(db, `connect4_games/${notif.gameId}`), {
      status: "active",
    });
    removeNotification(notif.id);
    navigate(`/connect4/multiplayer/${notif.gameId}`);
  };

  // Accept Battleship invite
  const acceptBattleshipInvite = async (notif) => {
    await updateDoc(doc(db, `battleship_games/${notif.gameId}`), {
      status: "active",
    });
    removeNotification(notif.id);
    navigate(`/battleship/multiplayer/${notif.gameId}`);
  };

  // Accept Duel Shots invite
  const acceptDuelInvite = async (notif) => {
    await updateDoc(doc(db, `duelGames/${notif.gameId}`), { status: "active" });
    removeNotification(notif.id);
    navigate(`/duel/multiplayer/${notif.gameId}`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="profile-container">
      {/* ─── Header Section ────────────────────────────────────────────── */}
      <header className="dashboard-header">
        {/* Logo that logs out the user and navigates to home on click */}
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          title="Logout"
          onClick={() => {
            auth.signOut();
            navigate("/");
          }}
          style={{ cursor: "pointer" }}
        />
        <div className="header-actions">
          {/* Button to go back to the Dashboard */}
          <button
            className="dashboard-button"
            onClick={() => navigate("/dashboard")}
            title="Back to Dashboard"
          >
            Dashboard
          </button>

          {/* Notification bell icon and dropdown */}
          <div className="notif-container">
            <FaBell
              className="notif-bell"
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            />
            {/* Show count badge if there are pending notifications */}
            {notifications.length > 0 && (
              <span className="notif-count">{notifications.length}</span>
            )}
            {/* Dropdown list of notifications when toggled */}
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
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <p style={{ margin: 0 }}>{notif.message}</p>

                      {/* If it's a chat message notification */}
                      {notif.type === "message" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
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

                      {/* If it's a Hangman game invitation */}
                      {notif.type === "hangman_invite" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => acceptHangmanInvite(notif)}>
                            Join Hangman
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If it's a Tic-Tac-Toe game invitation */}
                      {notif.type === "tictactoe_invite" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => acceptTicTacToeInvite(notif)}>
                            Join Tic-Tac-Toe
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If it's a Connect Four game invitation */}
                      {notif.type === "connect4_invite" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => acceptConnectFourInvite(notif)}
                          >
                            Join Connect Four
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If it's a Battleship game invitation */}
                      {notif.type === "battleship_invite" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button onClick={() => acceptBattleshipInvite(notif)}>
                            Join Battleship
                          </button>
                          <button onClick={() => removeNotification(notif.id)}>
                            Remove
                          </button>
                        </div>
                      )}

                      {/* If it's a Duel Shots game invitation */}
                      {notif.type === "duel_invite" && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
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

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="profile-main">
        {/* Display current user info */}
        <div className="profile-info">
          <span className="profile-icon">👤</span>
          <h2>{username}</h2>
        </div>

        {/* Friend Requests Section */}
        <section className="profile-section">
          <h3>📬 Friend Requests</h3>
          {requests.length === 0 ? (
            <p>No pending requests.</p>
          ) : (
            requests.map((request) => (
              <div key={request.uid} className="friend-item">
                <span>@{request.username}</span>
                <button
                  onClick={() =>
                    handleAcceptRequest(request.uid, request.username)
                  }
                >
                  Accept
                </button>
                <button onClick={() => handleDeclineRequest(request.uid)}>
                  Decline
                </button>
              </div>
            ))
          )}
        </section>

        {/* Friends List Section */}
        <section className="profile-section">
          <h3>👥 Friends</h3>
          {friends.length === 0 ? (
            <p>No friends yet.</p>
          ) : (
            friends.map((friend) => (
              <div key={friend.uid} className="friend-item">
                <span>@{friend.username}</span>
                <button onClick={() => navigate(`/messages/${friend.uid}`)}>
                  Message
                </button>
                <button onClick={() => handleUnfriend(friend.uid)}>
                  Unfriend
                </button>
                <button
                  onClick={() => handleBlock(friend.uid, friend.username)}
                >
                  Block
                </button>
              </div>
            ))
          )}
        </section>

        {/* Blocked Users Section */}
        <section className="profile-section">
          <h3>🔒 Blocked Users</h3>
          {blocked.length === 0 ? (
            <p>No blocked users.</p>
          ) : (
            blocked.map((user) => (
              <div key={user.uid} className="friend-item">
                <span>@{user.username}</span>
                <button onClick={() => handleUnblock(user.uid)}>Unblock</button>
              </div>
            ))
          )}
        </section>
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        © {new Date().getFullYear()} PlayPal. Built with ❤️ by{" "}
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
