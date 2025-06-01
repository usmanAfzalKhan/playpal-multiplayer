// src/pages/MultiplayerDuel.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams }    from "react-router-dom";
import { auth, db }                  from "../firebase-config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
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

    // Avoid overlapping player spawn areas
    const overlap =
      arr.some(o => rectsOverlap(o, rect)) ||
      rectsOverlap(rect, { x: ARENA_W / 2 - 15, y: ARENA_H - 30 - 15, w: 30, h: 30 }) ||
      rectsOverlap(rect, { x: ARENA_W / 2 - 15, y: 15,            w: 30, h: 30 });

    if (!overlap) arr.push(rect);
  }
  return arr;
}

export default function MultiplayerDuel() {
  const { gameId }   = useParams();
  const navigate     = useNavigate();
  const user         = auth.currentUser;

  const canvasRef    = useRef(null);
  const moveVecRef   = useRef({ dx: 0, dy: 0 }); // for mobile joystick

  // ─── Firestore references & shared state ───
  const [gameDocRef,    setGameDocRef]    = useState(null);
  const [sharedState,   setSharedState]   = useState(null);
  const [playerA,       setPlayerA]       = useState("");
  const [playerB,       setPlayerB]       = useState("");
  // We’ll also want their actual usernames:
  const [playerAName,   setPlayerAName]   = useState("");
  const [playerBName,   setPlayerBName]   = useState("");

  // ─── “Invitation” flow (if no gameId yet) ───
  const [username,      setUsername]      = useState("");
  const [friends,       setFriends]       = useState([]);
  const [waitingId,     setWaitingId]     = useState(null);

  // ─── Chat input ───
  const [chatInput,     setChatInput]     = useState("");

  const isMobile = window.innerWidth < 768;

  // ─── A) Load current user's username from Firestore ───
  useEffect(() => {
    if (!user) return navigate("/");
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists()) {
        setUsername(snap.data().username);
      }
    });
  }, [user, navigate]);

  // ─── B) If no gameId, fetch “friends” to challenge ───
  useEffect(() => {
    if (gameId) return;
    if (!user) return;
    getDocs(collection(db, `users/${user.uid}/friends`)).then(snap => {
      const f = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setFriends(f);
    });
  }, [gameId, user]);

  // ─── C) Challenge a friend ───
  const handleChallenge = async (friend) => {
    if (!user) return;
    // game document ID:
    const id = `${user.uid}_${friend.uid}_${Date.now()}`;

    const initialState = {
      initted: false,
      leaving: [],
    };

    // Create the duelGames/<id> doc with “pending” status
    await setDoc(doc(db, "duelGames", id), {
      playerA: user.uid,
      playerB: friend.uid,
      status: "pending",
      state: initialState,
    });

    // Send them a notification under users/<friend>/notifications
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

  // ─── D) Wait for “status” → “active” (Player A’s side) ───
  // If status flips to “active,” then navigate into /duel/multiplayer/<gameId>
  useEffect(() => {
    if (!waitingId) return;
    const docRef = doc(db, "duelGames", waitingId);
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === "active") {
        // Opponent clicked “Join Duel Shots,” so move us into the actual game
        navigate(`/duel/multiplayer/${waitingId}`);
      }
    });
    return () => unsub();
  }, [waitingId, navigate]);

  // ─── E) If gameId is present, subscribe to that Firestore doc ───
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

      // Fetch their Firestore “username” fields
      getDoc(doc(db, "users", data.playerA)).then(snapA => {
        if (snapA.exists()) setPlayerAName(snapA.data().username);
      });
      getDoc(doc(db, "users", data.playerB)).then(snapB => {
        if (snapB.exists()) setPlayerBName(snapB.data().username);
      });

      // If I’m playerB and status is “pending”, flip to “active”
      if (user.uid === data.playerB && data.status === "pending") {
        updateDoc(docRef, { status: "active" });
      }
    });
  }, [gameId, user, navigate]);

  // ─── F) Listen for any Firestore changes to that game doc & handle “leaving” cleanup ───
  useEffect(() => {
    if (!gameDocRef) return;
    const unsub = onSnapshot(gameDocRef, (snap) => {
      if (!snap.exists()) return navigate("/dashboard");
      const data = snap.data();
      setSharedState(data.state);
    });

    const cleanupOnExit = () => {
      getDoc(gameDocRef).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        const leaves = data.state.leaving || [];
        if (!leaves.includes(user.uid)) leaves.push(user.uid);

        // If both have “left,” delete the entire game
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

  // ─── G) Initialize game once both players have joined, _only on Player A_ ───
  useEffect(() => {
    if (!sharedState || !gameDocRef) return;
    // *** Only Player A (host) writes the “initial” state ***
    if (!sharedState.initted && user.uid === playerA) {
      const initObs  = generateObstacles();
      const initTime = Date.now() / 1000;
      const initial = {
        initted: true,
        started: true,
        paused: false,
        timer: GAME_TIME,
        obstacles: initObs,
        lastPickupTime: initTime,
        pA: { x: ARENA_W / 2, y: ARENA_H - 30, health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
        pB: { x: ARENA_W / 2, y: 30,            health: INITIAL_HEALTH, ammo: INITIAL_AMMO },
        moveA: { dx: 0, dy: 0 },
        moveB: { dx: 0, dy: 0 },
        bulletsA: [],
        bulletsB: [],
        pickups: [],
        chat: [],
        winner: "",
        leaving: sharedState.leaving || [],
      };
      updateDoc(gameDocRef, { state: initial }).catch(() => {});
      setSharedState(initial);
    }
  }, [sharedState, gameDocRef, user, playerA]);

  // ─── H) Main game loop (authoritative → only Player A) ───
  useEffect(() => {
    if (
      !sharedState ||
      !sharedState.started ||
      sharedState.paused ||
      sharedState.winner ||
      user.uid !== playerA
    ) {
      return;
    }

    let last = performance.now();
    let rafId;
    let lastWrite = 0; // to throttle Firestore

    const gameLoop = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      // Deep‐copy shared state so we can mutate
      const s = {
        ...sharedState,
        pA: { ...sharedState.pA },
        pB: { ...sharedState.pB },
        bulletsA: [...sharedState.bulletsA],
        bulletsB: [...sharedState.bulletsB],
        pickups: [...sharedState.pickups],
        obstacles: [...sharedState.obstacles],
        chat: [...sharedState.chat],
        leaving: [...sharedState.leaving],
      };

      // 1) Move Player A’s position
      if (s.moveA.dx || s.moveA.dy) {
        const me = s.pA;
        const nx = Math.max(0, Math.min(ARENA_W, me.x + s.moveA.dx * PLAYER_SPEED * dt));
        const ny = Math.max(0, Math.min(ARENA_H, me.y + s.moveA.dy * PLAYER_SPEED * dt));
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

      // 2) Move Player B’s position
      if (s.moveB.dx || s.moveB.dy) {
        const me = s.pB;
        const nx = Math.max(0, Math.min(ARENA_W, me.x + s.moveB.dx * PLAYER_SPEED * dt));
        const ny = Math.max(0, Math.min(ARENA_H, me.y + s.moveB.dy * PLAYER_SPEED * dt));
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

      // 3) Update bulletsA
      s.bulletsA = s.bulletsA.filter((b) => {
        b.x += b.dx * SHOT_SPEED * dt;
        b.y += b.dy * SHOT_SPEED * dt;
        // remove bullet if out of bounds
        if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
        // remove bullet if hits obstacle
        for (const o of s.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
            return false;
          }
        }
        // check if it hits Player B
        const hitDist = Math.hypot(b.x - s.pB.x, b.y - s.pB.y);
        if (hitDist < 12) {
          s.pB.health = Math.max(0, s.pB.health - 1);
          return false;
        }
        return true;
      });

      // 4) Update bulletsB
      s.bulletsB = s.bulletsB.filter((b) => {
        b.x += b.dx * SHOT_SPEED * dt;
        b.y += b.dy * SHOT_SPEED * dt;
        if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
        for (const o of s.obstacles) {
          if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
            return false;
          }
        }
        const hitDist = Math.hypot(b.x - s.pA.x, b.y - s.pA.y);
        if (hitDist < 12) {
          s.pA.health = Math.max(0, s.pA.health - 1);
          return false;
        }
        return true;
      });

      // 5) Spawn pickups every PICKUP_INTERVAL
      const nowSec = Date.now() / 1000;
      if (nowSec - s.lastPickupTime >= PICKUP_INTERVAL) {
        let px, py, tries = 0;
        do {
          px = randInt(15, ARENA_W - 15);
          py = randInt(15, ARENA_H - 15);
          const rect = { x: px - PICKUP_SIZE / 2, y: py - PICKUP_SIZE / 2, w: PICKUP_SIZE, h: PICKUP_SIZE };
          const collObs  = s.obstacles.some(o => rectsOverlap(o, rect));
          const collPick = s.pickups.some(pk => Math.hypot(pk.x - px, pk.y - py) < PICKUP_SIZE);
          if (!collObs && !collPick) break;
          tries++;
        } while (tries < 50);

        const nextType = s.pickups.length % 2 === 0 ? "ammo" : "health";
        s.pickups.push({ x: px, y: py, type: nextType });
        s.lastPickupTime = nowSec;
      }

      // 6) Collect pickups
      s.pickups = s.pickups.filter((pk) => {
        const distA = Math.hypot(s.pA.x - pk.x, s.pA.y - pk.y);
        if (distA < 14) {
          if (pk.type === "ammo")  s.pA.ammo = Math.min(s.pA.ammo + 3, INITIAL_AMMO);
          else                     s.pA.health = Math.min(s.pA.health + 1, INITIAL_HEALTH);
          return false;
        }
        const distB = Math.hypot(s.pB.x - pk.x, s.pB.y - pk.y);
        if (distB < 14) {
          if (pk.type === "ammo")  s.pB.ammo = Math.min(s.pB.ammo + 3, INITIAL_AMMO);
          else                     s.pB.health = Math.min(s.pB.health + 1, INITIAL_HEALTH);
          return false;
        }
        return true;
      });

      // 7) Countdown timer
      if (!s.paused && !s.winner) {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.timer = 0;
          if (s.pA.health > s.pB.health) s.winner = playerA;
          else if (s.pB.health > s.pA.health) s.winner = playerB;
          else s.winner = ""; // draw
        }
      }

      // 8) Health-based victory
      if (!s.winner) {
        if (s.pA.health <= 0) s.winner = playerB;
        else if (s.pB.health <= 0) s.winner = playerA;
      }

      // 9) Throttle Firestore updates to once every 200ms
      const nowMs = performance.now();
      if (nowMs - lastWrite > 200) {
        updateDoc(gameDocRef, { state: s }).catch(() => {});
        lastWrite = nowMs;
        setSharedState(s);
      }

      rafId = requestAnimationFrame(gameLoop);
    };

    rafId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafId);
  }, [sharedState, gameDocRef, playerA, playerB, user]);

  // ─── I) DESKTOP CONTROLS (both players send their move vector to Firestore) ───
  useEffect(() => {
    if (!sharedState || !gameDocRef) return;

    const onKeyDown = (e) => {
      if (!sharedState.started || sharedState.paused || sharedState.winner) return;
      let dx = 0, dy = 0;
      if (e.key === "ArrowUp"    || /^[wW]$/.test(e.key)) dy = -1;
      if (e.key === "ArrowDown"  || /^[sS]$/.test(e.key)) dy =  1;
      if (e.key === "ArrowLeft"  || /^[aA]$/.test(e.key)) dx = -1;
      if (e.key === "ArrowRight" || /^[dD]$/.test(e.key)) dx =  1;

      if (dx || dy) {
        const m = Math.hypot(dx, dy) || 1;
        const newMove = { dx: dx / m, dy: dy / m };
        const field = (user.uid === playerA ? "moveA" : "moveB");
        const updated = { ...sharedState, [field]: newMove };
        updateDoc(gameDocRef, { state: updated }).catch(() => {});
        setSharedState(updated);
      }

      if (e.key === "p" || e.key === "P") {
        const updated = { ...sharedState, paused: !sharedState.paused };
        updateDoc(gameDocRef, { state: updated }).catch(() => {});
        setSharedState(updated);
      }
    };

    const onKeyUp = (e) => {
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d","W","A","S","D"].includes(e.key)) {
        const field = (user.uid === playerA ? "moveA" : "moveB");
        const updated = { ...sharedState, [field]: { dx: 0, dy: 0 } };
        updateDoc(gameDocRef, { state: updated }).catch(() => {});
        setSharedState(updated);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [sharedState, gameDocRef, playerA, playerB, user]);

  // ─── J) MOBILE JOYSTICK (both send move vectors) ───
  const onLeftMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = (t.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let dy = (t.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    const newMove = { dx: dx / m, dy: dy / m };
    moveVecRef.current = newMove;

    if (sharedState) {
      const field = (user.uid === playerA ? "moveA" : "moveB");
      const updated = { ...sharedState, [field]: newMove };
      updateDoc(gameDocRef, { state: updated }).catch(() => {});
      setSharedState(updated);
    }
  };

  const onLeftEnd = () => {
    moveVecRef.current = { dx: 0, dy: 0 };
    if (sharedState) {
      const field = (user.uid === playerA ? "moveA" : "moveB");
      const updated = { ...sharedState, [field]: { dx: 0, dy: 0 } };
      updateDoc(gameDocRef, { state: updated }).catch(() => {});
      setSharedState(updated);
    }
  };

  // ─── K) SHOOT HANDLER ───
  const handleShoot = () => {
    if (!sharedState || !sharedState.started || sharedState.paused || sharedState.winner) return;
    const amA = user.uid === playerA;
    // Make a fresh copy to mutate
    const s = {
      ...sharedState,
      pA: { ...sharedState.pA },
      pB: { ...sharedState.pB },
      bulletsA: [...sharedState.bulletsA],
      bulletsB: [...sharedState.bulletsB],
      chat: [...sharedState.chat],
    };

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

    updateDoc(gameDocRef, { state: s }).catch(() => {});
    setSharedState(s);
  };

  // ─── L) CHAT ───
  const sendChat = async () => {
    if (!chatInput.trim() || !sharedState) return;

    // Push actual username, not “PlayerA”/“PlayerB”
    const msgObj = {
      sender: username,
      message: chatInput,
      timestamp: Timestamp.now(),
    };
    const updated = { ...sharedState, chat: [...sharedState.chat, msgObj] };
    await updateDoc(gameDocRef, { state: updated }).catch(() => {});
    setSharedState(updated);
    setChatInput("");
  };

  // ─── M) QUIT GAME ───
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
      const updated = { ...data.state, leaving };
      await updateDoc(gameDocRef, { state: updated }).catch(() => {});
    }
    navigate("/dashboard");
  };

  // ─── N) DRAW CANVAS (every client just renders sharedState) ───
  useEffect(() => {
    if (!sharedState || !sharedState.started) return;
    const ctx = canvasRef.current.getContext("2d");

    const drawFrame = () => {
      const s = sharedState;
      // background
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

      // Game Over overlay with real username
      if (s.winner) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        const label =
          s.winner === playerA
            ? `${playerAName} Wins!`
            : s.winner === playerB
            ? `${playerBName} Wins!`
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
  }, [sharedState, playerA, playerB, playerAName, playerBName]);

  // ─── O) RENDER: “Challenge Friend” screen vs “Game” screen ───
  if (!gameId) {
    // Not in a specific game yet, show “Challenge a friend” UI
    return (
      <div className="duel-container">
        <h2>Challenge a Friend to Duel Shots</h2>
        <p className="explanation">
          Select a friend below and send them a challenge.
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
            <p>
              Waiting for @{friends.find(f => f.uid === waitingId.split("_")[1])?.username} to accept…
            </p>
            <button onClick={() => navigate("/dashboard")}>❌ Cancel</button>
          </>
        )}
      </div>
    );
  }

  if (!sharedState) {
    // We have a gameId in the URL but we haven't loaded the Firestore doc yet
    return (
      <div className="duel-container">
        <h2>Loading Duel…</h2>
      </div>
    );
  }

  if (!sharedState.initted) {
    // sharedState exists but we haven't initialized the board yet
    return (
      <div className="duel-container">
        <h2>Waiting for opponent to join…</h2>
        <button onClick={handleQuit} className="quit-btn">
          ❌ Cancel Challenge
        </button>
      </div>
    );
  }

  // ─── BOTH CLIENTS: Active or finished game ───
  const s   = sharedState;
  const amA = user.uid === playerA;
  // If I am Player A, “myState” is s.pA, else (I’m Player B) “myState” is s.pB
  const myState  = amA ? s.pA : s.pB;
  const oppState = amA ? s.pB : s.pA;
  // Also set “myName” vs “theirName”
  const myName   = amA ? playerAName : playerBName;
  const oppName  = amA ? playerBName : playerAName;

  return (
    <div className="duel-container">
      <h2>Multiplayer Duel Shots</h2>
      <p>
        Use WASD/Arrows to move (desktop) or joystick (mobile), 💥 to shoot, P to pause.
      </p>

      <div className="status-bar-duel">
        <span>
          You ({myName}) ❤️ {myState.health}
        </span>
        <span>
          Opponent ({oppName}) ❤️ {oppState.health}
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
              updateDoc(gameDocRef, { state: toggled }).catch(() => {});
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

      {/* Mobile-only joystick (bottom-left of arena) */}
      {isMobile && !s.winner && !s.paused && (
        <div
          className="joystick left"
          onTouchStart={onLeftMove}
          onTouchMove={onLeftMove}
          onTouchEnd={onLeftEnd}
          style={{ zIndex: 2 /* Ensure joystick sits above chat */ }}
        >
          <div className="knob" />
        </div>
      )}

      {/* Mobile-only “Shoot” button (bottom-right, above chat) */}
      {isMobile && !s.winner && !s.paused && (
        <button
          className="shoot-btn-mobile"
          onTouchStart={handleShoot}
          style={{ zIndex: 2 /* Keep it above chat */ }}
        >
          💥
        </button>
      )}

      {/* Chat box (below arena) */}
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
