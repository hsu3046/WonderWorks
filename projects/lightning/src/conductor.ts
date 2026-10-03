// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type {Point} from './bolt';
export const DOME_RADIUS=1.1;
export const DOME_HEIGHT=.77;
export interface Attachment {normal:Point;dome:boolean}
export function domeHeight(x:number,z:number):number {
 return DOME_HEIGHT*Math.sqrt(Math.max(0,1-(x*x+z*z)/(DOME_RADIUS*DOME_RADIUS)));
}
export function domeNormal(point:Point):Point {
 const n:Point=[point[0]/DOME_RADIUS**2,point[1]/DOME_HEIGHT**2,point[2]/DOME_RADIUS**2];
 const length=Math.hypot(...n)||1;return [n[0]/length,n[1]/length,n[2]/length];
}
/** Compose automatic strikes on the visible near shoulder, once per discharge.
 * This is a viewing choice, not an electrical-field calculation. A live channel
 * never follows the camera; explicit pointer hits keep their exact coordinates.
 */
export function visibleDomeContact(eye:Point,azimuthSample:number,radiusSample:number):Point {
 const bearing=Math.atan2(eye[2],eye[0]);
 const angle=bearing+(Math.max(0,Math.min(1,azimuthSample))-.5)*1.9;
 const radius=DOME_RADIUS*(.40+Math.max(0,Math.min(1,radiusSample))*.36);
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
 return [x,domeHeight(x,z),z];
}
/** Minimum ellipsoid metric along a segment: values below one penetrate the metal. */
export function domeClearance(a:Point,b:Point):number {
 const p=[a[0]/DOME_RADIUS,a[1]/DOME_HEIGHT,a[2]/DOME_RADIUS];
 const d=[(b[0]-a[0])/DOME_RADIUS,(b[1]-a[1])/DOME_HEIGHT,(b[2]-a[2])/DOME_RADIUS];
 const dd=d[0]!**2+d[1]!**2+d[2]!**2;
 const t=dd?Math.max(0,Math.min(1,-(p[0]!*d[0]!+p[1]!*d[1]!+p[2]!*d[2]!)/dd)):0;
 return (p[0]!+t*d[0]!)**2+(p[1]!+t*d[1]!)**2+(p[2]!+t*d[2]!)**2;
}
/** Preserve irregular growth while keeping failed forks above the conductor. */
export function clearDome(points:Point[]):Point[] {
 return points.map(p=>[p[0],Math.max(p[1],domeHeight(p[0],p[2])+.085),p[2]]);
}
