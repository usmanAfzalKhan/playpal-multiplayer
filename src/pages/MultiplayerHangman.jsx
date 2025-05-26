import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  collection, getDocs, doc, setDoc, Timestamp, onSnapshot, arrayUnion, updateDoc, getDoc
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
    const fetchFriends = async () => {
      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(friendsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    };
    fetchFriends();
  }, [navigate, user]);

  useEffect(() => {
    const fetchUsername = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserUsername(userDoc.data().username);
        }
      }
    };
    fetchUsername();
  }, [user]);

  const handleChallenge = async (friend) => {
    const currentUid = user.uid;
    const newGameId = `${currentUid}_${friend.uid}_${Date.now()}`;
    const words = ['javascript', 'firebase', 'netlify', 'react', 'playpal'];
    const randomWord = words[Math.floor(Math.random() * words.length)];

    await setDoc(doc(db, 'hangman_games', newGameId), {
      player1: currentUid,
      player2: friend.uid,
      currentTurn: currentUid,
      word: randomWord,
      guesses: [],
      chat: [],
      status: 'pending',
      winner: '',
      createdAt: Timestamp.now(),
    });

    await setDoc(doc(db, `users/${friend.uid}/notifications/${newGameId}`), {
      type: 'hangman_invite',
      message: `🎮 @${user.displayName || 'A user'} challenged you to Hangman!`,
      gameId: newGameId,
      senderUid: currentUid,
      senderUsername: user.displayName || 'A user',
      timestamp: Timestamp.now(),
    });

    setWaitingGameId(newGameId);
  };

  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', waitingGameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'active') {
          navigate(`/hangman/multiplayer/${waitingGameId}`);
        }
      }
    });
    return () => unsub();
  }, [waitingGameId, navigate]);

  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
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
    if (!input.trim() || gameOver || user.uid !== gameData.currentTurn) return;
    const letter = input.toLowerCase();
    const newGuesses = gameData.guesses.includes(letter) ? gameData.guesses : [...gameData.guesses, letter];

    const incorrectGuesses = newGuesses.filter(l => !gameData.word.includes(l)).length;
    const hasWon = gameData.word.split('').every(l => newGuesses.includes(l));

    let newStatus = 'active';
    let newWinner = '';
    let nextTurn = gameData.currentTurn === gameData.player1 ? gameData.player2 : gameData.player1;

    if (hasWon) {
      newStatus = 'finished';
      newWinner = user.uid;
    } else if (incorrectGuesses >= 6) {
      newStatus = 'finished';
      newWinner = 'draw';
    } else if (gameData.word.includes(letter)) {
      nextTurn = user.uid;
    }

    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: newGuesses,
      currentTurn: nextTurn,
      status: newStatus,
      winner: newWinner
    });

    setInput('');
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ sender: userUsername || 'Unknown', message: newMessage, timestamp: Date.now() }),
    });
    setNewMessage('');
  };

  const handleRematch = async () => {
    const newGameId = `${gameId}_rematch`;
    await setDoc(doc(db, 'hangman_games', newGameId), {
      player1: gameData.player1,
      player2: gameData.player2,
      currentTurn: gameData.player1,
      word: gameData.word,
      guesses: [],
      chat: [],
      status: 'active',
      winner: '',
      createdAt: Timestamp.now(),
    });
    navigate(`/hangman/multiplayer/${newGameId}`);
  };

  if (gameId && gameData) {
    return (
      <div className="hangman-room">
        <h2>Multiplayer Hangman</h2>
        <p>{`Current Turn: ${gameData.currentTurn === user?.uid ? 'Your Turn' : "Opponent's Turn"}`}</p>
        <HangmanDrawing incorrectGuesses={gameData.guesses?.filter(g => !gameData.word.includes(g)).length} />
        <p>{gameData.word?.split('').map(l => (gameData.guesses?.includes(l) ? l : '_')).join(' ')}</p>
        <p>Incorrect Guesses: {gameData.guesses?.filter(g => !gameData.word.includes(g)).length} / 6</p>

        {!gameOver ? (
          user?.uid === gameData.currentTurn ? (
            <>
              <input value={input} maxLength="1" onChange={(e) => setInput(e.target.value)} />
              <button onClick={makeGuess}>Guess</button>
            </>
          ) : (
            <p>Waiting for opponent's turn...</p>
          )
        ) : (
          <>
            <h3>{winner === 'draw' ? '💀 Game Draw!' : winner === user?.uid ? '🎉 You Win!' : '😢 You Lose!'}</h3>
            <button onClick={handleRematch}>Rematch</button>
            <button onClick={() => navigate('/dashboard')}>Quit</button>
          </>
        )}

        <div className="chatbox">
          <h4>Game Chat</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {gameData.chat?.map((msg, idx) => (
              <p key={idx}><strong>{msg.sender}</strong>: {msg.message}</p>
            ))}
          </div>
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
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
        friends.map(friend => (
          <div key={friend.uid}>
            @{friend.username}
            <button onClick={() => handleChallenge(friend)}>Challenge</button>
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
