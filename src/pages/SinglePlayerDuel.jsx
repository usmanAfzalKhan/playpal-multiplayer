// src/pages/SinglePlayerDuel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate }             from 'react-router-dom';
import './DuelGame.css';

const ARENA_W        = 300;
const ARENA_H        = 300;
// slowed down speeds for smoother play
const PLAYER_SPEED   = 140;   // px/sec
const SHOT_SPEED     = 160;   // px/sec
const INITIAL_HEALTH = 5;
const INITIAL_AMMO   = 10;
const GAME_TIME      = 60;

// helper to get random number in [min, max]
const rand = (min, max) => min + Math.random() * (max - min);

export default function SinglePlayerDuel() {
  const navigate       = useNavigate();
  const canvasRef      = useRef(null);

  // UI / control state
  const [countdown, setCountdown] = useState(3);
  const [started,   setStarted]   = useState(false);
  const [paused,    setPaused]    = useState(false);
  const [gameOver,  setGameOver]  = useState(false);
  const [winner,    setWinner]    = useState(null);
  const [pHealth,   setPHealth]   = useState(INITIAL_HEALTH);
  const [aiHealth,  setAiHealth]  = useState(INITIAL_HEALTH);
  const [ammo,      setAmmo]      = useState(INITIAL_AMMO);
  const [aiAmmo,    setAiAmmo]    = useState(INITIAL_AMMO);
  const [timer,     setTimer]     = useState(GAME_TIME);
  const [msg,       setMsg]       = useState('');

  // key state for smooth diagonal movement
  const keysDown = useRef({ up: false, down: false, left: false, right: false });

  // refs for fast mutable game data
  const playerRef    = useRef({ x: ARENA_W / 2, y: ARENA_H - 30 });
  const aiRef        = useRef({ x: ARENA_W / 2, y: 30 });
  const bulletsRef   = useRef([]); // player bullets
  const shotsRef     = useRef([]); // AI bullets
  const obstacles    = useRef([]); // will hold 5 random obstacles
  const pickupsRef   = useRef([]); // array of { x, y, type }

  // Create 5 random obstacles at start or reset
  const makeObstacles = () => {
    const obs = [];
    for (let i = 0; i < 5; i++) {
      obs.push({
        x: rand(20, ARENA_W - 80),
        y: rand(20, ARENA_H - 80),
        w: rand(30, 60),
        h: rand(20, 40),
      });
    }
    return obs;
  };

  // Spawn a pickup (ammo or health) at a location NOT inside any obstacle
  const spawnValidPickup = (type) => {
    let px, py, colliding;
    let tries = 0;
    do {
      px = rand(20, ARENA_W - 20);
      py = rand(20, ARENA_H - 20);
      colliding = obstacles.current.some(o => 
        px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.h
      );
      tries++;
    } while (colliding && tries < 50);
    return { x: px, y: py, type };
  };

  // reset game state (called on mount and when resetting)
  const resetGame = () => {
    setCountdown(3);
    setStarted(false);
    setPaused(false);
    setGameOver(false);
    setWinner(null);
    setPHealth(INITIAL_HEALTH);
    setAiHealth(INITIAL_HEALTH);
    setAmmo(INITIAL_AMMO);
    setAiAmmo(INITIAL_AMMO);
    setTimer(GAME_TIME);
    setMsg('');

    playerRef.current = { x: ARENA_W / 2, y: ARENA_H - 30 };
    aiRef.current     = { x: ARENA_W / 2, y: 30 };
    bulletsRef.current = [];
    shotsRef.current   = [];
    obstacles.current  = makeObstacles();
    // spawn one ammo and one health at start
    pickupsRef.current = [
      spawnValidPickup('ammo'),
      spawnValidPickup('health')
    ];
    keysDown.current   = { up: false, down: false, left: false, right: false };
  };
  useEffect(resetGame, []);

  // countdown effect
  useEffect(() => {
    if (countdown <= 0) {
      setStarted(true);
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // game timer effect
  useEffect(() => {
    if (!started || paused || gameOver) return;
    const tid = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // decide winner on time up
          if (pHealth > aiHealth) setWinner('player');
          else if (aiHealth > pHealth) setWinner('ai');
          else setWinner('draw');
          setGameOver(true);
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(tid);
  }, [started, paused, gameOver, pHealth, aiHealth]);

  // keyboard input for movement & pause
  useEffect(() => {
    const down = (e) => {
      if (!started || paused || gameOver) return;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          keysDown.current.up = true; break;
        case 'ArrowDown':
        case 's':
        case 'S':
          keysDown.current.down = true; break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          keysDown.current.left = true; break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          keysDown.current.right = true; break;
        case 'p':
        case 'P':
          setPaused(p => !p); break;
        default: return;
      }
      e.preventDefault();
    };

    const up = (e) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          keysDown.current.up = false; break;
        case 'ArrowDown':
        case 's':
        case 'S':
          keysDown.current.down = false; break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          keysDown.current.left = false; break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          keysDown.current.right = false; break;
        default: return;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
    };
  }, [started, paused, gameOver]);

  // spawn a new pickup every 8 seconds, alternating types
  useEffect(() => {
    let spawnCount = 0;
    const interval = setInterval(() => {
      if (!started || paused || gameOver) return;
      const type = (spawnCount % 2 === 0) ? 'ammo' : 'health';
      pickupsRef.current.push(spawnValidPickup(type));
      spawnCount++;
    }, 8000);
    return () => clearInterval(interval);
  }, [started, paused, gameOver]);

  // main RAF loop: physics & rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let last = performance.now();
    let rafID;

    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;

      if (started && !paused && !gameOver) {
        // 1) Move player using keysDown
        let dx = 0, dy = 0;
        if (keysDown.current.up)    dy -= 1;
        if (keysDown.current.down)  dy += 1;
        if (keysDown.current.left)  dx -= 1;
        if (keysDown.current.right) dx += 1;
        if (dx !== 0 || dy !== 0) {
          const m = Math.hypot(dx, dy) || 1;
          let px = playerRef.current.x + (dx / m) * PLAYER_SPEED * dt;
          let py = playerRef.current.y + (dy / m) * PLAYER_SPEED * dt;
          // clamp to arena
          px = Math.max(0, Math.min(ARENA_W, px));
          py = Math.max(0, Math.min(ARENA_H, py));
          // obstacle collision
          let blocked = false;
          for (let o of obstacles.current) {
            if (px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.h) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            playerRef.current.x = px;
            playerRef.current.y = py;
          }
        }

        // 2) Update player bullets
        bulletsRef.current = bulletsRef.current.filter(b => {
          b.x += b.dx * SHOT_SPEED * dt;
          b.y += b.dy * SHOT_SPEED * dt;
          if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
          // obstacle collision
          for (let o of obstacles.current) {
            if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
              return false;
            }
          }
          // AI hit detection
          if (Math.hypot(b.x - aiRef.current.x, b.y - aiRef.current.y) < 14) {
            setAiHealth(h => {
              const nh = h - 1;
              if (nh <= 0) {
                setWinner('player');
                setGameOver(true);
              }
              return Math.max(0, nh);
            });
            return false;
          }
          return true;
        });

        // 3) Update AI bullets
        shotsRef.current = shotsRef.current.filter(b => {
          b.x += b.dx * SHOT_SPEED * dt;
          b.y += b.dy * SHOT_SPEED * dt;
          if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
          // obstacle collision
          for (let o of obstacles.current) {
            if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
              return false;
            }
          }
          // player hit detection
          if (Math.hypot(b.x - playerRef.current.x, b.y - playerRef.current.y) < 14) {
            setPHealth(h => {
              const nh = h - 1;
              if (nh <= 0) {
                setWinner('ai');
                setGameOver(true);
              }
              return Math.max(0, nh);
            });
            return false;
          }
          return true;
        });

        // 4) AI movement (smarter dodge + chase)
        {
          let ax = aiRef.current.x, ay = aiRef.current.y;

          // find nearest incoming bullet
          let nearestBullet = null;
          let nearestDist   = Infinity;
          bulletsRef.current.forEach(b => {
            const d = Math.hypot(b.x - ax, b.y - ay);
            if (d < nearestDist) {
              nearestDist   = d;
              nearestBullet = b;
            }
          });

          let vx = 0, vy = 0;
          if (nearestBullet && nearestDist < 100) {
            // dodge: move away from the bullet vector
            let awayX = ax - nearestBullet.x;
            let awayY = ay - nearestBullet.y;
            const m0 = Math.hypot(awayX, awayY) || 1;
            vx = (awayX / m0) * 1.2;
            vy = (awayY / m0) * 1.2;
          } else {
            // chase the player
            const dx0 = playerRef.current.x - ax;
            const dy0 = playerRef.current.y - ay;
            const m1  = Math.hypot(dx0, dy0) || 1;
            vx = dx0 / m1;
            vy = dy0 / m1;
          }

          // add slight randomness
          vx += (Math.random() - 0.5) * 0.1;
          vy += (Math.random() - 0.5) * 0.1;

          // update AI position
          let nx = ax + vx * PLAYER_SPEED * dt;
          let ny = ay + vy * PLAYER_SPEED * dt;
          // clamp
          nx = Math.max(0, Math.min(ARENA_W, nx));
          ny = Math.max(0, Math.min(ARENA_H, ny));
          // obstacle block
          let blocked = false;
          for (let o of obstacles.current) {
            if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            aiRef.current.x = nx;
            aiRef.current.y = ny;
          }
        }

        // 5) AI shooting (auto-aim, uses aiAmmo)
        if (aiAmmo > 0 && Math.random() < 0.04) {
          setAiAmmo(a => a - 1);
          const { x: ax, y: ay } = aiRef.current;
          const dx = playerRef.current.x - ax;
          const dy = playerRef.current.y - ay;
          const m  = Math.hypot(dx, dy) || 1;
          shotsRef.current.push({ x: ax, y: ay, dx: dx / m, dy: dy / m });
        }

        // 6) Check pickups
        pickupsRef.current = pickupsRef.current.filter(p => {
          const dist = Math.hypot(p.x - playerRef.current.x, p.y - playerRef.current.y);
          if (dist < 14) {
            if (p.type === 'ammo') {
              setAmmo(a => a + 5);
              setMsg('⚡ Ammo +5');
            } else {
              setPHealth(h => Math.min(INITIAL_HEALTH, h + 1));
              setMsg('❤️ Health +1');
            }
            return false;
          }
          return true;
        });
      }

      // ----- DRAW EVERYTHING -----
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      // draw obstacles
      ctx.fillStyle = '#475569';
      obstacles.current.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

      // draw pickups
      pickupsRef.current.forEach(p => {
        if (p.type === 'ammo') {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(p.x - 6, p.y - 6, 12, 12);
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // draw AI
      ctx.fillStyle = 'magenta';
      ctx.beginPath();
      ctx.arc(aiRef.current.x, aiRef.current.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // draw player
      ctx.fillStyle = 'cyan';
      ctx.beginPath();
      ctx.arc(playerRef.current.x, playerRef.current.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // draw player bullets
      ctx.fillStyle = 'white';
      bulletsRef.current.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // draw AI shots
      ctx.fillStyle = 'yellow';
      shotsRef.current.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // draw countdown overlay
      if (!started) {
        ctx.fillStyle = 'white';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(countdown, ARENA_W / 2, ARENA_H / 2);
      }

      // draw paused overlay
      if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = 'white';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', ARENA_W / 2, ARENA_H / 2);
      }

      // draw game over overlay
      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = 'white';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        let text;
        if (winner === 'player') text = 'You Win!';
        else if (winner === 'ai') text = 'You Lose!';
        else text = 'Draw!';
        ctx.fillText(text, ARENA_W / 2, ARENA_H / 2 - 10);
      }

      rafID = requestAnimationFrame(loop);
    };

    rafID = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafID);
  }, [
    started, paused, gameOver,
    countdown, timer,
    pHealth, aiHealth, aiAmmo,
  ]);

  // handle player shooting (auto-aim)
  const handleShoot = () => {
    if (!started || paused || gameOver) return;
    if (ammo <= 0) {
      setMsg('❗ No Ammo');
      return;
    }
    setAmmo(a => a - 1);
    const px = playerRef.current.x, py = playerRef.current.y;
    const ax = aiRef.current.x, ay = aiRef.current.y;
    const dx = ax - px, dy = ay - py;
    const m  = Math.hypot(dx, dy) || 1;
    bulletsRef.current.push({ x: px, y: py, dx: dx / m, dy: dy / m });
  };

  return (
    <div className="duel-container">
      <h2>Duel Shots: Single Player</h2>
      <p>Use WASD/Arrows to move (diagonals work), 🔫 Shoot auto-aims. P to pause.</p>
      <div className="status-bar-duel">
        <span>❤️ {pHealth}</span>
        <span>AI ❤️ {aiHealth}</span>
        <span>🔋 {ammo}</span>
        <span>⏰ {timer}s</span>
      </div>

      <canvas
        ref={canvasRef}
        width={ARENA_W}
        height={ARENA_H}
      />

      <div className="button-row">
        {gameOver ? (
          <button onClick={resetGame} className="play-again">▶️ Play Again</button>
        ) : (
          <>
            <button onClick={handleShoot} className="shoot-btn">🔫 Shoot</button>
            <button onClick={() => setPaused(p => !p)} className="pause-btn">
              {paused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
          </>
        )}
        <button onClick={() => navigate('/dashboard')} className="quit-btn">❌ Quit</button>
      </div>

      {msg && <p className="action-msg">{msg}</p>}
    </div>
  );
}
