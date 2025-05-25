import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import './HangmanGame.css';

function HangmanGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [currentUser, setCurrentUser] = useState(auth.currentUser.uid);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newChat, setNewChat] = useState('');

  useEffect(() => {
    const gameRef = doc(db, 'hangman_games', gameId);
    const unsub = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      } else {
        navigate('/dashboard'); // Game was deleted
      }
    });
    return () => unsub();
  }, [gameId, navigate]);

  useEffect(() => {
    if (gameData && !gameData.word && gameData.player1 === currentUser) {
      const chosenWord = prompt('Enter the word for your opponent to guess:');
      if (chosenWord) {
        updateDoc(doc(db, 'hangman_games', gameId), { word: chosenWord.toLowerCase() });
      }
    }
  }, [gameData, currentUser, gameId]);

  useEffect(() => {
    if (gameData?.word && gameData.word.split('').every(letter => guesses.includes(letter))) {
      setWin(true);
      setGameOver(true);
    } else if (incorrectGuesses >= 6) {
      setGameOver(true);
    }
  }, [guesses, incorrectGuesses, gameData]);

  const handleGuess = () => {
    if (!input || gameOver) return;
    const guess = input.toLowerCase();
    if (guesses.includes(guess)) return;

    setGuesses([...guesses, guess]);
    if (!gameData.word.includes(guess)) {
      setIncorrectGuesses(incorrectGuesses + 1);
    }
    setInput('');
  };

  const handleSendChat = () => {
    if (newChat.trim() === '') return;
    const message = { sender: currentUser, content: newChat, timestamp: Date.now() };
    setChatMessages([...chatMessages, message]);
    setNewChat('');
  };

  const handleLeaveGame = async () => {
    // Delete the game room (ephemeral)
    await deleteDoc(doc(db, 'hangman_games', gameId));
    navigate('/dashboard');
  };

  return (
    <div className="hangman-room">
      <h2>Hangman Game</h2>
      {gameData && (
        <>
          <p>Word: {gameData.word ? gameData.word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ') : 'Waiting for word...'}</p>
          <p>Incorrect Guesses: {incorrectGuesses} / 6</p>

          {!gameOver && (
            <>
              <input
                type="text"
                maxLength="1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button onClick={handleGuess}>Guess</button>
            </>
          )}

          {gameOver && (
            <>
              <h3>{win ? '🎉 You Win!' : `💀 You Lose! The word was ${gameData.word}`}</h3>
              <button onClick={() => window.location.reload()}>Rematch</button>
              <button onClick={handleLeaveGame}>Quit</button>
            </>
          )}
        </>
      )}

      <div className="chatbox">
        <h4>Game Chat</h4>
        <div className="chat-messages">
          {chatMessages.map((msg, index) => (
            <div key={index} className="chat-message">
              <strong>{msg.sender === currentUser ? 'You' : 'Opponent'}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <input
          type="text"
          value={newChat}
          onChange={(e) => setNewChat(e.target.value)}
          placeholder="Type your message..."
        />
        <button onClick={handleSendChat}>Send</button>
      </div>
    </div>
  );
}

export default HangmanGame;
