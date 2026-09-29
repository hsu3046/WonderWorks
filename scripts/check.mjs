// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {root,builds} from './link-tools.mjs';
for(const name of builds){const result=spawnSync(`${root}projects/fish/node_modules/.bin/tsc`,['--noEmit','-p',`projects/${name}/tsconfig.json`],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
const result=spawnSync(process.execPath,['--test',...readdirSync(`${root}projects/pond/tests`).filter(f=>f.endsWith('.test.ts')).map(f=>`projects/pond/tests/${f}`)],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
