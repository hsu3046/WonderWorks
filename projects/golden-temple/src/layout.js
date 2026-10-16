// ---------------------------------------------------------------------------
// SITE PLAN — the single source of truth for where everything is.
// Units: metres. +X = east, +Z = south, +Y = up (north is -Z).
// Courtyard ground level y = 0. The sun is low in the WEST-SOUTH-WEST
// (direction toward sun ~ (-0.94, 0.12, 0.34)), so west faces glow and long
// shadows fall toward the east-north-east.
//
//              N (-Z)
//   z=-48  ┌──────────── north corridor ─────────────┐
//          │        ┌─────────────────┐               │
//          │  ▲     │   MAIN HALL     │      bell     │
//          │ pagoda │  (faces south)  │      tower    │
//   z=-9   │(-32,-8)└──────┬┬┬────────┘               │
//          │   plaza  (stone lanterns, gravel)  east  │
//   z=6    │  ~~~~~~~~~~~~ pond ~~~~~~~~~~~~ pavilion │
//          │  ~~~~ lotus ~~~ bridge ~~~ lotus ~(46,18)│
//   z=34   │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        │
//          │        garden                            │
//   z=46   └────────────── gate (10,46) ──────────────┘
//      x=-52                 x=10                   x=66
// ---------------------------------------------------------------------------

export const L = {
  groundY: 0,

  // Main hall (hondō): two-tier irimoya roof, karahafu porch over the stairs.
  hall: {
    center: [10, 0, -22],
    facing: [0, 0, 1],            // faces south
    platform: { w: 36, d: 27, h: 1.6 }, // granite podium (kidan); top at y = 1.6
    columns: { w: 26, d: 17, bays: [7, 5], height: 6.4 }, // outer column grid on the podium
    stairs: { width: 10, frontZ: -8.5 }, // main stair descends south to z ~ -8.5 + run
    mokoshiEaveY: 8.4,            // lower skirt roof eave height
    mainEaveY: 13.8,              // upper roof eave height
    ridgeY: 21.5,                 // main ridge top
    eaveOverhang: 3.6,
  },

  // Five-storey pagoda (gojū-no-tō)
  pagoda: {
    center: [-32, 0, -8],
    platform: { w: 13, d: 13, h: 1.2 },
    baseWidth: 7.6,               // column grid width of the 1st storey
    storyHeight: 3.9,
    shrink: 0.92,                 // each storey's width multiplier
    eaveOverhang: 3.0,
    stories: 5,
    spireHeight: 10.5,            // sōrin (9 gold rings + suien + hōju)
    totalHeight: 37,
  },

  // Pond: water surface and outline (clockwise polygon in x,z). Shore is stone.
  pond: {
    waterY: -0.55,
    bottomY: -1.7,
    outline: [
      [-23, 7], [-14, 5.5], [-4, 6.5], [4, 7.5], [16, 7.5], [26, 6], [36, 7.5], [43, 11], [45, 18],
      [43, 26], [36, 31], [26, 33.5], [14, 34], [2, 33], [-8, 34.5], [-18, 32], [-25, 26], [-27, 17], [-26, 11],
    ],
    island: [[-6, 18], [-1, 16.5], [3, 19], [1, 23], [-5, 23]], // small rocky island with a pine
  },

  // Arched vermilion bridge (taiko-bashi) on the hall axis, crossing the pond south->north
  bridge: {
    south: [10, 0, 27],
    north: [10, 0, 5],
    width: 3.6,
    rise: 2.6,          // deck crown above ground level
    posts: 9,           // railing posts per side (gold giboshi finials)
  },

  // Stone-paved processional path (gate -> bridge -> plaza -> hall stairs)
  paths: [
    { from: [10, 46], to: [10, 27], width: 4.0 },
    { from: [10, 5], to: [10, -8.5], width: 5.0 },
    { from: [10, -2], to: [-24, -6], width: 3.0 },   // branch to the pagoda
    { from: [10, -2], to: [44, 10], width: 2.6 },    // branch to the pavilion
  ],

  // Gravel plaza between hall and pond
  plaza: { minX: -22, maxX: 44, minZ: -9, maxZ: 6 },

  // Viewing pavilion on the east shore, open on the west side, veranda over water
  pavilion: {
    center: [47, 0, 18],
    facing: [-1, 0, 0],   // opens toward the pond / pagoda / sunset
    w: 10, d: 8, floorY: 1.1, eaveY: 4.6,
  },

  // Enclosing roofed corridor (kairō) and the south gate (chūmon)
  corridor: {
    rect: { minX: -52, maxX: 66, minZ: -48, maxZ: 46 },
    width: 4.6, height: 3.4, bay: 3.6,
  },
  gate: { center: [10, 0, 46], facing: [0, 0, 1], w: 12, d: 7, height: 11 },
  bellTower: { center: [44, 0, -30], w: 6, d: 6 },
  sideHalls: [
    { center: [-40, 0, -36], w: 14, d: 9, facing: [1, 0, 0] },  // west sub-hall
    { center: [52, 0, -6], w: 12, d: 8, facing: [-1, 0, 0] },   // east sub-hall
  ],

  // Stone lanterns (kasuga-dōrō) — [x, z, height]
  stoneLanterns: [
    [6, -4, 2.6], [14, -4, 2.6], [6, 2, 2.6], [14, 2, 2.6],       // flanking the plaza axis
    [5.5, 30, 2.4], [14.5, 30, 2.4],                               // south bridge head
    [-25, -1, 2.3], [-25, -15, 2.3], [-39, -1, 2.3],               // around the pagoda
    [39, 9, 2.0], [41, 27, 2.1], [-20, 30, 2.0], [28, 4.5, 1.9],   // pond shore
    [-12, 4.2, 1.9], [24, 35.5, 2.0], [-4, 35, 1.8],
  ],

  // Hero trees — type: pine | maple | mapleRed | cherry ; [x, z, height]
  trees: [
    { type: 'pine', at: [-18, 3], h: 7.5 }, { type: 'pine', at: [30, 4], h: 6.5 },
    { type: 'pine', at: [-2, 20], h: 5.5 }, // island
    { type: 'pine', at: [40, 32], h: 7 }, { type: 'pine', at: [-23, 33], h: 6.5 },
    { type: 'pine', at: [-44, 10], h: 11 }, { type: 'pine', at: [-46, -20], h: 12 },
    { type: 'mapleRed', at: [24, -6], h: 6 }, { type: 'mapleRed', at: [-6, -6], h: 5.5 },
    { type: 'mapleRed', at: [36, 34], h: 5 }, { type: 'mapleRed', at: [-14, 36], h: 5.5 },
    { type: 'maple', at: [52, 26], h: 10 },   // big green maple overhanging the pavilion
    { type: 'maple', at: [-20, -22], h: 9 }, { type: 'maple', at: [58, -38], h: 10 },
    { type: 'cherry', at: [32, -16], h: 7 }, { type: 'cherry', at: [-10, -18], h: 7 },
    { type: 'cherry', at: [-46, 30], h: 8 }, { type: 'cherry', at: [58, 38], h: 7.5 },
  ],

  // Distant landscape
  mountains: { westRidgeDist: 900, ringRadius: 1400 },
};

export default L;
