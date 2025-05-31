// src/pages/SinglePlayerDuel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './DuelGame.css';

const ARENA_W        = 300;
const ARENA_H        = 300;
// Adjusted speeds: player a bit faster, bullets a bit slower, so movement and shooting feel in sync
const PLAYER_SPEED   = 200;   // px/sec (increased from 150)
const SHOT_SPEED     = 150;   // px/sec (decreased from 200)
const INITIAL_HEALTH = 5;
const INITIAL_AMMO   = 10;
const GAME_TIME      = 60;    // seconds
const PICKUP_SIZE    = 12;    // px
const PICKUP_INTERVAL = 5;    // seconds between spawning a new pickup

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

export default function SinglePlayerDuel() {
  const navigate       = useNavigate();
  const canvasRef      = useRef(null);
  const moveVecRef     = useRef({ dx: 0, dy: 0 }); // mobile movement

  // ─── Game State ─────────────────────────────────────────────
  const [countdown, setCountdown]    = useState(3);
  const [started,   setStarted]      = useState(false);
  const [paused,    setPaused]       = useState(false);
  const [gameOver,  setGameOver]     = useState(false);
  const [message,   setMessage]      = useState('');
  const [player,    setPlayer]       = useState({ x: ARENA_W/2, y: ARENA_H - 30 });
  const [ai,        setAi]           = useState({ x: ARENA_W/2, y: 30 });
  const [bullets,   setBullets]      = useState([]);
  const [aiShots,   setAiShots]      = useState([]);
  const [pHealth,   setPHealth]      = useState(INITIAL_HEALTH);
  const [aiHealth,  setAiHealth]     = useState(INITIAL_HEALTH);
  const [ammo,      setAmmo]         = useState(INITIAL_AMMO);
  const [timer,     setTimer]        = useState(GAME_TIME);
  const [moveVec,   setMoveVec]      = useState({ dx: 0, dy: 0 }); // desktop movement

  const [obstacles, setObstacles]    = useState([]);
  const [pickups,   setPickups]      = useState([]);
  const [lastPickupTime, setLastPickupTime] = useState(0);

  // Detect mobile via viewport width
  const isMobile = window.innerWidth < 768;

  // ─── 1) COUNTDOWN → START ────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) {
      setStarted(true);
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // ─── 2) GAME TIMER ──────────────────────────────────────────
  useEffect(() => {
    if (!started || paused || gameOver) return;
    const id = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(id);
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [started, paused, gameOver]);

  // ─── 3) RANDOMIZE OBSTACLES ONCE AT START ───────────────────
  useEffect(() => {
    if (!started) return;
    const newObs = [];
    let attempts = 0;
    while (newObs.length < 5 && attempts < 200) {
      attempts++;
      const ow = randInt(30, 60);
      const oh = randInt(20, 50);
      const ox = randInt(10, ARENA_W - ow - 10);
      const oy = randInt(50, ARENA_H - oh - 50);
      const rect = { x: ox, y: oy, w: ow, h: oh };

      const overlap = newObs.some(o => rectsOverlap(o, rect)) ||
        rectsOverlap(rect, { x: player.x - 15, y: player.y - 15, w: 30, h: 30 }) ||
        rectsOverlap(rect, { x: ai.x - 15, y: ai.y - 15, w: 30, h: 30 });

      if (!overlap) newObs.push(rect);
    }
    setObstacles(newObs);
  }, [started]);

  // ─── 4) SPAWN PICKUPS PERIODICALLY ──────────────────────────
  useEffect(() => {
    if (!started || paused || gameOver) return;
    const now = Date.now() / 1000;
    if (now - lastPickupTime >= PICKUP_INTERVAL) {
      let px, py, tries = 0;
      do {
        px = randInt(15, ARENA_W - 15);
        py = randInt(15, ARENA_H - 15);
        const rect = { x: px - PICKUP_SIZE/2, y: py - PICKUP_SIZE/2, w: PICKUP_SIZE, h: PICKUP_SIZE };
        const collidesObs = obstacles.some(o => rectsOverlap(o, rect));
        const collidesPick = pickups.some(pk => rectsOverlap(pk, rect));
        if (!collidesObs && !collidesPick) break;
        tries++;
      } while (tries < 50);

      const nextType = pickups.length % 2 === 0 ? 'ammo' : 'health';
      setPickups(ps => [...ps, { x: px, y: py, type: nextType }]);
      setLastPickupTime(now);
    }
    const id = setTimeout(() => {}, 1000);
    return () => clearTimeout(id);
  }, [started, paused, gameOver, pickups, lastPickupTime, obstacles]);

  // ─── 5) KEYBOARD CONTROLS (DESKTOP) ──────────────────────────
  useEffect(() => {
    const onKeyDown = e => {
      if (!started || paused || gameOver) return;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp'    || /^[wW]$/.test(e.key)) dy = -1;
      if (e.key === 'ArrowDown'  || /^[sS]$/.test(e.key)) dy =  1;
      if (e.key === 'ArrowLeft'  || /^[aA]$/.test(e.key)) dx = -1;
      if (e.key === 'ArrowRight' || /^[dD]$/.test(e.key)) dx =  1;

      if (dx || dy) {
        const m = Math.hypot(dx, dy) || 1;
        setMoveVec({ dx: dx/m, dy: dy/m });
      }
      if (e.key === 'p' || e.key === 'P') {
        setPaused(p => !p);
      }
    };
    const onKeyUp = e => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)) {
        setMoveVec({ dx: 0, dy: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [started, paused, gameOver]);

  // ─── 6) MAIN GAME LOOP (60fps) ──────────────────────────────
  useEffect(() => {
    let last = performance.now();
    let rafId;

    const computeAiAim = () => {
      let dx0 = player.x - ai.x;
      let dy0 = player.y - ai.y;
      const dist = Math.hypot(dx0, dy0) || 1;

      const steps = Math.floor(dist / 5);
      let blocked = false;
      for (let i = 1; i < steps; i++) {
        const ix = ai.x + (dx0/steps) * i;
        const iy = ai.y + (dy0/steps) * i;
        if (obstacles.some(o => ix > o.x && ix < o.x + o.w && iy > o.y && iy < o.y + o.h)) {
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

    const gameLoop = now => {
      const dt = (now - last) / 1000;
      last = now;

      if (started && !paused && !gameOver) {
        // ─── Move player (desktop: moveVec, mobile: moveVecRef) ───
        const vec = isMobile ? moveVecRef.current : moveVec;
        if (vec.dx || vec.dy) {
          setPlayer(p => {
            const nx = Math.max(0, Math.min(ARENA_W, p.x + vec.dx * PLAYER_SPEED * dt));
            const ny = Math.max(0, Math.min(ARENA_H, p.y + vec.dy * PLAYER_SPEED * dt));
            for (const o of obstacles) {
              if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
                return p; // collision cancels move
              }
            }
            return { x: nx, y: ny };
          });
        }

        // ─── Update bullets ────────────────────────────────────
        setBullets(bs =>
          bs.filter(b => {
            b.x += b.dx * SHOT_SPEED * dt;
            b.y += b.dy * SHOT_SPEED * dt;
            if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
            for (const o of obstacles) {
              if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
                return false;
              }
            }
            if (Math.hypot(b.x - ai.x, b.y - ai.y) < 12) {
              setAiHealth(aH => Math.max(0, aH - 1));
              return false;
            }
            return true;
          })
        );

        // ─── Update AI shots ─────────────────────────────────
        setAiShots(bs =>
          bs.filter(b => {
            b.x += b.dx * SHOT_SPEED * dt;
            b.y += b.dy * SHOT_SPEED * dt;
            if (b.x < 0 || b.x > ARENA_W || b.y < 0 || b.y > ARENA_H) return false;
            for (const o of obstacles) {
              if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
                return false;
              }
            }
            if (Math.hypot(b.x - player.x, b.y - player.y) < 12) {
              setPHealth(pH => Math.max(0, pH - 1));
              return false;
            }
            return true;
          })
        );

        // ─── AI Movement ─────────────────────────────────────
        setAi(a => {
          let dodgeX = 0, dodgeY = 0;
          aiShots.forEach(s => {
            const dist = Math.hypot(a.x - s.x, a.y - s.y);
            if (dist < 50) {
              const ang = Math.atan2(a.y - s.y, a.x - s.x);
              dodgeX += Math.cos(ang);
              dodgeY += Math.sin(ang);
            }
          });
          if (Math.hypot(dodgeX, dodgeY) > 0.5) {
            const m = Math.hypot(dodgeX, dodgeY);
            dodgeX /= m; dodgeY /= m;
            const nx = Math.max(0, Math.min(ARENA_W, a.x + dodgeX * PLAYER_SPEED * dt));
            const ny = Math.max(0, Math.min(ARENA_H, a.y + dodgeY * PLAYER_SPEED * dt));
            for (const o of obstacles) {
              if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
                return a;
              }
            }
            return { x: nx, y: ny };
          }

          let vx = player.x - a.x;
          let vy = player.y - a.y;
          const dist = Math.hypot(vx, vy) || 1;
          vx = vx / dist; vy = vy / dist;
          vx += (Math.random() - 0.5) * 0.2;
          vy += (Math.random() - 0.5) * 0.2;
          const m2 = Math.hypot(vx, vy) || 1;
          vx /= m2; vy /= m2;
          const nx = Math.max(0, Math.min(ARENA_W, a.x + vx * PLAYER_SPEED * dt));
          const ny = Math.max(0, Math.min(ARENA_H, a.y + vy * PLAYER_SPEED * dt));
          for (const o of obstacles) {
            if (nx > o.x && nx < o.x + o.w && ny > o.y && ny < o.y + o.h) {
              return a;
            }
          }
          return { x: nx, y: ny };
        });

        // ─── AI Shooting (auto-aim) ─────────────────────────
        if (Math.random() < 0.02) {
          const aim = computeAiAim();
          setAiShots(as => [...as, { x: ai.x, y: ai.y, dx: aim.dx, dy: aim.dy }]);
        }

        // ─── Check pickups ───────────────────────────────────
        setPickups(ps =>
          ps.filter(pk => {
            const distP = Math.hypot(player.x - pk.x, player.y - pk.y);
            if (distP < 14) {
              if (pk.type === 'ammo') setAmmo(a => a + 3);
              if (pk.type === 'health') setPHealth(h => Math.min(INITIAL_HEALTH, h + 1));
              return false;
            }
            const distA = Math.hypot(ai.x - pk.x, ai.y - pk.y);
            if (distA < 14) {
              if (pk.type === 'health') {
                setAiHealth(h => Math.min(INITIAL_HEALTH, h + 1));
              }
              return false;
            }
            return true;
          })
        );
      }

      drawFrame();
      rafId = requestAnimationFrame(gameLoop);
    };

    const drawFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      ctx.fillStyle = '#475569';
      obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

      pickups.forEach(pk => {
        ctx.fillStyle = pk.type === 'ammo' ? '#22c55e' : '#f87171';
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, PICKUP_SIZE / 2, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.fillStyle = 'magenta';
      ctx.beginPath();
      ctx.arc(ai.x, ai.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = 'cyan';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 10, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = 'white';
      bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      ctx.fillStyle = 'yellow';
      aiShots.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      if (!started) {
        ctx.fillStyle = 'white';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(countdown, ARENA_W / 2, ARENA_H / 2);
      }

      if (paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = 'white';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', ARENA_W / 2, ARENA_H / 2);
      }

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, ARENA_W, ARENA_H);
        ctx.fillStyle = 'white';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        if (pHealth <= 0 && aiHealth <= 0) {
          ctx.fillText(`Draw!`, ARENA_W / 2, ARENA_H / 2 - 10);
        } else if (pHealth <= 0) {
          ctx.fillText(`You Lose!`, ARENA_W / 2, ARENA_H / 2 - 10);
        } else {
          ctx.fillText(`You Win!`, ARENA_W / 2, ARENA_H / 2 - 10);
        }
      }
    };

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
    moveVec, // ensure desktop input affects movement
  ]);

  // ─── 7) SHOOT HANDLER (DESKTOP “Shoot” button / tap) ───────
  const handleShoot = () => {
    if (!started || paused || gameOver) return;
    if (ammo <= 0) {
      setMessage('❗ No Ammo');
      return;
    }
    const dx0 = ai.x - player.x;
    const dy0 = ai.y - player.y;
    const m = Math.hypot(dx0, dy0) || 1;
    setAmmo(a => a - 1);
    setBullets(bs => [
      ...bs,
      { x: player.x, y: player.y, dx: dx0 / m, dy: dy0 / m }
    ]);
  };

  // ─── 8) MOBILE JOYSTICK (LEFT) ─────────────────────────────
  const onLeftMove = e => {
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

  // ─── 9) END-OF-GAME CHECK ────────────────────────────────────
  useEffect(() => {
    if (pHealth <= 0 || aiHealth <= 0 || timer <= 0) {
      setGameOver(true);
    }
  }, [pHealth, aiHealth, timer]);

  // ─── 10) RESET & RENDER UI ──────────────────────────────────
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
    setMessage('');
    setMoveVec({ dx: 0, dy: 0 });
    moveVecRef.current = { dx: 0, dy: 0 };
    setObstacles([]);
    setPickups([]);
    setLastPickupTime(Date.now() / 1000);
  };

  return (
    <div className="duel-container">
      <h2>Duel Shots: Single Player</h2>
      <p>
        Use WASD/Arrows to move (diagonals work), 💥 to shoot (auto-aim), P to pause.
      </p>

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
        className="duel-canvas"
      />

      <div className="controls-row">
        <button onClick={handleShoot} className="shoot-btn">
          💥 Shoot
        </button>
        {gameOver ? (
          <button onClick={resetGame} className="play-again">
            ▶️ Play Again
          </button>
        ) : (
          <button onClick={() => setPaused(p => !p)} className="pause-btn">
            {paused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
        )}
        <button onClick={() => navigate('/dashboard')} className="quit-btn">
          ❌ Quit
        </button>
      </div>

      {message && <p className="action-msg">{message}</p>}

      {/* On-screen joystick for movement (mobile only) */}
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

      {/* Mobile-only Shoot button (bottom-right) */}
      {isMobile && !gameOver && (
        <button className="shoot-btn-mobile" onTouchStart={handleShoot}>
          💥
        </button>
      )}
    </div>
  );
}
