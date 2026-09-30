// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {projects} from '../projects/gallery/src/catalog.ts';
const root=resolve(import.meta.dirname,'../projects/gallery/dist'),html=await readFile(resolve(root,'index.html'),'utf8');
assert.equal((html.match(/<h1\b/g)||[]).length,1,'One primary heading');
assert.equal((html.match(/class="project-card /g)||[]).length,projects.length,'Catalog is present in initial HTML');
assert.ok(html.includes('application/ld+json'));JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
for(const path of ['/media/og-wonderworks-v2.jpg','/robots.txt','/sitemap.xml','/404.html',...projects.flatMap(p=>[p.image,p.source,...p.variants.flatMap(v=>[v.image,v.movie,v.path])])])await access(resolve(root,'.'+path));
for(const p of projects)for(const v of p.variants){const page=await readFile(resolve(root,'.'+v.path),'utf8');assert.ok(page.includes('rel="canonical"'),v.path);assert.ok(page.includes('og:image'),v.path);}
const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');assert.equal((sitemap.match(/<url>/g)||[]).length,1+projects.reduce((n,p)=>n+p.variants.length,0));
if(process.env.VERCEL||process.env.PUBLIC_SITE_URL){assert.ok(!sitemap.includes('127.0.0.1'),'Production canonical must be public');assert.ok(!sitemap.includes('localhost'));}
console.log(`Static SEO and asset checks passed: ${projects.length} studies, ${1+projects.reduce((n,p)=>n+p.variants.length,0)} canonical pages.`);
