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
  arrayRemove,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import './MultiplayerHangman.css';
import { HangmanDrawing } from './SingleHangman';

const WORDS = ['javascript', 'firebase', 'netlify', 'react', 'playpal'];

function MultiplayerHangman() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [friends, setFriends] = useState([]);
  const [waitingGameId, setWaitingGameId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [gameOver, setGameOver] = useState(false);

  // fetch current user's username
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(docSnap => {
      if (docSnap.exists()) setUsername(docSnap.data().username);
    });
  }, [user]);

  // fetch friends for challenge screen
  useEffect(() => {
    if (!user) return navigate('/');
    getDocs(collection(db, `users/${user.uid}/friends`)).then(snap =>
      setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    );
  }, [navigate, user]);

  // handle sending a new challenge
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    await setDoc(doc(db, 'hangman_games', id), {
      player1: user.uid,
      player2: friend.uid,
      currentTurn: user.uid,
      word,
      guesses: [],
      chat: [],
      status: 'pending',
      rematchVotes: [],
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, `users/${friend.uid}/notifications/${id}`), {
      type: 'hangman_invite',
      message: `🎮 @${username} challenged you to Hangman!`,
      gameId: id,
      timestamp: Timestamp.now(),
    });
    setWaitingGameId(id);
  };

  // redirect challenger once invite is accepted (status → "active")
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(
      doc(db, 'hangman_games', waitingGameId),
      snap => {
        const data = snap.data();
        if (data?.status === 'active') {
          navigate(`/hangman/multiplayer/${waitingGameId}`);
        }
      }
    );
    return () => unsub();
  }, [waitingGameId, navigate]);

  // live-listen game state (both play screen & rematch logic)
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), snap => {
      if (!snap.exists()) {
        // document might be deleted by quit
        navigate('/dashboard');
        return;
      }
      const data = snap.data();
      setGameData(data);

      // if finished, mark gameOver
      if (data.status === 'finished') setGameOver(true);
      
      // rematch flow: once both voted
      if (
        data.rematchVotes?.length === 2 &&
        data.status === 'finished'
      ) {
        const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        updateDoc(doc(db, 'hangman_games', gameId), {
          word: newWord,
          guesses: [],
          chat: [],
          status: 'active',
          currentTurn: data.player1,
          rematchVotes: [],
          winner: '',
        });
        setGameOver(false);
      }
    });
    return () => unsub();
  }, [gameId, navigate]);

  const makeGuess = async () => {
    if (!input || !gameData || gameOver) return;
    if (gameData.currentTurn !== user.uid) return;
    const letter = input.toLowerCase();
    const guesses = gameData.guesses.includes(letter)
      ? gameData.guesses
      : [...gameData.guesses, letter];
    const misses = gameData.word
      .split('')
      .filter(l => !guesses.includes(l)).length;
    let status = 'active',
      winner = '',
      nextTurn =
        gameData.currentTurn === gameData.player1
          ? gameData.player2
          : gameData.player1;

    // check win
    if (gameData.word.split('').every(l => guesses.includes(l))) {
      status = 'finished';
      winner = user.uid;
    } else if (misses >= 6) {
      status = 'finished';
      winner = 'draw';
    } else if (gameData.word.includes(letter)) {
      nextTurn = user.uid;
    }

    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses,
      currentTurn: nextTurn,
      status,
      winner,
    });
    setInput('');
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({
        sender: username,
        message,
        timestamp: Date.now(),
      }),
    });
    setMessage('');
  };

  const voteRematch = async () => {
    await updateDoc(doc(db, 'hangman_games', gameId), {
      rematchVotes: arrayUnion(user.uid),
    });
  };

  const handleQuit = async () => {
    await deleteDoc(doc(db, 'hangman_games', gameId));
    navigate('/dashboard');
  };

  // render in-game UI once gameId is present
  if (gameId && gameData) {
    const misses = gameData.guesses.filter(
      g => !gameData.word.includes(g)
    ).length;

    return (
      <div className="hangman-room">
        <h2>Multiplayer Hangman</h2>
        <p>
          Current Turn:{' '}
          {gameData.currentTurn === user.uid
            ? 'Your Turn'
            : "Opponent's Turn"}
        </p>
        <HangmanDrawing incorrectGuesses={misses} />
        <p>
          {gameData.word
            .split('')
            .map(l => (gameData.guesses.includes(l) ? l : '_'))
            .join(' ')}
        </p>
        <p>Incorrect Guesses: {misses} / 6</p>

        {!gameOver ? (
          gameData.currentTurn === user.uid ? (
            <>
              <input
                value={input}
                maxLength={1}
                onChange={e => setInput(e.target.value)}
              />
              <button onClick={makeGuess}>Guess</button>
            </>
          ) : (
            <p>Waiting for opponent...</p>
          )
        ) : (
          <>
            <h3>
              {gameData.winner === 'draw'
                ? '💀 Game Draw!'
                : gameData.winner === user.uid
                ? '🎉 You Win!'
                : '😢 You Lose!'}
            </h3>
            {!gameData.rematchVotes.includes(user.uid) ? (
              <button onClick={voteRematch}>Rematch</button>
            ) : (
              <p>Waiting for opponent’s rematch vote…</p>
            )}
            <button onClick={handleQuit}>Quit</button>
          </>
        )}

        <div className="chatbox">
          <h4>Game Chat</h4>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {gameData.chat.map((m, i) => (
              <p key={i}>
                <strong>{m.sender}</strong>: {m.message}
              </p>
            ))}
          </div>
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    );
  }

  // otherwise, show challenge screen
  return (
    <div className="multiplayer-container">
      <h2>Challenge a Friend to Hangman</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : (
        friends.map(f => (
          <div key={f.uid}>
            @{f.username}{' '}
            <button onClick={() => handleChallenge(f)}>
              Challenge
            </button>
          </div>
        ))
      )}
      {waitingGameId && (
        <>
          <p>Waiting for friend to accept…</p>
          <button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </>
      )}
    </div>
  );
}

export default MultiplayerHangman;
