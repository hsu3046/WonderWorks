// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import {access,symlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const builds=['fish','chroma','harbor','foliage','pond','lightning','crawler','skyglider','gallery'];
await access(`${root}projects/fish/node_modules/three/package.json`);
for(const name of builds.filter(name=>name!=='fish')){
 const destination=`${root}projects/${name}/node_modules`;
 try{await access(destination);}catch{await symlink('../fish/node_modules',destination,'dir');}
}
