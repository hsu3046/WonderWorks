// Shot overrides owned by the bridge module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
//
// Shot 2 - hero giboshi: the gilt-bronze finial on the WEST railing, post k = 4
// (src/world/bridge.js: x = 8.305, post top y = 3.625, z = 13.749; finial base y = 3.641,
// bulb centre y ~3.83, point y ~3.99). The lens hangs over the water 0.8 m from it, the
// low sun rakes the gilt from the left, the sunlit lacquer post and rail run away behind
// it and the hall glows soft in the background. The camera then cranes up over the rail,
// swings onto the bridge axis above the crown and pushes toward the hall.
export default {
  2: {
    name: 'Giboshi - gilt finial macro on the west railing, craning over the rail onto the bridge axis and pushing to the hall',
    ease: 'reveal',
    keys: [
      { pos: [8.01, 3.89, 14.55], look: [8.2, 3.835, 13.749], focal: 40, focus: 0.79, fstop: 4 },
      { pos: [8.3, 4.4, 15.04], look: [8.31, 3.9, 13.749], focal: 36, focus: 1.4, fstop: 4 },
      { pos: [9.0, 6.0, 16.9], look: [10, 5.0, -14], focal: 24, focus: 25, fstop: 5.6 },
      { pos: [10.0, 5.25, 15.0], look: [10, 5.0, -14], focal: 20, focus: 28, fstop: 6.3 },
    ],
    near: 0.04,
    shadow: { center: [10, 3, 1], radius: 27 },
    post: { dof: true },
  },
};
