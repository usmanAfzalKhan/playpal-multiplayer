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
import './TicTacToe.css';

const initialBoard = Array(9).fill(null);

export default function MultiplayerTicTacToe() {
  const { gameId } = useParams();
  const navigate    = useNavigate();
  const user        = auth.currentUser;
  const [friends, setFriends]       = useState([]);
  const [waitingGameId, setWaiting] = useState(null);
  const [gameData, setGameData]     = useState(null);
  const [chatInput, setChatInput]   = useState('');

  // load friend list
  useEffect(() => {
    if (!user) return navigate('/');
    getDocs(collection(db, `users/${user.uid}/friends`))
      .then(snap => setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() }))));
  }, [user, navigate]);

  // challenge → create pending game + notification
  const handleChallenge = async friend => {
    const id   = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db,'tictactoe_games',id), {
      player1:    user.uid,
      player2:    friend.uid,
      currentTurn:user.uid,
      board:      initialBoard,
      status:     'pending',
      winner:     '',
      chat:       [],
      createdAt:  Timestamp.now()
    });
    await setDoc(
      doc(db, `users/${friend.uid}/notifications/${id}`),
      {
        type: 'tictactoe_invite',
        gameId: id,
        senderUid: user.uid,
        senderUsername: await getUsername(user.uid),
        message: `🎮 @${await getUsername(user.uid)} challenged you to Tic-Tac-Toe!`,
        timestamp: Timestamp.now()
      }
    );
    setWaiting(id);
  };

  // helper to fetch username
  async function getUsername(uid) {
    const snap = await getDocs(collection(db, 'users'), where('__name__', '==', uid));
    return snap.docs[0].data().username;
  }

  // watch for invite → active
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(doc(db,'tictactoe_games',waitingGameId), snap => {
      if (snap.exists() && snap.data().status === 'active') {
        navigate(`/tictactoe/multiplayer/${waitingGameId}`);
      }
    });
    return unsub;
  }, [waitingGameId, navigate]);

  // subscribe to game document
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db,'tictactoe_games',gameId), snap => {
      if (!snap.exists()) {
        setGameData(null);
      } else {
        setGameData({ id: snap.id, ...snap.data() });
      }
    });
    return unsub;
  }, [gameId]);

  // make a move
  const makeMove = async idx => {
    if (!gameData || gameData.status !== 'active') return;
    const me = user.uid;
    if (gameData.currentTurn !== me || gameData.board[idx]) return;

    const board = [...gameData.board];
    board[idx]  = me === gameData.player1 ? 'X' : 'O';

    const { winner } = getWinnerInfo(board);
    const nextTurn   = winner || board.every(c => c) ? null
                      : gameData.currentTurn === gameData.player1
                        ? gameData.player2
                        : gameData.player1;

    await updateDoc(doc(db,'tictactoe_games',gameId), {
      board,
      currentTurn: nextTurn,
      status: winner || board.every(c => c) ? 'finished' : 'active',
      winner: winner ? (winner === 'X' ? gameData.player1 : gameData.player2) : (board.every(c => c) ? 'draw' : '')
    });
  };

  // send chat
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db,'tictactoe_games',gameId), {
      chat: arrayUnion({
        sender: await getUsername(user.uid),
        message: chatInput,
        timestamp: Timestamp.now()
      })
    });
    setChatInput('');
  };

  // rematch resets board in-place
  const handleRematch = async () => {
    await updateDoc(doc(db,'tictactoe_games',gameId), {
      board: initialBoard,
      status: 'active',
      winner: '',
      currentTurn: gameData.player1,
      chat: []
    });
  };

  // quit & delete
  const handleQuit = async () => {
    await deleteDoc(doc(db,'tictactoe_games',gameId));
    navigate('/dashboard');
  };

  // accept invite from Dashboard
  const acceptInvite = async notif => {
    await updateDoc(doc(db,'tictactoe_games',notif.gameId), { status: 'active' });
    navigate(`/tictactoe/multiplayer/${notif.gameId}`);
  };

  // --- RENDER ---

  // 1) inside a game
  if (gameData) {
    const { winner, line } = getWinnerInfo(gameData.board);
    const yourMark = user.uid === gameData.player1 ? 'X' : 'O';
    const oppMark  = yourMark === 'X' ? 'O' : 'X';

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
              disabled={gameData.currentTurn !== user.uid || !!cell || gameData.status!=='active'}
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

  // 2) challenge screen
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
          <button onClick={() => navigate('/dashboard')}>Cancel &amp; Back</button>
        </>
      )}
    </div>
  );
}


// ---- helpers for strike-through & winner ----

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
