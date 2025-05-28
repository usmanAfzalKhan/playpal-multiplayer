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

  // get both winner and the winning line
  const { winner, line } = getWinnerInfo(board);

  // build status text
  const status = winner
    ? `Winner: ${winner}`
    : board.every(cell => cell)
      ? 'Draw!'
      : xIsNext
        ? 'Your turn (X)'
        : 'Computer is thinking…';

  // player click handler (only X on their turn, and not after game over)
  function handleClick(i) {
    if (!xIsNext || board[i] || winner) return;
    updateBoard(i, 'X', false);
  }

  // helper to apply a move
  function updateBoard(idx, symbol, nextTurnX) {
    setBoard(b => {
      const nb = [...b];
      nb[idx] = symbol;
      return nb;
    });
    setXIsNext(nextTurnX);
  }

  // computer uses Minimax to pick the optimal move after 500ms
  useEffect(() => {
    if (!xIsNext && !winner) {
      timeoutRef.current = setTimeout(() => {
        const move = findBestMove(board);
        updateBoard(move, 'O', true);
      }, 500);
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
      <div className="ttt-actions">
        <button onClick={reset}>Reset</button>
        <button onClick={quit}>Quit</button>
      </div>
    </div>
  );
}

// Minimax implementation
function findBestMove(board) {
  let bestVal = -Infinity;
  let bestMove = null;
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = 'O';
      const moveVal = minimax(board, 0, false);
      board[i] = null;
      if (moveVal > bestVal) {
        bestVal = moveVal;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

// returns +1 if O wins, -1 if X wins, 0 for draw
function minimax(bd, depth, isMax) {
  const { winner } = getWinnerInfo(bd);
  if (winner === 'O') return  1;
  if (winner === 'X') return -1;
  if (bd.every(c => c))       return  0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!bd[i]) {
        bd[i] = 'O';
        best = Math.max(best, minimax(bd, depth + 1, false));
        bd[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!bd[i]) {
        bd[i] = 'X';
        best = Math.min(best, minimax(bd, depth + 1, true));
        bd[i] = null;
      }
    }
    return best;
  }
}

// returns { winner: 'X'|'O'|null, line: [i,j,k]|null }
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

// map a winning triple to a CSS class
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
