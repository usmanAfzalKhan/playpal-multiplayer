import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import './ConnectFour.css';

const ROWS = 6;
const COLS = 7;
const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

export default function MultiplayerConnectFour() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = auth.currentUser;

  const [friends, setFriends] = useState([]);
  const [waiting, setWaiting] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // ----- WIN / DROP LOGIC -----
  const checkWin = (g) => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = g[r][c];
        if (!cell) continue;
        if (
          c <= COLS - 4 &&
          cell === g[r][c + 1] &&
          cell === g[r][c + 2] &&
          cell === g[r][c + 3]
        )
          return cell;
        if (
          r <= ROWS - 4 &&
          cell === g[r + 1][c] &&
          cell === g[r + 2][c] &&
          cell === g[r + 3][c]
        )
          return cell;
        if (
          r <= ROWS - 4 &&
          c <= COLS - 4 &&
          cell === g[r + 1][c + 1] &&
          cell === g[r + 2][c + 2] &&
          cell === g[r + 3][c + 3]
        )
          return cell;
        if (
          r >= 3 &&
          c <= COLS - 4 &&
          cell === g[r - 1][c + 1] &&
          cell === g[r - 2][c + 2] &&
          cell === g[r - 3][c + 3]
        )
          return cell;
      }
    }
    return null;
  };

  const dropDisc = (g, col, color) => {
    const newGrid = g.map((row) => row.slice());
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newGrid[r][col]) {
        newGrid[r][col] = color;
        break;
      }
    }
    return newGrid;
  };

  // ----- LOAD FRIENDS -----
  useEffect(() => {
    if (!user) return navigate('/');
    getDocs(collection(db, `users/${user.uid}/friends`)).then((snap) =>
      setFriends(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    );
  }, [user, navigate]);

  // ----- CHALLENGE -----
  const handleChallenge = async (friend) => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db, 'connect4_games', id), {
      player1: user.uid,
      player2: friend.uid,
      currentTurn: user.uid,
      grid: emptyGrid,
      status: 'pending',
      winner: '',
      chat: [],
      createdAt: Timestamp.now()
    });
    await setDoc(
      doc(db, `users/${friend.uid}/notifications/${id}`),
      {
        type: 'connect4_invite',
        gameId: id,
        senderUid: user.uid,
        senderUsername: friend.username, // or fetch yours
        message: `🎮 @${user.displayName} challenged you to Connect Four!`,
        timestamp: Timestamp.now()
      }
    );
    setWaiting(id);
  };

  // ----- WAIT → ACTIVE -----
  useEffect(() => {
    if (!waiting) return;
    const unsub = onSnapshot(doc(db, 'connect4_games', waiting), (snap) => {
      const data = snap.data();
      if (data?.status === 'active') {
        navigate(`/connect4/${waiting}`);
      }
    });
    return unsub;
  }, [waiting, navigate]);

  // ----- SUBSCRIBE GAME -----
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(
      doc(db, 'connect4_games', gameId),
      (snap) => {
        if (!snap.exists()) return setGameData(null);
        setGameData({ id: snap.id, ...snap.data() });
      }
    );
    return unsub;
  }, [gameId]);

  // ----- MOVE -----
  const makeMove = async (col) => {
    if (!gameData || gameData.status !== 'active') return;
    if (gameData.currentTurn !== user.uid) return;
    if (gameData.grid[0][col]) return;

    const color = user.uid === gameData.player1 ? 'R' : 'Y';
    const after = dropDisc(gameData.grid, col, color);
    const win = checkWin(after);
    const isDraw = after[0].every((c) => c !== null);

    await updateDoc(doc(db, 'connect4_games', gameId), {
      grid: after,
      currentTurn:
        win || isDraw
          ? null
          : gameData.currentTurn === gameData.player1
          ? gameData.player2
          : gameData.player1,
      status: win || isDraw ? 'finished' : 'active',
      winner: win
        ? user.uid
        : isDraw
        ? 'draw'
        : ''
    });
  };

  // ----- CHAT -----
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db, 'connect4_games', gameId), {
      chat: arrayUnion({
        sender: user.displayName || 'You',
        message: chatInput,
        timestamp: Timestamp.now()
      })
    });
    setChatInput('');
  };

  // ----- REMATCH & QUIT -----
  const handleRematch = async () => {
    await updateDoc(doc(db, 'connect4_games', gameId), {
      grid: emptyGrid,
      status: 'active',
      winner: '',
      currentTurn: gameData.player1,
      chat: []
    });
  };
  const handleQuit = async () => {
    await deleteDoc(doc(db, 'connect4_games', gameId));
    navigate('/dashboard');
  };

  // ----- ACCEPT FROM DASHBOARD -----
  const acceptInvite = async (notif) => {
    await updateDoc(doc(db, 'connect4_games', notif.gameId), { status: 'active' });
    navigate(`/connect4/${notif.gameId}`);
  };

  // ----- RENDER -----
  if (gameData) {
    const winColor = checkWin(gameData.grid);
    const youAre = user.uid === gameData.player1 ? 'R' : 'Y';
    return (
      <div className="cf-container">
        <h2>Multiplayer Connect Four</h2>
        <p className="cf-status">
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
        <div className="cf-board">
          {gameData.grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className={`cf-cell ${cell === 'R' ? 'red' : cell === 'Y' ? 'yellow' : ''}`}
                onClick={() => makeMove(c)}
              />
            ))
          )}
        </div>
        {gameData.status === 'active' && (
          <div className="chatbox">
            <h4>Game Chat</h4>
            <div className="chat-messages">
              {gameData.chat.map((m, i) => (
                <p key={i}>
                  <strong>{m.sender}:</strong> {m.message}
                </p>
              ))}
            </div>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message…"
            />
            <button onClick={sendChat}>Send</button>
          </div>
        )}
        {gameData.status === 'finished' && (
          <div className="ttt-actions">
            <button onClick={handleRematch}>Rematch</button>
            <button onClick={handleQuit}>Quit</button>
          </div>
        )}
      </div>
    );
  }

  // challenge screen
  return (
    <div className="cf-container">
      <h2>Challenge a Friend to Connect Four</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : (
        friends.map((f) => (
          <div key={f.uid} className="friend-row">
            <span>@{f.username}</span>
            <button onClick={() => handleChallenge(f)}>Challenge</button>
          </div>
        ))
      )}
      {waiting && (
        <>
          <p>Waiting for friend to accept…</p>
          <button onClick={() => navigate('/dashboard')}>Cancel &amp; Back</button>
        </>
      )}
    </div>
  );
}
