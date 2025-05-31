import React, { useState, useEffect, useRef } from "react";
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
  query,
  where,
} from "firebase/firestore";
import "./DuelGame.css";

const ARENA_W        = 300;
const ARENA_H        = 300;
const PLAYER_SPEED   = 200;   // px/sec
const SHOT_SPEED     = 150;   // px/sec
const INITIAL_HEALTH = 5;
const INITIAL_AMMO   = 10;
const GAME_TIME      = 60;    // seconds
const PICKUP_SIZE    = 12;    // px
const PICKUP_INTERVAL = 5;    // seconds

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function rectsOverlap(r1, r2) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

function generateObstacles() {
  const arr = [];
  let attempts = 0;
  while (arr.length < 5 && attempts < 200) {
    attempts++;
    const ow = randInt(30, 60);
    const oh = randInt(20, 50);
    const ox = randInt(10, ARENA_W - ow - 10);
    const oy = randInt(50, ARENA_H - oh - 50);
    const rect = { x: ox, y: oy, w: ow, h: oh };

    const overlap =
      arr.some(o => rectsOverlap(o, rect)) ||
      rectsOverlap(rect, { x: ARENA_W / 2 - 15, y: ARENA_H - 30 - 15, w: 30, h: 30 }) ||
      rectsOverlap(rect, { x: ARENA_W / 2 - 15, y: 15,            w: 30, h: 30 });

    if (!overlap) arr.push(rect);
  }
  return arr;
}

export default function MultiplayerDuel() {
  const { gameId } = useParams();
  const navigate   = useNavigate();
  const user       = auth.currentUser;

  const canvasRef  = useRef(null);
  const moveVecRef = useRef({ dx: 0, dy: 0 });

  // Shared game state from Firestore
  const [sharedState, setSharedState] = useState(null);
  const [gameDocRef,  setGameDocRef]  = useState(null);
  const [playerA,     setPlayerA]     = useState("");
  const [playerB,     setPlayerB]     = useState("");
  const [username,    setUsername]    = useState("");
  const [friends,     setFriends]     = useState([]);
  const [waitingId,   setWaitingId]   = useState(null);

  // Chat input
  const [chatInput, setChatInput] = useState("");

  const isMobile = window.innerWidth < 768;

  // ─── A) Load current user's username
  useEffect(() => {
    if (!user) return navigate("/");
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists()) setUsername(snap.data().username);
    });
  }, [user, navigate]);

  // ─── B) If no gameId, fetch friends for challenge list
  useEffect(() => {
    if (gameId) return;
    if (!user) return;
    getDocs(collection(db, `users/${user.uid}/friends`)).then(snap => {
      const f = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setFriends(f);
    });
  }, [gameId, user]);

  // ─── C) Challenge a friend
  const handleChallenge = async (friend) => {
    if (!user) return;
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;
    const initialState = {
      initted: false,
      leaving: [],
    };
    await setDoc(doc(db, "duelGames", id), {
      playerA: user.uid,
      playerB: friend.uid,
      status: "pending",
      state: initialState,
    });
    // send notification to opponent
    await setDoc(
      doc(db, `users/${friend.uid}/notifications/${id}-duel`),
      {
        type: "duel_invite",
        gameId: id,
        senderUid: user.uid,
        senderUsername: username,
        message: `🚀 @${username} challenged you to Duel Shots!`,
        timestamp: Timestamp.now(),
      }
    );
    setWaitingId(id);
  };

  // ─── D) Wait for opponent to accept
  useEffect(() => {
    if (!waitingId) return;
    const docRef = doc(db, "duelGames", waitingId);
    const unsub = onSnapshot(docRef, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === "active") {
        navigate(`/duel/multiplayer/${waitingId}`);
      }
    });
    return () => unsub();
  }, [waitingId, navigate]);

  // ─── E) If gameId provided, set up Firestore subscription
  useEffect(() => {
    if (!gameId) return;
    if (!user) return navigate("/");
    const docRef = doc(db, "duelGames", gameId);
    setGameDocRef(docRef);

    getDoc(docRef).then(snap => {
      if (!snap.exists()) return navigate("/dashboard");
      const data = snap.data();
      setPlayerA(data.playerA);
      setPlayerB(data.playerB);

      // If I’m playerB and status is still “pending,” switch to “active”
      if (user.uid === data.playerB && data.status === "pending") {
        updateDoc(docRef, { status: "active" });
      }
    });
  }, [gameId, user, navigate]);

  // ─── F) Subscribe to shared state changes
  useEffect(() => {
    if (!gameDocRef) return;
    const unsub = onSnapshot(gameDocRef, snap => {
      if (!snap.exists()) return navigate("/dashboard");
      const data = snap.data();
      setSharedState(data.state);
    });

    // On unload, mark leaving
    const cleanupOnExit = () => {
      getDoc(gameDocRef).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const leaves = data.state.leaving || [];
        if (!leaves.includes(user.uid)) leaves.push(user.uid);

        if (leaves.includes(data.playerA) && leaves.includes(data.playerB)) {
          deleteDoc(gameDocRef);
        } else {
          updateDoc(gameDocRef, { state: { ...data.state, leaving: leaves } });
        }
      });
    };
    window.addEventListener("beforeunload", cleanupOnExit);

    return () => {
      window.removeEventListener("beforeunload", cleanupOnExit);
      cleanupOnExit();
      unsub();
    };
  }, [gameDocRef, user, navigate]);

  // ─── G) Initialize game once both players joined
  useEffect(() => {
    if (!sharedState || !gameDocRef) return;
    if (!sharedState.initted) {
      const initObs = generateObstacles();
      const initTime = Date.now() / 1000;
      const initial = {
        initted: true,
        started: true,
        paused: false,
        timer: GAME_TIME,
        obstacles: initObs,
        lastPickupTime: initTime,
        pA: { x: ARENA_W/2, y: ARENA_H - 30, health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
        pB: { x: ARENA_W/2, y: 30,            health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
        bulletsA: [],
        bulletsB: [],
        pickups: [],
        chat: [],
        winner: "",
        leaving: sharedState.leaving || [],
      };
      setSharedState(initial);
      updateDoc(gameDocRef, { state: initial });
    }
  }, [sharedState, gameDocRef]);

  // ─── H) Main game loop (60fps)
  useEffect(() => {
    if (
      !sharedState ||
      !sharedState.started ||
      sharedState.paused ||
      sharedState.winner
    ) return;

    let last = performance.now();
    let rafId;

    const gameLoop = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      const s = JSON.parse(JSON.stringify(sharedState)); // deep copy

      const amA = user.uid === playerA;
      const meKey = amA ? "pA" : "pB";
      const oppKey = amA ? "pB" : "pA";

      // Move this player's ship
      const vec = isMobile ? moveVecRef.current : s.moveVecDesktop || { dx: 0, dy: 0 };
      if (vec.dx || vec.dy) {
        const me = s[meKey];
        const nx = Math.max(0, Math.min(ARENA_W, me.x + vec.dx * PLAYER_SPEED * dt));
        const ny = Math.max(0, Math.min(ARENA_H, me.y + vec.dy * PLAYER_SPEED * dt));

        let blocked = false;
        for (const o of s.obstacles) {
          if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          me.x = nx;
          me.y = ny;
        }
      }

      // Update bulletsA
      s.bulletsA = s.bulletsA.filter((b) => {
        b.x += b.dx * SHOT_SPEED * dt;
        b.y += b.dy * SHOT_SPEED * dt;
        if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
        for (const o of s.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) return false;
        }
        const hitDist = Math.hypot(b.x - s.pB.x, b.y - s.pB.y);
        if (hitDist < 12) {
          s.pB.health = Math.max(0, s.pB.health - 1);
          return false;
        }
        return true;
      });

      // Update bulletsB
      s.bulletsB = s.bulletsB.filter((b) => {
        b.x += b.dx * SHOT_SPEED * dt;
        b.y += b.dy * SHOT_SPEED * dt;
        if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
        for (const o of s.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) return false;
        }
        const hitDist = Math.hypot(b.x - s.pA.x, b.y - s.pA.y);
        if (hitDist < 12) {
          s.pA.health = Math.max(0, s.pA.health - 1);
          return false;
        }
        return true;
      });

      // Spawn pickups every PICKUP_INTERVAL
      const nowSec = Date.now() / 1000;
      if (nowSec - s.lastPickupTime >= PICKUP_INTERVAL) {
        let px, py, tries = 0;
        do {
          px = randInt(15, ARENA_W - 15);
          py = randInt(15, ARENA_H - 15);
          const rect = { x: px - PICKUP_SIZE/2, y: py - PICKUP_SIZE/2, w: PICKUP_SIZE, h: PICKUP_SIZE };
          const collObs = s.obstacles.some(o => rectsOverlap(o, rect));
          const collPick = s.pickups.some(pk => Math.hypot(pk.x - px, pk.y - py) < PICKUP_SIZE);
          if (!collObs && !collPick) break;
          tries++;
        } while (tries < 50);

        const nextType = s.pickups.length % 2 === 0 ? "ammo" : "health";
        s.pickups.push({ x: px, y: py, type: nextType });
        s.lastPickupTime = nowSec;
      }

      // Collect pickups
      s.pickups = s.pickups.filter((pk) => {
        const distA = Math.hypot(s.pA.x - pk.x, s.pA.y - pk.y);
        if (distA < 14) {
          if (pk.type === "ammo") s.pA.ammo = Math.min(s.pA.ammo + 3, INITIAL_AMMO);
          else s.pA.health = Math.min(s.pA.health + 1, INITIAL_HEALTH);
          return false;
        }
        const distB = Math.hypot(s.pB.x - pk.x, s.pB.y - pk.y);
        if (distB < 14) {
          if (pk.type === "ammo") s.pB.ammo = Math.min(s.pB.ammo + 3, INITIAL_AMMO);
          else s.pB.health = Math.min(s.pB.health + 1, INITIAL_HEALTH);
          return false;
        }
        return true;
      });

      // Countdown timer
      if (!s.paused) {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.timer = 0;
          if (s.pA.health > s.pB.health) s.winner = playerA;
          else if (s.pB.health > s.pA.health) s.winner = playerB;
          else s.winner = "";
        }
      }

      // Check health
      if (s.pA.health <= 0 || s.pB.health <= 0) {
        s.winner = s.pA.health <= 0 ? playerB : playerA;
      }

      updateDoc(gameDocRef, { state: s });
      setSharedState(s);

      rafId = requestAnimationFrame(gameLoop);
    };

    rafId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafId);
  }, [sharedState, gameDocRef, playerA, playerB, user, isMobile]);

  // ─── I) DESKTOP CONTROLS
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!sharedState || !sharedState.started || sharedState.paused || sharedState.winner) return;
      let dx = 0, dy = 0;
      if (e.key === "ArrowUp" || /^[wW]$/.test(e.key)) dy = -1;
      if (e.key === "ArrowDown" || /^[sS]$/.test(e.key)) dy = 1;
      if (e.key === "ArrowLeft" || /^[aA]$/.test(e.key)) dx = -1;
      if (e.key === "ArrowRight" || /^[dD]$/.test(e.key)) dx = 1;

      if (dx || dy) {
        const m = Math.hypot(dx, dy) || 1;
        const newMove = { dx: dx / m, dy: dy / m };
        const s = { ...sharedState, moveVecDesktop: newMove };
        updateDoc(gameDocRef, { state: s });
        setSharedState(s);
      }
      if (e.key === "p" || e.key === "P") {
        const s = { ...sharedState, paused: !sharedState.paused };
        updateDoc(gameDocRef, { state: s });
        setSharedState(s);
      }
    };

    const onKeyUp = (e) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"].includes(e.key)) {
        const s = { ...sharedState, moveVecDesktop: { dx: 0, dy: 0 } };
        updateDoc(gameDocRef, { state: s });
        setSharedState(s);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [sharedState, gameDocRef]);

  // ─── J) MOBILE JOYSTICK
  const onLeftMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = (t.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let dy = (t.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    moveVecRef.current = { dx: dx / m, dy: dy / m };
  };

  const onLeftEnd = () => {
    moveVecRef.current = { dx: 0, dy: 0 };
  };

  // ─── K) SHOOT HANDLER
  const handleShoot = () => {
    if (!sharedState || !sharedState.started || sharedState.paused || sharedState.winner) return;
    const amA = user.uid === playerA;
    const s = { ...sharedState };
    const me = amA ? s.pA : s.pB;
    if (me.ammo <= 0) return;

    const opp = amA ? s.pB : s.pA;
    let dx0 = opp.x - me.x;
    let dy0 = opp.y - me.y;
    const m = Math.hypot(dx0, dy0) || 1;
    me.ammo -= 1;
    const bullet = { x: me.x, y: me.y, dx: dx0 / m, dy: dy0 / m };
    if (amA) s.bulletsA.push(bullet);
    else     s.bulletsB.push(bullet);

    updateDoc(gameDocRef, { state: s });
    setSharedState(s);
  };

  // ─── L) CHAT
  const sendChat = async () => {
    if (!chatInput.trim() || !sharedState) return;
    const role = user.uid === playerA ? "PlayerA" : "PlayerB";
    const msgObj = {
      sender: role,
      message: chatInput,
      timestamp: Timestamp.now(),
    };
    const s = { ...sharedState, chat: [...sharedState.chat, msgObj] };
    await updateDoc(gameDocRef, { state: s });
    setSharedState(s);
    setChatInput("");
  };

  // ─── M) QUIT GAME
  const handleQuit = async () => {
    if (!gameDocRef || !sharedState) {
      navigate("/dashboard");
      return;
    }
    const snap = await getDoc(gameDocRef);
    if (!snap.exists()) {
      navigate("/dashboard");
      return;
    }
    const data = snap.data();
    const leaves = data.state.leaving || [];
    if (!leaves.includes(user.uid)) leaves.push(user.uid);

    if (leaves.includes(data.playerA) && leaves.includes(data.playerB)) {
      await deleteDoc(gameDocRef);
    } else {
      const s = { ...data.state, leaving };
      await updateDoc(gameDocRef, { state: s });
    }
    navigate("/dashboard");
  };

  // ─── N) DRAW CANVAS
  useEffect(() => {
    if (!sharedState || !sharedState.started) return;
    const ctx = canvasRef.current.getContext("2d");

    const drawFrame = () => {
      const s = sharedState;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // obstacles
      ctx.fillStyle = "#475569";
      s.obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

      // pickups
      s.pickups.forEach(pk => {
        ctx.fillStyle = pk.type === "ammo" ? "#22c55e" : "#f87171";
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, PICKUP_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Player B (magenta)
      ctx.fillStyle = "magenta";
      ctx.beginPath();
      ctx.arc(s.pB.x, s.pB.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // Player A (cyan)
      ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.arc(s.pA.x, s.pA.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // bulletsA
      ctx.fillStyle = "white";
      s.bulletsA.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // bulletsB
      ctx.fillStyle = "yellow";
      s.bulletsB.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // paused overlay
      if (s.paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", ARENA_W / 2, ARENA_H / 2);
      }

      // Game Over overlay
      if (s.winner) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        const label =
          s.winner === playerA
            ? "Player A Wins!"
            : s.winner === playerB
            ? "Player B Wins!"
            : "Draw!";
        ctx.fillText(label, ARENA_W / 2, ARENA_H / 2 - 10);
      }
    };

    let animId;
    const loop = () => {
      drawFrame();
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [sharedState, playerA, playerB]);

  // ─── O) RENDER: Challenge Screen vs Game Screen
  if (!gameId) {
    return (
      <div className="duel-container">
        <h2>Challenge a Friend to Duel Shots</h2>
        <p className="explanation">
          Select a friend and send a challenge. They’ll get a notification to join.
        </p>
        {friends.length === 0 ? (
          <p>You have no friends to challenge.</p>
        ) : (
          friends.map(f => (
            <div key={f.uid} className="friend-row">
              <span>@{f.username}</span>
              <button onClick={() => handleChallenge(f)}>Challenge</button>
            </div>
          ))
        )}
        {waitingId && (
          <>
            <p>Waiting for @{friends.find(f => f.uid === waitingId.split("_")[1])?.username} to accept…</p>
            <button onClick={() => navigate("/dashboard")}>❌ Cancel</button>
          </>
        )}
      </div>
    );
  }

  if (!sharedState) {
    return (
      <div className="duel-container">
        <h2>Loading Duel…</h2>
      </div>
    );
  }

  if (!sharedState.initted) {
    return (
      <div className="duel-container">
        <h2>Waiting for opponent to join…</h2>
        <button onClick={handleQuit} className="quit-btn">
          ❌ Cancel Challenge
        </button>
      </div>
    );
  }

  // Active or finished game
  const s = sharedState;
  const amA = user.uid === playerA;
  const myState = amA ? s.pA : s.pB;
  const oppState = amA ? s.pB : s.pA;

  return (
    <div className="duel-container">
      <h2>Multiplayer Duel Shots</h2>
      <p>
        Use WASD/Arrows (desktop) or joystick (mobile) to move, 💥 to shoot, P to pause.
      </p>

      <div className="status-bar-duel">
        <span>
          {amA ? "You (A)" : "You (B)"} ❤️ {myState.health}
        </span>
        <span>
          {amA ? "Opponent (B)" : "Opponent (A)"} ❤️ {oppState.health}
        </span>
        <span>🔋 {myState.ammo}</span>
        <span>⏰ {Math.ceil(s.timer)}s</span>
      </div>

      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H}
        className="duel-canvas"
      />

      <div className="controls-row">
        <button
          onClick={handleShoot}
          className="shoot-btn"
          disabled={!!s.winner || s.paused}
        >
          💥 Shoot
        </button>
        {s.winner ? (
          <button onClick={handleQuit} className="play-again">
            ▶️ Back to Dashboard
          </button>
        ) : (
          <button
            onClick={() => {
              const toggled = { ...s, paused: !s.paused };
              updateDoc(gameDocRef, { state: toggled });
            }}
            className="pause-btn"
          >
            {s.paused ? "▶️ Resume" : "⏸️ Pause"}
          </button>
        )}
        <button onClick={handleQuit} className="quit-btn">
          ❌ Quit
        </button>
      </div>

      {/* Mobile joystick */}
      {isMobile && !s.winner && !s.paused && (
        <div
          className="joystick left"
          onTouchStart={onLeftMove}
          onTouchMove={onLeftMove}
          onTouchEnd={onLeftEnd}
        >
          <div className="knob" />
        </div>
      )}

      {/* Mobile shoot button (absolute, above chat) */}
      {isMobile && !s.winner && !s.paused && (
        <button
          className="shoot-btn-mobile"
          onTouchStart={handleShoot}
        >
          💥
        </button>
      )}

      {/* Chat box */}
      <div className="chatbox" style={{ marginTop: "1rem" }}>
        <h4>Game Chat</h4>
        <div
          className="chat-messages"
          style={{
            height: "120px",
            overflowY: "auto",
            background: "#1e293b",
            padding: "0.5rem",
            borderRadius: "4px",
          }}
        >
          {s.chat.map((m, i) => (
            <p key={i} style={{ margin: "0.25rem 0", color: "#cbd5e1" }}>
              <strong style={{ color: "#fff" }}>{m.sender}:</strong> {m.message}
            </p>
          ))}
        </div>
        {!s.winner && (
          <div
            className="chat-input"
            style={{ display: "flex", marginTop: "0.5rem" }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message…"
              style={{
                flexGrow: 1,
                padding: "0.5rem",
                borderRadius: "4px 0 0 4px",
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#fff",
              }}
            />
            <button
              onClick={sendChat}
              style={{
                padding: "0 1rem",
                background: "#22c55e",
                border: "none",
                borderRadius: "0 4px 4px 0",
                color: "#0f172a",
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
