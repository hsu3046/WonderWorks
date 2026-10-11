// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import './style.css';
import {Viewer} from './viewer';
import {defaults,finishes,imageAddress,region,type Zone} from './settings';
import {decode,remoteImage} from './image';
const el=<T extends HTMLElement>(id:string)=>{const n=document.getElementById(id);if(!n)throw new Error(`Missing ${id}`);return n as T;};
const state=defaults();let viewer:Viewer|undefined;let generation=0;let controller:AbortController|undefined;let hasImage=false;
const eventController=new AbortController(),signal=eventController.signal;
function message(text:string,error=false){el('status').textContent=text;el('status').classList.toggle('error',error);}
function update(){viewer?.update(state);el('finish-label').textContent=finishes[state.finish]!.name.toUpperCase();el('finish-description').textContent=finishes[state.finish]!.detail;el('compare').setAttribute('aria-pressed',String(state.compare));el('region-controls').hidden=state.zone==='full';el('finishes').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===state.finish)));el('zones').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.zone===state.zone)));}
for(const [i,f] of finishes.entries()){const b=document.createElement('button');b.className='finish';b.setAttribute('aria-label',f.name);b.innerHTML=`<span class="swatch ${f.family}"></span><strong>${f.name}</strong>`;b.title=f.tag;b.addEventListener('click',()=>{state.finish=i;update();},{signal});el('finishes').append(b);}
const sliders=['intensity','glare','scale','grain','edge'] as const;
function sync(){for(const key of sliders){el<HTMLInputElement>(key).value=String(Math.round(state[key]*100));el(`${key}-value`).textContent=key==='scale'?`${state[key].toFixed(1)}×`:`${Math.round(state[key]*100)}%`;}
 for(const key of ['top','bottom','left','right'] as const)el<HTMLInputElement>(key).value=String(state[key]*100);
 el<HTMLInputElement>('motion').checked=state.motion;update();}
for(const key of sliders)el<HTMLInputElement>(key).addEventListener('input',e=>{state[key]=Number((e.target as HTMLInputElement).value)/100;sync();},{signal});
el('zones').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.addEventListener('click',()=>{state.zone=b.dataset.zone as Zone;update();},{signal}));
for(const key of ['top','bottom','left','right'] as const)el<HTMLInputElement>(key).addEventListener('input',e=>{state[key]=Number((e.target as HTMLInputElement).value)/100;const [l,t,r,b]=region(state.top,state.bottom,state.left,state.right);state.left=l;state.top=t;state.right=r;state.bottom=b;sync();},{signal});
el('motion').addEventListener('change',()=>{state.motion=el<HTMLInputElement>('motion').checked;update();},{signal});
el('compare').addEventListener('click',()=>{state.compare=!state.compare;update();},{signal});
el('reset').addEventListener('click',()=>{state.motion=false;sync();viewer?.reset();},{signal});el('restore').addEventListener('click',()=>{Object.assign(state,defaults());sync();viewer?.reset();},{signal});
async function load(get:(abort:AbortSignal)=>Promise<Blob>,name:string){
 const ticket=++generation;controller?.abort();const current=new AbortController();controller=current;
 const timer=setTimeout(()=>current.abort(),20000);message('Preparing your image…');el('stage').setAttribute('aria-busy','true');
 try{const blob=await get(current.signal);if(ticket!==generation)return;const image=await decode(blob);if(ticket!==generation||current.signal.aborted){if(current.signal.aborted&&ticket===generation)throw new Error('Image loading timed out. Try uploading the file.');return;}if(!viewer)throw new Error('WebGL is unavailable. Please use a browser with hardware acceleration.');viewer.setImage(image);hasImage=true;el('source').textContent=name;el('loading').hidden=true;el<HTMLButtonElement>('save').disabled=false;message('Your card, in a different light.');
 }catch(error){if(ticket!==generation)return;const fallback=current.signal.aborted?'Image loading timed out. Try uploading the file.':error instanceof TypeError?'This server does not allow image access. Download the image and upload it here.':error instanceof Error?error.message:'The image could not be loaded.';message(fallback,true);if(!hasImage){el('loading').textContent='Drop a card image to begin.';}}
 finally{clearTimeout(timer);if(ticket===generation)el('stage').removeAttribute('aria-busy');}
}
function fileLoad(file:File){void load(async()=>file,file.name);}
function sample(){void load(s=>remoteImage(new URL('./art/lunara.jpg',document.baseURI).href,s),'Lunara · Original sample');}
el('upload').addEventListener('click',()=>el<HTMLInputElement>('file').click(),{signal});
el<HTMLInputElement>('file').addEventListener('change',e=>{const input=e.target as HTMLInputElement;const file=input.files?.[0];if(file)fileLoad(file);input.value='';},{signal});
el('sample').addEventListener('click',sample,{signal});
el('url-form').addEventListener('submit',e=>{e.preventDefault();try{const address=imageAddress(el<HTMLInputElement>('image-url').value);void load(s=>remoteImage(address,s),'Your linked image');}catch(error){message(error instanceof Error?error.message:'Check the image URL.',true);}},{signal});
// Document-level drop prevention stops a card file from navigating away from the studio.
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragDepth++;document.body.classList.add('dragging');}},{signal});
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();},{signal});
document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)document.body.classList.remove('dragging');},{signal});
document.addEventListener('drop',e=>{if(!e.dataTransfer?.types.includes('Files'))return;e.preventDefault();dragDepth=0;document.body.classList.remove('dragging');const file=e.dataTransfer.files[0];if(file)fileLoad(file);},{signal});
el('save').addEventListener('click',async()=>{if(!viewer||!hasImage)return;const button=el<HTMLButtonElement>('save');button.disabled=true;try{const blob=await viewer.snapshot(),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=`prism-${finishes[state.finish]!.family}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(href),10000);message('Reflection saved. A still frame of your foil finish.');}catch(error){message(error instanceof Error?error.message:'Could not save the reflection.',true);}finally{button.disabled=!hasImage;}},{signal});
el<HTMLButtonElement>('save').disabled=true;
try{viewer=new Viewer(el('stage'),text=>{message(text,true);el<HTMLButtonElement>('save').disabled=true;});sync();sample();}catch(error){el('loading').textContent='This studio needs WebGL.';message(error instanceof Error?error.message:'Please enable hardware acceleration.',true);}
// A successful user image is never replaced by a late sample response.
if(import.meta.hot)import.meta.hot.dispose(()=>{generation++;controller?.abort();eventController.abort();viewer?.dispose();});
