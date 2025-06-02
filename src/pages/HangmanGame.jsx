// src/pages/HangmanGame.jsx

// Import React hooks for state and lifecycle management
import { useEffect, useState } from 'react';

// Import hooks from React Router for accessing URL parameters and navigation
import { useParams, useNavigate } from 'react-router-dom';

// Import Firebase authentication and Firestore database instances
import { auth, db } from '../firebase-config';

// Import Firestore methods for document operations and updating arrays
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

// Import CSS file for styling this component
import './HangmanGame.css';

function HangmanGame() {
  // Get the 'gameId' route parameter from the URL (e.g., '/hangman/game/:gameId')
  const { gameId } = useParams();

  // Hook to programmatically navigate to different routes
  const navigate = useNavigate();

  // Local state to hold the game data fetched from Firestore
  const [gameData, setGameData] = useState(null);

  // Local state for the current letter or word guess input
  const [input, setInput] = useState('');

  // Local state for chat messages array (though we display directly from gameData.chat)
  const [messages, setMessages] = useState([]);

  // Local state for the new chat message input
  const [newMessage, setNewMessage] = useState('');

  // Get the currently authenticated user from Firebase Auth
  const user = auth.currentUser;

  // ─── Fetch and listen for real-time updates to this Hangman game document ───
  useEffect(() => {
    // Set up a Firestore onSnapshot listener on the "hangman_games/{gameId}" document
    const unsub = onSnapshot(doc(db, 'hangman_games', gameId), (docSnap) => {
      if (docSnap.exists()) {
        // If the document exists, update local state with its data
        setGameData(docSnap.data());
      } else {
        // If the document does not exist, clear local game data
        setGameData(null);
      }
    });

    // Cleanup listener when component unmounts or gameId changes
    return () => unsub();
  }, [gameId]);

  // ─── Send a new chat message ─────────────────────────────────────────────────
  const sendMessage = async () => {
    // Prevent sending if the input is empty or whitespace
    if (!newMessage.trim()) return;

    // Update the Firestore document by adding the new chat object to the "chat" array
    await updateDoc(doc(db, 'hangman_games', gameId), {
      chat: arrayUnion({
        sender: user.displayName,    // Use the current user's display name as sender
        message: newMessage,         // The new chat message content
        timestamp: Date.now(),       // JavaScript timestamp (milliseconds since epoch)
      }),
    });

    // Clear the newMessage input field after sending
    setNewMessage('');
  };

  // ─── Make a guess (letter or full word) ────────────────────────────────────
  const makeGuess = async () => {
    // Prevent guessing if the input is empty or whitespace
    if (!input.trim()) return;

    // Convert guess to lowercase and add it to the "guesses" array in Firestore
    await updateDoc(doc(db, 'hangman_games', gameId), {
      guesses: arrayUnion(input.toLowerCase()),
    });

    // Clear the guess input field after submitting
    setInput('');
  };

  // ─── If gameData is null or the document does not exist, show a fallback message ───
  if (!gameData) {
    return <p>Game not found. Try again later.</p>;
  }

  // ─── Render the Hangman game UI ───────────────────────────────────────────────────
  return (
    <div className="hangman-room">
      {/* Display the game title */}
      <h2>Hangman Game</h2>

      {/* 
        Show the current state of the word:
        - Split the word into characters.
        - If that character is in gameData.guesses, show the character; otherwise, underscore.
        - Join them with spaces for readability (e.g., "_ r _ c _").
      */}
      <p>
        Word:{' '}
        {gameData.word
          ? gameData.word
              .split('')
              .map((l) =>
                gameData.guesses?.includes(l) ? l : '_'
              )
              .join(' ')
          : 'Waiting...'}
      </p>

      {/* Input field for entering a letter or word guess */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter letter or word"
      />
      {/* Button to submit the guess */}
      <button onClick={makeGuess}>Guess</button>

      {/* ─────────────── Chat Section ───────────────────────────────────────── */}

      <h3>Chat</h3>
      <div className="chatbox">
        {/* Display each message from gameData.chat */}
        {gameData.chat?.map((msg, i) => (
          <p key={i}>
            <strong>{msg.sender}</strong>: {msg.message}
          </p>
        ))}
      </div>

      {/* Input field for typing a new chat message */}
      <input
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder="Type a message..."
      />
      {/* Button to send the chat message */}
      <button onClick={sendMessage}>Send</button>

      {/* Button to return back to the Dashboard */}
      <button onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
  );
}

export default HangmanGame;
