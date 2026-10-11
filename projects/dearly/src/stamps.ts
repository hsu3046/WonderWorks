// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import type { StampId } from './model';
export const stamps: {id:StampId; name:string; colour:string; ink:string; motif:string}[] = [
 {id:'fern',name:'Wild fern',colour:'#c2cbb3',ink:'#45543e',motif:'<path d="M45 82Q41 51 57 23"/><path d="M46 69Q21 70 26 53Q44 55 46 69M46 59Q26 55 32 42Q47 47 46 59M49 47Q34 40 42 30Q53 36 49 47M48 64Q71 61 71 47Q54 49 48 64M51 50Q73 42 68 32Q55 36 51 50M55 36Q68 29 63 19Q56 22 55 36" fill="currentColor" stroke="none"/>'},
 {id:'iris',name:'Blue hour',colour:'#c5c6d2',ink:'#505272',motif:'<path d="M50 83V48M50 77Q29 68 31 53Q44 60 50 77M51 72Q72 61 69 49Q57 57 51 72"/><path d="M50 50C18 48 25 18 42 33C37 10 67 9 59 33C83 16 80 52 50 50Z" fill="currentColor"/><path d="M50 34V52M42 35L50 49L61 36" stroke="#eee8d7"/>'},
 {id:'sun',name:'First light',colour:'#e4c07d',ink:'#9a6639',motif:'<circle cx="50" cy="43" r="15" fill="currentColor"/><path d="M50 19V13M50 73V67M25 43H18M81 43H74M32 25L27 20M68 25L73 20M32 61L27 66M68 61L73 66M17 81Q32 68 48 81T83 81"/>'},
 {id:'moon',name:'Moon mail',colour:'#b8c2c5',ink:'#3e5860',motif:'<path d="M65 24A26 26 0 1 0 72 62A25 25 0 0 1 65 24Z" fill="currentColor"/><path d="M29 21V31M24 26H34M74 40V48M70 44H78M48 75V85M43 80H53"/>'},
 {id:'bird',name:'A little flight',colour:'#c6ced7',ink:'#466280',motif:'<path d="M22 55Q39 51 49 40Q37 18 21 22Q33 43 42 47Q24 49 22 55M43 47Q53 50 64 39Q76 29 82 39L88 42L79 45Q69 64 48 58L24 74L32 57" fill="currentColor" stroke="none"/><circle cx="78" cy="39" r="1.5" fill="#fff"/>'},
 {id:'orange',name:'Sunday citrus',colour:'#e0bc9d',ink:'#a75d36',motif:'<circle cx="48" cy="57" r="22" fill="currentColor"/><path d="M50 35Q46 22 51 17M50 30Q73 12 78 28Q61 37 50 30" fill="#69784d" stroke="#69784d"/><path d="M35 47Q29 54 33 61" stroke="#f0d7b2"/>'},
];
function perforation(): string {
 let d='M8 4'; for(let x=8;x<92;x+=7)d+=`h2q2.5 6 5 0`;d+='h4v4';for(let y=8;y<113;y+=7)d+='v2q-6 2.5 0 5';d+='v3h-4';for(let x=92;x>8;x-=7)d+='h-2q-2.5 -6 -5 0';d+='H4v-4';for(let y=113;y>8;y-=7)d+='v-2q6 -2.5 0 -5';return d+'Z';
}
export function stampSVG(id: StampId): string {
 const s=stamps.find(s=>s.id===id)!;
 return `<svg viewBox="0 0 100 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="${perforation()}" fill="#f6f1df"/><path fill="${s.colour}" d="M12 12h76v102H12z"/><path d="M17 17h66v79H17z" fill="none" stroke="${s.ink}" opacity=".45"/><g fill="none" stroke="${s.ink}" color="${s.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${s.motif}</g><text x="50" y="106" text-anchor="middle" font-family="Georgia,serif" font-size="6.5" letter-spacing="1.5" fill="${s.ink}">DEARLY POST</text><text x="75" y="28" text-anchor="middle" font-family="Georgia,serif" font-size="9" fill="${s.ink}">60</text></svg>`;
}
let impressionId=0;
export function postmark(date: string): string {
 const d=new Date(date);const label=`${d.getDate().toString().padStart(2,'0')} ${d.toLocaleString('en-GB',{month:'short'}).toUpperCase()} ${d.getFullYear()}`;
 // Each letter keeps its own dry-ink pattern; SVG IDs stay unique in a full letterbox.
 let seed=2166136261;for(const c of date)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 const random=():number=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const id=`ink-${++impressionId}`;
 const flecks=Array.from({length:170},()=>`<ellipse cx="${(12+random()*246).toFixed(2)}" cy="${(8+random()*101).toFixed(2)}" rx="${(.25+random()*.75).toFixed(2)}" ry="${(.15+random()*.36).toFixed(2)}" fill="#222" opacity="${(.3+random()*.65).toFixed(2)}"/>`).join('');
 const ringWear=Array.from({length:30},()=>{const a=random()*Math.PI*2,r=random()<.5?42:48,x=62+Math.cos(a)*r,y=59+Math.sin(a)*r;return `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="${(.6+random()*1.8).toFixed(2)}" ry="${(.4+random()*.8).toFixed(2)}" transform="rotate(${(a*180/Math.PI+90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="#111" opacity=".8"/>`;}).join('');
 const waves=[29,41,53,65,77].map((y,i)=>`<path d="M110 ${y}q18 -11 37 0t37 0t37 0t37 0" stroke-width="${[1.3,1.55,1.15,1.4,1.2][i]}" opacity="${[.85,.66,.92,.74,.62][i]}"/>`).join('');
 return `<svg viewBox="0 0 260 118" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${id}-pressure" x1="0" y1="0" x2="1" y2=".65"><stop stop-color="#b3b3b3"/><stop offset=".28" stop-color="#fff"/><stop offset=".58" stop-color="#ccc"/><stop offset=".84" stop-color="#999"/><stop offset="1" stop-color="#dedede"/></linearGradient><mask id="${id}-wear" maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="118"><path d="M0 0h260v118H0z" fill="url(#${id}-pressure)"/>${flecks}${ringWear}<path d="M21 76q50 -9 86 5M122 33l86 27" fill="none" stroke="#777" stroke-width="1.1" opacity=".45"/></mask></defs><g mask="url(#${id}-wear)"><g fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="62" cy="59" r="48" stroke-width="1.55"/><circle cx="62" cy="59" r="42" stroke-width="1.15" opacity=".75"/>${waves}</g><g fill="currentColor" text-anchor="middle" font-family="Courier New,monospace"><text x="62" y="40" font-size="10" letter-spacing="2" transform="rotate(-.7 62 40)">DEARLY</text><text x="62" y="62" font-size="9" opacity=".88">${label}</text><text x="62" y="83" font-size="8" letter-spacing="2" opacity=".78" transform="rotate(.6 62 83)">WITH LOVE</text></g></g></svg>`;
}
