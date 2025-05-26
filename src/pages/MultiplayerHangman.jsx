import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { collection, doc, setDoc, onSnapshot, updateDoc, arrayUnion, getDoc, Timestamp } from 'firebase/firestore';
import './HangmanGame.css';

function MultiplayerHangman() {
  const [gameId, setGameId] = useState('');
  const [gameData, setGameData] = useState(null);
  const [wordInput, setWordInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUsername = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      setUsername(docSnap.exists() ? docSnap.data().username : 'Player');
    };
    fetchUsername();
  }, []);

  const startNewGame = async () => {
    const id = `${user.uid}_${Date.now()}`;
    await setDoc(doc(db, 'hangman_games', id), {
      player1: user.uid,
      player2: null,
      word: '',
      guesses: [],
      incorrectGuesses: 0,
      chat: [],
      turn: user.uid,
      status: 'waiting'
    });
    setGameId(id);
  };

  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      }
    });
    return () => unsub();
  }, [gameId]);

  const handleSetWord = async () => {
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: wordInput.toLowerCase(),
      status: 'started'
    });
  };

  const handleGuess = async () => {
    if (guessInput.trim() && user.uid === gameData.turn) {
      const correct = gameData.word.includes(guessInput.toLowerCase());
      await updateDoc(doc(db, 'hangman_games', gameId), {
        guesses: arrayUnion({ letter: guessInput.toLowerCase(), player: user.uid }),
        turn: correct ? user.uid : (gameData.player1 === user.uid ? gameData.player2 : gameData.player1)
      });
      setGuessInput('');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ sender: username, message: newMessage, timestamp: Date.now() })
    });
    setNewMessage('');
  };

  return (
    <div className="hangman-room">
      {!gameId ? (
        <button onClick={startNewGame}>Start New Game</button>
      ) : !gameData ? (
        <p>Loading...</p>
      ) : (
        <>
          <h2>Multiplayer Hangman</h2>
          <p>{gameData.status === 'waiting' ? 'Waiting for opponent...' : `Word: ${gameData.word.replace(/./g, '_ ')}`}</p>
          {gameData.status === 'started' && user.uid === gameData.turn && (
            <>
              <input value={guessInput} onChange={(e) => setGuessInput(e.target.value)} maxLength="1" />
              <button onClick={handleGuess}>Guess</button>
            </>
          )}
          {gameData.status === 'waiting' && <p>Waiting for the word to be set.</p>}
          <div className="chatbox">
            {gameData.chat.map((msg, i) => (
              <p key={i}><strong>{msg.sender}:</strong> {msg.message}</p>
            ))}
            <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
            <button onClick={sendMessage}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}

export default MultiplayerHangman;
