import{Grid}from'./grid.js';
import{Simulation}from'./simulation.js';
import{Renderer}from'./renderer.js';
import{Camera}from'./camera.js';
import{SelectionManager}from'./selection.js';
import{CellType,CellProps}from'./types.js';

// ---- UI Logic ----
const setupUI=(game)=>{
  // 一時停止ボタン
  const pauseBtn=document.getElementById('btn-pause');
  pauseBtn.onclick=()=>{
    game.paused=!game.paused;
    pauseBtn.textContent=game.paused?"再開 (Play)":"一時停止 (Pause)";
  };

  // ステップ実行ボタン
  document.getElementById('btn-step').onclick=()=>{
    if(!game.paused){
      game.paused=true;
      pauseBtn.textContent="再開 (Play)";
    }
    game.sim.update();
    game.renderer.draw();
  };

  const toolbar=document.getElementById('tools');
  
  // Select Tool
  const selectBtn=document.createElement('div');
  selectBtn.className='tool-btn';
  selectBtn.textContent="範囲選択 (Select)";
  selectBtn.onclick=()=>{
    game.currentTool='SELECT';
    updateActiveBtn(selectBtn);
  };
  toolbar.appendChild(selectBtn);

  // Block Tools
  Object.keys(CellProps).forEach(key=>{
    const type=parseInt(key);
    if(type===CellType.EMPTY)return;
    const prop=CellProps[type];
    const btn=document.createElement('div');
    btn.className='tool-btn';
    btn.textContent=prop.name;
    btn.onclick=()=>{
      game.currentTool=type;
      game.activeBlockType=type;
      updateActiveBtn(btn);
    };
    toolbar.appendChild(btn);
    if(type===CellType.WALL)btn.click();
  });

  function updateActiveBtn(active){
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    active.classList.add('active');
  }

  // Buttons
  const setStatus=(msg)=>document.getElementById('status-msg').textContent=msg;

  document.getElementById('btn-save').onclick=async()=>{
    try{
      const opts={types:[{description:'Logic Sandbox File',accept:{'application/json':['.json']}}]};
      const handle=await window.showSaveFilePicker(opts);
      const writable=await handle.createWritable();
      await writable.write(game.grid.exportJSON());
      await writable.close();
      setStatus("Saved!");
    }catch(err){console.error(err);}
  };

  document.getElementById('btn-load').onclick=async()=>{
    try{
      const[handle]=await window.showOpenFilePicker();
      const file=await handle.getFile();
      const text=await file.text();
      if(game.grid.importJSON(text))setStatus("Loaded!");
    }catch(err){console.error(err);}
  };

  // 塗りつぶしボタン
  document.getElementById('btn-fill').onclick=()=>{
    game.performFill();
  };

  document.getElementById('btn-clear').onclick=()=>{
    if(confirm("全消去しますか？"))game.grid.clear();
  };
};

class Game{
  constructor(){
    this.cellSize=20;
    this.grid=new Grid(this.cellSize);
    this.sim=new Simulation(this.grid);
    
    const canvas=document.getElementById('simCanvas');
    this.camera=new Camera(canvas);
    this.renderer=new Renderer(canvas,this.grid,this.sim,this.camera);
    this.selectionMgr=new SelectionManager(this.grid);
    
    this.currentTool=CellType.WALL;
    this.activeBlockType=CellType.WALL;
    this.currentRotation=0;
    this.paused=false;
    this.altPressed=false; // Altキー押下状態
    
    this.setupInputs(canvas);
    setupUI(this);
    
    this.loop=this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  performFill(){
    if(this.selectionMgr.hasSelection()){
      const count=this.selectionMgr.fill(this.activeBlockType,this.currentRotation);
      document.getElementById('status-msg').textContent=`Filled ${count} cells with ${CellProps[this.activeBlockType].name}`;
    }else{
      document.getElementById('status-msg').textContent="Select area first!";
    }
  }

  setupInputs(canvas){
    let isRightDown=false;
    let isLeftDown=false;

    const getGridPos=(e)=>{
      const rect=canvas.getBoundingClientRect();
      const worldPos=this.camera.toWorld(e.clientX-rect.left,e.clientY-rect.top);
      return{
        x:Math.floor(worldPos.x/this.cellSize),
        y:Math.floor(worldPos.y/this.cellSize)
      };
    };

    canvas.addEventListener('mousedown',(e)=>{
      if(e.button===0)isLeftDown=true;
      if(e.button===2)isRightDown=true;
      
      const g=getGridPos(e);

      // Alt + 左ドラッグでカメラ移動開始
      if(this.altPressed&&e.button===0){
        this.camera.isDragging=true;
        this.camera.lastMouse={x:e.clientX,y:e.clientY};
        return;
      }

      // 右クリック（2本指タップ）でセル削除
      if(e.button===2){
        this.grid.setCell(g.x,g.y,CellType.EMPTY);
        e.preventDefault();
        return;
      }

      if(this.currentTool==='SELECT'&&isLeftDown){
        this.selectionMgr.startSelection(g.x,g.y);
        this.renderer.selectionStart={x:g.x,y:g.y};
        this.renderer.selectionEnd={x:g.x,y:g.y};
      }else if(isLeftDown){
        // 通常配置
        this.renderer.selectionStart=null;
        this.renderer.selectionEnd=null;
        this.selectionMgr.startPos=null;
        
        this.grid.setCell(g.x,g.y,this.currentTool,this.currentRotation);
      }
    });

    window.addEventListener('mouseup',(e)=>{
      if(e.button===0){
        isLeftDown=false;
        this.camera.isDragging=false;
      }
      if(e.button===2)isRightDown=false;
      if(this.currentTool==='SELECT')this.selectionMgr.endSelection();
    });

    canvas.addEventListener('mousemove',(e)=>{
      const g=getGridPos(e);
      
      // カメラドラッグ中（Alt + 左ドラッグ）
      if(this.camera.isDragging){
        const dx=e.clientX-this.camera.lastMouse.x;
        const dy=e.clientY-this.camera.lastMouse.y;
        this.camera.pan(dx,dy);
        this.camera.lastMouse={x:e.clientX,y:e.clientY};
        return;
      }

      if(this.currentTool==='SELECT'&&isLeftDown){
        this.selectionMgr.updateSelection(g.x,g.y);
        this.renderer.selectionEnd={x:g.x,y:g.y};
      }else if(isLeftDown&&this.currentTool!=='SELECT'){
        this.grid.setCell(g.x,g.y,this.currentTool,this.currentRotation);
      }else if(isRightDown){
        // 右ドラッグで連続削除（2本指タップしながらドラッグ）
        this.grid.setCell(g.x,g.y,CellType.EMPTY);
      }
    });

    canvas.addEventListener('wheel',(e)=>{
      e.preventDefault();
      const zoomAmount=e.deltaY>0?0.9:1.1;
      const rect=canvas.getBoundingClientRect();
      this.camera.zoom(zoomAmount,e.clientX-rect.left,e.clientY-rect.top);
    },{passive:false});

    canvas.addEventListener('contextmenu',e=>e.preventDefault());

    window.addEventListener('keydown',(e)=>{
      // Altキー押下状態を記録
      if(e.key==='Alt'){
        this.altPressed=true;
        return;
      }

      // Spaceキー：再生/停止のみ
      if(e.code==='Space'){
        e.preventDefault();
        this.paused=!this.paused;
        const pauseBtn=document.getElementById('btn-pause');
        pauseBtn.textContent=this.paused?"再開 (Play)":"一時停止 (Pause)";
        return;
      }

      // R: 回転
      if(e.key.toLowerCase()==='r'){
        this.currentRotation=(this.currentRotation+1)%4;
        document.getElementById('status-msg').textContent=`Rotation: ${['UP','RIGHT','DOWN','LEFT'][this.currentRotation]}`;
      }
      
      // F: 塗りつぶし
      if(e.key.toLowerCase()==='f'){
        this.performFill();
      }

      // Ctrl/Meta系
      if(e.ctrlKey||e.metaKey){
        if(e.key==='c'){
          const count=this.selectionMgr.copy();
          if(count)document.getElementById('status-msg').textContent="Copied!";
        }
        if(e.key==='v'){
          const center=this.camera.toWorld(canvas.width/2,canvas.height/2);
          const count=this.selectionMgr.paste(Math.floor(center.x/this.cellSize),Math.floor(center.y/this.cellSize));
          if(count)document.getElementById('status-msg').textContent="Pasted!";
        }
      }
      if(e.key==='Delete'||e.key==='Backspace'){
        this.selectionMgr.deleteSelected();
        this.renderer.selectionStart=null;
        this.renderer.selectionEnd=null;
        document.getElementById('status-msg').textContent="Deleted selection";
      }
    });

    window.addEventListener('keyup',(e)=>{
      if(e.key==='Alt'){
        this.altPressed=false;
      }
    });
    
    window.addEventListener('resize',()=>this.renderer.resize());
  }

  loop(){
    if(!this.paused){
      this.sim.update();
    }
    this.renderer.draw();
    requestAnimationFrame(this.loop);
  }
}

window.onload=()=>new Game();