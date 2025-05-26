// src/pages/MultiplayerHangman.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import './MultiplayerHangman.css';

// Word list shared with SingleHangman
const WORDS = ['javascript', 'firebase', 'netlify', 'react', 'playpal'];

export default function MultiplayerHangman() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = auth.currentUser;

  const [friends, setFriends] = useState([]);
  const [waiting, setWaiting] = useState(false);
  const [gameData, setGameData] = useState(null);
  const [input, setInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [username, setUsername] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  // Fetch friends for challenge screen
  useEffect(() => {
    if (!user) return navigate('/');
    const fetchFriends = async () => {
      const snap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    };
    fetchFriends();
  }, [navigate, user]);

  // Load own username
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, 'users')).then(() => {}); // no-op, messaging works
    // you can fetch if needed
  }, [user]);

  // Create a new game
  const handleChallenge = async friend => {
    const newId = `${user.uid}_${friend.uid}_${Date.now()}`;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    await setDoc(doc(db, 'hangman_games', newId), {
      player1: user.uid,
      player2: friend.uid,
      currentTurn: user.uid,
      word,
      guesses: [],
      chat: [],
      status: 'pending',
      rematchVotes: [],
    });
    // notify friend...
    setWaiting(true);
  };

  // Listen for pending→active to navigate challenger in
  useEffect(() => {
    if (!waiting) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), snap => {
      if (snap.exists() && snap.data().status === 'active') {
        navigate(`/hangman/multiplayer/${gameId}`);
      }
    });
    return () => unsub();
  }, [waiting, gameId, navigate]);

  // Listen for game updates when joined
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), snap => {
      if (!snap.exists()) return setGameData(null);
      const data = snap.data();
      setGameData(data);
      if (data.status === 'finished') {
        setGameOver(true);
      }
    });
    return () => unsub();
  }, [gameId]);

  // Handle letter guess
  const makeGuess = async () => {
    if (!input || gameOver || user.uid !== gameData.currentTurn) return;
    const letter = input.toLowerCase();
    const guesses = gameData.guesses.includes(letter)
      ? gameData.guesses
      : [...gameData.guesses, letter];
    // count total incorrect 
    const incorrectCount = guesses.filter(l => !gameData.word.includes(l)).length;

    let status = 'active';
    let nextTurn =
      letter && gameData.word.includes(letter) ? user.uid : 
      gameData.currentTurn === gameData.player1
        ? gameData.player2
        : gameData.player1;
    // win?
    if (gameData.word.split('').every(l => guesses.includes(l))) {
      status = 'finished';
    }
    // loss?
    if (incorrectCount >= 6) {
      status = 'finished';
    }

    await updateDoc(doc(db, 'hangman_games', gameId), { guesses, currentTurn: nextTurn, status });
    setInput('');
  };

  // Send a chat message
  const sendChat = async () => {
    if (!chatInput) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({
        sender: user.displayName || user.uid,
        message: chatInput,
        timestamp: Date.now(),
      }),
    });
    setChatInput('');
  };

  // Player clicks Rematch
  const requestRematch = async () => {
    setRematchRequested(true);
    await updateDoc(doc(db, 'hangman_games', gameId), {
      rematchVotes: arrayUnion(user.uid),
    });
  };

  // When both have voted & gameOver, reset in-place
  useEffect(() => {
    if (
      gameOver &&
      gameData?.rematchVotes?.length === 2 &&
      gameData.status === 'finished'
    ) {
      const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      updateDoc(doc(db, 'hangman_games', gameId), {
        word: newWord,
        guesses: [],
        chat: [],
        status: 'active',
        currentTurn: gameData.player1,
        rematchVotes: [],
      });
      setGameOver(false);
      setRematchRequested(false);
    }
  }, [gameData, gameOver, gameId]);

  // Quit game entirely
  const quitGame = async () => {
    await deleteDoc(doc(db, 'hangman_games', gameId));
    navigate('/dashboard');
  };

  // Render: joined vs challenge screen
  if (gameId && gameData) {
    // determine incorrect for display
    const incorrectCount =
      gameData.guesses.filter(l => !gameData.word.includes(l)).length;

    return (
      <div className="hangman-room">
        <h2>Multiplayer Hangman</h2>
        <p>
          Current Turn:{' '}
          {gameData.currentTurn === user.uid ? 'Your Turn' : "Opponent's Turn"}
        </p>

        <svg height="250" width="200" className="hangman-drawing">
          {/* ... same <HangmanDrawing> shape code ... */}
          <line x1="10" y1="240" x2="190" y2="240" stroke="black" strokeWidth="4" />
          <line x1="50" y1="240" x2="50" y2="20" stroke="black" strokeWidth="4" />
          <line x1="50" y1="20" x2="150" y2="20" stroke="black" strokeWidth="4" />
          <line x1="150" y1="20" x2="150" y2="50" stroke="black" strokeWidth="4" />
          {incorrectCount > 0 && <circle cx="150" cy="70" r="20" stroke="black" strokeWidth="4" fill="none" />}
          {incorrectCount > 1 && <line x1="150" y1="90" x2="150" y2="150" stroke="black" strokeWidth="4" />}
          {incorrectCount > 2 && <line x1="150" y1="110" x2="120" y2="90" stroke="black" strokeWidth="4" />}
          {incorrectCount > 3 && <line x1="150" y1="110" x2="180" y2="90" stroke="black" strokeWidth="4" />}
          {incorrectCount > 4 && <line x1="150" y1="150" x2="120" y2="180" stroke="black" strokeWidth="4" />}
          {incorrectCount > 5 && <line x1="150" y1="150" x2="180" y2="180" stroke="black" strokeWidth="4" />}
        </svg>

        <p className="word-display">
          {gameData.word
            .split('')
            .map(l => (gameData.guesses.includes(l) ? l : '_'))
            .join(' ')}
        </p>
        <p>Incorrect Guesses: {incorrectCount} / 6</p>

        {!gameOver ? (
          gameData.currentTurn === user.uid ? (
            <>
              <input
                value={input}
                maxLength="1"
                onChange={e => setInput(e.target.value)}
                placeholder="Letter"
              />
              <button onClick={makeGuess}>Guess</button>
            </>
          ) : (
            <p>Waiting for opponent...</p>
          )
        ) : (
          <div className="end-controls">
            <h3>
              {gameData.word
                .split('')
                .every(l => gameData.guesses.includes(l))
                ? '🎉 Both guessed!' 
                : '💀 Game Over'}
            </h3>
            <button
              onClick={requestRematch}
              disabled={rematchRequested}
            >
              {rematchRequested ? 'Waiting...' : 'Rematch'}
            </button>
            <button onClick={quitGame}>Quit</button>
          </div>
        )}

        <div className="chatbox">
          <h4>Game Chat</h4>
          <div className="chat-log">
            {gameData.chat.map((m, i) => (
              <p key={i}>
                <strong>{m.sender}</strong>: {m.message}
              </p>
            ))}
          </div>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={sendChat}>Send</button>
        </div>
      </div>
    );
  }

  // Challenge screen
  return (
    <div className="multiplayer-container">
      <h2>Challenge a Friend to Hangman</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : (
        friends.map(f => (
          <div key={f.uid}>
            @{f.username}{' '}
            <button onClick={() => handleChallenge(f)}>Challenge</button>
          </div>
        ))
      )}
      {waiting && <p>Waiting for friend to accept…</p>}
      {waiting && (
        <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      )}
    </div>
  );
}
