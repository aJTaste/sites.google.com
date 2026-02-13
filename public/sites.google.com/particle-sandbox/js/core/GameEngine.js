import{Particle}from'../entities/Particle.js';
import{Physics}from'./Physics.js';
export class GameEngine{
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.width=canvas.width;
    this.height=canvas.height;
    this.gridSize=8;
    this.cellSize=this.width/this.gridSize;
    this.particles=[];
    this.physics=new Physics();
    this.isRunning=false;
    this.tickCount=0;
    this.placementMass=5;
    this.mode='particle';
    this.selectedObject=null;
    this.previewPosition=null;
  }
  start(){
    this.isRunning=true;
    this.loop();
  }
  pause(){
    this.isRunning=false;
  }
  clear(){
    this.particles=[];
    this.tickCount=0;
    this.render();
  }
  setMode(mode,objectData=null){
    this.mode=mode;
    this.selectedObject=objectData;
  }
  loop(){
    if(!this.isRunning)return;
    this.update();
    this.render();
    this.tickCount++;
    requestAnimationFrame(()=>this.loop());
  }
  update(){
    this.physics.update(this.particles,this.width,this.height);
  }
  render(){
    this.ctx.fillStyle='#fff';
    this.ctx.fillRect(0,0,this.width,this.height);
    this.drawGrid();
    this.drawParticles();
    if(this.mode==='object'&&this.previewPosition){
      this.drawObjectPreview();
    }
  }
  drawGrid(){
    this.ctx.strokeStyle='#ddd';
    this.ctx.lineWidth=1;
    for(let i=0;i<=this.gridSize;i++){
      const pos=i*this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pos,0);
      this.ctx.lineTo(pos,this.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0,pos);
      this.ctx.lineTo(this.width,pos);
      this.ctx.stroke();
    }
  }
  drawParticles(){
    for(const p of this.particles){
      this.ctx.fillStyle='#000';
      this.ctx.beginPath();
      this.ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
      this.ctx.fill();
      const speed=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
      if(speed>0.5){
        this.ctx.strokeStyle='#666';
        this.ctx.lineWidth=2;
        this.ctx.beginPath();
        this.ctx.moveTo(p.x,p.y);
        this.ctx.lineTo(p.x+p.vx*2,p.y+p.vy*2);
        this.ctx.stroke();
      }
    }
  }
  drawObjectPreview(){
    if(!this.selectedObject||!this.previewPosition)return;
    const{x,y}=this.previewPosition;
    this.ctx.save();
    this.ctx.globalAlpha=0.5;
    if(this.selectedObject.particles){
      for(const pData of this.selectedObject.particles){
        this.ctx.fillStyle='#666';
        const px=x*this.cellSize+this.cellSize/2+(pData.x-300);
        const py=y*this.cellSize+this.cellSize/2+(pData.y-300);
        const radius=Math.sqrt(pData.mass)*3;
        this.ctx.beginPath();
        this.ctx.arc(px,py,radius,0,Math.PI*2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
    this.ctx.strokeStyle='#000';
    this.ctx.lineWidth=2;
    this.ctx.setLineDash([5,5]);
    this.ctx.strokeRect(x*this.cellSize,y*this.cellSize,this.cellSize,this.cellSize);
    this.ctx.setLineDash([]);
  }
  getGridPosition(clientX,clientY){
    const rect=this.canvas.getBoundingClientRect();
    const scaleX=this.width/rect.width;
    const scaleY=this.height/rect.height;
    const x=Math.floor((clientX-rect.left)*scaleX/this.cellSize);
    const y=Math.floor((clientY-rect.top)*scaleY/this.cellSize);
    return{x,y};
  }
  getCellCenter(gridX,gridY){
    return{
      x:gridX*this.cellSize+this.cellSize/2,
      y:gridY*this.cellSize+this.cellSize/2
    };
  }
  addParticle(gridX,gridY){
    if(gridX<0||gridX>=this.gridSize||gridY<0||gridY>=this.gridSize)return;
    const pos=this.getCellCenter(gridX,gridY);
    const particle=new Particle(pos.x,pos.y,this.placementMass);
    this.particles.push(particle);
    this.render();
  }
  placeObject(gridX,gridY,objectData){
    if(gridX<0||gridX>=this.gridSize||gridY<0||gridY>=this.gridSize)return;
    if(!objectData||!objectData.particles)return;
    const centerPos=this.getCellCenter(gridX,gridY);
    const offsetX=centerPos.x-300;
    const offsetY=centerPos.y-300;
    for(const pData of objectData.particles){
      const particle=new Particle(pData.x+offsetX,pData.y+offsetY,pData.mass);
      particle.vx=pData.vx||0;
      particle.vy=pData.vy||0;
      this.particles.push(particle);
    }
    this.render();
  }
  serialize(){
    return{
      particles:this.particles.map(p=>p.serialize()),
      physics:{
        gravity:this.physics.gravity,
        repelForce:this.physics.repelForce,
        damping:this.physics.damping,
        enableGravity:this.physics.enableGravity,
        enableDamping:this.physics.enableDamping,
        enableCollision:this.physics.enableCollision
      },
      timestamp:new Date().toISOString()
    };
  }
  deserialize(data){
    this.clear();
    if(data.particles){
      this.particles=data.particles.map(p=>Particle.deserialize(p));
    }
    if(data.physics){
      this.physics.gravity=data.physics.gravity||0.5;
      this.physics.repelForce=data.physics.repelForce||50;
      this.physics.damping=data.physics.damping||0.99;
      this.physics.enableGravity=data.physics.enableGravity!==false;
      this.physics.enableDamping=data.physics.enableDamping!==false;
      this.physics.enableCollision=data.physics.enableCollision!==false;
    }
    this.render();
  }
}