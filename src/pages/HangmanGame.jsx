import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import './HangmanGame.css';

function HangmanGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [wordInput, setWordInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) setGameData(docSnap.data());
    });
    return () => unsub();
  }, [gameId]);

  if (!gameData) return <p>Loading...</p>;

  const isWordSetter = gameData.currentWordSetter === user.uid;
  const isGuesser = gameData.currentGuesser === user.uid;
  const maxIncorrect = 6;
  const incorrectGuesses = (gameData.guesses || []).filter(g => !gameData.word.includes(g)).length;
  const gameWon = gameData.word && gameData.word.split('').every(letter => (gameData.guesses || []).includes(letter));
  const gameLost = incorrectGuesses >= maxIncorrect;

  const handleSetWord = async () => {
    if (wordInput.trim()) {
      await updateDoc(doc(db, 'hangman_games', gameId), { word: wordInput.toLowerCase(), status: 'started', guesses: [], chat: [] });
      setWordInput('');
    }
  };

  const handleGuess = async () => {
    if (guessInput.trim() && !(gameData.guesses || []).includes(guessInput.toLowerCase())) {
      await updateDoc(doc(db, 'hangman_games', gameId), { guesses: arrayUnion(guessInput.toLowerCase()) });
      setGuessInput('');
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim()) {
      await updateDoc(doc(db, 'hangman_games', gameId), {
        chat: arrayUnion({ sender: user.displayName || 'Unknown', message: newMessage, timestamp: Date.now() })
      });
      setNewMessage('');
    }
  };

  const switchRoles = async () => {
    await updateDoc(doc(db, 'hangman_games', gameId), {
      currentWordSetter: gameData.currentGuesser,
      currentGuesser: gameData.currentWordSetter,
      word: '',
      guesses: [],
      chat: [],
      status: 'pending'
    });
  };

  return (
    <div className="hangman-room">
      <h2>Hangman Game</h2>
      <p>Role: {isWordSetter ? 'Word Setter' : isGuesser ? 'Guesser' : 'Spectator'}</p>
      {gameData.status === 'pending' && isWordSetter && (
        <>
          <input value={wordInput} onChange={e => setWordInput(e.target.value)} placeholder="Enter word..." />
          <button onClick={handleSetWord}>Set Word</button>
        </>
      )}
      {gameData.status === 'pending' && isGuesser && <p>Waiting for word setter...</p>}
      {gameData.status === 'started' && (
        <>
          <HangmanDrawing incorrectGuesses={incorrectGuesses} />
          <p>{gameData.word.split('').map(l => (gameData.guesses || []).includes(l) ? l : '_').join(' ')}</p>
          <p>Incorrect: {incorrectGuesses}/{maxIncorrect}</p>
          {isGuesser && !gameWon && !gameLost && (
            <>
              <input value={guessInput} maxLength={1} onChange={e => setGuessInput(e.target.value)} />
              <button onClick={handleGuess}>Guess</button>
            </>
          )}
          {gameWon && <h3>🎉 Guesser won!</h3>}
          {gameLost && <h3>💀 Guesser lost!</h3>}
          {(gameWon || gameLost) && <button onClick={switchRoles}>Rematch (Switch Roles)</button>}
        </>
      )}
      <div className="chatbox">
        {(gameData.chat || []).map((msg, idx) => (
          <div key={idx}><strong>{msg.sender}: </strong>{msg.message}</div>
        ))}
        <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type message..." />
        <button onClick={sendMessage}>Send</button>
      </div>
      <button onClick={() => navigate('/dashboard')}>Quit</button>
    </div>
  );
}

function HangmanDrawing({ incorrectGuesses }) {
  return (
    <svg height="250" width="200">
      <line x1="10" y1="240" x2="190" y2="240" stroke="black" strokeWidth="4" />
      <line x1="50" y1="240" x2="50" y2="20" stroke="black" strokeWidth="4" />
      <line x1="50" y1="20" x2="150" y2="20" stroke="black" strokeWidth="4" />
      <line x1="150" y1="20" x2="150" y2="50" stroke="black" strokeWidth="4" />
      {incorrectGuesses > 0 && <circle cx="150" cy="70" r="20" stroke="black" strokeWidth="4" fill="none" />}
      {incorrectGuesses > 1 && <line x1="150" y1="90" x2="150" y2="150" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 2 && <line x1="150" y1="110" x2="120" y2="90" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 3 && <line x1="150" y1="110" x2="180" y2="90" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 4 && <line x1="150" y1="150" x2="120" y2="180" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 5 && <line x1="150" y1="150" x2="180" y2="180" stroke="black" strokeWidth="4" />}
    </svg>
  );
}

export default HangmanGame;
