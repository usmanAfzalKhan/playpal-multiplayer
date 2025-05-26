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
    if (!user) {
      navigate('/'); // Redirect if not authenticated
      return;
    }

    const gameRef = doc(db, 'hangman_games', gameId);
    const unsub = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameData(data);
        setChatMessages(data.chat || []);
        setGuesses(data.guesses || []);
        setIncorrectGuesses((data.guesses || []).filter(g => !data.word?.includes(g)).length);
      } else {
        navigate('/dashboard'); // Handle non-existing game
      }
    });

    return () => unsub();
  }, [gameId, navigate, user]);

  if (!gameData) return <p>Loading game...</p>;

  const maxIncorrect = 6;
  const gameLost = incorrectGuesses >= maxIncorrect;
  const gameWon = gameData.word && gameData.word.split('').every(l => guesses.includes(l));

  const isCurrentGuesser = user.uid === gameData.currentGuesser;
  const isCurrentWordSetter = user.uid === gameData.currentWordSetter;

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
      <h2>Hangman Game</h2>
      <p>Role: {isCurrentWordSetter ? 'Word Setter' : 'Guesser'}</p>

      {gameData.status === 'pending' && isCurrentWordSetter && (
        <>
          <input value={wordInput} onChange={(e) => setWordInput(e.target.value)} placeholder="Set a word" />
          <button onClick={handleSetWord}>Set Word</button>
        </>
      )}

      {gameData.status === 'pending' && isCurrentGuesser && <p>Waiting for word setter...</p>}

      {gameData.status === 'started' && (
        <>
          <p>{gameData.word?.split('').map(l => guesses.includes(l) ? l : '_').join(' ')}</p>
          <p>Incorrect guesses: {incorrectGuesses}/{maxIncorrect}</p>
          {!gameWon && !gameLost && isCurrentGuesser && (
            <>
              <input maxLength="1" value={guessInput} onChange={(e) => setGuessInput(e.target.value)} placeholder="Your guess" />
              <button onClick={handleGuess}>Guess</button>
            </>
          )}
          {gameWon && <h3>🎉 Guesser Won!</h3>}
          {gameLost && <h3>💀 Guesser Lost!</h3>}
          {(gameWon || gameLost) && <button onClick={handleRestart}>Rematch (Swap Roles)</button>}
        </>
      )}

      <div className="chatbox">
        <div className="chat-messages">
          {chatMessages.map((msg, i) => (
            <p key={i}><strong>{msg.senderUid || 'Unknown'}:</strong> {msg.message}</p>
          ))}
        </div>
        <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type message" />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default HangmanGame;
