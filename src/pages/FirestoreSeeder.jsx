// src/pages/FirestoreSeeder.jsx

// Import React’s useEffect hook to run side effects on component mount
import { useEffect } from 'react';

// Import Firestore database instance
import { db } from '../firebase-config';

// Import Firestore methods for document and collection operations
import { doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';

function FirestoreSeeder() {
  // useEffect with an empty dependency array runs once, when the component mounts
  useEffect(() => {
    const seedFirestore = async () => {
      console.log('🔥 Starting Firestore seeder...');

      try {
        // Define two sample users with UIDs, usernames, and emails
        const user1 = { uid: 'user1', username: 'Alice', email: 'alice@example.com' };
        const user2 = { uid: 'user2', username: 'Bob', email: 'bob@example.com' };

        // ─────────────── Create user documents under "users/{uid}" ───────────────
        // Use setDoc to write or overwrite the document for user1
        await setDoc(doc(db, 'users', user1.uid), user1);
        // Use setDoc to write or overwrite the document for user2
        await setDoc(doc(db, 'users', user2.uid), user2);
        console.log('✅ Users created: Alice & Bob');

        // ─────────────── Add each other as friends ─────────────────────────────
        // Under users/user1/friends/user2, store Bob’s username and timestamp
        await setDoc(
          doc(db, `users/${user1.uid}/friends/${user2.uid}`),
          {
            username: user2.username,
            addedAt: Timestamp.now(), // Server timestamp indicating when they became friends
          }
        );
        // Under users/user2/friends/user1, store Alice’s username and timestamp
        await setDoc(
          doc(db, `users/${user2.uid}/friends/${user1.uid}`),
          {
            username: user1.username,
            addedAt: Timestamp.now(),
          }
        );
        console.log('✅ Friends list created');

        // ─────────────── Seed sample chat messages ─────────────────────────────
        // Determine a consistent chat ID by sorting the two UIDs alphabetically and joining them with '_'
        const chatId = [user1.uid, user2.uid].sort().join('_');

        // Prepare an array of sample message objects
        const messages = [
          {
            senderId: user1.uid,             // Alice sends this message
            receiverId: user2.uid,           // Bob is the recipient
            content: 'Hello Bob!',           // Message text
            timestamp: Timestamp.now(),      // Timestamp for ordering / display
            isSeen: false,                   // Indicates Bob hasn't seen it yet
          },
          {
            senderId: user2.uid,             // Bob sends this message
            receiverId: user1.uid,           // Alice is the recipient
            content: 'Hi Alice! How are you?', // Message text
            timestamp: Timestamp.now(),      // Timestamp for ordering / display
            isSeen: false,                   // Indicates Alice hasn't seen it yet
          },
        ];

        // Loop through each sample message and add it to the "chats/{chatId}/messages" collection
        for (const msg of messages) {
          await addDoc(collection(db, `chats/${chatId}/messages`), msg);
        }
        console.log('✅ Sample messages seeded');

        // ─────────────── Create a Hangman game document ──────────────────────────
        // Construct a game ID in the format "user1_user2_test"
        const gameId = `${user1.uid}_${user2.uid}_test`;

        // Example word for the Hangman game
        const word = 'react';

        // Use setDoc to create or overwrite a Hangman game under "hangman_games/{gameId}"
        await setDoc(doc(db, 'hangman_games', gameId), {
          player1: user1.uid,               // Alice is player1
          player2: user2.uid,               // Bob is player2
          word: word,                       // The word to guess in Hangman
          guesses: [],                      // Array of guessed letters (starts empty)
          chat: [],                         // Array for in-game chat messages (starts empty)
          createdAt: Timestamp.now(),       // Timestamp when game was created
          currentTurn: user1.uid,           // Indicates whose turn it is (Alice starts)
          status: 'active',                 // "active" means game is ongoing
          winner: '',                       // Empty string indicates no winner yet
        });
        console.log(`✅ Hangman game created: ${gameId} with word "${word}"`);

        console.log('🔥 Firestore seeder completed!');
      } catch (error) {
        // If any operation fails, log the error to the console
        console.error('❌ Firestore seeder error:', error);
      }
    };

    // Call the seeding function when the component mounts
    seedFirestore();
  }, []); // Empty dependency array => runs once on mount

  // Return some simple JSX indicating the seeder is running
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Firestore Seeder Running...</h2>
      <p>Check Firestore for users, friends, messages, and Hangman game!</p>
    </div>
  );
}

export default FirestoreSeeder;
