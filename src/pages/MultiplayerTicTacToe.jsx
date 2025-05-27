import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  doc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, onSnapshot, Timestamp
} from 'firebase/firestore';
import './TicTacToe.css';

const initialBoard = Array(9).fill(null);

export default function MultiplayerTicTacToe() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = auth.currentUser;
  const [friends, setFriends] = useState([]);
  const [waiting, setWaiting] = useState(null);
  const [game, setGame] = useState(null);
  const [board, setBoard] = useState(initialBoard);
  const [statusMsg, setStatusMsg] = useState('');

  // load friends
  useEffect(() => {
    if (!user) return navigate('/');
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(snap => setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user, navigate]);

  // send challenge
  async function challenge(f) {
    const id = `${user.uid}_${f.uid}_${Date.now()}`;
    await setDoc(doc(db,'ttt_games',id), {
      players: [user.uid, f.uid],
      board: initialBoard,
      current: user.uid,
      status: 'pending',
      created: Timestamp.now(),
    });
    setWaiting(id);
  }

  // watch pending → active
  useEffect(() => {
    if (!waiting) return;
    const unsub = onSnapshot(doc(db,'ttt_games',waiting), snap => {
      const d = snap.data();
      if (d?.status === 'active') navigate(`/tictactoe/multiplayer/${waiting}`);
    });
    return unsub;
  }, [waiting, navigate]);

  // subscribe to game updates
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db,'ttt_games',gameId), snap => {
      if (!snap.exists()) return navigate('/dashboard');
      const d = snap.data();
      setGame(d);
      setBoard(d.board);
      if (d.status === 'finished') {
        setStatusMsg(d.winner === 'draw' ? 'Draw!' : d.winner === user.uid ? 'You Win!' : 'You Lose!');
      }
    });
    return unsub;
  }, [gameId, navigate, user.uid]);

  // make move
  async function makeMove(i) {
    if (!game || game.status !== 'active') return;
    if (board[i] || game.current !== user.uid) return;
    const next = [...board];
    next[i] = game.players[0] === user.uid ? 'X' : 'O';
    const other = game.players.find(id => id !== user.uid);
    const win = calculateWinner(next);
    const newStatus = win || next.every(c=>c) ? 'finished' : 'active';
    const winnerId = win
      ? game.players[next.indexOf(win) === 0 ? 0 : 1]
      : 'draw';
    await updateDoc(doc(db,'ttt_games',gameId), {
      board: next,
      current: other,
      status: newStatus,
      winner: winnerId
    });
  }

  // rematch in-place
  async function rematch() {
    if (!game) return;
    await updateDoc(doc(db,'ttt_games',gameId), {
      board: initialBoard,
      current: game.players[0],
      status: 'active',
      winner: ''
    });
    setStatusMsg('');
  }

  // quit & delete
  async function quit() {
    await deleteDoc(doc(db,'ttt_games',gameId));
    navigate('/dashboard');
  }

  // render game screen
  if (gameId && game) {
    return (
      <div className="ttt-container">
        <h2>Multiplayer Tic-Tac-Toe</h2>
        {game.status === 'pending' ? (
          <p>Waiting for opponent…</p>
        ) : (
          <>
            <p className="ttt-status">
              {game.status === 'active'
                ? `Next: ${game.current===user.uid?'You':'Opponent'}`
                : statusMsg}
            </p>
            <div className="ttt-board">
              {board.map((c,i) => (
                <button key={i} className="ttt-cell" onClick={() => makeMove(i)}>
                  {c}
                </button>
              ))}
            </div>
            {game.status === 'finished' && (
              <div className="ttt-controls">
                <button onClick={rematch}>Rematch</button>
                <button onClick={quit}>Quit</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // challenge list
  return (
    <div className="ttt-container">
      <h2>Challenge a Friend to Tic-Tac-Toe</h2>
      {friends.length===0
        ? <p>No friends to challenge.</p>
        : friends.map(f => (
            <div key={f.uid} className="friend-row">
              <span>@{f.username}</span>
              <button onClick={() => challenge(f)}>Challenge</button>
            </div>
          ))
      }
      {waiting && (
        <>
          <p>Waiting for them to accept…</p>
          <button onClick={() => setWaiting(null)}>Cancel</button>
        </>
      )}
    </div>
  );
}

function calculateWinner(sq) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let [a,b,c] of lines) {
    if (sq[a] && sq[a]===sq[b] && sq[a]===sq[c]) return sq[a];
  }
  return null;
}
