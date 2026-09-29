// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';

export function createGeometries(){
 // All round parts share an XZ section, so lids and sleeves meet vertex for vertex.
 return {
  cylinder:new THREE.CylinderGeometry(1,1,1,96,12),
  tube:new THREE.CylinderGeometry(1,1,1,96,12,true),
  cap:new THREE.CircleGeometry(1,96).rotateX(-Math.PI/2),
  // Four connected faces, not overlapping planes. Matching edge vertices use
  // the same cross-section rotation, so the twist cannot open holes.
  ribbon:new THREE.BoxGeometry(6.3,2.1,2.1,192,1,1),
 };
}

export function ribbonProfile(time:number,amplitude:number,twist:number){
 const turns=time/1.15,step=Math.floor(turns),p=turns-step;
 const eased=p*p*(3-2*p);
 return {angle:Math.PI/2-Math.PI*(step+eased),
  twist:1.65*Math.sin(Math.PI*p)**2*amplitude*twist};
}

export function waveProfile(index:number,time:number,amplitude:number){
 // A continuous three-phase wave: the crest starts on the left, then passes
 // centre/right at even intervals. No pulse gates, rest or restart easing.
 const phase=(time-index)*Math.PI*2/3;
 const height=.8+1.2*amplitude*(1+Math.cos(phase));
 return {x:(index-1)*1.82,y:-2.2+height/2,height,radius:.67};
}

export function columnProfile(index:number,count:number,time:number,amplitude:number,twist:number){
 const spacing=5.45/count,radius=spacing/2,phase=time*1.9-index*.64;
 // A shared, unwrapped angle makes complete turns in one direction. Applying
 // it to the whole cylinder keeps caps rigid and adjacent tangent axes aligned.
 const roll=time*.9*twist;
 // Face-on caps hide motion when the body simultaneously flattens. Preserve
 // some depth there, and spin about the cylinder axis so its colour keeps moving.
 const facing=Math.sin(roll+Math.atan(.14))**4;
 const floor=.12+1.08*facing;
 const height=floor+(2.42+2.1*amplitude-floor)*Math.pow(.5+.5*Math.cos(phase),.85);
 const spin=roll*.5;
 return {x:(index-(count-1)/2)*spacing,radius,height,roll,spin};
}
