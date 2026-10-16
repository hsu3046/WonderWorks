// Optional diagnostic only. © 2026 AIB Inc. GPL-3.0-only.
export function createMetrics(renderer, query) {
  if (!query.has('bench')) return null;
  const gl = renderer.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [], samples = [], gpu = [];
  let active = null, start = 0, last = 0, frame = 0, done = false;
  const quantile = (a, q) => [...a].sort((x,y)=>x-y)[Math.min(a.length-1, Math.floor(a.length*q))] ?? null;
  renderer.info.autoReset = false;
  return {
    get done() { return done; },
    begin() {
      const now = performance.now();
      if (ext && gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        pending.splice(0).forEach(q=>gl.deleteQuery(q)); gpu.length=0;
      }
      while(pending.length && gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)) {
        const q=pending.shift(); gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6); gl.deleteQuery(q);
      }
      renderer.info.reset();
      start=now;
      if(ext && pending.length<3) { active=gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT,active); }
    },
    end() {
      if(active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(active); active=null; }
      const now=performance.now();
      if(frame++>=8) samples.push({cpu:now-start,interval:start-last,calls:renderer.info.render.calls,tris:renderer.info.render.triangles});
      last=start;
      if(samples.length<32) return;
      done=true;
      const result={query:location.search,scene:window.__info,frames:samples.length,cpuP50:quantile(samples.map(s=>s.cpu),.5),cpuP95:quantile(samples.map(s=>s.cpu),.95),intervalP50:quantile(samples.map(s=>s.interval),.5),intervalP95:quantile(samples.map(s=>s.interval),.95),gpuP50:quantile(gpu,.5),gpuSamples:gpu.length,callsP50:quantile(samples.map(s=>s.calls),.5),trianglesP50:quantile(samples.map(s=>s.tris),.5)};
      window.__benchmark=result;
      const el=document.createElement('pre'); el.id='benchmark'; el.style.cssText='position:fixed;top:0;right:0;background:#000d;color:#fff;font:11px monospace;max-width:50vw;white-space:pre-wrap';el.textContent=JSON.stringify(result,null,2);document.body.appendChild(el);
      console.log('[benchmark]',JSON.stringify(result));
      pending.splice(0).forEach(q=>gl.deleteQuery(q));
    },
  };
}
