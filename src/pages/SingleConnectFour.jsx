import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;

const makeEmpty = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const DIRECTIONS = [
  { dr: 0, dc: 1 },   // horizontal
  { dr: 1, dc: 0 },   // vertical
  { dr: 1, dc: 1 },   // diag ↘
  { dr: 1, dc: -1 }   // diag ↙
];

function getWinnerInfo(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (let { dr, dc } of DIRECTIONS) {
        const line = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i,
                nc = c + dc * i;
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

function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return null;
}

// simple AI: win if possible, block if needed, else random
function pickComputerMove(board) {
  // copy-and-test helper
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
  const choices = [...Array(COLS).keys()].filter(c => dropRow(board, c) !== null);
  return choices[Math.floor(Math.random() * choices.length)];
}

export default function SingleConnectFour() {
  const [board, setBoard] = useState(makeEmpty());
  const [turnRed, setTurnRed] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winInfo, setWinInfo] = useState({ winner: null, line: null });
  const navigate = useNavigate();
  const aiTimer = useRef(null);

  // game loop: check win/draw, or let AI move
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
      }, 500);
    }
    return () => clearTimeout(aiTimer.current);
  }, [board, turnRed, gameOver]);

  function handleColumnClick(c) {
    if (gameOver || !turnRed) return;
    const r = dropRow(board, c);
    if (r === null) return;
    const nb = board.map(r => [...r]);
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
        {board.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className={`c4-cell ${line?.some(([lr,lc])=>lr===r&&lc===c) ? 'highlight' : ''}`}
              onClick={() => r === 0 && handleColumnClick(c)}
            >
              <div className={`disc ${cell === 'R' ? 'red' : cell === 'Y' ? 'yellow' : ''}`} />
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
