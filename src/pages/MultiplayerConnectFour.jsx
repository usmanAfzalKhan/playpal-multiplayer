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
const makeEmptyBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

// scan for a winner + the winning line
function getWinnerInfo(board) {
  const dirs = [
    [0,1], [1,0], [1,1], [1,-1]
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (let [dr,dc] of dirs) {
        const line = [[r,c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (
            nr < 0 || nr >= ROWS ||
            nc < 0 || nc >= COLS ||
            board[nr][nc] !== p
          ) {
            break;
          }
          line.push([nr,nc]);
        }
        if (line.length === 4) {
          return { winner: p, line };
        }
      }
    }
  }
  return { winner: null, line: null };
}

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
    getDoc(doc(db,'users',user.uid)).then(snap => {
      if (snap.exists()) setUsername(snap.data().username);
    });
  },[user,navigate]);

  // load friends
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db,`users/${user.uid}/friends`))
      .then(s => setFriends(s.docs.map(d=>({uid:d.id,...d.data()}))));
  },[user]);

  // send challenge
  const handleChallenge = async friend => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db,'connect4_games',id),{
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
      doc(db,`users/${friend.uid}/notifications/${id}`),
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
      doc(db,'connect4_games',waitingGameId),
      snap => {
        if (snap.exists() && snap.data().status==='active') {
          navigate(`/connect4/multiplayer/${waitingGameId}`);
        }
      }
    );
    return unsub;
  },[waitingGameId,navigate]);

  // subscribe to game state
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(
      doc(db,'connect4_games',gameId),
      snap => {
        if (!snap.exists()) {
          setGameData(null);
        } else {
          setGameData({ id: snap.id, ...snap.data() });
        }
      }
    );
    return unsub;
  },[gameId]);

  // make a move
  const makeMove = async col => {
    if (!gameData || gameData.status!=='active' || gameData.currentTurn!==user.uid) return;
    // find drop row
    const board = gameData.board.map(r=>[...r]);
    for (let r = ROWS-1; r>=0; r--) {
      if (!board[r][col]) {
        board[r][col] = user.uid===gameData.player1 ? 'R' : 'Y';
        break;
      }
    }
    const { winner } = getWinnerInfo(board);
    const next = winner || board.every(row=>row.every(cell=>cell))
      ? null
      : (gameData.currentTurn===gameData.player1
         ? gameData.player2
         : gameData.player1);

    await updateDoc(doc(db,'connect4_games',gameId),{
      board,
      currentTurn: next,
      status: winner||board.every(r=>r.every(c=>c)) ? 'finished' : 'active',
      winner: winner==='R'
        ? gameData.player1
        : winner==='Y'
          ? gameData.player2
          : (board.every(r=>r.every(c=>c)) ? 'draw' : '')
    });
  };

  // chat, rematch, quit, accept…
  const sendChat     = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db,'connect4_games',gameId),{
      chat: arrayUnion({ sender: username, message: chatInput, timestamp: Timestamp.now() })
    });
    setChatInput('');
  };
  const handleRematch = async () => {
    await updateDoc(doc(db,'connect4_games',gameId),{
      board:       makeEmptyBoard(),
      status:      'active',
      winner:      '',
      currentTurn: gameData.player1,
      chat:        []
    });
  };
  const handleQuit   = async () => {
    await deleteDoc(doc(db,'connect4_games',gameId));
    navigate('/dashboard');
  };
  const acceptInvite = async notif => {
    await updateDoc(doc(db,`connect4_games/${notif.gameId}`),{ status:'active' });
    navigate(`/connect4/multiplayer/${notif.gameId}`);
  };

  // inside-a-game UI
  if (gameData) {
    const { winner, line } = getWinnerInfo(gameData.board);
    return (
      <div className="c4-container">
        <h2>Multiplayer Connect Four</h2>
        <p className="c4-status">
          {gameData.status==='pending'
            ? 'Waiting…'
            : gameData.status==='active'
              ? (gameData.currentTurn===user.uid ? 'Your turn' : "Opponent's turn")
              : winner==='draw'
                ? 'Draw!'
                : winner=== (user.uid===gameData.player1?'R':'Y')
                  ? 'You Win!'
                  : 'You Lose!'}
        </p>

        <div className="c4-board">
          {gameData.board.map((row,r) =>
            row.map((cell,c) => {
              const isHighlight = line?.some(([rr,cc]) => rr===r && cc===c);
              return (
                <div
                  key={`${r}-${c}`}
                  className="c4-cell"
                  onClick={() => r===0 && makeMove(c)}
                >
                  {cell && (
                    <div
                      className={`disc ${
                        cell==='R' ? 'red' : 'yellow'
                      } ${isHighlight ? 'highlight' : ''}`}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {gameData.status==='active' && (
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
                placeholder="Type…"
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        )}

        {gameData.status==='finished' && (
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
      {friends.length===0
        ? <p>No friends to challenge.</p>
        : friends.map(f => (
            <div key={f.uid} className="friend-row">
              <span>@{f.username}</span>
              <button onClick={()=>handleChallenge(f)}>Challenge</button>
            </div>
          ))
      }
      {waitingGameId && (
        <>
          <p>Waiting for them to accept…</p>
          <button onClick={()=>navigate('/dashboard')}>Cancel</button>
        </>
      )}
    </div>
  );
}
