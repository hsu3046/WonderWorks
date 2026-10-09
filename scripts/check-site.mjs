// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {projects} from '../projects/gallery/src/catalog.ts';
const root=resolve(import.meta.dirname,'../projects/gallery/dist'),html=await readFile(resolve(root,'index.html'),'utf8');
// These public studies live on different branches; neither may disappear in an integration build.
for(const id of ['lightning','crawler','skyglider','foil'])assert.ok(projects.some(project=>project.id===id),`Published study ${id} must remain in the collection`);
assert.equal(new Set(projects.map(project=>project.number)).size,projects.length,'Study numbers are unique');
assert.equal((html.match(/<h1\b/g)||[]).length,1,'One primary heading');
assert.equal((html.match(/class="project-card /g)||[]).length,projects.length,'Catalog is present in initial HTML');
assert.equal((html.match(/class="quick-work"/g)||[]).length,projects.length,'Every study is in the top index');
assert.ok(!html.includes('<dialog'),'Collection uses direct navigation and inline information');
assert.ok(!html.includes('data-open='),'Experience links are not intercepted by a detail dialog');
assert.equal((html.match(/class="project-specs"/g)||[]).length,projects.length,'Each card includes its experience details');
assert.equal((html.match(/class="project-actions"/g)||[]).length,projects.length,'Each card includes open and download actions');
for(const link of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)){
 const experience=/data-work=/.test(link[1]);
 if(experience)assert.ok(/target="_blank"/.test(link[1])&&/rel="noopener noreferrer"/.test(link[1]),'Experience links open safely in a new tab');
 // Compact card creator names and the footer copyright intentionally omit the icon.
 const cardCreator=projects.some(p=>p.attribution?.url===link[1].match(/href="([^"]+)"/)?.[1])&&!link[2].includes('<svg');
 const footerCopyright=/class="credit-link"/.test(link[1]);
 if(!experience&&!cardCreator&&!footerCopyright&&(/href="https?:\/\//.test(link[1])||/target="_blank"/.test(link[1])))assert.ok(link[2].includes('#icon-link-simple'),'Other external links use Phosphor link-simple');
}
assert.ok(!html.includes('class="open-disc"'),'Artwork navigation has no overlay arrow button');
const credits=html.match(/<dl id="project-credits"[^>]*>([\s\S]*?)<\/dl>/)?.[1]||'';
assert.equal((credits.match(/#icon-link-simple/g)||[]).length,projects.filter(p=>p.attribution).length,'Detailed creator credits retain external-link icons');
for(const project of projects)assert.ok(html.includes(`href="${project.source}" download`),`${project.title} source download is on the main page`);
for(const project of projects)assert.ok(html.includes(`id="project-${project.id}"`),`${project.title} is in the collection`);
assert.ok(html.includes('application/ld+json'));JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
for(const path of ['/media/og-wonderworks-v2.jpg','/robots.txt','/sitemap.xml','/404.html',...projects.flatMap(p=>[p.image,p.source,...p.variants.flatMap(v=>[v.image,v.movie,v.path])])])await access(resolve(root,'.'+path));
for(const p of projects)for(const v of p.variants){const page=await readFile(resolve(root,'.'+v.path),'utf8');assert.ok(page.includes('rel="canonical"'),v.path);assert.ok(page.includes('og:image'),v.path);}
const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');assert.equal((sitemap.match(/<url>/g)||[]).length,1+projects.reduce((n,p)=>n+p.variants.length,0));
if(process.env.VERCEL||process.env.PUBLIC_SITE_URL){assert.ok(!sitemap.includes('127.0.0.1'),'Production canonical must be public');assert.ok(!sitemap.includes('localhost'));}
console.log(`Static SEO and asset checks passed: ${projects.length} studies, ${1+projects.reduce((n,p)=>n+p.variants.length,0)} canonical pages.`);
