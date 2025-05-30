// src/pages/MultiplayerDuel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase-config';
import {
  doc, setDoc, updateDoc, deleteDoc, onSnapshot,
  arrayUnion, Timestamp, getDoc, getDocs, collection
} from 'firebase/firestore';
import './DuelGame.css';

export default function MultiplayerDuel() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const user = auth.currentUser;
  const gameRef = doc(db,'duelGames',gameId);

  const [username,setUsername]=useState('');
  const [friends,setFriends]=useState([]);
  const [waiting,setWaiting]=useState(null);
  const [state,setState]=useState(null);
  const canvasRef=useRef(null);

  // load user & friends
  useEffect(()=>{
    if(!user) return navigate('/');
    getDoc(doc(db,'users',user.uid)).then(s=>s.exists()&&setUsername(s.data().username));
    getDocs(collection(db,`users/${user.uid}/friends`))
      .then(s=>setFriends(s.docs.map(d=>({uid:d.id,...d.data()}))));
  },[user,navigate]);

  // challenge friend
  const handleChallenge=async friend=>{
    const id=`${user.uid}_${friend.uid}_${Date.now()}`;
    // initial game state
    await setDoc(doc(db,'duelGames',id),{
      playerA:{uid:user.uid,x:150,y:250},
      playerB:{uid:friend.uid,x:150,y:50},
      bullets:[],
      status:'pending',
      chat:[],
      created:Timestamp.now()
    });
    await setDoc(doc(db,`users/${friend.uid}/notifications/${id}`),{
      type:'duel_invite',gameId:id,
      sender:username,message:`🔫 @${username} challenges you!`,
      timestamp:Timestamp.now()
    });
    setWaiting(id);
  };

  // wait acceptance
  useEffect(()=>{
    if(!waiting) return;
    const un=onSnapshot(doc(db,'duelGames',waiting),snap=>{
      if(snap.exists()&&snap.data().status==='active')
        navigate(`/duel/multiplayer/${waiting}`);
    });
    return ()=>un();
  },[waiting,navigate]);

  // subscribe game
  useEffect(()=>{
    if(!gameId) return;
    const un=onSnapshot(gameRef,snap=>{
      setState(snap.exists()?snap.data():null);
    });
    return ()=>un();
  },[gameId]);

  // render loop
  useEffect(()=>{
    if(!state) return;
    const ctx=canvasRef.current.getContext('2d');
    let raf;
    const draw=()=>{
      ctx.clearRect(0,0,300,300);
      // players
      ['playerA','playerB'].forEach((k,i)=>{
        const p=state[k];
        ctx.fillStyle=i===0?'cyan':'magenta';
        ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();
      });
      // bullets
      ctx.fillStyle='#fff';
      state.bullets.forEach(b=>{
        ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();
      });
      raf=requestAnimationFrame(draw);
    };
    draw();
    return ()=>cancelAnimationFrame(raf);
  },[state]);

  // subscribe controls
  const sendMove=(dx,dy)=>{
    if(!state||state.status!=='active')return;
    const me=state.playerA.uid===user.uid?'playerA':'playerB';
    const p=state[me];const nx=Math.max(0,Math.min(300,p.x+dx*4));
    const ny=Math.max(0,Math.min(300,p.y+dy*4));
    updateDoc(gameRef,{[me]:{...p,x:nx,y:ny}});
  };
  const sendShoot=({dx,dy})=>{
    if(!state||state.status!=='active')return;
    const me=state.playerA.uid===user.uid?'playerA':'playerB';
    const p=state[me];
    updateDoc(gameRef,{bullets:arrayUnion({owner:me,x:p.x,y:p.y,dx,dy,ts:Timestamp.now()})});
  };

  // chat, rematch, quit omitted for brevity

  if(!state) {
    // challenge screen
    return (
      <div className="duel-container">
        <h2>Challenge a Friend to Duel Shots</h2>
        {friends.map(f=>(
          <div key={f.uid}>
            @{f.username} <button onClick={()=>handleChallenge(f)}>Challenge</button>
          </div>
        ))}
        {waiting&&<p>Waiting for acceptance…</p>}
      </div>
    );
  }

  return (
    <div className="duel-container">
      <canvas ref={canvasRef} width={300} height={300} className="duel-canvas"/>
      <div className="controls">
        <div className="joystick-left"><Joystick onMove={sendMove}/></div>
        <div className="joystick-right"><Joystick onMove={sendShoot}/></div>
      </div>
      <button className="quit-btn" onClick={()=>navigate('/dashboard')}>❌ Quit</button>
    </div>
  );
}

function Joystick({onMove}) {
  const ref=useRef();const tid=useRef();
  useEffect(()=>{
    const area=ref.current;let origin={x:0,y:0};
    const start=e=>{const t=e.changedTouches[0];tid.current=t.identifier;origin={x:t.clientX,y:t.clientY}};
    const move=e=>{const t=[...e.changedTouches].find(t=>t.identifier===tid.current);if(!t)return;
      onMove({dx:(t.clientX-origin.x)/50,dy:(t.clientY-origin.y)/50});
    };
    const end=_=>{tid.current=null;onMove({dx:0,dy:0})};
    ['touchstart','touchmove','touchend','touchcancel'].forEach(evt=>{
      area.addEventListener(evt, evt==='touchmove'?move:(evt==='touchstart'?start:end));
    });
    return ()=>['touchstart','touchmove','touchend','touchcancel'].forEach(evt=>{
      area.removeEventListener(evt, evt==='touchmove'?move:(evt==='touchstart'?start:end));
    });
  },[onMove]);
  return <div ref={ref} className="joystick-area"/>;
}
