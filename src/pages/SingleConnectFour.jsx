import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;

// create an empty board
const makeEmpty = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

// scan for winner and winning line
const DIRECTIONS = [
  { dr: 0, dc: 1 },   // →
  { dr: 1, dc: 0 },   // ↓
  { dr: 1, dc: 1 },   // ↘
  { dr: 1, dc: -1 }   // ↙
];
function getWinnerInfo(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      if (!p) continue;
      for (let { dr, dc } of DIRECTIONS) {
        const line = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (
            nr < 0 || nr >= ROWS ||
            nc < 0 || nc >= COLS ||
            board[nr][nc] !== p
          ) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return { winner: p, line };
      }
    }
  }
  return { winner: null, line: null };
}

// simple AI: win/block then random
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
  // block X
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
  const choices = [...Array(COLS).keys()].filter(c => dropRow(board, c) !== null);
  return choices[Math.floor(Math.random() * choices.length)];
}

// find lowest empty row in a column
function dropRow(board, c) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][c]) return r;
  }
  return null;
}

export default function SingleConnectFour() {
  const [board, setBoard] = useState(makeEmpty());
  const [turnRed, setTurnRed] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winInfo, setWinInfo] = useState({ winner: null, line: null });
  const navigate = useNavigate();
  const aiTimer = useRef(null);

  // on board or turn change, check win/draw or let AI move
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
    // AI’s turn
    if (!turnRed && !gameOver) {
      aiTimer.current = setTimeout(() => {
        const col = pickComputerMove(board.map(r => [...r]));
        const r = dropRow(board, col);
        if (r !== null) {
          setBoard(b => {
            const nb = b.map(r => [...r]);
            nb[r][col] = 'Y';
            return nb;
          });
          setTurnRed(true);
        }
      }, 600);
    }
    return () => clearTimeout(aiTimer.current);
  }, [board, turnRed, gameOver]);

  const handleColumnClick = c => {
    if (gameOver || !turnRed) return;
    const r = dropRow(board, c);
    if (r === null) return;
    setBoard(b => {
      const nb = b.map(r => [...r]);
      nb[r][c] = 'R';
      return nb;
    });
    setTurnRed(false);
  };

  const reset = () => {
    clearTimeout(aiTimer.current);
    setBoard(makeEmpty());
    setTurnRed(true);
    setGameOver(false);
    setWinInfo({ winner: null, line: null });
  };
  const quit = () => navigate('/dashboard');

  const { winner, line } = winInfo;
  const statusText =
    winner === 'R' ? 'You win!' :
    winner === 'Y' ? 'Computer wins!' :
    winner === 'draw' ? 'Draw!' :
    turnRed ? 'Your turn' : 'Computer is thinking…';

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
              {cell && <div className={`disc ${cell==='R'?'red':'yellow'}`} />}
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

// generate strike class
function getStrikeClass(line) {
  const [[r0,c0],[r1,c1]] = line;
  if (r0 === r1) return `strike-row-${r0}`;
  if (c0 === c1) return `strike-col-${c0}`;
  const dr = r1 - r0, dc = c1 - c0;
  return dr === dc ? 'strike-diag-main' : 'strike-diag-anti';
}
