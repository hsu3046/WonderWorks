// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {spawnSync} from 'node:child_process';
import {root,builds} from './link-tools.mjs';
function run(command,args){const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw Error(`${command} ${args.join(' ')} failed (${result.status})`);}
for(const name of builds.filter(name=>name!=='gallery'))run('npm',['run','build','--prefix',`projects/${name}`]);
run(process.execPath,['projects/gallery/scripts/prepare-works.mjs']);
run(process.execPath,['scripts/package-sources.mjs']);
run('npm',['run','build','--prefix','projects/gallery']);
run(process.execPath,['scripts/check-site.mjs']);
