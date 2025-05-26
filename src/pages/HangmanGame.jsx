import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import './HangmanGame.css';

function HangmanGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const user = auth.currentUser;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      } else {
        setGameData(null);
      }
    });
    return () => unsub();
  }, [gameId]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ sender: user.displayName, message: newMessage, timestamp: Date.now() }),
    });
    setNewMessage('');
  };

  const makeGuess = async () => {
    if (!input.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: arrayUnion(input.toLowerCase()),
    });
    setInput('');
  };

  if (!gameData) return <p>Game not found. Try again later.</p>;

  return (
    <div>
      <h2>Hangman Game</h2>
      <p>Word: {gameData.word ? gameData.word.split('').map(l => (gameData.guesses?.includes(l) ? l : '_')).join(' ') : 'Waiting...'}</p>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={makeGuess}>Guess</button>

      <h3>Chat</h3>
      <div>
        {(gameData.chat || []).map((msg, i) => (
          <p key={i}><strong>{msg.sender}</strong>: {msg.message}</p>
        ))}
      </div>
      <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
      <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
    </div>
  );
}

export default HangmanGame;
