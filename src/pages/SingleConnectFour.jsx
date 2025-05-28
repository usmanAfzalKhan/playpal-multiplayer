// src/pages/SingleConnectFour.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ConnectFour.css';

const COLS = 7;
const ROWS = 6;

// factory for an empty board
const makeEmpty = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

// all four directions to scan for a win
const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
];

// find a winner and the exact 4‐cell line
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
          ) {
            line.length = 0;
            break;
          }
          line.push([nr, nc]);
        }
        if (line.length === 4) return { winner: p, line };
      }
    }
  }
  return { winner: null, line: null };
}

// simple AI that first tries to win/block then random
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

// find the row a disc will drop to
function dropRow(board, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r;
  }
  return null;
}

export default function SingleConnectFour() {
  const [board, setBoard]     = useState(makeEmpty());
  const [turnRed, setTurnRed] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [winInfo, setWinInfo] = useState({ winner: null, line: null });
  const navigate               = useNavigate();
  const aiTimer                = useRef();

  // after every move, check for win/draw, or let AI go
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
        const col = pickComputerMove(board.map(r => [...r]));
        const r   = dropRow(board, col);
        if (r !== null) {
          const nb = board.map(r => [...r]);
          nb[r][col] = 'Y';
          setBoard(nb);
          setTurnRed(true);
        }
      }, 600);
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

  // **compute inline style** for the little strike‐through bar
  const strikeStyle = line && (() => {
    const [[r0,c0],[r1,c1]] = line;
    // center of first cell in %
    const leftPct = (c0 + 0.5) * 100 / COLS;
    const topPct  = (r0 + 0.5) * 100 / ROWS;
    // vector difference in “cells”
    const dx = c1 - c0, dy = r1 - r0;
    // compute length in % of width
    const lenPct = Math.hypot(
      dx * (100/COLS),
      dy * (100/ROWS)
    );
    // angle in degrees
    const angle = Math.atan2(dy * (100/ROWS), dx * (100/COLS)) * 180/Math.PI;
    return {
      left: `${leftPct}%`,
      top:  `${topPct}%`,
      width: `${lenPct}%`,
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      transformOrigin: '0 0'
    };
  })();

  return (
    <div className="c4-container">
      <h2>Single Player Connect Four</h2>
      <p className="c4-status">{statusText}</p>

      <div className="c4-board">
        {line && (
          <div className="c4-strike" style={strikeStyle} />
        )}
        {board.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className="c4-cell"
              onClick={() => handleColumnClick(c)}
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
