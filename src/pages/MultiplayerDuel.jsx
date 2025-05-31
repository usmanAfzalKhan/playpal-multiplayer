// src/pages/MultiplayerDuel.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebase-config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import "./DuelGame.css";

const ARENA_W        = 300;
const ARENA_H        = 300;
const PLAYER_SPEED   = 150;   // px/sec
const SHOT_SPEED     = 200;   // px/sec
const INITIAL_HEALTH = 5;
const INITIAL_AMMO   = 10;
const GAME_TIME      = 60;    // seconds
const PICKUP_SIZE    = 12;    // px
const PICKUP_INTERVAL = 5;    // seconds between spawning a new pickup

// returns a random integer between min (inclusive) and max (exclusive)
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// checks if two rectangles overlap
function rectsOverlap(r1, r2) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

// Deep-copy a 2D array of objects
function clone2D(arr) {
  return arr.map(row => row.map(cell => ({ ...cell })));
}

// Generate an empty 2D array (300×300) for obstacles,
// then randomly place 5 rectangles. Return array of { x,y,w,h }.
function generateObstacles() {
  const newObs = [];
  let attempts = 0;
  while (newObs.length < 5 && attempts < 200) {
    attempts++;
    const ow = randInt(30, 60);
    const oh = randInt(20, 50);
    const ox = randInt(10, ARENA_W - ow - 10);
    const oy = randInt(50, ARENA_H - oh - 50);
    const rect = { x: ox, y: oy, w: ow, h: oh };

    // ensure no overlap with existing or spawn zones
    const overlap = newObs.some(o => rectsOverlap(o, rect)) ||
      rectsOverlap(rect, { x: ARENA_W/2 - 15, y: ARENA_H - 30 - 15, w: 30, h: 30 }) ||
      rectsOverlap(rect, { x: ARENA_W/2 - 15, y: 15, w: 30, h: 30 });

    if (!overlap) newObs.push(rect);
  }
  return newObs;
}

// Initialize pickups array empty
// (clients will spawn locally but share the seed time to sync intervals)
function seedPickups() {
  return [];
}

export default function MultiplayerDuel() {
  const { gameId } = useParams();
  const navigate   = useNavigate();
  const user       = auth.currentUser;

  const canvasRef  = useRef(null);
  const moveVecRef = useRef({ dx: 0, dy: 0 });

  // ─── Shared Game Data from Firestore ───────────────────────
  const [gameDoc, setGameDoc]       = useState(null);
  const [gameStatus, setGameStatus] = useState("pending"); // "pending" | "active" | "finished"
  const [playerA, setPlayerA]       = useState("");
  const [playerB, setPlayerB]       = useState("");
  const [sharedState, setSharedState] = useState(null);
  // sharedState will be an object holding:
  // { started, paused, timer, obstacles, lastPickupTime,
  //   pAState: { x, y, health, ammo }, pBState: { x, y, health, ammo },
  //   bulletsA: [], bulletsB: [], pickups: [] , chat: [] , currentTurn, winner }

  const [localState, setLocalState] = useState({
    started: false,
    paused:  false,
    timer:   GAME_TIME,
    obstacles: [],
    lastPickupTime: Date.now() / 1000,
    pAState: { x: ARENA_W / 2, y: ARENA_H - 30, health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
    pBState: { x: ARENA_W / 2, y: 30, health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
    bulletsA: [],
    bulletsB: [],
    pickups: [],
    currentTurn: "",     // uid whose turn it is (optional for turn-based logic)
    winner: "",          // uid of winner once finished
    chat: [],            // array of { sender, message, timestamp }
  });

  const [chatInput, setChatInput] = useState("");

  const isMobile = window.innerWidth < 768;

  // ─── 1) On mount: validate and/or create game doc ───────────
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    const docRef = doc(db, "duelGames", gameId);

    getDoc(docRef).then((snap) => {
      if (!snap.exists()) {
        // If no such doc, redirect back
        navigate("/dashboard");
        return;
      }
      const data = snap.data();
      setGameDoc(docRef);
      setGameStatus(data.status);
      setPlayerA(data.playerA);
      setPlayerB(data.playerB);

      // If this user is playerB and status is "pending", mark as "active"
      if (user.uid === data.playerB && data.status === "pending") {
        updateDoc(docRef, { status: "active" });
      }
    });

    // Subscribe to changes
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        // Game deleted → both players left
        navigate("/dashboard");
        return;
      }
      const data = snap.data();
      setGameStatus(data.status);
      setSharedState(data.state);
    });

    // On unmount or page close, remove user from game or delete if both gone
    const cleanup = () => {
      getDoc(docRef).then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        // Mark this user as having left
        const leaves = data.leaving || [];
        if (!leaves.includes(user.uid)) {
          leaves.push(user.uid);
        }
        if (leaves.includes(data.playerA) && leaves.includes(data.playerB)) {
          // both left → delete entire doc
          deleteDoc(docRef);
        } else {
          // update leaving array
          updateDoc(docRef, { leaving: leaves });
        }
      });
    };
    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
      unsub();
    };
  }, [user, gameId, navigate]);

  // ─── 2) When sharedState is first received, initialize local pieces ───
  useEffect(() => {
    if (!sharedState) return;
    // If state is null (just activated), set initial state
    if (!sharedState.initted && gameStatus === "active") {
      const initObs       = generateObstacles();
      const initPickups   = seedPickups();
      const initState = {
        started: true,
        paused:  false,
        timer:   GAME_TIME,
        obstacles: initObs,
        lastPickupTime: Date.now() / 1000,
        pAState: { x: ARENA_W / 2, y: ARENA_H - 30, health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
        pBState: { x: ARENA_W / 2, y: 30, health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
        bulletsA: [],
        bulletsB: [],
        pickups: initPickups,
        chat: [],
        initted: true,
        leaving: [],
        winner: "",
      };
      setLocalState(initState);
      updateDoc(gameDoc, { state: initState });
    } else if (sharedState.initted) {
      // Merge sharedState into localState
      setLocalState(sharedState);
    }
  }, [sharedState, gameStatus, gameDoc]);

  // ─── 3) GAME LOOP ───────────────────────────────────────────
  useEffect(() => {
    if (!localState.started || localState.paused || gameStatus !== "active") return;
    let last = performance.now();
    let rafId;

    // Auto-aim compute
    const computeAim = (fromX, fromY, toX, toY, obstacles) => {
      let dx0 = toX - fromX;
      let dy0 = toY - fromY;
      const dist = Math.hypot(dx0, dy0) || 1;
      // check obstacle collision along line
      const steps = Math.floor(dist / 5);
      let blocked = false;
      for (let i = 1; i < steps; i++) {
        const ix = fromX + (dx0 / steps) * i;
        const iy = fromY + (dy0 / steps) * i;
        if (
          obstacles.some((o) => ix > o.x && ix < o.x + o.w && iy > o.y && iy < o.y + o.h)
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        dx0 += (Math.random() - 0.5) * 50;
        dy0 += (Math.random() - 0.5) * 50;
      }
      const m = Math.hypot(dx0, dy0) || 1;
      return { dx: dx0 / m, dy: dy0 / m };
    };

    const gameLoop = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      const ns = { ...localState }; // copy

      // ─── 3a) Move local player
      const isA = user.uid === playerA;
      const meKey = isA ? "pAState" : "pBState";
      const youKey = isA ? "pBState" : "pAState";
      const vec = isMobile ? moveVecRef.current : localState.moveVecDesktop;
      if (vec && (vec.dx || vec.dy)) {
        const me = ns[meKey];
        const nx = Math.max(0, Math.min(ARENA_W, me.x + vec.dx * PLAYER_SPEED * dt));
        const ny = Math.max(0, Math.min(ARENA_H, me.y + vec.dy * PLAYER_SPEED * dt));
        // check collisions
        let collision = false;
        for (const o of ns.obstacles) {
          if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          me.x = nx;
          me.y = ny;
        }
      }

      // ─── 3b) Update bullets A
      ns.bulletsA = ns.bulletsA.filter((b) => {
        b.x += b.dx * SHOT_SPEED * dt;
        b.y += b.dy * SHOT_SPEED * dt;
        if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
        for (const o of ns.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
            return false;
          }
        }
        // hit B?
        const target = ns.pBState;
        if (Math.hypot(b.x - target.x, b.y - target.y) < 12) {
          target.health = Math.max(0, target.health - 1);
          return false;
        }
        return true;
      });

      // ─── 3c) Update bullets B
      ns.bulletsB = ns.bulletsB.filter((b) => {
        b.x += b.dx * SHOT_SPEED * dt;
        b.y += b.dy * SHOT_SPEED * dt;
        if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
        for (const o of ns.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
            return false;
          }
        }
        // hit A?
        const target = ns.pAState;
        if (Math.hypot(b.x - target.x, b.y - target.y) < 12) {
          target.health = Math.max(0, target.health - 1);
          return false;
        }
        return true;
      });

      // ─── 3d) AI shooting for opponent
      // If it's B's turn to shoot (when B is local user, do nothing here; if remote, we rely on remote actions)
      // For simplicity, allow both to shoot at will—no turn-enforcement.

      // ─── 3e) Spawn pickups every PICKUP_INTERVAL
      const nowSec = Date.now() / 1000;
      if (nowSec - ns.lastPickupTime >= PICKUP_INTERVAL) {
        let px, py, tries = 0;
        do {
          px = randInt(15, ARENA_W - 15);
          py = randInt(15, ARENA_H - 15);
          const rect = { x: px - PICKUP_SIZE / 2, y: py - PICKUP_SIZE / 2, w: PICKUP_SIZE, h: PICKUP_SIZE };
          const collidesObs = ns.obstacles.some(o => rectsOverlap(o, rect));
          const collidesPick = ns.pickups.some(pk => {
            return Math.hypot(pk.x - px, pk.y - py) < PICKUP_SIZE;
          });
          if (!collidesObs && !collidesPick) break;
          tries++;
        } while (tries < 50);

        const nextType = ns.pickups.length % 2 === 0 ? "ammo" : "health";
        ns.pickups.push({ x: px, y: py, type: nextType });
        ns.lastPickupTime = nowSec;
      }

      // ─── 3f) Check pickup collisions for both players
      ns.pickups = ns.pickups.filter((pk) => {
        const pa = ns.pAState;
        const pb = ns.pBState;
        const distA = Math.hypot(pa.x - pk.x, pa.y - pk.y);
        if (distA < 14) {
          if (pk.type === "ammo") pa.ammo = Math.min(pa.ammo + 3, INITIAL_AMMO);
          else pa.health = Math.min(pa.health + 1, INITIAL_HEALTH);
          return false;
        }
        const distB = Math.hypot(pb.x - pk.x, pb.y - pk.y);
        if (distB < 14) {
          if (pk.type === "ammo") pb.ammo = Math.min(pb.ammo + 3, INITIAL_AMMO);
          else pb.health = Math.min(pb.health + 1, INITIAL_HEALTH);
          return false;
        }
        return true;
      });

      // ─── 3g) Timer countdown
      if (!ns.paused) {
        ns.timer -= dt;
        if (ns.timer <= 0) {
          ns.timer = 0;
          ns.winner = ns.pAState.health > ns.pBState.health ? playerA : playerB;
          ns.status = "finished";
        }
      }

      // ─── 3h) Check health zero
      if (ns.pAState.health <= 0 || ns.pBState.health <= 0) {
        ns.winner = ns.pAState.health <= 0 ? playerB : playerA;
        ns.status = "finished";
      }

      // Save back to Firestore
      updateDoc(gameDoc, { state: ns });

      setLocalState(ns);
      rafId = requestAnimationFrame(gameLoop);
    };

    rafId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    localState.started,
    localState.paused,
    gameStatus,
    localState,
    playerA,
    playerB,
    user,
    gameDoc,
    isMobile,
  ]);

  // ─── 4) Desktop keyboard controls ───────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!localState.started || localState.paused || gameStatus !== "active") return;
      let dx = 0, dy = 0;
      if (e.key === "ArrowUp"    || /^[wW]$/.test(e.key)) dy = -1;
      if (e.key === "ArrowDown"  || /^[sS]$/.test(e.key)) dy =  1;
      if (e.key === "ArrowLeft"  || /^[aA]$/.test(e.key)) dx = -1;
      if (e.key === "ArrowRight" || /^[dD]$/.test(e.key)) dx =  1;

      if (dx || dy) {
        const m = Math.hypot(dx, dy) || 1;
        setLocalState((ls) => ({
          ...ls,
          moveVecDesktop: { dx: dx / m, dy: dy / m },
        }));
      }
      if (e.key === "p" || e.key === "P") {
        setLocalState((ls) => {
          const updated = { ...ls, paused: !ls.paused };
          updateDoc(gameDoc, { state: updated });
          return updated;
        });
      }
    };
    const onKeyUp = (e) => {
      if (
        ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"].includes(e.key)
      ) {
        setLocalState((ls) => ({ ...ls, moveVecDesktop: { dx: 0, dy: 0 } }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [localState.started, localState.paused, gameStatus, gameDoc]);

  // ─── 5) Mobile joystick handlers ────────────────────────────
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

  // ─── 6) Shoot handler (desktop & mobile) ───────────────────
  const handleShoot = () => {
    if (!localState.started || localState.paused || gameStatus !== "active") return;
    const isA = user.uid === playerA;
    const pKey = isA ? "pAState" : "pBState";
    const bKey = isA ? "bulletsA" : "bulletsB";
    const me = localState[pKey];
    if (me.ammo <= 0) {
      setLocalState((ls) => ({ ...ls, message: "❗ No Ammo" }));
      return;
    }

    // Auto-aim at opponent
    const opp = isA ? localState.pBState : localState.pAState;
    const aim = computeAimForShoot(me.x, me.y, opp.x, opp.y, localState.obstacles);

    const newBullet = { x: me.x, y: me.y, dx: aim.dx, dy: aim.dy };
    const updatedState = {
      ...localState,
      [pKey]: { ...me, ammo: me.ammo - 1 },
      [bKey]: [...localState[bKey], newBullet],
    };
    updateDoc(gameDoc, { state: updatedState });
    setLocalState(updatedState);
  };

  // Helper for computing aim
  const computeAimForShoot = (fromX, fromY, toX, toY, obstacles) => {
    let dx0 = toX - fromX;
    let dy0 = toY - fromY;
    const dist = Math.hypot(dx0, dy0) || 1;
    const steps = Math.floor(dist / 5);
    let blocked = false;
    for (let i = 1; i < steps; i++) {
      const ix = fromX + (dx0 / steps) * i;
      const iy = fromY + (dy0 / steps) * i;
      if (
        obstacles.some(
          (o) => ix > o.x && ix < o.x + o.w && iy > o.y && iy < o.y + o.h
        )
      ) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      dx0 += (Math.random() - 0.5) * 50;
      dy0 += (Math.random() - 0.5) * 50;
    }
    const m = Math.hypot(dx0, dy0) || 1;
    return { dx: dx0 / m, dy: dy0 / m };
  };

  // ─── 7) Send Chat ───────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const newMessage = {
      sender:   localState.playerA === user.uid ? "Player A" : "Player B",
      message:  chatInput,
      timestamp: Timestamp.now(),
    };
    const updated = { ...localState, chat: [...localState.chat, newMessage] };
    await updateDoc(gameDoc, { state: updated });
    setChatInput("");
  };

  // ─── 8) Quit Game ───────────────────────────────────────────
  const handleQuit = async () => {
    if (!gameDoc) {
      navigate("/dashboard");
      return;
    }
    // Add this user to leaving array
    const snap = await getDoc(gameDoc);
    if (!snap.exists()) {
      navigate("/dashboard");
      return;
    }
    const data = snap.data();
    const leaves = data.state.leaving || [];
    if (!leaves.includes(user.uid)) {
      leaves.push(user.uid);
    }
    if (leaves.includes(data.playerA) && leaves.includes(data.playerB)) {
      await deleteDoc(gameDoc);
    } else {
      const updated = { ...data.state, leaving: leaves };
      await updateDoc(gameDoc, { state: updated });
    }
    navigate("/dashboard");
  };

  // ─── 9) Render Functions ─────────────────────────────────────
  const renderGrid = () => {
    // We only have one canvas for drawing both players, obstacles, bullets, pickups
    return (
      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H}
        className="duel-canvas"
      />
    );
  };

  // ─── 10) Draw Loop ───────────────────────────────────────────
  useEffect(() => {
    if (!sharedState || sharedState.status !== "active") return;
    const ctx = canvasRef.current.getContext("2d");

    const drawFrame = () => {
      const s = sharedState;
      // background
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // obstacles
      ctx.fillStyle = "#475569";
      s.obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.w, o.h));

      // pickups
      s.pickups.forEach((pk) => {
        ctx.fillStyle = pk.type === "ammo" ? "#22c55e" : "#f87171";
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, PICKUP_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Player B
      ctx.fillStyle = "magenta";
      ctx.beginPath();
      ctx.arc(s.pBState.x, s.pBState.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // Player A
      ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.arc(s.pAState.x, s.pAState.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // bulletsA
      ctx.fillStyle = "white";
      s.bulletsA.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // bulletsB
      ctx.fillStyle = "yellow";
      s.bulletsB.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // countdown overlay
      if (!s.started) {
        ctx.fillStyle = "white";
        ctx.font = "30px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(s.countdown || "", ARENA_W / 2, ARENA_H / 2);
      }

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
      if (s.status === "finished") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        const winnerLabel =
          s.winner === playerA ? "Player A Wins!" : "Player B Wins!";
        ctx.fillText(winnerLabel, ARENA_W / 2, ARENA_H / 2 - 10);
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

  // ─── 11) Render UI ──────────────────────────────────────────
  if (!gameDoc || !sharedState) {
    return (
      <div className="duel-container">
        <h2>Loading Duel…</h2>
      </div>
    );
  }

  if (gameStatus === "pending") {
    return (
      <div className="duel-container">
        <h2>Waiting for opponent to join…</h2>
        <button onClick={handleQuit} className="quit-btn">
          ❌ Cancel Challenge
        </button>
      </div>
    );
  }

  // ACTIVE or FINISHED
  const s = sharedState;
  const isA = user.uid === playerA;
  const myState = isA ? s.pAState : s.pBState;

  return (
    <div className="duel-container">
      <h2>Multiplayer Duel Shots</h2>
      <p>
        Use WASD/Arrows (desktop) or joystick (mobile) to move, 💥 to shoot, P
        to pause.
      </p>

      <div className="status-bar-duel">
        <span>❤️ {isA ? s.pAState.health : s.pBState.health}</span>
        <span>Opponent ❤️ {isA ? s.pBState.health : s.pAState.health}</span>
        <span>🔋 {myState.ammo}</span>
        <span>⏰ {Math.ceil(s.timer)}s</span>
      </div>

      {renderGrid()}

      {/* Desktop Controls */}
      <div className="controls-row">
        <button onClick={handleShoot} className="shoot-btn" disabled={s.status !== "active"}>
          💥 Shoot
        </button>
        {s.status === "active" ? (
          <button
            onClick={() => {
              const updated = { ...s, paused: !s.paused };
              updateDoc(gameDoc, { state: updated });
            }}
            className="pause-btn"
          >
            {s.paused ? "▶️ Resume" : "⏸️ Pause"}
          </button>
        ) : (
          <button onClick={() => {
            if (s.status === "finished") handleQuit();
          }} className="play-again">
            ▶️ Back to Dashboard
          </button>
        )}
        <button onClick={handleQuit} className="quit-btn">
          ❌ Quit
        </button>
      </div>

      {/* Mobile Joystick */}
      {isMobile && s.status === "active" && (
        <div
          className="joystick"
          onTouchStart={onLeftMove}
          onTouchMove={onLeftMove}
          onTouchEnd={onLeftEnd}
        >
          <div className="knob" />
        </div>
      )}

      {/* Mobile Shoot Button */}
      {isMobile && s.status === "active" && (
        <button className="shoot-btn-mobile" onTouchStart={handleShoot}>
          💥
        </button>
      )}

      {/* Chat Box */}
      <div className="chatbox" style={{ marginTop: "1rem" }}>
        <h4>Game Chat</h4>
        <div className="chat-messages" style={{ height: "120px", overflowY: "auto", background: "#1e293b", padding: "0.5rem", borderRadius: "4px" }}>
          {s.chat.map((m, i) => (
            <p key={i} style={{ margin: "0.25rem 0", color: "#cbd5e1" }}>
              <strong style={{ color: "#fff" }}>{m.sender}:</strong>{" "}
              {m.message}
            </p>
          ))}
        </div>
        {s.status === "active" && (
          <div className="chat-input" style={{ display: "flex", marginTop: "0.5rem" }}>
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
