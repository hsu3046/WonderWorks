import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSettings,defaults} from '../src/state.ts';
test('empty settings match the reference preset',()=>assert.deepEqual(readSettings(''),defaults));
test('a selected movement gets its own default arrangement',()=>{assert.equal(readSettings('?mode=ribbons').count,1);assert.equal(readSettings('?mode=wave').count,3);});
test('unknown enums and non-finite values never reach the shader',()=>{const s=readSettings('?mode=wrong&palette=__proto__&speed=NaN&amplitude=Infinity');assert.equal(s.mode,'sequence');assert.equal(s.palette,'spectral');assert.equal(s.speed,1);assert.equal(s.amplitude,1);});
test('URL values are clamped to the same bounds as controls',()=>{const s=readSettings('?speed=-8&amplitude=99&twist=99&count=100&grain=2&zoom=0&phase=999');assert.deepEqual([s.speed,s.amplitude,s.twist,s.count,s.grain,s.zoom,s.phase],[0,1.8,2.5,9,.16,.65,25]);});
test('counts are integral and a valid variation round-trips',()=>{const s=readSettings('?mode=orbit&palette=acid&speed=1.3&amplitude=.75&twist=2&count=4.6&grain=.025&zoom=1.1&phase=3.4');assert.equal(s.count,5);assert.deepEqual(readSettings(new URLSearchParams(Object.entries(s).map(([k,v])=>[k,String(v)])).toString()),s);});

test('wave always uses three bars, including older shared variations',()=>assert.equal(readSettings('?mode=wave&count=9').count,3));

test('new orbit and wave timeline offsets survive shared URLs',()=>{for(const phase of [16,21,24.9])assert.equal(readSettings('?mode=sequence&phase='+phase).phase,phase);});
