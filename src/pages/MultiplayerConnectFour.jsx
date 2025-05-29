// src/pages/MultiplayerConnectFour.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;
const CELLS = ROWS * COLS;

// produce a flat array of length 42
const makeEmptyBoard = () => Array(CELLS).fill(null);

export default function MultiplayerConnectFour() {
  const { gameId } = useParams();
  const navigate    = useNavigate();
  const user        = auth.currentUser;
  const [username, setUsername]     = useState('');
  const [friends, setFriends]       = useState([]);
  const [waitingGameId, setWaiting] = useState(null);
  const [gameData, setGameData]     = useState(null);
  const [chatInput, setChatInput]   = useState('');

  // fetch my username
  useEffect(() => {
    if (!user) return navigate('/');
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUsername(snap.data().username);
    });
  }, [user, navigate]);

  // load friends
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(snap => setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user]);

  // send challenge → pending game + notification
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db, 'connect4_games', id), {
      player1:     user.uid,
      player2:     friend.uid,
      currentTurn: user.uid,
      board:       makeEmptyBoard(),
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

  // watch pending→active
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

  // subscribe game doc
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
    return unsub;
  }, [gameId]);

  // send chat
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

  // accept invite from dashboard
  const acceptInvite = async notif => {
    await updateDoc(doc(db, 'connect4_games', notif.gameId), { status: 'active' });
    navigate(`/connect4/multiplayer/${notif.gameId}`);
  };

  // rematch
  const handleRematch = async () => {
    await updateDoc(doc(db, 'connect4_games', gameId), {
      board:       makeEmptyBoard(),
      status:      'active',
      winner:      '',
      currentTurn: gameData.player1,
      chat:        []
    });
  };

  // quit & remove
  const handleQuit = async () => {
    await deleteDoc(doc(db, 'connect4_games', gameId));
    navigate('/dashboard');
  };

  // make move (drop in column c)
  const makeMove = async c => {
    if (!gameData || gameData.status !== 'active') return;
    const flat = [...gameData.board];
    // find lowest empty row in this column
    let r = ROWS - 1;
    while (r >= 0 && flat[r * COLS + c] !== null) r--;
    if (r < 0) return;
    flat[r * COLS + c] = (user.uid === gameData.player1 ? 'R' : 'Y');
    // check win/draw
    const info = getWinnerInfo(flat);
    const nextTurn = info.winner || flat.every(cell => cell !== null)
      ? null
      : (gameData.currentTurn === gameData.player1
          ? gameData.player2
          : gameData.player1);
    await updateDoc(doc(db, 'connect4_games', gameId), {
      board:       flat,
      currentTurn: nextTurn,
      status:      info.winner || flat.every(cell => cell !== null)
                    ? 'finished'
                    : 'active',
      winner:      info.winner === 'R'
                    ? gameData.player1
                    : info.winner === 'Y'
                      ? gameData.player2
                      : (flat.every(cell => cell !== null) ? 'draw' : '')
    });
  };

  // --- RENDER ---

  // inside a game
  if (gameData) {
    const { winner, line } = getWinnerInfo(gameData.board);
    // chunk flat board into rows
    const grid = [];
    for (let i = 0; i < ROWS; i++) {
      grid.push(gameData.board.slice(i * COLS, i * COLS + COLS));
    }

    return (
      <div className="c4-container">
        <h2>Multiplayer Connect Four</h2>
        <p className="c4-status">
          {gameData.status === 'pending'
            ? 'Waiting for opponent…'
            : gameData.status === 'active'
              ? gameData.currentTurn === user.uid
                ? 'Your turn'
                : "Opponent's turn"
              : gameData.winner === 'draw'
                ? 'Draw!'
                : gameData.winner === user.uid
                  ? 'You Win!'
                  : 'You Lose!'}
        </p>

        <div className="c4-board">
          {line && <div className={`c4-strike ${getStrikeClass(line)}`} />}
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="c4-cell"
                onClick={() => {
                  if (
                    gameData.status === 'active' &&
                    gameData.currentTurn === user.uid &&
                    r === 0
                  ) makeMove(c);
                }}
              >
                {cell && <div className={`disc ${cell === 'R' ? 'red' : 'yellow'}`} />}
              </div>
            ))
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
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : friends.map(f => (
        <div key={f.uid} className="friend-row">
          <span>@{f.username}</span>
          <button onClick={() => handleChallenge(f)}>Challenge</button>
        </div>
      ))}
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

// ─── Helpers ─────────────────────────────────────────────────

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
];

// scan flat array of length 42 for a connect-4
function getWinnerInfo(flat) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = flat[r * COLS + c];
      if (!p) continue;
      for (let { dr, dc } of DIRECTIONS) {
        let line = [[r,c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr*i, nc = c + dc*i;
          if (
            nr < 0 || nr >= ROWS ||
            nc < 0 || nc >= COLS ||
            flat[nr * COLS + nc] !== p
          ) {
            line = [];
            break;
          }
          line.push([nr,nc]);
        }
        if (line.length === 4) return { winner: p, line };
      }
    }
  }
  return { winner: null, line: null };
}

function getStrikeClass([[r0,c0],[r1,c1]]) {
  if (r0 === r1)      return `strike-row-${r0}`;
  if (c0 === c1)      return `strike-col-${c0}`;
  if (r1 - r0 === c1 - c0) return 'strike-diag-main';
  return 'strike-diag-anti';
}
