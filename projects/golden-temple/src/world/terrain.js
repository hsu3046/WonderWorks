// ---------------------------------------------------------------------------
// TERRAIN — courtyard ground (raked gravel, moss, pond bed), stone paving,
// landscape (forest floor, wooded hills, valley, mountain ridges), backdrop
// forest and ground cover. Everything procedural.
// ---------------------------------------------------------------------------
import { createField } from './terrain-field.js';
import { buildGround } from './terrain-ground.js';
import { buildLand } from './terrain-land.js';
import { buildForest } from './terrain-forest.js';
import { buildPaving } from './terrain-paving.js';
import { buildCover } from './terrain-cover.js';

export async function build(ctx) {
  const { THREE } = ctx;
  const t0 = performance.now();
  const F = createField(ctx.L);
  const tField = performance.now() - t0;
  const group = new THREE.Group();
  group.name = 'terrain';
  const timings = { field: Math.round(tField) };

  const step = async (name, fn) => {
    const t = performance.now();
    try {
      const o = await fn();
      if (o) group.add(o.isObject3D ? o : o.mesh || o.object);
      timings[name] = Math.round(performance.now() - t);
      return o;
    } catch (e) {
      console.error(`[terrain] ${name} FAILED:`, e && e.stack ? e.stack : e);
      return null;
    }
  };

  await step('ground', () => buildGround(ctx, F));
  await step('land', () => buildLand(ctx, F));
  const paving = await step('paving', () => buildPaving(ctx, F));
  const cover = await step('cover', () => buildCover(ctx, F, (paving && paving.userData.stones) || []));
  const forest = await step('forest', () => buildForest(ctx, F));
  console.log('[world] terrain timings ' + JSON.stringify(timings) + ' forest ' + JSON.stringify(forest && forest.userData.stats) + ' stones ' + (paving && paving.userData.count) + ' cover ' + JSON.stringify(cover && cover.userData.stats));

  return {
    object: group,
    heightAt: F.heightAt,
    field: F,
    showcase: [
      { cam: [10, 1.7, 6.5], look: [10, 0.6, -8], focal: 28 },
      { cam: [70, 26, 62], look: [-20, 10, -6], focal: 26 },
    ],
  };
}
