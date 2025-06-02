// src/pages/MultiplayerBattleship.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebase-config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import "./Battleship.css";

const GRID_SIZE = 10;
const SHIP_SIZES = [5, 4, 3, 3, 2];
const BOARD_LEN = GRID_SIZE * GRID_SIZE;

// generate a fresh 2D grid of cell objects
function make2DGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ hasShip: false, hit: false }))
  );
}

// randomly place ships in a 2D grid
function placeShipsRandomly(grid2D) {
  const g = grid2D.map((row) => row.map((cell) => ({ ...cell })));
  SHIP_SIZES.forEach((size) => {
    let placed = false;
    while (!placed) {
      const hor = Math.random() < 0.5;
      const r0 = Math.floor(Math.random() * GRID_SIZE);
      const c0 = Math.floor(Math.random() * GRID_SIZE);
      let ok = true;
      for (let i = 0; i < size; i++) {
        const r = r0 + (hor ? 0 : i);
        const c = c0 + (hor ? i : 0);
        if (r >= GRID_SIZE || c >= GRID_SIZE || g[r][c].hasShip) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let i = 0; i < size; i++) {
        const r = r0 + (hor ? 0 : i);
        const c = c0 + (hor ? i : 0);
        g[r][c].hasShip = true;
      }
      placed = true;
    }
  });
  return g;
}

// flatten a 2D grid into a 1D array
function flatten(grid2D) {
  return grid2D.reduce((acc, row) => acc.concat(row), []);
}

// chunk a flat array into 2D rows
function chunk(flat) {
  const rows = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    rows.push(flat.slice(i * GRID_SIZE, (i + 1) * GRID_SIZE));
  }
  return rows;
}

export default function MultiplayerBattleship() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [username, setUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [waitingId, setWaitingId] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [chatInput, setChatInput] = useState("");

  // load user info
  useEffect(() => {
    if (!user) return navigate("/");
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setUsername(snap.data().username);
    });
    getDocs(collection(db, `users/${user.uid}/friends`)).then((s) =>
      setFriends(s.docs.map((d) => ({ uid: d.id, ...d.data() })))
    );
  }, [user, navigate]);

  // challenge a friend
  const handleChallenge = async (friend) => {
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    // create two random boards, flatten for storage
    const b2A = placeShipsRandomly(make2DGrid());
    const b2B = placeShipsRandomly(make2DGrid());
    await setDoc(doc(db, "battleship_games", id), {
      playerA: user.uid,
      playerB: friend.uid,
      currentTurn: user.uid,
      boardA: flatten(b2A),
      boardB: flatten(b2B),
      status: "pending",
      winner: "",
      chat: [],
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, `users/${friend.uid}/notifications/${id}`), {
      type: "battleship_invite",
      gameId: id,
      senderUid: user.uid,
      senderUsername: username,
      message: `🚢 @${username} challenged you to Battleship!`,
      timestamp: Timestamp.now(),
    });
    setWaitingId(id);
  };

  // wait for opponent to accept
  useEffect(() => {
    if (!waitingId) return;
    const unsub = onSnapshot(doc(db, "battleship_games", waitingId), (snap) => {
      if (snap.exists() && snap.data().status === "active") {
        navigate(`/battleship/multiplayer/${waitingId}`);
      }
    });
    return unsub;
  }, [waitingId, navigate]);

  // subscribe to game doc
  useEffect(() => {
    if (!gameId) return;
    const unsub = onSnapshot(doc(db, "battleship_games", gameId), (snap) => {
      setGameData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });

    // Cleanup: unsubscribe and delete the game if user leaves without clicking Quit
    return () => {
      unsub();
      deleteDoc(doc(db, "battleship_games", gameId))
        .catch(() => { /* ignore if already deleted */ });
    };
  }, [gameId]);

  // helper to count remaining ship cells
  const countRemaining = (flat) =>
    flat.filter((cell) => cell.hasShip && !cell.hit).length;

  // handle firing on opponent
  const handleFire = async (r, c) => {
    if (!gameData || gameData.status !== "active") return;
    if (gameData.currentTurn !== user.uid) return;
    const isA = user.uid === gameData.playerA;
    const key = isA ? "boardB" : "boardA";
    const flat = [...gameData[key]];
    const idx = r * GRID_SIZE + c;
    if (flat[idx].hit) return;
    flat[idx] = { ...flat[idx], hit: true };

    const allSunk = flat
      .filter((cell) => cell.hasShip)
      .every((cell) => cell.hit);
    await updateDoc(doc(db, "battleship_games", gameId), {
      [key]: flat,
      currentTurn: allSunk ? null : isA ? gameData.playerB : gameData.playerA,
      status: allSunk ? "finished" : "active",
      winner: allSunk ? user.uid : "",
    });
  };

  // rematch
  const handleRematch = async () => {
    const b2A = placeShipsRandomly(make2DGrid());
    const b2B = placeShipsRandomly(make2DGrid());
    await updateDoc(doc(db, "battleship_games", gameId), {
      boardA: flatten(b2A),
      boardB: flatten(b2B),
      status: "active",
      winner: "",
      currentTurn: gameData.playerA,
      chat: [],
    });
  };

  // quit
  const handleQuit = async () => {
    if (gameId) await deleteDoc(doc(db, "battleship_games", gameId));
    navigate("/dashboard");
  };

  // chat
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    await updateDoc(doc(db, "battleship_games", gameId), {
      chat: arrayUnion({
        sender: username,
        message: chatInput,
        timestamp: Timestamp.now(),
      }),
    });
    setChatInput("");
  };

  // render a 2D grid (array of rows)
  const renderGrid = (rows, onClick, hideShips = false) => (
    <div className="battleship-grid">
      {rows.map((row, r) =>
        row.map((cell, c) => {
          let cls = "unclicked";
          if (cell.hit) cls = cell.hasShip ? "hit" : "miss";
          const showShip = cell.hasShip && !hideShips;
          return (
            <div
              key={`${r}-${c}`}
              className={`${cls}${showShip ? " ship" : ""}`}
              onClick={() => onClick && onClick(r, c)}
            />
          );
        })
      )}
    </div>
  );

  // GAME SCREEN
  if (gameData) {
    const {
      playerA,
      playerB,
      currentTurn,
      boardA,
      boardB,
      status,
      winner,
      chat,
    } = gameData;
    const isA = user.uid === playerA;
    const myFlat = isA ? boardA : boardB;
    const oppFlat = isA ? boardB : boardA;
    const rowsMy = chunk(myFlat);
    const rowsOpp = chunk(oppFlat);

    let statusText =
      status === "pending"
        ? "Waiting for opponent to join…"
        : status === "active"
        ? currentTurn === user.uid
          ? "Your turn"
          : "Opponent’s turn"
        : winner === user.uid
        ? "You win! 🎉"
        : "You lose 💥";

    return (
      <div className="battleship-container">
        <h2>Multiplayer Battleship</h2>
        <p className="explanation">
          Welcome to Battleship! Your mission is to locate and sink all enemy
          ships before yours are destroyed. Click on a square in{" "}
          <strong>Enemy Waters</strong> to fire. 🔴 =
        </p>
        <p className="status">{statusText}</p>
        <div className="status-bar">
          <span>Your ships left: {countRemaining(myFlat)}</span>
          <span>Enemy ships left: {countRemaining(oppFlat)}</span>
        </div>
        <div className="battleship-boards">
          <div>
            <h3>Your Board</h3>
            {renderGrid(rowsMy, null, false)}
          </div>
          <div>
            <h3>Enemy Waters</h3>
            {renderGrid(rowsOpp, handleFire, true)}
          </div>
        </div>
        <div className="controls">
          {status === "finished" && (
            <button onClick={handleRematch}>▶️ Play Again</button>
          )}
          <button onClick={handleQuit}>❌ Quit to Dashboard</button>
        </div>
        <div className="chatbox">
          <h4>Game Chat</h4>
          <div className="chat-messages">
            {chat.map((m, i) => (
              <p key={i}>
                <strong>{m.sender}:</strong> {m.message}
              </p>
            ))}
          </div>
          {status === "active" && (
            <div className="chat-input">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message…"
              />
              <button onClick={sendChat}>Send</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // CHALLENGE SCREEN
  return (
    <div className="battleship-container">
      <h2>Challenge a Friend to Battleship</h2>
      <p className="explanation">
        Select a friend to start— they’ll get an invite notification.
      </p>
      {friends.length === 0 ? (
        <p>You have no friends to challenge.</p>
      ) : (
        friends.map((f) => (
          <div key={f.uid} className="friend-row">
            <span>@{f.username}</span>
            <button onClick={() => handleChallenge(f)}>Challenge</button>
          </div>
        ))
      )}
      {waitingId && (
        <>
          <p>Waiting for acceptance…</p>
          <button onClick={() => navigate("/dashboard")}>❌ Cancel</button>
        </>
      )}
    </div>
  );
}
