import{Particle}from'../entities/Particle.js';
import{Block}from'../entities/Block.js';
export class Grid{
  constructor(){
    this.size=8;
    this.cells=[];
    this.particles=[];
    this.blocks=[];
    this.init();
  }
  init(){
    this.cells=Array(this.size).fill(null).map(()=>Array(this.size).fill(null));
    this.particles=[];
    this.blocks=[];
  }
  clear(){
    this.init();
  }
  isValidPosition(x,y){
    return x>=0&&x<this.size&&y>=0&&y<this.size;
  }
  getCell(x,y){
    if(!this.isValidPosition(x,y))return null;
    return this.cells[y][x];
  }
  setCell(x,y,entity){
    if(!this.isValidPosition(x,y))return false;
    this.cells[y][x]=entity;
    if(entity){
      if(entity.type==='particle'){
        if(!this.particles.includes(entity)){
          this.particles.push(entity);
        }
      }else if(entity.type==='block'){
        if(!this.blocks.includes(entity)){
          this.blocks.push(entity);
        }
      }
    }
    return true;
  }
  removeCell(x,y){
    if(!this.isValidPosition(x,y))return false;
    const entity=this.cells[y][x];
    if(entity){
      if(entity.type==='particle'){
        const idx=this.particles.indexOf(entity);
        if(idx>-1)this.particles.splice(idx,1);
      }else if(entity.type==='block'){
        const idx=this.blocks.indexOf(entity);
        if(idx>-1)this.blocks.splice(idx,1);
      }
    }
    this.cells[y][x]=null;
    return true;
  }
  addParticle(x,y,vx,vy){
    const particle=new Particle(x,y,vx,vy);
    this.setCell(x,y,particle);
    return particle;
  }
  addBlock(x,y,blockType='wall',moduleData=null){
    const block=new Block(x,y,blockType,moduleData);
    this.setCell(x,y,block);
    return block;
  }
  updateParticles(){
    const newParticles=[];
    for(const particle of this.particles){
      this.cells[particle.y][particle.x]=null;
      const nextX=particle.x+particle.vx;
      const nextY=particle.y+particle.vy;
      if(!this.isValidPosition(nextX,nextY)){
        if(nextX<0||nextX>=this.size){
          particle.reflect('x');
        }
        if(nextY<0||nextY>=this.size){
          particle.reflect('y');
        }
        newParticles.push(particle);
        continue;
      }
      const target=this.getCell(nextX,nextY);
      if(target===null){
        particle.move();
        newParticles.push(particle);
      }else if(target.type==='block'){
        if(target.isWall()){
          if(Math.abs(particle.vx)>0){
            particle.reflect('x');
          }else{
            particle.reflect('y');
          }
          newParticles.push(particle);
        }else if(target.isModule()){
          particle.move();
          newParticles.push(particle);
        }
      }
    }
    this.particles=newParticles;
    for(const particle of this.particles){
      if(this.isValidPosition(particle.x,particle.y)){
        this.cells[particle.y][particle.x]=particle;
      }
    }
  }
  serialize(){
    const gridData=[];
    for(let y=0;y<this.size;y++){
      for(let x=0;x<this.size;x++){
        const cell=this.cells[y][x];
        if(cell){
          gridData.push(cell.serialize());
        }else{
          gridData.push({type:'empty',x,y});
        }
      }
    }
    return gridData;
  }
  deserialize(gridData){
    this.clear();
    for(const cellData of gridData){
      if(cellData.type==='particle'){
        const p=Particle.deserialize(cellData);
        this.setCell(p.x,p.y,p);
      }else if(cellData.type==='block'){
        const b=Block.deserialize(cellData);
        this.setCell(b.x,b.y,b);
      }
    }
  }
}