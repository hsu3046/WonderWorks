// Shot overrides owned by the buildings module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
export default {
  // 4 Stone lantern: macro on the lit kumiko window of the west plaza kasuga lantern
  // (sun raking from the left), orbiting the fire box, then swinging out onto the
  // processional axis for the reveal of the hall between the lantern pairs.
  4: {
    ease: 'reveal',
    keys: [
      { pos: [5.36, 1.45, 3.08], look: [6.05, 1.7, 2.0], focal: 42, focus: 1.05, fstop: 3.5 },
      { pos: [6.5, 3.3, 3.95], look: [6.0, 2.3, 1.3], focal: 38, focus: 2.0, fstop: 5 },
      { pos: [8.6, 2.7, 5.3], look: [9.6, 4.6, -12], focal: 28, focus: 9, fstop: 5.6 },
      { pos: [10.0, 1.85, 5.6], look: [10, 6.4, -22], focal: 28, focus: 16, fstop: 5.6 },
    ],
    near: 0.03,
    shadow: { center: [9, 2.5, -4], radius: 22 },
    post: { dof: true },
  },
  // 7 South gate: macro on the chased kazari-kanagu sleeve of the south-east
  // centre pillar (raking low sun from the west), pulling back and sliding onto
  // the axis into the telephoto view of the hall through the gate passage.
  7: {
    ease: 'reveal',
    keys: [
      { pos: [11.75, 2.22, 49.12], look: [11.85, 2.18, 48.66], focal: 45, focus: 0.47, fstop: 8 },
      { pos: [11.86, 2.1, 50.05], look: [11.62, 2.14, 48.7], focal: 40, focus: 1.42, fstop: 8 },
      { pos: [11.5, 1.93, 51.45], look: [10.4, 2.65, 46.0], focal: 32, focus: 2.75, fstop: 6.3 },
      { pos: [10.4, 1.7, 55.5], look: [9.9, 8, -22], focal: 50, focus: 60, fstop: 5.6 },
    ],
    near: 0.03,
    shadow: { center: [10, 4, 30], radius: 40 },
    post: { dof: true },
  },
};
