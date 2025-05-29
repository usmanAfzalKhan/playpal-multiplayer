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
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;
const makeEmpty = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const DIRECTIONS = [
  { dr: 0, dc: 1 }, { dr: 1, dc: 0 },
  { dr: 1, dc: 1 }, { dr: 1, dc: -1 },
];

// scan board for 4-in-a-row
function getWinnerInfo(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (let { dr, dc } of DIRECTIONS) {
        const line = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (
            nr < 0 || nr >= ROWS ||
            nc < 0 || nc >= COLS ||
            board[nr][nc] !== p
          ) {
            line.length = 0;
            break;
          }
          line.push([nr, nc]);
        }
        if (line.length === 4) return { winner: p, line };
      }
    }
  }
  return { winner: null, line: null };
}

// helper to find drop row in column
function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return null;
}

export default function MultiplayerConnectFour() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [username, setUsername] = useState('');
  const [friends, setFriends] = useState([]);
  const [waiting, setWaiting] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [chatInput, setChatInput] = useState('');

  // load our username & friend list
  useEffect(() => {
    if (!user) return navigate('/');
    (async () => {
      const us = await getDocs(
        query(collection(db, 'users'),
              where('__name__', '==', user.uid))
      );
      setUsername(us.docs[0].data().username);
      const fs = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(fs.docs.map(d => ({ uid: d.id, ...d.data() })));
    })();
  }, [user, navigate]);

  // challenge a friend → create pending game + notif
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db, 'connect4_games', id), {
      player1: user.uid,
      player2: friend.uid,
      currentTurn: user.uid,
      board: makeEmpty(),
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
        senderUsername: username,
        message: `🎮 @${username} challenged you to Connect Four!`,
        timestamp: Timestamp.now()
      }
    );
    setWaiting(id);
  };

  // watch for pending → active when accepted
  useEffect(() => {
    if (!waiting) return;
    const unsub = onSnapshot(
      doc(db, 'connect4_games', waiting),
      snap => {
        if (snap.exists() && snap.data().status === 'active') {
          navigate(`/connect4/multiplayer/${waiting}`);
        }
      }
    );
    return unsub;
  }, [waiting, navigate]);

  // subscribe to game document
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

  // drop a disc for current player
  const makeMove = async col => {
    if (!gameData || gameData.status !== 'active') return;
    if (gameData.currentTurn !== user.uid) return;
    const board = gameData.board.map(r => [...r]);
    const row = dropRow(board, col);
    if (row === null) return;
    board[row][col] = user.uid === gameData.player1 ? 'R' : 'Y';
    const { winner } = getWinnerInfo(board);
    const isDraw = board.every(r => r.every(c => c !== null));
    const nextTurn = winner || isDraw
      ? null
      : (gameData.currentTurn === gameData.player1
          ? gameData.player2
          : gameData.player1);

    await updateDoc(doc(db, 'connect4_games', gameId), {
      board,
      currentTurn: nextTurn,
      status: winner || isDraw ? 'finished' : 'active',
      winner: winner
        ? (winner === 'R' ? gameData.player1 : gameData.player2)
        : (isDraw ? 'draw' : '')
    });
  };

  // send chat message
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db, 'connect4_games', gameId), {
      chat: arrayUnion({
        sender: username,
        message: chatInput,
        timestamp: Timestamp.now()
      })
    });
    setChatInput('');
  };

  // rematch & quit
  const handleRematch = async () => {
    await updateDoc(doc(db, 'connect4_games', gameId), {
      board: makeEmpty(),
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

  // --- render ---

  // in-game view
  if (gameData) {
    const { winner, line } = getWinnerInfo(gameData.board);
    return (
      <div className="c4-container">
        <h2>Multiplayer Connect Four</h2>
        <p className="c4-status">
          {gameData.status === 'pending'
            ? 'Waiting for opponent…'
            : gameData.status === 'active'
              ? (gameData.currentTurn === user.uid
                  ? 'Your turn'
                  : "Opponent's turn")
              : (gameData.winner === 'draw'
                  ? 'Draw!'
                  : (gameData.winner === user.uid
                      ? 'You Win!'
                      : 'You Lose!'))}
        </p>

        <div className="c4-board">
          {line && <div className={`c4-strike ${getStrikeClass(line)}`} />}
          {gameData.board.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="c4-cell"
                onClick={() => r === 0 && makeMove(c)}
                style={{ cursor: gameData.status==='active' && gameData.currentTurn===user.uid && dropRow(gameData.board, c)!==null ? 'pointer' : 'default' }}
              >
                {cell && <div className={`disc ${cell==='R'?'red':'yellow'}`} />}
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

  // challenge-screen
  return (
    <div className="c4-container">
      <h2>Challenge a Friend to Connect Four</h2>
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
      {waiting && (
        <>
          <p>Waiting for friend to accept…</p>
          <button onClick={() => navigate('/dashboard')}>Cancel &amp; Back</button>
        </>
      )}
    </div>
  );
}

// map winning line to a CSS class
function getStrikeClass(line) {
  const [[r0, c0], [r1, c1]] = line;
  if (r0 === r1) return `strike-row-${r0}`;
  if (c0 === c1) return `strike-col-${c0}`;
  const dr = r1 - r0, dc = c1 - c0;
  return dr === dc ? 'strike-diag-main' : 'strike-diag-anti';
}
