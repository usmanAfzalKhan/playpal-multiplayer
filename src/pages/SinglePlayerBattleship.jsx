// src/pages/SinglePlayerBattleship.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Battleship.css"; // Import styling for the Battleship game

// ─── Game Configuration Constants ────────────────────────────

// Dimensions of the Battleship grid (10×10)
const GRID_SIZE = 10;

// Array of ship sizes to place on the grid:
// Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2)
const SHIP_SIZES = [5, 4, 3, 3, 2];

/**
 * generateEmptyGrid()
 * Creates a 10×10 grid where each cell is an object:
 *   { hasShip: false, hit: false }
 * - hasShip: whether a ship occupies this cell
 * - hit: whether this cell has been fired upon
 */
function generateEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ hasShip: false, hit: false }))
  );
}

/**
 * placeShipsRandomly(grid)
 * Given an empty grid, randomly places ships of lengths in SHIP_SIZES.
 * Ships may be horizontal or vertical. Ensures no overlap or out-of-bounds.
 * Returns a new grid with `hasShip: true` in ship cells.
 */
function placeShipsRandomly(grid) {
  // Deep copy the grid so we do not modify the original reference
  const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

  SHIP_SIZES.forEach((size) => {
    let placed = false;

    // Keep trying random positions/orientations until the ship is placed
    while (!placed) {
      const horizontal = Math.random() < 0.5; // 50% chance horizontal vs vertical
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);

      // Check if ship of length `size` fits without overlapping
      let fits = true;
      for (let i = 0; i < size; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        // If out of bounds or cell already has a ship → does not fit
        if (r >= GRID_SIZE || c >= GRID_SIZE || newGrid[r][c].hasShip) {
          fits = false;
          break;
        }
      }
      if (!fits) continue; // Retry random placement if it doesn't fit

      // Mark each cell in the chosen orientation as containing a ship
      for (let i = 0; i < size; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        newGrid[r][c].hasShip = true;
      }
      placed = true; // Exit loop once ship is successfully placed
    }
  });

  return newGrid;
}

export default function SinglePlayerBattleship() {
  const navigate = useNavigate(); // Allows navigation back to Dashboard

  // ─── Component State ────────────────────────────────────────

  // Player's grid with ships/hits
  const [playerGrid, setPlayerGrid] = useState(generateEmptyGrid());

  // AI's grid (hidden from player until hit/miss)
  const [aiGrid, setAiGrid] = useState(generateEmptyGrid());

  // Tracks whose turn it is: 'player' or 'ai'
  const [turn, setTurn] = useState("player");

  // Message displayed (e.g., "Hit!", "Miss!", victory/defeat)
  const [message, setMessage] = useState("Your turn!");

  // Flag to indicate if the game has ended
  const [gameOver, setGameOver] = useState(false);

  // ─── 1) PLACE SHIPS ON MOUNT ────────────────────────────────
  useEffect(() => {
    // On component mount, randomly place ships for both player and AI
    setPlayerGrid((g) => placeShipsRandomly(g));
    setAiGrid((g) => placeShipsRandomly(g));
  }, []);

  /**
   * allSunk(grid)
   * Returns true if all ship cells (hasShip) on the grid have been hit.
   */
  const allSunk = (grid) =>
    grid
      .flat() // Flatten 2D array to 1D
      .filter((cell) => cell.hasShip) // Keep only cells that have ships
      .every((cell) => cell.hit); // Ensure every ship cell is hit

  /**
   * countRemaining(grid)
   * Counts how many ship cells remain un-hit on the given grid.
   * This helps display the number of ships (cells) left.
   */
  const countRemaining = (grid) =>
    grid.flat().filter((cell) => cell.hasShip && !cell.hit).length;

  // ─── 2) PLAYER FIRES AT AI GRID ─────────────────────────────

  /**
   * handleFire(r, c)
   * Called when player clicks a cell in the AI grid (Enemy Waters).
   * - If the game is over or it's not the player's turn, do nothing.
   * - Otherwise, mark that cell as hit. If it was a ship → "Hit!" and check victory.
   *   If all AI ships are sunk → game over and player wins.
   *   Else switch to AI turn and display "Miss!" if no ship was there.
   */
  const handleFire = (r, c) => {
    if (gameOver || turn !== "player") return;

    setAiGrid((prev) => {
      // Deep copy previous grid
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));

      // If that cell was already hit, do nothing
      if (next[r][c].hit) return prev;

      next[r][c].hit = true; // Mark this cell as hit

      // If after hitting, all AI ships are sunk → player wins
      if (allSunk(next)) {
        setGameOver(true);
        setMessage("🎉 You sank all the ships! You win!");
      } else {
        // Not all sunk: check if this hit a ship
        if (next[r][c].hasShip) {
          setMessage("Hit!");
        } else {
          setMessage("Miss!");
        }
        // Switch turn to AI
        setTurn("ai");
      }
      return next;
    });
  };

  // ─── 3) AI FIRES BACK AFTER PLAYER TURN ────────────────────
  useEffect(() => {
    // If it's AI's turn and game is not over, wait 800ms and then fire
    if (turn !== "ai" || gameOver) return;

    const timeout = setTimeout(() => {
      let r, c;

      // AI picks random coordinates until it finds one not yet hit
      do {
        r = Math.floor(Math.random() * GRID_SIZE);
        c = Math.floor(Math.random() * GRID_SIZE);
      } while (playerGrid[r][c].hit);

      // Mark that cell as hit
      const next = playerGrid.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].hit = true;

      // If after AI hits, all player ships are sunk → AI wins
      if (allSunk(next)) {
        setGameOver(true);
        setMessage("💥 Your fleet has been wiped out. You lose.");
      } else {
        // Not all sunk: check if AI hit a ship
        if (next[r][c].hasShip) {
          setMessage("AI hits you!");
        } else {
          setMessage("AI misses");
        }
        // Update player's grid state and switch back to player's turn
        setPlayerGrid(next);
        setTurn("player");
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [turn, playerGrid, gameOver]);

  /**
   * renderGrid(grid, onClickCell, hideShips)
   * Renders a 10×10 grid of `<div>` cells.
   * Each cell may have classes:
   *   - 'unclicked' (default, not yet hit)
   *   - 'hit' (if it was hit and had a ship)
   *   - 'miss' (if it was hit and had no ship)
   *   - 'ship' (if hideShips===false and hasShip===true, to reveal player's ships)
   *
   * - onClickCell(r, c): called when a cell is clicked
   * - hideShips: if true, do not reveal ship positions (for AI grid)
   */
  const renderGrid = (grid, onClickCell, hideShips = false) => (
    <div className="battleship-grid">
      {grid.map((row, r) =>
        row.map((cell, c) => {
          // Determine CSS class based on hit status
          let cls = "unclicked";
          if (cell.hit) cls = cell.hasShip ? "hit" : "miss";

          // If hideShips is false (player's board), and cell.hasShip, add '.ship'
          const showShip = cell.hasShip && !hideShips;
          return (
            <div
              key={`${r}-${c}`}
              className={`${cls}${showShip ? " ship" : ""}`}
              onClick={() => onClickCell(r, c)}
            />
          );
        })
      )}
    </div>
  );

  // Count remaining ship cells for player and AI
  const playerRemaining = countRemaining(playerGrid);
  const aiRemaining = countRemaining(aiGrid);

  // ─── 4) RENDER BATTLEGROUND & CONTROLS ───────────────────────
  return (
    <div className="battleship-container">
      <h2>Battleship: Single Player</h2>
      <p className="explanation">
        Welcome to Battleship! Your mission is to locate and sink all enemy
        ships before yours are destroyed. Click on a square in{" "}
        <strong>Enemy Waters</strong> to fire. 🔴 = hit  🔵 = miss. Track
        remaining ships and good luck!
      </p>

      {/* Status bar showing how many ship cells remain for each side */}
      <div className="status-bar">
        <span>Your ships remaining: {playerRemaining}</span>
        <span> | Enemy ships remaining: {aiRemaining}</span>
      </div>

      {/* Message area (e.g. "Hit!", "Miss!", victory/defeat notices) */}
      <p className="status">{message}</p>

      {/* Render both player's grid and AI's grid side-by-side */}
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

      {/* Control buttons: Restart if game over, and Quit to Dashboard */}
      <div className="controls">
        {gameOver && (
          <button
            className="restart-btn"
            onClick={() => window.location.reload()}
          >
            ▶️ Play Again
          </button>
        )}
        <button className="quit-btn" onClick={() => navigate("/dashboard")}>
          ❌ Quit to Dashboard
        </button>
      </div>
    </div>
  );
}
