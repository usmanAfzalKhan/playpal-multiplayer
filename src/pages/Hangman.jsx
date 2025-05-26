// /pages/Hangman.jsx
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase-config';
import { useEffect } from 'react';
import './Hangman.css';


function Hangman() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/');
    }
  }, [navigate]);

  const handleModeSelect = (mode) => {
    if (mode === 'single') {
      // Navigate to single-player hangman
      navigate('/hangman/single');
    } else if (mode === 'multi') {
      // Navigate to multiplayer selection page
      navigate('/hangman/multiplayer');
    }
  };

  return (
    <div className="hangman-selection">
      <h2>Hangman</h2>
      <p>Choose your game mode:</p>
      <button onClick={() => handleModeSelect('single')}>Single Player</button>
      <button onClick={() => handleModeSelect('multi')}>Multiplayer</button>
    </div>
  );
}

export default Hangman;
