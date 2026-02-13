import{Serializer}from'../utils/Serializer.js';
export class Editor{
  constructor(engine){
    this.engine=engine;
    this.selectedTool='particle-right';
    this.modules=[];
    this.selectedModule=null;
    this.isDrawing=false;
    this.init();
  }
  init(){
    this.setupCanvas();
    this.setupTools();
    this.setupControls();
    this.setupDataActions();
    this.updateUI();
  }
  setupCanvas(){
    this.engine.canvas.addEventListener('mousedown',e=>{
      this.isDrawing=true;
      this.handleCanvasClick(e);
    });
    this.engine.canvas.addEventListener('mousemove',e=>{
      if(this.isDrawing){
        this.handleCanvasClick(e);
      }
    });
    this.engine.canvas.addEventListener('mouseup',()=>{
      this.isDrawing=false;
    });
    this.engine.canvas.addEventListener('mouseleave',()=>{
      this.isDrawing=false;
    });
  }
  handleCanvasClick(e){
    const pos=this.engine.getGridPosition(e.clientX,e.clientY);
    if(!this.engine.grid.isValidPosition(pos.x,pos.y))return;
    if(this.selectedTool==='erase'){
      this.engine.grid.removeCell(pos.x,pos.y);
    }else if(this.selectedTool==='wall'){
      this.engine.grid.removeCell(pos.x,pos.y);
      this.engine.grid.addBlock(pos.x,pos.y,'wall');
    }else if(this.selectedTool.startsWith('particle-')){
      const dir=this.selectedTool.split('-')[1];
      let vx=0,vy=0;
      if(dir==='right')vx=1;
      else if(dir==='left')vx=-1;
      else if(dir==='down')vy=1;
      else if(dir==='up')vy=-1;
      this.engine.grid.removeCell(pos.x,pos.y);
      this.engine.grid.addParticle(pos.x,pos.y,vx,vy);
    }else if(this.selectedTool==='module'&&this.selectedModule){
      this.engine.grid.removeCell(pos.x,pos.y);
      this.engine.grid.addBlock(pos.x,pos.y,'module',this.selectedModule);
    }
    this.engine.render();
  }
  setupTools(){
    const toolBtns=document.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn=>{
      btn.addEventListener('click',()=>{
        toolBtns.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTool=btn.dataset.tool;
        this.updateSelectedToolDisplay();
      });
    });
  }
  setupControls(){
    document.getElementById('playBtn').addEventListener('click',()=>{
      this.engine.start();
      this.updateControlButtons();
    });
    document.getElementById('pauseBtn').addEventListener('click',()=>{
      this.engine.pause();
      this.updateControlButtons();
    });
    document.getElementById('stepBtn').addEventListener('click',()=>{
      this.engine.step();
      this.updateUI();
    });
    document.getElementById('resetBtn').addEventListener('click',()=>{
      this.engine.reset();
      this.updateUI();
    });
  }
  setupDataActions(){
    document.getElementById('saveBtn').addEventListener('click',()=>{
      const name=document.getElementById('moduleName').value||'Untitled';
      Serializer.downloadModule(name,this.engine.grid);
    });
    document.getElementById('loadModuleBtn').addEventListener('click',()=>{
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change',e=>{
      const file=e.target.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{
          const moduleData=Serializer.importModule(ev.target.result);
          const validation=Serializer.validateModule(moduleData);
          if(!validation.valid){
            alert('Invalid module: '+validation.error);
            return;
          }
          this.modules.push(moduleData);
          this.updateModuleList();
        }catch(err){
          alert('Failed to load module: '+err.message);
        }
      };
      reader.readAsText(file);
      e.target.value='';
    });
  }
  updateModuleList(){
    const list=document.getElementById('moduleList');
    if(this.modules.length===0){
      list.innerHTML='<p class="empty-text">モジュールがありません</p>';
      return;
    }
    list.innerHTML='';
    this.modules.forEach((mod,idx)=>{
      const item=document.createElement('div');
      item.className='module-item';
      if(this.selectedModule===mod){
        item.classList.add('active');
      }
      item.innerHTML=`
        <div class="module-name">${mod.name}</div>
        <div class="module-info">Version: ${mod.version}</div>
      `;
      item.addEventListener('click',()=>{
        this.selectedModule=mod;
        this.selectedTool='module';
        document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
        this.updateModuleList();
        this.updateSelectedToolDisplay();
      });
      list.appendChild(item);
    });
  }
  updateUI(){
    document.getElementById('tickCount').textContent=this.engine.tickCount;
  }
  updateControlButtons(){
    document.getElementById('playBtn').disabled=this.engine.isRunning;
    document.getElementById('pauseBtn').disabled=!this.engine.isRunning;
  }
  updateSelectedToolDisplay(){
    const toolNames={
      'particle-right':'粒子（右）',
      'particle-down':'粒子（下）',
      'particle-left':'粒子（左）',
      'particle-up':'粒子（上）',
      'wall':'壁',
      'erase':'消しゴム',
      'module':'モジュール'
    };
    document.getElementById('selectedTool').textContent=toolNames[this.selectedTool]||this.selectedTool;
  }
  startUpdateLoop(){
    setInterval(()=>{
      if(this.engine.isRunning){
        this.updateUI();
      }
    },100);
  }
}