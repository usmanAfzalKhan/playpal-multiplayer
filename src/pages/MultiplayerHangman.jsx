import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import { collection, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import './MultiplayerHangman.css';

function MultiplayerHangman() {
  const [friends, setFriends] = useState([]);
  const [waitingGameId, setWaitingGameId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFriends = async () => {
      const user = auth.currentUser;
      if (!user) return navigate('/');

      const friendsSnap = await getDocs(collection(db, `users/${user.uid}/friends`));
      setFriends(friendsSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    };
    fetchFriends();
  }, [navigate]);

  const handleChallenge = async (friend) => {
    const currentUid = auth.currentUser.uid;
    const gameId = `${currentUid}_${friend.uid}_${Date.now()}`;

    await setDoc(doc(db, 'hangman_games', gameId), {
      player1: currentUid,
      player2: friend.uid,
      currentWordSetter: currentUid,
      currentGuesser: friend.uid,
      word: '',
      guesses: [],
      chat: [],
      status: 'pending',
      createdAt: Timestamp.now(),
    });

    await setDoc(doc(db, `users/${friend.uid}/notifications/${gameId}`), {
      type: 'hangman_invite',
      message: `🎮 @${auth.currentUser.displayName || 'A user'} challenged you to Hangman!`,
      gameId,
      senderUid: currentUid,
      timestamp: Timestamp.now(),
    });

    setWaitingGameId(gameId);
  };

  return (
    <div className="multiplayer-hangman">
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
      {waitingGameId && <p>Waiting for friend to accept...</p>}
    </div>
  );
}

export default MultiplayerHangman;
