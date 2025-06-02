// src/pages/SingleTicTacToe.jsx

// Import React hooks and navigation helper
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./TicTacToe.css";

// Initialize the board as an array of 9 nulls (3×3 grid)
const initialBoard = Array(9).fill(null);

export default function SingleTicTacToe() {
  // State to hold the current board configuration (9 cells)
  const [board, setBoard] = useState(initialBoard);
  // State to track whose turn it is: true = X’s turn, false = O’s turn
  const [xIsNext, setXIsNext] = useState(true);
  // useNavigate hook to programmatically navigate to other routes (e.g., quit game)
  const navigate = useNavigate();
  // useRef for holding a timeout ID (so we can clear it if needed)
  const timeoutRef = useRef(null);

  // Determine if there is a winner and get the winning line (if any)
  const { winner, line } = getWinnerInfo(board);

  // Construct the status text based on game state:
  // 1) If there’s a winner, show "Winner: X" or "Winner: O"
  // 2) If board is full (all cells non-null) and no winner, show "Draw!"
  // 3) Otherwise, if it's X’s turn, show "Your turn (X)"
  // 4) Otherwise, show "Computer is thinking…" while O is “thinking”
  const status = winner
    ? `Winner: ${winner}`
    : board.every((cell) => cell)
    ? "Draw!"
    : xIsNext
    ? "Your turn (X)"
    : "Computer is thinking…";

  /**
   * handleClick: Called when the user clicks on a cell.
   * - i = index 0–8 of the clicked cell.
   * - Only allow placement if:
   *     • It’s X’s turn (xIsNext is true).
   *     • That cell is currently empty (board[i] is null).
   *     • There is no winner yet (winner is null).
   */
  function handleClick(i) {
    if (!xIsNext || board[i] || winner) return;
    // Place 'X' at index i and switch turn to O
    updateBoard(i, "X", false);
  }

  /**
   * updateBoard: Updates the board state with a new move.
   * - idx: which cell index to place the move.
   * - symbol: 'X' or 'O' to place on that cell.
   * - nextTurnX: boolean whether after this move it’s X’s turn (true) or O’s turn (false).
   */
  function updateBoard(idx, symbol, nextTurnX) {
    setBoard((prevBoard) => {
      const newBoard = [...prevBoard];
      newBoard[idx] = symbol; // Place the symbol into the cell
      return newBoard;
    });
    setXIsNext(nextTurnX); // Update whose turn is next
  }

  /**
   * useEffect for the computer’s move (O):
   * - Trigger whenever xIsNext, board, or winner changes.
   * - If it’s not X’s turn (i.e., xIsNext is false) and there is no winner yet,
   *   schedule the computer’s move after a 500ms delay to simulate “thinking.”
   * - We store the timeout ID in timeoutRef to be able to clear it if the component unmounts or reset.
   */
  useEffect(() => {
    if (!xIsNext && !winner) {
      // Schedule O’s move via Minimax after 500ms
      timeoutRef.current = setTimeout(() => {
        const move = findBestMove(board);
        updateBoard(move, "O", true);
      }, 500);
    }
    // Cleanup: clear the timeout if dependencies change or component unmounts
    return () => clearTimeout(timeoutRef.current);
  }, [xIsNext, board, winner]);

  /**
   * reset: Resets the game to the initial state.
   * - Clears any pending timeouts.
   * - Restores board to all nulls.
   * - Sets turn back to X.
   */
  function reset() {
    clearTimeout(timeoutRef.current);
    setBoard(initialBoard);
    setXIsNext(true);
  }

  /**
   * quit: Navigate back to the dashboard and clear any pending timeouts.
   */
  function quit() {
    clearTimeout(timeoutRef.current);
    navigate("/dashboard");
  }

  return (
    <div className="ttt-container">
      {/* Title */}
      <h2>Single Player Tic-Tac-Toe</h2>

      {/* Status text (e.g., "Your turn (X)", "Computer is thinking…", "Winner: X", or "Draw!") */}
      <p className="ttt-status">{status}</p>

      {/* Board grid */}
      <div className="ttt-board">
        {/*
          If there is a winning line, render a horizontal/vertical/diagonal strike line.
          We assign a CSS class (e.g., strike-row-1, strike-col-2, strike-diag-main) based on the winning line indices.
        */}
        {line && <div className={`strike-line ${strikeClass(line)}`} />}

        {/*
          Render 9 buttons (cells). Each cell displays the symbol at board[i] (either 'X', 'O', or null).
          When clicked, handleClick(i) attempts to place 'X' there if valid.
        */}
        {board.map((cell, i) => (
          <button key={i} className="ttt-cell" onClick={() => handleClick(i)}>
            {cell}
          </button>
        ))}
      </div>

      {/* Reset and Quit buttons */}
      <div className="ttt-actions">
        <button onClick={reset}>Reset</button>
        <button onClick={quit}>Quit</button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   Minimax Implementation for Computer (O) to pick the optimal move
──────────────────────────────────────────────────────────────────────────────── */

/**
 * findBestMove: Finds the optimal move for O using Minimax.
 * - board: current board state (array of 9 elements).
 * Returns index 0–8 of the best move.
 */
function findBestMove(board) {
  let bestVal = -Infinity;
  let bestMove = null;

  // Try placing 'O' in each empty cell, evaluate with minimax, then undo.
  for (let i = 0; i < 9; i++) {
    if (!board[i]) {
      board[i] = "O"; // Tentatively place O
      const moveVal = minimax(board, 0, false); // Evaluate resulting board
      board[i] = null; // Undo move
      if (moveVal > bestVal) {
        bestVal = moveVal;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

/**
 * minimax: Recursive evaluation function.
 * - bd: current board.
 * - depth: recursion depth (not used to weight scores but could be extended).
 * - isMax: boolean indicating whether we’re maximizing (true for O’s turn) or minimizing (false for X’s turn).
 * Returns +1 if board is winning for O, -1 if winning for X, 0 if draw or no terminal state yet.
 */
function minimax(bd, depth, isMax) {
  const { winner } = getWinnerInfo(bd);
  // Terminal conditions:
  if (winner === "O") return 1; // O wins
  if (winner === "X") return -1; // X wins
  if (bd.every((c) => c)) return 0; // Draw (board full, no winner)

  if (isMax) {
    // Maximizing for O
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!bd[i]) {
        bd[i] = "O"; // Place O
        best = Math.max(best, minimax(bd, depth + 1, false)); // Evaluate next as minimizing
        bd[i] = null; // Undo
      }
    }
    return best;
  } else {
    // Minimizing for X
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!bd[i]) {
        bd[i] = "X"; // Place X
        best = Math.min(best, minimax(bd, depth + 1, true)); // Evaluate next as maximizing
        bd[i] = null; // Undo
      }
    }
    return best;
  }
}

/**
 * getWinnerInfo: Checks all possible winning lines to determine if there is a winner.
 * - sq: array of 9 cells representing the board.
 * Returns an object { winner, line }:
 *   • winner: 'X', 'O', or null if no winner yet.
 *   • line: the triple [i, j, k] of indices forming the winning line (or null).
 */
function getWinnerInfo(sq) {
  // All eight winning lines (3 rows, 3 columns, 2 diagonals)
  const lines = [
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
    [0, 4, 8], // Main diagonal
    [2, 4, 6], // Anti-diagonal
  ];

  for (let line of lines) {
    const [a, b, c] = line;
    // If all three cells are non-null and equal, we have a winner
    if (sq[a] && sq[a] === sq[b] && sq[a] === sq[c]) {
      return { winner: sq[a], line };
    }
  }
  return { winner: null, line: null };
}

/**
 * strikeClass: Maps a winning line (array of 3 indices) to a CSS class name
 * that positions and orients the red strike-through line in the .ttt-board.
 * The CSS classes correspond to:
 *   • Horizontal lines: strike-row-1, strike-row-2, strike-row-3
 *   • Vertical lines:   strike-col-1, strike-col-2, strike-col-3
 *   • Diagonal lines:   strike-diag-main, strike-diag-anti
 */
function strikeClass([a, b, c]) {
  if (a === 0 && b === 1 && c === 2) return "strike-row-1";
  if (a === 3 && b === 4 && c === 5) return "strike-row-2";
  if (a === 6 && b === 7 && c === 8) return "strike-row-3";
  if (a === 0 && b === 3 && c === 6) return "strike-col-1";
  if (a === 1 && b === 4 && c === 7) return "strike-col-2";
  if (a === 2 && b === 5 && c === 8) return "strike-col-3";
  if (a === 0 && b === 4 && c === 8) return "strike-diag-main";
  if (a === 2 && b === 4 && c === 6) return "strike-diag-anti";
  return "";
}
