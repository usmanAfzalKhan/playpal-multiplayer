// src/pages/SinglePlayerBattleship.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Battleship.css';  // adjust path if needed

const GRID_SIZE = 10;
const SHIP_SIZES = [5, 4, 3, 3, 2];

function generateEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ hasShip: false, hit: false }))
  );
}

function placeShipsRandomly(grid) {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  SHIP_SIZES.forEach(size => {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      let fits = true;
      for (let i = 0; i < size; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        if (r >= GRID_SIZE || c >= GRID_SIZE || newGrid[r][c].hasShip) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let i = 0; i < size; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        newGrid[r][c].hasShip = true;
      }
      placed = true;
    }
  });
  return newGrid;
}

export default function SinglePlayerBattleship() {
  const navigate = useNavigate();
  const [playerGrid, setPlayerGrid] = useState(generateEmptyGrid());
  const [aiGrid, setAiGrid]         = useState(generateEmptyGrid());
  const [turn, setTurn]             = useState('player');
  const [message, setMessage]       = useState('Your turn!');
  const [gameOver, setGameOver]     = useState(false);

  // place ships on mount
  useEffect(() => {
    setPlayerGrid(g => placeShipsRandomly(g));
    setAiGrid(g => placeShipsRandomly(g));
  }, []);

  // check if all ships on a grid have been hit
  const allSunk = grid =>
    grid.flat().filter(cell => cell.hasShip).every(cell => cell.hit);

  // count ships remaining
  const countRemaining = grid =>
    grid.flat().filter(cell => cell.hasShip && !cell.hit).length;

  // player fires
  const handleFire = (r, c) => {
    if (gameOver || turn !== 'player') return;
    setAiGrid(prev => {
      const next = prev.map(row => row.map(cell => ({ ...cell })));
      if (next[r][c].hit) return prev;
      next[r][c].hit = true;
      if (allSunk(next)) {
        setGameOver(true);
        setMessage('🎉 You sank all the ships! You win!');
      } else {
        setMessage(next[r][c].hasShip ? 'Hit!' : 'Miss!');
        setTurn('ai');
      }
      return next;
    });
  };

  // AI fires back
  useEffect(() => {
    if (turn !== 'ai' || gameOver) return;
    const timeout = setTimeout(() => {
      let r, c;
      do {
        r = Math.floor(Math.random() * GRID_SIZE);
        c = Math.floor(Math.random() * GRID_SIZE);
      } while (playerGrid[r][c].hit);
      const next = playerGrid.map(row => row.map(cell => ({ ...cell })));
      next[r][c].hit = true;
      if (allSunk(next)) {
        setGameOver(true);
        setMessage('💥 Your fleet has been wiped out. You lose.');
      } else {
        setMessage(next[r][c].hasShip ? 'AI hits you!' : 'AI misses');
        setPlayerGrid(next);
        setTurn('player');
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [turn, playerGrid, gameOver]);

  // render grid helper
  const renderGrid = (grid, onClickCell, hideShips = false) => (
    <div className="battleship-grid">
      {grid.map((row, r) =>
        row.map((cell, c) => {
          let cls = 'unclicked';
          if (cell.hit) cls = cell.hasShip ? 'hit' : 'miss';
          const showShip = cell.hasShip && !hideShips;
          return (
            <div
              key={`${r}-${c}`}
              className={`${cls}${showShip ? ' ship' : ''}`}
              onClick={() => onClickCell(r, c)}
            />
          );
        })
      )}
    </div>
  );

  const playerRemaining = countRemaining(playerGrid);
  const aiRemaining     = countRemaining(aiGrid);

  return (
    <div className="battleship-container">
      <h2>Battleship: Single Player</h2>
      <p className="explanation">
        Welcome to Battleship! Your mission is to locate and sink all enemy ships
        before yours are destroyed. Click on a square in <strong>Enemy Waters</strong> to fire.
        🔴 = hit  🔵 = miss. Track remaining ships and good luck!
      </p>

      <div className="status-bar">
        <span>Your ships remaining: {playerRemaining}</span>
        <span> | Enemy ships remaining: {aiRemaining}</span>
      </div>

      <p className="status">{message}</p>

      <div className="battleship-boards">
        <div>
          <h3>Your Board</h3>
          {renderGrid(playerGrid, () => {}, false)}
        </div>
        <div>
          <h3>Enemy Waters</h3>
          {renderGrid(aiGrid, handleFire, true)}
        </div>
      </div>

      <div className="controls">
        {gameOver && (
          <button
            className="restart-btn"
            onClick={() => window.location.reload()}
          >
            ▶️ Play Again
          </button>
        )}
        <button className="quit-btn" onClick={() => navigate('/dashboard')}>
          ❌ Quit to Dashboard
        </button>
      </div>
    </div>
  );
}
