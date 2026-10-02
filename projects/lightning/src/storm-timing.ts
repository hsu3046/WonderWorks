// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type {Discharge} from './bolt.ts';
export const MAX_DISCHARGES=3;
export const playbackRate=(fast:boolean)=>fast?2:1;
/** Mostly single strikes, with irregular pairs and occasional triples. */
export function dischargeCount(sample:number):number{return sample<.60?1:sample<.94?2:MAX_DISCHARGES;}
export function initialAge(leader:number,firstLeader:number,delay:number,paused:boolean):number {
 // Align initial returns within 12ms, despite independently generated leaders.
 return paused?leader+.003:leader-firstLeader-delay;
}
export function dischargeFinished(discharge:Discharge,age:number):boolean {
 return age>discharge.strokes.at(-1)!.time+.45;
}
