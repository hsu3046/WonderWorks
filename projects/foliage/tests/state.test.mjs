import {test} from 'node:test';
import assert from 'node:assert/strict';
import {climate,leafStage,leafFall,seasonDuration,readSettings,defaults,random,seasonAt} from '../src/state.ts';
test('winter closes both ends of the year while summer clears the snow',()=>{assert.equal(climate(0).snow,1);assert.equal(climate(1).snow,1);assert.equal(climate(.54).snow,0);for(let t=0;t<=1;t+=.005){const c=climate(t);for(const n of Object.values(c))assert.ok(n>=0&&n<=1);}});
test('leaves bud, remain attached in summer, and land after autumn release',()=>{for(let i=0;i<100;i++){const seed=i/100;assert.equal(leafStage(.06,seed,.3).visible,false);assert.equal(leafStage(.54,seed,.3,20).flight,0);assert.equal(leafStage(.98,seed,.3,12).flight,1);}});
test('released leaves keep falling with a manually held season',()=>{const year=leafFall(.2).release+.002,a=leafStage(year,.2,.3),b=leafStage(year,.2,.3,12);assert.ok(a.flight>0&&a.flight<1);assert.equal(b.flight,1);assert.equal(leafStage(.54,.2,.3,100).flight,0);});
test('spring cherry bloom is visible before all leaf buds open',()=>{assert.ok(leafStage(.27,.9,.3,0,'cherry').size>leafStage(.27,.9,.3).size);});
test('URL parameters are finite, bounded and validated',()=>{assert.deepEqual(readSettings(''),defaults);const s=readSettings('?year=Infinity&hour=-8&wind=99&speed=NaN&tree=wrong&weather=wrong');assert.equal(s.year,defaults.year);assert.equal(s.hour,0);assert.equal(s.wind,1);assert.equal(s.speed,1);assert.equal(s.species,'maple');assert.equal(s.weather,'clear');});
test('seeded generation is reproducible and stays in bounds',()=>{const a=random(91),b=random(91);for(let i=0;i<1000;i++){const x=a();assert.equal(x,b());assert.ok(x>=0&&x<1);}});
test('four seasonal presets report the intended season',()=>assert.deepEqual([.06,.29,.54,.79].map(seasonAt),['Winter','Spring','Summer','Autumn']));

test('autumn release is staggered across time and eventually settles at a held date',()=>{
 const seeds=Array.from({length:1000},(_,i)=>(i+.5)/1000);
 const attached=t=>seeds.filter(seed=>leafStage(.70,seed,.28,t).flight===0).length;
 assert.ok(attached(0)>attached(5));assert.ok(attached(5)>attached(10));
 assert.ok(seeds.every(seed=>leafStage(.70,seed,.28,270).flight===1));
 for(const seed of seeds){let previous=0;for(let t=0;t<270;t+=.5){const next=leafStage(.7,seed,.28,t).flight;assert.ok(next>=previous);previous=next;}}
});
test('leaf landing spread covers every quadrant even in a gentle breeze',()=>{
 const quadrants=[0,0,0,0],durations=new Set(),releases=new Set();
 for(let i=0;i<2000;i++){
  const f=leafFall((i+.5)/2000),x=Math.cos(f.angle)*f.drift+1.8*.28,z=Math.sin(f.angle)*f.drift+.4*.28;
  quadrants[(x>0?1:0)+(z>0?2:0)]++;durations.add(Math.floor(f.duration));releases.add(Math.floor((f.release-.7)*150));
 }
 assert.ok(quadrants.every(n=>n>200));assert.ok(durations.size>=6);assert.ok(releases.size>=30);
});

test('gentle autumn limits simultaneous airborne leaves without slowing the rest of the year',()=>{
 assert.equal(seasonDuration(.54),150);assert.equal(seasonDuration(.8),1200);
 let air=0;for(let i=0;i<26000;i++){const f=leafStage(.79,(i+.5)/26000,.28).flight;if(f>0&&f<1)air++;}
 assert.ok(air>300&&air<1100,`airborne count ${air}`);
});
