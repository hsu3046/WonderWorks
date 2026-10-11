// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import './style.css';
import { stampSVG, stamps, postmark } from './stamps';
import { STORAGE_KEY, position, readLetters, validateDraft } from './model';
import type { Letter, Paper, StampId } from './model';
const el = <T extends HTMLElement>(id: string): T => { const e=document.getElementById(id);if(!e)throw new Error(`Missing ${id}`);return e as T; };
const to=el<HTMLInputElement>('to'), from=el<HTMLInputElement>('from'), message=el<HTMLTextAreaElement>('message'), envelope=el('envelope'), attached=el('attached-stamp'), guide=el('stamp-guide'), status=el('status'), desk=el('desk'), form=el<HTMLFormElement>('letter-form'), send=el<HTMLButtonElement>('send'), stack=el('letter-stack'), dialog=el<HTMLDialogElement>('read-dialog');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected: StampId | null=null, paper: Paper='ivory', stuck=false, stampX=.84, stampY=.25, stampAngle=-5, busy=false, sounds=false, audio:AudioContext | null=null, viewing: Letter | null=null, openedFrom:HTMLElement|null=null;
let letters: Letter[]=[];let pendingStorage=false;
try { letters=readLetters(localStorage.getItem(STORAGE_KEY)); } catch { tell('Your saved letterbox could not be read. Existing browser data has been left untouched.', true); }
function tell(text:string,error=false):void {status.textContent=text;status.classList.toggle('error',error);}
function sound(kind:'paper'|'stamp'):void {
 if(!sounds)return;
 try {audio??=new AudioContext();void audio.resume().catch(()=>{sounds=false;updateSound();});const a=audio;const len=kind==='stamp'?.16:.24;const b=a.createBuffer(1,Math.floor(a.sampleRate*len),a.sampleRate),data=b.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,kind==='stamp'?3:1.5);const src=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();src.buffer=b;filter.type='lowpass';filter.frequency.value=kind==='stamp'?900:3600;gain.gain.value=kind==='stamp'?.25:.065;src.connect(filter).connect(gain).connect(a.destination);src.start();src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};}catch{sounds=false;updateSound();tell('Sound is unavailable here. Your letter still works.');}
}
function updateSound():void {const b=el('sound');b.setAttribute('aria-pressed',String(sounds));b.innerHTML=`Sound ${sounds?'on':'off'} <span>♩</span>`;}
el('sound').addEventListener('click',()=>{sounds=!sounds;updateSound();if(sounds)sound('paper');});
const book=el('stamp-book');
for(const s of stamps){const b=document.createElement('button');b.type='button';b.className='stamp-choice';b.dataset.stamp=s.id;b.setAttribute('aria-label',s.name);b.setAttribute('aria-pressed','false');b.innerHTML=stampSVG(s.id)+`<span>${s.name}</span>`;let suppressClick=false;
 const choose=():void=>{selected=s.id;for(const c of book.children)c.setAttribute('aria-pressed',String(c===b));guide.classList.add('ready');el('stamp-hint').textContent=`${s.name}. Tap the envelope, or drag the stamp over.`;tell('Your postage is ready. Tap the envelope to stick it on.');sound('paper');if(innerWidth<=760)envelope.scrollIntoView({block:'center',behavior:reduced.matches?'instant':'smooth'});};
 b.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}if(busy)return;choose();if(stuck)place(stampX,stampY);});
 let drag:{id:number;x:number;y:number;ghost:HTMLElement|null}|null=null;
 const stop=():void=>{if(!drag)return;drag.ghost?.remove();const id=drag.id;drag=null;if(b.hasPointerCapture(id))b.releasePointerCapture(id);};
 b.addEventListener('pointerdown',e=>{if(busy||e.pointerType==='touch'||!e.isPrimary||e.button!==0)return;suppressClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,ghost:null};b.setPointerCapture(e.pointerId);});
 b.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.ghost&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){choose();drag.ghost=document.createElement('div');drag.ghost.className='stamp-ghost';drag.ghost.innerHTML=stampSVG(s.id);document.body.append(drag.ghost);}if(drag.ghost){drag.ghost.style.left=`${e.clientX}px`;drag.ghost.style.top=`${e.clientY}px`;}});
 b.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;if(drag.ghost){suppressClick=true;const p=localPoint(e);if(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)place(p.x,p.y);else tell('Bring your stamp over the envelope to stick it on.');}stop();});
 b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);window.addEventListener('blur',stop);book.append(b);}
function place(x:number,y:number):void {
 if(!selected||busy)return;
 ({x:stampX,y:stampY}=position(x,y));stuck=true;attached.innerHTML=stampSVG(selected);attached.style.left=`${stampX*100}%`;attached.style.top=`${stampY*100}%`;attached.style.setProperty('--angle',`${stampAngle}deg`);attached.hidden=false;guide.hidden=true;attached.classList.remove('just-stuck');void attached.offsetWidth;attached.classList.add('just-stuck');el('remove-stamp').hidden=false;el('desk-note').textContent='02 / A little postage. A lot of feeling.';el('stamp-hint').textContent='Stuck with love. Tap a new spot to move it.';tell('Lovely. Add your words, then seal your letter.');sound('paper');
}
// Map pointer coordinates into the rotated envelope plane, not its axis-aligned bounding box.
function localPoint(e:PointerEvent):{x:number;y:number} {
 const r=envelope.getBoundingClientRect(),angle=-5*Math.PI/180,dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
 return {x:(dx*Math.cos(angle)+dy*Math.sin(angle))/envelope.offsetWidth+.5,y:(-dx*Math.sin(angle)+dy*Math.cos(angle))/envelope.offsetHeight+.5};
}
let pointer:{id:number;x:number;y:number}|null=null;
envelope.addEventListener('pointerdown',e=>{if(busy||!e.isPrimary||e.button!==0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
envelope.addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const p=pointer;pointer=null;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>9)return;if(!selected){tell('Choose a stamp from the collection first.',true);book.querySelector('button')?.focus();return;}const point=localPoint(e);place(point.x,point.y);});
envelope.addEventListener('pointercancel',()=>{pointer=null;});envelope.addEventListener('pointerleave',()=>{pointer=null;});window.addEventListener('blur',()=>{pointer=null;});
envelope.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(selected)place(.84,.25);else{tell('Choose a stamp from the collection first.',true);book.querySelector('button')?.focus();}}});
el('remove-stamp').addEventListener('click',()=>{if(busy)return;stuck=false;attached.hidden=true;guide.hidden=false;el('remove-stamp').hidden=true;tell('Lifted carefully. Choose another spot.');sound('paper');});
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-paper]'))b.addEventListener('click',()=>{if(busy)return;paper=b.dataset.paper as Paper;envelope.className=`envelope ${paper}`;document.querySelectorAll('[data-paper]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));sound('paper');});
to.addEventListener('input',()=>{el('preview-to').textContent=to.value||'someone special';});from.addEventListener('input',()=>{el('preview-from').textContent=from.value||'someone who cares';});message.addEventListener('input',()=>{el('peek-text').textContent=message.value||'There is something lovely about\nputting a feeling into words.';el('count').textContent=`${message.value.length} / 1200`;});
const delay=(ms:number):Promise<void>=>new Promise(resolve=>setTimeout(resolve,reduced.matches?10:ms));
function lock(value:boolean):void {busy=value;for(const control of document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLTextAreaElement>('main button, main input, main textarea'))control.disabled=value;for(const id of ['write-tab','box-tab'])el<HTMLButtonElement>(id).disabled=value;envelope.setAttribute('aria-disabled',String(value));}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 const invalid=validateDraft(to.value,message.value,stuck);if(invalid){tell(invalid,true);if(!to.value.trim())to.focus();else if(!message.value.trim())message.focus();else envelope.focus();return;}
 if(!selected)return;
 // Persist the exact snapshot before playing a successful dispatch animation.
 const letter:Letter={id:crypto.randomUUID(),to:to.value.trim(),from:from.value.trim(),message:message.value.trim(),stamp:selected,paper,x:stampX,y:stampY,angle:stampAngle,date:new Date().toISOString()};
 let latest:Letter[];
 try {latest=readLetters(localStorage.getItem(STORAGE_KEY));if(latest.length>=40){tell('Your letterbox holds 40 letters. Keep a text copy of your favourites; this box is full.',true);return;}localStorage.setItem(STORAGE_KEY,JSON.stringify([letter,...latest]));}catch{tell('This browser could not save your letter. Your words are still here; nothing was sent.',true);return;}
 letters=[letter,...latest];lock(true);if(innerWidth<=760)window.scrollTo({top:0,behavior:'instant'});tell('Folding your words, ever so carefully…');desk.classList.add('sealing');sound('paper');
 await delay(950);desk.classList.remove('sealing');const rubber=el('rubber-stamp'),sr=attached.getBoundingClientRect(),dr=desk.getBoundingClientRect();rubber.style.left=`${sr.left+sr.width/2-dr.left-rubber.offsetWidth/2}px`;rubber.style.top=`${sr.top+sr.height/2-dr.top-rubber.querySelector<HTMLElement>('.handle')!.offsetHeight-18-124}px`;rubber.classList.add('strike');tell('A small mark. A long way to go.');
 await delay(440);const mark=el('postmark');mark.innerHTML=postmark(letter.date);mark.style.left=`${stampX*100}%`;mark.style.top=`${stampY*100}%`;mark.hidden=false;mark.classList.add('inked');sound('stamp');
 await delay(1100);desk.classList.add('departing');await delay(720);
 showBox(true);lock(false);send.textContent='Seal & send ↗';tell('Postmarked and tucked safely into your letterbox.');resetDraft();el('box-tab').focus();
 if(pendingStorage)reconcileStorage(true);
});
function resetDraft():void {form.reset();selected=null;stuck=false;paper='ivory';stampX=.84;stampY=.25;stampAngle=-5;attached.hidden=true;guide.hidden=false;guide.classList.remove('ready');el('remove-stamp').hidden=true;el('postmark').hidden=true;el('postmark').classList.remove('inked');el('rubber-stamp').classList.remove('strike');desk.classList.remove('sealing','departing');envelope.className='envelope ivory';book.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));document.querySelectorAll<HTMLElement>('[data-paper]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paper==='ivory')));el('preview-to').textContent='someone special';el('preview-from').textContent='someone who cares';el('peek-text').textContent='There is something lovely about\nputting a feeling into words.';el('count').textContent='0 / 1200';el('stamp-hint').textContent='Choose one, then tap the envelope to stick it on.';el('desk-note').textContent='01 / Choose a stamp. Give it a home.';}
const samples:Letter[]=[
 ['A future me','You, today','I hope you still make time for the small things. The first cup of coffee. The long way home. The people who feel like sunshine.\n\nKeep a little room for wonder.','fern','ivory'],
 ['Someone far away','An old friend','Different skies, same moon.\n\nJust a small reminder that you are thought of, more often than you know.','moon','ivory'],
 ['Sunday morning','Your slower self','No grand plans today. Just an open window, something warm to drink, and all the time in the world.','orange','ivory'],
 ['The little things','A grateful heart','The flowers on the table. A message that arrived at the right time. The light coming through the curtains.\n\nThank you for being here.','iris','ivory'],
 ['Somewhere new','Your next chapter','You do not need to have it all figured out.\n\nOne small, brave step will do.','bird','ivory'],
].map((a,i)=>({id:`sample-${i}`,to:a[0]!,from:a[1]!,message:a[2]!,stamp:a[3] as StampId,paper:a[4] as Paper,x:.86,y:.22,angle:i%2?4:-4,date:new Date(2026,9,11-i).toISOString()}));
function makeSaved(letter:Letter):HTMLElement {
 const slot=document.createElement('div');slot.className='letter-slot';const b=document.createElement('button');b.className=`saved-envelope ${letter.paper}`;b.setAttribute('aria-label',`Read letter to ${letter.to}${letter.id.startsWith('sample-')?' (sample)':''}`);
 // Only static trusted stamp graphics enter innerHTML; all personal text uses textContent.
 b.innerHTML='<div class="sender"></div><div class="address"><span>to</span><strong></strong><small></small></div><div class="attached-stamp"></div><div class="postmark"></div>';
 b.querySelector('.sender')!.textContent=letter.id.startsWith('sample-')?'FROM THE DEARLY COLLECTION':'POSTMARKED WITH LOVE';b.querySelector('.address strong')!.textContent=letter.to;b.querySelector('.address small')!.textContent=letter.id.startsWith('sample-')?'a little inspiration for your own letter':new Date(letter.date).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
 const s=b.querySelector<HTMLElement>('.attached-stamp')!;s.innerHTML=stampSVG(letter.stamp);s.style.left=`${letter.x*100}%`;s.style.top=`${letter.y*100}%`;s.style.setProperty('--angle',`${letter.angle}deg`);const m=b.querySelector<HTMLElement>('.postmark')!;m.innerHTML=postmark(letter.date);m.style.left=`${letter.x*100}%`;m.style.top=`${letter.y*100}%`;if(letter.id.startsWith('sample-'))m.hidden=true;
 b.addEventListener('click',()=>openLetter(letter,b));slot.append(b);return slot;
}
function renderBox(newest=false):void {stack.replaceChildren();for(const letter of [...letters,...samples])stack.append(makeSaved(letter));el('letter-count').textContent=String(letters.length);el('box-count').textContent=`${letters.length} LETTER${letters.length===1?'':'S'} KEPT · 5 SAMPLE LETTERS`;const slots=stack.querySelectorAll<HTMLElement>('.letter-slot');const pitch=slots[0]?.offsetHeight||84;stack.scrollTop=newest?0:Math.floor(slots.length/2)*pitch;visualScroll=null;queueStack();}
let frame=0, visualScroll:number|null=null, lastStackTime=0;
function queueStack():void {if(!frame)frame=requestAnimationFrame(updateStack);}
function updateStack(now:number):void {
 frame=0;
 if(document.hidden||!document.body.classList.contains('in-box')){lastStackTime=0;return;}
 const r=stack.getBoundingClientRect();if(!r.height)return;const middle=r.top+r.height/2;
 const slots=[...stack.querySelectorAll<HTMLElement>('.letter-slot')];
 // Read layout before writes. Native scroll travel is 3× the visible spacing.
 const measurements=slots.map(slot=>{const sr=slot.getBoundingClientRect();return {slot,delta:sr.top+sr.height/2-middle,pitch:sr.height,cardHeight:slot.querySelector<HTMLElement>('.saved-envelope')!.offsetHeight};});
 const target=stack.scrollTop,dt=lastStackTime?Math.min(.05,(now-lastStackTime)/1000):1/60;lastStackTime=now;
 if(visualScroll===null||reduced.matches)visualScroll=target;
 else visualScroll+=(target-visualScroll)*(1-Math.exp(-8*dt));
 if(Math.abs(target-visualScroll)<.15)visualScroll=target;
 let nearest:HTMLElement|null=null,nearestDistance=Infinity;
 for(const {slot,delta,pitch,cardHeight} of measurements){
  const visiblePitch=pitch/3;
  const offset=(delta+target-visualScroll)/pitch,distance=Math.abs(offset);
  const t=Math.min(1,Math.max(0,(distance-.08)/.82)),fold=t*t*(3-2*t);
  const spread=Math.max(0,(cardHeight-visiblePitch)/2-12)*fold*Math.sign(offset);
  // Cancel raw layout movement, then draw the eased, tightly spaced stack.
  slot.style.setProperty('--travel',`${offset*visiblePitch-delta}px`);
  slot.style.setProperty('--tilt',`${Math.sign(offset)*76*fold}deg`);
  slot.style.setProperty('--spread',`${spread}px`);
  slot.style.setProperty('--scale',String(1-.025*Math.min(3,distance)));
  slot.style.setProperty('--light',String(1-.035*Math.min(4,distance)));
  slot.style.zIndex=String(100-Math.min(90,Math.round(distance*10)));
  slot.classList.remove('active');
  if(distance<nearestDistance){nearestDistance=distance;nearest=slot;}
 }
 nearest?.classList.add('active');
 if(visualScroll!==target)queueStack();else lastStackTime=0;
}
stack.addEventListener('scroll',queueStack,{passive:true});
function resetStackMotion():void {visualScroll=null;lastStackTime=0;queueStack();}
window.addEventListener('resize',resetStackMotion);reduced.addEventListener('change',resetStackMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;lastStackTime=0;}else resetStackMotion();});
function showBox(newest=false):void {document.body.classList.add('in-box');el('letterbox-view').hidden=false;el('box-tab').setAttribute('aria-current','page');el('write-tab').removeAttribute('aria-current');renderBox(newest);window.scrollTo({top:0,behavior:'instant'});}
function showDesk():void {if(busy)return;document.body.classList.remove('in-box');el('letterbox-view').hidden=true;el('write-tab').setAttribute('aria-current','page');el('box-tab').removeAttribute('aria-current');window.scrollTo({top:0,behavior:'instant'});}
el('box-tab').addEventListener('click',()=>showBox());el('write-tab').addEventListener('click',showDesk);el('empty-write').addEventListener('click',showDesk);
function openLetter(letter:Letter,trigger:HTMLElement):void {viewing=letter;openedFrom=trigger;el('read-date').textContent=letter.id.startsWith('sample-')?'A LETTER FROM THE DEARLY COLLECTION':`POSTMARKED ${new Date(letter.date).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'})}`;el('read-to').textContent=`Dear ${letter.to},`;el('read-message').textContent=letter.message;el('read-from').textContent=letter.from?`With love, ${letter.from}`:'With love, always';el('read-stamp').innerHTML=stampSVG(letter.stamp);dialog.showModal();sound('paper');}
el('close-letter').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{openedFrom?.focus();viewing=null;});
el('download-letter').addEventListener('click',()=>{if(!viewing)return;const text=`Dear ${viewing.to},\n\n${viewing.message}\n\nWith love, ${viewing.from||'always'}\n\nPostmarked ${new Date(viewing.date).toLocaleDateString()} · Dearly / AIB Inc.\n`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='dearly-letter.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
// Storage can change during dispatch; read the latest persisted box once animation unlocks.
function reconcileStorage(newest=false):void {pendingStorage=false;try{letters=readLetters(localStorage.getItem(STORAGE_KEY));el('letter-count').textContent=String(letters.length);if(document.body.classList.contains('in-box'))renderBox(newest);}catch{tell('Your letterbox changed in another tab but could not be read.',true);}}
window.addEventListener('storage',e=>{if(e.storageArea!==localStorage||(e.key!==STORAGE_KEY&&e.key!==null))return;if(busy){pendingStorage=true;return;}reconcileStorage();});
el('letter-count').textContent=String(letters.length);
