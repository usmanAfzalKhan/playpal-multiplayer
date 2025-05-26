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

        console.log(`⚙️ Creating user: ${user1.uid}`);
        await setDoc(doc(db, 'users', user1.uid), user1);
        console.log(`✅ User ${user1.username} created`);

        console.log(`⚙️ Creating user: ${user2.uid}`);
        await setDoc(doc(db, 'users', user2.uid), user2);
        console.log(`✅ User ${user2.username} created`);

        const chatId = [user1.uid, user2.uid].sort().join('_');
        const messages = [
          {
            senderId: user1.uid,
            receiverId: user2.uid,
            content: 'Hello Bob!',
            timestamp: Timestamp.now(),
            isSeen: false,
            isSavedBySender: false,
            isSavedByReceiver: false,
          },
          {
            senderId: user2.uid,
            receiverId: user1.uid,
            content: 'Hi Alice! How are you?',
            timestamp: Timestamp.now(),
            isSeen: false,
            isSavedBySender: false,
            isSavedByReceiver: false,
          },
        ];

        for (const msg of messages) {
          console.log(`⚙️ Adding message: ${msg.content}`);
          await addDoc(collection(db, `chats/${chatId}/messages`), msg);
          console.log(`✅ Message added: ${msg.content}`);
        }

        // 🔥 Add initial Hangman game with roles
        const gameId = `${user1.uid}_${user2.uid}_test`;
        console.log(`⚙️ Creating Hangman game: ${gameId}`);
        await setDoc(doc(db, 'hangman_games', gameId), {
          player1: user1.uid,
          player2: user2.uid,
          word: '',
          status: 'pending',
          guesses: [],
          chat: [],
          createdAt: Timestamp.now(),
          currentWordSetter: user1.uid,
          currentGuesser: user2.uid,
        });
        console.log(`✅ Hangman game created: ${gameId}`);

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
      <p>Check Firestore for users and messages!</p>
    </div>
  );
}

export default FirestoreSeeder;
