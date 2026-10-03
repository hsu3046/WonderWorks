// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
export const LOCAL_MODELS=['bridge','gazebo','cherry','house','castle','hydrangea','azalea','butterfly'] as const;
export type LocalModel=typeof LOCAL_MODELS[number];
import {sceneryDimensions} from './scenery-scale.ts';
export interface ScenerySite {model:LocalModel;x:number;z:number;size:number;axis:'x'|'y';yaw:number;radius:number;}
// Leave landing clearings and the authored oak contact path open.
const siteDefinitions:readonly Omit<ScenerySite,'radius'>[]=[
 {model:'gazebo',x:-29,z:53,size:7.2,axis:'y',yaw:.35},
 {model:'gazebo',x:134,z:-130,size:7.2,axis:'y',yaw:-.6},
 {model:'bridge',x:-136,z:-85,size:10,axis:'x',yaw:.18},
 {model:'cherry',x:-36,z:65,size:9,axis:'y',yaw:1.2},
 {model:'cherry',x:-18,z:43,size:8,axis:'y',yaw:3.3},
 {model:'cherry',x:-128,z:-134,size:10,axis:'y',yaw:1.7},
 {model:'cherry',x:-93,z:-135,size:8.8,axis:'y',yaw:4.1},
 {model:'cherry',x:151,z:-133,size:10.5,axis:'y',yaw:2.5},
 {model:'cherry',x:143,z:-159,size:8.6,axis:'y',yaw:.7},
 {model:'cherry',x:-38,z:-285,size:9.2,axis:'y',yaw:2.2},
 {model:'cherry',x:68,z:-367,size:10,axis:'y',yaw:4.7},
 {model:'house',x:-35,z:81,size:20,axis:'y',yaw:-.7},
 {model:'house',x:-117,z:-75,size:20,axis:'y',yaw:1.4},
 {model:'house',x:-110,z:-130,size:20,axis:'y',yaw:2.7},
 {model:'house',x:102,z:-139,size:20,axis:'y',yaw:-.4},
 {model:'house',x:-53,z:-278,size:20,axis:'y',yaw:2},
 {model:'house',x:50,z:-394,size:20,axis:'y',yaw:.8},
 {model:'house',x:109,z:-375,size:20,axis:'y',yaw:3.5},
 {model:'castle',x:85,z:-405,size:60,axis:'y',yaw:.4},
 ];
export const SCENERY_SITES:readonly ScenerySite[]=siteDefinitions.map(site=>{
 const dimensions=sceneryDimensions(site.model,site.size,site.axis);
 return {...site,radius:Math.hypot(dimensions.width,dimensions.depth)*.5};
});
export const FLOWER_BEDS=[[-34,55],[-24,53],[-31,61],[-7,62],[-19,79],[-128,-74],[-143,-85],[-102,-134],[128,-132],[139,-129],[-42,-277],[63,-370],[98,-365]] as const;
export function occupiedByScenery(x:number,z:number,margin=1.5):boolean{return SCENERY_SITES.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+margin);}
