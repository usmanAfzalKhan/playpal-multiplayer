// src/pages/SingleTicTacToe.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './TicTacToe.css';

const initialBoard = Array(9).fill(null);

export default function SingleTicTacToe() {
  const [board, setBoard] = useState(initialBoard);
  const [xIsNext, setXIsNext] = useState(true);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  // get both winner and the winning line for strike-through
  const { winner, line } = getWinnerInfo(board);

  // status text: your turn vs. computer thinking vs. final result
  const status = winner
    ? `Winner: ${winner}`
    : board.every(cell => cell)
      ? 'Draw!'
      : xIsNext
        ? 'Your turn (X)'
        : 'Computer is thinking…';

  // handle player's click; only when X’s turn and cell empty
  function handleClick(i) {
    if (!xIsNext || board[i] || winner) return;
    const next = board.slice();
    next[i] = 'X';
    setBoard(next);
    setXIsNext(false);
  }

  // computer move on O’s turn
  useEffect(() => {
    if (xIsNext || winner) return;
    const empty = board
      .map((c, idx) => (c ? null : idx))
      .filter(i => i !== null);

    if (!empty.length) return;

    timeoutRef.current = setTimeout(() => {
      // 1. Winning move?
      for (let idx of empty) {
        const test = [...board];
        test[idx] = 'O';
        if (getWinnerInfo(test).winner === 'O') {
          makeOMove(idx);
          return;
        }
      }
      // 2. Block X’s winning move?
      for (let idx of empty) {
        const test = [...board];
        test[idx] = 'X';
        if (getWinnerInfo(test).winner === 'X') {
          makeOMove(idx);
          return;
        }
      }
      // 3. Take center if free
      if (empty.includes(4)) {
        makeOMove(4);
        return;
      }
      // 4. Otherwise random
      const choice = empty[Math.floor(Math.random() * empty.length)];
      makeOMove(choice);
    }, 500);

    function makeOMove(i) {
      setBoard(b => {
        const nb = [...b];
        nb[i] = 'O';
        return nb;
      });
      setXIsNext(true);
    }

    return () => clearTimeout(timeoutRef.current);
  }, [xIsNext, board, winner]);

  function reset() {
    clearTimeout(timeoutRef.current);
    setBoard(initialBoard);
    setXIsNext(true);
  }

  function quit() {
    clearTimeout(timeoutRef.current);
    navigate('/dashboard');
  }

  return (
    <div className="ttt-container">
      <h2>Single Player Tic-Tac-Toe</h2>
      <p className="ttt-status">{status}</p>
      <div className="ttt-board">
        {line && <div className={`strike-line ${strikeClass(line)}`} />}
        {board.map((cell, i) => (
          <button
            key={i}
            className="ttt-cell"
            onClick={() => handleClick(i)}
          >
            {cell}
          </button>
        ))}
      </div>
      <button className="ttt-reset" onClick={reset}>
        Reset
      </button>
      <button className="ttt-quit" onClick={quit}>
        Quit
      </button>
    </div>
  );
}

// returns { winner, line } or { null, null }
function getWinnerInfo(sq) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (let line of lines) {
    const [a,b,c] = line;
    if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) {
      return { winner: sq[a], line };
    }
  }
  return { winner: null, line: null };
}

function strikeClass([a,b,c]) {
  if (a===0&&b===1&&c===2) return 'strike-row-1';
  if (a===3&&b===4&&c===5) return 'strike-row-2';
  if (a===6&&b===7&&c===8) return 'strike-row-3';
  if (a===0&&b===3&&c===6) return 'strike-col-1';
  if (a===1&&b===4&&c===7) return 'strike-col-2';
  if (a===2&&b===5&&c===8) return 'strike-col-3';
  if (a===0&&b===4&&c===8) return 'strike-diag-main';
  if (a===2&&b===4&&c===6) return 'strike-diag-anti';
  return '';
}
