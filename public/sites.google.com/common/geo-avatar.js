// ========================================
// Multi-Style Avatar Generator
// ========================================
// generateGeoAvatar(size, seed)          → シードでスタイル自動決定
// generateGeoAvatar(size, seed, styleIndex) → スタイル指定
// AVATAR_STYLES → [{id, label}] 設定画面用エクスポート
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

// ── 角丸クリップ ──────────────────────
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

function fillBg(ctx,s,color){
  ctx.fillStyle=color;ctx.fillRect(0,0,s,s);
}


// ══════════════════════════════════════
// STYLE 0 — Topographic（地形図）
// ══════════════════════════════════════
const TOPO_PALETTES=[
  {bg:'#0d0005',layers:['#ffd740','#ff6d00','#d84315','#7b1a1a','#3d0020'],acc:'#ffd740'},
  {bg:'#000a18',layers:['#e0f7fa','#4dd0e1','#0097a7','#005b6d','#001a2a'],acc:'#ffffff'},
  {bg:'#001400',layers:['#f9fbe7','#aed581','#558b2f','#1b5e20','#0a2810'],acc:'#ffe57f'},
  {bg:'#080e1e',layers:['#ffffff','#b3e5fc','#039be5','#01579b','#001a40'],acc:'#ff8f00'},
  {bg:'#120700',layers:['#fff9c4','#ffe082','#ff8f00','#bf360c','#4e1003'],acc:'#80cbc4'},
  {bg:'#070010',layers:['#ede7f6','#ce93d8','#9c27b0','#4a148c','#12003a'],acc:'#69f0ae'},
  {bg:'#001018',layers:['#e0ffff','#00e5ff','#0097a7','#004d5e','#000e16'],acc:'#ff80ab'},
  {bg:'#010d0a',layers:['#e8f5e9','#69f0ae','#00c853','#1b5e20','#001a10'],acc:'#ea80fc'},
];

function drawSmooth(ctx,pts){
  const n=pts.length;
  const sm={x:(pts[n-1].x+pts[0].x)/2,y:(pts[n-1].y+pts[0].y)/2};
  ctx.beginPath();ctx.moveTo(sm.x,sm.y);
  for(let i=0;i<n;i++){
    const c=pts[i],nx=pts[(i+1)%n];
    const m={x:(c.x+nx.x)/2,y:(c.y+nx.y)/2};
    ctx.quadraticCurveTo(c.x,c.y,m.x,m.y);
  }
  ctx.closePath();
}

function styleTopographic(ctx,s,rand){
  const p=TOPO_PALETTES[Math.floor(rand()*TOPO_PALETTES.length)];
  fillBg(ctx,s,p.bg);
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
  const gs=s*0.1;
  for(let x=0;x<s;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}
  for(let y=0;y<s;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}

  const cx=s*(0.38+rand()*0.24),cy=s*(0.38+rand()*0.24);
  const nl=4+Math.floor(rand()*3),pc=10+Math.floor(rand()*6),or=s*(0.36+rand()*0.08);
  const angles=[],rm=[];
  for(let i=0;i<pc;i++){
    angles.push((i/pc)*Math.PI*2+(rand()-0.5)*0.35);
    rm.push(0.75+rand()*0.5);
  }
  const has2=rand()<0.3;
  const sp={cx:cx+or*(0.3+rand()*0.3)*Math.cos(rand()*Math.PI*2),cy:cy+or*(0.3+rand()*0.3)*Math.sin(rand()*Math.PI*2),sc:0.45+rand()*0.2};

  for(let li=nl-1;li>=0;li--){
    const t=li/(nl-1),lr=or*(0.14+t*0.86);
    const pts=angles.map((a,i)=>({x:cx+lr*rm[i]*Math.cos(a),y:cy+lr*rm[i]*Math.sin(a)}));
    const ci=Math.min(li,p.layers.length-1);
    ctx.fillStyle=p.layers[ci];drawSmooth(ctx,pts);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=s*0.007;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.07)';ctx.lineWidth=s*0.003;ctx.stroke();
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
// STYLE 1 — Mystic（数学曲線）
// ══════════════════════════════════════
const MYSTIC_PALETTES=[
  {bg:'#0d0221',b:'#ff6ec7',c:'#00fff5'},
  {bg:'#050a1a',b:'#4fc3f7',c:'#ffd54f'},
  {bg:'#0a0a0a',b:'#69f0ae',c:'#b9f6ca'},
  {bg:'#12001f',b:'#ea80fc',c:'#ff6d00'},
  {bg:'#001520',b:'#00b8d9',c:'#79f2c0'},
  {bg:'#0a0014',b:'#a78bfa',c:'#f0abfc'},
  {bg:'#001a12',b:'#1de9b6',c:'#e0f7fa'},
  {bg:'#14000a',b:'#f06292',c:'#fff176'},
];

function styleMystic(ctx,s,rand){
  const p=MYSTIC_PALETTES[Math.floor(rand()*MYSTIC_PALETTES.length)];
  fillBg(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const type=Math.floor(rand()*3);

  if(type===0){
    // エピトロコイド
    const R=s*0.38,rDiv=Math.floor(rand()*5)+2,r=R/rDiv,d=r*(0.5+rand()*0.9),steps=2000;
    ctx.shadowBlur=s*0.06;ctx.shadowColor=p.b;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*2*rDiv*(rDiv%2===0?rDiv-1:rDiv);
      ctx.lineTo(cx+(R+r)*Math.cos(t)-d*Math.cos((R+r)/r*t),cy+(R+r)*Math.sin(t)-d*Math.sin((R+r)/r*t));
    }
    ctx.strokeStyle=p.b;ctx.lineWidth=s*0.022;ctx.stroke();
    const rDiv2=rDiv+1,r2=R*0.4/rDiv2,d2=r2*0.8;
    ctx.shadowColor=p.c;ctx.shadowBlur=s*0.04;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*2*rDiv2*(rDiv2%2===0?rDiv2-1:rDiv2);
      ctx.lineTo(cx+(R*0.4+r2)*Math.cos(t)-d2*Math.cos((R*0.4+r2)/r2*t),cy+(R*0.4+r2)*Math.sin(t)-d2*Math.sin((R*0.4+r2)/r2*t));
    }
    ctx.strokeStyle=p.c;ctx.lineWidth=s*0.015;ctx.stroke();
  }else if(type===1){
    // バラ曲線
    const kOpts=[2,3,4,5,6,7,8],k=kOpts[Math.floor(rand()*kOpts.length)],rot=rand()*Math.PI/k,steps=1200,maxR=s*0.44;
    ctx.shadowBlur=s*0.07;ctx.shadowColor=p.b;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*(k%2===0?2:1),r=maxR*Math.cos(k*t);
      ctx.lineTo(cx+r*Math.cos(t+rot),cy+r*Math.sin(t+rot));
    }
    ctx.strokeStyle=p.b;ctx.lineWidth=s*0.025;ctx.stroke();
    const k2=k%2===0?k-1:k+1;
    ctx.shadowColor=p.c;ctx.shadowBlur=s*0.05;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*(k2%2===0?2:1),r=maxR*0.55*Math.sin(k2*t);
      ctx.lineTo(cx+r*Math.cos(t+rot+Math.PI/k2),cy+r*Math.sin(t+rot+Math.PI/k2));
    }
    ctx.strokeStyle=p.c;ctx.lineWidth=s*0.016;ctx.stroke();
  }else{
    // リサージュ
    const ratios=[[1,2],[1,3],[2,3],[3,4],[3,5],[4,5],[2,5],[3,7]];
    const [nx,ny]=ratios[Math.floor(rand()*ratios.length)],delta=rand()*Math.PI,amp=s*0.43,steps=1500;
    ctx.shadowBlur=s*0.07;
    [{sc:1.0,co:p.b,lw:s*0.024,al:1},{sc:0.7,co:p.c,lw:s*0.018,al:0.8},{sc:0.42,co:p.b,lw:s*0.013,al:0.5}].forEach(l=>{
      ctx.shadowColor=l.co;ctx.globalAlpha=l.al;ctx.beginPath();
      for(let i=0;i<=steps;i++){const t=i/steps*Math.PI*2;ctx.lineTo(cx+amp*l.sc*Math.sin(nx*t+delta),cy+amp*l.sc*Math.sin(ny*t));}
      ctx.strokeStyle=l.co;ctx.lineWidth=l.lw;ctx.stroke();
    });
    ctx.globalAlpha=1;
  }
  ctx.shadowBlur=0;
}


// ══════════════════════════════════════
// STYLE 2 — Crystal（結晶・ボロノイ風）
// ══════════════════════════════════════
const CRYSTAL_PALETTES=[
  {bg:'#0a0f1e',colors:['#1a237e','#283593','#3949ab','#5c6bc0','#7986cb','#aab6fb'],line:'#c5cae9'},
  {bg:'#0d1b12',colors:['#1b5e20','#2e7d32','#388e3c','#43a047','#66bb6a','#a5d6a7'],line:'#b9f6ca'},
  {bg:'#1a0025',colors:['#4a0080','#6a1b9a','#7b1fa2','#8e24aa','#ab47bc','#ce93d8'],line:'#e1bee7'},
  {bg:'#0f0800',colors:['#bf360c','#d84315','#e64a19','#f4511e','#ff7043','#ff8a65'],line:'#fbe9e7'},
  {bg:'#001820',colors:['#004d5e','#00695c','#00796b','#00897b','#26a69a','#80cbc4'],line:'#e0f2f1'},
  {bg:'#1c1c1c',colors:['#212121','#303030','#424242','#616161','#757575','#9e9e9e'],line:'#e0e0e0'},
];

function styleCrystal(ctx,s,rand){
  const p=CRYSTAL_PALETTES[Math.floor(rand()*CRYSTAL_PALETTES.length)];
  fillBg(ctx,s,p.bg);
  // ランダム点からドロネー風三角分割
  const n=8+Math.floor(rand()*6);
  const pts=[
    {x:0,y:0},{x:s,y:0},{x:s,y:s},{x:0,y:s}, // コーナー
    {x:s/2,y:s/2}, // 中心
  ];
  for(let i=0;i<n;i++) pts.push({x:rand()*s,y:rand()*s});

  // 簡易三角分割（中心点と各エッジを結ぶ）
  const center={x:s*(0.4+rand()*0.2),y:s*(0.4+rand()*0.2)};
  // ソートして扇形に分割
  const edge=pts.filter((_,i)=>i>=5).concat([{x:s*0.1,y:0},{x:s*0.9,y:0},{x:s,y:s*0.1},{x:s,y:s*0.9},{x:s*0.9,y:s},{x:s*0.1,y:s},{x:0,y:s*0.9},{x:0,y:s*0.1}]);
  edge.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));

  for(let i=0;i<edge.length;i++){
    const a=edge[i],b=edge[(i+1)%edge.length];
    const ci=Math.floor(rand()*p.colors.length);
    ctx.fillStyle=p.colors[ci];
    ctx.globalAlpha=0.85+rand()*0.15;
    ctx.beginPath();
    ctx.moveTo(center.x,center.y);
    ctx.lineTo(a.x,a.y);
    ctx.lineTo(b.x,b.y);
    ctx.closePath();ctx.fill();

    ctx.strokeStyle=p.line;
    ctx.lineWidth=s*0.012;
    ctx.globalAlpha=0.4;
    ctx.stroke();
  }
  ctx.globalAlpha=1;

  // 中心輝点
  const grad=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,s*0.18);
  grad.addColorStop(0,'rgba(255,255,255,0.7)');
  grad.addColorStop(0.3,'rgba(255,255,255,0.15)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.arc(center.x,center.y,s*0.18,0,Math.PI*2);ctx.fill();
}


// ══════════════════════════════════════
// STYLE 3 — Circuit（回路基板）
// ══════════════════════════════════════
const CIRCUIT_PALETTES=[
  {bg:'#020f08',line:'#00e676',dot:'#69f0ae',dim:'#1b5e20'},
  {bg:'#050510',line:'#448aff',dot:'#82b1ff',dim:'#1a237e'},
  {bg:'#100005',line:'#ff1744',dot:'#ff8a80',dim:'#7f0000'},
  {bg:'#080800',line:'#ffd740',dot:'#ffe57f',dim:'#5d4037'},
  {bg:'#050010',line:'#e040fb',dot:'#ea80fc',dim:'#4a148c'},
  {bg:'#000f0f',line:'#1de9b6',dot:'#a7ffeb',dim:'#004d40'},
];

function styleCircuit(ctx,s,rand){
  const p=CIRCUIT_PALETTES[Math.floor(rand()*CIRCUIT_PALETTES.length)];
  fillBg(ctx,s,p.bg);

  // グリッド
  const gs=s*0.11;
  ctx.strokeStyle=p.dim;ctx.lineWidth=0.5;ctx.globalAlpha=0.3;
  for(let x=gs/2;x<s;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,s);ctx.stroke();}
  for(let y=gs/2;y<s;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(s,y);ctx.stroke();}
  ctx.globalAlpha=1;

  // スナップ関数
  const snap=v=>Math.round(v/gs)*gs+gs/2;

  // ノード生成
  const nodeCount=10+Math.floor(rand()*8);
  const nodes=[];
  const used=new Set();
  for(let i=0;i<nodeCount*5&&nodes.length<nodeCount;i++){
    const x=snap(rand()*s*0.88+s*0.06);
    const y=snap(rand()*s*0.88+s*0.06);
    const key=`${x},${y}`;
    if(!used.has(key)){used.add(key);nodes.push({x,y});}
  }

  // エッジ（水平・垂直のみ）
  ctx.strokeStyle=p.line;ctx.lineWidth=s*0.022;
  ctx.shadowColor=p.line;ctx.shadowBlur=s*0.04;
  ctx.lineCap='round';
  const drawn=new Set();
  nodes.forEach((a,ai)=>{
    nodes.forEach((b,bi)=>{
      if(ai>=bi)return;
      const key=`${ai}-${bi}`;
      if(drawn.has(key))return;
      // 水平か垂直の接続のみ
      if(a.x!==b.x&&a.y!==b.y){
        // L字接続
        if(rand()<0.4){
          drawn.add(key);
          const mid={x:a.x,y:b.y};
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(mid.x,mid.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        }
      }else{
        drawn.add(key);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    });
  });

  // パッド（ノード）
  nodes.forEach(n=>{
    const isMain=rand()<0.25;
    const r=isMain?s*0.04:s*0.025;
    ctx.fillStyle=p.bg;ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.dot;ctx.shadowColor=p.dot;ctx.shadowBlur=s*0.06;
    ctx.beginPath();ctx.arc(n.x,n.y,r*0.55,0,Math.PI*2);ctx.fill();
    if(isMain){
      ctx.strokeStyle=p.dot;ctx.lineWidth=s*0.012;ctx.globalAlpha=0.5;
      ctx.beginPath();ctx.arc(n.x,n.y,r*1.5,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }
  });
  ctx.shadowBlur=0;ctx.lineCap='butt';
}


// ══════════════════════════════════════
// STYLE 4 — Constellation（星座）
// ══════════════════════════════════════
const CONST_PALETTES=[
  {bg:'#02030d',star:'#ffffff',line:'#4fc3f7',nebula:'rgba(79,195,247,0.06)'},
  {bg:'#030108',star:'#ffe0b2',line:'#ff8a65',nebula:'rgba(255,138,101,0.06)'},
  {bg:'#000d08',star:'#e8f5e9',line:'#69f0ae',nebula:'rgba(105,240,174,0.06)'},
  {bg:'#08010d',star:'#f3e5f5',line:'#ce93d8',nebula:'rgba(206,147,216,0.06)'},
  {bg:'#0d0800',star:'#fff9c4',line:'#ffd740',nebula:'rgba(255,215,64,0.06)'},
  {bg:'#000508',star:'#e0f7fa',line:'#00e5ff',nebula:'rgba(0,229,255,0.07)'},
];

function styleConstellation(ctx,s,rand){
  const p=CONST_PALETTES[Math.floor(rand()*CONST_PALETTES.length)];
  fillBg(ctx,s,p.bg);

  // 星雲的な背景グロー
  const cx=s*(0.3+rand()*0.4),cy=s*(0.3+rand()*0.4);
  const nebula=ctx.createRadialGradient(cx,cy,0,cx,cy,s*0.6);
  nebula.addColorStop(0,p.nebula.replace('0.06','0.18').replace('0.07','0.2'));
  nebula.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=nebula;ctx.fillRect(0,0,s,s);

  // 背景の小さい星
  const bgStarCount=40+Math.floor(rand()*30);
  ctx.fillStyle=p.star;
  for(let i=0;i<bgStarCount;i++){
    const bx=rand()*s,by=rand()*s,br=rand()*s*0.008+s*0.002;
    ctx.globalAlpha=0.2+rand()*0.4;
    ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;

  // 主星（星座のノード）
  const mainCount=7+Math.floor(rand()*6);
  const stars=[];
  for(let i=0;i<mainCount;i++){
    stars.push({
      x:s*(0.1+rand()*0.8),
      y:s*(0.1+rand()*0.8),
      r:s*(0.012+rand()*0.022),
      brightness:0.6+rand()*0.4
    });
  }

  // 接続線（近い星を繋ぐ）
  ctx.strokeStyle=p.line;
  ctx.lineWidth=s*0.008;
  for(let i=0;i<stars.length;i++){
    for(let j=i+1;j<stars.length;j++){
      const dx=stars[i].x-stars[j].x,dy=stars[i].y-stars[j].y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<s*0.42&&rand()<0.65){
        ctx.globalAlpha=0.15+0.2*(1-dist/(s*0.42));
        ctx.beginPath();ctx.moveTo(stars[i].x,stars[i].y);ctx.lineTo(stars[j].x,stars[j].y);ctx.stroke();
      }
    }
  }
  ctx.globalAlpha=1;

  // 主星を描画
  stars.forEach(star=>{
    // グロー
    const g=ctx.createRadialGradient(star.x,star.y,0,star.x,star.y,star.r*3.5);
    g.addColorStop(0,p.line.replace('#','rgba(').replace(/^rgba\(/,'rgba(')+'88');
    g.addColorStop(0,'rgba(255,255,255,0.4)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.globalAlpha=star.brightness*0.6;
    ctx.beginPath();ctx.arc(star.x,star.y,star.r*3.5,0,Math.PI*2);ctx.fill();
    // コア
    ctx.fillStyle=p.star;ctx.globalAlpha=star.brightness;
    ctx.beginPath();ctx.arc(star.x,star.y,star.r,0,Math.PI*2);ctx.fill();
    // 光芒（明るい星のみ）
    if(star.brightness>0.85){
      ctx.strokeStyle=p.star;ctx.lineWidth=s*0.005;ctx.globalAlpha=0.4;
      for(let a=0;a<4;a++){
        const angle=a*Math.PI/4;const len=star.r*4;
        ctx.beginPath();ctx.moveTo(star.x,star.y);ctx.lineTo(star.x+Math.cos(angle)*len,star.y+Math.sin(angle)*len);ctx.stroke();
      }
    }
  });
  ctx.globalAlpha=1;
}


// ══════════════════════════════════════
// STYLE 5 — Mandala（曼荼羅）
// ══════════════════════════════════════
const MANDALA_PALETTES=[
  {bg:'#080004',a:'#f72585',b:'#7209b7',c:'#3a0ca3',d:'#ffd60a'},
  {bg:'#000d0a',a:'#00e5ff',b:'#00b8a9',c:'#0a3d62',d:'#f8e112'},
  {bg:'#0d0600',a:'#ff6b35',b:'#f7c59f',c:'#004e89',d:'#1a936f'},
  {bg:'#04000d',a:'#e040fb',b:'#7c4dff',c:'#18ffff',d:'#fff176'},
  {bg:'#000a00',a:'#76ff03',b:'#00e676',c:'#1de9b6',d:'#f50057'},
  {bg:'#0d0000',a:'#ff1744',b:'#ff9100','c':'#ffea00',d:'#ffffff'},
];

function polygon(ctx,cx,cy,r,n,rot=0){
  ctx.beginPath();
  for(let i=0;i<n;i++){
    const a=rot+i*Math.PI*2/n-Math.PI/2;
    i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
  }
  ctx.closePath();
}

function styleMandala(ctx,s,rand){
  const p=MANDALA_PALETTES[Math.floor(rand()*MANDALA_PALETTES.length)];
  fillBg(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const sym=Math.floor(rand()*4)*2+4; // 4,6,8,10,12
  const rings=4+Math.floor(rand()*3);

  for(let ri=0;ri<rings;ri++){
    const t=ri/rings;
    const r=s*(0.44-t*0.02)*(1-ri*0.15);
    const rot=t*Math.PI/sym+(ri%2===0?0:Math.PI/sym);
    const colors=[p.a,p.b,p.c,p.d];
    const co=colors[ri%colors.length];

    ctx.shadowColor=co;
    ctx.shadowBlur=s*(0.04-ri*0.004);
    ctx.strokeStyle=co;
    ctx.lineWidth=s*(0.018-ri*0.002);
    ctx.globalAlpha=0.9-t*0.3;

    // 放射対称に同じ形を描く
    for(let si=0;si<sym;si++){
      const a=si*Math.PI*2/sym+rot;
      ctx.save();
      ctx.translate(cx,cy);ctx.rotate(a);
      // 花弁
      const pr=r*0.38,px=r*0.62;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.bezierCurveTo(pr,px*0.3,pr*1.2,px*0.8,0,px);
      ctx.bezierCurveTo(-pr*1.2,px*0.8,-pr,px*0.3,0,0);
      ctx.stroke();
      if(rand()>0.5)ctx.fill();
      // 先端ドット
      ctx.fillStyle=co;ctx.globalAlpha=0.8;
      ctx.beginPath();ctx.arc(0,px,s*0.015,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }

    // リング
    ctx.globalAlpha=0.25-t*0.05;
    polygon(ctx,cx,cy,r,sym,rot);ctx.stroke();
  }

  // 中心
  ctx.globalAlpha=1;ctx.shadowBlur=s*0.12;ctx.shadowColor=p.d;
  ctx.fillStyle=p.d;
  ctx.beginPath();ctx.arc(cx,cy,s*0.04,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=p.bg;
  ctx.beginPath();ctx.arc(cx,cy,s*0.02,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.globalAlpha=1;
}


// ══════════════════════════════════════
// スタイル定義（設定画面で使う）
// ══════════════════════════════════════
const STYLE_RENDERERS=[
  styleTopographic,
  styleMystic,
  styleCrystal,
  styleCircuit,
  styleConstellation,
  styleMandala,
];

export const AVATAR_STYLES=[
  {id:0,label:'地形図',emoji:'🗺️'},
  {id:1,label:'数学曲線',emoji:'〜'},
  {id:2,label:'結晶',emoji:'💎'},
  {id:3,label:'回路',emoji:'⚡'},
  {id:4,label:'星座',emoji:'✦'},
  {id:5,label:'曼荼羅',emoji:'◉'},
];

// ══════════════════════════════════════
// メイン生成関数
// styleIndex: -1=シードで自動, 0〜5=指定
// ══════════════════════════════════════
export function generateGeoAvatar(size=256,seed=null,styleIndex=-1){
  const canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');

  const rand=makeRand(seed!=null?seed:Math.floor(Math.random()*2147483647));

  let si=styleIndex;
  if(si<0||si>=STYLE_RENDERERS.length){
    si=Math.floor(rand()*STYLE_RENDERERS.length);
  }

  STYLE_RENDERERS[si](ctx,size,rand);
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