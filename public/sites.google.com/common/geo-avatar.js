// ========================================
// Multi-Style Avatar Generator v2
// ========================================
// generateGeoAvatar(size, seed, styleIndex)
//   styleIndex: 未指定/-1 → シードで自動決定
//   0〜7 → スタイル指定
// AVATAR_STYLES → 設定画面用エクスポート
// ========================================

export function seedFromId(id){
  if(!id)return 1;
  let n=0;
  for(let i=0;i<Math.min(id.length,16);i++){
    n=(n*31+id.charCodeAt(i))%2147483647;
  }
  return n||1;
}

function makeRand(seed){
  let s=seed;
  return()=>{
    s=(s*16807+0)%2147483647;
    return(s-1)/2147483646;
  };
}

function fillBg(ctx,s,c){ctx.fillStyle=c;ctx.fillRect(0,0,s,s);}

function clipRounded(ctx,s){
  const r=s*0.2;
  ctx.globalCompositeOperation='destination-in';
  ctx.fillStyle='#fff';
  ctx.beginPath();
  ctx.moveTo(r,0);ctx.lineTo(s-r,0);ctx.quadraticCurveTo(s,0,s,r);
  ctx.lineTo(s,s-r);ctx.quadraticCurveTo(s,s,s-r,s);
  ctx.lineTo(r,s);ctx.quadraticCurveTo(0,s,0,s-r);
  ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath();ctx.fill();
  ctx.globalCompositeOperation='source-over';
}

function drawSmooth(ctx,pts){
  const n=pts.length;
  const sm={x:(pts[n-1].x+pts[0].x)/2,y:(pts[n-1].y+pts[0].y)/2};
  ctx.beginPath();ctx.moveTo(sm.x,sm.y);
  for(let i=0;i<n;i++){
    const c=pts[i],nx=pts[(i+1)%n],m={x:(c.x+nx.x)/2,y:(c.y+nx.y)/2};
    ctx.quadraticCurveTo(c.x,c.y,m.x,m.y);
  }
  ctx.closePath();
}

function polygon(ctx,cx,cy,r,n,rot=0){
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const a=rot+i*Math.PI*2/n-Math.PI/2;
    i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a))
         :ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
  }
  ctx.closePath();
}


// ══════════════════════════════════════
// 0: Topographic（地形図）
// ══════════════════════════════════════
const TOPO_P=[
  {bg:'#0d0005',layers:['#ffd740','#ff6d00','#d84315','#7b1a1a','#3d0020'],acc:'#ffd740'},
  {bg:'#000a18',layers:['#e0f7fa','#4dd0e1','#0097a7','#005b6d','#001a2a'],acc:'#ffffff'},
  {bg:'#001400',layers:['#f9fbe7','#aed581','#558b2f','#1b5e20','#0a2810'],acc:'#ffe57f'},
  {bg:'#080e1e',layers:['#ffffff','#b3e5fc','#039be5','#01579b','#001a40'],acc:'#ff8f00'},
  {bg:'#120700',layers:['#fff9c4','#ffe082','#ff8f00','#bf360c','#4e1003'],acc:'#80cbc4'},
  {bg:'#070010',layers:['#ede7f6','#ce93d8','#9c27b0','#4a148c','#12003a'],acc:'#69f0ae'},
  {bg:'#001018',layers:['#e0ffff','#00e5ff','#0097a7','#004d5e','#000e16'],acc:'#ff80ab'},
  {bg:'#010d0a',layers:['#e8f5e9','#69f0ae','#00c853','#1b5e20','#001a10'],acc:'#ea80fc'},
  {bg:'#12080e',layers:['#fce4ec','#f48fb1','#e91e63','#880e4f','#1a0020'],acc:'#00e5ff'},
  {bg:'#0a0800',layers:['#fff8e1','#ffe082','#ff8f00','#4e342e','#1c0b00'],acc:'#80cbc4'},
];

function styleTopographic(ctx,s,rand){
  const p=TOPO_P[Math.floor(rand()*TOPO_P.length)];
  fillBg(ctx,s,p.bg);
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
  const gs=s*0.1;
  for(let x=0;x<s;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}
  for(let y=0;y<s;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}

  const cx=s*(0.35+rand()*0.3),cy=s*(0.35+rand()*0.3);
  const nl=4+Math.floor(rand()*4),pc=9+Math.floor(rand()*8),or=s*(0.33+rand()*0.1);
  const angles=[],rm=[];
  for(let i=0;i<pc;i++){
    angles.push((i/pc)*Math.PI*2+(rand()-0.5)*0.4);
    rm.push(0.65+rand()*0.7);
  }
  const has2=rand()<0.35;
  const sp={
    cx:cx+or*(0.35+rand()*0.3)*Math.cos(rand()*Math.PI*2),
    cy:cy+or*(0.35+rand()*0.3)*Math.sin(rand()*Math.PI*2),
    sc:0.4+rand()*0.25
  };
  for(let li=nl-1;li>=0;li--){
    const t=li/(nl-1),lr=or*(0.12+t*0.88);
    const pts=angles.map((a,i)=>({x:cx+lr*rm[i]*Math.cos(a),y:cy+lr*rm[i]*Math.sin(a)}));
    const ci=Math.min(li,p.layers.length-1);
    ctx.fillStyle=p.layers[ci];drawSmooth(ctx,pts);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=s*0.007;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=s*0.003;ctx.stroke();
    if(has2&&li>=1){
      const lr2=lr*sp.sc;
      const pts2=angles.map((a,i)=>({x:sp.cx+lr2*rm[i]*Math.cos(a),y:sp.cy+lr2*rm[i]*Math.sin(a)}));
      ctx.fillStyle=p.layers[ci];drawSmooth(ctx,pts2);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=s*0.006;ctx.stroke();
    }
  }
  ctx.fillStyle=p.acc;ctx.shadowColor=p.acc;ctx.shadowBlur=s*0.08;
  const mt=Math.floor(rand()*3);
  if(mt===0){ctx.beginPath();ctx.arc(cx,cy,s*0.024,0,Math.PI*2);ctx.fill();}
  else if(mt===1){const cs=s*0.032;ctx.fillRect(cx-cs*0.15,cy-cs,cs*0.3,cs*2);ctx.fillRect(cx-cs,cy-cs*0.15,cs*2,cs*0.3);}
  else{const ts=s*0.028;ctx.beginPath();ctx.moveTo(cx,cy-ts*1.3);ctx.lineTo(cx+ts,cy+ts*0.7);ctx.lineTo(cx-ts,cy+ts*0.7);ctx.closePath();ctx.fill();}
  if(has2){ctx.shadowBlur=s*0.05;ctx.beginPath();ctx.arc(sp.cx,sp.cy,s*0.014,0,Math.PI*2);ctx.fill();}
  ctx.shadowBlur=0;
}


// ══════════════════════════════════════
// 1: Mystic（数学曲線）
// ══════════════════════════════════════
const MYSTIC_P=[
  {bg:'#0d0221',b:'#ff6ec7',c:'#00fff5'},
  {bg:'#050a1a',b:'#4fc3f7',c:'#ffd54f'},
  {bg:'#0a0a0a',b:'#69f0ae',c:'#b9f6ca'},
  {bg:'#12001f',b:'#ea80fc',c:'#ff6d00'},
  {bg:'#001520',b:'#00b8d9',c:'#79f2c0'},
  {bg:'#0a0014',b:'#a78bfa',c:'#f0abfc'},
  {bg:'#001a12',b:'#1de9b6',c:'#e0f7fa'},
  {bg:'#14000a',b:'#f06292',c:'#fff176'},
  {bg:'#000d1a',b:'#00e5ff',c:'#ff4081'},
  {bg:'#100008',b:'#ff6d00',c:'#ffd740'},
];

function styleMystic(ctx,s,rand){
  const p=MYSTIC_P[Math.floor(rand()*MYSTIC_P.length)];
  fillBg(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const type=Math.floor(rand()*4); // 4種

  if(type===0){
    // エピトロコイド
    const R=s*0.38,rDiv=Math.floor(rand()*5)+2,r=R/rDiv,d=r*(0.4+rand()*1.1),steps=2400;
    ctx.shadowBlur=s*0.06;ctx.shadowColor=p.b;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*2*rDiv*(rDiv%2===0?rDiv-1:rDiv);
      ctx.lineTo(cx+(R+r)*Math.cos(t)-d*Math.cos((R+r)/r*t),cy+(R+r)*Math.sin(t)-d*Math.sin((R+r)/r*t));
    }
    ctx.strokeStyle=p.b;ctx.lineWidth=s*0.022;ctx.stroke();
    const rDiv2=rDiv+1+(rand()>0.5?1:0),r2=R*0.42/rDiv2,d2=r2*(0.7+rand()*0.6);
    ctx.shadowColor=p.c;ctx.shadowBlur=s*0.04;ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*2*rDiv2*(rDiv2%2===0?rDiv2-1:rDiv2);
      ctx.lineTo(cx+(R*0.42+r2)*Math.cos(t)-d2*Math.cos((R*0.42+r2)/r2*t),cy+(R*0.42+r2)*Math.sin(t)-d2*Math.sin((R*0.42+r2)/r2*t));
    }
    ctx.strokeStyle=p.c;ctx.lineWidth=s*0.014;ctx.stroke();
  }else if(type===1){
    // バラ曲線
    const kOpts=[2,3,4,5,6,7,8,9],k=kOpts[Math.floor(rand()*kOpts.length)],rot=rand()*Math.PI*2,steps=1800,maxR=s*0.44;
    ctx.shadowBlur=s*0.07;ctx.shadowColor=p.b;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*(k%2===0?2:1),r=maxR*Math.cos(k*t);ctx.lineTo(cx+r*Math.cos(t+rot),cy+r*Math.sin(t+rot));}
    ctx.strokeStyle=p.b;ctx.lineWidth=s*0.024;ctx.stroke();
    const k2=(k%2===0?k-1:k+1)+(rand()>0.5?0:2);
    ctx.shadowColor=p.c;ctx.shadowBlur=s*0.05;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*(k2%2===0?2:1),r=maxR*0.52*Math.sin(k2*t);ctx.lineTo(cx+r*Math.cos(t+rot+Math.PI/k2),cy+r*Math.sin(t+rot+Math.PI/k2));}
    ctx.strokeStyle=p.c;ctx.lineWidth=s*0.015;ctx.stroke();
  }else if(type===2){
    // リサージュ
    const ratios=[[1,2],[1,3],[2,3],[3,4],[3,5],[4,5],[2,5],[3,7],[4,7],[5,7]];
    const [nx,ny]=ratios[Math.floor(rand()*ratios.length)],delta=rand()*Math.PI,amp=s*0.43,steps=1800;
    ctx.shadowBlur=s*0.07;
    [{sc:1.0,co:p.b,lw:s*0.024,al:1},{sc:0.68,co:p.c,lw:s*0.018,al:0.8},{sc:0.38,co:p.b,lw:s*0.012,al:0.5}].forEach(l=>{
      ctx.shadowColor=l.co;ctx.globalAlpha=l.al;ctx.beginPath();
      for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*2;ctx.lineTo(cx+amp*l.sc*Math.sin(nx*t+delta),cy+amp*l.sc*Math.sin(ny*t));}
      ctx.strokeStyle=l.co;ctx.lineWidth=l.lw;ctx.stroke();
    });
    ctx.globalAlpha=1;
  }else{
    // ハイポトロコイド
    const R=s*0.44,rDiv=Math.floor(rand()*4)+3,r=R/rDiv,d=r*(0.3+rand()*1.3),steps=2400;
    ctx.shadowBlur=s*0.07;ctx.shadowColor=p.b;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*2*rDiv;ctx.lineTo(cx+(R-r)*Math.cos(t)+d*Math.cos((R-r)/r*t),cy+(R-r)*Math.sin(t)-d*Math.sin((R-r)/r*t));}
    ctx.strokeStyle=p.b;ctx.lineWidth=s*0.022;ctx.stroke();
    const rDiv2=rDiv-1<2?rDiv+2:rDiv-1,r2=R*0.58/rDiv2,d2=r2*(0.5+rand()*0.9);
    ctx.shadowColor=p.c;ctx.shadowBlur=s*0.05;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*2*rDiv2;ctx.lineTo(cx+(R*0.58-r2)*Math.cos(-t)+d2*Math.cos((R*0.58-r2)/r2*(-t)),cy+(R*0.58-r2)*Math.sin(-t)-d2*Math.sin((R*0.58-r2)/r2*(-t)));}
    ctx.strokeStyle=p.c;ctx.lineWidth=s*0.015;ctx.stroke();
  }
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}


// ══════════════════════════════════════
// 2: Crystal（結晶）
// ══════════════════════════════════════
const CRYSTAL_P=[
  {bg:'#0a0f1e',colors:['#1a237e','#283593','#3949ab','#5c6bc0','#7986cb','#aab6fb'],line:'#c5cae9'},
  {bg:'#0d1b12',colors:['#1b5e20','#2e7d32','#388e3c','#43a047','#66bb6a','#a5d6a7'],line:'#b9f6ca'},
  {bg:'#1a0025',colors:['#4a0080','#6a1b9a','#7b1fa2','#8e24aa','#ab47bc','#ce93d8'],line:'#e1bee7'},
  {bg:'#0f0800',colors:['#bf360c','#d84315','#e64a19','#f4511e','#ff7043','#ff8a65'],line:'#fbe9e7'},
  {bg:'#001820',colors:['#004d5e','#00695c','#00796b','#00897b','#26a69a','#80cbc4'],line:'#e0f2f1'},
  {bg:'#1c1c1c',colors:['#212121','#303030','#424242','#616161','#757575','#9e9e9e'],line:'#e0e0e0'},
  {bg:'#0d0010',colors:['#1a0030','#2d0050','#4a0080','#6600b0','#9900e0','#cc66ff'],line:'#f3e5ff'},
  {bg:'#001010',colors:['#002020','#003030','#005050','#007070','#009090','#00b8b8'],line:'#e0ffff'},
  {bg:'#0f0a00',colors:['#3e2000','#6e3800','#9e5000','#c86800','#f08000','#ffa040'],line:'#fff3e0'},
  {bg:'#050518',colors:['#050540','#0a0a80','#1010c0','#2020e0','#5050ff','#8080ff'],line:'#e8e8ff'},
];

function styleCrystal(ctx,s,rand){
  const p=CRYSTAL_P[Math.floor(rand()*CRYSTAL_P.length)];
  fillBg(ctx,s,p.bg);
  const center={x:s*(0.38+rand()*0.24),y:s*(0.38+rand()*0.24)};
  const pts=[];
  const n=10+Math.floor(rand()*8);
  for(let i=0;i<n;i++) pts.push({x:rand()*s,y:rand()*s});
  // 周囲の固定点
  [0.1,0.5,0.9].forEach(t=>{pts.push({x:t*s,y:0});pts.push({x:t*s,y:s});pts.push({x:0,y:t*s});pts.push({x:s,y:t*s});});
  pts.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));

  for(let i=0;i<pts.length;i++){
    const a=pts[i],b=pts[(i+1)%pts.length];
    const ci=Math.floor(rand()*p.colors.length);
    ctx.fillStyle=p.colors[ci];ctx.globalAlpha=0.82+rand()*0.18;
    ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.closePath();ctx.fill();
    ctx.strokeStyle=p.line;ctx.lineWidth=s*0.01;ctx.globalAlpha=0.35;ctx.stroke();
  }
  ctx.globalAlpha=1;
  // ハイライト
  const g=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,s*0.2);
  g.addColorStop(0,'rgba(255,255,255,0.75)');g.addColorStop(0.25,'rgba(255,255,255,0.18)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(center.x,center.y,s*0.2,0,Math.PI*2);ctx.fill();
  // 反射光
  const g2=ctx.createRadialGradient(s*0.2,s*0.18,0,s*0.2,s*0.18,s*0.15);
  g2.addColorStop(0,'rgba(255,255,255,0.3)');g2.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g2;ctx.fillRect(0,0,s,s);
}


// ══════════════════════════════════════
// 3: Circuit（回路基板）
// ══════════════════════════════════════
const CIRCUIT_P=[
  {bg:'#020f08',line:'#00e676',dot:'#69f0ae',dim:'#1b5e20'},
  {bg:'#050510',line:'#448aff',dot:'#82b1ff',dim:'#1a237e'},
  {bg:'#100005',line:'#ff1744',dot:'#ff8a80',dim:'#7f0000'},
  {bg:'#080800',line:'#ffd740',dot:'#ffe57f',dim:'#5d4037'},
  {bg:'#050010',line:'#e040fb',dot:'#ea80fc',dim:'#4a148c'},
  {bg:'#000f0f',line:'#1de9b6',dot:'#a7ffeb',dim:'#004d40'},
  {bg:'#0a0600',line:'#ff9100',dot:'#ffcc80',dim:'#4e2600'},
  {bg:'#000810',line:'#40c4ff',dot:'#b3e5fc',dim:'#003050'},
  {bg:'#050008',line:'#ea80fc',dot:'#f3e5f5',dim:'#1a0025'},
  {bg:'#001008',line:'#69f0ae',dot:'#b9f6ca',dim:'#002010'},
];

function styleCircuit(ctx,s,rand){
  const p=CIRCUIT_P[Math.floor(rand()*CIRCUIT_P.length)];
  fillBg(ctx,s,p.bg);
  const gs=s*(0.09+rand()*0.05);
  const snap=v=>Math.round(v/gs)*gs+gs/2;
  ctx.strokeStyle=p.dim;ctx.lineWidth=0.5;ctx.globalAlpha=0.25;
  for(let x=gs/2;x<s;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}
  for(let y=gs/2;y<s;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}
  ctx.globalAlpha=1;
  const nodeCount=12+Math.floor(rand()*10),nodes=[],used=new Set();
  for(let i=0;i<nodeCount*6&&nodes.length<nodeCount;i++){
    const x=snap(rand()*s*0.86+s*0.07),y=snap(rand()*s*0.86+s*0.07),key=`${x},${y}`;
    if(!used.has(key)){used.add(key);nodes.push({x,y,main:rand()<0.2});}
  }
  ctx.strokeStyle=p.line;ctx.lineWidth=s*0.02;ctx.shadowColor=p.line;ctx.shadowBlur=s*0.04;ctx.lineCap='round';
  const drawn=new Set();
  nodes.forEach((a,ai)=>{
    nodes.forEach((b,bi)=>{
      if(ai>=bi)return;
      const key=`${ai}-${bi}`;
      if(drawn.has(key))return;
      const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>s*0.5)return;
      if(dx<1||dy<1){
        drawn.add(key);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }else if(rand()<0.38){
        drawn.add(key);
        // L字 or Z字
        if(rand()>0.5){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x,b.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
        else{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      }
    });
  });
  nodes.forEach(n=>{
    const r=n.main?s*0.042:s*0.026;
    ctx.fillStyle=p.bg;ctx.shadowBlur=0;ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.dot;ctx.shadowColor=p.dot;ctx.shadowBlur=s*0.07;ctx.beginPath();ctx.arc(n.x,n.y,r*0.52,0,Math.PI*2);ctx.fill();
    if(n.main){
      ctx.strokeStyle=p.dot;ctx.lineWidth=s*0.01;ctx.globalAlpha=0.45;ctx.beginPath();ctx.arc(n.x,n.y,r*1.55,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }
  });
  ctx.shadowBlur=0;ctx.lineCap='butt';
}


// ══════════════════════════════════════
// 4: Constellation（星座）
// ══════════════════════════════════════
const CONST_P=[
  {bg:'#02030d',star:'#ffffff',line:'#4fc3f7',neb:'rgba(79,195,247,0.18)'},
  {bg:'#030108',star:'#ffe0b2',line:'#ff8a65',neb:'rgba(255,138,101,0.18)'},
  {bg:'#000d08',star:'#e8f5e9',line:'#69f0ae',neb:'rgba(105,240,174,0.18)'},
  {bg:'#08010d',star:'#f3e5f5',line:'#ce93d8',neb:'rgba(206,147,216,0.18)'},
  {bg:'#0d0800',star:'#fff9c4',line:'#ffd740',neb:'rgba(255,215,64,0.18)'},
  {bg:'#000508',star:'#e0f7fa',line:'#00e5ff',neb:'rgba(0,229,255,0.2)'},
  {bg:'#020008',star:'#fce4ec',line:'#f48fb1',neb:'rgba(244,143,177,0.18)'},
  {bg:'#000800',star:'#f9fbe7',line:'#c5e1a5',neb:'rgba(197,225,165,0.18)'},
  {bg:'#040404',star:'#e0e0e0',line:'#9e9e9e',neb:'rgba(158,158,158,0.15)'},
  {bg:'#020a04',star:'#e8f5e9',line:'#80cbc4',neb:'rgba(128,203,196,0.2)'},
];

function styleConstellation(ctx,s,rand){
  const p=CONST_P[Math.floor(rand()*CONST_P.length)];
  fillBg(ctx,s,p.bg);
  // 星雲1〜2個
  const nebCount=1+Math.floor(rand()*2);
  for(let ni=0;ni<nebCount;ni++){
    const nx=s*(0.2+rand()*0.6),ny=s*(0.2+rand()*0.6);
    const nb=ctx.createRadialGradient(nx,ny,0,nx,ny,s*(0.4+rand()*0.2));
    nb.addColorStop(0,p.neb);nb.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=nb;ctx.fillRect(0,0,s,s);
  }
  // 背景星
  ctx.fillStyle=p.star;
  for(let i=0;i<60+Math.floor(rand()*40);i++){
    ctx.globalAlpha=0.1+rand()*0.3;
    ctx.beginPath();ctx.arc(rand()*s,rand()*s,rand()*s*0.007+s*0.002,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  // 主星
  const mc=8+Math.floor(rand()*8);
  const stars=[];
  for(let i=0;i<mc;i++) stars.push({x:s*(0.08+rand()*0.84),y:s*(0.08+rand()*0.84),r:s*(0.011+rand()*0.024),br:0.55+rand()*0.45});
  // 接続線（スパニングツリー風）
  ctx.strokeStyle=p.line;ctx.lineWidth=s*0.007;
  for(let i=0;i<stars.length;i++){
    for(let j=i+1;j<stars.length;j++){
      const dx=stars[i].x-stars[j].x,dy=stars[i].y-stars[j].y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<s*0.44&&rand()<0.6){
        ctx.globalAlpha=0.1+0.22*(1-d/(s*0.44));
        ctx.beginPath();ctx.moveTo(stars[i].x,stars[i].y);ctx.lineTo(stars[j].x,stars[j].y);ctx.stroke();
      }
    }
  }
  ctx.globalAlpha=1;
  stars.forEach(star=>{
    const g=ctx.createRadialGradient(star.x,star.y,0,star.x,star.y,star.r*4);
    g.addColorStop(0,'rgba(255,255,255,0.4)');g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.globalAlpha=star.br*0.55;ctx.beginPath();ctx.arc(star.x,star.y,star.r*4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.star;ctx.globalAlpha=star.br;ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
    if(star.br>0.82){
      ctx.strokeStyle=p.star;ctx.lineWidth=s*0.004;ctx.globalAlpha=0.35;
      for(let a=0;a<4;a++){const ang=a*Math.PI/4,len=star.r*4.5;ctx.beginPath();ctx.moveTo(star.x,star.y);ctx.lineTo(star.x+Math.cos(ang)*len,star.y+Math.sin(ang)*len);ctx.stroke();}
    }
  });
  ctx.globalAlpha=1;
}


// ══════════════════════════════════════
// 5: Mandala（曼荼羅）
// ══════════════════════════════════════
const MANDALA_P=[
  {bg:'#080004',a:'#f72585',b:'#7209b7',c:'#3a0ca3',d:'#ffd60a'},
  {bg:'#000d0a',a:'#00e5ff',b:'#00b8a9',c:'#0a3d62',d:'#f8e112'},
  {bg:'#0d0600',a:'#ff6b35',b:'#f7c59f',c:'#004e89',d:'#1a936f'},
  {bg:'#04000d',a:'#e040fb',b:'#7c4dff',c:'#18ffff',d:'#fff176'},
  {bg:'#000a00',a:'#76ff03',b:'#00e676',c:'#1de9b6',d:'#f50057'},
  {bg:'#0d0000',a:'#ff1744',b:'#ff9100',c:'#ffea00',d:'#ffffff'},
  {bg:'#000510',a:'#00b0ff',b:'#0091ea',c:'#01579b',d:'#ffd740'},
  {bg:'#100005',a:'#ff6d00',b:'#dd2c00',c:'#b71c1c',d:'#ffe57f'},
  {bg:'#05000a',a:'#aa00ff',b:'#d500f9',c:'#e040fb',d:'#80deea'},
  {bg:'#00100a',a:'#1de9b6',b:'#00bfa5',c:'#004d40',d:'#ea80fc'},
];

function styleMandala(ctx,s,rand){
  const p=MANDALA_P[Math.floor(rand()*MANDALA_P.length)];
  fillBg(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const sym=Math.floor(rand()*5)*2+4; // 4,6,8,10,12
  const rings=4+Math.floor(rand()*4); // 4〜7

  // パターン種別
  const patType=Math.floor(rand()*3);

  for(let ri=0;ri<rings;ri++){
    const t=ri/rings;
    const r=s*0.44*(1-ri*0.14);
    const rot=t*Math.PI/sym+(ri%2===0?0:Math.PI/sym);
    const colors=[p.a,p.b,p.c,p.d];
    const co=colors[ri%colors.length];
    ctx.shadowColor=co;ctx.shadowBlur=s*(0.05-ri*0.005);
    ctx.strokeStyle=co;ctx.fillStyle=co;
    ctx.lineWidth=s*(0.018-ri*0.0015);
    ctx.globalAlpha=0.92-t*0.28;

    for(let si=0;si<sym;si++){
      const a=si*Math.PI*2/sym+rot;
      ctx.save();ctx.translate(cx,cy);ctx.rotate(a);
      if(patType===0){
        // 花弁
        const pr=r*0.38,px=r*0.62;
        ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(pr,px*0.3,pr*1.2,px*0.8,0,px);ctx.bezierCurveTo(-pr*1.2,px*0.8,-pr,px*0.3,0,0);
        ctx.stroke();if(ri%2===0)ctx.fill();
      }else if(patType===1){
        // 菱形
        const h=r*0.65,w=r*0.28;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,h*0.4);ctx.lineTo(0,h);ctx.lineTo(-w,h*0.4);ctx.closePath();ctx.stroke();if(ri%2===0)ctx.fill();
      }else{
        // 三角放射
        const h=r*0.7,w=r*0.22;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,h);ctx.lineTo(-w,h);ctx.closePath();ctx.stroke();if(ri%2===0)ctx.fill();
        // アクセントドット
        ctx.fillStyle=co;ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(0,h*1.05,s*0.014,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha=0.2-t*0.04;
    polygon(ctx,cx,cy,r,sym,rot);ctx.stroke();
  }

  ctx.globalAlpha=1;ctx.shadowBlur=s*0.12;ctx.shadowColor=p.d;
  ctx.fillStyle=p.d;ctx.beginPath();ctx.arc(cx,cy,s*0.04,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=p.bg;ctx.beginPath();ctx.arc(cx,cy,s*0.02,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}


// ══════════════════════════════════════
// 6: Vortex（渦流）
// ══════════════════════════════════════
const VORTEX_P=[
  {bg:'#000812',a:'#00e5ff',b:'#0091ea',c:'#e040fb'},
  {bg:'#0a0000',a:'#ff6d00',b:'#ff1744',c:'#ffd740'},
  {bg:'#000a04',a:'#00e676',b:'#00bcd4',c:'#69f0ae'},
  {bg:'#08000a',a:'#ea80fc',b:'#7c4dff',c:'#ff80ab'},
  {bg:'#0a0800',a:'#ffd740','b':'#ff6d00',c:'#ff4081'},
  {bg:'#000508',a:'#80d8ff',b:'#40c4ff',c:'#ffffff'},
  {bg:'#040004',a:'#f48fb1',b:'#ce93d8',c:'#fff176'},
  {bg:'#040400',a:'#ffcc02',b:'#ff6f00',c:'#4caf50'},
];

function styleVortex(ctx,s,rand){
  const p=VORTEX_P[Math.floor(rand()*VORTEX_P.length)];
  fillBg(ctx,s,p.bg);
  const cx=s*(0.38+rand()*0.24),cy=s*(0.38+rand()*0.24);
  const arms=Math.floor(rand()*3)+2; // 2〜4本
  const turns=1.5+rand()*2.5; // 1.5〜4回転
  const steps=600;

  ctx.shadowBlur=s*0.06;

  const colors=[p.a,p.b,p.c];

  for(let arm=0;arm<arms;arm++){
    const baseAngle=arm*Math.PI*2/arms;
    const co=colors[arm%colors.length];
    ctx.strokeStyle=co;ctx.shadowColor=co;

    // 外側から内側へ太さが変わるスパイラル
    for(let layer=0;layer<3;layer++){
      const rMult=1-layer*0.28;
      const alphaMult=1-layer*0.3;
      ctx.globalAlpha=alphaMult;
      ctx.lineWidth=s*(0.026-layer*0.007);
      ctx.beginPath();
      for(let i=0;i<=steps;i++){
        const t=i/steps;
        const angle=baseAngle+t*Math.PI*2*turns+(rand()-0.5)*0.1;
        const r=s*0.44*rMult*(1-t*0.85);
        const x=cx+r*Math.cos(angle);
        const y=cy+r*Math.sin(angle);
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
  }

  // 中心グロー
  ctx.globalAlpha=1;
  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,s*0.1);
  g.addColorStop(0,p.a);g.addColorStop(0.4,'rgba(255,255,255,0.2)');g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.shadowColor=p.a;ctx.shadowBlur=s*0.12;
  ctx.beginPath();ctx.arc(cx,cy,s*0.1,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}


// ══════════════════════════════════════
// 7: Mosaic（モザイク）
// ══════════════════════════════════════
const MOSAIC_P=[
  {bg:'#050010',colors:['#1a0040','#3d0080','#6600cc','#9900ff','#cc66ff','#e699ff','#f0d0ff'],edge:'rgba(255,255,255,0.2)'},
  {bg:'#001008',colors:['#002210','#004420','#006630','#008840','#22aa55','#44cc77','#88ffbb'],edge:'rgba(255,255,255,0.2)'},
  {bg:'#100500',colors:['#400800','#801000','#b01800','#e02000','#ff4422','#ff7755','#ffaa88'],edge:'rgba(255,255,255,0.18)'},
  {bg:'#001018',colors:['#002240','#004488','#0066cc','#0088ff','#44aaff','#88ccff','#cce8ff'],edge:'rgba(255,255,255,0.2)'},
  {bg:'#080808',colors:['#111','#222','#333','#444','#666','#888','#aaa'],edge:'rgba(255,255,255,0.15)'},
  {bg:'#100010',colors:['#300030','#500050','#800080','#aa00aa','#cc44cc','#ee88ee','#ffbbff'],edge:'rgba(255,255,255,0.2)'},
  {bg:'#080400',colors:['#302000','#604000','#806000','#a08000','#c0a020','#e0c040','#ffe060'],edge:'rgba(255,255,255,0.18)'},
  {bg:'#000810',colors:['#001830','#003060','#005090','#0070c0','#2090e0','#50b0ff','#90d0ff'],edge:'rgba(255,255,255,0.2)'},
];

function styleMosaic(ctx,s,rand){
  const p=MOSAIC_P[Math.floor(rand()*MOSAIC_P.length)];
  fillBg(ctx,s,p.bg);

  // ランダム多角形のモザイク
  const cellCount=18+Math.floor(rand()*20);
  // 種点生成（中心周辺に密集）
  const seeds=[];
  for(let i=0;i<cellCount;i++){
    // 中心寄りのガウス風分布
    const r=rand()*rand()*s*0.55;
    const a=rand()*Math.PI*2;
    seeds.push({x:s/2+r*Math.cos(a),y:s/2+r*Math.sin(a)});
  }
  // 外周追加
  for(let i=0;i<8;i++){const a=i*Math.PI/4;seeds.push({x:s/2+s*0.65*Math.cos(a),y:s/2+s*0.65*Math.sin(a)});}

  // 各種点のボロノイ領域を近似描画
  // グリッドサンプリング法
  const res=Math.ceil(s/2);
  const assignment=new Int16Array(res*res);
  for(let py=0;py<res;py++){
    for(let px=0;px<res;px++){
      const wx=px/res*s,wy=py/res*s;
      let minD=Infinity,minI=0;
      seeds.forEach((seed,i)=>{const d=(wx-seed.x)**2+(wy-seed.y)**2;if(d<minD){minD=d;minI=i;}});
      assignment[py*res+px]=minI;
    }
  }

  // 各セルを塗る（輝度でグラデーション）
  const cellColors=seeds.map((_,i)=>{
    const t=i/seeds.length;
    const ci=Math.floor(t*p.colors.length);
    return p.colors[Math.min(ci,p.colors.length-1)];
  });

  ctx.save();ctx.scale(s/res,s/res);
  for(let py=0;py<res;py++){
    for(let px=0;px<res;px++){
      const idx=assignment[py*res+px];
      ctx.fillStyle=cellColors[idx];
      // 隣接チェックでエッジ検出
      const isEdge=(px>0&&assignment[py*res+px-1]!==idx)||(px<res-1&&assignment[py*res+px+1]!==idx)||(py>0&&assignment[(py-1)*res+px]!==idx)||(py<res-1&&assignment[(py+1)*res+px]!==idx);
      ctx.globalAlpha=isEdge?0.0:0.95;
      ctx.fillRect(px,py,1,1);
    }
  }
  ctx.restore();

  // エッジラインを後で上書き
  ctx.strokeStyle=p.edge;ctx.lineWidth=s*0.012;ctx.globalAlpha=1;
  // 各種点間のボロノイエッジ（近傍ペアの垂直二等分線を描画）
  seeds.forEach((a,ai)=>{
    seeds.forEach((b,bi)=>{
      if(ai>=bi)return;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.sqrt(dx*dx+dy*dy);
      if(d>s*0.35)return;
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      const nx=-dy/d*s*0.18,ny=dx/d*s*0.18;
      ctx.globalAlpha=0.2;
      ctx.beginPath();ctx.moveTo(mx-nx,my-ny);ctx.lineTo(mx+nx,my+ny);ctx.stroke();
    });
  });

  // 明るい種点マーカー
  ctx.globalAlpha=1;
  seeds.slice(0,cellCount).forEach((seed,i)=>{
    if(i%4!==0)return;
    const co=p.colors[Math.floor(i/seeds.length*p.colors.length)%p.colors.length];
    ctx.fillStyle=co;ctx.shadowColor=co;ctx.shadowBlur=s*0.05;
    ctx.beginPath();ctx.arc(seed.x,seed.y,s*0.012,0,Math.PI*2);ctx.fill();
  });
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}


// ══════════════════════════════════════
// スタイル定義テーブル
// ══════════════════════════════════════
const RENDERERS=[
  styleTopographic,
  styleMystic,
  styleCrystal,
  styleCircuit,
  styleConstellation,
  styleMandala,
  styleVortex,
  styleMosaic,
];

export const AVATAR_STYLES=[
  {id:0,label:'地形図',  sub:'Topographic', emoji:'🗺️'},
  {id:1,label:'数学曲線',sub:'Mystic Curves',emoji:'〜'},
  {id:2,label:'結晶',   sub:'Crystal',      emoji:'💎'},
  {id:3,label:'回路',   sub:'Circuit',      emoji:'⚡'},
  {id:4,label:'星座',   sub:'Constellation',emoji:'✦'},
  {id:5,label:'曼荼羅', sub:'Mandala',      emoji:'◉'},
  {id:6,label:'渦流',   sub:'Vortex',       emoji:'🌀'},
  {id:7,label:'モザイク',sub:'Mosaic',       emoji:'◼'},
];

// ══════════════════════════════════════
// メイン生成関数
// ══════════════════════════════════════
export function generateGeoAvatar(size=256,seed=null,styleIndex=-1){
  const canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');
  const rand=makeRand(seed!=null?seed:Math.floor(Math.random()*2147483647));
  let si=styleIndex;
  if(si<0||si>=RENDERERS.length) si=Math.floor(rand()*RENDERERS.length);
  RENDERERS[si](ctx,size,rand);
  clipRounded(ctx,size);
  return canvas;
}

export function canvasToBlob(canvas){
  return new Promise(res=>canvas.toBlob(blob=>res(blob),'image/png'));
}

export function geoAvatarDataUrl(id,size=40,styleIndex=-1){
  const canvas=generateGeoAvatar(size,seedFromId(id),styleIndex);
  return canvas.toDataURL('image/png');
}