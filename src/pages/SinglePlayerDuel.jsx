// src/pages/SinglePlayerDuel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './DuelGame.css';

const ARENA_W = 300;
const ARENA_H = 300;
const PLAYER_SPEED = 4;
const SHOT_SPEED = 6;
const INITIAL_HEALTH = 5;
const INITIAL_AMMO = 10;
const BOOST_AMOUNT = 5;
const HEALTH_PACK_AMOUNT = 1;
const GAME_TIME = 60; // seconds

// static obstacles
const OBSTACLES = [
  { x: 80, y: 80, w: 40, h: 40 },
  { x: 180, y: 150, w: 60, h: 30 },
  { x: 120, y: 220, w: 50, h: 20 }
];

export default function SinglePlayerDuel() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const keys = useRef({});

  // pre-game countdown
  const [countdown, setCountdown] = useState(3);
  const [started, setStarted] = useState(false);

  // core game state
  const [player, setPlayer] = useState({ x: ARENA_W / 2, y: ARENA_H - 30 });
  const [ai, setAi] = useState({ x: ARENA_W / 2, y: 30 });
  const [bullets, setBullets] = useState([]);
  const [aiShots, setAiShots] = useState([]);
  const [playerHealth, setPlayerHealth] = useState(INITIAL_HEALTH);
  const [aiHealth, setAiHealth] = useState(INITIAL_HEALTH);
  const [ammo, setAmmo] = useState(INITIAL_AMMO);
  const [healthPacks, setHealthPacks] = useState([]);
  const [boosts, setBoosts] = useState([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [timer, setTimer] = useState(GAME_TIME);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');

  // countdown
  useEffect(() => {
    if (countdown <= 0) {
      setStarted(true);
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // keyboard + pause
  useEffect(() => {
    const handleDown = e => {
      if (e.key === 'p' && started) setPaused(p => !p);
      else keys.current[e.key] = true;
    };
    const handleUp = e => (keys.current[e.key] = false);
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [started]);

  // spawn pickups
  useEffect(() => {
    if (!started || paused || gameOver) return;
    const id = setInterval(() => {
      if (Math.random() < 0.05)
        setBoosts(bs => [...bs, { x: Math.random() * (ARENA_W-20)+10, y: Math.random() * (ARENA_H-20)+10 }]);
      if (Math.random() < 0.03)
        setHealthPacks(hs => [...hs, { x: Math.random() * (ARENA_W-20)+10, y: Math.random() * (ARENA_H-20)+10 }]);
    }, 1200);
    return () => clearInterval(id);
  }, [started, paused, gameOver]);

  // main loop
  useEffect(() => {
    if (!started || paused || gameOver) return;
    const tick = () => {
      // movement
      let dx=0,dy=0;
      if(keys.current.w||keys.current.ArrowUp) dy--;
      if(keys.current.s||keys.current.ArrowDown) dy++;
      if(keys.current.a||keys.current.ArrowLeft) dx--;
      if(keys.current.d||keys.current.ArrowRight) dx++;
      if(dx||dy) setPlayer(p=>{
        const nx=Math.max(0,Math.min(ARENA_W,p.x+dx*PLAYER_SPEED));
        const ny=Math.max(0,Math.min(ARENA_H,p.y+dy*PLAYER_SPEED));
        for(const o of OBSTACLES) if(nx>o.x&&nx<o.x+o.w&&ny>o.y&&ny<o.y+o.h) return p;
        return {x:nx,y:ny};
      });
      // bullets vs AI
      setBullets(bs=>bs.reduce((arr,b)=>{
        const nx=b.x+b.dx*SHOT_SPEED,ny=b.y+b.dy*SHOT_SPEED;
        if(nx<0||nx>ARENA_W||ny<0||ny>ARENA_H) return arr;
        for(const o of OBSTACLES) if(nx>o.x&&nx<o.x+o.w&&ny>o.y&&ny<o.y+o.h) return arr;
        const dist=Math.hypot(nx-ai.x,ny-ai.y);
        if(dist<14){ setAiHealth(h=>Math.max(0,h-1)); setPlayerScore(s=>s+1); setMessage('🎯 Hit!'); }
        else arr.push({x:nx,y:ny,dx:b.dx,dy:b.dy});
        return arr;
      },[]));
      // AI shots vs player
      setAiShots(bs=>bs.reduce((arr,b)=>{
        const nx=b.x+b.dx*SHOT_SPEED,ny=b.y+b.dy*SHOT_SPEED;
        if(nx<0||nx>ARENA_W||ny<0||ny>ARENA_H) return arr;
        for(const o of OBSTACLES) if(nx>o.x&&nx<o.x+o.w&&ny>o.y&&ny<o.y+o.h) return arr;
        const dist=Math.hypot(nx-player.x,ny-player.y);
        if(dist<14){ setPlayerHealth(h=>Math.max(0,h-1)); setAiScore(s=>s+1); setMessage('💥 Ouch!'); }
        else arr.push({x:nx,y:ny,dx:b.dx,dy:b.dy});
        return arr;
      },[]));
      // AI movement
      setAi(a=>{
        let vx=0,vy=0;
        bullets.forEach(b=>{
          const d=Math.hypot(a.x-b.x,a.y-b.y);
          if(d<100){ const ang=Math.atan2(a.y-b.y,a.x-b.x); vx+=Math.cos(ang)*2; vy+=Math.sin(ang)*2; }
        });
        if(Math.hypot(vx,vy)<1){ const dx=player.x-a.x,dy=player.y-a.y,mg=Math.hypot(dx,dy)||1; vx=dx/mg;vy=dy/mg; }
        vx+=(Math.random()-0.5)*0.2; vy+=(Math.random()-0.5)*0.2;
        const nx=Math.max(0,Math.min(ARENA_W,a.x+vx*PLAYER_SPEED));
        const ny=Math.max(0,Math.min(ARENA_H,a.y+vy*PLAYER_SPEED));
        for(const o of OBSTACLES) if(nx>o.x&&nx<o.x+o.w&&ny>o.y&&ny<o.y+o.h) return a;
        return {x:nx,y:ny};
      });
      // AI shooting
      if(Math.random()<0.1){ const dx=player.x-ai.x,dy=player.y-ai.y,mg=Math.hypot(dx,dy)||1;
        setAiShots(bs=>[...bs,{x:ai.x,y:ai.y,dx:dx/mg,dy:dy/mg}]); }
      // pickups
      setBoosts(bs=>bs.filter(b=>{const d=Math.hypot(b.x-player.x,b.y-player.y); if(d<20){setAmmo(a=>a+BOOST_AMOUNT);setMessage('🔋 Ammo!');return false;}return true;}));
      setHealthPacks(hs=>hs.filter(h=>{const d=Math.hypot(h.x-player.x,h.y-player.y); if(d<20){setPlayerHealth(ph=>Math.min(INITIAL_HEALTH,ph+HEALTH_PACK_AMOUNT));setMessage('❤️ Health!');return false;}return true;}));
    };
    const id=setInterval(tick,50);
    return ()=>clearInterval(id);
  },[bullets,player,started,paused,gameOver]);

  // end
  useEffect(()=>{ if(aiHealth<=0){setGameOver(true);setMessage('🏆 You Win!');} if(playerHealth<=0){setGameOver(true);setMessage('💀 Game Over');} },[aiHealth,playerHealth]);

  // shoot handler
  const handleShoot=e=>{
    if(!started||paused||gameOver) return;
    if(ammo<=0){setMessage('❗ No Ammo');return;}
    setAmmo(a=>a-1);
    const r=canvasRef.current?.getBoundingClientRect(); if(!r) return;
    const mx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const my=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
    const dx0=mx-player.x,dy0=my-player.y,mg=Math.hypot(dx0,dy0)||1;
    setBullets(bs=>[...bs,{x:player.x,y:player.y,dx:dx0/mg,dy:dy0/mg}]);
  };

  // render
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d'); let raf;
    const draw=()=>{
      ctx.clearRect(0,0,ARENA_W,ARENA_H);
      ctx.fillStyle='#1e293b';ctx.fillRect(0,0,ARENA_W,ARENA_H);
      ctx.fillStyle='#475569';OBSTACLES.forEach(o=>ctx.fillRect(o.x,o.y,o.w,o.h));
      ctx.fillStyle='#34d399';boosts.forEach(b=>ctx.fillRect(b.x-6,b.y-6,12,12));
      ctx.fillStyle='red';healthPacks.forEach(h=>ctx.fillRect(h.x-6,h.y-6,12,12));
      if(!started){ctx.fillStyle='#fff';ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText(countdown,ARENA_W/2,ARENA_H/2); raf=requestAnimationFrame(draw);return;}
      const cols=['#7e22ce','#c084fc','#d946ef','#a855f7','#9333ea'];ctx.fillStyle=cols[aiHealth-1]||cols[0];ctx.beginPath();ctx.arc(ai.x,ai.y,10,0,2*Math.PI);ctx.fill();
      ctx.fillStyle='cyan';ctx.beginPath();ctx.arc(player.x,player.y,10,0,2*Math.PI);ctx.fill();
      ctx.fillStyle='#fff';bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,4,0,2*Math.PI);ctx.fill();});
      ctx.fillStyle='yellow';aiShots.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,4,0,2*Math.PI);ctx.fill();});
      if(paused){ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,ARENA_W,ARENA_H);ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText('PAUSED',ARENA_W/2,ARENA_H/2);} raf=requestAnimationFrame(draw);
    };
    draw(); return ()=>cancelAnimationFrame(raf);
  },[player,ai,bullets,aiShots,boosts,healthPacks,paused,started,aiHealth]);

  const handleRestart=()=>{setCountdown(3);setStarted(false);setPaused(false);resetGame();};
  const resetGame=()=>{setPlayer({x:ARENA_W/2,y:ARENA_H-30});setAi({x:ARENA_W/2,y:30});setBullets([]);setAiShots([]);setPlayerHealth(INITIAL_HEALTH);setAiHealth(INITIAL_HEALTH);setAmmo(INITIAL_AMMO);setBoosts([]);setHealthPacks([]);setPlayerScore(0);setAiScore(0);setTimer(GAME_TIME);setMessage('');setGameOver(false);};

  return (
    <div className="duel-container">
      <h2>Duel Shots: Single Player</h2>
      <p className="instructions desktop-only">Use WASD/Arrows to move, click to shoot, P to pause.</p>
      <p className="instructions mobile-only">Swipe to move, tap to shoot, tap “Pause” to pause.</p>
      <div className="status-bar-duel">
        <span>❤️ {playerHealth}</span>
        <span>AI ❤️ {aiHealth}</span>
        <span>🔋 {ammo}</span>
        <span>⏰ {timer}s</span>
        <span>🎯 {playerScore}-{aiScore}</span>
      </div>
      <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H} className="duel-canvas" onClick={handleShoot} onTouchStart={handleShoot} />
      {gameOver && <button className="restart-btn" onClick={handleRestart}>▶️ Play Again</button>}
      {!gameOver && <button className="pause-btn" onClick={()=>setPaused(p=>!p)}>{paused?'▶️ Resume':'⏸️ Pause'}</button>}
      <button className="quit-btn" onClick={()=>navigate('/dashboard')}>❌ Quit</button>
      {message && <p className="action-msg">{message}</p>}
    </div>
  );
}