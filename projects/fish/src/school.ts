// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { DoubleSide, InstancedMesh, NodeMaterial } from 'three/webgpu';
import { Fn, attribute, cameraProjectionMatrix, cameraViewMatrix, cos, cross, float, instanceIndex, normalize, normalLocal, positionLocal, sin, varyingProperty, vec3, vec4 } from 'three/tsl';
import { fishGeometry } from './geometry';
import { FISH_COUNT, type OceanUniforms } from './shared';
import type { Simulation } from './simulation';
import { fishShade } from './shaders';

export function createSchool(sim: Simulation,u: OceanUniforms) {
  const world=varyingProperty('vec3','fishWorld');
  const normal=varyingProperty('vec3','fishNormal');
  const color=varyingProperty('vec3','fishColor');
  const skin=varyingProperty('vec2','fishSkin');
  const part=varyingProperty('float','fishSurfacePart');
  const axis=varyingProperty('vec3','fishAxis');
  const material=new NodeMaterial();material.side=DoubleSide;
  material.vertexNode=Fn(()=>{
    const p=positionLocal.toVar();
    const phase=float(instanceIndex).mul(2.399);
    // A travelling body wave grows through the waist, rather than flexing only the tail.
    const tail=p.x.negate().add(.42).max(0);
    const effort=sin(u.time.mul(.9).add(phase)).mul(.18).add(.95);
    const amplitude=tail.mul(tail).mul(.22).add(tail.mul(.08)).add(.012).mul(effort);
    const stroke=u.time.mul(sin(phase).mul(1.5).add(12)).add(phase).sub(p.x.mul(7.8));
    const slopeZ=sin(stroke).mul(tail.mul(-.44).sub(.08)).mul(effort).sub(cos(stroke).mul(amplitude).mul(7.8));
    const slopeY=cos(stroke.mul(.65)).mul(-.012*7.8*.65);
    p.z.addAssign(sin(stroke).mul(amplitude));
    p.y.addAssign(sin(stroke.mul(.65)).mul(.012));
    // Inverse-transpose of the bend keeps scale reflections attached to the flexing body.
    const bentNormal=vec3(normalLocal.x.sub(slopeZ.mul(normalLocal.z)).sub(slopeY.mul(normalLocal.y)),normalLocal.y,normalLocal.z);
    const scale=sin(phase).mul(.12).add(.51);
    p.mulAssign(scale);
    const forward=normalize(sim.velocities.element(instanceIndex).add(vec3(.00001,0,0))).toVar();
    const unbankedSide=normalize(cross(forward,vec3(.0001,1,.0001))).toVar();
    const unbankedUp=cross(unbankedSide,forward).toVar();
    const roll=sim.banks.element(instanceIndex);
    const side=unbankedSide.mul(cos(roll)).add(unbankedUp.mul(sin(roll))).toVar();
    const up=unbankedUp.mul(cos(roll)).sub(unbankedSide.mul(sin(roll))).toVar();
    world.assign(sim.positions.element(instanceIndex).add(forward.mul(p.x)).add(up.mul(p.y)).add(side.mul(p.z)));
    normal.assign(forward.mul(bentNormal.x).add(up.mul(bentNormal.y)).add(side.mul(bentNormal.z)));
    color.assign(attribute('color','vec3'));
    skin.assign(attribute('skinUV','vec2'));
    part.assign(attribute('fishPart','float'));
    axis.assign(normalize(forward.add(up.mul(slopeY)).add(side.mul(slopeZ))));
    return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(world,1));
  })();
  material.fragmentNode=vec4(fishShade({p:world,normal,color,skin,part,axis,eye:u.eye,t:u.time,fog:u.fog}),1);
  const mesh=new InstancedMesh(fishGeometry(),material,FISH_COUNT);
  mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
  return mesh;
}
