import { useEffect } from 'react';
import { db } from '../firebase-config';
import { doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

function FirestoreSeeder() {
  useEffect(() => {
    const seedFirestore = async () => {
      console.log('🔥 Starting Firestore seeder...');
      try {
        const user1 = { uid: 'user1', username: 'Alice', email: 'alice@example.com' };
        const user2 = { uid: 'user2', username: 'Bob', email: 'bob@example.com' };

        // Create users
        await setDoc(doc(db, 'users', user1.uid), user1);
        await setDoc(doc(db, 'users', user2.uid), user2);
        console.log('✅ Users created: Alice & Bob');

        // Add each other as friends
        await setDoc(doc(db, `users/${user1.uid}/friends/${user2.uid}`), { username: user2.username, addedAt: Timestamp.now() });
        await setDoc(doc(db, `users/${user2.uid}/friends/${user1.uid}`), { username: user1.username, addedAt: Timestamp.now() });
        console.log('✅ Friends list created');

        // Sample chat messages
        const chatId = [user1.uid, user2.uid].sort().join('_');
        const messages = [
          { senderId: user1.uid, receiverId: user2.uid, content: 'Hello Bob!', timestamp: Timestamp.now(), isSeen: false },
          { senderId: user2.uid, receiverId: user1.uid, content: 'Hi Alice! How are you?', timestamp: Timestamp.now(), isSeen: false },
        ];
        for (const msg of messages) {
          await addDoc(collection(db, `chats/${chatId}/messages`), msg);
        }
        console.log('✅ Sample messages seeded');

        // Create a Hangman game with a word
        const gameId = `${user1.uid}_${user2.uid}_test`;
        const word = 'react'; // Sample word
        await setDoc(doc(db, 'hangman_games', gameId), {
          player1: user1.uid,
          player2: user2.uid,
          word: word,
          guesses: [],
          chat: [],
          createdAt: Timestamp.now(),
          currentTurn: user1.uid,
          status: 'active',
          winner: ''
        });
        console.log(`✅ Hangman game created: ${gameId} with word "${word}"`);

        console.log('🔥 Firestore seeder completed!');
      } catch (error) {
        console.error('❌ Firestore seeder error:', error);
      }
    };

    seedFirestore();
  }, []);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Firestore Seeder Running...</h2>
      <p>Check Firestore for users, friends, messages, and Hangman game!</p>
    </div>
  );
}

export default FirestoreSeeder;
