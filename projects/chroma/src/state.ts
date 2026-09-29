// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {sequenceDuration} from './sequence.ts';
export const modes = ['sequence','columns','ribbons','disc','orbit','wave'] as const;
export type Mode = typeof modes[number];
export const palettes = {
 spectral:['#ff6447','#dfacfa','#5120cf','#c7ff92'],
 glacier:['#99ecff','#c5d7ff','#1944b8','#efffff'],
 candy:['#ff8dbe','#ffdbb2','#8535cd','#fff1d8'],
 ember:['#ffd4a2','#ff7346','#902741','#fff2b3'],
 acid:['#eaff73','#a8f0c3','#244e92','#f5ffce'],
 pearl:['#ededec','#a9a8b8','#3a3b51','#ffffff'],
} as const;
export type Palette=keyof typeof palettes;
export interface Settings {mode:Mode;palette:Palette;speed:number;amplitude:number;twist:number;count:number;grain:number;zoom:number;phase:number;}
export const defaults:Settings={mode:'sequence',palette:'spectral',speed:1,amplitude:1,twist:1,count:3,grain:.01,zoom:1,phase:0};
export const modeInfo:Record<Mode,{name:string;note:string;icon:string;count:number}>={
 sequence:{name:'Original mix',note:'Columns unfold into ribbon, disc, orbit and wave. One continuous transformation.',icon:'◒',count:3},
 columns:{name:'Elastic columns',note:'A soft, staggered rhythm. Stretch, flatten, repeat.',icon:'▥',count:3},
 ribbons:{name:'Twisted ribbon',note:'One continuous volume. Connected faces roll through colour.',icon:'≈',count:1},
 disc:{name:'Floating disc',note:'A cylinder opens into separate caps and a weightless band.',icon:'⊖',count:1},
 orbit:{name:'Orbital play',note:'Flattened forms dance around a shared centre.',icon:'◎',count:5},
 wave:{name:'Wave field',note:'One continuous wave. Flowing from left to right, without a pause.',icon:'▥',count:3},
};
// URL settings are a portable preset. Clamp every numeric input before it reaches the renderer.
export function readSettings(search:string):Settings{
 const params=new URLSearchParams(search),s={...defaults};
 const mode=params.get('mode'),palette=params.get('palette');
 if(modes.includes(mode as Mode))s.mode=mode as Mode;
 s.count=modeInfo[s.mode].count;
 if(palette&&Object.hasOwn(palettes,palette))s.palette=palette as Palette;
 const bounds={speed:[0,2.5],amplitude:[0,1.8],twist:[0,2.5],count:[1,9],grain:[0,.16],zoom:[.65,1.4],phase:[0,sequenceDuration]} as const;
 for(const key of Object.keys(bounds) as (keyof typeof bounds)[]){const value=params.get(key);if(value===null)continue;const n=Number(value);if(!Number.isFinite(n))continue;const [min,max]=bounds[key];s[key]=Math.min(max,Math.max(min,n));}
 s.count=s.mode==='wave'?3:Math.round(s.count);return s;
}
