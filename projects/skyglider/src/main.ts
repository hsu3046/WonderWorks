// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import {createScene,type Settings,type Readout} from './scene';
const $=<E extends HTMLElement=HTMLElement>(selector:string):E=>{const element=document.querySelector<E>(selector);if(!element)throw new Error(`Missing element: ${selector}`);return element;};
const settings:Settings={paused:matchMedia('(prefers-reduced-motion:reduce)').matches,speed:1,golden:false,cinema:false};
const preview=new URLSearchParams(location.search).has('preview');
if(preview)document.body.classList.add('preview');
const dialog=$<HTMLDialogElement>('#guide');let flying=false,grounded=false,noteTimer=0;
const notify=(text:string)=>{$('#notice').textContent=text;clearTimeout(noteTimer);noteTimer=window.setTimeout(()=>$('#notice').textContent='',4500);};
function fail(message:string){$('#loading').hidden=true;$('#error').hidden=false;$('#error-message').textContent=message;if(preview)parent.postMessage({type:'wonderworks:error'},location.origin);}
function syncPause(){
  $('#pause').setAttribute('aria-pressed',String(settings.paused));$('#pause').setAttribute('aria-label',settings.paused?'Resume the scene':'Pause the scene');
  $('#pause-icon').innerHTML=settings.paused?'<path d="m8 5 11 7-11 7Z"/>':'<path d="M8 5v14M16 5v14"/>';
  $('#takeoff span').textContent=grounded?'Back to the oak':flying?(settings.paused?'Continue journey':'Pause journey'):'Take flight';
  $('#takeoff kbd').textContent=grounded?'R':'SPACE';
}
function onStatus(state:Readout){
  flying=state.flying;grounded=state.mode==='grounded';document.body.classList.toggle('flying',flying);document.body.classList.toggle('grounded',grounded);
  $('#speed-label').textContent=flying?'M/S · AIRSPEED':'M/S · WALKING';$('#location').textContent=state.phase;$('#altitude').textContent=String(Math.round(state.altitude));$('#airspeed').textContent=String(state.speed);$('#progress').style.width=`${state.progress*100}%`;
  $('#home').hidden=!flying;$('#land').hidden=!state.canLand&&state.mode!=='landing';$<HTMLButtonElement>('#land').disabled=state.mode==='landing';
  $('#land span').textContent=state.mode==='landing'?'Landing…':'Land nearby';$('.touch-steer').hidden=!state.canLand&&state.mode!=='grounded'&&state.mode!=='perched';
  $('.touch-steer').setAttribute('aria-label',flying?'Flight steering':'Walking controls');
  const labels=flying?['Bank left','Rise','Descend','Bank right']:['Walk left','Walk forward','Walk backward','Walk right'];
  document.querySelectorAll<HTMLButtonElement>('[data-steer]').forEach((button,i)=>button.setAttribute('aria-label',labels[i]!));
  $('#control-hint').textContent=grounded?'WASD / ARROWS TO WALK · R TO RETURN TO THE OAK':flying?'DRAG TO LOOK AROUND · SCROLL TO GET CLOSER':'WASD / ARROWS TO WALK THE BOUGH · SPACE TO FLY';syncPause();
}
try{
  const world=await createScene($<HTMLCanvasElement>('#world'),settings,onStatus,text=>$('#load-message').textContent=text,fail);
  $('#loading').hidden=true;document.body.classList.add('ready');syncPause();
  const pause=()=>{settings.paused=!settings.paused;world.pause();syncPause();};
  $('#takeoff').onclick=()=>{if(grounded)world.home();else if(flying)pause();else{world.depart();syncPause();}};
  const land=()=>{if(world.land())notify('Finding a quiet clearing. Your paws will do the rest.');};$('#land').onclick=land;
  $('#pause').onclick=pause;$('#home').onclick=()=>world.home();
  $('#light').onclick=()=>{settings.golden=!settings.golden;$('#light').setAttribute('aria-pressed',String(settings.golden));world.mood();notify(settings.golden?'The last golden light.':'A clear, sunlit morning.');};
  const toggleCinema=()=>{settings.cinema=!settings.cinema;document.body.classList.toggle('cinema',settings.cinema);$('#restore-ui').hidden=!settings.cinema;$('#cinema').setAttribute('aria-pressed',String(settings.cinema));(settings.cinema?$('#restore-ui'):$('#cinema')).focus();};
  $('#cinema').onclick=toggleCinema;$('#restore-ui').onclick=toggleCinema;
  $('#guide-open').onclick=()=>{world.setActive(false);dialog.showModal();};
  $('#guide-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{world.setActive(true);$('#guide-open').focus();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  $('#speed').oninput=e=>{settings.speed=Number((e.target as HTMLInputElement).value);$('#speed-value').textContent=`${settings.speed.toFixed(1)}×`;};
  $('#capture').onclick=async()=>{try{const blob=await world.snapshot(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='skyglider-a-moment-in-the-valley.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('A little piece of the valley, saved.');}catch(error){notify(error instanceof Error?error.message:'The photograph could not be saved.');}};
  document.querySelectorAll<HTMLButtonElement>('[data-steer]').forEach(button=>{
    const key=button.dataset.steer!;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);world.setSteering(key,true);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>world.setSteering(key,false));
  });
  addEventListener('keydown',e=>{if(dialog.open||e.repeat)return;const target=e.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable=true]'))return;if(e.code==='Space'&&!target.closest('button,a')){e.preventDefault();if(grounded)world.home();else if(flying)pause();else world.depart();}if(e.code==='KeyL')land();if(e.code==='KeyR')world.home();if(e.code==='KeyH')toggleCinema();if(e.code==='KeyP')pause();});
  addEventListener('pagehide',e=>{if(e.persisted)world.setActive(false);else world.dispose();});addEventListener('pageshow',e=>{if(e.persisted)world.setActive(true);});
  if(preview){
    world.depart();world.setActive(false);
    addEventListener('message',event=>{
      if(event.origin!==location.origin||event.source!==parent)return;
      if(event.data?.type==='wonderworks:play')world.setActive(true);
      if(event.data?.type==='wonderworks:pause')world.setActive(false);
    });
    parent.postMessage({type:'wonderworks:ready'},location.origin);
  }
  if(import.meta.env.DEV)Object.defineProperty(window,'skygliderDiagnostics',{value:world.diagnostics});
}catch(error){console.error(error);fail(error instanceof Error?error.message:'WebGL2 could not start. Please reload in a browser with hardware acceleration.');}
