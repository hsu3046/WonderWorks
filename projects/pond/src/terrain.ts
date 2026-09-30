// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {MathUtils} from 'three';
/** Shared by visible pond bed and camera clearance; the bank joins the lawn at y=0.25. */
export function terrainHeight(x:number,z:number){
 const radius=Math.hypot(x/10,z/7.5);
 if(radius>=1)return .25;
 const bank=1-MathUtils.smoothstep(radius,.82,1);
 return -1.65+Math.pow(radius,5)*1.9+.045*Math.sin(x*2.8+z)*Math.cos(z*2)*bank;
}
