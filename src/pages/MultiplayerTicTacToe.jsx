// src/pages/MultiplayerTicTacToe.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  where,
  Timestamp
} from 'firebase/firestore';
import './TicTacToe.css';

const initialBoard = Array(9).fill(null);

export default function MultiplayerTicTacToe() {
  const { gameId }      = useParams();
  const navigate        = useNavigate();
  const user            = auth.currentUser;
  const [friends, setFriends]         = useState([]);
  const [waitingGameId, setWaiting]   = useState(null);
  const [gameData, setGameData]       = useState(null);
  const [chatInput, setChatInput]     = useState('');

  // 1) load friend list
  useEffect(() => {
    if (!user) return navigate('/');
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(snap => setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user, navigate]);

  // 2) helper to fetch username
  async function getUsername(uid) {
    const uSnap = await getDoc(doc(db, 'users', uid));
    return uSnap.exists() ? uSnap.data().username : '';
  }

  // 3) send challenge + notification
  const handleChallenge = async friend => {
    const id   = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db,'tictactoe_games',id), {
      player1:     user.uid,
      player2:     friend.uid,
      currentTurn: user.uid,
      board:       initialBoard,
      status:      'pending',
      winner:      '',
      chat:        [],
      createdAt:   Timestamp.now()
    });
    const you = await getUsername(user.uid);
    await setDoc(
      doc(db, `users/${friend.uid}/notifications/${id}`),
      {
        type:           'tictactoe_invite',
        gameId:         id,
        senderUid:      user.uid,
        senderUsername: you,
        message:        `🎮 @${you} challenged you to Tic-Tac-Toe!`,
        timestamp:      Timestamp.now()
      }
    );
    setWaiting(id);
  };

  // 4) watch for auto-start on accept
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(doc(db,'tictactoe_games',waitingGameId), snap => {
      if (snap.exists() && snap.data().status === 'active') {
        navigate(`/tictactoe/multiplayer/${waitingGameId}`);
      }
    });
    return unsub;
  }, [waitingGameId, navigate]);

  // 5) subscribe to gameDoc
  useEffect(() => {
    if (!gameId) return;

    // Subscribe to the live game document
    const unsub = onSnapshot(doc(db,'tictactoe_games',gameId), snap => {
      if (!snap.exists()) setGameData(null);
      else setGameData({ id: snap.id, ...snap.data() });
    });

    // Cleanup: unsubscribe and delete the game if user leaves without hitting “Quit”
    return () => {
      unsub();
      deleteDoc(doc(db,'tictactoe_games',gameId))
        .catch(() => {/* ignore if already deleted */});
    };
  }, [gameId]);

  // 6) move logic
  const makeMove = async idx => {
    if (!gameData || gameData.status !== 'active') return;
    if (gameData.currentTurn !== user.uid || gameData.board[idx]) return;

    const board    = [...gameData.board];
    board[idx]     = user.uid === gameData.player1 ? 'X' : 'O';

    const { winner } = getWinnerInfo(board);
    const full       = board.every(c => c);
    const next       = winner || full
      ? null
      : gameData.currentTurn === gameData.player1
        ? gameData.player2
        : gameData.player1;

    await updateDoc(doc(db,'tictactoe_games',gameId), {
      board,
      currentTurn: next,
      status:      winner || full ? 'finished' : 'active',
      winner:      winner
        ? (winner === 'X' ? gameData.player1 : gameData.player2)
        : (full ? 'draw' : '')
    });
  };

  // 7) chat
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const you = await getUsername(user.uid);
    await updateDoc(doc(db,'tictactoe_games',gameId), {
      chat: arrayUnion({
        sender:    you,
        message:   chatInput,
        timestamp: Timestamp.now()
      })
    });
    setChatInput('');
  };

  // 8) rematch / quit
  const handleRematch = async () => {
    await updateDoc(doc(db,'tictactoe_games',gameId), {
      board:       initialBoard,
      status:      'active',
      winner:      '',
      currentTurn: gameData.player1,
      chat:        []
    });
  };
  const handleQuit = async () => {
    await deleteDoc(doc(db,'tictactoe_games',gameId));
    navigate('/dashboard');
  };

  // --- RENDER ---

  // A) inside a running game
  if (gameData) {
    const { winner, line } = getWinnerInfo(gameData.board);
    return (
      <div className="ttt-container">
        <h2>Multiplayer Tic-Tac-Toe</h2>
        <p className="ttt-status">
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

        <div className="ttt-board">
          {line && <div className={`strike-line ${strikeClass(line)}`} />}
          {gameData.board.map((cell, i) => (
            <button
              key={i}
              className="ttt-cell"
              onClick={() => makeMove(i)}
              disabled={
                gameData.currentTurn !== user.uid ||
                !!cell ||
                gameData.status !== 'active'
              }
            >
              {cell === 'X' ? 'X' : cell === 'O' ? 'O' : ''}
            </button>
          ))}
        </div>

        {gameData.status === 'active' && (
          <div className="chatbox">
            <h4>Game Chat</h4>
            <div className="chat-messages">
              {gameData.chat.map((m,i) => (
                <p key={i}><strong>{m.sender}:</strong> {m.message}</p>
              ))}
            </div>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
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

  // B) challenge screen
  return (
    <div className="ttt-container">
      <h2>Challenge a Friend to Tic-Tac-Toe</h2>
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


// ——— Helpers ———

// returns { winner: 'X'|'O'|null, line: [i,j,k]|null }
function getWinnerInfo(sq) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (let [a,b,c] of lines) {
    if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) {
      return { winner: sq[a], line: [a,b,c] };
    }
  }
  return { winner: null, line: null };
}

// map a winning triple to a CSS class
function strikeClass([a,b,c]) {
  if (a===0&&b===1&&c===2) return 'strike-row-1';
  if (a===3&&b===4&&c===5) return 'strike-row-2';
  if (a===6&&b===7&&c===8) return 'strike-row-3';
  if (a===0&&b===3&&c===6) return 'strike-col-1';
  if (a===1&&b===4&&c===7) return 'strike-col-2';
  if (a===2&&b===5&&c===8) return 'strike-col-3';
  if (a===0&&b===4&&c===8) return 'strike-diag-main';
  if (a===2&&b===4&&c===6) return 'strike-diag-anti';
  return '';
}
