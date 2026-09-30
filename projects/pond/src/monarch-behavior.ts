// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
export type MonarchState='flying'|'landing'|'resting'|'taking-off';
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return Math.max(0,Math.min(1,t*t*t*(t*(t*6-15)+10)));};

// Absolute scene time keeps pause, visibility changes and frame skips deterministic.
export function monarchBehavior(time:number,index:number){
 const flying=10+index*3,landing=4,resting=7+index*2,takeoff=3;
 const duration=flying+landing+resting+takeoff,cycle=Math.floor(time/duration),age=time-cycle*duration;
 let state:MonarchState='flying',perchWeight=0,legFold=1,wingActivity=1;
 if(age>=flying&&age<flying+landing){
  state='landing';const t=(age-flying)/landing;
  perchWeight=smooth(t);legFold=1-smooth((t-.48)/.42);wingActivity=1-smooth((t-.82)/.18);
 }else if(age>=flying+landing&&age<flying+landing+resting){
  state='resting';perchWeight=1;legFold=0;wingActivity=0;
 }else if(age>=flying+landing+resting){
  state='taking-off';const t=(age-flying-landing-resting)/takeoff;
  perchWeight=1-smooth(t);legFold=smooth((t-.10)/.55);wingActivity=smooth(t/.20);
 }
 return {state,perchWeight,legFold,wingActivity,cycle};
}
