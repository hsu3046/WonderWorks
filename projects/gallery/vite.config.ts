// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {defineConfig} from 'vite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {projects} from './src/catalog.ts';
import {renderCards,renderIndex,renderCredits,escapeHTML} from './src/render.ts';

const origin=(process.env.PUBLIC_SITE_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`:'http://127.0.0.1:4175')).replace(/\/$/,'');
const canonical=(path:string)=>new URL(path,origin).href;
const title='Wonderworks — An Open Library of Interactive Worlds';
const description='Inspired by remarkable creations on X. A free, open-source library of interactive worlds and creative web experiments. Explore, learn, remix, and build your own.';
function meta(pageTitle:string,summary:string,url:string,image:string){return `<meta name="description" content="${escapeHTML(summary)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:site_name" content="Wonderworks"><meta property="og:locale" content="en_US"><meta property="og:title" content="${escapeHTML(pageTitle)}"><meta property="og:description" content="${escapeHTML(summary)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${canonical(image)}"><meta property="og:image:alt" content="${escapeHTML(pageTitle)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHTML(pageTitle)}"><meta name="twitter:description" content="${escapeHTML(summary)}"><meta name="twitter:image" content="${canonical(image)}">`;}
function inject(html:string,pageTitle:string,summary:string,url:string,image:string){return html.replace(/<title>[\s\S]*?<\/title>/i,()=>`<title>${escapeHTML(pageTitle)}</title>`).replace(/<meta\s+name=["']description["'][^>]*>/gi,'').replace('</head>',()=>meta(pageTitle,summary,url,image)+'</head>');}
export default defineConfig({plugins:[{
 name:'wonderworks-static-seo',
 transformIndexHtml(html){
  const graph={'@context':'https://schema.org','@graph':[
   {'@type':'Organization','@id':'https://www.aib.vote/#organization',name:'AIB Inc.',url:'https://www.aib.vote'},
   {'@type':'WebSite','@id':canonical('/#website'),url:canonical('/'),name:'Wonderworks',publisher:{'@id':'https://www.aib.vote/#organization'}},
   {'@type':'CollectionPage','@id':canonical('/#collection'),url:canonical('/'),name:title,description,inLanguage:'en',isPartOf:{'@id':canonical('/#website')},mainEntity:{'@type':'ItemList',itemListElement:projects.map((p,i)=>({'@type':'ListItem',position:i+1,url:canonical(p.variants[0]!.path),name:p.title}))}}
  ]};
  return inject(html,title,description,canonical('/'),'/media/og-wonderworks-v2.jpg')
   .replace('<div id="projects" class="project-grid"></div>',()=>`<div id="projects" class="project-grid">${renderCards(projects)}</div>`)
   .replace('<div class="hero-bottom" id="project-index" role="group" aria-label="Experiment index"></div>',()=>`<div class="hero-bottom" id="project-index" role="group" aria-label="Experiment index">${renderIndex(projects)}</div>`)
   .replace('<dl id="project-credits" class="project-credits" aria-label="Project inspirations and original code credits"></dl>',()=>`<dl id="project-credits" class="project-credits" aria-label="Project inspirations and original code credits">${renderCredits(projects)}</dl>`)
   .replace('</head>',()=>`<script type="application/ld+json">${JSON.stringify(graph).replaceAll('<','\\u003c')}</script></head>`);
 },
 closeBundle(){
  const directory=resolve('dist'),urls=[canonical('/')];
  for(const project of projects)for(const variant of project.variants){
   const file=resolve(directory,'.'+variant.path);if(!existsSync(file))throw Error(`Missing published experiment: ${variant.path}. Run npm run build from the repository root first.`);
   const url=canonical(variant.path),pageTitle=`${variant.name} — ${project.category.toLowerCase()} | Wonderworks`;
   const summary=project.description.length>165?project.description.slice(0,162).replace(/\s+\S*$/,'')+'…':project.description;
   writeFileSync(file,inject(readFileSync(file,'utf8'),pageTitle,summary,url,variant.image));urls.push(url);
  }
  writeFileSync(resolve(directory,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>`<url><loc>${escapeHTML(url)}</loc></url>`).join('')}</urlset>\n`);
  writeFileSync(resolve(directory,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${canonical('/sitemap.xml')}\n`);
  writeFileSync(resolve(directory,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Page not found — Wonderworks</title><style>body{background:#111215;color:#f2f0ea;font:18px system-ui;padding:10vh 8vw}a{color:#ff976f}</style><h1>This world is still undiscovered.</h1><p>The page you requested could not be found.</p><a href="/">Return to Wonderworks →</a></html>`);
 }
}]});
