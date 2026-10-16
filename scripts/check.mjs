// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {root,builds} from './link-tools.mjs';
for(const name of builds.filter(name=>name!=='golden-temple')){const result=spawnSync(`${root}projects/fish/node_modules/.bin/tsc`,['--noEmit','-p',`projects/${name}/tsconfig.json`],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
const result=spawnSync(process.execPath,['--test',...['pond','lightning','skyglider'].flatMap(name=>readdirSync(`${root}projects/${name}/tests`).filter(f=>f.endsWith('.test.ts')).map(f=>`projects/${name}/tests/${f}`))],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
const crawler=spawnSync(process.execPath,['--test',...readdirSync(`${root}projects/crawler/tests`).filter(f=>f.endsWith('.test.mjs')).map(f=>`projects/crawler/tests/${f}`)],{cwd:root,stdio:'inherit'});if(crawler.status!==0)process.exit(crawler.status||1);

const foil=spawnSync('npm',['run','test','--prefix','projects/foil'],{cwd:root,stdio:'inherit'});if(foil.status!==0)process.exit(foil.status||1);

const bloom=spawnSync('npm',['run','test','--prefix','projects/bloom'],{cwd:root,stdio:'inherit'});if(bloom.status!==0)process.exit(bloom.status||1);

const prism=spawnSync('npm',['run','test','--prefix','projects/prism'],{cwd:root,stdio:'inherit'});if(prism.status!==0)process.exit(prism.status||1);

const dearly=spawnSync('npm',['run','test','--prefix','projects/dearly'],{cwd:root,stdio:'inherit'});if(dearly.status!==0)process.exit(dearly.status||1);

const cassette=spawnSync('npm',['run','test','--prefix','projects/cassette'],{cwd:root,stdio:'inherit'});if(cassette.status!==0)process.exit(cassette.status||1);

const temple=spawnSync('npm',['test','--prefix','projects/golden-temple'],{cwd:root,stdio:'inherit'});if(temple.status!==0)process.exit(temple.status||1);
