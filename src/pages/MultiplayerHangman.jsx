import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  Timestamp,
  onSnapshot,
  arrayUnion,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { HangmanDrawing } from './SingleHangman';
import './MultiplayerHangman.css';

function MultiplayerHangman() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const user = auth.currentUser;

  const [friends, setFriends] = useState([]);
  const [waitingGameId, setWaitingGameId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [input, setInput] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [winner, setWinner] = useState('');
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    if (!user) return navigate('/');
    (async () => {
      const snap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    })();
  }, [navigate, user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const udoc = await getDoc(doc(db, 'users', user.uid));
      if (udoc.exists()) setUserUsername(udoc.data().username);
    })();
  }, [user]);

  const handleChallenge = async friend => {
    const me = user.uid;
    const newGameId = `${me}_${friend.uid}_${Date.now()}`;
    const words = ['javascript', 'firebase', 'netlify', 'react', 'playpal'];
    const word = words[Math.floor(Math.random() * words.length)];

    await setDoc(doc(db, 'hangman_games', newGameId), {
      player1: me,
      player2: friend.uid,
      currentTurn: me,
      word,
      guesses: [],
      chat: [],
      status: 'pending',
      winner: '',
      createdAt: Timestamp.now()
    });

    await setDoc(doc(db, `users/${friend.uid}/notifications/${newGameId}`), {
      type: 'hangman_invite',
      message: `🎮 @${userUsername} challenged you to Hangman!`,
      gameId: newGameId,
      senderUid: me,
      senderUsername: userUsername,
      timestamp: Timestamp.now()
    });

    setWaitingGameId(newGameId);
  };

  // Challenger listens for acceptance
  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', waitingGameId), snap => {
      if (snap.exists() && snap.data().status === 'active') {
        navigate(`/hangman/multiplayer/${waitingGameId}`);
      }
    });
    return () => unsub();
  }, [waitingGameId, navigate]);

  // Real-time game updates
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setGameData(data);
        if (data.status === 'finished') {
          setWinner(data.winner);
          setGameOver(true);
        }
      } else {
        setGameData(null);
      }
    });
    return () => unsub();
  }, [gameId]);

  const makeGuess = async () => {
    if (!input || gameOver || user.uid !== gameData.currentTurn) return;
    const letter = input.toLowerCase();
    const newGuesses = gameData.guesses.includes(letter)
      ? gameData.guesses
      : [...gameData.guesses, letter];

    const incorrectCount = newGuesses.filter(l => !gameData.word.includes(l)).length;
    const allGuessed = gameData.word.split('').every(l => newGuesses.includes(l));

    let status = 'active';
    let winUid = '';
    let nextTurn = gameData.currentTurn === gameData.player1
      ? gameData.player2
      : gameData.player1;

    if (allGuessed) {
      status = 'finished';
      winUid = user.uid;
    } else if (incorrectCount >= 6) {
      status = 'finished';
      winUid = 'draw';
    } else if (gameData.word.includes(letter)) {
      nextTurn = user.uid;
    }

    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: newGuesses,
      currentTurn: nextTurn,
      status,
      winner: winUid
    });

    setInput('');
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({
        sender: userUsername,
        message: newMessage,
        timestamp: Date.now()
      })
    });
    setNewMessage('');
  };

  const handleRematch = async () => {
    const me = user.uid;
    const other = gameData.player1 === me ? gameData.player2 : gameData.player1;
    const rematchId = `${me}_${other}_${Date.now()}`;

    await setDoc(doc(db, 'hangman_games', rematchId), {
      player1: me,
      player2: other,
      currentTurn: me,
      word: gameData.word,
      guesses: [],
      chat: [],
      status: 'pending',
      winner: '',
      createdAt: Timestamp.now()
    });

    await setDoc(doc(db, `users/${other}/notifications/${rematchId}`), {
      type: 'hangman_rematch',
      message: `🔄 @${userUsername} wants a rematch!`,
      gameId: rematchId,
      senderUid: me,
      senderUsername: userUsername,
      timestamp: Timestamp.now()
    });

    setWaitingGameId(rematchId);
  };

  if (gameId && gameData) {
    return (
      <div className="hangman-room">
        <h2>Multiplayer Hangman</h2>
        <p>
          Current Turn:{' '}
          {gameData.currentTurn === user.uid ? 'Your Turn' : "Opponent's Turn"}
        </p>
        <HangmanDrawing
          incorrectGuesses={gameData.guesses.filter(g => !gameData.word.includes(g)).length}
        />
        <p>
          {gameData.word
            .split('')
            .map(l => (gameData.guesses.includes(l) ? l : '_'))
            .join(' ')}
        </p>
        <p>
          Incorrect Guesses:{' '}
          {gameData.guesses.filter(g => !gameData.word.includes(g)).length} / 6
        </p>

        {!gameOver ? (
          gameData.currentTurn === user.uid ? (
            <>
              <input
                value={input}
                maxLength="1"
                onChange={e => setInput(e.target.value)}
              />
              <button onClick={makeGuess}>Guess</button>
            </>
          ) : (
            <p>Waiting for opponent's turn...</p>
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
            <button onClick={() => navigate('/dashboard')}>Quit</button>
          </>
        )}

        <div className="chatbox">
          <h4>Game Chat</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {gameData.chat.map((m, i) => (
              <p key={i}>
                <strong>{m.sender}</strong>: {m.message}
              </p>
            ))}
          </div>
          <input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    );
  }

  return (
    <div className="multiplayer-container">
      <h2>Challenge a Friend to Hangman</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge.</p>
      ) : (
        friends.map(f => (
          <div key={f.uid}>
            @{f.username}{' '}
            <button onClick={() => handleChallenge(f)} disabled={!!waitingGameId}>
              Challenge
            </button>
          </div>
        ))
      )}
      {waitingGameId && (
        <>
          <p>Waiting for friend to accept...</p>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </>
      )}
    </div>
  );
}

export default MultiplayerHangman;
