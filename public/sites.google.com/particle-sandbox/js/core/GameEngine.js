import{Grid}from'./Grid.js';
export class GameEngine{
  constructor(canvas){
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.grid=new Grid();
    this.isRunning=false;
    this.tickCount=0;
    this.cellSize=canvas.width/this.grid.size;
    this.tickRate=200;
    this.lastTick=0;
    this.initialState=null;
  }
  start(){
    if(!this.isRunning){
      this.isRunning=true;
      this.saveInitialState();
      this.loop();
    }
  }
  pause(){
    this.isRunning=false;
  }
  step(){
    this.tick();
    this.render();
  }
  reset(){
    this.pause();
    this.tickCount=0;
    if(this.initialState){
      this.grid.deserialize(this.initialState);
    }
    this.render();
  }
  saveInitialState(){
    this.initialState=this.grid.serialize();
  }
  tick(){
    this.grid.updateParticles();
    this.tickCount++;
  }
  loop(){
    if(!this.isRunning)return;
    const now=Date.now();
    if(now-this.lastTick>=this.tickRate){
      this.tick();
      this.render();
      this.lastTick=now;
    }
    requestAnimationFrame(()=>this.loop());
  }
  render(){
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.drawGrid();
    this.drawBlocks();
    this.drawParticles();
  }
  drawGrid(){
    this.ctx.strokeStyle='#1e2433';
    this.ctx.lineWidth=1;
    for(let i=0;i<=this.grid.size;i++){
      const pos=i*this.cellSize;
      this.ctx.beginPath();
      this.ctx.moveTo(pos,0);
      this.ctx.lineTo(pos,this.canvas.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0,pos);
      this.ctx.lineTo(this.canvas.width,pos);
      this.ctx.stroke();
    }
  }
  drawBlocks(){
    for(const block of this.grid.blocks){
      const x=block.x*this.cellSize;
      const y=block.y*this.cellSize;
      if(block.isWall()){
        this.ctx.fillStyle='#4a5568';
        this.ctx.fillRect(x+2,y+2,this.cellSize-4,this.cellSize-4);
        this.ctx.strokeStyle='#6b7280';
        this.ctx.lineWidth=2;
        this.ctx.strokeRect(x+2,y+2,this.cellSize-4,this.cellSize-4);
      }else if(block.isModule()){
        const gradient=this.ctx.createLinearGradient(x,y,x+this.cellSize,y+this.cellSize);
        gradient.addColorStop(0,'#00ffff44');
        gradient.addColorStop(1,'#ff00ff44');
        this.ctx.fillStyle=gradient;
        this.ctx.fillRect(x+2,y+2,this.cellSize-4,this.cellSize-4);
        this.ctx.strokeStyle='#00ffff';
        this.ctx.lineWidth=2;
        this.ctx.strokeRect(x+2,y+2,this.cellSize-4,this.cellSize-4);
        this.ctx.fillStyle='#00ffff';
        this.ctx.font='12px Orbitron';
        this.ctx.textAlign='center';
        this.ctx.textBaseline='middle';
        this.ctx.fillText('M',x+this.cellSize/2,y+this.cellSize/2);
      }
    }
  }
  drawParticles(){
    for(const particle of this.grid.particles){
      const x=particle.x*this.cellSize+this.cellSize/2;
      const y=particle.y*this.cellSize+this.cellSize/2;
      const radius=this.cellSize/4;
      this.ctx.fillStyle='#ff00ff';
      this.ctx.beginPath();
      this.ctx.arc(x,y,radius,0,Math.PI*2);
      this.ctx.fill();
      this.ctx.strokeStyle='#ff00ffaa';
      this.ctx.lineWidth=2;
      this.ctx.stroke();
      const arrowLen=this.cellSize/3;
      const arrowX=x+particle.vx*arrowLen;
      const arrowY=y+particle.vy*arrowLen;
      this.ctx.strokeStyle='#ffff00';
      this.ctx.lineWidth=2;
      this.ctx.beginPath();
      this.ctx.moveTo(x,y);
      this.ctx.lineTo(arrowX,arrowY);
      this.ctx.stroke();
      const angle=Math.atan2(particle.vy,particle.vx);
      const headLen=8;
      this.ctx.beginPath();
      this.ctx.moveTo(arrowX,arrowY);
      this.ctx.lineTo(arrowX-headLen*Math.cos(angle-Math.PI/6),arrowY-headLen*Math.sin(angle-Math.PI/6));
      this.ctx.moveTo(arrowX,arrowY);
      this.ctx.lineTo(arrowX-headLen*Math.cos(angle+Math.PI/6),arrowY-headLen*Math.sin(angle+Math.PI/6));
      this.ctx.stroke();
    }
  }
  getGridPosition(canvasX,canvasY){
    const rect=this.canvas.getBoundingClientRect();
    const scaleX=this.canvas.width/rect.width;
    const scaleY=this.canvas.height/rect.height;
    const x=Math.floor((canvasX-rect.left)*scaleX/this.cellSize);
    const y=Math.floor((canvasY-rect.top)*scaleY/this.cellSize);
    return{x,y};
  }
}