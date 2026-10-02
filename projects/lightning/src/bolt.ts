// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {clearDome,type Attachment} from './conductor.ts';
export type Point = [number, number, number];
export interface Segment {
 from: Point; to: Point; previous: Point; next: Point;
 width: number; endWidth: number; delay: number; arrival: number; branch: number; progress: number;
}
export interface Stroke { time: number; strength: number; decay: number }
export const MAX_STROKES=12;
export interface Discharge {
 segments: Segment[]; source: Point; target: Point; seed: number;
 strokes: Stroke[]; leaderDuration: number; continuing: number; lights: Point[];
}
export function random(seed:number){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
const add=(a:Point,b:Point,s=1):Point=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s];
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const length=(a:Point)=>Math.hypot(...a);
const unit=(a:Point):Point=>{const n=length(a)||1;return [a[0]/n,a[1]/n,a[2]/n];};
const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Point,b:Point):Point=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Local field-biased growth, not a full Laplace/DBM solver. See docs/lightning/REALISM_RESEARCH.md. */
export function createDischarge(seed:number,source:Point,target:Point,branching:number,attachment?:Attachment):Discharge {
 const rand=random(seed),richness=Math.max(0,Math.min(1,branching)),segments:Segment[]=[];
 const leaderDuration=.042+rand()*.037;
 const strokes:Stroke[]=[{time:leaderDuration,strength:1,decay:.018+rand()*.009}];
 // Mix isolated flashes, short bursts and extended trains. The geometry stays
 // fixed: successive return strokes reuse the already established channel.
 const profile=rand(),longChain=profile>=.66;
 const count=profile<.22?1:longChain?7+Math.floor(rand()*(MAX_STROKES-6)):2+Math.floor(rand()*4);
 if(longChain){
  const span=.65+rand()*.65;
  const gaps=Array.from({length:count-1},()=>.35+rand()**1.6*2);
  const weight=gaps.reduce((sum,gap)=>sum+gap,0),remaining=span-(count-1)*.028;
  for(let i=1;i<count;i++)strokes.push({
   time:strokes[i-1]!.time+.028+gaps[i-1]!/weight*remaining,
   // A stronger late return can follow a weaker one; avoid a uniform decaying
   // strobe train while keeping each individual flash short and distinct.
   strength:(.38+rand()*.48)*(1-.22*i/count),decay:.022+rand()*.022
  });
 }else{
  for(let i=1;i<count;i++)strokes.push({time:strokes[i-1]!.time+.025+rand()**1.5*.078,strength:(.46+rand()*.38)*(.93**i),decay:.010+rand()*.012});
 }
 const continuing=rand()<.35?.012+rand()*.016:0;

 // Steps remember their previous direction. Weighted candidates advance toward
 // the electrode; a changing local field permits broad bends without sawteeth.
 function grow(start:Point,end:Point,initial:Point,step:number,maxSteps:number):Point[] {
  const points:Point[]=[start];let p=start,direction=unit(initial);
  let field:Point=[0,0,0];
  for(let i=0;i<maxSteps;i++) {
   const toward=sub(end,p),distance=length(toward);
   if(distance<step*1.65){points.push(end);break;}
   if(i%4===0)field=[(rand()-.5)*1.25,(rand()-.5)*.42,(rand()-.5)*1.25];
   const attraction=unit(toward),near=Math.min(1,step*5/distance);
   const forward=unit(add(add(direction,attraction,.58+near*2),field,.5*(1-near)));
   const u=unit(cross(forward,Math.abs(forward[1])>.9?[1,0,0]:[0,1,0])),v=cross(forward,u);
   const candidates:Point[]=[];const weights:number[]=[];let sum=0;
   const rotation=rand()*Math.PI*2;
   for(let j=0;j<14;j++) {
    const angle=rotation+j*2.39996323,radius=Math.sqrt((j+.5)/14)*.8;
    const d=unit(add(add(forward,u,Math.cos(angle)*radius),v,Math.sin(angle)*radius));
    // A positive threshold rejects candidates opposing the local gradient.
    const fieldGain=Math.max(0,dot(d,attraction)*.7+dot(d,forward)*.3-.12);
    const w=fieldGain**2.2*(.6+rand()*.8);candidates.push(d);weights.push(w);sum+=w;
   }
   let choice=rand()*sum,j=0;
   while(j<weights.length-1&&choice>weights[j]!){choice-=weights[j]!;j++;}
   direction=candidates[j]!;
   p=add(p,direction,step*(.7+rand()*.6));points.push(p);
  }
  // Bounded convergence keeps an explicitly selected surface contact exact.
  if(points.at(-1)!==end)points.push(end);
  return points;
 }
 // Restore sub-step tortuosity with correlated offsets; never animate the shape
 // of an established channel. Later return strokes reuse this very same path.
 function refine(points:Point[]):Point[] {
  const fine:Point[]=[points[0]!];
  for(let i=1;i<points.length;i++) {
   const a=points[i-1]!,b=points[i]!,d=sub(b,a),u=unit(cross(d,[.17,1,.11])),v=unit(cross(d,u));
   const bend=(rand()-.5)*length(d)*.32,bend2=(rand()-.5)*length(d)*.25;
   for(let j=1;j<3;j++)fine.push(add(add(add(a,d,j/3),u,bend*Math.sin(j/3*Math.PI)),v,bend2*Math.sin(j/3*Math.PI)));
   fine.push(b);
  }
  return fine;
 }
 function emit(points:Point[],level:number,width:number,birth:number,duration:number):number[] {
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]!+length(sub(points[i]!,points[i-1]!)));
  const total=distances.at(-1)||1;
  // One continuous profile per channel: shared joins have identical widths,
  // while the trunk swells and narrows over longer runs instead of noisy knots.
  const phase=(seed%997)*.017;
  const taper=(p:number)=>level===0
   ?(1.2-.44*p)*(.95+.18*Math.sin(p*9+phase)+.07*Math.sin(p*23+phase*1.7))
   :Math.max(.025,(1-p)**.85);
  // The last 8% grows upward from the electrode to meet the descending leader.
  const arrivalAt=(p:number)=>level===0&&target[1]<1?(p<.92?p/.92*leaderDuration:leaderDuration-(p-.92)/.08*.008):birth+p*duration;
  for(let i=1;i<points.length;i++) {
   if(segments.length>=1750)break;
   const t=distances[i-1]!/total,t1=distances[i]!/total;
   segments.push({from:points[i-1]!,to:points[i]!,previous:points[Math.max(0,i-2)]!,next:points[Math.min(points.length-1,i+1)]!,width:width*taper(t),endWidth:width*taper(t1),delay:arrivalAt(t),arrival:arrivalAt(t1),branch:level,progress:level===0?t1:Math.min(1,(birth+t1*duration)/leaderDuration)});
  }
  return distances.map(d=>arrivalAt(d/total));
 }
 // A conductor emits its connecting streamer along the surface normal. Keep
 // the final contact exact, and keep the stochastic descending path outside it.
 const meeting=attachment?add(target,attachment.normal,.32):target;
 let main=refine(grow(source,meeting,sub(meeting,source),.11,85));
 if(attachment?.dome)main=clearDome(main);
 if(attachment){
  main[main.length-1]=meeting;
  for(const distance of [.24,.16,.09,.035,0])main.push(distance?add(target,attachment.normal,distance):target);
 }
 const births=emit(main,0,1,0,leaderDuration);
 // Irregular forks at coarse nodes: many fail early, a few develop long forks.
 function fork(points:Point[],times:number[],level:number,budget:number) {
  for(let i=9;i<points.length-9;i+=3) {
   if(budget<=0||segments.length>1450)break;
   const progress=times[i]!/leaderDuration;
   if(progress>.87||rand()>(level===1?richness*(.12+richness*.40):.16*richness))continue;
   budget--;
   const origin=points[i]!,dir=unit(sub(points[i+3]!,points[i-3]!));
   const a=rand()*Math.PI*2,u=unit(cross(dir,[.2,1,.13])),v=cross(dir,u);
   const outward=unit(add(add(dir,u,Math.cos(a)*1.1),v,Math.sin(a)*1.1));
   const reach=(.16+richness*.25+rand()**1.45*(level===1?.4+richness*2.5:.85))*(1-progress*.35);
   const end=add(origin,outward,reach);
   // Unconnected forks expire before the ground. The sole contact is the trunk.
   end[1]=Math.max(target[1]+.17,end[1]);
   let branch=refine(grow(origin,end,outward,.09,32));
   if(attachment?.dome)branch=clearDome(branch);
   const duration=Math.min(leaderDuration-times[i]!-.001,reach*.022);
   const branchTimes=emit(branch,level,level===1?.32+rand()*.20:.09+rand()*.085,times[i]!,Math.max(.002,duration));
   if(level===1)fork(branch,branchTimes,2,Math.ceil(richness*3));
  }
 }
 fork(main,births,1,Math.ceil(richness*20));
 // A compact in-cloud feeder illuminates a volume, not a single point.
 const feederDirection=Math.abs(source[0])>.8?-Math.sign(source[0]):(rand()>.5?1:-1);
 const feederEnd:Point=[source[0]+feederDirection*(.28+rand()*.36),source[1]+.08+rand()*.2,source[2]+(rand()-.5)*.28];
 const feeder=refine(grow(source,feederEnd,sub(feederEnd,source),.13,30));
 if(richness>0)emit(feeder,1,.48,0,leaderDuration*.65);
 const lights:Point[]=[feeder[Math.floor(feeder.length*.68)]!,source,main[Math.floor(main.length*.2)]!];
 return {segments,source,target,seed,strokes,leaderDuration,continuing,lights};
}
/** Exact shutter average of a fast-rise exponential pulse. A subframe event is never skipped. */
export function exposurePulse(age:number,decay:number,exposure=0):number {
 if(age<0)return 0;
 if(exposure<1e-6)return Math.exp(-age/decay);
 return decay*(Math.exp(-Math.max(0,age-exposure)/decay)-Math.exp(-age/decay))/exposure;
}
export function pulse(age:number,discharge:Discharge,exposure=0,branches=false):number {
 let energy=0;
 for(let i=0;i<(branches?1:discharge.strokes.length);i++) {
  const s=discharge.strokes[i]!;
  energy+=s.strength*exposurePulse(age-s.time,branches?.016:s.decay,exposure);
 }
 if(!branches)energy+=discharge.continuing*exposurePulse(age-discharge.leaderDuration,.13,exposure);
 return Math.min(1.5,energy);
}
