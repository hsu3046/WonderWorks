// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {readdir,access} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {zipFiles} from './zip.mjs';
const root=resolve(import.meta.dirname,'..'),downloads=resolve(root,'projects/gallery/public/downloads');
const excluded=new Set(['node_modules','dist','.git','.vercel','.Codex','.codex','.DS_Store','Untitled.blend']);
export async function collect(directory){const files=[];for(const item of await readdir(directory,{withFileTypes:true})){if(excluded.has(item.name)||item.name.endsWith('.blend1')||item.name.startsWith('.env')&&item.name!=='.env.example')continue;const path=resolve(directory,item.name),rel=relative(root,path);if(['assets','docs/references','docs/reference','docs/validation','projects/gallery/public/experiments','projects/gallery/public/downloads'].some(prefix=>rel===prefix||rel.startsWith(prefix+'/')))continue;if(item.isDirectory())files.push(...await collect(path));else if(item.isFile())files.push(path);}return files.sort();}
for(const [folder,name] of [['shabon','bubble-day'],['fish','ocean-shoal'],['jelly','fruit-jelly'],['chroma','chroma-motion'],['harbor','tidelight-harbor'],['foliage','through-the-seasons'],['pond','stillwater'],['lightning','fulgur'],['crawler','webcrawler']]){
 const directory=resolve(root,'projects',folder),files=(await collect(directory)).map(path=>({path,name:`${name}/${relative(directory,path)}`}));
 for(const extra of ['LICENSE','SOURCE_NOTICE.md','projects/gallery/CREDITS.md'])files.push({path:resolve(root,extra),name:`${name}/${extra.split('/').at(-1)}`});
 const docs=resolve(root,'docs',folder==='fish'?'fish':folder);try{await access(docs);for(const path of await collect(docs))files.push({path,name:`${name}/docs/${relative(docs,path)}`});}catch(error){if(error.code!=='ENOENT')throw error;}
 // Only one license entry when the project already includes its own copy.
 const unique=new Map(files.map(item=>[item.name,item]));await zipFiles(resolve(downloads,`${name}-source.zip`),[...unique.values()]);
}
await zipFiles(resolve(downloads,'gallery-source.zip'),(await collect(root)).map(path=>({path,name:`wonderworks/${relative(root,path)}`})));
console.log('Generated nine standalone source archives and the full Wonderworks source archive.');
