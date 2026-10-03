// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Assets} from './assets';
import {createHeroTree} from './hero-tree';
import {createBroadleafGrove} from './tree-lod';
import {batchStaticMeshes} from './world-batches';
import {createGroundDetailLOD} from './prop-lod';
import {createMeadows,meadowCoverage,meadowGLSL} from './meadows';
import {random,terrainHeight,naturalHeight,inClearing,PERCH} from './landscape';
import {TERRAIN_GRID} from './terrain-surface';
import {createLocalScenery} from './local-scenery';
import {occupiedByScenery,SCENERY_SITES} from './local-scenery-layout';
import type {WalkObstacle} from './walking';

const dummy=new T.Object3D(), Y=new T.Vector3(0,1,0);
function beam(a:T.Vector3,b:T.Vector3,r0:number,r1:number,mat:T.Material,segments=9):T.Mesh {
  const delta=b.clone().sub(a),mesh=new T.Mesh(new T.CylinderGeometry(r1,r0,delta.length(),segments,6,true),mat);
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(Y,delta.normalize());
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

export function createWorld(scene:T.Scene,assets:Assets,time:{value:number}) {
  const rng=random(80621),root=new T.Group();scene.add(root);
  const walkObstacles:WalkObstacle[]=[];
  if(!assets.local)throw new Error('The supplied valley scenery did not load.');
  const localAssets=assets.local;
  const barkMat=new T.MeshStandardMaterial({map:assets.bark,normalMap:assets.barkNormal,roughness:.94,color:0xaaa18a});
  assets.bark.repeat.set(3,7);assets.barkNormal.repeat.copy(assets.bark.repeat);
  const rockMat=new T.MeshStandardMaterial({map:assets.rock,normalMap:assets.rockNormal,roughness:.94,color:0xc0c1a6});
  const terrain=new T.PlaneGeometry(TERRAIN_GRID.width,TERRAIN_GRID.depth,TERRAIN_GRID.columns,TERRAIN_GRID.rows);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,TERRAIN_GRID.centerZ);
  const p=terrain.attributes.position!;
  for(let i=0;i<p.count;i++)p.setY(i,terrainHeight(p.getX(i),p.getZ(i)));
  terrain.computeVertexNormals();
  // Blend scanned soil and rock by the actual surface slope; world-space mapping hides UV stretching on cliffs.
  const groundMat=new T.MeshStandardMaterial({roughness:.98});
  groundMat.onBeforeCompile=s=>{
    s.uniforms.uRock={value:assets.stone};s.uniforms.uSoil={value:assets.ground};s.uniforms.uRockNormal={value:assets.stoneNormal};s.uniforms.uSoilNormal={value:assets.groundNormal};s.uniforms.uMeadow={value:assets.flowerMeadow};s.uniforms.uGardenGround={value:localAssets.meadow};s.uniforms.uLeafFloor={value:localAssets.leafFloor};
    s.vertexShader='varying vec3 vWorld; varying vec3 vTerrainNormal;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWorld=position;vTerrainNormal=normal;');
    s.fragmentShader='uniform sampler2D uRock;uniform sampler2D uSoil;uniform sampler2D uRockNormal;uniform sampler2D uSoilNormal;uniform sampler2D uMeadow;uniform sampler2D uGardenGround;uniform sampler2D uLeafFloor;varying vec3 vWorld;varying vec3 vTerrainNormal;\n'+meadowGLSL+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 weights=pow(abs(normalize(vTerrainNormal)),vec3(4.));weights/=dot(weights,vec3(1.));
      vec3 stone=texture2D(uRock,vWorld.yz*.038).rgb*weights.x+texture2D(uRock,vWorld.xz*.038).rgb*weights.y+texture2D(uRock,vWorld.xy*.038).rgb*weights.z;
      vec3 soil=texture2D(uSoil,vWorld.xz*.08).rgb;
      float grass=smoothstep(.54,.9,vTerrainNormal.y);
      float stoneLuma=dot(stone,vec3(.2126,.7152,.0722));
      vec3 weathered=mix(stone,vec3(stoneLuma)*vec3(1.05,1.10,1.06),.56)*1.10;
      diffuseColor.rgb=mix(weathered,mix(soil*.83,vec3(.12,.18,.055),.42),grass);
      float flowers=meadowCoverage(vWorld.xz)*smoothstep(.54,.84,normalize(vTerrainNormal).y);
      vec3 meadow=texture2D(uMeadow,vWorld.xz*.14).rgb;
      float garden=max(1.-smoothstep(6.,18.,distance(vWorld.xz,vec2(-29.,53.))),1.-smoothstep(7.,22.,distance(vWorld.xz,vec2(134.,-130.))));
      vec3 gardenFloor=texture2D(uGardenGround,vWorld.xz*.18).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb,gardenFloor*.80,garden*grass*.50);
      float leafFloor=(1.-smoothstep(4.,12.,distance(vWorld.xz,vec2(-12.,65.))))*grass;
      diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(uLeafFloor,vWorld.xz*.22).rgb*.8,leafFloor*.30);
      diffuseColor.rgb=mix(diffuseColor.rgb,meadow*.94,flowers*.92*(1.-garden*.72));
    `);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 nx=texture2D(uRockNormal,vWorld.yz*.038).xyz*2.-1.;
      vec3 ny=texture2D(uRockNormal,vWorld.xz*.038).xyz*2.-1.;
      vec3 nz=texture2D(uRockNormal,vWorld.xy*.038).xyz*2.-1.;
      vec3 detail=vec3(nx.z*sign(vTerrainNormal.x),nx.y,nx.x)*weights.x+vec3(ny.x,ny.z*sign(vTerrainNormal.y),ny.y)*weights.y+vec3(nz.x,nz.y,nz.z*sign(vTerrainNormal.z))*weights.z;
      vec3 soilDetail=texture2D(uSoilNormal,vWorld.xz*.08).xyz*2.-1.;
      detail=mix(detail,vec3(soilDetail.x,soilDetail.z,soilDetail.y),grass);
      normal=normalize((viewMatrix*vec4(normalize(vTerrainNormal+detail*.42),0.)).xyz);
    `);
  };
  const land=new T.Mesh(terrain,groundMat);land.receiveShadow=true;root.add(land);

  // A painted alpine panorama supplies distant rock detail with 128 triangles instead of 20 volumes.
  // Three wraps preserve the source's 3:1 aspect on a 9.42:1 cylindrical surface.
  assets.panorama.repeat.set(3,1.22);assets.panorama.offset.set(.08,-.02);
  const panoramaGeometry=new T.CylinderGeometry(1500,1500,1000,64,1,true);
  const panoramaMaterial=new T.MeshBasicMaterial({map:assets.panorama,side:T.BackSide,transparent:true,depthWrite:false,alphaTest:.04,fog:false,toneMapped:false,color:0xc3d3d6});
  panoramaMaterial.onBeforeCompile=s=>{
    // The art contains a coherent mountain/coast transition; fade only its low sea band into real water.
    s.vertexShader='varying float vHorizonHeight;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHorizonHeight=uv.y;');
    s.fragmentShader='varying float vHorizonHeight;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=smoothstep(.10,.13,vHorizonHeight);\n#include <alphatest_fragment>');
  };
  const panorama=new T.Mesh(panoramaGeometry,panoramaMaterial);panorama.position.set(0,400,-220);panorama.rotation.y=-.60;panorama.renderOrder=-1;panorama.name='Painted alpine horizon';root.add(panorama);
  // Preserve the original forest's random stream when removing its 20 procedural peaks.
  for(let i=0;i<60;i++)rng();

  const pineMat=new T.MeshStandardMaterial({map:assets.pine,alphaMap:assets.pineAlpha,alphaTest:.35,side:T.DoubleSide,roughness:1,color:0xe1e8b7});
  pineMat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
    transformed.x+=sin(uTime*.8+instanceMatrix[3].x*.21+position.y*1.3)*.075*position.y;
    #endif
  `);s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*.16;\n#include <opaque_fragment>');};
  const pineParts:T.BufferGeometry[]=[];
  for(let level=0;level<9;level++)for(let arm=0;arm<5;arm++){
    const y=.7+level*.51,w=(1-level/10)*2.0,angle=arm/5*Math.PI*2+level*2.3;
    const g=new T.PlaneGeometry(w*1.65,w*1.2);
    // The source is an atlas: select one twig only, excluding its opaque trunk strip.
    const uv=g.attributes.uv!;const crop=arm%2===0?[.645,.17,.99,.595]:[.30,.22,.66,.605];
    for(let i=0;i<uv.count;i++)uv.setXY(i,crop[0]!+uv.getX(i)*(crop[2]!-crop[0]!),crop[1]!+uv.getY(i)*(crop[3]!-crop[1]!));
    g.rotateX(-.6);g.translate(0,0,-w*.48);g.rotateY(angle);g.translate(0,y,0);pineParts.push(g);
  }
  const pineGeo=mergeGeometries(pineParts)!;pineParts.forEach(g=>g.dispose());
  const locations:Array<{x:number;y:number;z:number;s:number;rot:number}>=[];
  for(let i=0;i<4700;i++){
    const x=rng()*710-355,z=rng()*660-535,h=naturalHeight(x,z);
    if(h<12||Math.abs(naturalHeight(x+2,z)-h)>4||Math.abs(naturalHeight(x,z+2)-h)>4)continue;
    if(Math.hypot(x-91,z+393)<31||Math.hypot(x+4,z-64)<13)continue;
    locations.push({x,y:h-.2,z,s:1.2+rng()*2.0,rot:rng()*Math.PI*2});
  }
  const trees=new T.InstancedMesh(pineGeo,pineMat,locations.length);
  const trunks=new T.InstancedMesh(new T.CylinderGeometry(.055,.19,5,6).translate(0,2.5,0),barkMat,locations.length);
  const tint=new T.Color();locations.forEach((l,i)=>{dummy.position.set(l.x,terrainHeight(l.x,l.z)-.2,l.z);dummy.rotation.set(0,l.rot,0);dummy.scale.set(l.s,l.s*(.85+rng()*.3),l.s);if(inClearing(l.x,l.z,17)||meadowCoverage(l.x,l.z)>.6||occupiedByScenery(l.x,l.z,2))dummy.scale.setScalar(0);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);trunks.setMatrixAt(i,dummy.matrix);tint.setHSL(.21+rng()*.07,.18+rng()*.18,.56+rng()*.24);trees.setColorAt(i,tint);});
  trees.receiveShadow=true;root.add(trees,trunks);

  // Keep scanned geometry in the near grove and use painted crossed cards farther away.
  const broadleaf=locations.filter((l,i)=>i%11===0&&l.z>-340&&l.z<50&&Math.abs(l.x)<210).slice(0,42);
  broadleaf.push({x:-29,y:terrainHeight(-29,44),z:44,s:2,rot:.4},{x:27,y:terrainHeight(27,37),z:37,s:1.5,rot:2.1});
  const grove=createBroadleafGrove(assets.tree,broadleaf.filter(l=>meadowCoverage(l.x,l.z)<.6&&!occupiedByScenery(l.x,l.z,2)),assets.oakSprite);root.add(grove.group);grove.updateView(new T.Vector3(PERCH.x,PERCH.y,PERCH.z));
  root.add(createHeroTree(barkMat,assets.oakFoliage));
  // The former oak used 24 fork and 45,500 leaf placement draws; keep later asset positions stable.
  for(let i=0;i<45524;i++)rng();

  // Actual scanned/modelled assets around the departure tree.
  const groundDetails:Array<(camera:T.Vector3)=>void>=[];
  assets.fern.updateMatrixWorld(true);const fernMeshes:T.Mesh[]=[];assets.fern.traverse(o=>{if(o instanceof T.Mesh)fernMeshes.push(o);});
  for(const source of fernMeshes){
    const g=source.geometry.clone().applyMatrix4(source.matrixWorld),bounds=new T.Box3().setFromBufferAttribute(g.attributes.position as T.BufferAttribute);
    const size=bounds.max.y-bounds.min.y;g.translate(-bounds.getCenter(new T.Vector3()).x,-bounds.min.y,-bounds.getCenter(new T.Vector3()).z);g.scale(1/size,1/size,1/size);
    const patch=new T.InstancedMesh(g,source.material,65);
    for(let i=0;i<65;i++){const x=-20+rng()*43,z=46+rng()*47;dummy.position.set(x,terrainHeight(x,z),z);dummy.rotation.set(0,rng()*6.28,0);dummy.scale.setScalar((1.3+rng()*2.7)*(inClearing(x,z,7)?0:1));dummy.updateMatrix();patch.setMatrixAt(i,dummy.matrix);}
    patch.castShadow=true;patch.receiveShadow=true;root.add(patch);groundDetails.push(createGroundDetailLOD(patch));
  }
  const rockSources:T.Mesh[]=[];assets.rocks.updateMatrixWorld(true);assets.rocks.traverse(o=>{if(o instanceof T.Mesh)rockSources.push(o);});
  rockSources.slice(0,4).forEach((source,j)=>{
    const g=source.geometry.clone().applyMatrix4(source.matrixWorld);g.computeBoundingBox();const b=g.boundingBox!,c=b.getCenter(new T.Vector3());const s=2/Math.max(b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z);g.translate(-c.x,-b.min.y,-c.z);g.scale(s,s,s);
    const batch=new T.InstancedMesh(g,source.material,18);
    for(let i=0;i<18;i++){const x=-29+rng()*54,z=35+rng()*52;dummy.position.set(x,terrainHeight(x,z)-.4,z);dummy.rotation.set(rng()*.2,rng()*6.28,0);dummy.scale.setScalar((.4+rng()*2)*(inClearing(x,z,8)?0:1));dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(dummy.scale.x>0)walkObstacles.push({x,z,radius:dummy.scale.x});}
    batch.name=`Scanned moss rocks ${j}`;batch.castShadow=true;batch.receiveShadow=true;root.add(batch);groundDetails.push(createGroundDetailLOD(batch));
  });

  const dark=new T.MeshStandardMaterial({color:0x302920,roughness:1});
  const structures=new T.Group();root.add(structures);
  function box(group:T.Group,w:number,h:number,d:number,x:number,y:number,z:number,material:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
  const localScenery=createLocalScenery(localAssets,rockMat);root.add(localScenery.group);
  // Static collision proxies share the visible forest's placement filters; LOD never changes solidity.
  walkObstacles.push(...SCENERY_SITES.map(s=>({x:s.x,z:s.z,radius:s.model==='cherry'?.6:s.radius})),{x:-12,z:65,radius:2.2});
  for(const l of locations)if(!inClearing(l.x,l.z,17)&&meadowCoverage(l.x,l.z)<=.6&&!occupiedByScenery(l.x,l.z,2))walkObstacles.push({x:l.x,z:l.z,radius:l.s*.19});
  for(const l of broadleaf)if(!inClearing(l.x,l.z,20)&&meadowCoverage(l.x,l.z)<.6&&!occupiedByScenery(l.x,l.z,2))walkObstacles.push({x:l.x,z:l.z,radius:l.s*.32});


  // Suspension bridge across the central gap, each plank following the same catenary approximation.
  const bridge=new T.Group();structures.add(bridge);
  const a=new T.Vector3(-64,48,-84),b=new T.Vector3(47,55,-111),length=a.distanceTo(b),dir=b.clone().sub(a).normalize(),side=new T.Vector3(-dir.z,0,dir.x);
  const path=(t:number,offset:number)=>a.clone().lerp(b,t).addScaledVector(side,offset).add(new T.Vector3(0,-Math.sin(t*Math.PI)*7,0));
  for(let i=0;i<93;i++){const t=i/92,pt=path(t,0),plank=box(bridge,4,.25,length/92*.9,pt.x,pt.y,pt.z,barkMat);plank.rotation.y=Math.atan2(dir.x,dir.z);}
  for(const offset of [-2,2]){
    const points=Array.from({length:60},(_,i)=>path(i/59,offset).add(new T.Vector3(0,3.7,0)));
    bridge.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),90,.11,5,false),dark));
    for(let i=0;i<24;i++){const t=i/23;bridge.add(beam(path(t,offset),path(t,offset).add(new T.Vector3(0,3.7,0)),.048,.048,dark,5));}
  }
  for(const pt of [a,b])for(const sign of [-1,1])bridge.add(beam(pt.clone().addScaledVector(side,sign*2.5).add(new T.Vector3(0,-3,0)),pt.clone().addScaledVector(side,sign*2.5).add(new T.Vector3(0,8,0)),.7,.45,barkMat));

  batchStaticMeshes(structures);
  const meadows=createMeadows(assets.flowerTuft,time);root.add(meadows.mesh);
  return {root,walkObstacles,updateView:(camera:T.Vector3)=>{grove.updateView(camera);groundDetails.forEach(update=>update(camera));meadows.updateView(camera);localScenery.updateView(camera);},localCounts:localScenery.diagnostics,groveCounts:grove.counts,flowerCounts:()=>({near:meadows.mesh.count,total:meadows.count}),trees:locations.filter(l=>!inClearing(l.x,l.z,17)&&meadowCoverage(l.x,l.z)<=.6&&!occupiedByScenery(l.x,l.z,2)).length+broadleaf.filter(l=>!inClearing(l.x,l.z,20)&&meadowCoverage(l.x,l.z)<.6&&!occupiedByScenery(l.x,l.z,2)).length,rockMat};
}
