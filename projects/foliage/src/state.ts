// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export const species=['maple','ginkgo','cherry','aspen','japanese'] as const;
export type Species=typeof species[number];
export const weatherNames=['clear','cloudy','rain','storm','snow'] as const;
export type Weather=typeof weatherNames[number];
export const trees={maple:{name:'Sugar Maple',latin:'Acer saccharum',hue:.27},ginkgo:{name:'Ginkgo',latin:'Ginkgo biloba',hue:.25},cherry:{name:'Cherry Blossom',latin:'Prunus serrulata',hue:.3},aspen:{name:'Quaking Aspen',latin:'Populus tremuloides',hue:.26},japanese:{name:'Japanese Maple',latin:'Acer palmatum',hue:.02}};
export interface Settings{year:number;hour:number;wind:number;weather:Weather;species:Species;auto:boolean;dayCycle:boolean;orbit:boolean;paused:boolean;sound:boolean;speed:number;}
export const defaults:Settings={year:.72,hour:16,wind:.28,weather:'clear',species:'maple',auto:true,dayCycle:false,orbit:false,paused:false,sound:false,speed:1};
export const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function smooth(a:number,b:number,x:number){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
export function seasonAt(year:number){return year<.23?'Winter':year<.46?'Spring':year<.69?'Summer':year<.9?'Autumn':'Winter';}
export function climate(year:number){
 const growth=smooth(.20,.33,year)*(1-smooth(.85,.97,year));
 return {growth,autumn:smooth(.65,.85,year),snow:1-smooth(.12,.27,year)+smooth(.89,.99,year),blossom:smooth(.21,.27,year)*(1-smooth(.31,.4,year))};
}
// Independent deterministic channels keep release order unrelated to color or crown position.
export const autumnSeconds=1200;
export function seasonDuration(year:number){return 150+(autumnSeconds-150)*smooth(.65,.70,year)*(1-smooth(.94,.99,year));}
export function leafFall(seed:number){
 const channel=(scale:number,offset:number)=>{const n=seed*scale+offset;return n-Math.floor(n);};
 return {release:.70+channel(17.13,.37)*.21,duration:5.5+channel(43.71,.19)*6,angle:channel(71.93,.53)*Math.PI*2,drift:.6+channel(29.57,.83)*2.4};
}
export function leafStage(year:number,seed:number,wind:number,elapsed=0,species:Species='maple'){
 const bud=.20+seed*.09,fall=leafFall(seed);
 const size=Math.max(smooth(bud,bud+.06,year),species==='cherry'?climate(year).blossom:0);
 // Holding an autumn date still releases individual leaves on their own schedule.
 const localTime=year>=.69?elapsed:0;
 const flight=clamp(((year-fall.release+wind*.012)*autumnSeconds+localTime)/fall.duration);
 return {size,flight,visible:size>.02&&year<.99};
}
export function readSettings(search:string):Settings{
 const p=new URLSearchParams(search),s={...defaults};
 for(const key of ['year','hour','wind','speed'] as const){const raw=p.get(key);if(raw===null)continue;const n=Number(raw);if(Number.isFinite(n))s[key]=clamp(n,0,key==='hour'?24:key==='speed'?4:1);}
 if(species.includes(p.get('tree') as Species))s.species=p.get('tree') as Species;
 if(weatherNames.includes(p.get('weather') as Weather))s.weather=p.get('weather') as Weather;
 if(p.get('auto')==='0')s.auto=false;
 return s;
}
export function random(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
