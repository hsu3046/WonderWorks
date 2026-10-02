# Fulgur — final performance verification

2026-10-03, approved visual treatment retained.

## Changes

- The channel fragment shader stops at the actual stroke count. Failed branches
  evaluate only their first return stroke instead of multiplying later envelopes
  by zero. Active envelopes retain their accumulation order and exposure integral.
- The 300 ms UI readout uses a small timing summary over at most three bolts.
  Full geometry diagnostics, segment filtering and copied source/contact arrays
  are now requested only by the development diagnostic hook.
- No resolution, density, topology, material, timing, bloom or sample-budget changes.
  There are no new dependencies.

## Visual and lifecycle checks

The same paused, seeded triple discharge (seeds 1236/1237/1238, Branching 100%,
3,138 segments) was rendered before and after optimization. Both screenshots
were 711 × 612 with a 1067 × 918 drawing buffer and cloud target. All 435,132
displayed pixels matched exactly. This checks that scene, not every possible
animation frame; shader logic retains the same nonzero terms for other frames.

Pause kept the drawn frame count at 4,411 for an 800 ms observation with no pending
animation frame. Resume, Natural/Fast, live Branching updates and the paused status
label worked. No browser warnings, errors or shader failures were observed.

## Frame pacing

Local Codex in-app browser on this Mac; 711 × 612 CSS pixels, 1067 × 918 render
and cloud targets. Each window is approximately eight seconds. FPS comes from
actual scene draw counters; frame intervals come from an independent RAF observer.

| Run | Draws | FPS | Median / p95 | Maximum interval |
| --- | ---: | ---: | --- | ---: |
| Before, Fast, Branching 68% | 481 | 60.01 | 16.7 / 17.5 ms | 17.8 ms |
| After, Natural, first observation | 465 | 58.04 | 16.7 / 18.2 ms | 216.3 ms |
| After, Natural, repeat | 481 | 60.04 | 16.7 / 18.0 ms | 18.7 ms |
| After, Fast, Branching 68% | 481 | 60.03 | 16.7 / 18.5 ms | 18.8 ms |
| After, Fast, Branching 100% | 481 | 60.05 | 16.7 / 17.6 ms | 18.7 ms |

The initial Natural observation contained a one-off long frame. It did not recur
in the follow-up observation; its cause was not isolated. These short, vsync-limited
measurements establish local frame pacing, not a GPU-time percentage improvement,
an absence of all cold-start stalls, or a mobile-device performance guarantee.
The existing 1.5-million-pixel cap, fixed geometry/light budgets, shared cloud/bloom
passes and hidden/paused rendering suspension remain in place.

Validation evidence is local-only in ignored `docs/validation/lightning`:
`final-baseline-performance.json`, `final-performance.json`, and
`final-visual-{before,after}.png`. Standalone strict production build and 14 lightning
tests passed. Repository-wide type checks and 31 tests passed in the worktree;
the integration checkout additionally contains the existing Stillwater GPU repair.
