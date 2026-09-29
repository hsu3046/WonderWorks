// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import type {Variant} from './catalog';
interface Entry {host:HTMLElement;variant:Variant;}
// One shared decoder for the entire collection. No artwork renderer is mounted here.
export function createPreviews(onBusy:(busy:boolean)=>void){
 const entries:Entry[]=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),hover=matchMedia('(hover:hover)');
 const video=document.createElement('video');video.muted=true;video.defaultMuted=true;video.playsInline=true;video.loop=true;video.preload='none';video.setAttribute('aria-hidden','true');video.tabIndex=-1;
 let current:Entry|null=null,wanted:Entry|null=null,blocked=false,disposed=false,ticket=0,enterTimer=0,loadTimer=0;
 const image=(e:Entry)=>e.host.querySelector<HTMLImageElement>('img')!;
 const idle=()=>reduced.matches?'OPEN TO EXPLORE':hover.matches?'HOVER TO PREVIEW':'TAP TO EXPLORE';
 const label=(e:Entry,text:string)=>{const el=e.host.querySelector('.preview-hint');if(el)el.textContent=text;};
 function pause(){
  ticket++;clearTimeout(enterTimer);clearTimeout(loadTimer);wanted=null;video.pause();
  // Hide the old frame before seeking so pointer leave immediately restores the poster.
  if(current){current.host.classList.remove('video-ready','playing');image(current).src=current.variant.image;label(current,idle());}
  if(video.readyState>=1)video.currentTime=0;
  onBusy(false);
 }
 function release(){
  video.pause();video.removeAttribute('src');video.load();video.remove();
  current?.host.classList.remove('video-ready','playing');current=null;
 }
 function fail(e:Entry){
  if(current!==e)return;pause();release();label(e,'OPEN TO EXPLORE');
 }
 async function play(e:Entry){
  if(disposed||blocked||document.hidden||reduced.matches||!hover.matches||wanted!==e)return;
  const request=++ticket;
  if(current!==e){
   release();current=e;video.poster=e.variant.image;video.src=e.variant.movie;e.host.append(video);
  }
  label(e,'LOADING PREVIEW');onBusy(true);
  clearTimeout(loadTimer);loadTimer=window.setTimeout(()=>{if(ticket===request)fail(e);},8000);
  try{await video.play();}catch(error){
   if(ticket!==request||wanted!==e)return;
   console.warn('Preview playback unavailable',error);fail(e);
  }
 }
 const playing=()=>{
  if(!current||wanted!==current||blocked||document.hidden||reduced.matches){video.pause();return;}
  clearTimeout(loadTimer);current.host.classList.add('video-ready','playing');label(current,'PREVIEW · LEAVE TO RESET');
 };
 video.addEventListener('playing',playing);video.addEventListener('error',()=>{if(current)fail(current);});
 const observer=new IntersectionObserver(changes=>{
  for(const change of changes)if(!change.isIntersecting&&current?.host===change.target){pause();release();}
 },{threshold:.01});
 const visibility=()=>{if(document.hidden){pause();release();}};
 const motion=()=>{if(reduced.matches){pause();release();}entries.forEach(e=>label(e,idle()));};
 document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);
 return {
  add(host:HTMLElement,variant:Variant){
   const e:Entry={host,variant};entries.push(e);label(e,idle());observer.observe(host);
   host.addEventListener('pointerenter',()=>{
    if(blocked||reduced.matches||!hover.matches)return;
    pause();wanted=e;enterTimer=window.setTimeout(()=>void play(e),140);
   });
   host.addEventListener('pointerleave',()=>{if(wanted===e||current===e)pause();});
  },
  select(host:HTMLElement,variant:Variant){
   const e=entries.find(e=>e.host===host);if(!e)return;
   if(current===e||wanted===e){pause();release();}e.variant=variant;image(e).src=variant.image;label(e,idle());
  },
  suspend(value:boolean){blocked=value;if(value){pause();release();}else onBusy(false);},
  poster(variant:Variant){return variant.image;},
  dispose(){disposed=true;pause();release();observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);},
 };
}
