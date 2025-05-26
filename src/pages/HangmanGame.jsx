import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import './HangmanGame.css';

function HangmanGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [input, setInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [username, setUsername] = useState('');
  const user = auth.currentUser;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameData(data);
        setGuesses(data.guesses || []);
        setIncorrectGuesses((data.guesses || []).filter(g => !data.word?.includes(g)).length);
      }
    });
    return () => unsub();
  }, [gameId]);

  useEffect(() => {
    if (user) setUsername(user.displayName || 'Player');
  }, [user]);

  if (!gameData) return <p>Loading game...</p>;

  const maxIncorrect = 6;
  const gameLost = incorrectGuesses >= maxIncorrect;
  const gameWon = gameData.word && gameData.word.split('').every(l => guesses.includes(l));

  const isMyTurn = gameData.turn === user.uid;

  const handleGuess = async () => {
    if (!input || guesses.includes(input.toLowerCase()) || !isMyTurn) return;
    const updatedGuesses = [...guesses, input.toLowerCase()];
    const correctGuess = gameData.word.includes(input.toLowerCase());

    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: arrayUnion(input.toLowerCase()),
      turn: correctGuess ? user.uid : (user.uid === gameData.player1 ? gameData.player2 : gameData.player1),
    });

    setInput('');
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ senderUid: user.uid, senderName: username, message: chatInput, timestamp: Timestamp.now() }),
    });
    setChatInput('');
  };

  const restartGame = async () => {
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: '',
      guesses: [],
      chat: [],
      status: 'pending',
      turn: gameData.player1,
    });
  };

  const renderWord = () => {
    if (!gameData.word) return '_ '.repeat(5);
    return gameData.word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ');
  };

  return (
    <div className="hangman-room">
      <h2>Multiplayer Hangman</h2>
      <p>Role: {gameData.player1 === user.uid ? 'Player 1' : 'Player 2'} - {isMyTurn ? "Your Turn" : "Waiting..."}</p>
      <p>Word: {renderWord()}</p>
      <p>Incorrect Guesses: {incorrectGuesses}/{maxIncorrect}</p>
      {isMyTurn && !gameLost && !gameWon && (
        <>
          <input type="text" maxLength="1" value={input} onChange={(e) => setInput(e.target.value)} />
          <button onClick={handleGuess}>Guess</button>
        </>
      )}
      {gameWon && <h3>🎉 Winner!</h3>}
      {gameLost && <h3>💀 Lost! Word was: {gameData.word}</h3>}
      {(gameWon || gameLost) && <button onClick={restartGame}>Rematch</button>}

      <div className="chatbox">
        <div className="chat-messages">
          {(gameData.chat || []).map((msg, index) => (
            <div key={index}><strong>{msg.senderName}</strong>: {msg.message}</div>
          ))}
        </div>
        <input placeholder="Type a message..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
        <button onClick={sendMessage}>Send</button>
      </div>

      <button onClick={() => navigate('/dashboard')}>Quit</button>
    </div>
  );
}

export default HangmanGame;
