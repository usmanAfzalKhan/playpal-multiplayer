import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
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
  const [currentTurn, setCurrentTurn] = useState('');
  const [userInfo, setUserInfo] = useState({ uid: '', username: '' });

  const maxIncorrect = 6;

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/');
      return;
    }
    setUserInfo({ uid: user.uid, username: user.displayName || 'Player' });

    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGameData(data);
        setGuesses(data.guesses || []);
        setIncorrectGuesses((data.guesses || []).filter(g => !data.word?.includes(g)).length);
        setCurrentTurn(data.currentTurn);

        if (data.chat) {
          const enrichedChat = await Promise.all(
            data.chat.map(async (msg) => {
              const senderDoc = await getDoc(doc(db, 'users', msg.senderUid));
              const senderUsername = senderDoc.exists() ? senderDoc.data().username : 'Unknown';
              return { ...msg, senderUsername };
            })
          );
          setChatMessages(enrichedChat);
        }
      }
    });
    return () => unsub();
  }, [gameId, navigate]);

  const handleSetWord = async () => {
    if (wordInput.trim() === '') return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: wordInput.toLowerCase(),
      status: 'started',
      guesses: [],
      chat: [],
      currentTurn: gameData.player1,
    });
    setWordInput('');
  };

  const handleGuess = async () => {
    if (guessInput.trim() === '' || guesses.includes(guessInput.toLowerCase()) || gameData.currentTurn !== userInfo.uid) return;

    const guess = guessInput.toLowerCase();
    const isCorrect = gameData.word.includes(guess);

    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: arrayUnion(guess),
      currentTurn: isCorrect ? userInfo.uid : (userInfo.uid === gameData.player1 ? gameData.player2 : gameData.player1)
    });

    setGuessInput('');
  };

  const sendMessage = async () => {
    if (newMessage.trim() === '') return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ senderUid: userInfo.uid, message: newMessage, timestamp: Date.now() })
    });
    setNewMessage('');
  };

  const renderWord = () => {
    if (!gameData.word) return '_ '.repeat(5);
    return gameData.word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ');
  };

  const handleRestart = async () => {
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: '',
      guesses: [],
      chat: [],
      status: 'pending',
      currentTurn: gameData.player1,
    });
  };

  if (!gameData) return <p>Loading game...</p>;

  const gameLost = incorrectGuesses >= maxIncorrect;
  const gameWon = gameData.word && gameData.word.split('').every(l => guesses.includes(l));

  return (
    <div className="hangman-room">
      <h2>Multiplayer Hangman</h2>
      <p>Game ID: {gameId}</p>
      <p>Current Turn: {currentTurn === userInfo.uid ? 'Your Turn' : 'Opponent\'s Turn'}</p>

      {gameData.status === 'pending' ? (
        gameData.player1 === userInfo.uid ? (
          <>
            <p>You’re the word setter. Enter a word:</p>
            <input type="text" value={wordInput} onChange={(e) => setWordInput(e.target.value)} />
            <button onClick={handleSetWord}>Set Word</button>
          </>
        ) : (
          <p>Waiting for word to be set...</p>
        )
      ) : (
        <>
          <HangmanDrawing incorrectGuesses={incorrectGuesses} />
          <p>{renderWord()}</p>
          <p>Incorrect Guesses: {incorrectGuesses}/{maxIncorrect}</p>
          {!gameLost && !gameWon && (
            <>
              <input
                type="text"
                maxLength="1"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                disabled={currentTurn !== userInfo.uid}
              />
              <button onClick={handleGuess} disabled={currentTurn !== userInfo.uid}>Guess</button>
            </>
          )}
          {gameWon && <h3>🎉 Someone guessed it! Click Rematch to play again.</h3>}
          {gameLost && <h3>💀 Too many wrong guesses! Click Rematch to try again.</h3>}
          {(gameWon || gameLost) && (
            <button onClick={handleRestart}>Rematch</button>
          )}
        </>
      )}

      <div className="game-chat">
        <div className="chat-messages">
          {chatMessages.map((msg, index) => (
            <p key={index}><strong>{msg.senderUsername}</strong>: {msg.message}</p>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>

      <button onClick={() => navigate('/dashboard')}>Quit to Dashboard</button>
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
