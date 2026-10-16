// Module worker for interior-sdf.js (grid evaluation + vertex refinement).
import { gridSlab, refineVerts } from './interior-sdf.js';

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.op === 'grid') {
      const vals = gridSlab(m);
      self.postMessage({ id: m.id, vals }, [vals.buffer]);
    } else if (m.op === 'refine') {
      const r = refineVerts(m);
      self.postMessage({ id: m.id, pos: r.pos, nrm: r.nrm, col: r.col }, [r.pos.buffer, r.nrm.buffer, r.col.buffer]);
    }
  } catch (err) {
    console.error('[interior-worker]', err && err.stack ? err.stack : err);
    self.postMessage({ id: m.id, error: String(err), vals: new Float32Array(0), pos: new Float32Array(0), nrm: new Float32Array(0), col: new Float32Array(0) });
  }
};
