import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HangmanGame.css';

const words = ['javascript', 'firebase', 'netlify', 'react', 'playpal'];

function SingleHangman() {
  const [word, setWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [input, setInput] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setWord(words[Math.floor(Math.random() * words.length)]);
  }, []);

  useEffect(() => {
    if (word && word.split('').every(letter => guesses.includes(letter))) {
      setWin(true);
      setGameOver(true);
    } else if (incorrectGuesses >= 6) {
      setGameOver(true);
    }
  }, [guesses, incorrectGuesses, word]);

  const handleGuess = () => {
    if (!input || gameOver || guesses.includes(input.toLowerCase())) return;
    setGuesses([...guesses, input.toLowerCase()]);
    if (!word.includes(input.toLowerCase())) {
      setIncorrectGuesses(incorrectGuesses + 1);
    }
    setInput('');
  };

  const handleRestart = () => {
    setWord(words[Math.floor(Math.random() * words.length)]);
    setGuesses([]);
    setIncorrectGuesses(0);
    setInput('');
    setGameOver(false);
    setWin(false);
  };

  return (
    <div className="hangman-room">
      <h2>Single Player Hangman</h2>
      <HangmanDrawing incorrectGuesses={incorrectGuesses} />
      <p>{word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ')}</p>
      <p>Incorrect Guesses: {incorrectGuesses} / 6</p>
      {!gameOver ? (
        <>
          <input value={input} maxLength="1" onChange={(e) => setInput(e.target.value)} />
          <button onClick={handleGuess}>Guess</button>
        </>
      ) : (
        <>
          <h3>{win ? '🎉 You Win!' : `💀 You Lose! The word was ${word}`}</h3>
          <button onClick={handleRestart}>Rematch</button>
        </>
      )}
      <button onClick={() => navigate('/dashboard')}>Quit</button>
    </div>
  );
}

function HangmanDrawing({ incorrectGuesses }) {
  return (
    <svg height="250" width="200" className="hangman-drawing">
      <line x1="10" y1="240" x2="190" y2="240" stroke="black" strokeWidth="4" />
      <line x1="50" y1="240" x2="50" y2="20" stroke="black" strokeWidth="4" />
      <line x1="50" y1="20" x2="150" y2="20" stroke="black" strokeWidth="4" />
      <line x1="150" y1="20" x2="150" y2="50" stroke="black" strokeWidth="4" />
      {incorrectGuesses > 0 && <circle cx="150" cy="70" r="20" stroke="black" strokeWidth="4" fill="none" />}
      {incorrectGuesses > 1 && <line x1="150" y1="90" x2="150" y2="150" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 2 && <line x1="150" y1="110" x2="120" y2="90" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 3 && <line x1="150" y1="110" x2="180" y2="90" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 4 && <line x1="150" y1="150" x2="120" y2="180" stroke="black" strokeWidth="4" />}
      {incorrectGuesses > 5 && <line x1="150" y1="150" x2="180" y2="180" stroke="black" strokeWidth="4" />}
    </svg>
  );
}

export default SingleHangman;
