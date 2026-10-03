// SPDX-License-Identifier: GPL-3.0-only
import {projects,type Project,type Variant} from './catalog';
import {createSculpture} from './sculpture';
import {createPreviews} from './previews';
import {attribution,tags,renderCredits,renderIndex,renderCards} from './render';
const query=<T extends HTMLElement>(selector:string)=>{const result=document.querySelector<T>(selector);if(!result)throw new Error(`Missing element: ${selector}`);return result;};
const hero=createSculpture(query<HTMLCanvasElement>('#sculpture'));
const grid=query('#projects'),dialog=query<HTMLDialogElement>('#project-dialog'),credits=query<HTMLDialogElement>('#credits-dialog');
const selected=new Map<string,Variant>();projects.forEach(p=>selected.set(p.id,p.variants[0]));
// Build-time HTML is already crawlable. The same renderer supplies development fallbacks.
if(!query('#project-credits').children.length)query('#project-credits').innerHTML=renderCredits(projects);
if(!query('#project-index').children.length)query('#project-index').innerHTML=renderIndex(projects);
if(!grid.children.length)grid.innerHTML=renderCards(projects);
const previews=createPreviews(busy=>hero.setActive(!busy&&!dialog.open&&!credits.open));
for(const project of projects){
 const card=query(`#project-${project.id}`),host=card.querySelector<HTMLElement>('.artwork')!;
 previews.add(host,selected.get(project.id)!);
 card.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach(button=>button.addEventListener('click',()=>{
  const variant=project.variants.find(item=>item.id===button.dataset.variant)!;selected.set(project.id,variant);previews.select(host,variant);card.querySelectorAll<HTMLAnchorElement>('a[data-open]').forEach(a=>a.href=variant.path);
  card.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 }));
}
const observers=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observers.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(e=>observers.observe(e));
let opener:HTMLElement|null=null;
function renderDetail(project:Project,variant:Variant){
 const body=query('#detail-content');body.innerHTML=`<div class="detail-grid" style="--accent:${project.color}"><div class="detail-visual"><img src="${previews.poster(variant)}" alt="${variant.name} preview"><button class="detail-live-button">Play live preview</button><small class="live-status" role="status">${project.id==='jelly'?'Touch and drag the jelly to deform it.':'Explore the full experience for all controls.'}</small></div><div class="detail-copy"><p class="category">STUDY ${project.number} / ${project.category}</p><h2 id="detail-title">${project.title}</h2><p>${project.description}</p>${attribution(project)}${tags(project.tech)}${project.variants.length>1?`<div class="variant-picker">${project.variants.map(v=>`<button data-detail-variant="${v.id}" aria-pressed="${v.id===variant.id}">${v.name}</button>`).join('')}</div>`:''}<dl class="detail-specs">${project.specs.map(([name,value])=>`<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl><div class="detail-actions"><a class="solid-button" href="${variant.path}" target="_blank" rel="noopener">Open ${project.id==='jelly'?variant.name:'experience'}</a><a class="outline-button" href="${project.source}" download>Download source</a></div><p class="license">${project.license}</p></div></div>`;
 body.querySelectorAll<HTMLButtonElement>('[data-detail-variant]').forEach(button=>button.addEventListener('click',()=>{renderDetail(project,project.variants.find(v=>v.id===button.dataset.detailVariant)!);}));
 body.querySelector<HTMLButtonElement>('.detail-live-button')!.addEventListener('click',event=>{const button=event.currentTarget as HTMLButtonElement,visual=body.querySelector('.detail-visual')!,status=body.querySelector('.live-status')!;const frame=document.createElement('iframe');frame.src=variant.preview;frame.title=`Interactive ${variant.name}`;frame.allow='autoplay; fullscreen';visual.insertBefore(frame,status);button.remove();status.textContent='Preparing the experience…';
  let loaded=false;const onReady=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;if(e.data?.type==='wonderworks:ready'){loaded=true;frame.contentWindow?.postMessage({type:'wonderworks:play'},location.origin);status.textContent=project.id==='jelly'?'Drag to stretch · Open the full study for tools':'Live scene · Open the experience for full-screen controls';window.removeEventListener('message',onReady);}else if(e.data?.type==='wonderworks:error'){loaded=true;status.textContent='Preview unavailable. Try opening the full experience.';window.removeEventListener('message',onReady);}};window.addEventListener('message',onReady);window.setTimeout(()=>{window.removeEventListener('message',onReady);if(!loaded&&frame.isConnected)status.textContent='Still loading. You can open the full experience instead.';},project.id==='skyglider'?60000:25000);
 });
}
function openProject(id:string,trigger:HTMLElement){const p=projects.find(item=>item.id===id);if(!p)return;previews.suspend(true);hero.setActive(false);opener=trigger;renderDetail(p,selected.get(id)!);dialog.showModal();document.body.classList.add('dialog-open');}
document.querySelectorAll<HTMLElement>('[data-open]').forEach(button=>button.addEventListener('click',event=>{if(event instanceof MouseEvent&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return;event.preventDefault();openProject(button.dataset.open!,button);}));
query('#detail-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{query('#detail-content').replaceChildren();document.body.classList.remove('dialog-open');previews.suspend(false);opener?.focus({preventScroll:true});});
query('#credits-open').addEventListener('click',()=>{previews.suspend(true);hero.setActive(false);credits.showModal();document.body.classList.add('dialog-open');});query('#credits-close').addEventListener('click',()=>credits.close());credits.addEventListener('close',()=>{document.body.classList.remove('dialog-open');previews.suspend(false);query('#credits-open').focus({preventScroll:true});});
for(const modal of [dialog,credits])modal.addEventListener('click',event=>{if(event.target!==modal)return;const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();});

window.addEventListener('pagehide',event=>{if(event.persisted)previews.suspend(true);else{previews.dispose();hero.dispose();}});
window.addEventListener('pageshow',event=>{if(event.persisted)previews.suspend(false);});
