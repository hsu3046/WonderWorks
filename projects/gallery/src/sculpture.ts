// SPDX-License-Identifier: GPL-3.0-only
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export function createSculpture(canvas:HTMLCanvasElement){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});}catch{canvas.hidden=true;document.querySelector<HTMLImageElement>('.stage-fallback')!.hidden=false;return {setActive:(_active:boolean)=>{},dispose:()=>{}};}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,50);camera.position.set(0,.1,8.6);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 // Large studio panels produce long, clean reflections across the glass and polished metal.
 const env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight('#ffb890',5);key.position.set(-3,5,5);scene.add(key);
 const fill=new THREE.DirectionalLight('#7caeff',4);fill.position.set(4,1,-2);scene.add(fill);
 const group=new THREE.Group();scene.add(group);
 const chrome=new THREE.MeshPhysicalMaterial({color:'#e9e4dd',metalness:1,roughness:.14,clearcoat:1,iridescence:.55,iridescenceIOR:1.35,iridescenceThicknessRange:[120,420]});
 const coral=new THREE.MeshPhysicalMaterial({color:'#ff7842',metalness:.35,roughness:.18,clearcoat:1,transmission:.32,thickness:.5,ior:1.45});
 const glass=new THREE.MeshPhysicalMaterial({color:'#c4e6fa',metalness:.04,roughness:.05,transmission:.94,thickness:1.4,ior:1.33,iridescence:1,iridescenceThicknessRange:[180,600],clearcoat:1});
 const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(1.08,.245,180,28,2,3),chrome);knot.rotation.set(.3,.3,.1);group.add(knot);
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(.68,48,32),glass);sphere.position.set(.85,.9,.35);group.add(sphere);
 const orange=new THREE.Mesh(new THREE.TorusGeometry(.47,.17,24,80),coral);orange.position.set(-1.4,-.95,.7);orange.rotation.set(.7,.7,-.5);group.add(orange);
 const satellite=new THREE.Mesh(new THREE.SphereGeometry(.21,32,20),chrome);satellite.position.set(1.7,-.7,.2);group.add(satellite);
 const orbitMaterial=new THREE.MeshBasicMaterial({color:'#919bad',transparent:true,opacity:.25});
 const orbit=new THREE.Mesh(new THREE.TorusGeometry(2.17,.006,6,180),orbitMaterial);orbit.rotation.set(.95,.24,-.3);group.add(orbit);
 const orbit2=new THREE.Mesh(new THREE.TorusGeometry(2.0,.005,6,180),orbitMaterial);orbit2.rotation.set(-.6,.5,.9);group.add(orbit2);
 const points=new Float32Array(64*3);for(let i=0;i<64;i++){const a=i*2.399;const r=2.2+(Math.sin(i*91.3)*.5+.5)*.9;points[i*3]=Math.cos(a)*r;points[i*3+1]=Math.sin(a)*r*.8;points[i*3+2]=Math.sin(i*1.7)*1.5;}
 const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));const dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#d7dcef',size:.012,transparent:true,opacity:.5}));group.add(dust);
 let active=true,visible=true,raf=0,last=0,time=0;const target=new THREE.Vector2(),pointer=new THREE.Vector2();
 const draw=(now:number)=>{raf=0;if(!active||!visible||document.hidden)return;const dt=last?Math.min((now-last)/1000,.05):0;last=now;time+=dt;
  // Pointer input spans ±75° horizontally and ±45° vertically, with a gentle approach to the target.
  pointer.lerp(target,.045);group.rotation.y=pointer.x*THREE.MathUtils.degToRad(75);group.rotation.x=-pointer.y*THREE.MathUtils.degToRad(45);
  if(!reduced.matches){knot.rotation.y=.3+time*.12;knot.rotation.z=.1+Math.sin(time*.18)*.18;sphere.position.y=.9+Math.sin(time*.65)*.12;orange.rotation.y=.7+time*.2;group.position.y=Math.sin(time*.38)*.05;dust.rotation.z=time*.01;}
  renderer.render(scene,camera);if(!reduced.matches)raf=requestAnimationFrame(draw);
 };
 const wake=()=>{if(!raf&&active&&visible&&!document.hidden){last=0;raf=requestAnimationFrame(draw);}};
 const setActive=(value:boolean)=>{active=value;if(!value){cancelAnimationFrame(raf);raf=0;last=0;}else wake();};
 const resize=()=>{const {width,height}=canvas.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();group.scale.setScalar(width<480?.91:1.08);wake();};
 const move=(event:PointerEvent)=>{const r=canvas.getBoundingClientRect();target.set(THREE.MathUtils.clamp((event.clientX-r.left)/r.width*2-1,-1,1),THREE.MathUtils.clamp((event.clientY-r.top)/r.height*2-1,-1,1));wake();};
 canvas.addEventListener('pointermove',move);const observer=new ResizeObserver(resize);observer.observe(canvas);
 const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible){cancelAnimationFrame(raf);raf=0;}else wake();},{threshold:.05});visibility.observe(canvas);
 const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;}else wake();};document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',wake);
 resize();wake();return {setActive,dispose(){cancelAnimationFrame(raf);observer.disconnect();visibility.disconnect();canvas.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',wake);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});env.dispose();renderer.dispose();}};
}
