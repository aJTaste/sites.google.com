export class Physics{
  constructor(){
    this.gravity=0.5;
    this.repelForce=50;
    this.repelDistance=40;
    this.damping=0.99;
    this.enableGravity=true;
    this.enableDamping=true;
    this.enableCollision=true;
  }
  applyGravity(particles){
    if(!this.enableGravity)return;
    for(const p of particles){
      p.applyForce(0,this.gravity*p.mass);
    }
  }
  applyRepulsion(particles){
    if(!this.enableCollision)return;
    for(let i=0;i<particles.length;i++){
      for(let j=i+1;j<particles.length;j++){
        const p1=particles[i];
        const p2=particles[j];
        const dist=p1.distanceTo(p2);
        const minDist=p1.radius+p2.radius;
        if(dist<this.repelDistance&&dist>0){
          const force=this.repelForce*(1-dist/this.repelDistance);
          const dx=p1.x-p2.x;
          const dy=p1.y-p2.y;
          const magnitude=Math.sqrt(dx*dx+dy*dy);
          if(magnitude>0){
            const fx=(dx/magnitude)*force;
            const fy=(dy/magnitude)*force;
            p1.applyForce(fx,fy);
            p2.applyForce(-fx,-fy);
          }
        }
        if(dist<minDist&&dist>0){
          const overlap=minDist-dist;
          const dx=p1.x-p2.x;
          const dy=p1.y-p2.y;
          const magnitude=Math.sqrt(dx*dx+dy*dy);
          if(magnitude>0){
            const nx=dx/magnitude;
            const ny=dy/magnitude;
            const pushX=nx*overlap*0.5;
            const pushY=ny*overlap*0.5;
            p1.x+=pushX;
            p1.y+=pushY;
            p2.x-=pushX;
            p2.y-=pushY;
            const relVx=p1.vx-p2.vx;
            const relVy=p1.vy-p2.vy;
            const velAlongNormal=relVx*nx+relVy*ny;
            if(velAlongNormal<0){
              const restitution=0.8;
              const impulse=(-(1+restitution)*velAlongNormal)/(1/p1.mass+1/p2.mass);
              p1.vx+=impulse*nx/p1.mass;
              p1.vy+=impulse*ny/p1.mass;
              p2.vx-=impulse*nx/p2.mass;
              p2.vy-=impulse*ny/p2.mass;
            }
          }
        }
      }
    }
  }
  applyBoundaries(particles,width,height){
    for(const p of particles){
      if(p.x-p.radius<0){
        p.x=p.radius;
        p.vx*=-0.8;
      }
      if(p.x+p.radius>width){
        p.x=width-p.radius;
        p.vx*=-0.8;
      }
      if(p.y-p.radius<0){
        p.y=p.radius;
        p.vy*=-0.8;
      }
      if(p.y+p.radius>height){
        p.y=height-p.radius;
        p.vy*=-0.8;
      }
    }
  }
  applyDamping(particles){
    if(!this.enableDamping)return;
    for(const p of particles){
      p.applyDamping(this.damping);
    }
  }
  update(particles,width,height){
    this.applyGravity(particles);
    this.applyRepulsion(particles);
    for(const p of particles){
      p.update();
    }
    this.applyBoundaries(particles,width,height);
    this.applyDamping(particles);
  }
}