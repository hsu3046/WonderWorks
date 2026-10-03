// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import * as T from 'three';
import {uTime,type Settings} from './shared';
import {createWaveField,waterFieldGLSL,waterUniforms} from './water-field';
import {createOpticalDiffusion} from './optical-diffusion';
export function createWater(scene:T.Scene,renderer:T.WebGLRenderer,camera:T.PerspectiveCamera,s:Settings,garden:T.Group){
 const reflection=new T.WebGLRenderTarget(768,512,{type:T.HalfFloatType,depthBuffer:true});
 const refraction=new T.WebGLRenderTarget(1280,800,{type:T.HalfFloatType,depthBuffer:true});
 refraction.depthTexture=new T.DepthTexture(1280,800,T.UnsignedIntType);
 const diffusion=createOpticalDiffusion(renderer);diffusion.resize(1280,800);
 const mirror=new T.PerspectiveCamera(),matrix=new T.Matrix4(),field=createWaveField(renderer);
 const aboveClip=[new T.Plane(new T.Vector3(0,1,0),.055)],belowClip=[new T.Plane(new T.Vector3(0,-1,0),.055)];
 // Same one-plane HDR shader variant for captures and main. This plane lies far
 // below every scene/camera bound, so the main view clips no garden fragments.
 const neutralClip=[new T.Plane(new T.Vector3(0,1,0),100000)];
 const uniforms={...waterUniforms,uReflection:{value:reflection.texture},uRefraction:{value:refraction.texture},uRefractionSoft:{value:diffusion.texture},uDepth:{value:refraction.depthTexture},uResolution:{value:new T.Vector2(1280,800)},uReflectMatrix:{value:matrix},uProjectionInverse:{value:new T.Matrix4()},uCameraWorld:{value:new T.Matrix4()},uClarity:{value:s.clarity},uDream:{value:s.glow},uSun:{value:waterUniforms.uWaterSun.value},uSunColor:{value:new T.Color('#fff2d4')},uUnder:{value:0}};
 const mat=new T.ShaderMaterial({uniforms,side:T.DoubleSide,vertexShader:`
  ${waterFieldGLSL}
  varying vec3 vWorld;varying vec4 vReflect;uniform mat4 uReflectMatrix;
  void main(){vec3 p=position;vec2 offset;vec3 wave=waterField(p.xz,offset);p.xz+=offset;p.y+=wave.x;
   vWorld=(modelMatrix*vec4(p,1.)).xyz;vReflect=uReflectMatrix*vec4(vWorld,1.);
   gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
 fragmentShader:`${waterFieldGLSL}
  uniform sampler2D uReflection,uRefraction,uRefractionSoft,uDepth;uniform vec2 uResolution;
  uniform mat4 uProjectionInverse,uCameraWorld;uniform float uClarity,uUnder,uDream;
  uniform vec3 uSun,uSunColor;varying vec3 vWorld;varying vec4 vReflect;
  vec3 scenePoint(vec2 uv){float d=texture2D(uDepth,uv).x;vec4 q=uProjectionInverse*vec4(uv*2.-1.,d*2.-1.,1.);return (uCameraWorld*vec4(q.xyz/q.w,1.)).xyz;}
  void main(){vec2 offset;vec3 wave=waterField(vWorld.xz,offset);
   vec3 n=normalize(vec3(-wave.y,1.,-wave.z)),viewDir=normalize(cameraPosition-vWorld);
   float cosine=clamp(abs(dot(n,viewDir)),0.,1.);
   float fresnel=.0204+.9796*pow(1.-cosine,5.);
   if(uUnder>.5){float sinT2=1.333*1.333*(1.-cosine*cosine);
    fresnel=sinT2>=1.?1.:.0204+.9796*pow(1.-sqrt(max(0.,1.-sinT2)),5.);}
   // Artistic reflection lift retains the grazing/TIR limit and vanishes at zero glow.
   fresnel=clamp(fresnel+(1.-fresnel)*.075*uDream,0.,1.);
   vec2 uv=gl_FragCoord.xy/uResolution;vec3 hit=scenePoint(uv);
   // Reconstruct real receiver depth. Thin shoreline water bends and absorbs less.
   float thickness=uUnder>.5?max(0.,-cameraPosition.y):max(0.,vWorld.y-hit.y);
   vec2 bent=clamp(uv+wave.yz*.022*clamp(thickness,.05,1.7),vec2(.002),vec2(.998));
   vec3 bentHit=scenePoint(bent);
   // Reject foreground/above-water samples instead of dragging a bank across the fish.
   if(uUnder<.5&&(bentHit.y>vWorld.y+.065||distance(cameraPosition,bentHit)<distance(cameraPosition,vWorld))){bent=uv;bentHit=hit;}
   float path=uUnder>.5?distance(cameraPosition,vWorld):distance(bentHit,vWorld);
   path=clamp(path,0.,14.);float murk=1.-uClarity;
   vec3 absorption=vec3(.075,.028,.043)+murk*vec3(.46,.24,.29);
   vec3 transmission=exp(-absorption*path);
   vec3 refracted=texture2D(uRefraction,bent).rgb;
   if(uDream>0.){
    // Preserve depth-dependent softness without four displaced copies of the fish.
    vec3 soft=texture2D(uRefractionSoft,bent).rgb;
    refracted=mix(refracted,soft,min(.48,uDream*(.22+min(path,4.)*.05)));
   }
   vec3 transmitted=refracted*transmission;
   transmitted+=vec3(.045,.12,.078)*(1.-transmission)*(.22+murk*.75);
   vec2 ruv=vReflect.xy/vReflect.w*.5+.5;
   vec3 reflected=texture2D(uReflection,clamp(ruv+wave.yz*.045,vec2(.002),vec2(.998))).rgb;
   vec3 col=mix(transmitted,reflected,fresnel);
   if(uUnder<.5){vec3 halfVec=normalize(normalize(uSun)+viewDir);
    float spec=pow(max(0.,dot(n,halfVec)),210.)*1.6+pow(max(0.,dot(n,halfVec)),40.)*.10;
    col+=uSunColor*spec*(1.+.75*uDream);}
   gl_FragColor=vec4(col,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const grid=new T.PlaneGeometry(20,15,180,136);grid.rotateX(-Math.PI/2);
 const index=grid.index!,p=grid.attributes.position,kept:number[]=[];
 for(let i=0;i<index.count;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;if(x*x/99.5+z*z/55.5<1)kept.push(a,b,c);}grid.setIndex(kept);
 const surface=new T.Mesh(grid,mat);surface.renderOrder=1;surface.frustumCulled=false;scene.add(surface);
 const look=new T.Vector3(),up=new T.Vector3(),aboveObjects:{object:T.Object3D;visible:boolean}[]=[];
 let classified=false,skipped=0,mainTriangles=0;const passCounts={reflection:0,refraction:0,main:0};
 function classify(){
  aboveObjects.length=0;const box=new T.Box3();garden.traverse(o=>{if(!(o instanceof T.Mesh))return;
   box.setFromObject(o);if(o.userData.waterAbove===true||box.min.y>.12)aboveObjects.push({object:o,visible:o.visible});
  });classified=true;
 }
 return {invalidateGarden(){classified=false;},surface,uniforms,ripple:field.splat,diagnostics:()=>({...field.diagnostics(),skippedAboveWater:skipped,passDraws:{...passCounts},mainTriangles,diffusion:diffusion.diagnostics()}),
  async prepare(root:T.Object3D,cancelled:()=>boolean=()=>false,mainTarget:T.WebGLRenderTarget|null=null){
   // Water passes use a different clipping/tone-mapping shader variant from the main view.
   // Restore renderer state before awaiting so the live scene can keep rendering normally.
   const target=renderer.getRenderTarget(),tone=renderer.toneMapping,clip=renderer.clippingPlanes;
   let offscreen:Promise<T.Object3D>;
   try{renderer.toneMapping=T.NoToneMapping;renderer.clippingPlanes=aboveClip;renderer.setRenderTarget(reflection);
    offscreen=renderer.compileAsync(root,camera,scene);
   }finally{renderer.setRenderTarget(target);renderer.toneMapping=tone;renderer.clippingPlanes=clip;}
   await offscreen;
   if(!cancelled()){
    // Prewarm both the HDR main view and the direct-output path used at zero glow.
    let main:Promise<T.Object3D>;
    try{renderer.setRenderTarget(mainTarget);renderer.clippingPlanes=mainTarget?neutralClip:clip;main=renderer.compileAsync(root,camera,scene);}
    finally{renderer.setRenderTarget(target);renderer.clippingPlanes=clip;}
    await main;
    if(mainTarget&&!cancelled())await renderer.compileAsync(root,camera,scene);
   }
  },
  resize(w:number,h:number){refraction.setSize(w,h);reflection.setSize(Math.max(1,Math.round(w*.6)),Math.max(1,Math.round(h*.6)));uniforms.uResolution.value.set(w,h);diffusion.resize(w,h);},
  render(dt=0,dreamAmount=s.glow){
   uniforms.uClarity.value=s.clarity;uniforms.uDream.value=dreamAmount;waterUniforms.uWaterTime.value=uTime.value;waterUniforms.uWaterBreeze.value=s.breeze;
   waterUniforms.uWaterDay.value=Math.max(uniforms.uSunColor.value.r,uniforms.uSunColor.value.g,uniforms.uSunColor.value.b)*(s.rain?.32:1)*(1.+dreamAmount*.5);
   const underwater=camera.position.y<0;uniforms.uUnder.value=underwater?1:0;
   camera.updateMatrixWorld();uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);uniforms.uCameraWorld.value.copy(camera.matrixWorld);
   if(!classified)classify();
   const previousTarget=renderer.getRenderTarget(),tone=renderer.toneMapping,previousClip=renderer.clippingPlanes;
   let hidden=false;
   try{
    field.update(dt);surface.visible=false;renderer.toneMapping=T.NoToneMapping;
    // The first scene pass retains every caster, so plants still cast underwater shadows.
    mirror.copy(camera);mirror.position.y=-camera.position.y;camera.getWorldDirection(look);look.add(camera.position);look.y=-look.y;
    up.copy(camera.up);up.y=-up.y;mirror.up.copy(up);mirror.lookAt(look);mirror.updateMatrixWorld();
    matrix.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
    renderer.clippingPlanes=underwater?belowClip:aboveClip;renderer.shadowMap.needsUpdate=true;
    renderer.setRenderTarget(reflection);renderer.render(scene,mirror);passCounts.reflection=renderer.info.render.calls;
    // Skip entire dry planting batches in refraction, not only their fragments.
    skipped=0;hidden=!underwater;if(hidden)for(const item of aboveObjects){item.visible=item.object.visible;if(item.visible){item.object.visible=false;skipped++;}}
    renderer.clippingPlanes=underwater?aboveClip:belowClip;renderer.setRenderTarget(refraction);renderer.render(scene,camera);passCounts.refraction=renderer.info.render.calls;
    if(dreamAmount>0)diffusion.render(refraction.texture);else diffusion.skip();
    if(hidden)for(const item of aboveObjects)item.object.visible=item.visible;hidden=false;
    surface.visible=true;renderer.clippingPlanes=previousTarget?neutralClip:previousClip;renderer.toneMapping=tone;renderer.setRenderTarget(previousTarget);renderer.render(scene,camera);passCounts.main=renderer.info.render.calls;mainTriangles=renderer.info.render.triangles;
   }finally{
    if(hidden)for(const item of aboveObjects)item.object.visible=item.visible;
    surface.visible=true;renderer.clippingPlanes=previousClip;renderer.toneMapping=tone;renderer.setRenderTarget(previousTarget);
   }
  },dispose(){reflection.dispose();refraction.dispose();diffusion.dispose();field.dispose();}
 };
}
