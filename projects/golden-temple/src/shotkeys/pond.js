// Shot overrides owned by the pond module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
//
// Shot 1 - looking down into a sunlit lotus in full bloom (0.62 m, 50 mm): crown
//          of golden stamens, seed pod, dew; the lens slides past it and glides
//          low through the bed toward the bridge (pagoda + hall reveal).
// Shot 8 - 13 cm above the water, facing the low sun: a floating lotus leaf
//          beaded with quicksilver drops, golden glitter bokeh behind and a koi
//          crossing; the camera skims over the pad, rises and swings 40 deg
//          right off the sun onto the mirror view of pagoda, bridge and hall.
// The pond module reads these keys (src/world/pond.js) to place the hero
// flower / pad exactly at the first key's focus point and to keep the camera
// path clear of stems and leaves.
export default {
  1: {
    name: 'Lotus - macro looking into a sunlit lotus in full bloom, sliding past it and gliding through the bed to the bridge',
    ease: 'reveal',
    keys: [
      { pos: [21.392, 0.152, 27.255], look: [20.98, -0.12, 26.88], focal: 50, focus: 0.62, fstop: 8 },
      { pos: [20.9, 0.25, 25.8], look: [12, 2.2, 12], focal: 36, focus: 3.5, fstop: 5.6 },
      { pos: [18.8, 0.32, 23.4], look: [5.5, 3.6, 7.5], focal: 26, focus: 13, fstop: 6.3 },
    ],
    near: 0.03,
    shadow: { center: [14, 1, 18], radius: 26 },
    post: { dof: true },
    pondHero: { kind: 'flower', size: 1.0, open: 0.9 },
  },
  8: {
    name: 'Mirror - facing the low sun over a beaded lotus pad, skimming over it and swinging up to the reflections of pagoda and bridge',
    ease: 'reveal',
    keys: [
      { pos: [30.2, -0.42, 27.2], look: [29.718, -0.507, 27.302], focal: 50, focus: 0.5, fstop: 11 },
      { pos: [29.55, -0.16, 26.9], look: [25.55, -0.3, 26.76], focal: 35, focus: 3.5, fstop: 8 },
      { pos: [29.0, 0.35, 26.35], look: [0.8, 1.85, 16.1], focal: 28, focus: 18, fstop: 8 },
      { pos: [28.6, 0.9, 25.8], look: [-30, 9.5, -6.5], focal: 24, focus: 40, fstop: 8 },
    ],
    near: 0.03,
    shadow: { center: [6, 0, 10], radius: 60 },
    post: { dof: true },
    pondHero: { kind: 'pad' },
  },
};
