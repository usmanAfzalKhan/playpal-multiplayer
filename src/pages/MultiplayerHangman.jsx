// src/pages/MultiplayerHangman.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { HangmanDrawing } from './SingleHangman';
import './MultiplayerHangman.css';

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

  // 1) Load friend list for challenge screen
  useEffect(() => {
    if (!user) return navigate('/');
    const fetchFriends = async () => {
      const snap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    };
    fetchFriends();
  }, [user, navigate]);

  // 2) Fetch my username
  useEffect(() => {
    if (!user) return;
    const loadMe = async () => {
      const meDoc = await getDoc(doc(db, 'users', user.uid));
      if (meDoc.exists()) setUsername(meDoc.data().username);
    };
    loadMe();
  }, [user]);

  // 3) Send a challenge
  const handleChallenge = async friend => {
    const id    = `${user.uid}_${friend.uid}_${Date.now()}`;
    const words = ['javascript','firebase','netlify','react','playpal'];
    const word  = words[Math.floor(Math.random()*words.length)];

    await setDoc(doc(db,'hangman_games',id), {
      player1:     user.uid,
      player2:     friend.uid,
      currentTurn: user.uid,
      word,
      guesses:     [],
      chat:        [],
      status:      'pending',
      winner:      '',
      createdAt:   Timestamp.now()
    });

    // notify friend
    await setDoc(doc(db,`users/${friend.uid}/notifications/${id}`), {
      type:           'hangman_invite',
      message:        `🎮 @${username} challenged you!`,
      gameId:         id,
      senderUid:      user.uid,
      senderUsername: username,
      timestamp:      Timestamp.now()
    });

    setWaitingGameId(id);
  };

  // 4) Watch for friend accepting (status → 'active')
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(
      doc(db,'hangman_games',waitingGameId),
      snap => {
        if (snap.exists() && snap.data().status === 'active') {
          navigate(`/hangman/multiplayer/${waitingGameId}`);
        }
      }
    );
    return () => unsub();
  }, [waitingGameId, navigate]);

  // 5) Subscribe to the live game if gameId in URL
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(
      doc(db,'hangman_games',gameId),
      snap => {
        if (!snap.exists()) return setGameData(null);
        const data = snap.data();
        setGameData(data);
        if (data.status === 'finished') {
          setWinner(data.winner);
          setGameOver(true);
        }
      }
    );
    return () => unsub();
  }, [gameId]);

  // 6) Make a letter guess
  const makeGuess = async () => {
    if (!input || gameOver || user.uid !== gameData.currentTurn) return;
    const letter      = input.toLowerCase();
    const newGuesses  = gameData.guesses.includes(letter)
      ? gameData.guesses
      : [...gameData.guesses, letter];
    const badCount    = gameData.word.split('').filter(l=>!newGuesses.includes(l)).length;
    const isWin       = gameData.word.split('').every(l=>newGuesses.includes(l));
    let   nextTurn    = gameData.currentTurn === gameData.player1
      ? gameData.player2
      : gameData.player1;
    let   newStatus   = 'active';
    let   newWinner   = '';

    if (isWin) {
      newStatus = 'finished';
      newWinner = user.uid;
    } else if (!gameData.word.includes(letter) && badCount >= 6) {
      newStatus = 'finished';
      newWinner = 'draw';
    } else if (gameData.word.includes(letter)) {
      nextTurn = user.uid;
    }

    await updateDoc(doc(db,'hangman_games',gameId), {
      guesses:     newGuesses,
      currentTurn: nextTurn,
      status:      newStatus,
      winner:      newWinner
    });

    setInput('');
  };

  // 7) Send a chat message
  const sendMessage = async () => {
    if (!chatInput) return;
    await updateDoc(doc(db,'hangman_games',gameId), {
      chat: arrayUnion({
        sender:    username,
        message:   chatInput,
        timestamp: Date.now()
      })
    });
    setChatInput('');
  };

  // 8) Rematch inside the game
  const handleRematch = async () => {
    const rematchId = `${gameId}_rematch`;
    await setDoc(doc(db,'hangman_games',rematchId), {
      player1:     gameData.player1,
      player2:     gameData.player2,
      currentTurn: gameData.player1,
      word:        gameData.word,
      guesses:     [],
      chat:        [],
      status:      'active',
      winner:      '',
      createdAt:   Timestamp.now()
    });
    navigate(`/hangman/multiplayer/${rematchId}`);
  };

  // ——— RENDER ———
  // A) live game view
  if (gameId && gameData) {
    const badCount = gameData.guesses.filter(g=>!gameData.word.includes(g)).length;

    return (
      <div className="hangman-room">
        <h2>Multiplayer Hangman</h2>
        <p>Current Turn: { gameData.currentTurn === user.uid ? 'Your Turn' : "Opponent's Turn" }</p>

        <HangmanDrawing incorrectGuesses={badCount} />

        <p>
          {gameData.word
            .split('')
            .map(l => (gameData.guesses.includes(l) ? l : '_'))
            .join(' ')}
        </p>
        <p>Incorrect Guesses: {badCount} / 6</p>

        {!gameOver ? (
          gameData.currentTurn === user.uid ? (
            <>
              <input
                value={input}
                maxLength="1"
                onChange={e=>setInput(e.target.value)}
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
            <button onClick={()=>navigate('/dashboard')}>Quit</button>
          </>
        )}

        <div className="chatbox">
          <h4>Game Chat</h4>
          <div className="chat-messages">
            {gameData.chat.map((m,i)=>(
              <p key={i}><strong>{m.sender}:</strong> {m.message}</p>
            ))}
          </div>
          <input
            value={chatInput}
            onChange={e=>setChatInput(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    );
  }

  // B) challenge-your-friend view
  return (
    <div className="multiplayer-container">
      <h2>Challenge a Friend to Hangman</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : (
        friends.map(f => (
          <div key={f.uid} className="friend-item">
            @{f.username}
            <button onClick={()=>handleChallenge(f)}>Challenge</button>
          </div>
        ))
      )}

      {waitingGameId && (
        <>
          <p>Waiting for friend to accept…</p>
          <button onClick={()=>navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </>
      )}
    </div>
  );
}
