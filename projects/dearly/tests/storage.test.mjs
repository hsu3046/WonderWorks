// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {readLetters,STORAGE_KEY} from '../src/model.ts';
const source=stripTypeScriptTypes(readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),{mode:'transform'});
const reconciliation=source.slice(source.indexOf('function reconcileStorage('),source.lastIndexOf("el('letter-count').textContent"));
const finish=source.slice(source.indexOf('showBox(true);'),source.indexOf('function resetDraft(')).replace(/\}\);\s*$/,'');
test('a storage event during send is reconciled from current storage after animation',()=>{
 let stored='[]',storageHandler;const count={textContent:''};const rendered=[];
 const letter={id:'other-tab',to:'You',from:'Me',message:'hello',stamp:'fern',paper:'ivory',x:.84,y:.25,angle:-5,date:'2026-10-11T00:00:00Z'};
 const env={busy:true,pendingStorage:false,letters:[],readLetters,STORAGE_KEY,localStorage:{getItem:()=>stored},window:{addEventListener:(_,fn)=>{storageHandler=fn;}},document:{body:{classList:{contains:()=>true}}},el:id=>id==='letter-count'?count:{focus(){}},renderBox:()=>rendered.push(env.letters.map(l=>l.id)),tell(){},showBox(){},lock:v=>{env.busy=v;},send:{},resetDraft(){}};
 new Function('env',`with(env){${reconciliation} env.finish=()=>{${finish}};}`)(env);
 stored=JSON.stringify([letter]);storageHandler({key:STORAGE_KEY,storageArea:env.localStorage,newValue:stored});
 assert.equal(env.pendingStorage,true);assert.deepEqual(env.letters,[]);
 env.finish();assert.equal(env.busy,false);assert.equal(env.pendingStorage,false);assert.equal(count.textContent,'1');assert.deepEqual(rendered,[['other-tab']]);
 stored='[]';storageHandler({key:null,storageArea:env.localStorage});assert.deepEqual(env.letters,[],'clear events reconcile too');
});
