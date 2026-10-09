// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import './style.css';
import {Garden} from './garden';
import {defaults,fragment,matrixFor,normalizeUrl,palettes,restore,templates} from './state';
import {qrPixels,verifyPixels} from './qr';
if(new URLSearchParams(location.search).has('preview'))document.body.classList.add('preview');
const el=<T extends HTMLElement>(id:string)=>{const node=document.getElementById(id);if(!node)throw new Error(`Missing ${id}`);return node as T;};
let state=defaults(),qr=false,garden:Garden|undefined;
const status=el('status');
function message(text:string,error=false){status.textContent=text;status.classList.toggle('error',error);}
try{if(location.hash)state=restore(location.hash);}catch(error){message(error instanceof Error?error.message:'This link could not be restored.',true);}
const url=el<HTMLInputElement>('url');url.value=state.url;
const flowerImages=['roses','daisies','tulips','dahlias'] as const;
function sync(){el('palette-name').textContent=palettes[state.palette]!.name.toUpperCase();el('scene-name').textContent=templates[state.template]!.name;el('scene-detail').textContent=qr?'A little beauty. A real connection.':templates[state.template]!.detail;el<HTMLInputElement>('wind').checked=state.wind;
  for(const [id,key] of [['templates','template'],['palettes','palette']] as const)el(id).querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(state[key]===i)));
}
function update(){garden?.update(state,matrixFor(state.url));sync();}
function toggle(){if(!garden||!applyLink())return;qr=!qr;garden.setQR(qr);document.body.classList.toggle('qr-mode',qr);el('stage').setAttribute('aria-pressed',String(qr));el('transform').innerHTML=qr?'Gather the garden <span>↙</span>':'Let it bloom into a QR <span>↗</span>';el('gesture-hint').textContent=qr?'Point your camera here · Tap to gather':'Drag to turn · Tap to transform';sync();}
for(const [i,t] of templates.entries()){const button=document.createElement('button');button.className='template';button.setAttribute('aria-label',t.name);button.innerHTML=`<div class="template-art"><img src="./flowers/${flowerImages[i]}.jpg" alt="" width="480" height="480"></div><span class="template-name">${t.name}</span>`;button.addEventListener('click',()=>{state.template=i;if(qr)toggle();update();message(`${t.name}. A new place to bloom.`);});el('templates').append(button);}
for(const [i,p] of palettes.entries()){const b=document.createElement('button');b.className='palette';b.title=p.name;b.setAttribute('aria-label',p.name);const swatch=document.createElement('span');swatch.style.background=`conic-gradient(${[...p.colours,p.colours[0]].join(",")})`;b.append(swatch);b.addEventListener('click',()=>{state.palette=i;update();message('A fresh colour story.');});el('palettes').append(b);}
function applyLink():boolean {
  try{const next=normalizeUrl(url.value);if(next!==state.url){matrixFor(next);state.url=next;update();}url.value=next;return true;}
  catch(error){message(error instanceof Error?error.message:'Please check the link.',true);return false;}
}
el('link-form').addEventListener('submit',e=>{e.preventDefault();if(applyLink())message('Your flowers have somewhere to go.');});
el('wind').addEventListener('change',()=>{state.wind=el<HTMLInputElement>('wind').checked;update();});
el('transform').addEventListener('click',toggle);el('reset').addEventListener('click',()=>garden?.reset());
function pixels(){const p=qrPixels(state.url,state.palette);if(!verifyPixels(p,state.url))throw new Error('This QR could not be verified. Try a shorter link.');return p;}
el('verify').addEventListener('click',()=>{if(!applyLink())return;try{pixels();if(qr&&garden){if(!verifyPixels(garden.pixels(),state.url))throw new Error('Wait for the flowers to settle, then check again. The download is verified.');message('Verified ✓ Both the 3D QR and download open your link.');}else message('Verified ✓ Your downloadable QR opens the correct link.');}catch(error){message(error instanceof Error?error.message:'Verification failed.',true);}});
el('download').addEventListener('click',()=>{if(!applyLink())return;try{const p=pixels(),canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;const c=canvas.getContext('2d');if(!c)throw new Error('Image export is unavailable.');c.putImageData(new ImageData(new Uint8ClampedArray(p.data),p.width,p.height),0,0);canvas.toBlob(blob=>{if(!blob){message('The QR image could not be saved.',true);return;}const link=document.createElement('a'),href=URL.createObjectURL(blob);link.href=href;link.download=`bloom-${templates[state.template]!.id}-qr.png`;link.click();setTimeout(()=>URL.revokeObjectURL(href),10000);message('A verified little QR, ready to share.');},'image/png');}catch(error){message(error instanceof Error?error.message:'Download failed.',true);}});
el('share').addEventListener('click',async()=>{if(!applyLink())return;try{const link=new URL(location.href);link.hash=fragment(state);await navigator.clipboard.writeText(link.href);message(['localhost','127.0.0.1'].includes(location.hostname)?'Copied. This local garden link works on this computer.':'Garden link copied. Send a little wonder.');}catch{message('Clipboard unavailable. Please allow clipboard access and try again.',true);}});
el('stage').addEventListener('garden-error',e=>message((e as CustomEvent<string>).detail,true));
sync();
try{garden=new Garden(el('stage'),state,toggle,()=>{if(qr)message('In full bloom. Scan from the front or download your QR.');});update();el('loading').hidden=true;}
catch(error){el('loading').textContent='The 3D garden needs WebGL. QR downloads are still available.';message(error instanceof Error?error.message:'The garden could not start.',true);}
if(import.meta.hot)import.meta.hot.dispose(()=>garden?.dispose());
