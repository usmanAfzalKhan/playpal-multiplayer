import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, setDoc, addDoc, collection, query, orderBy, Timestamp } from 'firebase/firestore';
import './HangmanGame.css';

function HangmanGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [input, setInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [isChooser, setIsChooser] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [waitingForWord, setWaitingForWord] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserId(user.uid);
      setUsername(user.displayName || 'Player');
    } else {
      navigate('/');
    }

    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameData(data);
        setIsChooser(data.player1 === user?.uid && !data.word);
        setWaitingForWord(data.word === '' && data.player1 !== user?.uid);
      }
    });

    const chatRef = collection(db, `hangman_games/${gameId}/chat`);
    const q = query(chatRef, orderBy('timestamp'));
    const unsubChat = onSnapshot(q, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => doc.data()));
    });

    return () => {
      unsub();
      unsubChat();
    };
  }, [gameId, navigate]);

  const handleWordSubmit = async () => {
    if (wordInput.trim()) {
      await updateDoc(doc(db, 'hangman_games', gameId), { word: wordInput.trim().toLowerCase() });
      setIsChooser(false);
      setWaitingForWord(false);
    }
  };

  const handleGuess = () => {
    if (!input || gameOver || isChooser || waitingForWord) return;
    const guess = input.toLowerCase();
    if (guesses.includes(guess)) return;

    setGuesses([...guesses, guess]);
    if (!gameData.word.includes(guess)) {
      setIncorrectGuesses(incorrectGuesses + 1);
    }
    setInput('');
  };

  useEffect(() => {
    if (gameData && gameData.word) {
      if (gameData.word.split('').every(letter => guesses.includes(letter))) {
        setWin(true);
        setGameOver(true);
      } else if (incorrectGuesses >= 6) {
        setGameOver(true);
      }
    }
  }, [guesses, incorrectGuesses, gameData]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    await addDoc(collection(db, `hangman_games/${gameId}/chat`), {
      userId,
      username,
      message: chatInput.trim(),
      timestamp: Timestamp.now(),
    });
    setChatInput('');
  };

  const restartGame = async () => {
    // Switch roles
    const nextChooser = gameData.player1 === userId ? gameData.player2 : gameData.player1;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: '',
      player1: nextChooser,
      player2: gameData.player1 === userId ? gameData.player1 : gameData.player2,
      status: 'pending',
    });
    setGuesses([]);
    setIncorrectGuesses(0);
    setGameOver(false);
    setWin(false);
    setWordInput('');
  };

  return (
    <div className="hangman-room">
      <h2>Multiplayer Hangman</h2>

      {isChooser ? (
        <>
          <p>You’re the chooser. Enter a word:</p>
          <input value={wordInput} onChange={(e) => setWordInput(e.target.value)} />
          <button onClick={handleWordSubmit}>Submit</button>
        </>
      ) : waitingForWord ? (
        <p>Waiting for the other player to choose a word...</p>
      ) : (
        <>
          <p>Word: {gameData?.word?.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ')}</p>
          <p>Incorrect Guesses: {incorrectGuesses} / 6</p>
          {!gameOver && (
            <>
              <input maxLength="1" value={input} onChange={(e) => setInput(e.target.value)} />
              <button onClick={handleGuess}>Guess</button>
            </>
          )}
          {gameOver && (
            <>
              <h3>{win ? '🎉 You Win!' : `💀 You Lose! The word was ${gameData.word}`}</h3>
              <button onClick={restartGame}>Rematch</button>
            </>
          )}
        </>
      )}

      <div className="hangman-drawing">
        <img src={`/hangman-${incorrectGuesses}.png`} alt="Hangman drawing" />
      </div>

      <div className="chatbox">
        <div className="chat-messages">
          {chatMessages.map((msg, index) => (
            <div key={index} className="chat-message">
              <strong>{msg.username}: </strong>{msg.message}
            </div>
          ))}
        </div>
        <input
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default HangmanGame;
