// src/pages/SingleHangman.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./HangmanGame.css"; // Import styling for Hangman

// ─── Word List ─────────────────────────────────────────────────
// Array of possible words for the single-player Hangman game
const words = ["javascript", "firebase", "netlify", "react", "playpal"];

export default function SingleHangman() {
  const [word, setWord] = useState(""); // The word to guess
  const [guesses, setGuesses] = useState([]); // Letters guessed so far
  const [incorrectGuesses, setIncorrectGuesses] = useState(0); // Count of wrong guesses
  const [input, setInput] = useState(""); // Current input letter from user
  const [gameOver, setGameOver] = useState(false); // Flag: is the game over?
  const [win, setWin] = useState(false); // Flag: did the player win?
  const navigate = useNavigate(); // To navigate back to dashboard

  // ─── 1) PICK A RANDOM WORD ON MOUNT ───────────────────────────
  useEffect(() => {
    // Choose one random word from the 'words' array
    const randomIndex = Math.floor(Math.random() * words.length);
    setWord(words[randomIndex]);
  }, []); // Empty dependency array → runs only once when component mounts

  // ─── 2) CHECK FOR WIN OR LOSS ─────────────────────────────────
  useEffect(() => {
    if (!word) return; // If word not yet set, do nothing

    // Check if every letter in 'word' has been guessed
    const allRevealed = word
      .split("")
      .every((letter) => guesses.includes(letter));

    if (allRevealed) {
      // Player has revealed all letters → win
      setWin(true);
      setGameOver(true);
    } else if (incorrectGuesses >= 6) {
      // Exceeded maximum of 6 incorrect guesses → lose
      setGameOver(true);
    }
  }, [guesses, incorrectGuesses, word]);
  // Dependencies: re-run whenever 'guesses', 'incorrectGuesses', or 'word' changes

  // ─── 3) HANDLE A NEW GUESS ────────────────────────────────────
  const handleGuess = () => {
    if (!input || gameOver) return; // Do nothing if input empty or game is over

    const letter = input.toLowerCase(); // Normalize to lowercase

    // If this letter was already guessed, just clear input and return
    if (guesses.includes(letter)) {
      setInput("");
      return;
    }

    // Add the new letter to the list of guesses
    setGuesses((prev) => [...prev, letter]);

    // If the word does NOT include this letter, increment incorrectGuesses
    if (!word.includes(letter)) {
      setIncorrectGuesses((prev) => prev + 1);
    }

    // Clear the input after processing
    setInput("");
  };

  // ─── 4) RESTART THE GAME ──────────────────────────────────────
  const handleRestart = () => {
    // Pick a new random word
    const randomIndex = Math.floor(Math.random() * words.length);
    setWord(words[randomIndex]);

    // Reset all state to initial values
    setGuesses([]);
    setIncorrectGuesses(0);
    setInput("");
    setGameOver(false);
    setWin(false);
  };

  // ─── 5) RENDER UI ─────────────────────────────────────────────
  return (
    <div className="hangman-room">
      <h2>Single Player Hangman</h2>

      {/* HangmanDrawing shows the gallows and body parts based on incorrectGuesses */}
      <HangmanDrawing incorrectGuesses={incorrectGuesses} />

      {/* Display the word with underscores for unguessed letters */}
      <p>
        {word
          .split("") // Split word into an array of letters
          .map(
            (letter) =>
              guesses.includes(letter) // If the letter was guessed,
                ? letter // show it
                : "_" // otherwise show underscore
          )
          .join(" ")}{" "}
        // Join back into string with spaces
      </p>

      {/* Display count of incorrect guesses out of 6 */}
      <p>Incorrect Guesses: {incorrectGuesses} / 6</p>

      {/* If game is not over, show input and Guess button */}
      {!gameOver ? (
        <>
          <input
            value={input}
            maxLength="1" // Only allow one character
            onChange={(e) => setInput(e.target.value)} // Update input state on change
          />
          <button onClick={handleGuess}>Guess</button>
        </>
      ) : (
        // Once game is over, show win/lose message and Rematch button
        <>
          <h3>
            {win
              ? "🎉 You Win!" // If win == true
              : `💀 You Lose! The word was ${word}`}
          </h3>
          <button onClick={handleRestart}>Rematch</button>
        </>
      )}

      {/* Always show Quit button to go back to dashboard */}
      <button onClick={() => navigate("/dashboard")}>Quit</button>
    </div>
  );
}

// ─── HangmanDrawing COMPONENT ───────────────────────────────────
/**
 * Renders the Hangman SVG graphic based on number of incorrect guesses.
 * Each body part appears sequentially as incorrectGuesses increases from 1 to 6.
 */
export function HangmanDrawing({ incorrectGuesses }) {
  return (
    <svg height="250" width="200" className="hangman-drawing">
      {/* Base line */}
      <line x1="10" y1="240" x2="190" y2="240" stroke="black" strokeWidth="4" />
      {/* Vertical post */}
      <line x1="50" y1="240" x2="50" y2="20" stroke="black" strokeWidth="4" />
      {/* Top beam */}
      <line x1="50" y1="20" x2="150" y2="20" stroke="black" strokeWidth="4" />
      {/* Rope */}
      <line x1="150" y1="20" x2="150" y2="50" stroke="black" strokeWidth="4" />

      {/* Head: appears when incorrectGuesses > 0 */}
      {incorrectGuesses > 0 && (
        <circle
          cx="150"
          cy="70"
          r="20"
          stroke="black"
          strokeWidth="4"
          fill="none"
        />
      )}

      {/* Body: appears when incorrectGuesses > 1 */}
      {incorrectGuesses > 1 && (
        <line
          x1="150"
          y1="90"
          x2="150"
          y2="150"
          stroke="black"
          strokeWidth="4"
        />
      )}

      {/* Left arm: appears when incorrectGuesses > 2 */}
      {incorrectGuesses > 2 && (
        <line
          x1="150"
          y1="110"
          x2="120"
          y2="90"
          stroke="black"
          strokeWidth="4"
        />
      )}

      {/* Right arm: appears when incorrectGuesses > 3 */}
      {incorrectGuesses > 3 && (
        <line
          x1="150"
          y1="110"
          x2="180"
          y2="90"
          stroke="black"
          strokeWidth="4"
        />
      )}

      {/* Left leg: appears when incorrectGuesses > 4 */}
      {incorrectGuesses > 4 && (
        <line
          x1="150"
          y1="150"
          x2="120"
          y2="180"
          stroke="black"
          strokeWidth="4"
        />
      )}

      {/* Right leg: appears when incorrectGuesses > 5 */}
      {incorrectGuesses > 5 && (
        <line
          x1="150"
          y1="150"
          x2="180"
          y2="180"
          stroke="black"
          strokeWidth="4"
        />
      )}
    </svg>
  );
}
