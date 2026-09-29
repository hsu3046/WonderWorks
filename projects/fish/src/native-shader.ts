// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import type { Node } from 'three/webgpu';
import type { CodeNodeInclude } from 'three/src/nodes/code/CodeNode.js';
import { wgslFn } from 'three/tsl';

type NativeShader<T extends 'float'|'vec3'> = ((args:Record<string,Node|number>)=>Node<T>) & CodeNodeInclude;
/** r186 returns a callable node proxy; its public types omit both build() and the WGSL return type. */
export function nativeShader<T extends 'float'|'vec3'>(code:string,includes:CodeNodeInclude[]=[]):NativeShader<T>{
  return wgslFn(code,includes) as unknown as NativeShader<T>;
}
