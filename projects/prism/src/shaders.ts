// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const vertex=`
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
export const fragment=`
precision highp float;
uniform sampler2D uImage;
uniform vec2 uTilt;
uniform float uFinish,uIntensity,uScale,uGlare,uGrain,uEdge,uFrame,uZone,uCompare,uAspect;
uniform vec4 uRegion;
uniform vec3 uTint;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 rainbow(float t){return .54+.46*cos(6.2831853*(t+vec3(0.0,.33,.67)));}
float star(vec2 p,float radius){float a=atan(p.y,p.x);return 1.0-smoothstep(radius*.45,radius*.55,length(p)*(1.0+.45*cos(a*5.0)));}
float artMask(vec2 p){return smoothstep(uRegion.x,uRegion.x+.009,p.x)*(1.0-smoothstep(uRegion.z-.009,uRegion.z,p.x))*smoothstep(uRegion.y,uRegion.y+.009,p.y)*(1.0-smoothstep(uRegion.w-.009,uRegion.w,p.y));}
void main(){
 vec2 uv=vUv, p=vec2(uv.x,1.0-uv.y);vec2 physical=(uv-.5)*vec2(uAspect,1.0);
 // Rounded corners in aspect-correct card coordinates.
 vec2 q=abs(physical)-(vec2(uAspect,1.0)*.5-.022);
 float sd=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.022;
 float aa=max(fwidth(sd),.0005),alpha=1.0-smoothstep(-aa,aa,sd);if(alpha<.01)discard;
 vec4 sampled=texture2D(uImage,uv);vec3 base=sampled.rgb;
 if(uCompare>.5){gl_FragColor=vec4(base,alpha);return;}
 vec2 tilt=uTilt;
 vec2 pt=(uv-.5)*vec2(uAspect,1.0);
 float phase=dot(pt,vec2(1.1,.7))*1.6+tilt.x*.72-tilt.y*.54;
 vec3 spectral=rainbow(phase);
 vec2 light=vec2(.18+tilt.x*.75,.75+tilt.y*.6);
 float hotspot=exp(-dot((uv-light)*vec2(1.0,.8),(uv-light)*vec2(1.0,.8))*5.0);
 float ribbon=pow(max(0.0,1.0-abs(dot(pt,vec2(.75,1.0))+tilt.x*.6+tilt.y*.38)),5.0);
 float response=.2+hotspot*.52+ribbon*.38;
 float pattern=0.0,flash=0.0,engraving=0.0;
 float scale=1.0/uScale;
 if(uFinish<.5){
   // Static metallic confetti; each facet reflects at a different viewing angle.
   vec2 grid=pt*vec2(38.0)*scale;vec2 cell=floor(grid);vec2 f=fract(grid)-.5;
   float seed=hash(cell);vec2 offset=vec2(hash(cell+3.7),hash(cell+19.2))*.45-.225;
   float d=length(f-offset);float r=mix(.035,.18,pow(seed,4.0));
   float spot=1.0-smoothstep(r*.55,r,d);
   float hit=pow(max(0.0,cos(seed*6.28+tilt.x*5.0+tilt.y*4.0)),8.0);
   pattern=spot*(.23+hit*.9);flash=spot*hit;
   vec2 s=f-offset;float cross=exp(-abs(s.x)*130.0)*exp(-abs(s.y)*10.0)+exp(-abs(s.y)*130.0)*exp(-abs(s.x)*10.0);
   flash+=cross*step(.89,seed)*hit*.5;
   spectral=rainbow(phase+seed*.3);response*=.65;
 }else if(uFinish<1.5){
   // Parallel diffraction grooves oppose the broad reflected band.
   float band=dot(pt,vec2(1.2,.65))*5.0*scale+tilt.x*1.3-tilt.y*.9;
   spectral=rainbow(band*.65);pattern=.3+.22*sin(band*6.28);
   engraving=sin(dot(pt,vec2(1.2,.65))*750.0*scale)*.035;
   flash=pow(max(0.0,cos(band*3.14)),16.0)*ribbon*.15;
 }else if(uFinish<2.5){
   vec2 g=pt*18.0*scale;vec2 cell=floor(g);vec2 f=fract(g)-.5;
   float seed=hash(cell);float hit=pow(max(0.0,sin(seed*6.28+tilt.x*4.5+tilt.y*3.0)),4.0);
   float shape=star(f,.39);pattern=shape*(.25+hit*.6);
   spectral=rainbow(phase+seed*.32);flash=shape*hit*.52;
   response*=.7;
 }else if(uFinish<3.5){
   vec2 g=pt*15.0*scale;vec2 cell=floor(g);vec2 f=fract(g);float d1=10.0,d2=10.0,id=0.0;
   for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){
     vec2 n=vec2(float(x),float(y));vec2 o=vec2(hash(cell+n),hash(cell+n+47.1));
     float d=length(n+o-f);if(d<d1){d2=d1;d1=d;id=hash(cell+n+10.7);}else{d2=min(d2,d);}
   }}
   float facet=sin(id*17.0+tilt.x*4.0+tilt.y*6.0);
   spectral=rainbow(phase+id*.75);pattern=.18+facet*.2;
   engraving=(1.0-smoothstep(.005,.05,d2-d1))*.08;
   flash=pow(max(0.0,facet),12.0)*.32;
 }else if(uFinish<4.5){
   vec2 c=pt-vec2(-.23,.05);float r=length(c);
   float flow=r+sin(atan(c.y,c.x)*3.0+r*8.0)*.014+sin(c.x*21.0)*.008;
   float lines=sin(flow*1100.0*scale);
   spectral=rainbow(phase+flow*2.0+tilt.y*.35);
   float moving=pow(max(0.0,sin(flow*26.0+tilt.x*6.0-tilt.y*3.0)),5.0);
   pattern=.2+moving*.2;engraving=lines*.11*(.4+ribbon);
   flash=pow(max(0.0,lines),12.0)*moving*.3;
 }else if(uFinish<5.5){
   float grain=hash(floor(pt*420.0*scale));
   float lines=sin((pt.y+sin(pt.x*30.0)*.025)*650.0*scale);
   spectral=mix(vec3(.47,.22,.025),vec3(1.0,.83,.35),hotspot*.65+ribbon*.35);
   pattern=.36;engraving=lines*.055;
   flash=step(.972,grain)*pow(max(0.0,sin(grain*32.0+tilt.x*5.0+tilt.y*3.0)),8.0)*.8;
 }
 // Additional foil structures use static coordinates; only their light response moves.
 if(uFinish>5.5&&uFinish<6.5){
   vec2 orbit=pt-vec2(tilt.x*.1,tilt.y*.1);float radius=length(orbit);
   float arc=atan(orbit.y,orbit.x);
   spectral=rainbow(radius*2.8*scale+sin(arc)*.035+tilt.x*.4-tilt.y*.3);
   float band=pow(.5+.5*cos(radius*20.0*scale-tilt.x*4.0),5.0);
   response=.35+hotspot*.45;pattern=band*.25;
   engraving=sin(radius*780.0*scale)*.035;
   flash=band*ribbon*.25;
 }else if(uFinish>6.5&&uFinish<7.5){
   vec2 grid=pt*10.0*scale;vec2 cell=floor(grid),f=fract(grid)-.5;
   float seed=hash(cell),r=length(f),a=atan(f.y,f.x);
   float rays=pow(max(0.0,cos(a*18.0+seed*6.28)),10.0);
   float ring=smoothstep(.10,.17,r)*(1.0-smoothstep(.32,.46,r));
   float hit=pow(max(0.0,cos(a-tilt.x*3.0+tilt.y*2.0+seed*6.28)),6.0);
   spectral=rainbow(phase+seed*.5+sin(a)*.08);pattern=rays*ring*(.2+hit*.5);
   flash=rays*ring*hit*.8;engraving=ring*rays*.04;response*=.65;
 }else if(uFinish>7.5){
   vec2 grid=pt*180.0*scale;vec2 cell=floor(grid),f=fract(grid)-.5;
   float seed=hash(cell),facet=1.0-smoothstep(.13,.52,length(f));
   float hit=pow(max(0.0,cos(seed*30.0+tilt.x*7.0-tilt.y*5.0)),24.0);
   spectral=rainbow(phase+seed*.8);pattern=facet*.18;
   flash=facet*hit*(.4+seed*.8);engraving=0.0;response*=.6;
 }
 float m=artMask(p);float mask=uZone<.5?1.0:(uZone<1.5?m:1.0-m);
 float lum=dot(base,vec3(.2126,.7152,.0722));
 // The printed ink remains legible: diffraction colours modulate, then reflect light.
 spectral*=mix(vec3(1.0),uTint,.65);
 vec3 metal=base*(.58+spectral*.7)+spectral*(.12+.12*(1.0-lum));
 vec3 result=mix(base,metal,clamp((response+pattern)*uIntensity*mask,0.0,.88));
 float micro=hash(floor(pt*vec2(720.0)*scale));
 float scint=step(.985,micro)*pow(max(0.0,sin(micro*51.0+tilt.x*8.0-tilt.y*5.0)),12.0)*hotspot;
 result+=mask*uIntensity*(flash*(.25+.5*uGrain)*mix(spectral,vec3(1.0),.6)+engraving+scint*uGrain*.75);
 float rim=(1.0-smoothstep(max(0.0,uFrame-.003),max(.0001,uFrame),-sd))*step(.0001,uFrame);
 result+=rim*uEdge*uIntensity*(spectral*.5+pow(hotspot,3.0)*.25);
 // Clear lacquer is also masked, so reverse/artwork choices stay visually distinct.
 result+=mix(.2,1.0,mask)*uGlare*(vec3(1.0,.97,.9)*pow(hotspot,3.5)*.38+ribbon*.1);
 gl_FragColor=vec4(clamp(result,0.0,1.0),alpha);
}
`;
