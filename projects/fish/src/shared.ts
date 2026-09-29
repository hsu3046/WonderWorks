// SPDX-License-Identifier: GPL-3.0-only — Copyright 2026 KnowAI
import { Vector3, Vector4 } from 'three/webgpu';
import { uniform } from 'three/tsl';

export const FISH_COUNT = 6144;
export function createUniforms() {
  return {
    time: uniform(0), dt: uniform(0), speed: uniform(2), rays: uniform(1.6),
    caustics: uniform(1.35), fog: uniform(0.032),
    eye: uniform(new Vector3()), rayOrigin: uniform(new Vector3()),
    rayDirection: uniform(new Vector3(0, 0, -1)), pointerPower: uniform(0),
    shocks: Array.from({ length: 4 }, () => uniform(new Vector4(0, 7, 0, -100))),
  };
}
export type OceanUniforms = ReturnType<typeof createUniforms>;

// Deterministic geometry makes later visual comparisons repeatable.
export function randomGenerator(seed = 72926): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Required page element is missing: ${selector}`);
  return found;
}
