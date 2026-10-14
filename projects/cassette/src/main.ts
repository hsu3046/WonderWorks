// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import './style.css';
import {Viewer} from './viewer';
import {cleanTitle,defaults,MAX_TITLE,shells,type Transport} from './settings';
const el=<T extends HTMLElement>(id:string)=>{const n=document.getElementById(id);if(!n)throw new Error(`Missing ${id}`);return n as T;};
const state=defaults();let viewer:Viewer|undefined;let titleTimer=0;
const events=new AbortController(),signal=events.signal;
function status(text:string,error=false){el('status').textContent=text;el('status').classList.toggle('error',error);}
const transports:Transport[]=['rewind','play','stop'];
function syncTransport(){for(const t of transports)el(t).setAttribute('aria-pressed',String(state.transport===t));}
function syncShell(){el('shells').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===state.shell)));el('shell-name').textContent=shells[state.shell]!.name;}
for(const [i,shell] of shells.entries()){const b=document.createElement('button');b.type='button';b.className='swatch';b.style.setProperty('--swatch',shell.color);b.setAttribute('aria-label',`${shell.name} shell`);b.title=shell.name;b.addEventListener('click',()=>{state.shell=i;viewer?.setShell(shell);syncShell();status(`${shell.name} shell.`);},{signal});el('shells').append(b);}
try{
 viewer=new Viewer(el('stage'),message=>status(message,true),transport=>{state.transport=transport;syncTransport();status(transport==='play'?'End of tape. Auto-reverse: playing.':'End of tape. Auto-reverse: rewinding.');});
 if(viewer.prefersStill){state.transport='stop';state.auto=false;status('Holding still. Press play or drag to move.');}
 viewer.setTitle(state.title);viewer.setShell(shells[state.shell]!);viewer.setHolo(state.holo);viewer.setAuto(state.auto);viewer.setTransport(state.transport);
 el('loading').hidden=true;
}catch(error){
 el('loading').textContent='The cassette needs WebGL. Try a browser with hardware acceleration.';
 status(error instanceof Error?error.message:'WebGL is unavailable.',true);
}
for(const t of transports)el(t).addEventListener('click',()=>{state.transport=t;viewer?.setTransport(t);syncTransport();status(t==='rewind'?'Rewinding.':t==='play'?'Playing side A.':'Stopped.');},{signal});
el('auto').addEventListener('click',()=>{state.auto=!state.auto;el('auto').setAttribute('aria-pressed',String(state.auto));viewer?.setAuto(state.auto);status(state.auto?'Turning on its own. Drag any time.':'Holding still. Drag to turn it.');},{signal});
el('reset').addEventListener('click',()=>{viewer?.reset();status('Back to the front.');},{signal});
el('holo').addEventListener('input',()=>{state.holo=Number(el<HTMLInputElement>('holo').value)/100;el('holo-value').textContent=`${Math.round(state.holo*100)}%`;viewer?.setHolo(state.holo);},{signal});
const titleInput=el<HTMLInputElement>('title');titleInput.maxLength=MAX_TITLE;titleInput.value=state.title;
function applyTitle(){window.clearTimeout(titleTimer);titleTimer=0;const title=cleanTitle(titleInput.value);if(title===state.title)return;state.title=title;viewer?.setTitle(title);}
titleInput.addEventListener('input',()=>{window.clearTimeout(titleTimer);titleTimer=window.setTimeout(applyTitle,180);},{signal});
titleInput.addEventListener('blur',applyTitle,{signal});
titleInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyTitle();titleInput.blur();}},{signal});
el('save').addEventListener('click',async()=>{
 const button=el<HTMLButtonElement>('save');if(!viewer||button.disabled)return;applyTitle();button.disabled=true;status('Saving a picture…');
 try{const blob=await viewer.snapshot();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`cassette-${state.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'tape'}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);status('Saved. A little tape, kept.');}
 catch(error){status(error instanceof Error?error.message:'Could not save this picture.',true);}
 finally{button.disabled=false;}
},{signal});
syncTransport();syncShell();el('auto').setAttribute('aria-pressed',String(state.auto));el('holo-value').textContent=`${Math.round(state.holo*100)}%`;
if(import.meta.hot)import.meta.hot.dispose(()=>{window.clearTimeout(titleTimer);events.abort();viewer?.dispose();});
