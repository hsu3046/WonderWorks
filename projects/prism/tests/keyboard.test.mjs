// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {clamp} from '../src/settings.ts';
const source=stripTypeScriptTypes(readFileSync(new URL('../src/viewer.ts',import.meta.url),'utf8'),{mode:'transform'});
function handler(name,next,host){const start=source.indexOf(`${name} = `)+name.length+3;return new Function('clamp','document','requestAnimationFrame',`return (${source.slice(start,source.indexOf(next,start)).trim().replace(/;$/,'')});`).call(host,clamp,{hidden:false},()=>1);}
test('keyboard release and focus loss resume auto motion without losing real pointer hover',()=>{
 const host={keys:new Set(),target:{x:0,y:0,set(x,y){this.x=x;this.y=y;},clampScalar(){}},pose:{x:0,y:0,lerp(){},distanceToSquared(){return 0;}},hovering:false,pointers:new Set(),motion:true,tiltLimit:.4,reduced:{matches:false},time:0,last:0,card:{rotation:{set(){}}},material:{uniforms:{uTilt:{value:{set(){}}}}},renderer:{render(){}},wake(){}};
 const key=handler('key','    keyUp = ',host),up=handler('keyUp','    releaseKeys = ',host),blur=handler('releaseKeys','    visibility = ',host),draw=handler('draw','    async snapshot(',host);
 const event=key=>({key,preventDefault(){}});
 key(event('ArrowLeft'));key(event('ArrowUp'));draw(16);assert.equal(host.time,0);
 up(event('ArrowLeft'));draw(32);assert.equal(host.time,0,'another arrow remains pressed');
 up(event('ArrowUp'));draw(48);assert.ok(host.time>0,'auto motion resumes on final release');
 key(event('ArrowRight'));const before=host.time;blur();draw(64);assert.ok(host.time>before,'tabbing away also resumes motion');
 host.hovering=true;key(event('ArrowLeft'));up(event('ArrowLeft'));const hovered=host.time;draw(80);assert.equal(host.time,hovered,'keyboard cleanup preserves pointer hover');
});
