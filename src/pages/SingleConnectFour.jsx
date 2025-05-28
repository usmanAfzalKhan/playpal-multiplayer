import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;

// Create an empty ROWS×COLS board
function makeEmpty() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

// Directions to check for 4-in-a-row
const DIRECTIONS = [
  { dr: 0, dc: 1 },   // ↔ horizontal
  { dr: 1, dc: 0 },   // ↕ vertical
  { dr: 1, dc: 1 },   // ↘ diag
  { dr: 1, dc: -1 }   // ↙ anti-diag
];

// Scan the board for a winner; returns { winner: 'R'|'Y'|null, line: [[r,c],…] }
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

// Find the lowest empty row in a column, or null
function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return null;
}

// AI: Win if possible, block if needed, else random
function pickComputerMove(board) {
  // try winning
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
  // try blocking X
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
  // else random
  const choices = [];
  for (let c = 0; c < COLS; c++) {
    if (dropRow(board, c) !== null) choices.push(c);
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

export default function SingleConnectFour() {
  const [board, setBoard]     = useState(makeEmpty());
  const [turnRed, setTurnRed] = useState(true);   // R = you, Y = computer
  const [gameOver, setGameOver] = useState(false);
  const [winInfo, setWinInfo] = useState({ winner: null, line: null });
  const aiTimer = useRef();
  const navigate = useNavigate();

  // 1) Recalculate win/draw any time the board changes
  useEffect(() => {
    const info = getWinnerInfo(board);
    if (info.winner || board.every(row => row.every(cell => cell))) {
      setWinInfo(info.winner
        ? info
        : { winner: 'draw', line: null }
      );
      setGameOver(true);
      clearTimeout(aiTimer.current);
    }
  }, [board]);

  // 2) If it’s Yellow’s turn and game isn’t over, let the AI play after a short delay
  useEffect(() => {
    if (!turnRed && !gameOver) {
      aiTimer.current = setTimeout(() => {
        // give AI a fresh copy to simulate on:
        const sim = board.map(row => [...row]);
        const c = pickComputerMove(sim);
        const r = dropRow(board, c);
        if (r !== null) {
          const nb = board.map(row => [...row]);
          nb[r][c] = 'Y';
          setBoard(nb);
          setTurnRed(true);
        }
      }, 600);
    }
    return () => clearTimeout(aiTimer.current);
  }, [turnRed, gameOver, board]);

  // Player drops a red disc by clicking the top row cell for that column
  function handleColumnClick(c) {
    if (!turnRed || gameOver) return;
    const r = dropRow(board, c);
    if (r === null) return;
    const nb = board.map(row => [...row]);
    nb[r][c] = 'R';
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
    clearTimeout(aiTimer.current);
    navigate('/dashboard');
  }

  // Prepare status text
  const { winner, line } = winInfo;
  let statusText = '';
  if (winner === 'R') statusText = 'You win!';
  else if (winner === 'Y') statusText = 'Computer wins!';
  else if (winner === 'draw') statusText = 'Draw!';
  else statusText = turnRed ? 'Your turn' : 'Computer is thinking…';

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
              onClick={() => r === 0 && handleColumnClick(c)}
            >
              {cell && <div className={`disc ${cell === 'R' ? 'red' : 'yellow'}`} />}
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

// Convert winning 4 coordinates into a strike‐through CSS class
function getStrikeClass(line) {
  const [[r0, c0], [r1, c1]] = line;
  if (r0 === r1) return `strike-row-${r0}`;                // horizontal
  if (c0 === c1) return `strike-col-${c0}`;                // vertical
  const dr = r1 - r0, dc = c1 - c0;
  if (dr === dc) return 'strike-diag-main';
  return 'strike-diag-anti';
}
