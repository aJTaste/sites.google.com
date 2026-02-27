// ========================================
// Mystic Geometry アバター生成ユーティリティ
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

// ── パレット（深みのある暗色ベース） ──
const PALETTES=[
  {bg:'#0d0221',a:'#7b2d8b',b:'#ff6ec7',c:'#00fff5'},
  {bg:'#050a1a',a:'#1a3a6b',b:'#4fc3f7',c:'#ffd54f'},
  {bg:'#0a0a0a',a:'#1b5e20',b:'#69f0ae',c:'#b9f6ca'},
  {bg:'#12001f',a:'#6a0080',b:'#ea80fc',c:'#ff6d00'},
  {bg:'#001520',a:'#003c55',b:'#00b8d9',c:'#79f2c0'},
  {bg:'#1a0a00',a:'#7c2f00',b:'#ff6d00',c:'#ffd740'},
  {bg:'#0a0014',a:'#3d1c85',b:'#a78bfa',c:'#f0abfc'},
  {bg:'#001a12',a:'#004d40',b:'#1de9b6',c:'#e0f7fa'},
  {bg:'#14000a',a:'#7b0030',b:'#f06292',c:'#fff176'},
  {bg:'#000d1a',a:'#002b4d',b:'#00e5ff',c:'#ff4081'},
  {bg:'#0c0c14',a:'#2a2a5a',b:'#7986cb',c:'#f8bbd0'},
  {bg:'#0a0800',a:'#3e2723',b:'#ff8a65',c:'#ffccbc'},
];

// ── ユーティリティ ──
function drawRoundedRect(ctx,size,fill){
  const r=size*0.2;
  ctx.fillStyle=fill;
  ctx.beginPath();
  ctx.moveTo(r,0);ctx.lineTo(size-r,0);ctx.quadraticCurveTo(size,0,size,r);
  ctx.lineTo(size,size-r);ctx.quadraticCurveTo(size,size,size-r,size);
  ctx.lineTo(r,size);ctx.quadraticCurveTo(0,size,0,size-r);
  ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath();ctx.fill();
}

function clipRounded(ctx,size){
  const r=size*0.2;
  ctx.globalCompositeOperation='destination-in';
  ctx.fillStyle='#fff';
  ctx.beginPath();
  ctx.moveTo(r,0);ctx.lineTo(size-r,0);ctx.quadraticCurveTo(size,0,size,r);
  ctx.lineTo(size,size-r);ctx.quadraticCurveTo(size,size,size-r,size);
  ctx.lineTo(r,size);ctx.quadraticCurveTo(0,size,0,size-r);
  ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);
  ctx.closePath();ctx.fill();
  ctx.globalCompositeOperation='source-over';
}

// ── 10種 神秘的アーキタイプ ──

// 0: スピログラフ（エピトロコイド）
// 大きな円の外側を小さな円が転がって描く軌跡
function drawSpirograph(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const R=s*0.38; // 固定円の半径
  const rDiv=Math.floor(rand()*5)+2; // 2〜6
  const r=R/rDiv;
  const d=r*(0.5+rand()*0.9); // ペンの距離
  const steps=2000;

  // グロー効果
  ctx.shadowBlur=s*0.06;
  ctx.shadowColor=p.b;

  // 外側のトレース
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*2*rDiv*(rDiv%2===0?rDiv-1:rDiv);
    const x=cx+(R+r)*Math.cos(t)-d*Math.cos((R+r)/r*t);
    const y=cy+(R+r)*Math.sin(t)-d*Math.sin((R+r)/r*t);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.strokeStyle=p.b;
  ctx.lineWidth=s*0.022;
  ctx.stroke();

  // 内側の小さなスピログラフ
  ctx.shadowBlur=s*0.04;
  ctx.shadowColor=p.c;
  const rDiv2=rDiv+1+(rand()>0.5?1:0);
  const r2=R*0.4/rDiv2;
  const d2=r2*0.8;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*2*rDiv2*(rDiv2%2===0?rDiv2-1:rDiv2);
    const x=cx+(R*0.4+r2)*Math.cos(t)-d2*Math.cos((R*0.4+r2)/r2*t);
    const y=cy+(R*0.4+r2)*Math.sin(t)-d2*Math.sin((R*0.4+r2)/r2*t);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.strokeStyle=p.c;
  ctx.lineWidth=s*0.015;
  ctx.stroke();

  ctx.shadowBlur=0;
}

// 1: バラ曲線（Rose curve: r = cos(k*θ)）
function drawRose(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const maxR=s*0.44;
  // kが整数の場合: 奇数→k枚, 偶数→2k枚
  const kOptions=[2,3,4,5,6,7,8];
  const k=kOptions[Math.floor(rand()*kOptions.length)];
  const steps=1200;
  const rot=rand()*Math.PI/k;

  ctx.shadowBlur=s*0.07;
  ctx.shadowColor=p.b;

  // 外側バラ
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*(k%2===0?2:1);
    const r=maxR*Math.cos(k*t);
    const x=cx+r*Math.cos(t+rot);
    const y=cy+r*Math.sin(t+rot);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.strokeStyle=p.b;
  ctx.lineWidth=s*0.025;
  ctx.stroke();

  // 内側バラ（位相ずれ）
  ctx.shadowColor=p.c;
  ctx.shadowBlur=s*0.05;
  const k2=k%2===0?k-1:k+1;
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*(k2%2===0?2:1);
    const r=maxR*0.55*Math.sin(k2*t);
    const x=cx+r*Math.cos(t+rot+Math.PI/k2);
    const y=cy+r*Math.sin(t+rot+Math.PI/k2);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.strokeStyle=p.c;
  ctx.lineWidth=s*0.016;
  ctx.stroke();

  ctx.shadowBlur=0;
}

// 2: リサージュ曲線（Lissajous）
function drawLissajous(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const amp=s*0.43;
  const ratios=[[1,2],[1,3],[2,3],[3,4],[3,5],[4,5],[2,5],[3,7]];
  const [nx,ny]=ratios[Math.floor(rand()*ratios.length)];
  const delta=rand()*Math.PI;
  const steps=1500;

  ctx.shadowBlur=s*0.07;

  // 複数レイヤーで深みを出す
  const layers=[
    {scale:1.0,color:p.b,lw:s*0.024,alpha:1},
    {scale:0.7,color:p.c,lw:s*0.018,alpha:0.8},
    {scale:0.42,color:p.a,lw:s*0.014,alpha:0.6},
  ];
  layers.forEach(layer=>{
    ctx.shadowColor=layer.color;
    ctx.globalAlpha=layer.alpha;
    ctx.beginPath();
    for(let i=0;i<=steps;i++){
      const t=i/steps*Math.PI*2;
      const x=cx+amp*layer.scale*Math.sin(nx*t+delta);
      const y=cy+amp*layer.scale*Math.sin(ny*t);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.strokeStyle=layer.color;
    ctx.lineWidth=layer.lw;
    ctx.stroke();
  });
  ctx.globalAlpha=1;
  ctx.shadowBlur=0;
}

// 3: フラワー・オブ・ライフ（重なり合う円群）
function drawFlowerOfLife(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const r=s*0.18;
  const rings=Math.floor(rand()*2)+1; // 1〜2リング

  ctx.shadowBlur=s*0.05;

  // 中心円
  const drawCircle=(x,y,alpha,color)=>{
    ctx.globalAlpha=alpha;
    ctx.strokeStyle=color;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  };

  ctx.lineWidth=s*0.018;
  ctx.shadowColor=p.b;

  // 中心
  drawCircle(cx,cy,0.9,p.b);

  // 第1リング（6個）
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    drawCircle(cx+r*Math.cos(a),cy+r*Math.sin(a),0.75,p.b);
  }

  if(rings>=2){
    // 第2リング
    ctx.lineWidth=s*0.013;
    ctx.shadowColor=p.c;
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      drawCircle(cx+r*2*Math.cos(a),cy+r*2*Math.sin(a),0.55,p.c);
      const a2=a+Math.PI/3;
      drawCircle(cx+r*Math.sqrt(3)*Math.cos(a2),cy+r*Math.sqrt(3)*Math.sin(a2),0.45,p.c);
    }
  }

  // アクセント：中心の星紋（六芒星）
  ctx.globalAlpha=0.6;
  ctx.strokeStyle=p.c;
  ctx.lineWidth=s*0.02;
  ctx.shadowColor=p.c;
  ctx.shadowBlur=s*0.08;
  const rStar=r*0.95;
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3-Math.PI/6;
    i===0?ctx.moveTo(cx+rStar*Math.cos(a),cy+rStar*Math.sin(a)):ctx.lineTo(cx+rStar*Math.cos(a),cy+rStar*Math.sin(a));
  }
  ctx.closePath();ctx.stroke();

  ctx.globalAlpha=1;ctx.shadowBlur=0;
}

// 4: スリヤントラ（同心三角形の入れ子）
function drawYantra(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const layers=Math.floor(rand()*3)+3; // 3〜5層
  const rot0=rand()*Math.PI/6;

  ctx.shadowBlur=s*0.06;

  for(let i=0;i<layers;i++){
    const t=i/layers;
    const r=s*(0.44-t*0.1);
    const sides=i%2===0?3:3;
    const rot=rot0+i*Math.PI/3+(i%2===0?0:Math.PI/3);
    const alpha=0.9-t*0.3;
    const color=i%3===0?p.b:i%3===1?p.c:p.a;

    ctx.globalAlpha=alpha;
    ctx.strokeStyle=color;
    ctx.lineWidth=s*(0.025-i*0.002);
    ctx.shadowColor=color;

    ctx.beginPath();
    for(let j=0;j<sides;j++){
      const a=rot+j*Math.PI*2/sides-Math.PI/2;
      j===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a))
           :ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    }
    ctx.closePath();ctx.stroke();
  }

  // 中心の点光源
  ctx.globalAlpha=1;
  ctx.fillStyle=p.c;
  ctx.shadowColor=p.c;
  ctx.shadowBlur=s*0.1;
  ctx.beginPath();ctx.arc(cx,cy,s*0.04,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}

// 5: ハイポトロコイド（内側スピログラフ）
function drawHypo(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const R=s*0.44;
  const rDiv=Math.floor(rand()*4)+3; // 3〜6
  const r=R/rDiv;
  const d=r*(0.3+rand()*1.2);
  const steps=2400;

  ctx.shadowBlur=s*0.07;
  ctx.shadowColor=p.b;

  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*2*rDiv;
    const x=cx+(R-r)*Math.cos(t)+d*Math.cos((R-r)/r*t);
    const y=cy+(R-r)*Math.sin(t)-d*Math.sin((R-r)/r*t);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.strokeStyle=p.b;ctx.lineWidth=s*0.022;ctx.stroke();

  // 逆回転の重ね合わせ
  ctx.shadowColor=p.c;
  ctx.shadowBlur=s*0.05;
  const rDiv2=rDiv-1<2?rDiv+2:rDiv-1;
  const r2=R*0.6/rDiv2;
  const d2=r2*(0.6+rand()*0.8);
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*2*rDiv2;
    const x=cx+(R*0.6-r2)*Math.cos(-t)+d2*Math.cos((R*0.6-r2)/r2*(-t));
    const y=cy+(R*0.6-r2)*Math.sin(-t)-d2*Math.sin((R*0.6-r2)/r2*(-t));
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.strokeStyle=p.c;ctx.lineWidth=s*0.015;ctx.stroke();

  ctx.shadowBlur=0;
}

// 6: フラクタル再帰多角形（ポリゴンの各辺に小ポリゴンを生やす）
function drawFractalPoly(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const n=Math.floor(rand()*3)+3; // 3〜5
  const maxDepth=Math.floor(rand()*2)+3; // 3〜4
  const rot0=rand()*Math.PI*2;

  ctx.shadowBlur=s*0.05;

  function drawPoly(x,y,r,sides,rot,depth){
    if(depth<=0||r<s*0.015)return;
    const alpha=0.9-((maxDepth-depth)/maxDepth)*0.5;
    const color=depth%3===0?p.b:depth%3===1?p.c:p.a;
    ctx.globalAlpha=alpha;
    ctx.strokeStyle=color;
    ctx.lineWidth=r*0.12;
    ctx.shadowColor=color;

    const pts=[];
    ctx.beginPath();
    for(let i=0;i<sides;i++){
      const a=rot+i*Math.PI*2/sides-Math.PI/2;
      const px=x+r*Math.cos(a);
      const py=y+r*Math.sin(a);
      pts.push({x:px,y:py});
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.stroke();

    // 各辺の中点に子ポリゴン
    for(let i=0;i<sides;i++){
      const p2=pts[(i+1)%sides];
      const mx=(pts[i].x+p2.x)/2;
      const my=(pts[i].y+p2.y)/2;
      const childR=r*0.38;
      const childRot=rot+Math.PI/(sides)+(depth%2===0?0.2:-0.2);
      drawPoly(mx,my,childR,sides,childRot,depth-1);
    }
  }

  drawPoly(cx,cy,s*0.38,n,rot0,maxDepth);
  ctx.globalAlpha=1;ctx.shadowBlur=0;
}

// 7: 干渉パターン（同心円×2セット、干渉縞モアレ風）
function drawInterference(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);

  const cx=s/2,cy=s/2;
  const off=s*(0.08+rand()*0.12);
  const angle=rand()*Math.PI*2;
  const cx2=cx+off*Math.cos(angle);
  const cy2=cy+off*Math.sin(angle);
  const rings=Math.floor(rand()*5)+10; // 10〜14
  const maxR=s*0.62;

  ctx.shadowBlur=s*0.04;

  for(let i=1;i<=rings;i++){
    const t=i/rings;
    const r=maxR*Math.sqrt(t); // 等面積間隔

    // セット1
    ctx.globalAlpha=0.55-t*0.2;
    ctx.strokeStyle=p.b;
    ctx.lineWidth=s*0.015;
    ctx.shadowColor=p.b;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();

    // セット2（オフセット中心）
    ctx.strokeStyle=p.c;
    ctx.shadowColor=p.c;
    ctx.beginPath();ctx.arc(cx2,cy2,r,0,Math.PI*2);ctx.stroke();
  }

  // 中心グロー
  ctx.globalAlpha=1;
  ctx.fillStyle=p.c;
  ctx.shadowColor=p.c;
  ctx.shadowBlur=s*0.1;
  ctx.beginPath();ctx.arc(cx,cy,s*0.04,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}

// 8: 星多角形（シュレイフリ記号風）& クモの巣
function drawStarWeb(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const n=Math.floor(rand()*5)+5; // 5〜9
  const step=Math.floor(rand()*(Math.floor(n/2)-1))+2; // 2〜n/2
  const rings=Math.floor(rand()*3)+3; // 3〜5
  const rot=rand()*Math.PI*2;

  ctx.shadowBlur=s*0.06;

  for(let ri=0;ri<rings;ri++){
    const r=s*(0.44-ri*0.07);
    const alpha=0.9-ri*0.15;
    const color=ri%2===0?p.b:p.c;

    // 星型多角形（頂点をstepおきに結ぶ）
    ctx.globalAlpha=alpha;
    ctx.strokeStyle=color;
    ctx.lineWidth=s*(0.022-ri*0.003);
    ctx.shadowColor=color;

    ctx.beginPath();
    for(let i=0;i<=n;i++){
      const a=rot+(i*step%n)*Math.PI*2/n-Math.PI/2;
      i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a))
           :ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    }
    ctx.closePath();ctx.stroke();
  }

  // 放射線（スポーク）
  ctx.globalAlpha=0.3;
  ctx.strokeStyle=p.c;
  ctx.lineWidth=s*0.01;
  for(let i=0;i<n;i++){
    const a=rot+i*Math.PI*2/n-Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(cx+s*0.44*Math.cos(a),cy+s*0.44*Math.sin(a));
    ctx.stroke();
  }

  ctx.globalAlpha=1;ctx.shadowBlur=0;
}

// 9: 複素渦巻き（フィボナッチ螺旋 + 黄金角ドット）
function drawFibonacci(ctx,s,rand,p){
  drawRoundedRect(ctx,s,p.bg);
  const cx=s/2,cy=s/2;
  const goldenAngle=Math.PI*(3-Math.sqrt(5)); // 137.5°
  const totalDots=Math.floor(rand()*60)+120; // 120〜180
  const maxR=s*0.46;
  const rot0=rand()*Math.PI*2;
  const dotSize=s*(0.022+rand()*0.018);

  ctx.shadowBlur=s*0.05;

  // 渦巻き接線を先に描く
  ctx.strokeStyle=p.a;
  ctx.globalAlpha=0.25;
  ctx.lineWidth=s*0.008;
  ctx.shadowColor=p.a;
  ctx.beginPath();
  for(let i=0;i<totalDots;i++){
    const r=maxR*Math.sqrt(i/totalDots);
    const a=rot0+i*goldenAngle;
    const x=cx+r*Math.cos(a);
    const y=cy+r*Math.sin(a);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.stroke();

  // ドット
  for(let i=0;i<totalDots;i++){
    const t=i/totalDots;
    const r=maxR*Math.sqrt(t);
    const a=rot0+i*goldenAngle;
    const x=cx+r*Math.cos(a);
    const y=cy+r*Math.sin(a);
    const ds=dotSize*(1-t*0.5);

    const color=t<0.5?p.b:p.c;
    ctx.fillStyle=color;
    ctx.shadowColor=color;
    ctx.globalAlpha=0.4+t*0.5;
    ctx.beginPath();ctx.arc(x,y,ds,0,Math.PI*2);ctx.fill();
  }

  // 中心
  ctx.globalAlpha=1;
  ctx.fillStyle=p.c;
  ctx.shadowColor=p.c;
  ctx.shadowBlur=s*0.1;
  ctx.beginPath();ctx.arc(cx,cy,dotSize*1.5,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
}

const ARCHETYPES=[
  drawSpirograph, // 0
  drawRose,       // 1
  drawLissajous,  // 2
  drawFlowerOfLife,// 3
  drawYantra,     // 4
  drawHypo,       // 5
  drawFractalPoly,// 6
  drawInterference,// 7
  drawStarWeb,    // 8
  drawFibonacci,  // 9
];

// ── メイン生成関数 ──
export function generateGeoAvatar(size=256,seed=null){
  const canvas=document.createElement('canvas');
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext('2d');

  const rand=makeRand(seed!=null?seed:Math.floor(Math.random()*2147483647));

  const pi=Math.floor(rand()*PALETTES.length);
  const p=PALETTES[pi];

  const ai=Math.floor(rand()*ARCHETYPES.length);
  ARCHETYPES[ai](ctx,size,rand,p);

  clipRounded(ctx,size);
  return canvas;
}

export function canvasToBlob(canvas){
  return new Promise(res=>canvas.toBlob(blob=>res(blob),'image/png'));
}

export function geoAvatarDataUrl(id,size=40){
  const canvas=generateGeoAvatar(size,seedFromId(id));
  return canvas.toDataURL('image/png');
}