export class Particle{
  constructor(x,y,mass=5){
    this.x=x;
    this.y=y;
    this.vx=0;
    this.vy=0;
    this.ax=0;
    this.ay=0;
    this.mass=mass;
    this.radius=Math.sqrt(mass)*3;
  }
  applyForce(fx,fy){
    this.ax+=fx/this.mass;
    this.ay+=fy/this.mass;
  }
  update(dt=1){
    this.vx+=this.ax*dt;
    this.vy+=this.ay*dt;
    this.x+=this.vx*dt;
    this.y+=this.vy*dt;
    this.ax=0;
    this.ay=0;
  }
  applyDamping(factor=0.99){
    this.vx*=factor;
    this.vy*=factor;
  }
  distanceTo(other){
    const dx=this.x-other.x;
    const dy=this.y-other.y;
    return Math.sqrt(dx*dx+dy*dy);
  }
  serialize(){
    return{
      x:this.x,
      y:this.y,
      vx:this.vx,
      vy:this.vy,
      mass:this.mass
    };
  }
  static deserialize(data){
    const p=new Particle(data.x,data.y,data.mass);
    p.vx=data.vx||0;
    p.vy=data.vy||0;
    return p;
  }
}