import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createWildlife} from '../src/wildlife.ts';
import {whaleMotion,fishJump,WHALE_PERIOD} from '../src/wildlife-motion.ts';
const boat={x:3,z:16,speed:0,heading:0,turnRate:0};
function setup(){const scene=new T.Scene(),material=new T.ShaderMaterial({uniforms:{waterColor:{value:new T.Color('#224f48')},sunColor:{value:new T.Color('#ffcc88')}},fragmentShader:'gl_FragColor = vec4( outgoingLight, alpha );'}),water=new T.Mesh(new T.PlaneGeometry(1,1),material);scene.add(water);return {scene,water,wildlife:createWildlife(scene,water)};}
test('whale surfaces, breathes and submerges continuously at cycle boundary',()=>{
 assert.ok(whaleMotion(1).spout>0);assert.ok(whaleMotion(19).tailLift>.4);assert.ok(whaleMotion(15).pitch>0);assert.equal(whaleMotion(28).visible,false);
 const a=whaleMotion(WHALE_PERIOD-5-1e-5),b=whaleMotion(WHALE_PERIOD-5+1e-5);assert.ok(Math.abs(a.y-b.y)<1e-6);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1e-4);
});
test('wildlife is repeatable when scene time pauses and reset returns original poses',()=>{
 const {scene,wildlife,water}=setup();wildlife.update(0,boat);const start=Array.from(scene.getObjectByName('HarborGulls').instanceMatrix.array);wildlife.update(19,boat);
 const tail=scene.getObjectByName('WhaleFlukes');assert.ok(new T.Vector3(0,0,-.8).applyMatrix4(tail.matrixWorld).y>.1,'diving flukes rise above the water');
 const matrices=Array.from(scene.getObjectByName('HarborShoals').instanceMatrix.array);wildlife.update(19,boat);assert.deepEqual(Array.from(scene.getObjectByName('HarborShoals').instanceMatrix.array),matrices);
 wildlife.update(0,boat);assert.deepEqual(Array.from(scene.getObjectByName('HarborGulls').instanceMatrix.array),start);assert.equal(water.renderOrder,-10);assert.equal(water.material.transparent,true);
});
test('all wildlife matrices remain finite throughout a full encounter',()=>{
 const {scene,wildlife}=setup();for(let t=0;t<50;t+=.25){wildlife.update(t,boat);scene.traverse(o=>{if(o.isInstancedMesh)assert.ok(Array.from(o.instanceMatrix.array).every(Number.isFinite));});}
});
test('fish jump returns to swimming continuously and has a landing ripple',()=>{
 const before=fishJump(8.999999,0),after=fishJump(9.000001,0);assert.ok(Math.abs(before.height-after.height)<1e-4);assert.ok(fishJump(9.6,0).height>1);assert.ok(fishJump(10.5,0).splash>0);assert.equal(fishJump(9.6,3).height,0);
});

test('giant whale breathes above water twice and its water effects remain at the surface after diving',()=>{
 const {scene,wildlife}=setup();
 for(const t of [1,10]){wildlife.update(t,boat);const animal=scene.getObjectByName('Humpback');assert.equal(animal.scale.x,2.5);const spray=scene.getObjectByName('WhaleBreathAndSplash');assert.ok(spray.visible);assert.ok(spray.material.uniforms.blow.value.y>1);assert.ok(spray.material.uniforms.breath.value>0);}
 wildlife.update(24.6,boat);const spray=scene.getObjectByName('WhaleBreathAndSplash');assert.ok(spray.visible);assert.equal(spray.material.uniforms.impact.value.y,.08);assert.ok(scene.getObjectByName('WhaleDisplacementWaves').visible);
 const impact=spray.material.uniforms.impact.value.clone();wildlife.update(25,boat);assert.ok(impact.distanceTo(spray.material.uniforms.impact.value)<1e-8,'splash does not follow whale underwater');
});
