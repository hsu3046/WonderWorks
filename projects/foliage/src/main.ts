// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import './style.css';
import {createScene} from './scene';
import {readSettings,trees,species,weatherNames,seasonAt,type Species,type Weather} from './state';
const s=readSettings(location.search);if(matchMedia('(prefers-reduced-motion:reduce)').matches){s.paused=true;s.auto=false;}const preview=new URLSearchParams(location.search).has('preview');
const $=<E extends HTMLElement>(q:string)=>{const e=document.querySelector<E>(q);if(!e)throw new Error(q);return e;};
$('#app').innerHTML=`<canvas id="world" aria-label="A living seasonal tree. Drag to orbit, scroll to zoom." tabindex="0"></canvas><div class="vignette"></div>
<header><a href="${location.port==='4178'?'http://127.0.0.1:4175/':'../../index.html'}" class="brand"><img src="./mark.svg" alt="" width="23" height="23">wonderworks.</a><span>AN OBSERVATORY OF SMALL CHANGES</span><a href="https://www.aib.vote" target="_blank" rel="noopener">AIB Inc. ↗</a></header>
<aside class="botanical"><p class="eyebrow">FOLIAGE STUDY <span>№ 06</span></p><h1 id="tree-name">Sugar Maple</h1><p class="latin" id="latin">Acer saccharum</p><div class="rule"></div><p class="poem">A year passes.<br>Every leaf remembers.</p><nav aria-label="Tree species">${species.map((k,i)=>`<button data-tree="${k}" aria-pressed="${s.species===k}"><i style="--dot:${['#d8a64b','#e8cc69','#eab9c4','#bac682','#b87559'][i]}"></i>${trees[k].name}</button>`).join('')}</nav></aside>
<aside class="statistics" aria-label="Leaf simulation"><div><b id="attached">26,000</b><span>on the branches</span></div><div><b id="air">0</b><span>in the air</span></div><div><b id="ground">0</b><span>on the ground</span></div><p id="weather-label">Clear skies · 16:00</p></aside>
<div class="year-label"><span id="season-name">Summer</span><em>Through the seasons.</em></div>
<section class="console" aria-label="Season and weather controls"><div class="timeline"><button id="pause" aria-label="Pause simulation">Ⅱ</button><div class="timeline-main"><div class="timeline-top"><span id="stage-name">In full leaf</span><b id="date-label">JUL 17</b></div><input id="year" type="range" min="0" max=".995" step=".001" value="${s.year}" aria-label="Time of year"><div class="season-ticks"><button data-season=".06">Winter</button><button data-season=".29">Spring</button><button data-season=".54">Summer</button><button data-season=".79">Autumn</button></div></div></div>
<div class="weather-options" aria-label="Weather">${weatherNames.map((name,i)=>`<button data-weather="${name}" aria-pressed="${s.weather===name}"><span>${['☀','☁','☂','ϟ','❄'][i]}</span>${name}</button>`).join('')}</div>
<div class="sliders"><label>Wind <input id="wind" type="range" min="0" max="1" step=".01" value="${s.wind}"></label><label>Time <input id="hour" type="range" min="0" max="24" step=".05" value="${s.hour}"></label></div>
<div class="actions"><button id="auto" aria-pressed="${s.auto}">Season drift</button><button id="day" aria-pressed="false">Day drift</button><button id="orbit" aria-pressed="false">Auto-orbit</button><button id="sound" aria-pressed="false">Sound off</button><button id="reset">Reset view</button><button id="save">Save frame ↗</button></div></section>
<footer><span>DRAG TO ORBIT <i>·</i> SCROLL TO EXPLORE</span><button id="hide">HIDE CONTROLS <kbd>H</kbd></button></footer><div id="status" role="status">Growing a little world…</div>`;
let scene:ReturnType<typeof createScene>;
function status(text:string){$('#status').textContent=text;$('#status').hidden=false;}
function sync(){
 const date=new Date(Date.UTC(2026,0,1+Math.floor(s.year*364))),cl=seasonAt(s.year),hour=Math.floor(s.hour),minute=Math.floor((s.hour-hour)*60);
 $('#date-label').textContent=date.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 $('#season-name').textContent=cl;$('#stage-name').textContent=cl==='Winter'?'A quiet rest':cl==='Spring'?'The world wakes':cl==='Summer'?'In full leaf':'Letting go';
 $('#weather-label').textContent=`${s.weather==='clear'?'Clear skies':s.weather} · ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 if(document.activeElement!==$('#year'))$<HTMLInputElement>('#year').value=String(s.year);
 if(document.activeElement!==$('#hour'))$<HTMLInputElement>('#hour').value=String(s.hour);
 $('#tree-name').textContent=trees[s.species].name;$('#latin').textContent=trees[s.species].latin;
 if(scene){const counts=scene.counts();for(const key of ['attached','air','ground'] as const)$(`#${key}`).textContent=counts[key].toLocaleString('en-US');}
 $('#pause').textContent=s.paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-label',s.paused?'Play simulation':'Pause simulation');
}
try{scene=createScene($<HTMLCanvasElement>('#world'),s,sync,status);$('#status').hidden=true;}catch(error){console.error(error);status('This browser could not start the landscape. WebGL2 is required.');throw error;}
for(const key of ['year','hour','wind'] as const)$<HTMLInputElement>(`#${key}`).oninput=e=>{s[key]=Number((e.target as HTMLInputElement).value);if(key==='year'){s.auto=false;$('#auto').setAttribute('aria-pressed','false');}scene.update();sync();};
document.querySelectorAll<HTMLButtonElement>('[data-tree]').forEach(b=>b.onclick=()=>{s.species=b.dataset.tree as Species;document.querySelectorAll('[data-tree]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));scene.update();sync();});
document.querySelectorAll<HTMLButtonElement>('[data-weather]').forEach(b=>b.onclick=()=>{s.weather=b.dataset.weather as Weather;document.querySelectorAll('[data-weather]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));scene.update();sync();});
document.querySelectorAll<HTMLButtonElement>('[data-season]').forEach(b=>b.onclick=()=>{s.year=Number(b.dataset.season);s.auto=false;$('#auto').setAttribute('aria-pressed','false');if(s.year<.2){s.weather='snow';}else if(s.weather==='snow')s.weather='clear';document.querySelectorAll<HTMLButtonElement>('[data-weather]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.weather===s.weather)));scene.update();sync();});
$('#pause').onclick=()=>{s.paused=!s.paused;scene.pause();sync();};
$('#auto').onclick=()=>{s.auto=!s.auto;if(s.auto&&s.year>.98)s.year=.01;$('#auto').setAttribute('aria-pressed',String(s.auto));scene.update();};
$('#day').onclick=()=>{s.dayCycle=!s.dayCycle;$('#day').setAttribute('aria-pressed',String(s.dayCycle));scene.update();};
$('#orbit').onclick=()=>{s.orbit=!s.orbit;$('#orbit').setAttribute('aria-pressed',String(s.orbit));scene.update();};
$('#sound').onclick=async()=>{try{s.sound=!s.sound;await scene.setSound(s.sound&&!s.paused);$('#sound').textContent=s.sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(s.sound));}catch{ s.sound=false;status('Sound is unavailable. Try again after interacting with the page.');}};
$('#reset').onclick=()=>scene.resetView();$('#hide').onclick=()=>document.body.classList.toggle('hidden-ui');
$('#save').onclick=async()=>{try{const blob=await scene.snapshot(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`foliage-${s.species}-${seasonAt(s.year).toLowerCase()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);}catch{status('The frame could not be saved. Please try again.');}};
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLButtonElement)return;if(e.code==='Space'){e.preventDefault();$('#pause').click();}if(e.key.toLowerCase()==='h')$('#hide').click();});
addEventListener('pagehide',()=>scene.setActive(false));addEventListener('pageshow',()=>scene.setActive(true));
Object.defineProperty(window,'foliageDiagnostics',{value:()=>({frames:scene.frames,time:scene.time,settings:{...s},counts:scene.counts(),rendering:scene.rendering})});
if(preview){document.body.classList.add('preview');s.paused=true;scene.pause();addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='wonderworks:play'){s.paused=false;scene.pause();}if(e.data?.type==='wonderworks:pause'){s.paused=true;scene.pause();}});}
sync();
