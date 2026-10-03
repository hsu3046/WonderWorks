// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {coatColor} from './squirrel-coat.ts';
import {smooth} from './landscape.ts';

/** Only the exposed cornea is modelled: the pointed aperture and lids sit on the actual cheek. */
export function addSquirrelEyes(parent:T.Group,skin:T.SkinnedMesh):void {
  const cornea=new T.MeshPhysicalMaterial({vertexColors:true,roughness:.24,ior:1.38,specularIntensity:.48,clearcoat:.12,clearcoatRoughness:.19,envMapIntensity:.75});
  const eyelid=new T.MeshStandardMaterial({vertexColors:true,roughness:.91});
  const black=new T.Color('#0b0907'),iris=new T.Color('#594020'),lidDark=new T.Color('#34281d');
  const segments=64,rings=8,point=new T.Vector3(),modelPoint=new T.Vector3(),color=new T.Color();
  skin.updateWorldMatrix(true,false);skin.skeleton.update();
  for(const sign of [-1,1]){
    const center=new T.Vector3(sign*.204,.231,-1.014),normal=new T.Vector3(sign*.90,.17,-.40).normalize();
    const ray=new T.Raycaster(center.clone().addScaledVector(normal,.4),normal.clone().negate());
    const hit=ray.intersectObject(skin,false)[0];
    if(!hit)throw new Error('The squirrel eye could not be fitted to its cheek.');
    const socket=new T.Group();socket.name=sign<0?'Left eye aperture':'Right eye aperture';socket.position.copy(hit.point);
    if(hit.normal)normal.copy(hit.normal).normalize();socket.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);parent.add(socket);
    // Follow the skull's curvature instead of placing an entire sphere outside the face.
    const outline=(angle:number,radius:number):T.Vector3=>{
      const s=Math.sin(angle),u=Math.cos(angle)*.045*radius,v=Math.sign(s)*Math.pow(Math.abs(s),1.6)*.053*radius+u*sign*.14;
      return point.set(u,v,-u*u/.43-v*v/.43);
    };
    const positions:number[]=[0,0,.009],colors:number[]=[black.r,black.g,black.b],indices:number[]=[];
    for(let r=1;r<=rings;r++)for(let j=0;j<segments;j++){
      const radius=r/rings,angle=j/segments*Math.PI*2;outline(angle,radius);point.z+=.001+.008*(1-radius*radius);point.toArray(positions,positions.length);
      const irisBand=smooth(.40,.79,radius)*(1-smooth(.86,1,radius));
      color.copy(black).lerp(iris,irisBand*(.78+Math.sin(angle*23)*.04));color.toArray(colors,colors.length);
      const a=1+(r-1)*segments+j,b=1+(r-1)*segments+(j+1)%segments;
      if(r===1)indices.push(0,a,b);else{const c=a-segments,d=b-segments;indices.push(c,a,d,d,a,b);}
    }
    const eyeGeometry=new T.BufferGeometry();eyeGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));eyeGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));eyeGeometry.setIndex(indices);eyeGeometry.computeVertexNormals();
    const eye=new T.Mesh(eyeGeometry,cornea);eye.name='Exposed cornea';socket.add(eye);

    const lidPositions:number[]=[],lidColors:number[]=[],lidIndices:number[]=[],lidRings=4;
    for(let r=0;r<=lidRings;r++)for(let j=0;j<segments;j++){
      const t=r/lidRings,angle=j/segments*Math.PI*2,upper=Math.max(0,Math.sin(angle));
      outline(angle,1+t*(.19+upper*.11));point.z+=.001+Math.sin(t*Math.PI)*(.003+upper*.004)-t*.002;
      point.toArray(lidPositions,lidPositions.length);modelPoint.copy(point).applyQuaternion(socket.quaternion).add(socket.position);
      coatColor(modelPoint,'body',color).lerp(lidDark,(1-smooth(.05,.85,t))*.62);color.toArray(lidColors,lidColors.length);
      if(r<lidRings){const a=r*segments+j,b=r*segments+(j+1)%segments,c=a+segments,d=b+segments;lidIndices.push(a,c,b,b,c,d);}
    }
    const lidGeometry=new T.BufferGeometry();lidGeometry.setAttribute('position',new T.Float32BufferAttribute(lidPositions,3));lidGeometry.setAttribute('color',new T.Float32BufferAttribute(lidColors,3));lidGeometry.setIndex(lidIndices);lidGeometry.computeVertexNormals();
    const lids=new T.Mesh(lidGeometry,eyelid);lids.name='Upper and lower eyelids';socket.add(lids);
  }
}
