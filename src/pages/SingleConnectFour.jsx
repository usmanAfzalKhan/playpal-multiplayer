import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ConnectFour.css';

const ROWS = 6;
const COLS = 7;
const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

export default function SingleConnectFour() {
  const [grid, setGrid] = useState(emptyGrid);
  const [yourTurn, setYourTurn] = useState(true);
  const [winner, setWinner] = useState(null);
  const navigate = useNavigate();

  // check for 4-in-a-row
  const checkWin = (g) => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = g[r][c];
        if (!cell) continue;
        // horizontal
        if (
          c <= COLS - 4 &&
          cell === g[r][c + 1] &&
          cell === g[r][c + 2] &&
          cell === g[r][c + 3]
        )
          return cell;
        // vertical
        if (
          r <= ROWS - 4 &&
          cell === g[r + 1][c] &&
          cell === g[r + 2][c] &&
          cell === g[r + 3][c]
        )
          return cell;
        // diagonal down-right
        if (
          r <= ROWS - 4 &&
          c <= COLS - 4 &&
          cell === g[r + 1][c + 1] &&
          cell === g[r + 2][c + 2] &&
          cell === g[r + 3][c + 3]
        )
          return cell;
        // diagonal up-right
        if (
          r >= 3 &&
          c <= COLS - 4 &&
          cell === g[r - 1][c + 1] &&
          cell === g[r - 2][c + 2] &&
          cell === g[r - 3][c + 3]
        )
          return cell;
      }
    }
    return null;
  };

  // drop a disc of color 'R' or 'Y' into column
  const dropDisc = (g, col, color) => {
    const newGrid = g.map((row) => row.slice());
    for (let r = ROWS - 1; r >= 0; r--) {
      if (!newGrid[r][col]) {
        newGrid[r][col] = color;
        break;
      }
    }
    return newGrid;
  };

  // AI: first win, then block, then center, then random
  const aiMove = (g) => {
    // try winning move
    for (let c = 0; c < COLS; c++) {
      if (g[0][c]) continue;
      const trial = dropDisc(g, c, 'Y');
      if (checkWin(trial) === 'Y') return trial;
    }
    // try block player
    for (let c = 0; c < COLS; c++) {
      if (g[0][c]) continue;
      const trial = dropDisc(g, c, 'R');
      if (checkWin(trial) === 'R') return dropDisc(g, c, 'Y');
    }
    // center column
    const center = Math.floor(COLS / 2);
    if (!g[0][center]) return dropDisc(g, center, 'Y');
    // random
    const valid = [];
    for (let c = 0; c < COLS; c++) if (!g[0][c]) valid.push(c);
    const choice = valid[Math.floor(Math.random() * valid.length)];
    return dropDisc(g, choice, 'Y');
  };

  const handleClick = (col) => {
    if (!yourTurn || winner || grid[0][col]) return;
    // your move
    const afterYou = dropDisc(grid, col, 'R');
    setGrid(afterYou);
    const w1 = checkWin(afterYou);
    if (w1) {
      setWinner('You');
      return;
    }
    setYourTurn(false);
    // AI move after 300ms
    setTimeout(() => {
      const afterAI = aiMove(afterYou);
      setGrid(afterAI);
      const w2 = checkWin(afterAI);
      if (w2) setWinner('Computer');
      setYourTurn(true);
    }, 300);
  };

  const reset = () => {
    setGrid(emptyGrid);
    setWinner(null);
    setYourTurn(true);
  };
  const quit = () => navigate('/dashboard');

  const isFull = grid[0].every((c) => c);

  return (
    <div className="cf-container">
      <h2>Single Player Connect Four</h2>
      <p className="cf-status">
        {winner
          ? `${winner} wins!`
          : isFull
          ? 'Draw!'
          : yourTurn
          ? 'Your turn'
          : 'Computer thinking…'}
      </p>
      <div className="cf-board">
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className={`cf-cell ${
                cell === 'R' ? 'red' : cell === 'Y' ? 'yellow' : ''
              }`}
              onClick={() => handleClick(c)}
            />
          ))
        )}
      </div>
      <button onClick={reset}>Reset</button>
      <button onClick={quit}>Quit</button>
    </div>
  );
}
