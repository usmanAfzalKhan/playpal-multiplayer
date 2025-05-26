import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, getDoc, collection, addDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import './HangmanGame.css';

function HangmanGame() {
  const { gameId } = useParams();
  const [gameData, setGameData] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [input, setInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [newWord, setNewWord] = useState('');
  const [win, setWin] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubGame = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      } else {
        console.error('Game not found!');
      }
    });

    const unsubChat = onSnapshot(
      collection(db, `hangman_games/${gameId}/chat`),
      (snapshot) => {
        const messages = snapshot.docs.map(doc => doc.data());
        setChatMessages(messages);
      }
    );

    return () => {
      unsubGame();
      unsubChat();
    };
  }, [gameId]);

  const handleSetWord = async () => {
    if (!newWord.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: newWord.toLowerCase(),
    });
    setNewWord('');
  };

  const handleGuess = () => {
    if (!input || !gameData || guesses.includes(input.toLowerCase()) || gameOver) return;

    const guess = input.toLowerCase();
    setGuesses([...guesses, guess]);
    if (!gameData.word.includes(guess)) {
      setIncorrectGuesses(incorrectGuesses + 1);
    }
    setInput('');
  };

  useEffect(() => {
    if (!gameData?.word) return;

    const allLettersGuessed = gameData.word.split('').every(letter => guesses.includes(letter));
    if (allLettersGuessed) {
      setWin(true);
      setGameOver(true);
    } else if (incorrectGuesses >= 6) {
      setWin(false);
      setGameOver(true);
    }
  }, [guesses, incorrectGuesses, gameData]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await addDoc(collection(db, `hangman_games/${gameId}/chat`), {
      senderUid: auth.currentUser.uid,
      message: newMessage,
      timestamp: Timestamp.now(),
    });
    setNewMessage('');
  };

  const handleRematch = async () => {
    const nextTurn = gameData.currentTurn === gameData.player1 ? gameData.player2 : gameData.player1;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: '',
      currentTurn: nextTurn,
    });
    setGuesses([]);
    setIncorrectGuesses(0);
    setWin(false);
    setGameOver(false);
  };

  const handleQuit = () => {
    navigate('/dashboard');
  };

  if (!gameData) {
    return <p>Loading game...</p>;
  }

  const isSetter = gameData.currentTurn === auth.currentUser.uid;
  const isGuesser = !isSetter && gameData.word;

  return (
    <div className="hangman-game">
      <h2>Hangman Game</h2>

      {isSetter && !gameData.word ? (
        <>
          <h3>It's your turn to set the word!</h3>
          <input
            type="text"
            placeholder="Enter secret word"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
          />
          <button onClick={handleSetWord}>Set Word</button>
        </>
      ) : isGuesser ? (
        <>
          <HangmanDrawing incorrectGuesses={incorrectGuesses} />
          <p>Word: {gameData.word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ')}</p>
          <p>Incorrect Guesses: {incorrectGuesses} / 6</p>
          {!gameOver ? (
            <>
              <input
                type="text"
                maxLength="1"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button onClick={handleGuess}>Guess</button>
            </>
          ) : (
            <>
              <h3>{win ? '🎉 You Win!' : `💀 You Lose! The word was ${gameData.word}`}</h3>
              <button onClick={handleRematch}>Rematch</button>
              <button onClick={handleQuit}>Quit</button>
            </>
          )}
        </>
      ) : (
        <p>Waiting for {gameData.currentTurn === gameData.player1 ? 'Player 1' : 'Player 2'} to set the word...</p>
      )}

      <div className="game-chat">
        <h3>Game Chat</h3>
        <div className="chat-messages" style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {chatMessages.map((msg, index) => (
            <p key={index}><strong>{msg.senderUid}</strong>: {msg.message}</p>
          ))}
        </div>
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
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
