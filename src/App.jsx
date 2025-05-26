// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage           from './pages/AuthPage';
import Dashboard          from './pages/Dashboard';
import Profile            from './pages/Profile';
import Messaging          from './pages/Messaging';
import FirestoreSeeder    from './pages/FirestoreSeeder';
import SingleHangman      from './pages/SingleHangman';
import MultiplayerHangman from './pages/MultiplayerHangman';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"                        element={<AuthPage />} />
        <Route path="/dashboard"               element={<Dashboard />} />
        <Route path="/profile"                 element={<Profile />} />
        <Route path="/messages/:friendId"      element={<Messaging />} />
        <Route path="/seed"                    element={<FirestoreSeeder />} />

        <Route path="/hangman/single"          element={<SingleHangman />} />

        {/* same component handles both screens */}
        <Route path="/hangman/multiplayer"     element={<MultiplayerHangman />} />
        <Route path="/hangman/multiplayer/:gameId" element={<MultiplayerHangman />} />
      </Routes>
    </Router>
  );
}

export default App;
