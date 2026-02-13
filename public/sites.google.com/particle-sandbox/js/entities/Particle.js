export class Particle{
  constructor(x,y,vx,vy){
    this.x=x;
    this.y=y;
    this.vx=vx;
    this.vy=vy;
    this.type='particle';
  }
  move(){
    this.x+=this.vx;
    this.y+=this.vy;
  }
  reflect(axis){
    if(axis==='x'){
      this.vx=-this.vx;
    }else if(axis==='y'){
      this.vy=-this.vy;
    }
  }
  rotate90(){
    const temp=this.vx;
    this.vx=-this.vy;
    this.vy=temp;
  }
  clone(){
    return new Particle(this.x,this.y,this.vx,this.vy);
  }
  serialize(){
    return{
      type:'particle',
      x:this.x,
      y:this.y,
      vx:this.vx,
      vy:this.vy
    };
  }
  static deserialize(data){
    return new Particle(data.x,data.y,data.vx,data.vy);
  }
}