export class Block{
  constructor(x,y,blockType='wall',moduleData=null){
    this.x=x;
    this.y=y;
    this.blockType=blockType;
    this.moduleData=moduleData;
    this.type='block';
  }
  isWall(){
    return this.blockType==='wall';
  }
  isModule(){
    return this.blockType==='module';
  }
  processParticle(particle){
    if(this.isWall()){
      return null;
    }
    if(this.isModule()&&this.moduleData){
      const entryFace=this.getEntryFace(particle);
      const result=this.simulateModule(entryFace,particle);
      return result;
    }
    return null;
  }
  getEntryFace(particle){
    if(particle.vx>0)return'left';
    if(particle.vx<0)return'right';
    if(particle.vy>0)return'top';
    if(particle.vy<0)return'bottom';
    return'none';
  }
  simulateModule(entryFace,particle){
    return{
      exitFace:entryFace,
      vx:particle.vx,
      vy:particle.vy,
      steps:1
    };
  }
  serialize(){
    return{
      type:'block',
      x:this.x,
      y:this.y,
      blockType:this.blockType,
      moduleData:this.moduleData
    };
  }
  static deserialize(data){
    return new Block(data.x,data.y,data.blockType,data.moduleData);
  }
}