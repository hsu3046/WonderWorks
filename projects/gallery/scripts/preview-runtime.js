// SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
// Loaded only in gallery copies. Each renderer owns its pause/resume implementation.
(() => {
  if (!new URLSearchParams(location.search).has('preview')) return;
  const style = document.createElement('style');
  style.textContent = 'body{margin:0!important}#hud,#settings,.title,.hint,.snd,.menu-btn,header,.controls,.readout,#technical{display:none!important}#lab{min-height:0!important;height:100vh!important}';
  document.head.append(style);
  let adapter, announced = false, ready = false, playing = false, desired = false, timer = 0, nudge = 0, generation = 0, resizeFrame = 0;
  const send = data => parent.postMessage(data, location.origin);
  Object.defineProperty(window,'__wonderworksPreview',{configurable:true,get:()=>({ready,playing,frames:adapter?.frames(),width:adapter?.canvas.width,height:adapter?.canvas.height})});
  const capture = type => {
    const version = ++generation;
    try {
      // Draw and read in the same task, without preserveDrawingBuffer's persistent cost.
      adapter.draw();
      adapter.canvas.toBlob(blob => {
        if (version === generation) { send({type:announced?type:'wonderworks:ready', blob, width: adapter.canvas.width, height: adapter.canvas.height, frame: adapter.frames()}); announced=true; }
      }, 'image/webp', .95);
    } catch (error) {
      console.warn('Preview snapshot unavailable', error);
      send({type, blob: null, frame: adapter.frames()});
    }
  };
  function setPlaying(value) {
    desired = value;
    if (!ready) return;
    playing = value && !document.hidden;
    clearInterval(nudge);
    adapter.setActive(playing);
    if (playing) {
      generation++;
      adapter.nudge?.();
      if (adapter.nudge) nudge = setInterval(() => adapter.nudge(), 2800);
      send({type: 'wonderworks:playing'});
    } else capture('wonderworks:frame');
  }
  addEventListener('wonderworks:register', event => {
    if (adapter) return;
    adapter = event.detail;
    const started = performance.now();
    timer = setInterval(() => {
      if (adapter.ready()) {
        clearInterval(timer); ready = true;
        adapter.setActive(false);
        capture('wonderworks:ready');
      } else if (performance.now() - started > 35000) {
        clearInterval(timer); adapter.setActive(false); send({type:'wonderworks:error'});
      }
    }, 100);
  });
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent) return;
    if (event.data?.type === 'wonderworks:play') setPlaying(true);
    if (event.data?.type === 'wonderworks:pause') setPlaying(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (!ready) return;
    const resume = desired;
    setPlaying(!document.hidden && resume);
    desired = resume;
  });
  addEventListener('resize', () => {
    if (!ready || playing) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => capture('wonderworks:frame'));
  });
  addEventListener('pagehide', () => {
    clearInterval(timer); clearInterval(nudge); cancelAnimationFrame(resizeFrame);
    generation++; adapter?.setActive(false);
  });
})();
