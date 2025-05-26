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
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [guesses, setGuesses] = useState([]);

  const user = auth.currentUser;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameData(data);
        setChatMessages(data.chat || []);
        setGuesses(data.guesses || []);
        setIncorrectGuesses((data.guesses || []).filter(g => !data.word?.includes(g)).length);
      } else {
        alert('Game not found or was deleted.');
        navigate('/dashboard');
      }
    });
    return () => unsub();
  }, [gameId, navigate]);

  if (!gameData) return <p>Loading game...</p>;

  const maxIncorrect = 6;
  const gameLost = incorrectGuesses >= maxIncorrect;
  const gameWon = gameData.word && gameData.word.split('').every(l => guesses.includes(l));
  const isCurrentWordSetter = gameData.currentWordSetter === user.uid;
  const isCurrentGuesser = gameData.currentGuesser === user.uid;

  const handleSetWord = async () => {
    if (wordInput.trim() === '') return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: wordInput.toLowerCase(),
      status: 'started',
      guesses: [],
      chat: [],
    });
    setWordInput('');
  };

  const handleGuess = async () => {
    if (guessInput.trim() === '' || guesses.includes(guessInput.toLowerCase())) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: arrayUnion(guessInput.toLowerCase())
    });
    setGuessInput('');
  };

  const sendMessage = async () => {
    if (newMessage.trim() === '') return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ senderUid: user.uid, message: newMessage, timestamp: Date.now() })
    });
    setNewMessage('');
  };

  const renderWord = () => {
    if (!gameData.word) return '_ '.repeat(5);
    return gameData.word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ');
  };

  const handleRestart = async () => {
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
      <h2>Multiplayer Hangman</h2>
      <p>Game ID: {gameId}</p>
      <p>Role: {isCurrentWordSetter ? 'Word Setter' : 'Guesser'}</p>

      {gameData.status === 'pending' && isCurrentWordSetter && (
        <>
          <p>Set your word for the game:</p>
          <input value={wordInput} onChange={(e) => setWordInput(e.target.value)} />
          <button onClick={handleSetWord}>Set Word</button>
        </>
      )}
      {gameData.status === 'pending' && isCurrentGuesser && <p>Waiting for word to be set...</p>}

      {gameData.status === 'started' && (
        <>
          <HangmanDrawing incorrectGuesses={incorrectGuesses} />
          <p>{renderWord()}</p>
          <p>Incorrect Guesses: {incorrectGuesses}/{maxIncorrect}</p>
          {!gameLost && !gameWon && isCurrentGuesser && (
            <>
              <input maxLength="1" value={guessInput} onChange={(e) => setGuessInput(e.target.value)} />
              <button onClick={handleGuess}>Guess</button>
            </>
          )}
          {gameWon && <h3>🎉 Guesser Won! Rematch?</h3>}
          {gameLost && <h3>💀 Guesser Lost! Rematch?</h3>}
          {(gameWon || gameLost) && <button onClick={handleRestart}>Rematch (Switch Roles)</button>}
        </>
      )}

      <div className="game-chat">
        <div className="chat-messages">
          {chatMessages.map((msg, index) => (
            <p key={index}><strong>{msg.senderUid}</strong>: {msg.message}</p>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type message..." />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>

      <button onClick={() => navigate('/dashboard')}>Quit</button>
    </div>
  );
}

function HangmanDrawing({ incorrectGuesses }) {
  return (
    <svg height="250" width="200" className="hangman-drawing">
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
