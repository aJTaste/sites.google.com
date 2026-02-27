// ========================================
// Identicon アバター生成ユーティリティ
// ========================================

// UUIDなどの文字列を数値シードに変換
export function seedFromId(id){
  if(!id)return 1;
  let n=0;
  for(let i=0;i<Math.min(id.length,16);i++){
    n=(n*31+id.charCodeAt(i))%2147483647;
  }
  return n||1;
}

// シードベース疑似乱数（同じシード→同じ結果）
function makeRand(seed){
  let s=seed;
  return()=>{
    s=(s*16807+0)%2147483647;
    return(s-1)/2147483646;
  };
}

// Canvas要素にIdenticonを描画して返す
// 5x5グリッドを左右対称に生成 → パッと見で明確に区別できる
export function generateGeoAvatar(size=256,seed=null){
  const canvas=document.createElement('canvas');
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext('2d');

  const rand=makeRand(seed!=null?seed:Math.floor(Math.random()*2147483647));

  // ── 色をシードから決定 ──
  const hue=Math.floor(rand()*360);
  // 背景：彩度低め・明るめ
  const bgL=Math.floor(rand()*15)+82; // 82〜96%
  const bgS=Math.floor(rand()*20)+10; // 10〜30%
  // 前景：彩度高め・中程度の明度
  const fgL=Math.floor(rand()*20)+35; // 35〜55%
  const fgS=Math.floor(rand()*20)+60; // 60〜80%
  // アクセント色（前景の補色寄り）
  const accentHue=(hue+150+Math.floor(rand()*60))%360;

  const bgColor=`hsl(${hue},${bgS}%,${bgL}%)`;
  const fgColor=`hsl(${hue},${fgS}%,${fgL}%)`;
  const accentColor=`hsl(${accentHue},${fgS}%,${fgL}%)`;

  // ── 背景 ──
  const pad=Math.round(size*0.06);
  const radius=Math.round(size*0.18);

  // 角丸背景
  ctx.fillStyle=bgColor;
  ctx.beginPath();
  ctx.moveTo(radius,0);
  ctx.lineTo(size-radius,0);
  ctx.quadraticCurveTo(size,0,size,radius);
  ctx.lineTo(size,size-radius);
  ctx.quadraticCurveTo(size,size,size-radius,size);
  ctx.lineTo(radius,size);
  ctx.quadraticCurveTo(0,size,0,size-radius);
  ctx.lineTo(0,radius);
  ctx.quadraticCurveTo(0,0,radius,0);
  ctx.closePath();
  ctx.fill();

  // ── 5x5グリッド（左右対称）──
  // 列 0,1,2 を rand で決定 → 列 4=0, 3=1 にミラー
  const COLS=5;
  const ROWS=5;
  const cellW=(size-pad*2)/COLS;
  const cellH=(size-pad*2)/ROWS;
  const cellPad=Math.round(cellW*0.12);

  // グリッドON/OFF: 3列×5行 = 15ビット
  const grid=[];
  for(let r=0;r<ROWS;r++){
    grid[r]=[];
    for(let c=0;c<3;c++){
      grid[r][c]=rand()>0.42; // 少し密度高め
    }
    // ミラー
    grid[r][3]=grid[r][1];
    grid[r][4]=grid[r][0];
  }

  // 中央列のみアクセント色で描画するか判定
  const useAccent=rand()>0.5;

  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(!grid[r][c])continue;

      const isCenter=(c===2);
      ctx.fillStyle=(isCenter&&useAccent)?accentColor:fgColor;

      const x=pad+c*cellW+cellPad;
      const y=pad+r*cellH+cellPad;
      const w=cellW-cellPad*2;
      const h=cellH-cellPad*2;
      const cr=Math.round(w*0.22);

      // セルも角丸
      ctx.beginPath();
      ctx.moveTo(x+cr,y);
      ctx.lineTo(x+w-cr,y);
      ctx.quadraticCurveTo(x+w,y,x+w,y+cr);
      ctx.lineTo(x+w,y+h-cr);
      ctx.quadraticCurveTo(x+w,y+h,x+w-cr,y+h);
      ctx.lineTo(x+cr,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-cr);
      ctx.lineTo(x,y+cr);
      ctx.quadraticCurveTo(x,y,x+cr,y);
      ctx.closePath();
      ctx.fill();
    }
  }

  return canvas;
}

// Canvas → Blob（アップロード用）
export function canvasToBlob(canvas){
  return new Promise(res=>canvas.toBlob(blob=>res(blob),'image/png'));
}

// IDから決定論的にdata URLを生成（表示用インライン）
export function geoAvatarDataUrl(id,size=40){
  const canvas=generateGeoAvatar(size,seedFromId(id));
  return canvas.toDataURL('image/png');
}