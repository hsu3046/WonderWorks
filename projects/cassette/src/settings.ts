// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export type Transport='stop'|'play'|'rewind';
export interface Shell{id:string;name:string;color:string;seam:string;plate:string}
/** Translucent shell tints. `plate` is the matte slip sheet seen through the window. */
export const shells:readonly Shell[]=[
 {id:'rose',name:'Rose',color:'#f26cb6',seam:'#c23d87',plate:'#fbe0ee'},
 {id:'lilac',name:'Lilac',color:'#a98cf2',seam:'#7458c9',plate:'#ece6fb'},
 {id:'aqua',name:'Aqua',color:'#5fd1dc',seam:'#2e9cad',plate:'#e2f6f8'},
 {id:'smoke',name:'Smoke',color:'#8e8a97',seam:'#4f4b58',plate:'#ecebef'},
];
export interface Settings{shell:number;holo:number;auto:boolean;transport:Transport;title:string}
export const DEFAULT_TITLE='Lunar Playlist';
export const defaults=():Settings=>({shell:0,holo:.85,auto:true,transport:'rewind',title:DEFAULT_TITLE});
export const clamp=(value:number,low:number,high:number)=>Math.min(high,Math.max(low,value));
export const MAX_TITLE=20;
/** User text only reaches a canvas drawing call; control characters and runs of whitespace are removed. */
const span=(from:number,to:number)=>String.fromCodePoint(from)+"-"+String.fromCodePoint(to);
/** C0/C1 controls, zero-width marks and Unicode line separators, written as code points to keep this source plain text. */
const UNSAFE=new RegExp(`[${span(0,31)}${span(127,159)}${span(0x200b,0x200f)}${span(0x2028,0x2029)}]`,"g");
export function cleanTitle(raw:string):string{
 const text=raw.replace(UNSAFE,"").replace(/\s+/g," ").trim().slice(0,MAX_TITLE).trim();
 return text||DEFAULT_TITLE;
}
/** Reel state. Radii are tape-pack radii in scene units; `fraction` is how much tape sits on the right reel. */
export interface Reels{fraction:number;angleLeft:number;angleRight:number}
export const HUB_RADIUS=.3,PACK_MAX=.78,PACK_MIN=.36;
const SQUARE_SPAN=PACK_MAX**2-PACK_MIN**2;
/** Linear tape speed in scene units per second. Rewind moves tape back onto the left reel. */
export const tapeSpeed=(transport:Transport)=>transport==='play'?1.15:transport==='rewind'?-3.4:0;
/** Fraction change per unit of tape length, so a full rewind lasts roughly 38 seconds. */
const TAPE_PER_UNIT=1/(38*3.4);
export const initialReels=():Reels=>({fraction:.45,angleLeft:0,angleRight:0});
/** Pack area is conserved: left² + right² stays constant while tape transfers. */
export function packRadii(fraction:number):{left:number;right:number}{
 const f=clamp(fraction,0,1);
 return {left:Math.sqrt(PACK_MAX**2-f*SQUARE_SPAN),right:Math.sqrt(PACK_MIN**2+f*SQUARE_SPAN)};
}
export interface ReelStep{reels:Reels;transport:Transport;reversed:boolean}
/**
 * Advance the reels. Each reel turns at the tape's linear speed divided by its own pack radius,
 * so the emptier reel spins faster. Reaching either end of the tape auto-reverses the transport.
 */
export function stepReels(reels:Reels,transport:Transport,dt:number):ReelStep{
 const speed=tapeSpeed(transport);
 if(!speed||!(dt>0)||!Number.isFinite(dt))return {reels,transport,reversed:false};
 const length=speed*clamp(dt,0,.1);
 const {left,right}=packRadii(reels.fraction);
 let fraction=reels.fraction+length*TAPE_PER_UNIT,next=transport,reversed=false;
 if(fraction>=1){fraction=1;next='rewind';reversed=transport!=='rewind';}
 else if(fraction<=0){fraction=0;next='play';reversed=transport!=='play';}
 // Positive tape travel (play) turns both reels clockwise when viewed from the front.
 return {reels:{fraction,angleLeft:normalize(reels.angleLeft-length/left),angleRight:normalize(reels.angleRight-length/right)},transport:next,reversed};
}
const TAU=Math.PI*2;
export const normalize=(angle:number)=>angle-Math.floor(angle/TAU)*TAU;
