// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palettes, qrColour } from './state';
import type { StudioState } from './state';
const rand=(n:number)=>{const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x);};
function petal(length:number,width:number,curl:number):T.BufferGeometry {
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  for(let y=0;y<=12;y++)for(let x=0;x<=8;x++){
    const t=y/12,u=x/8*2-1,w=Math.pow(Math.sin(Math.PI*t),.5)*width;
    vertices.push(u*w,(1-Math.cos(t*Math.PI*.7))*curl+u*u*.035+Math.sin(u*8+t*4)*.004*t,t*length);uvs.push(x/8,t);
  }
  for(let y=0;y<12;y++)for(let x=0;x<8;x++){const a=y*9+x;indices.push(a,a+9,a+1,a+1,a+9,a+10);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}
// Reference foliage rises from the neck, fans outward, then curls down at the tip.
function tulipLeaf():T.BufferGeometry {
  const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let y=0;y<=20;y++)for(let x=0;x<=8;x++){
    const t=y/20,u=x/8*2-1;
    const width=.29*Math.pow(Math.sin(Math.PI*t),.85)*(1-.2*t);
    vertices.push(u*width,2.65*t-1.25*t*t*t,1.65*t*t+.07*u*u*Math.sin(Math.PI*t));uvs.push(x/8,t);
  }
  for(let y=0;y<20;y++)for(let x=0;x<8;x++){const a=y*9+x;indices.push(a,a+9,a+1,a+1,a+9,a+10);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
// Species differ in petal silhouette, layering and cup depth, not only colour.
function blossom(species:number,opening=0):T.BufferGeometry{
  const pieces:T.BufferGeometry[]=[];
  const layers=[6,2,2,7][species]!;
  for(let layer=0;layer<layers;layer++){
    const count=[Math.max(4,10-layer),21,3,12+layer][species]!;
    for(let i=0;i<count;i++){
      const scale=1-layer*([.145,.12,.06,.12][species]!);
      let g:T.BufferGeometry;
      if(species===2||species===0){
        const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
        // Six broad upright petals close gently around an open tulip cup.
        for(let y=0;y<=12;y++)for(let x=0;x<=8;x++){
          const t=y/12,u=x/8*2-1;
          const radius=species===0?.025+.28*Math.sin(t*Math.PI*.60):.045+.135*Math.pow(Math.sin(Math.PI*t*.84),.72)+opening*.022*t*t;
          // Rounded tips drop at the petal edges instead of a flat cut rim.
          const angle=u*(species===0?.60:(.48+.62*Math.sin(t*Math.PI*.65)));
          const height=species===0?t*(.30+layer*.065)-.052*t*t*t+Math.sin(u*5+i)*.013*t*t:t*(.59-.075*Math.pow(Math.abs(u),2.4))-opening*.025*t*t+Math.sin(u*4+i*1.9)*.009*t*t;
          vertices.push(Math.sin(angle)*radius,height,Math.cos(angle)*radius);uvs.push(x/8,t);
        }
        for(let y=0;y<12;y++)for(let x=0;x<8;x++){const a=y*9+x;indices.push(a,a+9,a+1,a+1,a+9,a+10);}
        g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.computeVertexNormals();g.scale(scale,scale,scale);
      }else{
        g=petal(.31*scale,([.135,.039,.13,.068][species]!)*scale,([.13,.026,.13,.115][species]!)*scale);
        g.rotateX(-layer*(species===3?.115:.19));
      }
      if(species===0){const v=.86+rand(i+layer*13)*.28;g.scale(v,1,v);g.rotateX((rand(i+layer*9)-.5)*.27);g.rotateZ((rand(i+layer*17)-.5)*.16);}
      g.rotateY(i/count*Math.PI*2+layer*(species===2?Math.PI/3:.6));g.translate(0,layer*(species===0?.044:.024),0);
      // Inner whorls deepen continuously; each petal fades softly toward its tip.
      const colors:number[]=[],depths:number[]=[];
      for(let y=0;y<=12;y++)for(let x=0;x<=8;x++){
        const t=y/12,u=x/8*2-1;
        const whorl=layer/Math.max(1,layers-1);
        const layered=species===0||species===3;
        const seed=i+layer*11;
        const blushAxis=(rand(seed+61)-.5)*.65;
        const streak=Math.exp(-Math.pow((u-blushAxis)/(.38+rand(seed+31)*.5),2));
        // Each tepal has its own translucent blush: unequal strength, height and width.
        const tulipDepth=Math.pow(1-t,.65+rand(seed+43)*1.5)*(.32+rand(seed+17)*.35)+streak*Math.sin(Math.PI*t)*(.16+rand(seed+29)*.26);
        const depth=layered?Math.min(1,whorl*.83+Math.pow(1-t,1.4)*.27):species===2?Math.min(.85,tulipDepth):Math.pow(1-t,1.35)*.52;
        depths.push(depth);
        const light=1-depth*.30-.018*Math.cos(u*Math.PI*6)*(1-t);
        colors.push(light,light*(1-depth*.13),light*(1-depth*.06));
      }
      g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('petalDepth',new T.Float32BufferAttribute(depths,1));pieces.push(g);
    }
  }
  const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return g;
}
// Blend actual pigment colour per bloom, rather than merely darkening its centre.
function usePigmentGradient(material:T.MeshPhysicalMaterial){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float petalDepth; attribute vec3 centrePigment; varying float vPetalDepth; varying vec3 vCentrePigment;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPetalDepth = petalDepth; vCentrePigment = centrePigment;');
    shader.fragmentShader='varying float vPetalDepth; varying vec3 vCentrePigment;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vCentrePigment, smoothstep(0.0, 1.0, vPetalDepth) * 0.88);');
  };
  material.customProgramCacheKey=()=> 'botanical-pigment-v1';
}
// Fine longitudinal ridges; one shared texture, no external image or per-frame upload.
function petalGrain():T.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
  const ctx=canvas.getContext('2d')!;const data=ctx.createImageData(128,256);
  for(let y=0;y<256;y++)for(let x=0;x<128;x++){
    const value=128+Math.sin(x*.87+Math.sin(y*.025)*.65)*17+Math.sin(x*2.4+y*.018)*5+(rand(x+y*128)-.5)*7;
    const j=(y*128+x)*4;data.data[j]=data.data[j+1]=data.data[j+2]=value;data.data[j+3]=255;
  }
  ctx.putImageData(data,0,0);const texture=new T.CanvasTexture(canvas);return texture;
}
function curvedStem():T.BufferGeometry {
  const curve=new T.QuadraticBezierCurve3(new T.Vector3(0,-.5,0),new T.Vector3(.16,0,.045),new T.Vector3(0,.5,0));
  return new T.TubeGeometry(curve,12,.009,5,false);
}
// One instanced centre per flower; botanical parts share the bloom transform.
function flowerCentre(tulip:boolean):T.BufferGeometry {
  const parts:T.BufferGeometry[]=[];
  const add=(g:T.BufferGeometry,colour:string,x:number,y:number,z:number)=>{
    g.translate(x,y,z);const c=new T.Color(colour),colors:number[]=[];
    for(let i=0;i<g.getAttribute('position').count;i++)colors.push(c.r,c.g,c.b);
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));parts.push(g);
  };
  if(tulip){
    // Six filaments with elongated pollen-bearing anthers surround a three-lobed stigma.
    add(new T.CylinderGeometry(.018,.026,.21,10),'#9ea753',0,.125,0);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,g=new T.SphereGeometry(1,10,6);g.scale(.018,.01,.029);g.rotateY(a);
      add(g,'#d8cf81',Math.sin(a)*.014,.238,Math.cos(a)*.014);
    }
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,r=.066,h=.205+(i%2)*.012;
      add(new T.CylinderGeometry(.007,.012,h,6),'#d4bc6c',Math.sin(a)*r,h/2+.025,Math.cos(a)*r);
      const g=new T.SphereGeometry(1,10,7);g.scale(.011,.031,.015);g.rotateZ(.12*Math.sin(a));
      add(g,'#b2a078',Math.sin(a)*r,h+.028,Math.cos(a)*r);
    }
  }else{
    const base=new T.SphereGeometry(1,16,8);base.scale(.085,.036,.085);add(base,'#b78a2f',0,.025,0);
    for(let i=0;i<64;i++){
      const r=.08*Math.sqrt((i+.5)/64),a=i*2.399963;
      add(new T.SphereGeometry(.009,5,4),i%3?'#e0b448':'#a77829',Math.cos(a)*r,.035+.026*Math.sqrt(1-r*r/.007),Math.sin(a)*r);
    }
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());return geometry;
}
interface Bloom {position:T.Vector3;rotation:T.Quaternion;scale:number;target:T.Vector3;ink:T.Color;colour:T.Color;}
export class Garden {
  private renderer:T.WebGLRenderer;
  private scene=new T.Scene();
  private environment:T.WebGLRenderTarget;
  private camera=new T.OrthographicCamera(-4.5,4.5,4, -4,.1,80);
  private controls:OrbitControls;
  private flowers:T.InstancedMesh;
  private hearts:T.InstancedMesh;
  private stems:T.InstancedMesh;
  private leaves:T.InstancedMesh;
  private modules:T.InstancedMesh;
  private props=new T.Group();
  private ground:T.Mesh;
  private blooms:Bloom[]=[];
  private dummy=new T.Object3D();
  private state:StudioState;
  private size=29;
  private count=0;
  private progress=0;
  private target=0;
  private raf=0;
  private last=0;
  private time=0;
  private closed=false;
  private observer:ResizeObserver;
  private abort=new AbortController();
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private viewPosition=new T.Vector3(5,3.3,8);
  private viewTarget=new T.Vector3(0,-.1,0);
  private pointer:{x:number;y:number;id:number}|null=null;
  private material=new T.MeshPhysicalMaterial({roughness:.72,side:T.DoubleSide,vertexColors:true,sheen:.3,sheenColor:'#ffe9df',sheenRoughness:.8,transmission:.025,thickness:.025,ior:1.32});
  private grain=petalGrain();
  private tulipMaterial=new T.MeshPhysicalMaterial({roughness:.67,metalness:0,side:T.DoubleSide,vertexColors:true,transmission:.16,thickness:.035,ior:1.35,sheen:.25,sheenColor:'#fff2e5',sheenRoughness:.85,bumpMap:this.grain,bumpScale:.012});
  private centerMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.83});
  private stemMaterial=new T.MeshStandardMaterial({color:'#496145',roughness:.88});
  private leafMaterial=new T.MeshPhysicalMaterial({color:'#466835',roughness:.53,side:T.DoubleSide,sheen:.18});
  private tileMaterial=new T.MeshBasicMaterial({color:'#ffffff',toneMapped:false});
  private qrFlowerMaterial=new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,toneMapped:false});
  private countMax=2600;
  constructor(private host:HTMLElement,state:StudioState,private toggle:()=>void,private settled:()=>void){
    this.state=state;
    usePigmentGradient(this.material);usePigmentGradient(this.tulipMaterial);
    this.renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.setClearColor('#f6f4ec',0);
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    const pmrem=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();
    this.environment=pmrem.fromScene(room,.08);this.scene.environment=this.environment.texture;this.scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
    this.material.bumpMap=this.grain;this.material.bumpScale=.006;this.leafMaterial.bumpMap=this.grain;this.leafMaterial.bumpScale=.008;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;host.append(this.renderer.domElement);
    this.camera.position.copy(this.viewPosition);this.camera.lookAt(this.viewTarget);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.copy(this.viewTarget);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.enablePan=false;this.controls.enableZoom=false;this.controls.minPolarAngle=.25;this.controls.maxPolarAngle=Math.PI*.52;this.controls.rotateSpeed=.6;
    this.scene.add(new T.HemisphereLight('#fff9e9','#8b927e',1.1));
    const light=new T.DirectionalLight('#fff5e9',2.1);light.position.set(-4,8,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-6;light.shadow.camera.right=6;light.shadow.camera.top=6;light.shadow.camera.bottom=-6;light.shadow.normalBias=.025;light.shadow.bias=-.0003;light.shadow.radius=4;this.scene.add(light);
    const fill=new T.DirectionalLight('#e8eaf8',.65);fill.position.set(5,2,-3);this.scene.add(fill);
    this.ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.025}));this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-2.15;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.flowers=new T.InstancedMesh(blossom(0),this.material,this.countMax);
    this.hearts=new T.InstancedMesh(flowerCentre(false),this.centerMaterial,this.countMax);
    this.stems=new T.InstancedMesh(new T.CylinderGeometry(.008,.012,1,4),this.stemMaterial,this.countMax);
    const leaf=petal(.26,.075,.055);leaf.rotateX(.45);
    this.leaves=new T.InstancedMesh(leaf,this.leafMaterial,this.countMax*2);
    this.modules=new T.InstancedMesh(new T.PlaneGeometry(1,1),this.tileMaterial,this.countMax);
    for(const mesh of [this.flowers,this.hearts,this.stems,this.leaves,this.modules]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.scene.add(mesh);}
    this.flowers.castShadow=true;this.stems.castShadow=true;this.leaves.castShadow=true;this.scene.add(this.props);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
    const opts={signal:this.abort.signal};
    host.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)this.pointer={x:e.clientX,y:e.clientY,id:e.pointerId};},opts);
    host.addEventListener('pointerup',e=>{const p=this.pointer;this.pointer=null;if(p&&p.id===e.pointerId&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<5)this.toggle();},opts);
    host.addEventListener('pointercancel',()=>{this.pointer=null;},opts);
    host.addEventListener('pointerleave',()=>{this.pointer=null;},opts);
    host.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.toggle();}},opts);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;}else{this.last=0;this.run();}},opts);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.closed=true;cancelAnimationFrame(this.raf);host.dispatchEvent(new CustomEvent('garden-error',{detail:'The garden lost its graphics connection. Reload to continue.'}));},opts);
    this.controls.addEventListener('change',this.run);this.resize();this.run();
  }
  private resize(){const r=this.host.getBoundingClientRect();this.renderer.setSize(r.width,r.height);const aspect=r.width/r.height;const h=Math.max(3.7,3.7/aspect);this.camera.left=-h*aspect;this.camera.right=h*aspect;this.camera.top=h;this.camera.bottom=-h;this.camera.updateProjectionMatrix();this.run();}
  update(state:StudioState,matrix:{size:number;data:Uint8Array}){
    this.state={...state};this.size=matrix.size;
    const indices:number[]=[];matrix.data.forEach((v,i)=>{if(v)indices.push(i);});this.count=indices.length;
    if(this.count>this.countMax)throw new Error('This link needs too many flowers. Try a shorter address.');
    this.clearMorph();this.flowers.count=this.count;
    this.flowers.geometry.dispose();this.flowers.geometry=blossom(state.template);
    const pigments=new T.InstancedBufferAttribute(new Float32Array(this.countMax*3),3);this.flowers.geometry.setAttribute('centrePigment',pigments);
    // Stable per-flower morph weights produce buds, half-open and open tulips.
    if(state.template===2){
      const open=blossom(2,1);
      this.flowers.geometry.morphAttributes.position=[open.getAttribute('position').clone()];
      this.flowers.geometry.morphAttributes.normal=[open.getAttribute('normal').clone()];open.dispose();
      const sample=new T.Mesh(this.flowers.geometry);
      for(let i=0;i<this.count;i++){sample.morphTargetInfluences![0]=rand(i+281);this.flowers.setMorphAt(i,sample);}
      if(this.flowers.morphTexture)this.flowers.morphTexture.needsUpdate=true;
    }
    this.stems.geometry.dispose();this.stems.geometry=curvedStem();
    this.hearts.geometry.dispose();this.hearts.geometry=flowerCentre(state.template===2);
    this.leaves.geometry.dispose();
    const leaf=state.template===2?tulipLeaf():petal(.43,.12,.075);if(state.template!==2)leaf.rotateX(.45);this.leaves.geometry=leaf;
    this.blooms=[];const qrWidth=5.6,step=qrWidth/this.size;
    const extraWhites=new Set<number>();
    if(state.template===0||state.template===1){
      const limit=state.template===0?32:38;
      for(let offset=0;offset<limit&&extraWhites.size<3;offset++){
        const candidate=(5+offset*11)%limit;
        if(rand(candidate+74+state.template*19)<.9)extraWhites.add(candidate);
      }
    }
    for(let i=0;i<this.count;i++){
      const visible=[32,38,22,30][state.template]!;
      const a=i*2.399963,ratio=((i%visible)+.5)/visible,j=indices[i]!;
      const elevation=Math.acos(1-ratio*.98);
      const radius=[1.42,1.58,1.35,1.46][state.template]!;
      const pos=new T.Vector3(Math.sin(elevation)*Math.cos(a)*radius,Math.cos(elevation)*[1.45,1.55,1.58,1.48][state.template]!-.15+(rand(i+7)-.5)*.28,Math.sin(elevation)*Math.sin(a)*radius);
      let scale=[1.65,1.45,1.55,1.6][state.template]!+rand(i)*(state.template===0?.33:.25);
      // Gently face outer blooms away from the bouquet centre.
      const normal=new T.Vector3(pos.x*.53,1,pos.z*.53).normalize();
      const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),normal);
      q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),a));
      q.multiply(new T.Quaternion().setFromEuler(new T.Euler((rand(i+30)-.5)*.25,0,(rand(i+11)-.5)*.25)));
      if(i>=visible)scale=0;
      const rgb=qrColour(state.palette,j%this.size,Math.floor(j/this.size),this.size);
      const ink=new T.Color().setRGB(rgb[0]!/255,rgb[1]!/255,rgb[2]!/255,T.SRGBColorSpace);
      this.modules.setColorAt(i,ink);
      const colours=palettes[state.palette]!.colours,pick=rand(i+74+state.template*19);
      // Tulips use 60% main colour, 30% neighbouring tones, 10% accent.
      const colourIndex=(pick<.6?0:pick<.9?(i%2?1:5):2);
      const colour=new T.Color(extraWhites.has(i)?'#fff6e5':colours[colourIndex]!).offsetHSL((rand(i+4)-.5)*.015,(rand(i+9)-.5)*.06,(rand(i+16)-.5)*.055);
      const hsl=colour.getHSL({h:0,s:0,l:0});
      const cream=hsl.s<.16||(hsl.h>.085&&hsl.h<.24);
      const centre=new T.Color(cream?'#e6b448':'#bd3c59');
      pigments.setXYZ(i,centre.r,centre.g,centre.b);
      this.blooms.push({position:pos,rotation:q,scale,ink,colour,target:new T.Vector3((j%this.size-(this.size-1)/2)*step,((this.size-1)/2-Math.floor(j/this.size))*step,0)});
      this.flowers.setColorAt(i,this.blooms[i]!.colour);
    }
    this.flowers.count=this.hearts.count=this.stems.count=this.modules.count=this.count;this.leaves.count=this.count*2;
    this.flowers.instanceColor!.needsUpdate=true;this.modules.instanceColor!.needsUpdate=true;
    this.makeProps();this.writeInstances();this.run();
  }
  private clearMorph(){this.flowers.morphTexture?.dispose();this.flowers.morphTexture=null;}
  private mesh(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;this.props.add(o);return o;}
  private makeProps(){
    this.props.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(o.userData.ownedTexture instanceof T.Texture)o.userData.ownedTexture.dispose();const m=o.material;if(Array.isArray(m))m.forEach(v=>v.dispose());else m.dispose();}});this.props.clear();
    const glazeCanvas=document.createElement('canvas');glazeCanvas.width=128;glazeCanvas.height=128;
    const ctx=glazeCanvas.getContext('2d')!;const image=ctx.createImageData(128,128);
    for(let i=0;i<128*128;i++){const v=180+rand(i+83)*45;image.data.set([v,v,v,255],i*4);}ctx.putImageData(image,0,0);
    const glaze=new T.CanvasTexture(glazeCanvas);glaze.wrapS=glaze.wrapT=T.RepeatWrapping;glaze.repeat.set(3,2);
    const ceramic=new T.MeshPhysicalMaterial({color:'#eee4ce',roughness:.3,clearcoat:.65,clearcoatRoughness:.24,bumpMap:glaze,bumpScale:.008,roughnessMap:glaze});
    // Continuous outside, rounded lip and inside wall: the neck has real thickness.
    const profile=[[0,-2.1],[.48,-2.1],[.62,-2.03],[.78,-1.83],[.85,-1.48],[.81,-1.15],[.64,-.84],[.49,-.69],[.48,-.56],[.51,-.51],[.49,-.48],[.44,-.49],[.43,-.57],[.44,-.7],[.59,-.88],[.74,-1.18],[.77,-1.5],[.7,-1.81],[.53,-1.99],[0,-1.99]];
    const curve=new T.SplineCurve(profile.map(([x,y])=>new T.Vector2(x!,y!)));
    const vase=this.mesh(new T.LatheGeometry(curve.getPoints(120),96),ceramic);
    vase.userData.ownedTexture=glaze;
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
    const shadowContext=shadowCanvas.getContext('2d')!;const gradient=shadowContext.createRadialGradient(64,64,10,64,64,64);
    gradient.addColorStop(0,'rgba(45,39,23,0.22)');gradient.addColorStop(.45,'rgba(45,39,23,0.09)');gradient.addColorStop(1,'rgba(45,39,23,0)');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,128,128);
    const shadowTexture=new T.CanvasTexture(shadowCanvas);
    const contact=this.mesh(new T.PlaneGeometry(3,3),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),0,-2.12);
    contact.rotation.x=-Math.PI/2;contact.castShadow=false;contact.receiveShadow=false;contact.userData.ownedTexture=shadowTexture;
    const foot=this.mesh(new T.TorusGeometry(.48,.025,12,72),new T.MeshStandardMaterial({color:'#cfc1a6',roughness:.85}),0,-2.08);foot.rotation.x=Math.PI/2;
  }

  setQR(open:boolean){this.target=open?1:0;if(open){this.viewPosition.copy(this.camera.position);this.viewTarget.copy(this.controls.target);}this.controls.enabled=false;this.run();}
  reset(){if(this.target)return;this.camera.position.set(5,3.3,8);this.controls.target.set(0,-.1,0);this.controls.update();}
  private writeInstances(){
    const t=this.progress,s=t*t*(3-2*t),step=5.6/this.size;
    // Uniform dark ink avoids local light/shadow contrast confusing QR thresholding.
    this.flowers.material=t>.94?this.qrFlowerMaterial:this.state.template===2?this.tulipMaterial:this.material;
    const qrQ=new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0));

    for(let i=0;i<this.count;i++){
      const b=this.blooms[i]!,o=this.dummy;
      o.position.copy(b.position).lerp(b.target,s);
      if(this.state.wind&&!this.reduced.matches)o.position.x+=Math.sin(this.time*.65+i*1.7)*.028*(1-s);
      o.quaternion.copy(b.rotation).slerp(qrQ,s);o.scale.setScalar(T.MathUtils.lerp(b.scale,step*1.2,s));o.updateMatrix();this.flowers.setMatrixAt(i,o.matrix);
      const col=b.colour.clone().lerp(b.ink,s);this.flowers.setColorAt(i,col);
      o.scale.setScalar(b.scale*(this.state.template===1||this.state.template===2?1:0)*(1-T.MathUtils.smoothstep(t,0,.65)));o.updateMatrix();this.hearts.setMatrixAt(i,o.matrix);
      const base=new T.Vector3(b.position.x*.1,-.58,b.position.z*.1);
      const top=b.position;const stemLength=top.distanceTo(base);o.position.copy(base).lerp(top,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),top.clone().sub(base).normalize());const alive=b.scale>0?1-s:0;o.scale.set(alive,stemLength*alive,alive);o.updateMatrix();this.stems.setMatrixAt(i,o.matrix);
      for(let j=0;j<2;j++){
        if(this.state.template===2){
          // Eight separated leaves emerge around the vase rim, not from one central tuft.
          const leafAngle=i/8*Math.PI*2+.15;
          o.position.set(Math.sin(leafAngle)*.29,-.53+(i%2)*.07,Math.cos(leafAngle)*.29);
          o.rotation.set(-.04+rand(i+4)*.12,leafAngle,(rand(i+7)-.5)*.12,'YXZ');
          o.scale.setScalar((1.08+rand(i+3)*.20)*alive*(j===0&&i<8?1:0));
        }else{
          o.position.copy(base).lerp(top,.4+j*.27);o.rotation.set(.15+rand(i+4)*.45,i*2.4+j*3.14,-.25-rand(i+7)*.45,'XYZ');o.scale.setScalar((.8+rand(i)*.5)*alive);
        }
        o.updateMatrix();this.leaves.setMatrixAt(i*2+j,o.matrix);
      }
      o.position.copy(b.target);o.position.z=-.025;o.rotation.set(0,0,0);o.scale.setScalar(step*T.MathUtils.smoothstep(t,.65,.96));o.updateMatrix();this.modules.setMatrixAt(i,o.matrix);
    }
    for(const m of [this.flowers,this.hearts,this.stems,this.leaves,this.modules])m.instanceMatrix.needsUpdate=true;
    if(this.flowers.instanceColor)this.flowers.instanceColor.needsUpdate=true;
    this.props.scale.setScalar(Math.max(.0001,1-T.MathUtils.smoothstep(t,0,.65)));this.props.visible=t<.66;this.ground.visible=t<.85;
  }
  private run=()=>{if(!this.raf&&!this.closed&&!document.hidden)this.raf=requestAnimationFrame(this.draw);};
  private draw=(now:number)=>{
    this.raf=0;if(this.closed)return;const dt=Math.min(.04,(now-(this.last||now-16))/1000);this.last=now;this.time+=dt;
    const old=this.progress;this.progress=T.MathUtils.damp(this.progress,this.target,this.reduced.matches?1000:4.4,dt);
    if(Math.abs(this.progress-this.target)<.001)this.progress=this.target;
    if(this.progress!==old){const s=this.progress*this.progress*(3-2*this.progress);this.camera.position.copy(this.viewPosition).lerp(new T.Vector3(0,0,12),s);this.controls.target.copy(this.viewTarget).lerp(new T.Vector3(),s);this.camera.lookAt(this.controls.target);}
    let moving=false;if(this.progress===0){this.controls.enabled=true;moving=this.controls.update();}
    if(this.progress!==old||this.progress<1)this.writeInstances();
    this.renderer.render(this.scene,this.camera);
    if(this.progress!==old&&this.progress===this.target)this.settled();
    if(this.progress!==this.target||moving||(this.state.wind&&!this.reduced.matches&&this.progress<1))this.run();
  };
  pixels(){
    this.renderer.render(this.scene,this.camera);
    const canvas=document.createElement('canvas');canvas.width=this.renderer.domElement.width;canvas.height=this.renderer.domElement.height;
    const context=canvas.getContext('2d');if(!context)throw new Error('The preview could not be checked.');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(this.renderer.domElement,0,0);
    const image=context.getImageData(0,0,canvas.width,canvas.height);return {data:image.data,width:image.width,height:image.height};
  }
  dispose(){this.closed=true;cancelAnimationFrame(this.raf);this.abort.abort();this.observer.disconnect();this.controls.dispose();this.scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(o.userData.ownedTexture instanceof T.Texture)o.userData.ownedTexture.dispose();const m=o.material;Array.isArray(m)?m.forEach(v=>v.dispose()):m.dispose();}});this.environment.dispose();this.material.dispose();this.tulipMaterial.dispose();this.grain.dispose();this.flowers.morphTexture?.dispose();this.qrFlowerMaterial.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
