// src/pages/MultiplayerBattleship.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import './Battleship.css';

const GRID_SIZE = 10;
const SHIP_SIZES = [5, 4, 3, 3, 2];

function generateEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ hasShip: false, hit: false }))
  );
}

function placeShipsRandomly(grid) {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  SHIP_SIZES.forEach(size => {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      let fits = true;
      for (let i = 0; i < size; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        if (r >= GRID_SIZE || c >= GRID_SIZE || newGrid[r][c].hasShip) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let i = 0; i < size; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        newGrid[r][c].hasShip = true;
      }
      placed = true;
    }
  });
  return newGrid;
}

export default function MultiplayerBattleship() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [username, setUsername] = useState('');
  const [friends, setFriends] = useState([]);
  const [waitingId, setWaitingId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // fetch my username and friends
  useEffect(() => {
    if (!user) return navigate('/');
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setUsername(snap.data().username);
    });
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(snap => setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user, navigate]);

  // challenge a friend
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    const boardA = generateEmptyGrid();
    const boardB = generateEmptyGrid();
    await setDoc(doc(db, 'battleship_games', id), {
      playerA:     user.uid,
      playerB:     friend.uid,
      currentTurn: user.uid,
      boardA,
      boardB,
      status:      'pending',
      winner:      '',
      chat:        [],
      createdAt:   Timestamp.now()
    });
    await setDoc(doc(db, `users/${friend.uid}/notifications/${id}`), {
      type:           'battleship_invite',
      gameId:         id,
      senderUid:      user.uid,
      senderUsername: username,
      message:        `🚢 @${username} challenged you to Battleship!`,
      timestamp:      Timestamp.now()
    });
    setWaitingId(id);
  };

  // wait for invite acceptance
  useEffect(() => {
    if (!waitingId) return;
    const unsub = onSnapshot(doc(db, 'battleship_games', waitingId), snap => {
      if (snap.exists() && snap.data().status === 'active') {
        navigate(`/battleship/multiplayer/${waitingId}`);
      }
    });
    return unsub;
  }, [waitingId, navigate]);

  // subscribe to game updates
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'battleship_games', gameId), snap => {
      setGameData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return unsub;
  }, [gameId]);

  // count remaining ship cells
  const countRemaining = grid =>
    grid.flat().filter(cell => cell.hasShip && !cell.hit).length;

  // fire at opponent
  const handleFire = async (r, c) => {
    if (!gameData || gameData.status !== 'active') return;
    if (gameData.currentTurn !== user.uid) return;
    const isA = user.uid === gameData.playerA;
    const targetKey = isA ? 'boardB' : 'boardA';
    const board = gameData[targetKey];
    if (board[r][c].hit) return;

    const nextBoard = board.map(row => row.map(cell => ({ ...cell })));
    nextBoard[r][c].hit = true;

    const allSunk = g => g.flat().filter(c => c.hasShip).every(c => c.hit);
    const sunk = allSunk(nextBoard);
    const nextStatus = sunk ? 'finished' : 'active';
    const nextWinner = sunk ? user.uid : '';
    const nextTurn = sunk
      ? null
      : (gameData.currentTurn === gameData.playerA
          ? gameData.playerB
          : gameData.playerA);

    await updateDoc(doc(db, 'battleship_games', gameId), {
      [targetKey]:   nextBoard,
      currentTurn:   nextTurn,
      status:        nextStatus,
      winner:        nextWinner
    });
  };

  // rematch with fresh boards
  const handleRematch = async () => {
    const boardA = generateEmptyGrid();
    const boardB = generateEmptyGrid();
    await updateDoc(doc(db, 'battleship_games', gameId), {
      boardA,
      boardB,
      status:      'active',
      winner:      '',
      currentTurn: gameData.playerA,
      chat:        []
    });
  };

  // quit to dashboard & delete game
  const handleQuit = async () => {
    if (gameId) await deleteDoc(doc(db, 'battleship_games', gameId));
    navigate('/dashboard');
  };

  // send chat message
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db, 'battleship_games', gameId), {
      chat: arrayUnion({
        sender:    username,
        message:   chatInput,
        timestamp: Timestamp.now()
      })
    });
    setChatInput('');
  };

  // render a grid
  const renderGrid = (grid, onClickCell, hideShips = false) => (
    <div className="battleship-grid">
      {grid.map((row, r) =>
        row.map((cell, c) => {
          let cls = 'unclicked';
          if (cell.hit) cls = cell.hasShip ? 'hit' : 'miss';
          const showShip = cell.hasShip && !hideShips;
          return (
            <div
              key={`${r}-${c}`}
              className={`${cls}${showShip ? ' ship' : ''}`}
              onClick={() => onClickCell(r, c)}
            />
          );
        })
      )}
    </div>
  );

  // GAME SCREEN
  if (gameData) {
    const {
      playerA, playerB, currentTurn,
      boardA, boardB, status, winner, chat
    } = gameData;
    const isA = user.uid === playerA;
    const myBoard  = isA ? boardA : boardB;
    const oppBoard = isA ? boardB : boardA;
    const shipsLeftMe  = countRemaining(myBoard);
    const shipsLeftOpp = countRemaining(oppBoard);

    let statusText = '';
    if (status === 'pending') {
      statusText = 'Waiting for opponent to join...';
    } else if (status === 'active') {
      statusText = currentTurn === user.uid ? 'Your turn' : "Opponent's turn";
    } else if (status === 'finished') {
      statusText = winner === 'draw'
        ? "It's a draw!"
        : winner === user.uid
          ? 'You win!'
          : 'You lose!';
    }

    return (
      <div className="battleship-container">
        <h2>Multiplayer Battleship</h2>
        <p className="explanation">
          Click a square in <strong>Enemy Waters</strong> to fire.  
          🔴 = hit 🔵 = miss. Chat below with your opponent.
        </p>
        <p className="status">{statusText}</p>
        <div className="status-bar">
          <span>Your ships remaining: {shipsLeftMe}</span>
          <span>Enemy ships remaining: {shipsLeftOpp}</span>
        </div>
        <div className="battleship-boards">
          <div>
            <h3>Your Board</h3>
            {renderGrid(myBoard, () => {}, false)}
          </div>
          <div>
            <h3>Enemy Waters</h3>
            {renderGrid(oppBoard, handleFire, true)}
          </div>
        </div>
        <div className="controls">
          {status === 'finished' && (
            <button onClick={handleRematch}>▶️ Play Again</button>
          )}
          <button onClick={handleQuit}>❌ Quit to Dashboard</button>
        </div>
        <div className="chatbox">
          <h4>Game Chat</h4>
          <div className="chat-messages">
            {chat.map((m, i) => (
              <p key={i}>
                <strong>{m.sender}:</strong> {m.message}
              </p>
            ))}
          </div>
          {status === 'active' && (
            <div className="chat-input">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message…"
              />
              <button onClick={sendChat}>Send</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CHALLENGE SCREEN
  return (
    <div className="battleship-container">
      <h2>Challenge a Friend to Battleship</h2>
      <p className="explanation">
        Select a friend below to start a game. They’ll get an invite.
      </p>
      {friends.length === 0
        ? <p>You have no friends to challenge.</p>
        : friends.map(f => (
            <div key={f.uid} className="friend-row">
              <span>@{f.username}</span>
              <button onClick={() => handleChallenge(f)}>
                Challenge
              </button>
            </div>
          ))
      }
      {waitingId && (
        <>
          <p>Waiting for acceptance…</p>
          <button onClick={() => navigate('/dashboard')}>
            ❌ Cancel & Back
          </button>
        </>
      )}
    </div>
  );
}
