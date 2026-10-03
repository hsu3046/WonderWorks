// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {LOCAL_MODELS,type LocalModel} from './local-scenery-layout';
export interface LocalAssets {models:Record<LocalModel,T.Group>;meadow:T.Texture;leafFloor:T.Texture;}
export type Assets = Awaited<ReturnType<typeof loadAssets>>;
export async function loadAssets(progress:(text:string)=>void,withScenery=false) {
  const manager=new T.LoadingManager();
  manager.onProgress=(_url,done,total)=>progress(`Gathering the forest · ${Math.round(done/total*100)}%`);
  const loader=new T.TextureLoader(manager), gltf=new GLTFLoader(manager);
  async function texture(name:string,color=false){
    const map=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/${name}.jpg`);
    if(color)map.colorSpace=T.SRGBColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;return map;
  }
  const illustration=async(name:string)=>{const map=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/illustrations/${name}.webp`);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;};
  async function localScenery():Promise<LocalAssets|undefined>{
    if(!withScenery)return undefined;
    const [models,meadow,leafFloor]=await Promise.all([
      Promise.all(LOCAL_MODELS.map(async name=>[name,(await gltf.loadAsync(`${import.meta.env.BASE_URL}assets/local/${name}.glb`)).scene] as const)),
      loader.loadAsync(`${import.meta.env.BASE_URL}assets/local/meadow.webp`),loader.loadAsync(`${import.meta.env.BASE_URL}assets/local/leaf-floor.webp`),
    ]);
    for(const map of [meadow,leafFloor]){map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4;}
    const entries=Object.fromEntries(models) as Record<LocalModel,T.Group>;
    for(const model of Object.values(entries))model.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value instanceof T.Texture)value.anisotropy=4;});
    return {models:entries,meadow,leafFloor};
  }
  const [bark,barkNormal,rock,rockNormal,ground,groundNormal,pine,pineAlpha,stone,stoneNormal,castle,castleNormal,sky,fern,rocks,tree,squirrel,panorama,oakSprite,oakFoliage,ocean,fallVeil,flowerTuft,flowerMeadow,local]=await Promise.all([
    texture('bark-color',true),texture('bark-normal'),texture('cliff-color',true),texture('cliff-normal'),
    texture('ground-color',true),texture('ground-normal'),texture('pine-color',true),texture('pine-alpha'),
    texture('stone-color',true),texture('stone-normal'),texture('castle-color',true),texture('castle-normal'),
    new HDRLoader(manager).loadAsync(`${import.meta.env.BASE_URL}assets/sky.hdr`),
    gltf.loadAsync(`${import.meta.env.BASE_URL}assets/fern_02/fern_02.gltf`),
    gltf.loadAsync(`${import.meta.env.BASE_URL}assets/rock_moss_set_01/rock_moss_set_01.gltf`),
    gltf.loadAsync(`${import.meta.env.BASE_URL}assets/island_tree_02/tree.gltf`),
    gltf.loadAsync(`${import.meta.env.BASE_URL}assets/squirrel-v3.glb`),
    illustration('alpine-coast-panorama-v2'),illustration('oak-impostor-v1'),illustration('oak-foliage-v1'),
    illustration('ocean-ripples-v1'),illustration('waterfall-veil-v1'),illustration('wildflower-tuft-v1'),illustration('wildflower-meadow-v1'),
    localScenery(),
  ]);
  sky.mapping=T.EquirectangularReflectionMapping;
  panorama.wrapS=T.RepeatWrapping;
  for(const map of [ocean,flowerMeadow]){map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;}
  return {bark,barkNormal,rock,rockNormal,ground,groundNormal,pine,pineAlpha,stone,stoneNormal,castle,castleNormal,sky,panorama,oakSprite,oakFoliage,ocean,fallVeil,flowerTuft,flowerMeadow,local,fern:fern.scene,rocks:rocks.scene,tree:tree.scene,squirrel:squirrel.scene};
}
