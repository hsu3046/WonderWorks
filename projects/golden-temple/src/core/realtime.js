// Realtime policy; offline rendering never opts in. © 2026 AIB Inc. GPL-3.0-only.
export function realtimeOptions(query, mode, quality) {
  const enabled = mode === 'dev' && quality === 'preview' && query.get('opt') !== '0';
  return { enabled, sky: enabled && query.get('skycache') !== '0', lod: enabled && query.get('lod') !== '0',
    reflectionMs: enabled ? 1000/20 : 0, shadowMs: enabled ? 1000/20 : 0 };
}

// Camera movement invalidates immediately. Animated content still refreshes at a bounded rate.
export class RenderGate {
  constructor(intervalMs) { this.intervalMs=intervalMs; this.last=-Infinity; this.key=null; this.time=null; }
  needs(now, time, key) {
    if (this.key !== key || (time !== this.time && now-this.last>=this.intervalMs)) {
      this.last=now; this.time=time; this.key=key; return true;
    }
    return false;
  }
  invalidate() { this.key=null; this.last=-Infinity; }
}

export function postPlan(bloom, clarity) {
  return { down: bloom > 0 ? 7 : clarity !== 0 ? 4 : 0, up: bloom > 0, local: clarity !== 0 };
}

// Hysteresis and a cooldown prevent resize oscillation. Manual detail mode bypasses this.
export class ResolutionBudget {
  constructor(scale=1){this.scale=scale;this.average=33;this.samples=0;this.changedAt=0;}
  observe(ms,now){
    if(!Number.isFinite(ms)||ms<=0||ms>500)return this.scale;
    this.average=this.average*.9+ms*.1;this.samples++;
    if(this.samples<45||now-this.changedAt<4000)return this.scale;
    const next=this.average>42?Math.max(.65,this.scale-.1):this.average<25?Math.min(1,this.scale+.05):this.scale;
    if(next!==this.scale){this.scale=Math.round(next*100)/100;this.changedAt=now;this.samples=0;}
    return this.scale;
  }
}
