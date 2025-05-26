import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase-config";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
} from "firebase/firestore";
import "./MultiplayerHangman.css";

function MultiplayerHangman() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [guessInput, setGuessInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    const unsubGame = onSnapshot(doc(db, "hangman_games", gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameData(docSnap.data());
      }
    });

    const unsubChat = onSnapshot(
      query(collection(db, `hangman_games/${gameId}/chat`), orderBy("timestamp")),
      (snapshot) => {
        setChatMessages(snapshot.docs.map((doc) => doc.data()));
      }
    );

    return () => {
      unsubGame();
      unsubChat();
    };
  }, [gameId, navigate]);

  const handleGuess = async () => {
    if (!guessInput.trim() || gameData.guesses.includes(guessInput)) return;

    const nextTurn = gameData.currentTurn === gameData.player1 ? gameData.player2 : gameData.player1;

    await updateDoc(doc(db, "hangman_games", gameId), {
      guesses: arrayUnion(guessInput.toLowerCase()),
      currentTurn: gameData.word.includes(guessInput) ? gameData.currentTurn : nextTurn,
    });

    setGuessInput("");
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    await addDoc(collection(db, `hangman_games/${gameId}/chat`), {
      senderUid: user.uid,
      senderName: user.displayName || "Player",
      message: newMessage,
      timestamp: Date.now(),
    });
    setNewMessage("");
  };

  if (!gameData) return <p>Loading...</p>;

  const wordDisplay = gameData.word
    .split("")
    .map((l) => (gameData.guesses.includes(l) ? l : "_"))
    .join(" ");

  return (
    <div className="multiplayer-container">
      <h2>Multiplayer Hangman</h2>
      <p>Word: {wordDisplay}</p>
      <p>Current Turn: {gameData.currentTurn === user.uid ? "Your turn" : "Opponent's turn"}</p>

      {gameData.currentTurn === user.uid && (
        <>
          <input
            type="text"
            maxLength="1"
            value={guessInput}
            onChange={(e) => setGuessInput(e.target.value)}
          />
          <button onClick={handleGuess}>Guess</button>
        </>
      )}

      <div className="chatbox">
        <div className="chat-messages">
          {chatMessages.map((msg, index) => (
            <p key={index}>
              <strong>{msg.senderName}</strong>: {msg.message}
            </p>
          ))}
        </div>
        <input
          placeholder="Type message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>

      <button onClick={() => navigate("/dashboard")}>Quit</button>
    </div>
  );
}

export default MultiplayerHangman;
