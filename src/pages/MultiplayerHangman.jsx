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
  getDoc,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { HangmanDrawing } from './SingleHangman';
import './MultiplayerHangman.css';

const words = ['javascript', 'firebase', 'netlify', 'react', 'playpal'];

export default function MultiplayerHangman() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = auth.currentUser;

  const [friends, setFriends] = useState([]);
  const [waitingGameId, setWaitingGameId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [input, setInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [username, setUsername] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState('');

  // fetch current user's username
  useEffect(() => {
    if (!user) return navigate('/');
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUsername(snap.data().username);
    });
  }, [user, navigate]);

  // fetch friend list for challenges
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(snap => setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user]);

  // challenge a friend → create pending game & notification
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    const word = words[Math.floor(Math.random()*words.length)];
    await setDoc(doc(db,'hangman_games',id), {
      player1: user.uid,
      player2: friend.uid,
      currentTurn: user.uid,
      word,
      guesses: [],
      chat: [],
      status: 'pending',
      winner: '',
      createdAt: Timestamp.now()
    });
    await setDoc(doc(db, `users/${friend.uid}/notifications/${id}`), {
      type: 'hangman_invite',
      gameId: id,
      senderUid: user.uid,
      senderUsername: username,
      message: `🎮 @${username} challenged you to Hangman!`,
      timestamp: Timestamp.now()
    });
    setWaitingGameId(id);
  };

  // watch for pending → active when accepted
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(doc(db,'hangman_games',waitingGameId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === 'active') {
        navigate(`/hangman/multiplayer/${waitingGameId}`);
      }
    });
    return unsub;
  }, [waitingGameId, navigate]);

  // subscribe to game updates
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db,'hangman_games',gameId), snap => {
      if (!snap.exists()) {
        setGameData(null);
        return;
      }
      const data = snap.data();
      setGameData(data);
      if (data.status === 'finished') {
        setWinner(data.winner);
        setGameOver(true);
      }
    });
    return unsub;
  }, [gameId]);

  // make a guess
  const makeGuess = async () => {
    if (!input || gameOver || user.uid !== gameData.currentTurn) return;
    const letter = input.toLowerCase();
    if (gameData.guesses.includes(letter)) {
      setInput('');
      return;
    }
    const newGuesses = [...gameData.guesses, letter];
    // count only incorrect guesses
    const incorrectCount = newGuesses.filter(g => !gameData.word.includes(g)).length;
    let newStatus = 'active';
    let newWinner = '';
    let nextTurn = gameData.currentTurn === gameData.player1
      ? gameData.player2
      : gameData.player1;

    // win condition
    if (gameData.word.split('').every(l => newGuesses.includes(l))) {
      newStatus = 'finished';
      newWinner = user.uid;
    }
    // loss condition (draw)
    else if (incorrectCount >= 6) {
      newStatus = 'finished';
      newWinner = 'draw';
    }
    // correct guess → same player gets another turn
    else if (gameData.word.includes(letter)) {
      nextTurn = user.uid;
    }

    await updateDoc(doc(db,'hangman_games',gameId), {
      guesses: newGuesses,
      currentTurn: nextTurn,
      status: newStatus,
      winner: newWinner
    });
    setInput('');
  };

  // send a chat message
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db,'hangman_games',gameId), {
      chat: arrayUnion({
        sender: username,
        message: chatInput,
        timestamp: Date.now()
      })
    });
    setChatInput('');
  };

  // in‐place rematch
  const handleRematch = async () => {
    const newWord = words[Math.floor(Math.random()*words.length)];
    await updateDoc(doc(db,'hangman_games',gameId), {
      word: newWord,
      guesses: [],
      chat: [],
      status: 'active',
      winner: '',
      currentTurn: gameData.player1
    });
    setGameOver(false);
    setWinner('');
  };

  // quit and delete game
  const handleQuit = async () => {
    await deleteDoc(doc(db,'hangman_games',gameId));
    navigate('/dashboard');
  };

  // accept invite from dashboard
  const acceptInvite = async notif => {
    await updateDoc(doc(db,'hangman_games',notif.gameId), { status: 'active' });
    navigate(`/hangman/multiplayer/${notif.gameId}`);
  };

  // --- RENDER ---
  // 1) game screen
  if (gameData) {
    const incorrectCount = gameData.guesses.filter(g => !gameData.word.includes(g)).length;
    return (
      <div className="hangman-room">
        <h2>Multiplayer Hangman</h2>
        <p>
          Current Turn:{' '}
          {gameData.currentTurn === user.uid ? 'Your Turn' : "Opponent's Turn"}
        </p>

        <HangmanDrawing incorrectGuesses={incorrectCount} />
        <p>
          {gameData.word.split('').map(l =>
            gameData.guesses.includes(l) ? l : '_'
          ).join(' ')}
        </p>
        <p>Incorrect Guesses: {incorrectCount} / 6</p>

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
              {winner === 'draw'
                ? '💀 Game Draw!'
                : winner === user.uid
                ? '🎉 You Win!'
                : '😢 You Lose!'}
            </h3>
            <button onClick={handleRematch}>Rematch</button>
            <button onClick={handleQuit}>Quit</button>
          </>
        )}

        <div className="chatbox">
          <h4>Game Chat</h4>
          <div className="chat-messages">
            {gameData.chat.map((m,i) => (
              <p key={i}>
                <strong>{m.sender}</strong>: {m.message}
              </p>
            ))}
          </div>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Type a message…"
          />
          <button onClick={sendChat}>Send</button>
        </div>
      </div>
    );
  }

  // 2) challenge screen
  return (
    <div className="multiplayer-container">
      <h2>Challenge a Friend to Hangman</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : (
        friends.map(f => (
          <div key={f.uid} className="friend-row">
            <span>@{f.username}</span>
            <button onClick={() => handleChallenge(f)}>Challenge</button>
          </div>
        ))
      )}
      {waitingGameId && (
        <>
          <p>Waiting for friend to accept…</p>
          <button onClick={() => navigate('/dashboard')}>
            Cancel &amp; Back
          </button>
        </>
      )}
    </div>
  );
}
