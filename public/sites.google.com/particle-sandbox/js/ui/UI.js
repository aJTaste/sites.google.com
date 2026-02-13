import{DirectoryManager}from'../utils/DirectoryManager.js';
export class UI{
  constructor(engine){
    this.engine=engine;
    this.dirManager=new DirectoryManager();
    this.objectCache=[];
    this.init();
  }
  init(){
    this.setupCanvas();
    this.setupButtons();
    this.setupSliders();
    this.setupCheckboxes();
    this.setupFolderManagement();
    this.startUpdateLoop();
  }
  setupCanvas(){
    this.engine.canvas.addEventListener('click',e=>{
      const pos=this.engine.getGridPosition(e.clientX,e.clientY);
      if(this.engine.mode==='particle'){
        this.engine.addParticle(pos.x,pos.y);
      }else if(this.engine.mode==='object'&&this.engine.selectedObject){
        this.engine.placeObject(pos.x,pos.y,this.engine.selectedObject);
      }
      this.updateInfo();
    });
    this.engine.canvas.addEventListener('mousemove',e=>{
      if(this.engine.mode==='object'){
        const pos=this.engine.getGridPosition(e.clientX,e.clientY);
        this.engine.previewPosition=pos;
        this.engine.render();
      }
    });
    this.engine.canvas.addEventListener('mouseleave',()=>{
      this.engine.previewPosition=null;
      this.engine.render();
    });
  }
  setupFolderManagement(){
    document.getElementById('selectFolderBtn').addEventListener('click',async()=>{
      const success=await this.dirManager.selectFolder();
      if(success){
        this.updateFolderStatus();
        await this.refreshObjectList();
        document.getElementById('saveObjectBtn').disabled=false;
      }
    });
    document.getElementById('saveObjectBtn').addEventListener('click',async()=>{
      const name=document.getElementById('objectName').value.trim();
      if(!name){
        alert('オブジェクト名を入力してください');
        return;
      }
      const data=this.engine.serialize();
      const success=await this.dirManager.saveObject(name,data);
      if(success){
        await this.refreshObjectList();
        document.getElementById('objectName').value='';
      }
    });
  }
  async refreshObjectList(){
    const objects=await this.dirManager.listObjects();
    this.objectCache=objects;
    this.renderObjectList();
  }
  renderObjectList(){
    const listEl=document.getElementById('objectList');
    if(this.objectCache.length===0){
      listEl.innerHTML='<div class="empty-msg">オブジェクトがありません</div>';
      return;
    }
    listEl.innerHTML='';
    for(const obj of this.objectCache){
      const item=document.createElement('div');
      item.className='object-item';
      item.innerHTML=`
        <div class="object-name">${obj.name}</div>
        <div class="object-info">粒子数: ${obj.particleCount} | ${new Date(obj.timestamp).toLocaleString('ja-JP')}</div>
      `;
      item.addEventListener('click',async()=>{
        const data=await this.dirManager.loadObject(obj.fileName);
        if(data&&data.data){
          this.engine.setMode('object',data.data);
          this.updateModeDisplay();
          document.querySelectorAll('.object-item').forEach(el=>el.classList.remove('selected'));
          item.classList.add('selected');
        }
      });
      listEl.appendChild(item);
    }
  }
  updateFolderStatus(){
    const statusEl=document.getElementById('folderStatus');
    if(this.dirManager.isConnected){
      statusEl.textContent=`接続中: ${this.dirManager.getFolderName()}`;
      statusEl.classList.add('connected');
    }else{
      statusEl.textContent='未設定';
      statusEl.classList.remove('connected');
    }
  }
  updateModeDisplay(){
    const modeEl=document.getElementById('modeInfo');
    if(this.engine.mode==='particle'){
      modeEl.textContent='モード: 粒子配置';
    }else if(this.engine.mode==='object'){
      modeEl.textContent='モード: オブジェクト配置';
    }
  }
  setupButtons(){
    document.getElementById('playBtn').addEventListener('click',()=>{
      this.engine.start();
    });
    document.getElementById('pauseBtn').addEventListener('click',()=>{
      this.engine.pause();
    });
    document.getElementById('clearBtn').addEventListener('click',()=>{
      if(confirm('すべての粒子を消去しますか？')){
        this.engine.clear();
        this.engine.setMode('particle');
        this.updateModeDisplay();
        document.querySelectorAll('.object-item').forEach(el=>el.classList.remove('selected'));
        this.updateInfo();
      }
    });
  }
  setupSliders(){
    const massSlider=document.getElementById('massSlider');
    const massValue=document.getElementById('massValue');
    massSlider.addEventListener('input',()=>{
      this.engine.placementMass=parseInt(massSlider.value);
      massValue.textContent=massSlider.value;
    });
    const repelSlider=document.getElementById('repelSlider');
    const repelValue=document.getElementById('repelValue');
    repelSlider.addEventListener('input',()=>{
      this.engine.physics.repelForce=parseInt(repelSlider.value);
      repelValue.textContent=repelSlider.value;
    });
  }
  setupCheckboxes(){
    document.getElementById('gravityCheck').addEventListener('change',e=>{
      this.engine.physics.enableGravity=e.target.checked;
    });
    document.getElementById('dampingCheck').addEventListener('change',e=>{
      this.engine.physics.enableDamping=e.target.checked;
    });
    document.getElementById('collisionCheck').addEventListener('change',e=>{
      this.engine.physics.enableCollision=e.target.checked;
    });
  }
  updateInfo(){
    document.getElementById('particleCount').textContent=this.engine.particles.length;
    document.getElementById('tickCount').textContent=this.engine.tickCount;
  }
  startUpdateLoop(){
    setInterval(()=>{
      this.updateInfo();
    },100);
  }
}