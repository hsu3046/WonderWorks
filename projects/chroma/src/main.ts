// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import './style.css';
import {sequenceDuration} from './sequence';
import {createScene} from './scene';
import {defaults,modes,palettes,modeInfo,readSettings,type Mode,type Palette,type Settings} from './state';
const settings=readSettings(location.search),preview=new URLSearchParams(location.search).has('preview');
const $=<T extends HTMLElement>(q:string)=>{const el=document.querySelector<T>(q);if(!el)throw new Error(`Missing ${q}`);return el;};
const slider=(key:keyof Settings,name:string,min:number,max:number,step:number,unit='')=>`<label class="parameter" for="${key}"><span>${name}</span><output id="${key}-value">${settings[key]}${unit}</output><input id="${key}" data-unit="${unit}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`;
$('#app').innerHTML=`
<header><a class="studio-brand" href="${location.port==='4176'?'http://127.0.0.1:4175/':'../../index.html'}" aria-label="Back to Wonderworks"><img src="./mark.svg" width="28" height="28" alt=""><span>wonderworks.</span></a><span class="header-label">THE MOTION STUDIES</span><a class="credit" href="https://www.aib.vote" target="_blank" rel="noopener">AIB Inc. ↗</a></header>
<main>
 <section class="workspace" aria-label="Motion canvas">
  <div class="intro"><div><p class="eyebrow">COLOUR IN MOTION / A GENERATIVE PLAYGROUND</p><h1>Chroma <em>Motion.</em></h1></div><p class="intro-copy">A little shape.<br>A lot of possibility.</p></div>
  <div class="stage" id="stage"><canvas id="scene" aria-label="Interactive gradient sculpture. Drag to orbit." tabindex="0"></canvas><div class="stage-top"><span class="live"><i></i><span id="play-state">LIVE STUDY</span></span><span id="scene-name">ELASTIC COLUMNS</span></div><div class="stage-bottom"><span>DRAG TO ORBIT</span><div><button id="pause" aria-label="Pause animation">Ⅱ</button><button id="restart" aria-label="Restart animation and reset view">↺</button><button id="fullscreen" aria-label="Enter fullscreen">⛶</button></div></div><div id="loading" role="status">Preparing colour & motion…</div></div>
  <div class="caption"><span class="caption-index">↳</span><p id="caption">${modeInfo[settings.mode].note}</p><button id="snapshot">Save frame <span>↗</span></button></div>
 </section>
 <aside aria-label="Effect controls"><div class="panel-heading"><div><p class="eyebrow">MAKE IT YOUR OWN</p><h2>The controls<span>.</span></h2></div><button id="reset" title="Reset this effect">Reset ↺</button></div>
 <section class="control-section"><h3><span>01</span> Choose a movement</h3><div class="mode-grid">${modes.map(mode=>`<button class="mode" data-mode="${mode}" aria-pressed="${settings.mode===mode}"><span class="mode-icon" aria-hidden="true">${modeInfo[mode].icon}</span><span>${modeInfo[mode].name}</span></button>`).join('')}</div></section>
 <section class="control-section"><h3><span>02</span> Set the mood <small id="palette-name">${settings.palette}</small></h3><div class="palette-list">${Object.entries(palettes).map(([name,colors])=>`<button class="swatch" data-palette="${name}" aria-label="${name} palette" aria-pressed="${settings.palette===name}" title="${name}" style="--swatch:linear-gradient(135deg,${colors[0]},${colors[1]} 35%,${colors[2]} 80%,${colors[3]})"></button>`).join('')}</div></section>
 <section class="control-section tuning"><h3><span>03</span> Find your rhythm</h3>${slider('speed','Tempo',0,2.5,.05,'×')}${slider('amplitude','Elasticity',0,1.8,.05)}${slider('twist','Twist',0,2.5,.05)}${slider('count','Multiplicity',1,9,1)}<p class="control-note" id="count-note">Original mix uses its own arrangement.</p><details><summary>Fine adjustments <span>+</span></summary>${slider('grain','Film grain',0,.16,.005)}${slider('zoom','Scale',.65,1.4,.01)}${slider('phase','Phase offset',0,sequenceDuration,.1)}</details></section>
 <div class="panel-actions"><button class="remix" id="remix">↝ <span>Surprise me</span></button><button id="share" aria-label="Copy a link to this variation">Copy variation link ↗</button></div>
 <p class="panel-foot">Every variation is yours to explore.<br><kbd>Space</kbd> pause · <kbd>R</kbd> restart · <kbd>H</kbd> focus</p>
 </aside>
</main><div id="notice" role="status" aria-live="polite" hidden></div><footer><span>REAL-TIME SHAPES. ENDLESS VARIATIONS.</span><span>© 2026 <a href="https://www.aib.vote" target="_blank" rel="noopener">AIB Inc.</a></span></footer>`;
if(preview)document.body.classList.add('preview');
let noticeTimer=0;
function notice(message:string){const el=$('#notice');el.textContent=message;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=window.setTimeout(()=>el.hidden=true,4500);}
function error(message:string){const el=$('#loading');el.hidden=false;el.innerHTML='';const text=document.createElement('p');text.textContent=message;const button=document.createElement('button');button.textContent='Reload studio';button.onclick=()=>location.reload();el.append(text,button);}
let scene:ReturnType<typeof createScene>;
try{
 let displayMode='';scene=createScene($<HTMLCanvasElement>('#scene'),settings,mode=>{if(displayMode!==mode){displayMode=mode;$('#scene-name').textContent=modeInfo[mode].name.toUpperCase();}},error);
 $('#loading').hidden=true;
}catch(cause){console.error(cause);error('This browser could not start the 3D canvas. WebGL2 is required.');throw cause;}
function sync(){
 document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===settings.mode)));
 document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===settings.palette)));
 for(const key of ['speed','amplitude','twist','count','grain','zoom','phase'] as const){const input=$<HTMLInputElement>(`#${key}`);input.value=String(settings[key]);$(`#${key}-value`).textContent=`${Number(settings[key].toFixed(3))}${input.dataset.unit??''}`;}
 $('#palette-name').textContent=settings.palette;$('#caption').textContent=modeInfo[settings.mode].note;
 $<HTMLInputElement>('#count').disabled=settings.mode==='sequence'||settings.mode==='wave';$('#count-note').hidden=settings.mode!=='sequence'&&settings.mode!=='wave';
 $('#count-note').textContent=settings.mode==='wave'?'Wave field uses three bars.':'Original mix uses its own arrangement.';
 $('#play-state').textContent=scene.paused||settings.speed===0?'STILL STUDY':'LIVE STUDY';$('#pause').textContent=scene.paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',scene.paused?'Play animation':'Pause animation');scene.update();
}
function choose(mode:Mode){settings.mode=mode;settings.count=modeInfo[mode].count;scene.restart();sync();}
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b=>b.onclick=()=>choose(b.dataset.mode as Mode));
document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(b=>b.onclick=()=>{settings.palette=b.dataset.palette as Palette;sync();});
for(const key of ['speed','amplitude','twist','count','grain','zoom','phase'] as const)$<HTMLInputElement>(`#${key}`).oninput=e=>{settings[key]=Number((e.target as HTMLInputElement).value);sync();};
$('#pause').onclick=()=>{scene.setPaused(!scene.paused);sync();};$('#restart').onclick=()=>scene.restart();
$('#reset').onclick=()=>{const mode=settings.mode;Object.assign(settings,defaults,{mode,count:modeInfo[mode].count});scene.restart();sync();};
$('#remix').onclick=()=>{const options=Object.keys(palettes) as Palette[];settings.palette=options[Math.floor(Math.random()*options.length)];settings.amplitude=Number((.5+Math.random()*1.15).toFixed(2));settings.twist=Number((.3+Math.random()*2).toFixed(2));settings.speed=Number((.5+Math.random()*.85).toFixed(2));settings.phase=Math.random()*sequenceDuration;if(settings.mode!=='sequence'&&settings.mode!=='wave')settings.count=1+Math.floor(Math.random()*7);scene.restart();sync();};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#stage').requestFullscreen();}catch{notice('Fullscreen is unavailable in this browser.');}};
$('#snapshot').onclick=async()=>{try{const blob=await scene.snapshot(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`chroma-${settings.mode}-${settings.palette}.png`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1500);notice('Your frame has been saved.');}catch{notice('The frame could not be saved. Please try again.');}};
$('#share').onclick=async()=>{const url=new URL(location.href);url.search='';for(const [key,value]of Object.entries(settings))url.searchParams.set(key,String(value));history.replaceState(null,'',url);try{await Promise.race([navigator.clipboard.writeText(url.toString()),new Promise<never>((_,reject)=>window.setTimeout(()=>reject(new Error('Clipboard timed out')),2500))]);notice('Variation link copied. It includes every control setting.');}catch{notice('Clipboard unavailable. Your variation is now in the address bar.');}};
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;if(e.code==='Space'&&(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement))return;if(e.code==='Space'){e.preventDefault();$('#pause').click();}if(e.key.toLowerCase()==='r')scene.restart();if(e.key.toLowerCase()==='h')document.body.classList.toggle('focus-mode');});
addEventListener('pagehide',()=>scene.setActive(false));addEventListener('pageshow',()=>scene.setActive(true));
// Narrow read-only diagnostics help verify that pause/hidden states stop rendering.
Object.defineProperty(window,'chromaDiagnostics',{value:()=>({frames:scene.frames,time:scene.time,paused:scene.paused,mode:scene.mode,transition:scene.transitionState,settings:{...settings}})});
if(preview){
 const sendFrame=()=>{scene.draw();scene.canvas.toBlob(blob=>parent.postMessage({type:'wonderworks:ready',blob,width:scene.canvas.width,height:scene.canvas.height},location.origin),'image/webp',.95);};
 requestAnimationFrame(()=>{scene.setPaused(true);sendFrame();});
 addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='wonderworks:play'){scene.setPaused(false);parent.postMessage({type:'wonderworks:playing'},location.origin);}if(e.data?.type==='wonderworks:pause'){scene.setPaused(true);sendFrame();}});
}
sync();
