import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './SingleHangman.css';

const words = ['javascript', 'firebase', 'netlify', 'react', 'playpal']; // Add more words!

function SingleHangman() {
  const [word, setWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [input, setInput] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    setWord(randomWord);
  }, []);

  const handleGuess = () => {
    if (!input || gameOver) return;

    const guess = input.toLowerCase();
    if (guesses.includes(guess)) return;

    setGuesses([...guesses, guess]);
    if (!word.includes(guess)) {
      setIncorrectGuesses(incorrectGuesses + 1);
    }

    setInput('');
  };

  useEffect(() => {
    if (word && word.split('').every(letter => guesses.includes(letter))) {
      setWin(true);
      setGameOver(true);
    } else if (incorrectGuesses >= 6) {
      setGameOver(true);
    }
  }, [guesses, incorrectGuesses, word]);

  const handleRestart = () => {
    navigate('/hangman/single');
    window.location.reload();
  };

  const renderDrawing = () => {
    return <img src={`/hangman-${incorrectGuesses}.png`} alt={`Hangman ${incorrectGuesses}`} className="hangman-drawing" />;
  };

  return (
    <div className="hangman-room">
      <h2>Single Player Hangman</h2>
      {renderDrawing()}
      <p>Word: {word.split('').map(letter => (guesses.includes(letter) ? letter : '_')).join(' ')}</p>
      <p>Incorrect Guesses: {incorrectGuesses} / 6</p>
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
          <h3>{win ? '🎉 You Win!' : `💀 You Lose! The word was ${word}`}</h3>
          <button onClick={handleRestart}>Rematch</button>
          <button onClick={() => navigate('/dashboard')}>Quit</button>
        </>
      )}
    </div>
  );
}

export default SingleHangman;
