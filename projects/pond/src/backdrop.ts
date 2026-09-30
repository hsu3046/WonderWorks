// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';

export async function createBackdrop(scene:T.Scene){
 let map:T.Texture;
 try{map=await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}landscape/painted-woodland-v2.webp`);}
 catch(cause){throw new Error('The distant woodland could not load. Please reload the garden.',{cause});}
 map.colorSpace=T.SRGBColorSpace;
 // Mirroring closes both panorama joins without another image allocation.
 map.wrapS=T.MirroredRepeatWrapping;map.repeat.x=2;map.offset.x=.65/Math.PI;map.anisotropy=2;
 const material=new T.MeshBasicMaterial({map,side:T.BackSide,transparent:true,alphaTest:.035,depthWrite:false,fog:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec2 vBackdropXZ;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\n vBackdropXZ = position.xz;');
  shader.fragmentShader='varying vec2 vBackdropXZ;\n'+shader.fragmentShader;
  // Planar meadow UVs prevent radial streaks when viewed from above. Both
  // coordinates mirror at tile edges; the forest retains its panoramic mapping.
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 meadowUv = abs(mod(vBackdropXZ * vec2(0.03, 0.12), 2.0) - 1.0);
   meadowUv.y = 0.02 + meadowUv.y * 0.27;
   vec4 woodland = texture2D(map, vMapUv);
   vec4 meadow = texture2D(map, meadowUv);
   diffuseColor *= mix(meadow, woodland, smoothstep(0.27, 0.34, vMapUv.y));
  `);
 };
 material.customProgramCacheKey=()=> 'painted-meadow-planar-v2';
 // Lay the painted meadow along the ground, then turn the distant woodland up.
 // Its inner ellipse overlaps the planted lawn without creating a vertical wall.
 const geometry=new T.CylinderGeometry(62,62,2,128,2,true);
 const positions=geometry.attributes.position!,uv=geometry.attributes.uv!;
 // Preserve forest proportions and project the foreground onto a shallow skirt.
 for(let i=0;i<positions.count;i++){
  const row=uv.getY(i);
  positions.setY(i,row===1?30:row===.5?-.5:.24);
  if(row===0){positions.setX(i,positions.getX(i)*18/62);positions.setZ(i,positions.getZ(i)*14/62);}
  uv.setY(i,row===1?1:row===.5?.33:0);
 }
 geometry.computeBoundingSphere();
 const horizon=new T.Mesh(geometry,material);horizon.name='Painted woodland · 360 degree horizon';
 horizon.renderOrder=-2;scene.add(horizon);
 const daylight=new T.Color('#ffffff'),dusk=new T.Color('#718098'),rain=new T.Color('#bac6c8');
 return {triangles:geometry.index!.count/3,update(day:number,raining:boolean){
  material.color.copy(dusk).lerp(daylight,day);
  if(raining)material.color.multiply(rain);
 }};
}
