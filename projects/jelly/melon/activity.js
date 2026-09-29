// SPDX-License-Identifier: GPL-3.0-only
// Contact detection still includes sleeping bodies. Only integration/surface work sleeps.
export class PieceActivity {
 constructor(body){this.body=body;this.sleeping=false;this.quiet=0;this.dirty=true;}
 wake(){this.sleeping=false;this.quiet=0;this.dirty=true;}
 step(dt){
  if(this.body.grab)this.wake();
  if(this.sleeping)return;
  this.body.step(dt);this.dirty=true;
  let speed2=0,max2=0;const v=this.body.v;
  for(let i=0;i<v.length;i+=3){const s=v[i]*v[i]+v[i+1]*v[i+1]+v[i+2]*v[i+2];speed2+=s;max2=Math.max(max2,s);}
  if(!this.body.grab&&speed2/(v.length/3)<.006*.006&&max2<.025*.025)this.quiet+=dt;else this.quiet=0;
  if(this.quiet>=1.5){this.sleeping=true;v.fill(0);this.body.previous.set(this.body.p);}
 }
}
