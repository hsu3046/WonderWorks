# Fulgur

A small storm, held in wonder. An original interactive lightning study.
**Inspired by [Jason Key (@key_vfx)](https://x.com/key_vfx)**, credited by the
project owner for the supplied `qnjYPMOpyE0aMMfz.mp4` reference recording.

## Run

From the Wonderworks repository, run `npm run setup` once if dependencies are
missing, then `npm --prefix projects/lightning run dev`. Open localhost:4180.
For a production build use `npm --prefix projects/lightning run build`.
`npm --prefix projects/lightning run test` checks channel continuity and limits.

This package can also be copied out and used independently with `npm install`
and `npm run dev`. WebGL 2 is required. The HDR path falls back to an 8-bit target
when floating-point color buffers are unavailable.

## Explore

- Drag to orbit; scroll or pinch to zoom.
- Click the floor or dome to direct a strike; **Enter** summons a new one.
- Adjust cloud body, branching and drift. Branching updates the current strike
  immediately: 0% gives a bare trunk; higher values add longer, denser forks.
  Switch the ground between dome and plane.
- **Space** pauses/resumes. While paused, summon holds a new discharge at its peak.
- Save a PNG or opt into synthesized thunder. Audio starts muted.
- Reduced-motion preference starts paused. Hidden tabs stop rendering.

The cloud uses a ray-marched procedural density field; it is **not a fluid or
voxel physics solver**. Lightning channels use bounded seeded branching and
approximate leader/return-stroke envelopes. The source video, its UI and assets
are not redistributed. Typography uses DM Sans and Instrument Serif from Google Fonts, with
local system fallbacks when offline.

Code: GNU GPL v3. © 2026 **AIB Inc.** — https://www.aib.vote

### Lightning realism

Natural playback uses a short stepped leader, an upward connection and irregular
return strokes along the same channel. Isolated flashes and short bursts mix with
occasional 7–12-stroke chains spanning 0.65–1.30 seconds. Failed branches fade after
the first return. **Natural** plays at normal speed; **Fast** advances the storm
at 2× speed. Occasional pairs and triples form at different cloud locations,
with independent channels and metal contacts. Automatic strikes wait until every
active chain finishes; a direct surface click still selects a single contact. Cloud light is distributed
along the discharge, with a brief soft glow inside nearby billows. The cloud
slowly drifts and changes shape; new strikes choose different interior regions
while avoiding the previous two origins. Existing return chains stay fixed.
Frame exposure preserves short flashes at lower frame rates.

Research, attribution and the distinction between a visual model and a full
electrical solver: [realism notes](../../docs/lightning/REALISM_RESEARCH.md).
