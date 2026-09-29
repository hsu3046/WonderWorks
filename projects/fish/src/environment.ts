import { nativeShader } from './native-shader';
// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { BackSide, DoubleSide, IcosahedronGeometry, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, Scene, SphereGeometry } from 'three/webgpu';
import { Fn, float, instanceIndex, normalWorld, positionLocal, positionWorld, sin, smoothstep, uv, vec3 } from 'three/tsl';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { grassGeometry, seabedHeight } from './geometry';
import { randomGenerator, type OceanUniforms } from './shared';
import { oceanShade, rockShade, terrainShade, waterFog } from './shaders';

const grassShade=nativeShader<'vec3'>(`
fn grassShade(p: vec3<f32>, eye: vec3<f32>, height: f32, fog: f32) -> vec3<f32> {
  let color=mix(vec3<f32>(.008,.075,.07),vec3<f32>(.055,.29,.18),height);
  return waterFog(color,p,eye,fog);
}`, [waterFog]);

export function createEnvironment(scene:Scene,u:OceanUniforms) {
  const random=randomGenerator(2671), dummy=new Object3D();
  const skyMaterial=new MeshBasicNodeMaterial({side:BackSide,depthWrite:false});
  skyMaterial.colorNode=oceanShade({p:positionWorld,eye:u.eye,t:u.time,strength:u.rays});
  const sky=new Mesh(new SphereGeometry(160,32,16),skyMaterial);sky.renderOrder=-10;scene.add(sky);

  const floorGeometry=new PlaneGeometry(600,600,100,100);floorGeometry.rotateX(-Math.PI/2);
  const p=floorGeometry.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setY(i,seabedHeight(p.getX(i),p.getZ(i)));
  floorGeometry.computeVertexNormals();
  const floorMaterial=new MeshBasicNodeMaterial();
  floorMaterial.colorNode=terrainShade({p:positionWorld,normal:normalWorld,eye:u.eye,t:u.time,strength:u.caustics,fog:u.fog,rock:float(0)});
  scene.add(new Mesh(floorGeometry,floorMaterial));

  const stoneMaterial=new MeshBasicNodeMaterial();
  stoneMaterial.colorNode=rockShade({p:positionWorld,normal:normalWorld,eye:u.eye,t:u.time,strength:u.caustics,fog:u.fog});
  const rocks:Array<{x:number;z:number;size:number}>=[];
  for(let i=0;i<32;i++){
    const x=i===0?6:i===1?10:(random()-.5)*65;
    const z=i===0?10:i===1?3:(random()-.5)*55;
    const size=i===0?3.1:.65+random()*2.5;
    const source=new IcosahedronGeometry(1,3);
    // Weld before recomputing normals, avoiding a separate flat normal on every triangle.
    source.deleteAttribute('normal');source.deleteAttribute('uv');
    const geometry=mergeVertices(source);source.dispose();
    const vertices=geometry.getAttribute('position');
    for(let j=0;j<vertices.count;j++){
      const x=vertices.getX(j),y=vertices.getY(j),z=vertices.getZ(j);
      const phase=i*2.399;
      const rough=1+.15*Math.sin(x*3.7+y*2.3+phase)*Math.cos(z*3.1-phase)
        +.065*Math.sin(x*7.3-y*5.1+z*4.7+phase);
      vertices.setXYZ(j,x*rough+.09*y*y*Math.sin(phase),y*rough,z*rough);
    }
    geometry.computeVertexNormals();
    const stone=new Mesh(geometry,stoneMaterial);
    stone.position.set(x,seabedHeight(x,z)+size*.12,z);
    stone.scale.set(size,size*(.45+random()*.25),size*(.6+random()*.5));
    stone.rotation.y=random()*Math.PI;scene.add(stone);rocks.push({x,z,size});
  }

  const grassMaterial=new MeshBasicNodeMaterial({side:DoubleSide});
  grassMaterial.positionNode=Fn(()=>{
    const p=positionLocal.toVar();
    const phase=float(instanceIndex).mul(2.399);
    // positionLocal already includes the instance scale here; UV keeps roots anchored.
    const bend=uv().y.pow(2).mul(p.y.max(0)).mul(.1);
    p.x.addAssign(sin(u.time.mul(.8).add(phase).add(p.y.mul(.4))).mul(bend));
    p.z.addAssign(sin(u.time.mul(.5).add(phase)).mul(bend).mul(.6));
    return p;
  })();
  grassMaterial.colorNode=grassShade({p:positionWorld,eye:u.eye,height:uv().y,fog:u.fog});
  const grass=new InstancedMesh(grassGeometry(),grassMaterial,1880);grass.frustumCulled=false;
  let planted=0;
  for(let clump=0;clump<160 && planted<1800;clump++){
    const cx=(random()-.5)*65,cz=(random()-.5)*65;
    if(rocks.some(r=>Math.hypot(cx-r.x,cz-r.z)<r.size))continue;
    const tall=random()<.13;
    for(let leaf=0;leaf<12 && planted<1800;leaf++){
      const x=cx+(random()-.5)*1.7,z=cz+(random()-.5)*1.7;
      dummy.position.set(x,seabedHeight(x,z),z);dummy.rotation.set(0,random()*6.28,(random()-.5)*.2);
      dummy.scale.set(.4+random()*.8,(tall?3.5:.4)+random()*2.1,1);dummy.updateMatrix();grass.setMatrixAt(planted++,dummy.matrix);
    }
  }
  // A few near-camera blades establish the same strong foreground depth as the recording.
  for(let i=0;i<65;i++){
    const clump=i%5,cx=[-5,-1,3,-8,8][clump],cz=[16,13,15,10,14][clump];
    const x=cx+(random()-.5)*1.4,z=cz+(random()-.5)*1.5;
    dummy.position.set(x,seabedHeight(x,z),z);dummy.rotation.set(0,random()*6.28,(random()-.5)*.16);
    dummy.scale.set(.65+random()*.4,2.5+random()**3*8.5,1);dummy.updateMatrix();grass.setMatrixAt(planted++,dummy.matrix);
  }
  grass.count=planted;grass.instanceMatrix.needsUpdate=true;scene.add(grass);

  // Fine suspended particles, with a soft circular opacity instead of square sprites.
  const dustMaterial=new MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:DoubleSide});
  dustMaterial.colorNode=vec3(.28,.63,.65);
  dustMaterial.opacityNode=smoothstep(.5,.05,uv().sub(.5).length()).mul(.27);
  dustMaterial.positionNode=Fn(()=>{
    const p=positionLocal.toVar();
    const phase=float(instanceIndex).mul(1.731);
    p.x.addAssign(sin(u.time.mul(.13).add(phase)).mul(.5));
    p.y.addAssign(sin(u.time.mul(.19).add(phase)).mul(.7));return p;
  })();
  const dust=new InstancedMesh(new PlaneGeometry(1,1),dustMaterial,360);dust.frustumCulled=false;
  for(let i=0;i<360;i++){
    dummy.position.set((random()-.5)*70,random()*24,(random()-.5)*60);
    dummy.rotation.set(0,0,0);dummy.scale.setScalar(.022+random()**3*.12);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);
  }
  dust.instanceMatrix.needsUpdate=true;scene.add(dust);

  return {grassCount:planted};
}
