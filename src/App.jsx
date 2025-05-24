import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Messaging from './pages/Messaging';
import FirestoreSeeder from './pages/FirestoreSeeder'; // 🔥 Import the Seeder page

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/messages/:friendId" element={<Messaging />} />
        <Route path="/seed" element={<FirestoreSeeder />} /> {/* 🔥 Seeder route */}
      </Routes>
    </Router>
  );
}

export default App;
