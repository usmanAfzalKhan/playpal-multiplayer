// src/pages/SingleConnectFour.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;

// make an empty ROWS×COLS board
const makeEmpty = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

// the four directions we need to scan for 4-in-a-row
const DIRECTIONS = [
  { dr: 0, dc: 1 },   // →
  { dr: 1, dc: 0 },   // ↓
  { dr: 1, dc: 1 },   // ↘
  { dr: 1, dc: -1 }   // ↙
];

// drop a disc into column `col`, return the final row index or null if full
function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return null;
}

// scan the board for a winner and return { winner, line }
function getWinnerInfo(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (let { dr, dc } of DIRECTIONS) {
        const line = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (
            nr < 0 || nr >= ROWS ||
            nc < 0 || nc >= COLS ||
            board[nr][nc] !== p
          ) {
            line.length = 0;
            break;
          }
          line.push([nr, nc]);
        }
        if (line.length === 4) {
          return { winner: p, line };
        }
      }
    }
  }
  return { winner: null, line: null };
}

// simple AI: try win, then block, else random
function pickComputerMove(board) {
  // try win
  for (let c = 0; c < COLS; c++) {
    const r = dropRow(board, c);
    if (r === null) continue;
    board[r][c] = 'Y';
    if (getWinnerInfo(board).winner === 'Y') {
      board[r][c] = null;
      return c;
    }
    board[r][c] = null;
  }
  // try block opponent
  for (let c = 0; c < COLS; c++) {
    const r = dropRow(board, c);
    if (r === null) continue;
    board[r][c] = 'R';
    if (getWinnerInfo(board).winner === 'R') {
      board[r][c] = null;
      return c;
    }
    board[r][c] = null;
  }
  // random
  const choices = [];
  for (let c = 0; c < COLS; c++) {
    if (dropRow(board, c) !== null) choices.push(c);
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

// map a winning 4-in-a-row to a CSS class
function getStrikeClass(line) {
  const [[r0, c0], [r1, c1]] = line;
  if (r0 === r1) return `strike-row-${r0}`;
  if (c0 === c1) return `strike-col-${c0}`;
  // diagonal
  return c1 > c0 ? 'strike-diag-main' : 'strike-diag-anti';
}

export default function SingleConnectFour() {
  const [board, setBoard] = useState(makeEmpty());
  const [turnRed, setTurnRed] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winInfo, setWinInfo] = useState({ winner: null, line: null });
  const navigate = useNavigate();
  const aiTimer = useRef();

  // on every board or turn change: check win/draw, or let AI move
  useEffect(() => {
    const info = getWinnerInfo(board);
    if (info.winner) {
      setWinInfo(info);
      setGameOver(true);
      return;
    }
    if (board.every(row => row.every(cell => cell))) {
      setWinInfo({ winner: 'draw', line: null });
      setGameOver(true);
      return;
    }
    // AI turn
    if (!turnRed && !gameOver) {
      aiTimer.current = setTimeout(() => {
        const move = pickComputerMove(board.map(r => [...r]));
        const r = dropRow(board, move);
        if (r !== null) {
          const nb = board.map(r => [...r]);
          nb[r][move] = 'Y';
          setBoard(nb);
          setTurnRed(true);
        }
      }, 600);
    }
    return () => clearTimeout(aiTimer.current);
  }, [board, turnRed, gameOver]);

  function handleColumnClick(col) {
    if (!turnRed || gameOver) return;
    const r = dropRow(board, col);
    if (r === null) return;
    const nb = board.map(r => [...r]);
    nb[r][col] = 'R';
    setBoard(nb);
    setTurnRed(false);
  }

  function reset() {
    clearTimeout(aiTimer.current);
    setBoard(makeEmpty());
    setTurnRed(true);
    setGameOver(false);
    setWinInfo({ winner: null, line: null });
  }
  function quit() {
    navigate('/dashboard');
  }

  const { winner, line } = winInfo;
  const statusText =
    winner === 'R' ? 'You win!' :
    winner === 'Y' ? 'Computer wins!' :
    winner === 'draw' ? 'Draw!' :
    turnRed ? 'Your turn' :
    'Computer is thinking…';

  return (
    <div className="c4-container">
      <h2>Single Player Connect Four</h2>
      <p className="c4-status">{statusText}</p>

      <div className="c4-board">
        {line && <div className={`c4-strike ${getStrikeClass(line)}`} />}
        {board.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className="c4-cell"
              onClick={() => handleColumnClick(c)}
            >
              {cell && (
                <div className={`disc ${cell === 'R' ? 'red' : 'yellow'}`} />
              )}
            </div>
          ))
        )}
      </div>

      <div className="c4-actions">
        <button onClick={reset}>Reset</button>
        <button onClick={quit}>Quit</button>
      </div>
    </div>
  );
}
