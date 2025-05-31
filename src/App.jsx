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

import SinglePlayerBattleship from './pages/SinglePlayerBattleship';
import MultiplayerBattleship  from './pages/MultiplayerBattleship';

import SinglePlayerDuel       from './pages/SinglePlayerDuel';
import MultiplayerDuel        from './pages/MultiplayerDuel';

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth / Profile / Misc */}
        <Route path="/"                   element={<AuthPage />} />
        <Route path="/dashboard"          element={<Dashboard />} />
        <Route path="/profile"            element={<Profile />} />
        <Route path="/messages/:friendId" element={<Messaging />} />
        <Route path="/seed"               element={<FirestoreSeeder />} />

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

        {/* Duel Shots */}
        <Route path="/duel/single"              element={<SinglePlayerDuel />} />
        <Route path="/duel/multiplayer"         element={<MultiplayerDuel />} />
        <Route path="/duel/multiplayer/:gameId" element={<MultiplayerDuel />} />
      </Routes>
    </Router>
  );
}

export default App;
