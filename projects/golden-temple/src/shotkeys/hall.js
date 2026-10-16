// Shot overrides owned by the hall module agent.
// export default { <shotIndex>: { keys: [...], ease, shadow, post, near, noShadow, ... } }
// Fields given here REPLACE the base definition in src/shots.js for that shot.
export default {
  // 5 Eave corner: sunlit macro under the south-west corner of the mokoshi roof
  // (gilt hip-rafter cap + wind bell, onigawara with moulded clouds, tomoe tile
  // ends, double rafters with kibana caps, painted bracket rows), held, then a
  // rising crane that pulls back over the corner (clear of the red maple at
  // [-6,-6] and the cherry at [-10,-18]) into a high three-quarter view of the
  // whole two-tier hall: west front + south front + karahafu.
  5: {
    ease: 'reveal',
    keys: [
      { pos: [-10.2, 7.4, -7.2], look: [-7.5, 8.7, -9.0], focal: 42, focus: 3.3, fstop: 3.5 },
      { pos: [-11.6, 8.1, -6.1], look: [-6.4, 9.4, -11.2], focal: 32, focus: 6, fstop: 4.5 },
      { pos: [-14.6, 10.4, -3.0], look: [0.5, 9.4, -18.5], focal: 26, focus: 14, fstop: 7 },
      { pos: [-17.5, 12.5, -0.5], look: [5.5, 9.0, -22], focal: 24, focus: 28, fstop: 8 },
    ],
    near: 0.05,
    shadow: { center: [6, 8, -20], radius: 25 },
    post: { dof: true },
  },
};
