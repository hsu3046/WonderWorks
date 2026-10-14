// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as THREE from 'three';
import {labelVertex,labelFragment} from './holo';
import {HUB,WINDOW,LABEL_RECT,drawBadge,drawPackFace} from './label';
import type {Shell} from './settings';
/** Scene units: a real cassette is 100 × 63.5 × 12 mm. */
export const WIDTH=4,HEIGHT=2.54,DEPTH=.48,CORNER=.14;
const ROLLER={x:1.42,y:-.92,radius:.09};
export interface Reel{group:THREE.Group;pack:THREE.Mesh}
export interface Cassette{
 group:THREE.Group;label:THREE.ShaderMaterial;left:Reel;right:Reel;
 setShell(shell:Shell):void;setLabel(texture:THREE.Texture):void;setTape(left:number,right:number):void;dispose():void;
}
function trace(path:THREE.Path,w:number,h:number,r:number,cx=0,cy=0){
 const x=cx-w/2,y=cy-h/2,q=Math.PI/2;
 path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.absarc(x+w-r,y+r,r,-q,0,false);path.lineTo(x+w,y+h-r);path.absarc(x+w-r,y+h-r,r,0,q,false);
 path.lineTo(x+r,y+h);path.absarc(x+r,y+h-r,r,q,2*q,false);path.lineTo(x,y+r);path.absarc(x+r,y+r,r,2*q,3*q,false);path.closePath();
}
function roundRect(w:number,h:number,r:number,cx=0,cy=0){const s=new THREE.Shape();trace(s,w,h,r,cx,cy);return s;}
function roundHole(w:number,h:number,r:number,cx:number,cy:number){const p=new THREE.Path();trace(p,w,h,r,cx,cy);return p;}
function circleHole(cx:number,cy:number,r:number){const p=new THREE.Path();p.absarc(cx,cy,r,0,Math.PI*2,true);return p;}
const hubHoles=()=>[circleHole(-HUB.x,HUB.y,HUB.radius),circleHole(HUB.x,HUB.y,HUB.radius)];
const windowHole=()=>roundHole(WINDOW.width,WINDOW.height,WINDOW.radius,WINDOW.x,WINDOW.y);
/** Extruded half shell. Bevel extends 0.025 on both ends, so the span is 0 … 0.24 after translation. The front window encloses both hubs; holes never overlap. */
function halfShell(withWindow:boolean){
 const shape=roundRect(WIDTH-.04,HEIGHT-.04,CORNER);if(withWindow)shape.holes.push(windowHole());else shape.holes.push(...hubHoles());
 const g=new THREE.ExtrudeGeometry(shape,{depth:.19,bevelEnabled:true,bevelThickness:.025,bevelSize:.02,bevelSegments:3,curveSegments:14});
 g.translate(0,0,.025);return g;
}
function flat(radius:number,height:number,segments:number){return new THREE.CylinderGeometry(radius,radius,height,segments,1,false).rotateX(Math.PI/2);}
export function buildCassette():Cassette{
 const group=new THREE.Group(),disposables:{dispose():void}[]=[];
 const keep=<T extends {dispose():void}>(item:T)=>{disposables.push(item);return item;};
 const shellMat=keep(new THREE.MeshPhysicalMaterial({color:'#f26cb6',transparent:true,opacity:.6,roughness:.16,metalness:0,clearcoat:1,clearcoatRoughness:.06,iridescence:.35,iridescenceIOR:1.3,iridescenceThicknessRange:[160,420],envMapIntensity:1.1,depthWrite:false}));
 const seamMat=keep(new THREE.MeshStandardMaterial({color:'#c23d87',roughness:.45}));
 const plateMat=keep(new THREE.MeshStandardMaterial({color:'#fbe0ee',roughness:.9,side:THREE.DoubleSide}));
 const headMat=keep(new THREE.MeshPhysicalMaterial({color:'#f26cb6',roughness:.4,clearcoat:.6,transparent:true,opacity:.88,depthWrite:false}));
 const glassMat=keep(new THREE.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.2,roughness:.04,clearcoat:1,clearcoatRoughness:.04,iridescence:.7,iridescenceIOR:1.33,iridescenceThicknessRange:[200,500],depthWrite:false}));
 const hubMat=keep(new THREE.MeshPhysicalMaterial({color:'#f7f4f8',roughness:.35,clearcoat:.6,clearcoatRoughness:.15}));
 const darkMat=keep(new THREE.MeshStandardMaterial({color:'#17131c',roughness:.4}));
 const insideMat=keep(new THREE.MeshStandardMaterial({color:'#0f0c13',roughness:.5,side:THREE.BackSide}));
 const packWall=keep(new THREE.MeshPhysicalMaterial({color:'#3a1f17',roughness:.3,clearcoat:.5,clearcoatRoughness:.2}));
 const packFaceTexture=keep(new THREE.CanvasTexture(drawPackFace()));packFaceTexture.colorSpace=THREE.SRGBColorSpace;
 const packFace=keep(new THREE.MeshStandardMaterial({map:packFaceTexture,roughness:.42}));
 const tapeMat=keep(new THREE.MeshStandardMaterial({color:'#2b1710',roughness:.45,side:THREE.DoubleSide}));
 const screwMat=keep(new THREE.MeshStandardMaterial({color:'#d2cad4',metalness:1,roughness:.32}));
 const padMat=keep(new THREE.MeshStandardMaterial({color:'#8a2a4a',roughness:.8}));
 const badgeTexture=keep(new THREE.CanvasTexture(drawBadge('#c23d87')));badgeTexture.colorSpace=THREE.SRGBColorSpace;
 const badgeMat=keep(new THREE.MeshBasicMaterial({map:badgeTexture,transparent:true}));
 const label=keep(new THREE.ShaderMaterial({vertexShader:labelVertex,fragmentShader:labelFragment,uniforms:{uMap:{value:null},uHolo:{value:.85},uKey:{value:new THREE.Vector3(-3,5,6)},uRect:{value:new THREE.Vector4(...LABEL_RECT)},uScale:{value:1}}}));
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],parent:THREE.Object3D=group)=>{keep(geometry);const mesh=new THREE.Mesh(geometry,material);parent.add(mesh);return mesh;};
 // Two translucent halves meet at a darker seam. Each half is offset so transparency sorting follows the camera.
 const front=add(halfShell(true).translate(0,0,-.12),shellMat);front.position.z=.12;front.renderOrder=10;
 const back=add(halfShell(false).rotateY(Math.PI).translate(0,0,.12),shellMat);back.position.z=-.12;back.renderOrder=10;
 add(new THREE.ExtrudeGeometry(roundRect(WIDTH+.015,HEIGHT+.015,CORNER+.008),{depth:.05,bevelEnabled:false,curveSegments:14}).translate(0,0,-.025),seamMat);
 // Printed label with the same window and hub openings, lying just above the front face.
 const labelShape=roundRect(LABEL_RECT[2],LABEL_RECT[3],.08,LABEL_RECT[0]+LABEL_RECT[2]/2,LABEL_RECT[1]+LABEL_RECT[3]/2);
 labelShape.holes.push(windowHole());
 add(new THREE.ShapeGeometry(labelShape,18).translate(0,0,.2415),label);
 const glassShape=roundRect(WINDOW.width,WINDOW.height,WINDOW.radius,WINDOW.x,WINDOW.y);glassShape.holes.push(...hubHoles());
 const glass=add(new THREE.ShapeGeometry(glassShape,14).translate(0,0,.226),glassMat);glass.renderOrder=11;
 // Matte slip sheet behind the reels, visible through both faces.
 // Kept well inside the walls so its edge never reads as a second slab through the translucent sides.
 const plateShape=roundRect(WIDTH-.62,HEIGHT-.58,CORNER);plateShape.holes.push(...hubHoles());
 add(new THREE.ShapeGeometry(plateShape,14).translate(0,0,-.07),plateMat);
 // Reels: white toothed hubs inside the openings, tape packs behind the window.
 const makeReel=(x:number):Reel=>{
  const reel=new THREE.Group();reel.position.set(x,HUB.y,0);group.add(reel);
  add(new THREE.RingGeometry(.2,.3,48).translate(0,0,.2),hubMat,reel);
  add(new THREE.RingGeometry(.2,.3,48).rotateY(Math.PI).translate(0,0,-.2),hubMat,reel);
  add(new THREE.CylinderGeometry(.3,.3,.4,48,1,true).rotateX(Math.PI/2),hubMat,reel);
  add(new THREE.CylinderGeometry(.2,.2,.4,32,1,true).rotateX(Math.PI/2),insideMat,reel);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;const tooth=add(new THREE.BoxGeometry(.055,.09,.38),darkMat,reel);tooth.position.set(Math.cos(a)*.165,Math.sin(a)*.165,0);tooth.rotation.z=a;}
  add(new THREE.CircleGeometry(.2,32).translate(0,0,-.19),darkMat,reel);
  const pack=add(flat(1,.3,96),[packWall,packFace,packFace],reel);pack.position.z=0;
  return {group:reel,pack};
 };
 const left=makeReel(-HUB.x),right=makeReel(HUB.x);
 // Tape path: packs feed the bottom rollers and the long run behind the head opening.
 const ribbon=()=>add(new THREE.PlaneGeometry(1,.3).rotateX(Math.PI/2),tapeMat);
 const leftRun=ribbon(),rightRun=ribbon(),bottomRun=ribbon();
 bottomRun.position.set(0,ROLLER.y-ROLLER.radius,0);bottomRun.scale.x=ROLLER.x*2;
 for(const x of [-ROLLER.x,ROLLER.x]){const roller=add(flat(ROLLER.radius,.36,24),darkMat);roller.position.set(x,ROLLER.y,0);}
 // Head opening plate with three access windows and a pressure pad.
 const head=new THREE.Shape();head.moveTo(-1.12,-1.25);head.lineTo(1.12,-1.25);head.lineTo(.94,-.86);head.lineTo(-.94,-.86);head.closePath();
 const headPlate=add(new THREE.ShapeGeometry(head,2).translate(0,0,.242),headMat);headPlate.renderOrder=12;
 for(const x of [-.6,0,.6]){const opening=add(new THREE.BoxGeometry(.2,.16,.03),darkMat);opening.position.set(x,-1.06,.246);}
 const pad=add(new THREE.BoxGeometry(.16,.06,.03),padMat);pad.position.set(0,-.95,.247);
 // Screws on both faces.
 for(const [x,y] of [[-1.82,1.1],[1.82,1.1],[-1.82,-1.1],[1.82,-1.1],[0,1.1]])for(const z of [.245,-.245]){const screw=add(new THREE.CylinderGeometry(.05,.05,.03,16).rotateX(Math.PI/2),screwMat);screw.position.set(x,y,z);}
 // Back face: moulded ribs and a side-B badge.
 const ribMat=keep(new THREE.MeshStandardMaterial({color:'#c23d87',roughness:.5,transparent:true,opacity:.85}));
 for(const y of [-.3,-.46,-.62,-.78,-.94]){const rib=add(new THREE.BoxGeometry(3.3,.016,.012),ribMat);rib.position.set(0,y,-.246);}
 const badge=add(new THREE.CircleGeometry(.16,32).rotateY(Math.PI),badgeMat);badge.position.set(1.55,.95,-.247);
 const place=(mesh:THREE.Mesh,ax:number,ay:number,bx:number,by:number)=>{mesh.position.set((ax+bx)/2,(ay+by)/2,0);mesh.rotation.z=Math.atan2(by-ay,bx-ax);mesh.scale.x=Math.hypot(bx-ax,by-ay);};
 const cassette:Cassette={
  group,label,left,right,
  setShell(shell){shellMat.color.set(shell.color);headMat.color.set(shell.color);seamMat.color.set(shell.seam);ribMat.color.set(shell.seam);plateMat.color.set(shell.plate);
   const nextBadge=new THREE.CanvasTexture(drawBadge(shell.seam));nextBadge.colorSpace=THREE.SRGBColorSpace;badgeMat.map?.dispose();badgeMat.map=nextBadge;badgeMat.needsUpdate=true;},
  setLabel(texture){label.uniforms.uMap!.value=texture;},
  setTape(leftRadius,rightRadius){
   left.pack.scale.set(leftRadius,leftRadius,1);right.pack.scale.set(rightRadius,rightRadius,1);
   place(leftRun,-HUB.x,HUB.y-leftRadius,-ROLLER.x,ROLLER.y+ROLLER.radius);place(rightRun,HUB.x,HUB.y-rightRadius,ROLLER.x,ROLLER.y+ROLLER.radius);
  },
  dispose(){for(const item of disposables)item.dispose();badgeMat.map?.dispose();group.removeFromParent();},
 };
 return cassette;
}
