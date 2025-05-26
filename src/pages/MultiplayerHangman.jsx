import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { collection, doc, setDoc, onSnapshot, updateDoc, arrayUnion, getDocs, Timestamp } from 'firebase/firestore';
import './HangmanGame.css';

function MultiplayerHangman() {
  const [friends, setFriends] = useState([]);
  const [gameId, setGameId] = useState('');
  const [gameData, setGameData] = useState(null);
  const [wordInput, setWordInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchFriends = async () => {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(userDoc.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    };
    const fetchUsername = async () => {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      setUsername(docSnap.exists() ? docSnap.data().username : 'Player');
    };
    fetchFriends();
    fetchUsername();
  }, []);

  const challengeFriend = async (friendUid) => {
    const id = `${user.uid}_${friendUid}_${Date.now()}`;
    await setDoc(doc(db, 'hangman_games', id), {
      player1: user.uid,
      player2: friendUid,
      word: '',
      guesses: [],
      incorrectGuesses: 0,
      chat: [],
      turn: user.uid,
      status: 'waiting'
    });
    await setDoc(doc(db, `users/${friendUid}/notifications/${id}`), {
      type: 'hangman_invite',
      message: `🎮 ${username} challenged you to Hangman!`,
      gameId: id,
      timestamp: Timestamp.now()
    });
    setGameId(id);
  };

  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      }
    });
    return () => unsub();
  }, [gameId]);

  const handleSetWord = async () => {
    await updateDoc(doc(db, 'hangman_games', gameId), {
      word: wordInput.toLowerCase(),
      status: 'started'
    });
    setWordInput('');
  };

  const handleGuess = async () => {
    if (guessInput.trim() && user.uid === gameData.turn) {
      const correct = gameData.word.includes(guessInput.toLowerCase());
      await updateDoc(doc(db, 'hangman_games', gameId), {
        guesses: arrayUnion({ letter: guessInput.toLowerCase(), player: user.uid }),
        turn: correct ? user.uid : (gameData.player1 === user.uid ? gameData.player2 : gameData.player1)
      });
      setGuessInput('');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({ sender: username, message: newMessage, timestamp: Date.now() })
    });
    setNewMessage('');
  };

  return (
    <div className="hangman-room">
      {!gameId ? (
        <>
          <h2>Challenge a Friend to Hangman</h2>
          {friends.length === 0 ? (
            <p>No friends available. Add friends to start a game!</p>
          ) : (
            friends.map(friend => (
              <div key={friend.uid}>
                @{friend.username}
                <button onClick={() => challengeFriend(friend.uid)}>Challenge</button>
              </div>
            ))
          )}
        </>
      ) : !gameData ? (
        <p>Loading game...</p>
      ) : (
        <>
          <h2>Multiplayer Hangman</h2>
          {gameData.status === 'waiting' ? (
            <p>Waiting for the other player to join...</p>
          ) : (
            <>
              <p>Word: {gameData.word ? gameData.word.split('').map(l => '_ ').join('') : 'Waiting for word...'}</p>
              {gameData.word && user.uid === gameData.turn && (
                <>
                  <input value={guessInput} onChange={(e) => setGuessInput(e.target.value)} maxLength="1" />
                  <button onClick={handleGuess}>Guess</button>
                </>
              )}
              {!gameData.word && user.uid === gameData.player1 && (
                <>
                  <p>Set a word for your friend:</p>
                  <input value={wordInput} onChange={(e) => setWordInput(e.target.value)} />
                  <button onClick={handleSetWord}>Submit</button>
                </>
              )}
              <div className="chatbox">
                {gameData.chat.map((msg, i) => (
                  <p key={i}><strong>{msg.sender}:</strong> {msg.message}</p>
                ))}
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <button onClick={sendMessage}>Send</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default MultiplayerHangman;
