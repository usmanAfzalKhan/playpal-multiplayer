// src/App.jsx

// Import BrowserRouter, Routes, and Route components from react-router-dom
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import all page components to be used in routing
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Messaging from "./pages/Messaging";
import FirestoreSeeder from "./pages/FirestoreSeeder";

import SingleHangman from "./pages/SingleHangman";
import MultiplayerHangman from "./pages/MultiplayerHangman";

import SingleTicTacToe from "./pages/SingleTicTacToe";
import MultiplayerTicTacToe from "./pages/MultiplayerTicTacToe";

import SingleConnectFour from "./pages/SingleConnectFour";
import MultiplayerConnectFour from "./pages/MultiplayerConnectFour";

import SinglePlayerBattleship from "./pages/SinglePlayerBattleship";
import MultiplayerBattleship from "./pages/MultiplayerBattleship";

import SinglePlayerDuel from "./pages/SinglePlayerDuel";

function App() {
  return (
    // Wrap the entire application in a Router to enable client-side routing
    <Router>
      {/* Define the set of Routes for the application */}
      <Routes>
        {/* ─── Auth / Profile / Miscellaneous Routes ─────────────────────────── */}
        {/* Root path "/" renders the authentication page (login/signup) */}
        <Route path="/" element={<AuthPage />} />
        {/* "/dashboard" renders the main dashboard after login */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* "/profile" renders the user's profile page */}
        <Route path="/profile" element={<Profile />} />
        {/* "/messages/:friendId" renders the messaging UI for chatting with a specific friend */}
        <Route path="/messages/:friendId" element={<Messaging />} />
        {/* "/seed" renders a utility page to seed Firestore with sample data */}
        <Route path="/seed" element={<FirestoreSeeder />} />

        {/* ─── Hangman Game Routes ─────────────────────────────────────────────── */}
        {/* "/hangman/single" renders the single-player Hangman game */}
        <Route path="/hangman/single" element={<SingleHangman />} />
        {/* "/hangman/multiplayer" renders the multiplayer lobby or invite screen */}
        <Route path="/hangman/multiplayer" element={<MultiplayerHangman />} />
        {/* "/hangman/multiplayer/:gameId" renders a specific multiplayer Hangman game by ID */}
        <Route
          path="/hangman/multiplayer/:gameId"
          element={<MultiplayerHangman />}
        />

        {/* ─── Tic-Tac-Toe Game Routes ─────────────────────────────────────────── */}
        {/* "/tictactoe/single" renders the single-player Tic-Tac-Toe game */}
        <Route path="/tictactoe/single" element={<SingleTicTacToe />} />
        {/* "/tictactoe/multiplayer" renders the multiplayer lobby or invite screen */}
        <Route
          path="/tictactoe/multiplayer"
          element={<MultiplayerTicTacToe />}
        />
        {/* "/tictactoe/multiplayer/:gameId" renders a specific multiplayer Tic-Tac-Toe game by ID */}
        <Route
          path="/tictactoe/multiplayer/:gameId"
          element={<MultiplayerTicTacToe />}
        />

        {/* ─── Connect Four Game Routes ───────────────────────────────────────── */}
        {/* "/connect4/single" renders the single-player Connect Four game */}
        <Route path="/connect4/single" element={<SingleConnectFour />} />
        {/* "/connect4/multiplayer" renders the multiplayer lobby or invite screen */}
        <Route
          path="/connect4/multiplayer"
          element={<MultiplayerConnectFour />}
        />
        {/* "/connect4/multiplayer/:gameId" renders a specific multiplayer Connect Four game by ID */}
        <Route
          path="/connect4/multiplayer/:gameId"
          element={<MultiplayerConnectFour />}
        />

        {/* ─── Battleship Game Routes ─────────────────────────────────────────── */}
        {/* "/battleship/single" renders the single-player Battleship game */}
        <Route path="/battleship/single" element={<SinglePlayerBattleship />} />
        {/* "/battleship/multiplayer" renders the multiplayer lobby or invite screen */}
        <Route
          path="/battleship/multiplayer"
          element={<MultiplayerBattleship />}
        />
        {/* "/battleship/multiplayer/:gameId" renders a specific multiplayer Battleship game by ID */}
        <Route
          path="/battleship/multiplayer/:gameId"
          element={<MultiplayerBattleship />}
        />

        {/* ─── Duel Shots Game Route ───────────────────────────────────────────── */}
        {/* "/duel/single" renders the single-player Duel Shots game */}
        <Route path="/duel/single" element={<SinglePlayerDuel />} />
      </Routes>
    </Router>
  );
}

// Export the App component as the default export so it can be imported in main.jsx
export default App;
