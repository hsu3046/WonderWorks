// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FALL_SITES,SEA,fallProfile,fallPoint} from '../src/water-layout.ts';
import {CLEARINGS,terrainHeight} from '../src/landscape.ts';
import {meadowCoverage} from '../src/meadows.ts';
import * as T from 'three';
import {createWater} from '../src/water.ts';
import {TERRAIN_GRID,renderedTerrainHeight} from '../src/terrain-surface.ts';

test('all cascades connect a real cliff lip to open water without penetrating the terrain',()=>{
  for(const site of FALL_SITES){
    const profile=fallProfile(site),top=fallPoint(profile,0,.5),bottom=fallPoint(profile,1,.5);
    assert.ok(profile.crestY>35&&profile.impactZ>profile.crestZ);
    assert.ok(top.y-renderedTerrainHeight(top.x,top.z)<1.2,'the stream starts just above the visible plateau');
    assert.ok(terrainHeight(bottom.x,bottom.z)<SEA.level);assert.equal(bottom.y,SEA.level+.10);
    for(let row=0;row<=80;row++)for(let column=0;column<=16;column++){
      const p=fallPoint(profile,row/80,column/16);assert.ok([p.x,p.y,p.z].every(Number.isFinite));assert.ok(p.y>=renderedTerrainHeight(p.x,p.z)+1);
    }
    for(let t=0;t<1;t+=.002){const a=fallPoint(profile,t,.5),b=fallPoint(profile,t+.002,.5);assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<2,'continuous cliff-following stream');}
  }
});

test('waterfall triangle interiors stay in front of the actual rendered cliff, including grid seams',()=>{
  const grid=TERRAIN_GRID,terrain=new T.PlaneGeometry(grid.width,grid.depth,grid.columns,grid.rows);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,grid.centerZ);
  const tp=terrain.getAttribute('position');for(let i=0;i<tp.count;i++)tp.setY(i,terrainHeight(tp.getX(i),tp.getZ(i)));
  // An independent triangle plane comes directly from the rendered terrain's vertex/index buffers.
  const heightAt=(x:number,z:number):number=>{
    const ix=Math.min(grid.columns-1,Math.max(0,Math.floor((x+grid.width/2)/grid.width*grid.columns)));
    const iz=Math.min(grid.rows-1,Math.max(0,Math.floor((z-grid.centerZ+grid.depth/2)/grid.depth*grid.rows)));
    const a=iz*(grid.columns+1)+ix,u=(x-tp.getX(a))/(tp.getX(a+1)-tp.getX(a)),v=(z-tp.getZ(a))/(tp.getZ(a+grid.columns+1)-tp.getZ(a));
    const face=(iz*grid.columns+ix)*6+(u+v<=1?0:3),ids=[0,1,2].map(k=>terrain.index!.getX(face+k));
    const vertices=ids.map(i=>new T.Vector3(tp.getX(i),tp.getY(i),tp.getZ(i))),plane=new T.Plane().setFromCoplanarPoints(vertices[0]!,vertices[1]!,vertices[2]!);
    const y=-(plane.normal.x*x+plane.normal.z*z+plane.constant)/plane.normal.y;
    assert.ok(Math.abs(y-renderedTerrainHeight(x,z))<.0001,'the contact sampler must match the visible mesh');return y;
  };
  const scene=new T.Scene(),water=createWater(scene,{ocean:new T.Texture(),fallVeil:new T.Texture()},{value:0});
  for(const mesh of scene.children){
    if(!(mesh instanceof T.Mesh)||!mesh.name.startsWith('Terrain-fitted cascade'))continue;
    const p=mesh.geometry.getAttribute('position'),index=mesh.geometry.index!;
    for(let i=0;i<index.count;i+=3){
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
      for(let v=0;v<=8;v++)for(let u=0;u<=8-v;u++){
        const bu=u/8,bv=v/8,ba=1-bu-bv;
        const x=p.getX(a)*ba+p.getX(b)*bu+p.getX(c)*bv,y=p.getY(a)*ba+p.getY(b)*bu+p.getY(c)*bv,z=p.getZ(a)*ba+p.getZ(b)*bu+p.getZ(c)*bv;
        assert.ok(y-heightAt(x,z)>.30,`${mesh.name} must not expose rock through its stream`);
      }
    }
  }
  terrain.dispose();water.dispose();
});

test('water, impact foam and spray share the scene clock and the sea has a curved boundary',()=>{
  const scene=new T.Scene(),clock={value:0},water=createWater(scene,{ocean:new T.Texture(),fallVeil:new T.Texture()},clock),layers:T.ShaderMaterial[]=[];
  scene.traverse(o=>{if((o instanceof T.Mesh||o instanceof T.Points)&&o.material instanceof T.ShaderMaterial)layers.push(o.material);});
  assert.equal(layers.length,FALL_SITES.length*2+1);
  for(const material of layers)assert.equal(material.uniforms.uTime,clock,'a cloned scalar clock would freeze a layer');
  clock.value=3.25;for(const material of layers)assert.equal(material.uniforms.uTime!.value,3.25);
  const sea=scene.getObjectByName('Painted sea fading into the horizon') as T.Mesh;assert.ok(sea.geometry instanceof T.CircleGeometry);
  assert.equal(sea.geometry.parameters.radius,SEA.radius);assert.ok(SEA.fadeStart<SEA.radius);water.dispose();
});

test('meadow coverage preserves landing clearings and fades out before the open sea',()=>{
  for(const c of CLEARINGS)for(let i=0;i<16;i++){
    const angle=i/16*Math.PI*2;assert.equal(meadowCoverage(c.x+Math.cos(angle)*4,c.z+Math.sin(angle)*4),0);
  }
  for(const p of [[0,-600],[-380,0],[380,180],[0,200]])assert.equal(meadowCoverage(p[0]!,p[1]!),0);
  for(let x=-180;x<180;x+=11)for(let z=-430;z<120;z+=13){const value=meadowCoverage(x,z);assert.ok(Number.isFinite(value)&&value>=0&&value<=1);}
});
