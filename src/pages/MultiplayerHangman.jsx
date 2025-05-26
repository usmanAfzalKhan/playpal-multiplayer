import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { collection, getDocs, doc, setDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import './HangmanGame.css';

function MultiplayerHangman() {
  const [friends, setFriends] = useState([]);
  const [waitingGameId, setWaitingGameId] = useState(null);
  const navigate = useNavigate();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return navigate('/');
      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(friendsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    };
    fetchFriends();
  }, [navigate, user]);

  const handleChallenge = async (friend) => {
    const gameId = `${user.uid}_${friend.uid}_${Date.now()}`;
    await setDoc(doc(db, 'hangman_games', gameId), {
      player1: user.uid,
      player2: friend.uid,
      player1Name: user.displayName || 'Player1',
      player2Name: friend.username || 'Player2',
      currentWordSetter: user.uid,
      currentGuesser: friend.uid,
      word: '',
      guesses: [],
      chat: [],
      status: 'pending',
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, `users/${friend.uid}/notifications/${gameId}`), {
      type: 'hangman_challenge',
      message: `🎮 @${user.displayName || 'User'} challenged you to Hangman!`,
      gameId,
      senderUid: user.uid,
      timestamp: Timestamp.now(),
    });
    setWaitingGameId(gameId);
  };

  useEffect(() => {
    if (!waitingGameId) return;
    const unsub = onSnapshot(doc(db, 'hangman_games', waitingGameId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().status === 'started') {
        navigate(`/hangman/game/${waitingGameId}`);
      }
    });
    return () => unsub();
  }, [waitingGameId, navigate]);

  return (
    <div className="hangman-room">
      <h2>Challenge a Friend to Hangman</h2>
      {friends.length === 0 ? (
        <p>No friends to challenge. Add friends first!</p>
      ) : (
        friends.map(friend => (
          <div key={friend.uid} className="friend-challenge">
            @{friend.username}
            <button onClick={() => handleChallenge(friend)}>Challenge</button>
          </div>
        ))
      )}
      {waitingGameId && <p>Waiting for friend to accept...</p>}
    </div>
  );
}

export default MultiplayerHangman;
