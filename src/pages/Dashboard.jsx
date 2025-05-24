// src/pages/Dashboard.jsx
import "./Dashboard.css";
import logo from "../assets/logo.png";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase-config";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa"; // Importing the search icon from react-icons
import { signOut } from "firebase/auth"; // Importing signOut from Firebase Auth

function Dashboard() {
  const [username, setUsername] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsername = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/");

      const docRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(docRef);
      if (userSnap.exists()) {
        setUsername(userSnap.data().username);
      }
    };

    fetchUsername();
  }, []);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <img
          src={logo}
          alt="PlayPal Logo"
          className="header-logo"
          title="Logout"
          onClick={() => {
            signOut(auth).then(() => navigate("/"));
          }}
          style={{ cursor: "pointer" }}
        />

        <div className="header-controls">
          <FaSearch
            className="search-icon"
            onClick={() => setShowSearch(!showSearch)}
            title="Search users"
          />
          {showSearch && (
            <input
              type="text"
              placeholder="Search by username..."
              className="search-box"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          )}
          <span
            className="profile-icon"
            title={`Logged in as @${username}`}
            onClick={() => navigate("/profile")}
          >
            👤
          </span>
        </div>
      </header>

      {/* Game Gallery Placeholder */}
      <main className="dashboard-main">
        <h2 style={{ textAlign: "center" }}>🎮 Games</h2>
        <div className="game-grid">
          <div className="game-card">
            <img src="https://via.placeholder.com/150" alt="Tic Tac Toe" />
            <p>Tic Tac Toe</p>
          </div>
          <div className="game-card">
            <img src="https://via.placeholder.com/150" alt="Coming Soon" />
            <p>More Games Coming</p>
          </div>
        </div>
      </main>

      {/* Footer */}
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

export default Dashboard;
