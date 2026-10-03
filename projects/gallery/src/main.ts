// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {projects} from './catalog';
import {createSculpture} from './sculpture';
import {createPreviews} from './previews';
import {renderCredits,renderIndex,renderCards} from './render';
const query=<T extends HTMLElement>(selector:string)=>{const result=document.querySelector<T>(selector);if(!result)throw new Error(`Missing element: ${selector}`);return result;};
const hero=createSculpture(query<HTMLCanvasElement>('#sculpture'));
const grid=query('#projects');
// The initial HTML includes descriptions, controls, credits and source downloads.
if(!query('#project-credits').children.length)query('#project-credits').innerHTML=renderCredits(projects);
if(!query('#project-index').children.length)query('#project-index').innerHTML=renderIndex(projects);
if(!grid.children.length)grid.innerHTML=renderCards(projects);
const previews=createPreviews(busy=>hero.setActive(!busy));
for(const project of projects){
 const card=query(`#project-${project.id}`),host=card.querySelector<HTMLElement>('.artwork')!;
 previews.add(host,project.variants[0]!);
 card.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach(button=>button.addEventListener('click',()=>{
  const variant=project.variants.find(item=>item.id===button.dataset.variant);
  if(!variant)return;
  previews.select(host,variant);
  // Keep the card and top index pointed at the selected variation.
  document.querySelectorAll<HTMLAnchorElement>(`a[data-work="${project.id}"]`).forEach(a=>a.href=variant.path);
  card.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 }));
}
const observers=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observers.unobserve(entry.target);}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>observers.observe(e));
// Standard links open experiences in a new tab and preserve native modifier clicks.
window.addEventListener('pagehide',event=>{if(event.persisted)previews.suspend(true);else{observers.disconnect();previews.dispose();hero.dispose();}});
window.addEventListener('pageshow',event=>{if(event.persisted)previews.suspend(false);});
