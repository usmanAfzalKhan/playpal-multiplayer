import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SingleHangman.css";

const words = ["javascript", "hangman", "react", "firebase"];

function SingleHangman() {
  const [word, setWord] = useState("");
  const [guesses, setGuesses] = useState([]);
  const [incorrect, setIncorrect] = useState(0);
  const [input, setInput] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const navigate = useNavigate();

  const startGame = () => {
    const newWord = words[Math.floor(Math.random() * words.length)];
    setWord(newWord);
    setGuesses([]);
    setIncorrect(0);
    setInput("");
    setGameOver(false);
    setWin(false);
  };

  useEffect(() => startGame(), []);

  const handleGuess = () => {
    if (!input) return;
    const guess = input.toLowerCase();
    if (guesses.includes(guess)) return;
    setGuesses((prev) => [...prev, guess]);
    if (!word.includes(guess)) setIncorrect((prev) => prev + 1);
    setInput("");
  };

  useEffect(() => {
    if (word && word.split("").every((l) => guesses.includes(l))) {
      setGameOver(true);
      setWin(true);
    } else if (incorrect >= 6) {
      setGameOver(true);
    }
  }, [guesses, incorrect, word]);

  return (
    <div className="single-container">
      <h2>Single Player Hangman</h2>
      <p>{word.split("").map((l) => (guesses.includes(l) ? l : "_")).join(" ")}</p>
      <p>Incorrect: {incorrect} / 6</p>

      {!gameOver ? (
        <>
          <input
            type="text"
            maxLength="1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button onClick={handleGuess}>Guess</button>
        </>
      ) : (
        <>
          <h3>{win ? "🎉 You Win!" : `💀 Game Over! Word was ${word}`}</h3>
          <button onClick={startGame}>Rematch</button>
          <button onClick={() => navigate("/dashboard")}>Quit</button>
        </>
      )}
    </div>
  );
}

export default SingleHangman;
