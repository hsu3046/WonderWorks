// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
/** Original GLSL for the printed label: pink hues drift to violet and blue with viewing angle, plus a sweeping gloss band, diffraction lines and glitter. */
export const labelVertex=/* glsl */`
uniform vec4 uRect;
varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;varying vec3 vLocalView;
void main(){
 vUv=(position.xy-uRect.xy)/uRect.zw;
 vec4 world=modelMatrix*vec4(position,1.);
 vNormal=normalize(mat3(modelMatrix)*vec3(0.,0.,1.));
 vView=normalize(cameraPosition-world.xyz);
 // The label is never scaled, so the transposed rotation returns the view direction to label space.
 vLocalView=normalize(transpose(mat3(modelMatrix))*vView);
 gl_Position=projectionMatrix*viewMatrix*world;
}`;
export const labelFragment=/* glsl */`
uniform sampler2D uMap;uniform float uHolo;uniform vec3 uKey;uniform float uScale;
varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;varying vec3 vLocalView;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 palette(float t){
 t=fract(t);
 vec3 pink=vec3(.98,.42,.80),violet=vec3(.58,.36,.98),blue=vec3(.30,.56,1.),cyan=vec3(.48,.88,.98);
 vec3 a=t<.34?mix(pink,violet,t/.34):t<.67?mix(violet,blue,(t-.34)/.33):mix(blue,cyan,(t-.67)/.33);
 return a;
}
void main(){
 vec3 base=texture2D(uMap,vUv).rgb;
 vec3 n=normalize(vNormal),v=normalize(vView);
 float ndv=max(dot(n,v),0.);
 float fresnel=pow(1.-ndv,2.4);
 vec2 tilt=vLocalView.xy;
 float phase=dot(tilt,vec2(1.45,.95));
 float wave=sin(vUv.x*5.3+vUv.y*3.2+phase*3.1)*.5+.5;
 vec3 holo=palette(phase*.85+wave*.32+vUv.y*.12);
 float lum=dot(base,vec3(.2126,.7152,.0722));
 float sat=max(base.r,max(base.g,base.b))-min(base.r,min(base.g,base.b));
 float pinkness=smoothstep(.1,.42,sat)*smoothstep(0.,.22,base.r-base.g);
 float light=smoothstep(.5,.95,lum);
 // Hue drift grows as the cassette turns away from the viewer.
 float drift=pinkness*uHolo*(.3+.7*smoothstep(0.,.55,abs(phase)));
 vec3 col=mix(base,holo*(lum*1.35+.18),drift*.75);
 col+=holo*light*.14*uHolo;
 // Wide gloss band sweeping with the tilt.
 float band=vUv.x*.78+vUv.y*.42-(phase*1.55+.62);
 float sweep=exp(-band*band*8.5);
 col+=(vec3(.85)+holo*.7)*sweep*(.12+.22*uHolo)*(.45+.55*light+.35*pinkness);
 // Fine diagonal diffraction lines, faded when the label is too small on screen to resolve them.
 float lineCoord=(vUv.x*1.9+vUv.y)*uScale*190.+phase*58.;
 float lines=pow(sin(lineCoord)*.5+.5,6.);
 float lineFade=1.-smoothstep(.9,2.6,fwidth(lineCoord));
 col+=holo*lines*lineFade*.17*uHolo*(.35+fresnel);
 // Two sizes of glitter that change with the viewing angle.
 vec2 cell=floor(vUv*vec2(170.,92.));
 float fine=step(.972,hash(cell+floor(tilt*7.)))*step(.45,hash(cell*1.7+2.));
 float coarse=step(.985,hash(floor(vUv*vec2(60.,32.))*3.1+floor(tilt*4.+.5)))*1.6;
 col+=vec3(1.)*(fine+coarse)*.4*uHolo*(.3+.7*pinkness+.4*light);
 vec3 h=normalize(normalize(uKey)+v);
 col+=vec3(1.,.96,1.)*pow(max(dot(n,h),0.),52.)*.32;
 col+=fresnel*holo*.16*uHolo;
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
