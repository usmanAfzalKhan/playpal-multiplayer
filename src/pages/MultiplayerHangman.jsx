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

  // 🔥 Listener for when game is accepted by the friend
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

  // ...keep the rest of game logic, makeGuess, sendMessage, handleRematch

  return (
    // Same structure as before, with waiting, game view, and chat
    // Include a Back to Dashboard button for waiting screen
  );
}

export default MultiplayerHangman;
