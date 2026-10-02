// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTaskPool,settleAll} from '../src/task-pool.ts';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};};
test('asset pool bounds concurrency and releases failed slots',async()=>{
 const run=createTaskPool(2),gate=deferred();let running=0,peak=0,started=0;
 const tasks=Array.from({length:8},(_,i)=>run(async()=>{running++;peak=Math.max(peak,running);started++;await gate.promise;running--;if(i===1)throw Error('decode failed');return i;}));
 const settled=Promise.allSettled(tasks);await Promise.resolve();assert.equal(started,2);gate.resolve();
 const results=await settled;assert.equal(peak,2);assert.equal(started,8);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('stage failure waits for the remaining writers before cleanup',async()=>{
 const gate=deferred();let completed=false,settled=false;
 const tasks=settleAll([Promise.reject(Error('failed')),gate.promise.then(()=>{completed=true;})]).catch(()=>{settled=true;});
 await Promise.resolve();await Promise.resolve();assert.equal(settled,false);gate.resolve();await tasks;
 assert.equal(completed,true);assert.equal(settled,true);
});
test('pool rejects invalid limits',()=>{for(const n of [0,-1,1.5,NaN])assert.throws(()=>createTaskPool(n));});

import * as T from 'three';
import {stageObjects} from '../src/scene-resources.ts';
test('late async chunks dispose their resources after navigation, without attaching',async()=>{
 const parent=new T.Group(),gate=deferred();let cancelled=false,attached=false,disposed=0;
 const task=stageObjects(parent,async root=>{const geometry=new T.BoxGeometry();geometry.addEventListener('dispose',()=>disposed++);root.add(new T.Mesh(geometry,new T.MeshBasicMaterial()));await gate.promise;return 1;},()=>cancelled,()=>{attached=true;});
 cancelled=true;gate.resolve();await task;assert.equal(parent.children.length,0);assert.equal(attached,false);assert.equal(disposed,1);
});
test('failed decoration leaves the existing garden intact and cleans up partial geometry',async()=>{
 const parent=new T.Group(),garden=new T.Group();parent.add(garden);let disposed=0;
 await assert.rejects(stageObjects(parent,async root=>{const geometry=new T.BoxGeometry();geometry.addEventListener('dispose',()=>disposed++);root.add(new T.Mesh(geometry,new T.MeshBasicMaterial()));throw Error('unavailable');},()=>false,()=>assert.fail('must not attach')));
 assert.deepEqual(parent.children,[garden]);assert.equal(disposed,1);
});
test('chunks stay detached until GPU preparation completes',async()=>{
 const parent=new T.Group(),gate=deferred();let prepared=false,attached=false;
 const task=stageObjects(parent,async root=>{root.add(new T.Group());return 1;},()=>false,()=>{attached=true;},async()=>{prepared=true;await gate.promise;});
 await Promise.resolve();assert.equal(prepared,true);assert.equal(parent.children.length,0);assert.equal(attached,false);
 gate.resolve();await task;assert.equal(parent.children.length,1);assert.equal(attached,true);
});
test('navigation during GPU preparation disposes a chunk without attaching',async()=>{
 const parent=new T.Group(),gate=deferred();let cancelled=false,disposed=0;
 const task=stageObjects(parent,async root=>{const g=new T.BoxGeometry();g.addEventListener('dispose',()=>disposed++);root.add(new T.Mesh(g));return 1;},()=>cancelled,()=>assert.fail('cancelled chunk attached'),()=>gate.promise);
 await Promise.resolve();cancelled=true;gate.resolve();await task;
 assert.equal(parent.children.length,0);assert.equal(disposed,1);
});
test('GPU preparation failure cleans up without disturbing the live scene',async()=>{
 const parent=new T.Group(),existing=new T.Group();parent.add(existing);let disposed=0;
 await assert.rejects(stageObjects(parent,async root=>{const g=new T.BoxGeometry();g.addEventListener('dispose',()=>disposed++);root.add(new T.Mesh(g));return 1;},()=>false,()=>assert.fail('failed preparation attached'),async()=>{throw Error('GPU preparation failed');}));
 assert.deepEqual(parent.children,[existing]);assert.equal(disposed,1);
});
