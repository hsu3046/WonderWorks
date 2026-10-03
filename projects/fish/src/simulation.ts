import { nativeShader } from './native-shader';
// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { Fn, If, Loop, cross, dot, float, instanceIndex, instancedArray, length, normalize, uint, vec3 } from 'three/tsl';
import { FISH_COUNT, randomGenerator, type OceanUniforms } from './shared';

const steeringField = nativeShader<'vec3'>(`
fn steeringField(p: vec3<f32>, id: f32, t: f32) -> vec3<f32> {
  let group = floor(id/2048.0);
  let split = pow(.5+.5*sin(t*.135-1.3),3.0);
  let pod = group*2.094+t*.17;
  let center = vec3<f32>(sin(t*.13)*2.5,9.0+sin(t*.18)*1.5,cos(t*.11)*1.8)
    + vec3<f32>(cos(pod)*5.0,sin(pod*1.7)*2.0,sin(pod)*4.0)*split;
  let q = p-center;
  // The vortex axis tumbles through 3D; no fixed cylindrical skin or assigned height.
  let axis = normalize(vec3<f32>(sin(t*.083)*.55,cos(t*.095),.2+sin(t*.095)));
  let h = dot(q,axis);
  let radialVector = q-axis*h;
  let r = max(length(radialVector),.08);
  let radial = radialVector/r;
  let tangent = cross(axis,radial);
  let seed = fract(id*.6180339);
  let axialSeed = fract(id*.75487766);
  let pulse = .5+.5*sin(t*.24);
  let ringness=.5+.5*sin(t*.16+.7);
  let radius = mix(.8+seed*7.5,5.4+(seed-.5)*3.2,ringness)+pulse*.8-h*h*.025;
  // Independent radial/axial seeds fill a volume, rather than tracing a thin torus skin.
  let axialFlow = sin(r*.62+t*.7+seed*6.283)*1.25+((axialSeed-.5)*9.0-h)*.26;
  let curl = vec3<f32>(sin(q.y*.36+t*.38)-cos(q.z*.31-t*.26),
    sin(q.z*.34+t*.3)-cos(q.x*.28+t*.35),sin(q.x*.3-t*.24)-cos(q.y*.32+t*.3));
  var flow = tangent*(2.9+seed*1.0+pulse*.7) + radial*(radius-r)*.6 + axis*axialFlow + curl*.62;
  flow.y += max(2.0-p.y,0.0)*3.0-max(p.y-20.5,0.0)*3.0;
  return flow;
}`);
const pointerForce = nativeShader<'vec3'>(`
fn pointerForce(p: vec3<f32>, origin: vec3<f32>, ray: vec3<f32>, power: f32) -> vec3<f32> {
  if (power == 0.0) { return vec3<f32>(0.0); }
  let along = clamp(dot(p-origin,ray),0.0,65.0);
  let delta = p-(origin+ray*along);
  let d = length(delta);
  return delta/max(d,.08) * (1.0-smoothstep(.2,2.7,d))*power*15.0;
}`);
const shockForce = nativeShader<'vec3'>(`
fn shockForce(p: vec3<f32>, shock: vec4<f32>, t: f32) -> vec3<f32> {
  let age = t-shock.w;
  if (age < 0.0 || age >= 2.5) { return vec3<f32>(0.0); }
  let delta = p-shock.xyz;
  let d = length(delta);
  let shell = 1.0-smoothstep(.2,2.4,abs(d-age*11.0));
  return delta/max(d,.1)*shell*24.0*exp(-age*.9);
}`);

export function createSimulation(u: OceanUniforms) {
  const random = randomGenerator(1492);
  const p = new Float32Array(FISH_COUNT*3), v = new Float32Array(FISH_COUNT*3);
  for (let i=0;i<FISH_COUNT;i++) {
    const angle = random()*Math.PI*2, radius=4.2+random()*3.1;
    p.set([Math.cos(angle)*radius,2+random()*12.5,Math.sin(angle)*radius],i*3);
    v.set([-Math.sin(angle)*3.2,(random()-.5)*.5,Math.cos(angle)*3.2],i*3);
  }
  const positions=instancedArray(p,'vec3'), velocities=instancedArray(v,'vec3');
  const nextVelocities=instancedArray(FISH_COUNT,'vec3');
  const banks=instancedArray(FISH_COUNT,'float');
  const stepVelocity=Fn(()=>{
    const id=instanceIndex;
    const pos=positions.element(id).toVar();
    const vel=velocities.element(id).toVar();
    const force=steeringField({p:pos,id:float(id),t:u.time}).sub(vel).mul(.95).toVar();
    const alignment=vec3(0).toVar(), cohesion=vec3(0).toVar(), separation=vec3(0).toVar();
    const neighbors=float(0).toVar();
    // Bounded sampling costs 196,608 comparisons, rather than 37.7 million per frame.
    Loop({start:uint(0),end:uint(32),type:'uint',condition:'<'},({i})=>{
      const j=id.mul(uint(73)).add(i.mul(uint(193))).add(uint(u.time.mul(9))).mod(uint(FISH_COUNT));
      const delta=positions.element(j).sub(pos).toVar();
      // Distance comparisons need squared length, not a square root per neighbor.
      const d2=dot(delta,delta).toVar();
      If(d2.greaterThan(.000001).and(d2.lessThan(9.0)),()=>{
        alignment.addAssign(velocities.element(j));cohesion.addAssign(delta);neighbors.addAssign(1);
        If(d2.lessThan(.64),()=>{separation.subAssign(delta.div(d2.add(.04)));});
      });
    });
    If(neighbors.greaterThan(0),()=>{
      force.addAssign(alignment.div(neighbors).sub(vel).mul(.72));
      force.addAssign(cohesion.div(neighbors).mul(.17));
    });
    force.addAssign(separation.mul(1.2));
    force.addAssign(pointerForce({p:pos,origin:u.rayOrigin,ray:u.rayDirection,power:u.pointerPower}));
    for (const shock of u.shocks) force.addAssign(shockForce({p:pos,shock,t:u.time}));
    const result=vel.add(force.mul(u.dt)).toVar();
    const speed=length(result).toVar();
    If(speed.greaterThan(7.5),()=>{result.assign(normalize(result).mul(7.5));});
    const bank=cross(normalize(vel.add(vec3(.0001,0,0))),normalize(result.add(vec3(.0001,0,0)))).y.mul(36).clamp(-.65,.65);
    banks.element(id).addAssign(bank.sub(banks.element(id)).mul(u.dt).mul(4));
    nextVelocities.element(id).assign(result);
  })().compute(FISH_COUNT);
  // A second dispatch keeps neighbor reads on the previous complete simulation state.
  const integrate=Fn(()=>{
    const v=nextVelocities.element(instanceIndex);
    velocities.element(instanceIndex).assign(v);
    const p=positions.element(instanceIndex).add(v.mul(u.dt)).toVar();
    p.y.assign(p.y.clamp(.7,22));
    positions.element(instanceIndex).assign(p);
  })().compute(FISH_COUNT);
  return {positions,velocities,banks,stepVelocity,integrate};
}
export type Simulation = ReturnType<typeof createSimulation>;
