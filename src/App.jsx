// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage               from './pages/AuthPage';
import Dashboard              from './pages/Dashboard';
import Profile                from './pages/Profile';
import Messaging              from './pages/Messaging';
import FirestoreSeeder        from './pages/FirestoreSeeder';
import SingleHangman          from './pages/SingleHangman';
import MultiplayerHangman     from './pages/MultiplayerHangman';
import SingleTicTacToe        from './pages/SingleTicTacToe';
import MultiplayerTicTacToe   from './pages/MultiplayerTicTacToe';
import SingleConnectFour      from './pages/SingleConnectFour';
import MultiplayerConnectFour from './pages/MultiplayerConnectFour';

// ✔️ Battleship imports from pages, not components
import SinglePlayerBattleship from './pages/SinglePlayerBattleship';
import MultiplayerBattleship  from './pages/MultiplayerBattleship';

function App() {
  return (
    <Router>
      <Routes>
        {/* auth / profile / misc */}
        <Route path="/"                       element={<AuthPage />} />
        <Route path="/dashboard"              element={<Dashboard />} />
        <Route path="/profile"                element={<Profile />} />
        <Route path="/messages/:friendId"     element={<Messaging />} />
        <Route path="/seed"                   element={<FirestoreSeeder />} />

        {/* Hangman */}
        <Route path="/hangman/single"              element={<SingleHangman />} />
        <Route path="/hangman/multiplayer"         element={<MultiplayerHangman />} />
        <Route path="/hangman/multiplayer/:gameId" element={<MultiplayerHangman />} />

        {/* Tic-Tac-Toe */}
        <Route path="/tictactoe/single"              element={<SingleTicTacToe />} />
        <Route path="/tictactoe/multiplayer"         element={<MultiplayerTicTacToe />} />
        <Route path="/tictactoe/multiplayer/:gameId" element={<MultiplayerTicTacToe />} />

        {/* Connect Four */}
        <Route path="/connect4/single"              element={<SingleConnectFour />} />
        <Route path="/connect4/multiplayer"         element={<MultiplayerConnectFour />} />
        <Route path="/connect4/multiplayer/:gameId" element={<MultiplayerConnectFour />} />

        {/* Battleship */}
        <Route path="/battleship/single"              element={<SinglePlayerBattleship />} />
        <Route path="/battleship/multiplayer"         element={<MultiplayerBattleship />} />
        <Route path="/battleship/multiplayer/:gameId" element={<MultiplayerBattleship />} />
      </Routes>
    </Router>
  );
}

export default App;
