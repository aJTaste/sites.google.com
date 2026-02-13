import{FileSystem}from'../utils/FileSystem.js';
export class UI{
  constructor(engine){
    this.engine=engine;
    this.init();
  }
  init(){
    this.setupCanvas();
    this.setupButtons();
    this.setupSliders();
    this.setupCheckboxes();
    this.startUpdateLoop();
  }
  setupCanvas(){
    this.engine.canvas.addEventListener('click',e=>{
      const pos=this.engine.getGridPosition(e.clientX,e.clientY);
      this.engine.addParticle(pos.x,pos.y);
      this.updateInfo();
    });
  }
  setupButtons(){
    document.getElementById('playBtn').addEventListener('click',()=>{
      this.engine.start();
    });
    document.getElementById('pauseBtn').addEventListener('click',()=>{
      this.engine.pause();
    });
    document.getElementById('clearBtn').addEventListener('click',()=>{
      this.engine.clear();
      this.updateInfo();
    });
    document.getElementById('saveBtn').addEventListener('click',async()=>{
      const data=this.engine.serialize();
      const success=await FileSystem.save(data);
      if(success){
        console.log('Saved successfully');
      }
    });
    document.getElementById('loadBtn').addEventListener('click',async()=>{
      const data=await FileSystem.load();
      if(data){
        this.engine.deserialize(data);
        this.updateSlidersFromEngine();
        this.updateCheckboxesFromEngine();
        this.updateInfo();
        console.log('Loaded successfully');
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
  updateSlidersFromEngine(){
    document.getElementById('massSlider').value=this.engine.placementMass;
    document.getElementById('massValue').textContent=this.engine.placementMass;
    document.getElementById('repelSlider').value=this.engine.physics.repelForce;
    document.getElementById('repelValue').textContent=this.engine.physics.repelForce;
  }
  updateCheckboxesFromEngine(){
    document.getElementById('gravityCheck').checked=this.engine.physics.enableGravity;
    document.getElementById('dampingCheck').checked=this.engine.physics.enableDamping;
    document.getElementById('collisionCheck').checked=this.engine.physics.enableCollision;
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