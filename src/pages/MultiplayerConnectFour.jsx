// src/pages/MultiplayerConnectFour.jsx
import './ConnectFour.css';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';

const COLS = 7;
const ROWS = 6;
const SIZE = ROWS * COLS;
// flat empty board
const initialBoard = Array(SIZE).fill(null);

// all winning lines (flat indices)
const WIN_LINES = (() => {
  const lines = [];
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      lines.push([0,1,2,3].map(i => r * COLS + c + i));
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      lines.push([0,1,2,3].map(i => (r + i) * COLS + c));
    }
  }
  // diag ↘
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      lines.push([0,1,2,3].map(i => (r + i) * COLS + c + i));
    }
  }
  // diag ↙
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      lines.push([0,1,2,3].map(i => (r + i) * COLS + c - i));
    }
  }
  return lines;
})();

// returns { winner: 'R'|'Y'|null, line: [idx,...] }
function getWinnerInfo(board) {
  for (let line of WIN_LINES) {
    const [a,b,c,d] = line;
    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c] &&
      board[a] === board[d]
    ) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

export default function MultiplayerConnectFour() {
  const { gameId }   = useParams();
  const navigate     = useNavigate();
  const user         = auth.currentUser;
  const [username, setUsername] = useState('');
  const [friends, setFriends]   = useState([]);
  const [waitingGameId, setWaiting] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // fetch my username
  useEffect(() => {
    if (!user) return navigate('/');
    getDoc(doc(db, 'users', user.uid))
      .then(snap => { if (snap.exists()) setUsername(snap.data().username); });
  }, [user, navigate]);

  // load friends
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(s => setFriends(s.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user]);

  // send challenge
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    // flat board
    await setDoc(doc(db, 'connect4_games', id), {
      player1:     user.uid,
      player2:     friend.uid,
      currentTurn: user.uid,
      board:       initialBoard,
      status:      'pending',
      winner:      '',
      chat:        [],
      createdAt:   Timestamp.now()
    });
    await setDoc(
      doc(db, `users/${friend.uid}/notifications/${id}`),
      {
        type:           'connect4_invite',
        gameId:         id,
        senderUid:      user.uid,
        senderUsername: username,
        message:        `🎮 @${username} challenged you to Connect Four!`,
        timestamp:      Timestamp.now()
      }
    );
    setWaiting(id);
  };

  // watch for pending→active
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(
      doc(db, 'connect4_games', waitingGameId),
      snap => {
        if (snap.exists() && snap.data().status === 'active') {
          navigate(`/connect4/multiplayer/${waitingGameId}`);
        }
      }
    );
    return unsub;
  }, [waitingGameId, navigate]);

  // subscribe to game doc
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(
      doc(db, 'connect4_games', gameId),
      snap => {
        if (!snap.exists()) {
          setGameData(null);
        } else {
          setGameData({ id: snap.id, ...snap.data() });
        }
      }
    );

    // Cleanup: unsubscribe and delete the game if user leaves without clicking Quit
    return () => {
      unsub();
      deleteDoc(doc(db, 'connect4_games', gameId))
        .catch(() => { /* ignore if already deleted */ });
    };
  }, [gameId]);

  // make a move
  const makeMove = async col => {
    if (!gameData || gameData.status !== 'active') return;
    if (gameData.currentTurn !== user.uid) return;

    // find drop row
    const board = [...gameData.board];
    let dropIdx = null;
    for (let r = ROWS - 1; r >= 0; r--) {
      const idx = r * COLS + col;
      if (!board[idx]) {
        dropIdx = idx;
        break;
      }
    }
    if (dropIdx === null) return;

    board[dropIdx] = gameData.player1 === user.uid ? 'R' : 'Y';

    const { winner } = getWinnerInfo(board);
    const isDraw = winner === null && board.every(c => c);
    const nextTurn = winner || isDraw
      ? null
      : (gameData.currentTurn === gameData.player1
          ? gameData.player2
          : gameData.player1);

    await updateDoc(doc(db, 'connect4_games', gameId), {
      board,
      currentTurn: nextTurn,
      status: winner || isDraw ? 'finished' : 'active',
      winner: winner === 'R'
        ? gameData.player1
        : winner === 'Y'
          ? gameData.player2
          : (isDraw ? 'draw' : '')
    });
  };

  // chat, rematch, quit...
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db, 'connect4_games', gameId), {
      chat: arrayUnion({
        sender:    username,
        message:   chatInput,
        timestamp: Timestamp.now()
      })
    });
    setChatInput('');
  };
  const handleRematch = async () => {
    await updateDoc(doc(db, 'connect4_games', gameId), {
      board:       initialBoard,
      status:      'active',
      winner:      '',
      currentTurn: gameData.player1,
      chat:        []
    });
  };
  const handleQuit = async () => {
    await deleteDoc(doc(db, 'connect4_games', gameId));
    navigate('/dashboard');
  };
  const acceptInvite = async notif => {
    await updateDoc(
      doc(db, `connect4_games/${notif.gameId}`),
      { status: 'active' }
    );
    navigate(`/connect4/multiplayer/${notif.gameId}`);
  };

  // RENDER
  if (gameData) {
    const { winner, line } = getWinnerInfo(gameData.board);
    return (
      <div className="c4-container">
        <h2>Multiplayer Connect Four</h2>
        <p className="c4-status">
          {gameData.status === 'pending'
            ? 'Waiting for opponent…'
            : gameData.status === 'active'
              ? (gameData.currentTurn === user.uid ? 'Your turn' : "Opponent's turn")
              : winner === 'draw'
                ? 'Draw!'
                : (winner === (user.uid === gameData.player1 ? 'R' : 'Y')
                    ? 'You Win!'
                    : 'You Lose!')}
        </p>

        <div className="c4-board">
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: COLS }).map((_, c) => {
              const idx = r * COLS + c;
              const cell = gameData.board[idx];
              const highlight = line?.includes(idx);
              return (
                <div
                  key={idx}
                  className="c4-cell"
                  onClick={() => r === 0 && makeMove(c)}
                >
                  {cell && (
                    <div className={`disc ${cell==='R'?'red':'yellow'} ${highlight?'highlight':''}`} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {gameData.status === 'active' && (
          <div className="chatbox">
            <h4>Game Chat</h4>
            <div className="chat-messages">
              {gameData.chat.map((m,i) => (
                <p key={i}><strong>{m.sender}:</strong> {m.message}</p>
              ))}
            </div>
            <div className="chat-input">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message…"
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        )}

        {gameData.status === 'finished' && (
          <div className="c4-actions">
            <button onClick={handleRematch}>Rematch</button>
            <button onClick={handleQuit}>Quit</button>
          </div>
        )}
      </div>
    );
  }

  // challenge screen
  return (
    <div className="c4-container">
      <h2>Challenge a Friend to Connect Four</h2>
      {friends.length === 0
        ? <p>No friends to challenge.</p>
        : friends.map(f => (
            <div key={f.uid} className="friend-row">
              <span>@{f.username}</span>
              <button onClick={() => handleChallenge(f)}>Challenge</button>
            </div>
          ))
      }
      {waitingGameId && (
        <>
          <p>Waiting for friend to accept…</p>
          <button onClick={() => navigate('/dashboard')}>Cancel &amp; Back</button>
        </>
      )}
    </div>
  );
}
