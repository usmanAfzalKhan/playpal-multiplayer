import { useState } from 'react';
import './TicTacToe.css';

const initialBoard = Array(9).fill(null);

export default function SingleTicTacToe() {
  const [board, setBoard] = useState(initialBoard);
  const [xIsNext, setXIsNext] = useState(true);

  const winner = calculateWinner(board);
  const status = winner
    ? `Winner: ${winner}`
    : board.every(cell => cell)
    ? 'Draw!'
    : `Next: ${xIsNext ? 'X' : 'O'}`;

  function handleClick(idx) {
    if (board[idx] || winner) return;
    const next = board.slice();
    next[idx] = xIsNext ? 'X' : 'O';
    setBoard(next);
    setXIsNext(!xIsNext);
  }

  function reset() {
    setBoard(initialBoard);
    setXIsNext(true);
  }

  return (
    <div className="ttt-container">
      <h2>Single Player Tic-Tac-Toe</h2>
      <p className="ttt-status">{status}</p>
      <div className="ttt-board">
        {board.map((cell, i) => (
          <button key={i} className="ttt-cell" onClick={() => handleClick(i)}>
            {cell}
          </button>
        ))}
      </div>
      <button className="ttt-reset" onClick={reset}>Reset</button>
    </div>
  );
}

function calculateWinner(sq) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (let [a,b,c] of lines) {
    if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) return sq[a];
  }
  return null;
}
