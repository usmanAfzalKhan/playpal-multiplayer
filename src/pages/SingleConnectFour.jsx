// src/pages/SingleConnectFour.jsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./ConnectFour.css";

// Constants defining the board dimensions
const COLS = 7; // Number of columns in Connect Four
const ROWS = 6; // Number of rows in Connect Four

// Helper to create an empty board: a 2D array of nulls
const makeEmpty = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

// Directions to check for a winning streak of four discs
const DIRECTIONS = [
  { dr: 0, dc: 1 }, // horizontal (→)
  { dr: 1, dc: 0 }, // vertical (↓)
  { dr: 1, dc: 1 }, // diagonal down-right (↘)
  { dr: 1, dc: -1 }, // diagonal down-left (↙)
];

/**
 * Scans the board to find a winning line of four same‐color discs.
 * @param {Array<Array<string|null>>} board - 2D array representing the grid.
 * @returns {Object} - { winner: 'R'|'Y'|null, line: [[r,c],...]|null }
 */
function getWinnerInfo(board) {
  // Iterate over every cell in the grid
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]; // Current cell's owner ('R', 'Y', or null)
      if (!p) continue; // Skip empty cells
      // Check each direction for 4‐in‐a‐row
      for (let { dr, dc } of DIRECTIONS) {
        const line = [[r, c]]; // Track the cells that form a potential line
        // Look ahead up to 3 more cells
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          // Abort if out of bounds or cell mismatch
          if (
            nr < 0 ||
            nr >= ROWS ||
            nc < 0 ||
            nc >= COLS ||
            board[nr][nc] !== p
          ) {
            line.length = 0; // Invalidate this direction
            break;
          }
          line.push([nr, nc]); // Add matching cell to line
        }
        // If we found exactly 4 in a row, return winner and the line's coordinates
        if (line.length === 4) {
          return { winner: p, line };
        }
      }
    }
  }
  // No winner found
  return { winner: null, line: null };
}

/**
 * Given a board and a column index, returns the row index where a new disc
 * would land (first empty from bottom). Returns null if column is full.
 * @param {Array<Array<string|null>>} board
 * @param {number} col
 * @returns {number|null}
 */
function dropRow(board, col) {
  // Walk up from bottom row until an empty cell is found
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) return r; // Return the first empty row
  }
  return null; // Column is full
}

/**
 * Simple AI to pick computer's next move:
 * 1. Try to win (place 'Y' to complete four).
 * 2. Block opponent (place 'R' to prevent their win).
 * 3. Otherwise pick a random non‐full column.
 * @param {Array<Array<string|null>>} boardCopy - A shallow copy of the current board
 * @returns {number} - Column index chosen by AI
 */
function pickComputerMove(board) {
  // 1) Test every column to see if AI can win immediately
  for (let c = 0; c < COLS; c++) {
    const r = dropRow(board, c);
    if (r === null) continue; // Column full, skip
    board[r][c] = "Y"; // Simulate placing AI's disc
    if (getWinnerInfo(board).winner === "Y") {
      board[r][c] = null; // Revert simulation
      return c; // Return winning column
    }
    board[r][c] = null; // Revert simulation
  }
  // 2) Test every column to block if opponent can win next turn
  for (let c = 0; c < COLS; c++) {
    const r = dropRow(board, c);
    if (r === null) continue; // Column full, skip
    board[r][c] = "R"; // Simulate opponent's disc
    if (getWinnerInfo(board).winner === "R") {
      board[r][c] = null; // Revert simulation
      return c; // Return blocking column
    }
    board[r][c] = null; // Revert simulation
  }
  // 3) Otherwise choose a random valid column
  const choices = [...Array(COLS).keys()].filter(
    (c) => dropRow(board, c) !== null
  );
  return choices[Math.floor(Math.random() * choices.length)];
}

export default function SingleConnectFour() {
  // ─── State Hooks ───────────────────────────────────────────
  const [board, setBoard] = useState(makeEmpty()); // 2D array for the grid
  const [turnRed, setTurnRed] = useState(true); // true = player's turn, false = AI
  const [gameOver, setGameOver] = useState(false); // Flag for game end
  const [winInfo, setWinInfo] = useState({ winner: null, line: null }); // Winner data
  const navigate = useNavigate(); // For navigation (Quit)
  const aiTimer = useRef(null); // Timer reference for AI delay

  // ─── Main Game Loop / Side Effects ────────────────────────
  useEffect(() => {
    // Check for a winner or draw on every board or turn update
    const info = getWinnerInfo(board);
    if (info.winner) {
      setWinInfo(info); // Store winner and winning line
      setGameOver(true); // End the game
      return;
    }
    // Check for full board → draw
    if (board.every((row) => row.every((cell) => cell))) {
      setWinInfo({ winner: "draw", line: null });
      setGameOver(true);
      return;
    }
    // If it is AI's turn and game not over, schedule AI move
    if (!turnRed && !gameOver) {
      aiTimer.current = setTimeout(() => {
        // Pick column for AI
        const move = pickComputerMove(board.map((r) => [...r])); // Pass a copy
        const r = dropRow(board, move); // Find landing row
        if (r !== null) {
          const nb = board.map((r) => [...r]); // Copy board
          nb[r][move] = "Y"; // Place AI disc ('Y')
          setBoard(nb);
          setTurnRed(true); // Back to player's turn
        }
      }, 500); // Delay AI thinking by 500ms
    }
    // Cleanup: clear pending AI timer on re-render/unmount
    return () => clearTimeout(aiTimer.current);
  }, [board, turnRed, gameOver]);

  /**
   * Handler when player clicks a column to drop a red disc ('R').
   * Only works if game is not over and it's player's turn.
   * @param {number} c - Column index clicked
   */
  function handleColumnClick(c) {
    if (gameOver || !turnRed) return; // Ignore if not player's turn
    const r = dropRow(board, c); // Find landing row
    if (r === null) return; // Column is full, ignore
    const nb = board.map((row) => [...row]); // Copy the board
    nb[r][c] = "R"; // Place red disc
    setBoard(nb); // Update state
    setTurnRed(false); // Switch to AI's turn
  }

  /**
   * Reset the game to initial empty state.
   */
  function reset() {
    clearTimeout(aiTimer.current); // Cancel any AI timer
    setBoard(makeEmpty()); // Reset board
    setTurnRed(true); // Player begins
    setGameOver(false); // Clear game over flag
    setWinInfo({ winner: null, line: null }); // Clear winner info
  }
  /**
   * Quit to dashboard: clear any timers and navigate away
   */
  function quit() {
    clearTimeout(aiTimer.current);
    navigate("/dashboard");
  }

  // Prepare status text based on winner or turn
  const { winner, line } = winInfo;
  const statusText =
    winner === "R"
      ? "You win!"
      : winner === "Y"
      ? "Computer wins!"
      : winner === "draw"
      ? "Draw!"
      : turnRed
      ? "Your turn"
      : "Computer is thinking…";

  return (
    <div className="c4-container">
      <h2>Single Player Connect Four</h2>
      <p className="c4-status">{statusText}</p>

      {/* ─── Board Grid ────────────────────────────────────── */}
      <div className="c4-board">
        {board.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              // Highlight if this cell is part of the winning line
              className={`c4-cell ${
                line?.some(([lr, lc]) => lr === r && lc === c)
                  ? "highlight"
                  : ""
              }`}
              // Allow clicking only on the top row (r === 0) to drop a disc into column c
              onClick={() => r === 0 && handleColumnClick(c)}
            >
              {/* Disc inside the cell: red for 'R', yellow for 'Y', or empty */}
              <div
                className={`disc ${
                  cell === "R" ? "red" : cell === "Y" ? "yellow" : ""
                }`}
              />
            </div>
          ))
        )}
      </div>

      {/* ─── Control Buttons ───────────────────────────────── */}
      <div className="c4-actions">
        <button onClick={reset}>Reset</button>
        <button onClick={quit}>Quit</button>
      </div>
    </div>
  );
}
