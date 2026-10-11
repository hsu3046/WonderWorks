// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const finishes = [
  {name:'Cosmos',tag:'01 / CLASSIC HOLO',detail:'Tiny constellations caught in a shifting spectrum.',family:'cosmos'},
  {name:'Spectrum',tag:'02 / RAINBOW',detail:'Broad bands of colour, travelling against the light.',family:'spectrum'},
  {name:'Starlight',tag:'03 / STAR FOIL',detail:'A field of prismatic stars beneath a polished surface.',family:'starlight'},
  {name:'Crystalline',tag:'04 / SHATTERED ICE',detail:'Fractured facets that catch light from every direction.',family:'crystalline'},
  {name:'Contour',tag:'05 / ETCHED FOIL',detail:'Fine, flowing grooves with an iridescent metallic finish.',family:'contour'},
  {name:'Gilded',tag:'06 / GOLD RARE',detail:'Warm gold, fine glitter and a deep, engraved lustre.',family:'gilded'},
  {name:'Swirl',tag:'07 / ORBITAL RAINBOW',detail:'A circular spectrum that rolls around a pool of light.',family:'swirl'},
  {name:'Bursts',tag:'08 / RADIANT FOIL',detail:'Small sunbursts with individually flashing metallic rays.',family:'bursts'},
  {name:'Glitter',tag:'09 / DIAMOND DUST',detail:'Dense, fine facets that scintillate as you tilt.',family:'glitter'},
] as const;
export type Zone = 'full'|'art'|'reverse';
export interface Settings {finish:number;intensity:number;scale:number;glare:number;grain:number;edge:number;frame:number;tint:string;tilt:number;zone:Zone;top:number;bottom:number;left:number;right:number;motion:boolean;compare:boolean;}
export const defaults=():Settings=>({finish:0,intensity:.72,scale:1,glare:.38,grain:.45,edge:.45,frame:.02,tint:'#e2e6ec',tilt:24,zone:'full',top:.16,bottom:.64,left:.075,right:.925,motion:false,compare:false});
export const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export function imageAddress(value:string):string{
  let u:URL;try{u=new URL(value.trim());}catch{throw new Error('Enter a complete image URL, starting with https://.');}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw new Error('Use a public HTTP or HTTPS image address.');
  return u.href;
}
export function region(top:number,bottom:number,left:number,right:number):[number,number,number,number]{
  const t=clamp(top,0,.95),l=clamp(left,0,.95);
  return [l,t,clamp(right,l+.02,1),clamp(bottom,t+.02,1)];
}
