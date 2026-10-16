// Deterministic build-time preview meshes; original generator retained. © 2026 AIB Inc.
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import {meshSDF,disposePool} from '../src/world/interior-sdf.js';
import {sdfKey,encodeSDF} from '../src/core/sdf-cache.js';
const jobs=[['buddha',null,[-1.16,-.04,-.62],[1.16,1.62,.76],.02,{aoDist:.08}],['buddha',null,[-.41,1.5,-.47],[.41,2.56,.43],.009,{aoDist:.04,newton:3}],['bodhi',null,[-.7,-.03,-.32],[.7,1.56,.4],.016,{aoDist:.05}]];
const dir=new URL('../public/generated/sdf/',import.meta.url);await mkdir(dir,{recursive:true});
try{for(const args of jobs){const g=await meshSDF(THREE,...args);const key=sdfKey(...args);await writeFile(new URL(`${key}.bin`,dir),Buffer.from(encodeSDF(g)));console.log('baked',key);g.dispose();}}finally{disposePool();}
