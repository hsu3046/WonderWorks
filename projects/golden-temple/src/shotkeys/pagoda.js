// Shot overrides owned by the pagoda module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
//
// Shot 3: macro on the bronze wind bell under the first-storey SW hip rafter
// (gilt hanger, engraved hip-rafter sleeve, gold rafter caps, corner bracket cascade), then a
// pull-back that cranes down and away to the south while tilting up all five storeys to the
// spire, framed by the maple (left) and the pine (right).
export default {
  3: {
    ease: 'reveal',
    keys: [
      { pos: [-41.17, 4.5, 0.76], look: [-39.45, 5.17, -0.58], focal: 40, focus: 2.15, fstop: 4 },
      { pos: [-42.0, 3.7, 2.3], look: [-38.8, 6.8, -1.4], focal: 30, focus: 4.0, fstop: 4.5 },
      { pos: [-42.6, 2.4, 5.6], look: [-35.5, 11.0, -5.5], focal: 22, focus: 9, fstop: 6 },
      { pos: [-42.5, 1.3, 9.5], look: [-32.5, 15.6, -8.0], focal: 16.5, focus: 20, fstop: 8 },
    ],
    near: 0.04,
    shadow: { center: [-34, 9, -5], radius: 21 },
    post: { dof: true },
  },
};
