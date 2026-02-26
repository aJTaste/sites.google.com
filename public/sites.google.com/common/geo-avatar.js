// ========================================
// 幾何学アバター生成ユーティリティ
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

// Canvas要素に幾何学模様を描画して返す
export function generateGeoAvatar(size=256,seed=null){
  const canvas=document.createElement('canvas');
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext('2d');

  const rand=makeRand(seed!=null?seed:Math.floor(Math.random()*2147483647));
  const randInt=(min,max)=>Math.floor(rand()*(max-min+1))+min;
  const randColor=()=>`hsl(${randInt(0,360)},${randInt(55,85)}%,${randInt(40,65)}%)`;

  // グラデーション背景
  const grad=ctx.createLinearGradient(0,0,size,size);
  grad.addColorStop(0,randColor());
  grad.addColorStop(1,randColor());
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,size,size);

  const shapes=randInt(7,14);
  for(let i=0;i<shapes;i++){
    ctx.save();
    ctx.globalAlpha=rand()*0.5+0.25;
    ctx.fillStyle=randColor();
    ctx.strokeStyle=randColor();
    ctx.lineWidth=randInt(1,4);

    const type=randInt(0,4);
    const cx=rand()*size;
    const cy=rand()*size;
    const r=rand()*(size*0.28)+size*0.07;

    ctx.beginPath();
    if(type===0){
      ctx.arc(cx,cy,r,0,Math.PI*2);
    }else if(type===1){
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      ctx.moveTo(0,-r);
      ctx.lineTo(r*0.87,r*0.5);
      ctx.lineTo(-r*0.87,r*0.5);
      ctx.closePath();
    }else if(type===2){
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      ctx.rect(-r/2,-r/2,r,r);
    }else if(type===3){
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3;
        j===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a));
      }
      ctx.closePath();
    }else{
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      ctx.ellipse(0,0,r,r*0.45,0,0,Math.PI*2);
    }

    if(rand()>0.4)ctx.fill();
    if(rand()>0.5)ctx.stroke();
    ctx.restore();
  }

  return canvas;
}

// Canvas → Blob（アップロード用）
export function canvasToBlob(canvas){
  return new Promise(res=>canvas.toBlob(blob=>res(blob),'image/png'));
}

// IDから決定論的にdata URLを生成（表示用インライン）
// avatar_urlがnullのときのフォールバックとして各ファイルで使う
export function geoAvatarDataUrl(id,size=40){
  const canvas=generateGeoAvatar(size,seedFromId(id));
  return canvas.toDataURL('image/png');
}