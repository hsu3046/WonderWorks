// SPDX-License-Identifier: GPL-3.0-only
// Native uses the same simulation and materials; only its shell and lifecycle differ.
export const nativeMode = new URLSearchParams(location.search).get('native') === '1';
export const nativeActive = () => !nativeMode || window.__daniActive !== false;
if (nativeMode) document.documentElement.dataset.native = 'true';

export function connectNative({suspend, wake, command}) {
  if (!nativeMode) return;
  window.daniJelly = {
    setActive(active) {
      window.__daniActive = active === true;
      if (active) wake(); else suspend();
    },
    command(action) { if (nativeActive()) command(action); }
  };
  if (!nativeActive()) suspend();
  window.webkit?.messageHandlers?.jelly?.postMessage({type:'ready'});
}
