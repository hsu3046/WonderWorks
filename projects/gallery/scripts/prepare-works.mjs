// SPDX-License-Identifier: GPL-3.0-only
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../..',import.meta.url));
const output=path.join(root,'gallery/public/experiments');
await mkdir(output,{recursive:true});
for(const [source,destination] of [['shabon','shabon'],['jelly','jelly'],['fish/dist','ocean'],['chroma/dist','chroma'],['harbor/dist','harbor'],['foliage/dist','foliage'],['pond/dist','pond'],['lightning/dist','lightning']]){
  await cp(path.join(root,source),path.join(output,destination),{recursive:true,filter:p=>!p.includes('node_modules')&&!p.endsWith('.DS_Store')});
}
const ocean=path.join(output,'ocean/index.html');
await writeFile(ocean,(await readFile(ocean,'utf8')).replaceAll('"/assets/','"./assets/'));
// Share the already-installed Three.js distribution; keep standalone artwork sources intact.
const vendor=path.join(output,'vendor');await mkdir(vendor,{recursive:true});
for(const file of ['three.module.js','three.core.js']) await cp(path.join(root,'fish/node_modules/three/build',file),path.join(vendor,file));
await cp(path.join(root,'fish/node_modules/three/examples/jsm'),path.join(vendor,'addons'),{recursive:true});
await cp(path.join(root,'fish/node_modules/three/LICENSE'),path.join(vendor,'LICENSE'));
const shabon=path.join(output,'shabon/index.html');
await writeFile(shabon,(await readFile(shabon,'utf8')).replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js','../vendor/three.module.js').replaceAll('https://cdn.jsdelivr.net/npm/three@0.186.0/examples/jsm/','../vendor/addons/'));
// Apply adapters to copied sources only; fail loudly if an upstream anchor changes.
async function patch(relative, before, after) {
 const file=path.join(output,relative),source=await readFile(file,'utf8');
 if(source.split(before).length!==2)throw new Error(`Preview patch anchor changed: ${relative}`);
 await writeFile(file,source.replace(before,()=>after));
}
await cp(new URL('./preview-runtime.js',import.meta.url),path.join(output,'preview-runtime.js'));
await patch('shabon/src/main.js',
 "const dprEff = () => (CAPTURE ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));",
 "const dprEff = () => (params.has('preview') ? Math.min(2, Math.sqrt(1600000 / (innerWidth * innerHeight))) : CAPTURE ? 1 : Math.min(window.devicePixelRatio || 1, 1.25));\n  if (params.has('preview')) { q.scale = 1; q.auto = false; }");
await patch('shabon/src/main.js', 'else frame();', `else frame();
  if (params.has('preview')) {
    setMuted(true); director.click();
    window.dispatchEvent(new CustomEvent('wonderworks:register', {detail: {
      canvas, ready: () => app.frames > 12 && loadingEl.hidden && director.state === 'ride' && director.t > 1, frames: () => app.frames, draw: render,
      setActive(active) {
        app.setActive(active);
      }
    }}));
  }`);
for(const kind of ['citrus','melon']) {
 const file=`jelly/${kind}/demo.js`;
 const ratio=kind==='citrus'?'Math.min(devicePixelRatio,1.6)':'Math.min(devicePixelRatio,1.5)';
 await patch(file,`renderer.setPixelRatio(${ratio})`,`renderer.setPixelRatio(new URLSearchParams(location.search).has('preview') ? Math.min(2,Math.sqrt(1600000/(innerWidth*innerHeight))) : ${ratio})`);
 await patch(file,'\n status.hidden=true;',`\n if (new URLSearchParams(location.search).has('preview')) window.dispatchEvent(new CustomEvent('wonderworks:register', {detail: {
   canvas, ready: () => frameCount > 2, frames: () => frameCount,
   draw: () => renderer.render(scene,camera),
   setActive: active => window.daniJelly.setActive(active),
   nudge: () => document.querySelector('#nudge').click()
  }}));
  status.hidden=true;`);
}
for(const rel of ['shabon/index.html','ocean/index.html','jelly/citrus/index.html','jelly/melon/index.html']){
 const file=path.join(output,rel),prefix=rel.startsWith('jelly/')?'../../':'../';
 await writeFile(file,(await readFile(file,'utf8')).replace('</head>',`<script src="${prefix}preview-runtime.js"></script></head>`));
}
console.log('Prepared projects with frozen-frame preview adapters.');
