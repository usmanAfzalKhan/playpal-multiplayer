// src/pages/SinglePlayerDuel.jsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./DuelGame.css"; // Import corresponding CSS for styling

// ─── Game Configuration Constants ────────────────────────────

// Canvas dimensions (width & height)
const ARENA_W = 300;
const ARENA_H = 300;

// Movement and shooting speeds (in pixels per second)
const PLAYER_SPEED = 200; // Player movement speed
const SHOT_SPEED = 150; // Bullet speed

// Initial values for health, ammo, and game time
const INITIAL_HEALTH = 5; // Both player and AI start with this health
const INITIAL_AMMO = 10; // Starting ammo count for player
const GAME_TIME = 60; // Total game timer (in seconds)

// Pickup properties
const PICKUP_SIZE = 12; // Diameter of health/ammo pickup
const PICKUP_INTERVAL = 5; // Seconds between spawning new pickups

// ─── Utility Functions ────────────────────────────────────────

// randInt(min, max)
// Returns a random integer in [min, max)
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// rectsOverlap(r1, r2)
// Returns true if two axis-aligned rectangles overlap.
// Each rectangle is an object: { x, y, w, h }
function rectsOverlap(r1, r2) {
  return (
    r1.x < r2.x + r2.w &&
    r1.x + r1.w > r2.x &&
    r1.y < r2.y + r2.h &&
    r1.y + r1.h > r2.y
  );
}

export default function SinglePlayerDuel() {
  const navigate = useNavigate(); // For programmatic navigation (e.g., Quit → Dashboard)
  const canvasRef = useRef(null); // Reference to <canvas> DOM element
  const moveVecRef = useRef({ dx: 0, dy: 0 }); // Holds mobile joystick vector between renders

  // ─── 1) CORE GAME STATE ──────────────────────────────────────

  // Countdown before the game starts (3 → 2 → 1 → GO)
  const [countdown, setCountdown] = useState(3);

  // Flags indicating whether the game has started, is paused, or is over
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // One-time message shown on screen (e.g., "No Ammo")
  const [message, setMessage] = useState("");

  // Player and AI positions, stored as { x, y }
  const [player, setPlayer] = useState({ x: ARENA_W / 2, y: ARENA_H - 30 });
  const [ai, setAi] = useState({ x: ARENA_W / 2, y: 30 });

  // Arrays of bullets: each bullet has { x, y, dx, dy } motion vector
  const [bullets, setBullets] = useState([]);
  const [aiShots, setAiShots] = useState([]);

  // Health and ammo trackers
  const [pHealth, setPHealth] = useState(INITIAL_HEALTH);
  const [aiHealth, setAiHealth] = useState(INITIAL_HEALTH);
  const [ammo, setAmmo] = useState(INITIAL_AMMO);

  // Game timer countdown
  const [timer, setTimer] = useState(GAME_TIME);

  // Movement vector for desktop (updated by WASD/Arrow keys)
  const [moveVec, setMoveVec] = useState({ dx: 0, dy: 0 });

  // Obstacles randomly placed in the arena (array of { x, y, w, h })
  const [obstacles, setObstacles] = useState([]);

  // Pickups (health or ammo) currently spawned (array of { x, y, type })
  const [pickups, setPickups] = useState([]);

  // Timestamp (in seconds) when the last pickup was spawned
  const [lastPickupTime, setLastPickupTime] = useState(0);

  // Detect if running on mobile (viewport width < 768px)
  const isMobile = window.innerWidth < 768;

  // ─── 2) COUNTDOWN TIMER (before game starts) ───────────────────
  useEffect(() => {
    if (countdown <= 0) {
      // Countdown finished → start game
      setStarted(true);
      return;
    }
    // Decrease countdown by 1 every second
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ─── 3) GAME CLOCK (runs once game has started) ────────────────
  useEffect(() => {
    // Only run timer if the game is started, not paused, and not over
    if (!started || paused || gameOver) return;

    const id = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          // Time is up → end game
          clearInterval(id);
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [started, paused, gameOver]);

  // ─── 4) RANDOMIZE OBSTACLES ONCE AT START ───────────────────────
  useEffect(() => {
    if (!started) return;

    const newObs = [];
    let attempts = 0;

    // Attempt to place 5 obstacles without overlapping each other / player / AI
    while (newObs.length < 5 && attempts < 200) {
      attempts++;
      const ow = randInt(30, 60); // random obstacle width
      const oh = randInt(20, 50); // random obstacle height
      const ox = randInt(10, ARENA_W - ow - 10);
      const oy = randInt(50, ARENA_H - oh - 50);
      const rect = { x: ox, y: oy, w: ow, h: oh };

      // Check if it overlaps any existing obstacle, or initial player/AI
      const overlap =
        newObs.some((o) => rectsOverlap(o, rect)) ||
        rectsOverlap(rect, {
          x: player.x - 15,
          y: player.y - 15,
          w: 30,
          h: 30,
        }) ||
        rectsOverlap(rect, { x: ai.x - 15, y: ai.y - 15, w: 30, h: 30 });

      if (!overlap) newObs.push(rect);
    }

    setObstacles(newObs);
  }, [started]);

  // ─── 5) SPAWN PICKUPS PERIODICALLY ──────────────────────────────
  useEffect(() => {
    if (!started || paused || gameOver) return;

    const now = Date.now() / 1000; // current time in seconds

    if (now - lastPickupTime >= PICKUP_INTERVAL) {
      let px,
        py,
        tries = 0;

      // Try up to 50 times to find a location that doesn’t collide
      do {
        px = randInt(15, ARENA_W - 15);
        py = randInt(15, ARENA_H - 15);
        const rect = {
          x: px - PICKUP_SIZE / 2,
          y: py - PICKUP_SIZE / 2,
          w: PICKUP_SIZE,
          h: PICKUP_SIZE,
        };
        const collidesObs = obstacles.some((o) => rectsOverlap(o, rect));
        const collidesPick = pickups.some((pk) => rectsOverlap(pk, rect));
        if (!collidesObs && !collidesPick) break;
        tries++;
      } while (tries < 50);

      // Alternate between ammo and health pickups
      const nextType = pickups.length % 2 === 0 ? "ammo" : "health";
      setPickups((ps) => [...ps, { x: px, y: py, type: nextType }]);
      setLastPickupTime(now);
    }

    // Dummy timeout so cleanup happens once per second
    const id = setTimeout(() => {}, 1000);
    return () => clearTimeout(id);
  }, [started, paused, gameOver, pickups, lastPickupTime, obstacles]);

  // ─── 6) DESKTOP KEYBOARD CONTROLS ──────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!started || paused || gameOver) return;

      let dx = 0,
        dy = 0;
      // Arrow keys or WASD → set direction vector
      if (e.key === "ArrowUp" || /^[wW]$/.test(e.key)) dy = -1;
      if (e.key === "ArrowDown" || /^[sS]$/.test(e.key)) dy = 1;
      if (e.key === "ArrowLeft" || /^[aA]$/.test(e.key)) dx = -1;
      if (e.key === "ArrowRight" || /^[dD]$/.test(e.key)) dx = 1;

      // Normalize vector to length 1 if diagonal movement
      if (dx || dy) {
        const m = Math.hypot(dx, dy) || 1;
        setMoveVec({ dx: dx / m, dy: dy / m });
      }

      // 'P' key toggles pause
      if (e.key === "p" || e.key === "P") {
        setPaused((p) => !p);
      }
    };

    const onKeyUp = (e) => {
      // When arrow/WASD released, stop movement
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
          "W",
          "A",
          "S",
          "D",
        ].includes(e.key)
      ) {
        setMoveVec({ dx: 0, dy: 0 });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [started, paused, gameOver]);

  // ─── 7) MAIN GAME LOOP & RENDER (60fps) ───────────────────────
  useEffect(() => {
    let last = performance.now();
    let rafId;

    // computeAiAim(): returns normalized vector (dx, dy) for AI to aim at player
    const computeAiAim = () => {
      let dx0 = player.x - ai.x;
      let dy0 = player.y - ai.y;
      const dist = Math.hypot(dx0, dy0) || 1;

      // Raycast in steps of 5 pixels to see if obstacle blocks line of fire
      const steps = Math.floor(dist / 5);
      let blocked = false;
      for (let i = 1; i < steps; i++) {
        const ix = ai.x + (dx0 / steps) * i;
        const iy = ai.y + (dy0 / steps) * i;
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
        // If blocked, add random offset to aim slightly off
        dx0 += (Math.random() - 0.5) * 50;
        dy0 += (Math.random() - 0.5) * 50;
      }
      const m = Math.hypot(dx0, dy0) || 1;
      return { dx: dx0 / m, dy: dy0 / m };
    };

    // gameLoop(): updates state and draws the next frame
    const gameLoop = (now) => {
      const dt = (now - last) / 1000; // delta time in seconds
      last = now;

      if (started && !paused && !gameOver) {
        // ─── Move Player ───────────────────────────────────
        const vec = isMobile ? moveVecRef.current : moveVec;
        if (vec.dx || vec.dy) {
          setPlayer((p) => {
            // Calculate new position
            const nx = Math.max(
              0,
              Math.min(ARENA_W, p.x + vec.dx * PLAYER_SPEED * dt)
            );
            const ny = Math.max(
              0,
              Math.min(ARENA_H, p.y + vec.dy * PLAYER_SPEED * dt)
            );
            // Check collision with obstacles
            for (const o of obstacles) {
              if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
                // Collision → cancel movement
                return p;
              }
            }
            return { x: nx, y: ny };
          });
        }

        // ─── Update Player Bullets ───────────────────────────
        setBullets((bs) =>
          bs.filter((b) => {
            // Move bullet forward
            b.x += b.dx * SHOT_SPEED * dt;
            b.y += b.dy * SHOT_SPEED * dt;

            // Remove if out of bounds
            if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H)
              return false;

            // Remove if bullet hits any obstacle
            for (const o of obstacles) {
              if (
                b.x > o.x &&
                b.x < o.x + o.w &&
                b.y > o.y &&
                b.y < o.y + o.h
              ) {
                return false;
              }
            }

            // If bullet hits AI (distance < 12px), deal damage
            if (Math.hypot(b.x - ai.x, b.y - ai.y) < 12) {
              setAiHealth((aH) => Math.max(0, aH - 1));
              return false;
            }

            return true; // Keep bullet otherwise
          })
        );

        // ─── Update AI Shots ───────────────────────────────────
        setAiShots((bs) =>
          bs.filter((b) => {
            // Move shot forward
            b.x += b.dx * SHOT_SPEED * dt;
            b.y += b.dy * SHOT_SPEED * dt;

            // Remove if out of bounds
            if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H)
              return false;

            // Remove if hits an obstacle
            for (const o of obstacles) {
              if (
                b.x > o.x &&
                b.x < o.x + o.w &&
                b.y > o.y &&
                b.y < o.y + o.h
              ) {
                return false;
              }
            }

            // If shot hits player (distance < 12px), deal damage
            if (Math.hypot(b.x - player.x, b.y - player.y) < 12) {
              setPHealth((pH) => Math.max(0, pH - 1));
              return false;
            }

            return true; // Keep shot otherwise
          })
        );

        // ─── AI MOVEMENT ───────────────────────────────────────
        setAi((a) => {
          // Calculate dodge vector if player shot is nearby
          let dodgeX = 0,
            dodgeY = 0;
          aiShots.forEach((s) => {
            const dist = Math.hypot(a.x - s.x, a.y - s.y);
            if (dist < 50) {
              // Compute dodge direction (move away from shot)
              const ang = Math.atan2(a.y - s.y, a.x - s.x);
              dodgeX += Math.cos(ang);
              dodgeY += Math.sin(ang);
            }
          });
          if (Math.hypot(dodgeX, dodgeY) > 0.5) {
            // Dodge if aggregated vector magnitude > 0.5
            const m = Math.hypot(dodgeX, dodgeY);
            dodgeX /= m;
            dodgeY /= m;
            const nx = Math.max(
              0,
              Math.min(ARENA_W, a.x + dodgeX * PLAYER_SPEED * dt)
            );
            const ny = Math.max(
              0,
              Math.min(ARENA_H, a.y + dodgeY * PLAYER_SPEED * dt)
            );
            // Cancel move if colliding obstacle
            for (const o of obstacles) {
              if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
                return a;
              }
            }
            return { x: nx, y: ny };
          }

          // Otherwise, pursue the player with slight random jitter
          let vx = player.x - a.x;
          let vy = player.y - a.y;
          const dist = Math.hypot(vx, vy) || 1;
          vx = vx / dist;
          vy = vy / dist;
          vx += (Math.random() - 0.5) * 0.2;
          vy += (Math.random() - 0.5) * 0.2;
          const m2 = Math.hypot(vx, vy) || 1;
          vx /= m2;
          vy /= m2;
          const nx = Math.max(
            0,
            Math.min(ARENA_W, a.x + vx * PLAYER_SPEED * dt)
          );
          const ny = Math.max(
            0,
            Math.min(ARENA_H, a.y + vy * PLAYER_SPEED * dt)
          );
          // Cancel move if colliding obstacle
          for (const o of obstacles) {
            if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
              return a;
            }
          }
          return { x: nx, y: ny };
        });

        // ─── AI SHOOTING (AUTO-AIM) ─────────────────────────────
        if (Math.random() < 0.02) {
          // 2% chance per frame to fire at the player
          const aim = computeAiAim();
          setAiShots((as) => [
            ...as,
            { x: ai.x, y: ai.y, dx: aim.dx, dy: aim.dy },
          ]);
        }

        // ─── PROCESS PICKUPS ────────────────────────────────────
        setPickups((ps) =>
          ps.filter((pk) => {
            // Check if player collects pickup (distance < 14px)
            const distP = Math.hypot(player.x - pk.x, player.y - pk.y);
            if (distP < 14) {
              if (pk.type === "ammo") {
                setAmmo((a) => a + 3); // Give 3 ammo
              }
              if (pk.type === "health") {
                setPHealth((h) => Math.min(INITIAL_HEALTH, h + 1));
              }
              return false; // Remove pickup once collected
            }
            // Check if AI collects pickup
            const distA = Math.hypot(ai.x - pk.x, ai.y - pk.y);
            if (distA < 14) {
              if (pk.type === "health") {
                setAiHealth((h) => Math.min(INITIAL_HEALTH, h + 1));
              }
              return false;
            }
            return true; // Keep pickup if not collected
          })
        );
      }

      // Draw the updated frame
      drawFrame();
      rafId = requestAnimationFrame(gameLoop);
    };

    // drawFrame(): clears canvas and redraws everything
    const drawFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Clear background
      ctx.fillStyle = "#1e293b"; // Dark blue
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // Draw obstacles as gray rectangles
      ctx.fillStyle = "#475569";
      obstacles.forEach((o) => ctx.fillRect(o.x, o.y, o.w, o.h));

      // Draw pickups (green for ammo, red for health)
      pickups.forEach((pk) => {
        ctx.fillStyle = pk.type === "ammo" ? "#22c55e" : "#f87171";
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, PICKUP_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw AI as magenta circle
      ctx.fillStyle = "magenta";
      ctx.beginPath();
      ctx.arc(ai.x, ai.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // Draw player as cyan circle
      ctx.fillStyle = "cyan";
      ctx.beginPath();
      ctx.arc(player.x, player.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      // Draw player bullets as white circles
      ctx.fillStyle = "white";
      bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw AI shots as yellow circles
      ctx.fillStyle = "yellow";
      aiShots.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // If countdown is still running, display it in the center
      if (!started) {
        ctx.fillStyle = "white";
        ctx.font = "30px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(countdown, ARENA_W / 2, ARENA_H / 2);
      }

      // If paused, overlay a translucent layer with "PAUSED" text
      if (paused) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = "white";
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", ARENA_W / 2, ARENA_H / 2);
      }

      // If game over, overlay final result
      if (gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        if (pHealth <= 0 && aiHealth <= 0) {
          ctx.fillText(`Draw!`, ARENA_W / 2, ARENA_H / 2 - 10);
        } else if (pHealth <= 0) {
          ctx.fillText(`You Lose!`, ARENA_W / 2, ARENA_H / 2 - 10);
        } else {
          ctx.fillText(`You Win!`, ARENA_W / 2, ARENA_H / 2 - 10);
        }
      }
    };

    // Kick off the loop
    rafId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    started,
    paused,
    gameOver,
    player,
    ai,
    bullets,
    aiShots,
    countdown,
    obstacles,
    pickups,
    pHealth,
    aiHealth,
    timer,
    isMobile,
    moveVec, // Depend on moveVec so movement updates
  ]);

  // ─── 8) SHOOT HANDLER (for both desktop button & mobile tap) ─
  const handleShoot = () => {
    // Prevent shooting if game not active
    if (!started || paused || gameOver) return;

    // If no ammo, show warning message
    if (ammo <= 0) {
      setMessage("❗ No Ammo");
      return;
    }

    // Compute normalized vector from player to AI
    const dx0 = ai.x - player.x;
    const dy0 = ai.y - player.y;
    const m = Math.hypot(dx0, dy0) || 1;

    // Deduct one ammo and spawn bullet in that direction
    setAmmo((a) => a - 1);
    setBullets((bs) => [
      ...bs,
      { x: player.x, y: player.y, dx: dx0 / m, dy: dy0 / m },
    ]);
  };

  // ─── 9) MOBILE JOYSTICK HANDLERS ────────────────────────────

  // onLeftMove: update moveVecRef.current based on touch position
  const onLeftMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();

    // Calculate relative dx, dy in [-1, 1] based on touch offset from joystick center
    let dx = (t.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    let dy = (t.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    moveVecRef.current = { dx: dx / m, dy: dy / m };
  };

  // onLeftEnd: stop movement when touch ends
  const onLeftEnd = () => {
    moveVecRef.current = { dx: 0, dy: 0 };
  };

  // ─── 10) END-OF-GAME CHECK ────────────────────────────────────
  // Whenever health or timer changes, check if game is over
  useEffect(() => {
    if (pHealth <= 0 || aiHealth <= 0 || timer <= 0) {
      setGameOver(true);
    }
  }, [pHealth, aiHealth, timer]);

  // ─── 11) RESET GAME STATE TO INITIAL VALUES ──────────────────
  const resetGame = () => {
    setCountdown(3);
    setStarted(false);
    setPaused(false);
    setGameOver(false);
    setPlayer({ x: ARENA_W / 2, y: ARENA_H - 30 });
    setAi({ x: ARENA_W / 2, y: 30 });
    setBullets([]);
    setAiShots([]);
    setPHealth(INITIAL_HEALTH);
    setAiHealth(INITIAL_HEALTH);
    setAmmo(INITIAL_AMMO);
    setTimer(GAME_TIME);
    setMessage("");
    setMoveVec({ dx: 0, dy: 0 });
    moveVecRef.current = { dx: 0, dy: 0 };
    setObstacles([]);
    setPickups([]);
    setLastPickupTime(Date.now() / 1000);
  };

  // ─── 12) RENDER JSX ──────────────────────────────────────────
  return (
    <div className="duel-container">
      <h2>Duel Shots: Single Player</h2>
      <p>
        Use WASD/Arrows to move (diagonals work), 💥 to shoot (auto-aim), P to
        pause.
      </p>

      {/* Status bar: show player health, AI health, ammo, and remaining time */}
      <div className="status-bar-duel">
        <span>❤️ {pHealth}</span>
        <span>AI ❤️ {aiHealth}</span>
        <span>🔋 {ammo}</span>
        <span>⏰ {timer}s</span>
      </div>

      {/* Canvas element where game is drawn */}
      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H}
        className="duel-canvas"
      />

      {/* Control buttons: Shoot, Pause/Resume or Play Again, and Quit */}
      <div className="controls-row">
        <button onClick={handleShoot} className="shoot-btn">
          💥 Shoot
        </button>
        {gameOver ? (
          <button onClick={resetGame} className="play-again">
            ▶️ Play Again
          </button>
        ) : (
          <button onClick={() => setPaused((p) => !p)} className="pause-btn">
            {paused ? "▶️ Resume" : "⏸️ Pause"}
          </button>
        )}
        <button onClick={() => navigate("/dashboard")} className="quit-btn">
          ❌ Quit
        </button>
      </div>

      {/* Display one-time messages, e.g., "No Ammo" */}
      {message && <p className="action-msg">{message}</p>}

      {/* On-screen joystick (only shown on mobile, when game is active) */}
      {isMobile && !gameOver && (
        <div
          className="joystick"
          onTouchStart={onLeftMove}
          onTouchMove={onLeftMove}
          onTouchEnd={onLeftEnd}
        >
          <div className="knob" />
        </div>
      )}

      {/* Mobile-only Shoot button in bottom-right corner */}
      {isMobile && !gameOver && (
        <button className="shoot-btn-mobile" onTouchStart={handleShoot}>
          💥
        </button>
      )}
    </div>
  );
}
