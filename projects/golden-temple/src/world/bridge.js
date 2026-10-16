// ---------------------------------------------------------------------------
// BRIDGE — arched vermilion taiko-bashi across the pond on the hall axis.
//
// Structure (all in world coordinates, axis x = L.bridge.x, running N-S):
//   * deck: a circular arc (crown = L.bridge.rise above ground), individual
//     weathered planks with gaps, nail heads and a worn walking line
//   * side fascia "arch boards": thick vermilion curved girders whose intrados
//     deepens toward the banks so the arch springs out of granite abutments,
//     with a dark capping band on top and ornate gilt kazari-kanagu plates
//   * koran railings: vermilion posts (gold sleeve + detailed lathe giboshi on
//     every post), oval top rail swept up past the end posts with gilt end caps, flat mid rail with nail
//     heads, base sill, plumb struts; larger end posts on granite bases
//   * substructure: inner girders, floor beams, two bents of stacked granite
//     piers on stepped footings with a vermilion cap beam (gilt end caps)
//   * coursed granite abutments + landing slabs adapted to the real shoreline
//     (queried from the pond module when present)
// Materials are bridge-specific variants of the shared procedural library.
// Vertex colours carry per-piece data (grain mode, grime, random tint).
// ---------------------------------------------------------------------------

export async function build(ctx) {
  const { THREE, L, geom, mat } = ctx;
  const { Builder, mat4 } = geom;
  const RBox = geom.RoundedBoxGeometry;
  const rnd = ctx.rng('bridge');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const f6 = (x) => Number(x).toFixed(6);

  // ---------------------------------------------------------------- layout
  const BR = Object.assign({ south: [10, 0, 27], north: [10, 0, 5], width: 3.6, rise: 2.6, posts: 9 }, L.bridge || {});
  const Y0 = L.groundY || 0;
  const X0 = (BR.north[0] + BR.south[0]) / 2;
  const zA = Math.min(BR.north[2], BR.south[2]), zB = Math.max(BR.north[2], BR.south[2]);
  const ZC = (zA + zB) / 2, HALF = (zB - zA) / 2, RISE = BR.rise;
  const RA = (HALF * HALF + RISE * RISE) / (2 * RISE); // deck-surface arc radius
  const YC = Y0 + RISE - RA;                           // arc centre height
  const WATER = (L.pond && L.pond.waterY != null) ? L.pond.waterY : -0.55;
  const BOTTOM = (L.pond && L.pond.bottomY != null) ? L.pond.bottomY : -1.7;
  const HW = BR.width / 2;

  const LAND_TOP = Y0 + 0.06;                                   // landing slab top
  const thE = Math.acos((RA - RISE + (LAND_TOP - Y0)) / RA);    // deck end angle (deck meets slab)
  const zEndN = ZC - RA * Math.sin(thE), zEndS = ZC + RA * Math.sin(thE);

  const yAt = (z, off = 0) => YC + Math.sqrt(Math.max((RA + off) ** 2 - (z - ZC) ** 2, 0));
  const thAtZ = (z, off = 0) => Math.asin(clamp((z - ZC) / (RA + off), -1, 1));
  const ptTh = (th, off = 0, x = X0) => new THREE.Vector3(x, YC + (RA + off) * Math.cos(th), ZC + (RA + off) * Math.sin(th));

  // cross-section (u = x offset from axis, v = radial offset from the deck surface)
  const XR = HW - 0.105;                       // railing centre line
  const BAND = { u0: HW - 0.25, u1: HW + 0.03, v0: -0.13, v1: 0.0 };
  const FT = -0.12;                            // fascia top (radial)
  const SILL = { w: 0.13, v0: -0.005, v1: 0.10 };
  const MID = { w: 0.066, v0: 0.535, v1: 0.665 };
  const TOP = { a: 0.052, b: 0.060, v: 0.925 };
  const PW = 0.16, EPW = 0.22;                 // post widths
  const GIRDER_X = [-0.82, 0, 0.82];
  const GIRDER_BOT = -0.74;
  // giboshi lathe landmarks (local metres): chased band A, stud band B, bulb start/height/radius, incised rings
  const GIB = { bandA: [0.0384, 0.0583], bandB: [0.0795, 0.0935], bulb0: 0.1255, H: 0.205, Rm: 0.086, tEnd: 0.93 };
  GIB.rings = [GIB.bulb0 + GIB.H * 0.255, GIB.bulb0 + GIB.H * 0.285, GIB.bulb0 + GIB.H * 0.8];

  // ---------------------------------------------------------------- shoreline (adapt abutments to the pond)
  const pondSite = ctx.modules && ctx.modules.pond && ctx.modules.pond.site;
  function inWater(x, z) {
    if (pondSite && pondSite.sdExact) { try { return pondSite.sdExact(x, z) > 0; } catch (e) { /* fall through */ } }
    const poly = L.pond && L.pond.outline;
    if (!poly) return Math.abs(z - ZC) < HALF - 1.5;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
    }
    // pond module builds a land jetty to the south bridge end
    if (inside && z > BR.south[2] - 0.6 && Math.abs(x - BR.south[0]) < Math.max(HW + 1.6, 3.2)) inside = false;
    return inside;
  }
  function shoreFrom(zEnd, dir) {
    for (let i = 0; i <= 400; i++) {
      const z = zEnd + dir * i * 0.025;
      if (inWater(X0, z) && inWater(X0 - HW, z) && inWater(X0 + HW, z)) return z;
      if (dir * (z - ZC) > 0) break;
    }
    return zEnd + dir * 1.5;
  }
  const shoreN = shoreFrom(zEndN, +1), shoreS = shoreFrom(zEndS, -1);
  // abutment faces stand a little into the water; keep the bridge symmetric
  const faceDist = Math.max(clamp(shoreN + 0.35 - zEndN, 0.9, 3.2), clamp(zEndS - (shoreS - 0.35), 0.9, 3.2));
  const faceN = zEndN + faceDist, faceS = zEndS - faceDist;
  const ABUT_TOP = Y0 - 0.16;
  const SPRING_Y = ABUT_TOP - 0.10; // intrados meets the abutment face just below its top

  // fascia depth below FT as a function of z (deepens to spring from the abutments)
  const D0 = 0.62;
  const needN = (yAt(faceN) + FT) - SPRING_Y - D0;
  const needS = (yAt(faceS) + FT) - SPRING_Y - D0;
  function fasciaDepth(z) {
    let d = D0;
    const tn = (z - faceN), ts = (faceS - z);
    // inside the span: smooth ramp over the last ~4 m before each face
    const wn = Math.pow(sm(4.2, -0.2, tn), 2.0), ws = Math.pow(sm(4.2, -0.2, ts), 2.0);
    d += Math.max(needN, 0) * wn + Math.max(needS, 0) * ws;
    // inside the abutments: keep going down
    if (tn < 0) d += -tn * 0.8;
    if (ts < 0) d += -ts * 0.8;
    return d;
  }

  // ---------------------------------------------------------------- materials
  const ARC_GLSL = `
#define ARC_ZC ${f6(ZC)}
#define ARC_YC ${f6(YC)}
#define ARC_R ${f6(RA)}
#define BR_X0 ${f6(X0)}
#define WATER_Y ${f6(WATER)}
`;
  // analytic occlusion of the indirect light under the deck (the sky IBL would otherwise light the soffit)
  const AO_GLSL = /* glsl */ `
    {
      vec2 relA = vec2(vWPos.z - ARC_ZC, vWPos.y - ARC_YC);
      float depthA = ARC_R - length(relA);
      float insideA = 1.0 - smoothstep(${f6(HW - 0.35)}, ${f6(HW + 0.06)}, abs(vWPos.x - BR_X0));
      float underA = smoothstep(0.0, 0.14, depthA) * insideA;
      vec3 wnA = normalize(vWNrm);
      float aoA = mix(1.0, 0.4, underA);
      aoA *= mix(1.0, 0.5, smoothstep(0.1, 0.9, -wnA.y) * smoothstep(-0.3, 0.05, depthA));
      reflectedLight.indirectDiffuse *= aoA;
      reflectedLight.indirectSpecular *= mix(1.0, aoA, 0.85);
      // light bounced off the pond: (a) skylight / glare reflected up onto soffits and
      // low faces, (b) the low sun's glint off the rippled surface -> drifting caustic bands
      vec3 Ls = normalize(uSunDir);
      float hB = vWPos.y - WATER_Y;
      vec3 nB = normalize((vec4(geometryNormal, 0.0) * viewMatrix).xyz);
      // toward-the-light vector of the water-reflected sun (down and toward the sun; ripples spread it upward)
      vec3 bDir = normalize(vec3(Ls.x, -Ls.y - 0.22, Ls.z));
      float ndB = max(dot(nB, bDir), 0.0);
      float downB = clamp(-nB.y, 0.0, 1.0);
      float nearW = (1.0 - smoothstep(0.8, 3.6, hB)) * smoothstep(-0.02, 0.06, hB);
      vec2 rp = vWPos.xz + (Ls.xz / max(Ls.y + 0.22, 0.05)) * max(hB, 0.0);
      float wM = smoothstep(-25.0, -21.0, rp.x) * (1.0 - smoothstep(40.0, 43.0, rp.x)) * smoothstep(7.0, 9.0, rp.y) * (1.0 - smoothstep(31.0, 33.0, rp.y));
      vec2 cq = rp * vec2(0.62, 1.0);
      float c1 = clamp(1.0 - abs(n_snoise3(vec3(cq + vec2(uTime * 0.3, 0.0), uTime * 0.4))), 0.0, 1.0);
      float c2 = clamp(1.0 - abs(n_snoise3(vec3(cq * 1.7 + 7.0 - vec2(0.0, uTime * 0.25), uTime * 0.5 + 3.0))), 0.0, 1.0);
      float sharpC = mix(1.0, 0.5, smoothstep(0.4, 2.8, hB)); // caustics soften with distance from the water
      float caus = pow(c1, 14.0 * sharpC) * 1.2 + pow(c2, 16.0 * sharpC) * 0.7;
      // the dancing light only reads in shade (direct sun swamps it); lotus pads cut the reflecting area
      float shf = clamp(dot(directLight.color, vec3(1.0)) / max(dot(uSunColor, vec3(1.0)), 1e-4), 0.0, 1.0);
      caus *= mix(1.0, 0.25, shf);
      float downW = (1.0 - smoothstep(2.6, 5.0, hB)) * smoothstep(-0.02, 0.06, hB);
      vec3 bounce = uSunColor * wM * (nearW * ndB * (0.02 + 0.1 * caus) + downW * downB * (0.05 + 0.06 * caus * nearW));
      reflectedLight.indirectDiffuse += material.diffuseColor * RECIPROCAL_PI * bounce;
    }
  `;
  // vermilion lacquer over timber. vColor: r = grain mode (0 arc / .5 vertical / 1 along x), g = grime, b = piece random
  const lac = mat.phys({ color: 0xffffff, roughness: 0.52, metalness: 0, clearcoat: 0.09, clearcoatRoughness: 0.45, vertexColors: true }, {
    fragHead: ARC_GLSL + 'float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        // g carries grime + 2 * kind (kind 1 = railing members, 0 = fascia / substructure)
        float kindR = step(1.5, vColor.g);
        float mode = vColor.r; float dirt = vColor.g - 2.0 * kindR; float pr = vColor.b;
        vec2 rel = vec2(wp.z - ARC_ZC, wp.y - ARC_YC);
        // local grain frame: x = along the member, y/z = across (metres, small local values)
        vec3 gp;
        float xr = wp.x - BR_X0;
        float xl = xr - floor(xr / 0.845 + 0.5) * 0.845; // member-centred across coordinate
        if (mode < 0.25) gp = vec3(atan(rel.x, rel.y) * ARC_R, (length(rel) - ARC_R) + 0.43, xl);
        else if (mode < 0.75) gp = vec3(wp.y, xl, (wp.z - ARC_ZC) * 0.35);
        else gp = vec3(xr, wp.y - 1.4, wp.z - ARC_ZC);
        float big = n_fbm3(wp * 0.35 + pr * 3.0, 3);
        float pxL = length(fwidth(wp));                         // pixel footprint (m): fades sub-pixel detail
        float aaF = 1.0 - smoothstep(0.003, 0.009, pxL);
        // flat-sawn growth rings: distance to a slowly wandering virtual log axis -> cathedral figure
        float logD = abs(gp.z) + (0.06 + 0.3 * pr) + 0.42 * (1.0 - kindR) + 0.06 * sin(gp.x * (1.1 + 1.2 * pr) + pr * 17.0) + 0.04 * n_snoise(vec2(gp.x * 0.9, pr * 9.0));
        float logA = gp.y + (pr - 0.5) * 0.35 + 0.03 * n_snoise(vec2(gp.x * 1.7, pr * 4.0 + 2.0));
        float rr0 = length(vec2(logA, logD));
        float rr2 = rr0 * (55.0 + 25.0 * pr) + 1.6 * n_snoise(vec2(rr0 * 9.0, pr * 31.0)) + 0.3 * n_snoise3(gp * vec3(0.6, 14.0, 14.0));
        float rf = fract(rr2);
        float fw = fwidth(rr2);
        float lw = 0.62 + 0.25 * n_snoise(vec2(floor(rr2) * 0.37, pr * 7.0));
        float lines = smoothstep(lw, lw + 0.2, rf) * (1.0 - smoothstep(0.9, 1.0, rf)) * (0.55 + 0.45 * n_snoise(vec2(floor(rr2) * 0.71, gp.x * 0.8)));
        lines = mix(lines, 0.3, smoothstep(0.25, 0.7, fw));
        float gw = n_snoise3(gp * vec3(0.15, 2.5, 2.5) + pr * 7.0);
        float gl = n_fbm3((gp + pr * 13.0) * vec3(0.22, 15.0, 15.0) + vec3(0.0, gw * 0.7, gw * 0.7), 3);
        float fine = n_snoise3((gp + pr * 5.0) * vec3(1.4, 70.0, 70.0)) * aaF;
        // fine dark checks (drying cracks) along the grain
        float chk = smoothstep(0.84, 0.97, abs(n_snoise3((gp + pr * 3.0) * vec3(0.5, 38.0, 38.0) + 3.0))) * (1.0 - smoothstep(0.004, 0.012, pxL));
        // railings: sun-faded shu (orange vermilion); fascia + substructure: deeper oxblood bengara over visible grain
        vec3 baseR = vec3(0.400, 0.140, 0.095);
        vec3 baseS = vec3(0.150, 0.058, 0.050);
        vec3 base = mix(baseS, baseR, kindR) * (0.86 + 0.16 * (pr - 0.5) + 0.18 * big);
        vec3 col = base * (1.0 - mix(0.12, 0.30, kindR) * lines - 0.12 * smoothstep(0.0, 0.4, gl) - 0.05 * fine - 0.35 * chk);
        // structure: thin paint worn off the raised latewood -> paler salmon streaks of the figure
        float figF = (1.0 - kindR) * (1.0 - smoothstep(0.3, 0.75, fw));
        col = mix(col, base * vec3(1.6, 2.1, 2.05), figF * lines * 0.36);
        col = mix(col, base * vec3(1.4, 1.75, 1.75), figF * smoothstep(0.0, 0.5, gl) * 0.3);
        // fascia boards: horizontal seam between the two stacked arch boards + butt joints
        if (kindR < 0.5 && mode < 0.25) {
          float dR = ARC_R - length(rel);
          float faceS = smoothstep(0.8, 0.97, abs(wn.x));
          float seam = 1.0 - smoothstep(0.0, 0.006 + fwidth(dR), abs(dR - 0.47));
          float sA = atan(rel.x, rel.y) * ARC_R;
          float bj = 1.0 - smoothstep(0.0, 0.005 + fwidth(sA), abs(fract(sA / 3.65 + 0.5) - 0.5) * 3.65);
          col *= 1.0 - faceS * 0.6 * max(seam, bj * step(0.12, dR));
        }
        // sun-faded tops (slightly paler, more orange)
        float up = smoothstep(0.35, 0.95, wn.y);
        float underF = smoothstep(0.0, 0.14, ARC_R - length(rel)) * (1.0 - smoothstep(${f6(HW - 0.35)}, ${f6(HW + 0.06)}, abs(wp.x - BR_X0)));
        float fade = clamp(up * (0.5 + 0.5 * n_fbm3(wp * 2.2, 3)), 0.0, 1.0) * (1.0 - underF);
        col = mix(col, base * vec3(1.18, 1.45, 1.3), fade * 0.22);
        // rain streaks on vertical faces
        float vert = 1.0 - abs(wn.y);
        float streak = n_fbm3(vec3((wp.x + wp.z) * 4.0, wp.y * 0.4, pr * 7.0), 3);
        col *= 1.0 - vert * smoothstep(0.0, 0.5, streak) * 0.16;
        // grime (undersides / substructure)
        col = mix(col, col * vec3(0.36, 0.31, 0.30), clamp(dirt * (0.75 + 0.35 * big), 0.0, 1.0));
        // dark run-off stains below the capping band on the fascia faces + mottling
        float depthR = ARC_R - length(rel);
        float faceX = smoothstep(0.7, 0.95, abs(wn.x));
        float belowB = depthR - 0.12;
        float sN = n_fbm3(vec3(atan(rel.x, rel.y) * ARC_R * 2.6, depthR * 0.5, wp.x * 0.5 + pr), 3);
        float stain = faceX * step(0.0, belowB) * (1.0 - smoothstep(0.02, 0.5 + 0.25 * sN, belowB)) * smoothstep(-0.1, 0.45, sN);
        col *= 1.0 - mix(0.24, 0.38, kindR) * stain;
        float mott = n_fbm3(wp * vec3(1.1, 2.2, 1.1) + 17.0, 3);
        col *= mix(0.94, 0.9, kindR) + mix(0.12, 0.2, kindR) * mott;
        // damp near the water
        float damp = 1.0 - smoothstep(WATER_Y + 0.05, WATER_Y + 1.1, wp.y);
        col = mix(col, col * vec3(0.45, 0.45, 0.42), damp * 0.75);
        // worn lacquer revealing dark timber
        float wear = smoothstep(0.68, 0.84, n_fbm3(wp * 3.1 + pr * 9.0, 3) * 0.5 + 0.5);
        col = mix(col, vec3(0.075, 0.032, 0.018), wear * mix(0.28, 0.5, kindR));
        // chipped arrises: on the rounded edges (high normal curvature) the shu coat has flaked off to the
        // black undercoat and, in places, the grey timber; only resolved up close
        float curvL = length(fwidth(wn)) / max(pxL, 1e-5);
        float edgeN = n_fbm3(wp * 19.0 + pr * 4.0, 2) * 0.5 + 0.5;
        float edgeW = smoothstep(16.0, 42.0, curvL) * smoothstep(0.42, 0.66, edgeN) * (1.0 - smoothstep(0.0025, 0.007, pxL)) * kindR;
        col = mix(col, mix(vec3(0.028, 0.018, 0.014), vec3(0.16, 0.12, 0.09), smoothstep(0.62, 0.8, edgeN)), edgeW * 0.85);
        // hand-worn top rail: polished through to the black undercoat in long streaks along the rail
        float topRail = kindR * (1.0 - step(0.25, mode)) * (1.0 - step(0.02, dirt));
        float sAr = atan(rel.x, rel.y) * ARC_R;
        float handN = n_fbm3(vec3(sAr * 1.6, wp.x * 9.0, pr * 5.0), 3) * 0.5 + 0.5;
        float hand = topRail * smoothstep(0.45, 0.9, wn.y) * smoothstep(0.5, 0.72, handN + 0.18 * (1.0 - smoothstep(0.0, 4.0, abs(rel.x))));
        col = mix(col, mix(vec3(0.05, 0.022, 0.016), base * 0.55, 0.35), hand * 0.75);
        diffuseColor.rgb = diffuse * col;
        g_h = gl * 0.15 - lines * 0.18 + fine * 0.04 + wear * 0.3 - chk * 0.25 - edgeW * 0.4 - hand * 0.15;
        g_r = fade * 0.2 + dirt * 0.22 + wear * 0.3 + lines * 0.1 + chk * 0.2 - damp * 0.1 + kindR * 0.1 + edgeW * 0.25 - hand * 0.22;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.14, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0022);
      { vec3 dn = fwidth(normal); roughnessFactor = max(roughnessFactor, clamp(length(dn) * 0.6, 0.0, 0.35)); }`,
    // the golden-hour sky fills real shade more than the captured IBL does: lift the lacquer's
    // indirect light so vermilion stays readable on the backlit (east) side
    fragLight: AO_GLSL + 'reflectedLight.indirectDiffuse *= 1.45;',
  });
  lac.name = 'bridgeLacquer';

  // weathered deck timber. vColor: r = plank random, g = plank wear, b = unused
  let PLANK_S0 = 0, PLANK_PITCH = 0.245;
  const plankUniforms = { uPlank: { value: new THREE.Vector2(0, 0.245) } };
  const wood = mat.std({ color: 0xffffff, roughness: 0.78, metalness: 0, vertexColors: true }, {
    uniforms: plankUniforms,
    fragHead: ARC_GLSL + 'uniform vec2 uPlank; float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos; vec3 wn = normalize(vWNrm);
        float pr = vColor.r; float wk = vColor.g;
        vec2 rel = vec2(wp.z - ARC_ZC, wp.y - ARC_YC);
        float rr = length(rel);
        float s = atan(rel.x, rel.y) * ARC_R;
        vec3 radial = vec3(0.0, rel.y, rel.x) / rr;
        float topF = smoothstep(0.6, 0.95, dot(wn, radial));
        // plank-local coordinates: pid (index), lu (-0.5..0.5 across the plank), x along the plank
        float u0 = (s - uPlank.x) / uPlank.y;
        float pid = floor(u0); float lu = u0 - pid - 0.5;
        float pidH = pid + vColor.b * 57.0;
        float ph = n_hash11(pidH * 1.37 + 0.5), ph2 = n_hash11(pidH * 2.91 + 3.1), ph3 = n_hash11(pidH * 5.17 + 7.3);
        float lx = wp.x - BR_X0;
        // knot (some planks): grain flows around it
        vec2 kc = vec2((ph2 - 0.5) * 2.4, (ph3 - 0.5) * 0.5);
        vec2 kd = vec2((lx - kc.x) / 0.05, (lu - kc.y) * uPlank.y / 0.028);
        float kr = length(kd);
        float hasKnot = step(0.55, ph3);
        float knotWarp = hasKnot * 1.6 * exp(-kr * kr * 0.18) * sign(lu - kc.y + 1e-4);
        // straight growth rings along x with slow wander
        float wander = n_snoise(vec2(lx * 0.32, pidH * 3.1)) * 0.7 + n_snoise(vec2(lx * 1.4, pidH * 7.7)) * 0.18;
        float gc = lu * (5.0 + ph * 5.0) + wander * 1.4 + knotWarp + ph * 10.0 + 0.35 * n_snoise(vec2(lx * 0.7 + ph * 9.0, lu * 3.0));
        float ring = fract(gc);
        float late = smoothstep(0.5, 0.8, ring) * (1.0 - smoothstep(0.86, 0.99, ring));
        float pxD = length(fwidth(wp));
        float fine = n_fbm(vec2(lx * 1.2 + ph * 20.0, lu * 34.0 + ph * 50.0), 2) * (1.0 - smoothstep(0.002, 0.006, pxD));
        float fwG = fwidth(gc);
        late *= 1.0 - smoothstep(0.3, 0.8, fwG);
        float big = n_fbm3(wp * 0.7 + ph * 5.0, 3);
        vec3 warm = mix(vec3(0.185, 0.122, 0.078), vec3(0.130, 0.088, 0.058), ph2);
        vec3 silver = vec3(0.225, 0.208, 0.186);
        float grey = clamp(0.35 + 0.4 * ph + 0.25 * big + 0.2 * wk - 0.25 * hasKnot * 0.0, 0.0, 0.9);
        vec3 col = mix(warm, silver, grey);
        float ptone = n_hash11(pidH * 9.7 + 1.3);
        col *= 0.7 + 0.55 * ptone;
        // a few replaced boards (younger, warmer timber), lengthwise sun-bleaching, old water stains
        float repl = step(0.88, n_hash11(pidH * 6.1 + 2.0));
        col = mix(col, vec3(0.29, 0.18, 0.105) * (0.88 + 0.24 * ph), repl * 0.55);
        float bleach = smoothstep(0.1, 0.7, n_fbm(vec2(lx * 0.45 + ph * 7.0, lu * 2.5 + pidH * 0.37), 2));
        col = mix(col, col * vec3(1.18, 1.15, 1.12), 0.3 * bleach * (1.0 - repl));
        float wstain = smoothstep(0.58, 0.86, n_fbm3(wp * vec3(1.3, 1.0, 2.6) + 9.0, 3) * 0.5 + 0.5);
        col *= 1.0 - 0.28 * wstain;
        col = mix(col, col * vec3(1.12, 0.92, 0.8), smoothstep(0.75, 0.95, n_hash11(pidH * 4.3 + 8.0)) * 0.6);
        col *= 1.0 - 0.2 * late;
        col *= 1.0 - 0.07 * fine;
        // knots
        col = mix(col, col * vec3(0.35, 0.28, 0.24), hasKnot * (1.0 - smoothstep(0.6, 1.0, kr)));
        col *= 1.0 - hasKnot * 0.25 * (1.0 - smoothstep(1.0, 1.8, kr)) * smoothstep(0.6, 1.0, kr);
        // drying checks: thin dark cracks along the grain
        float ck = abs(n_snoise(vec2(lx * 0.9 + ph * 13.0, lu * 26.0)));
        float ckw = fwidth(ck);
        float chk = (1.0 - smoothstep(0.0, 0.035 + ckw * 1.5, ck)) * smoothstep(0.1, 0.5, n_snoise(vec2(lx * 0.6, pidH * 1.7)) + 0.3) * (1.0 - smoothstep(0.03, 0.12, ckw));
        col *= 1.0 - 0.6 * chk * topF;
        // weathering creeps in from the gaps: darker, rounded plank edges
        col *= 1.0 - 0.38 * smoothstep(0.38, 0.5, abs(lu)) * (0.6 + 0.4 * big);
        // dirt packed into the joints: a crisp dark line at each plank edge (keeps the board rhythm when blurred)
        float jl = smoothstep(0.455 - fwidth(lu) * 1.5, 0.5, abs(lu));
        col = mix(col, vec3(0.022, 0.018, 0.014), jl * 0.75 * topF);
        float rings = late;
        float g = gc;
        // worn walking line (lighter, smoother) in the middle
        float ax = abs(wp.x - BR_X0);
        float path = (1.0 - smoothstep(0.35, 1.05, ax)) * topF;
        col = mix(col, col * vec3(1.22, 1.15, 1.06), path * 0.55);
        // grime + moss toward the railings and in the gaps
        float edge = smoothstep(1.05, 1.5, ax);
        float mn = n_fbm3(wp * 5.0, 3) * 0.5 + 0.5;
        col = mix(col, col * 0.55, edge * 0.55);
        col = mix(col, vec3(0.045, 0.062, 0.02), edge * smoothstep(0.52, 0.78, mn) * 0.55 * topF);
        // plank edges / end grain darker
        col *= 1.0 - (1.0 - topF) * 0.45;
        col *= 1.0 - smoothstep(0.6, 0.9, abs(wn.x)) * 0.8;  // end grain at the butt joints: dark, dirty
        // nail heads: two rows per plank over each girder
        float dxn = mod(wp.x - BR_X0 + 0.41, 0.82) - 0.41;
        float dn = length(vec2(dxn, (abs(lu) - 0.27) * uPlank.y));
        float nailOk = (1.0 - step(1.25, ax)) * topF;
        float nail = (1.0 - smoothstep(0.0055, 0.0085, dn)) * nailOk * (1.0 - smoothstep(0.004, 0.01, pxD));
        float rust = (1.0 - smoothstep(0.008, 0.03, dn)) * nailOk;
        col = mix(col, col * vec3(0.55, 0.38, 0.28), rust * 0.6);
        col = mix(col, vec3(0.03, 0.026, 0.024), nail);
        diffuseColor.rgb = diffuse * col;
        g_h = -late * 0.12 + fine * 0.05 - nail * 0.4 - chk * 0.12 - hasKnot * (1.0 - smoothstep(0.6, 1.0, kr)) * 0.3;
        g_r = -path * 0.18 + edge * 0.1 - nail * 0.3 + late * 0.05;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.3, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0025);`,
    fragLight: AO_GLSL,
  });
  wood.name = 'bridgeDeck';

  // dark capping band (old black-lacquered / iron-sheathed edge)
  const dark = mat.std({ color: 0xffffff, roughness: 0.5, metalness: 0.15 }, {
    fragHead: 'float g_h;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float n = n_fbm3(wp * vec3(2.0, 6.0, 2.0), 3);
        float sp = n_snoise3(wp * 60.0) * (1.0 - smoothstep(0.003, 0.009, length(fwidth(wp))));
        float sp2 = n_snoise3(wp * 23.0 + 7.0);
        vec3 col = vec3(0.034, 0.029, 0.026) * (0.75 + 0.5 * n);
        col = mix(col, vec3(0.16, 0.14, 0.11), smoothstep(0.55, 0.9, sp) * 0.5);
        col = mix(col, vec3(0.21, 0.155, 0.06), smoothstep(0.62, 0.95, sp2) * 0.4);
        col = mix(col, vec3(0.05, 0.075, 0.045), smoothstep(0.2, 0.8, n_fbm3(wp * 1.3 + 4.0, 3)) * 0.3);
        diffuseColor.rgb = col;
        g_h = n * 0.4 + sp * 0.15 + sp2 * 0.12;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(0.55 + g_h * 0.3, 0.35, 0.95);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.003);`,
  });
  dark.name = 'bridgeDark';

  // gilt fittings
  // vColor: r = brightness, g = extra roughness (matte punched "nanako" ground), b = tint shift
  const gold = mat.std({ color: 0xffffff, roughness: 0.18, metalness: 1.0, vertexColors: true }, {
    fragHead: 'float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        // g = matte (+2 when the sheet carries engraved karakusa)
        float engr = step(1.5, vColor.g);
        float bright = vColor.r, rAdd = vColor.g - 2.0 * engr, tsh = vColor.b;
        float n = n_fbm3(wp * 3.1, 3);
        float tarnish = smoothstep(0.15, 0.75, n_fbm3(wp * 1.1 + 7.0, 3) * 0.5 + 0.5);
        vec3 base = mix(vec3(1.0, 0.74, 0.36), vec3(1.0, 0.68, 0.30), tsh);
        vec3 col = base * (0.93 + 0.1 * n);
        col = mix(col, base * vec3(0.52, 0.40, 0.24), tarnish * (0.25 + 0.35 * max(rAdd, 0.0)));
        // punched ground: tiny dots
        float dots = n_snoise3(wp * 420.0) * (1.0 - smoothstep(0.0007, 0.002, length(fwidth(wp))));
        col *= bright * (1.0 - max(rAdd, 0.0) * 0.25 * smoothstep(0.2, 0.8, dots));
        g_h = n * 0.4 + tarnish * 0.25 + rAdd * dots * 0.15;
        g_r = tarnish * 0.12 + rAdd;
        if (engr > 0.5) {
          // engraved scrolls on the vertical faces of sleeves / bands: spirals linked by a running vine
          vec3 wnE = normalize(vWNrm);
          float sideE = 1.0 - smoothstep(0.55, 0.8, abs(wnE.y));
          vec2 tE = normalize(vec2(-wnE.z, wnE.x) + vec2(1e-5, 0.0));
          vec2 q = vec2(dot(wp.xz, tE), wp.y) / 0.03;
          vec2 cellE = floor(q); vec2 fE = fract(q) - 0.5;
          float flipE = mod(cellE.x + cellE.y, 2.0) * 2.0 - 1.0;
          float rE = length(fE); float aE = atan(fE.y, fE.x * flipE);
          float spl = abs(fract(aE / 6.2832 + rE * 2.4) - 0.5);
          float spiral = (1.0 - smoothstep(0.07, 0.13, spl)) * (1.0 - smoothstep(0.34, 0.42, rE)) * smoothstep(0.03, 0.07, rE);
          float vine = 1.0 - smoothstep(0.035, 0.075, abs(fE.y + 0.42 * flipE * cos(fE.x * 3.1416)));
          float aaE = 1.0 - smoothstep(0.18, 0.45, length(fwidth(q)));
          float groove = max(spiral, vine * 0.8) * sideE * aaE;
          col *= 1.0 - 0.5 * groove;
          g_h -= groove * 0.6;
          g_r += groove * 0.2;
        }
        diffuseColor.rgb = diffuse * col;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.06, 1.0);`,
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0011);
      { vec3 dn = fwidth(normal); roughnessFactor = max(roughnessFactor, clamp(length(dn) * 0.9, 0.0, 0.42)); }`,
  });
  gold.name = 'bridgeGold';

  // gilt-bronze giboshi: uv.x = angle fraction round the finial axis (petals: -1..1 across), uv.y =
  // local height in metres (petals: 0..1 along); colour r = brightness (+2 on petals), g = cavity
  // (0 polished arris .. 0.5 flat .. 1 deep recess). All chasing fades out once sub-pixel.
  const gibC = (k) => f6(k);
  const gib = mat.std({ color: 0xffffff, roughness: 0.15, metalness: 1.0, vertexColors: true }, {
    vertexHead: 'varying vec2 vGib;',
    vertexWorld: 'vGib = uv;',
    fragHead: 'varying vec2 vGib; float g_h; float g_r;',
    fragColor: /* glsl */ `
      {
        vec3 wp = vWPos;
        float h = vGib.y;
        float petal = step(1.5, vColor.r);
        float bright = vColor.r - 2.0 * petal;
        float cav = vColor.g;
        float px = length(fwidth(wp));                         // pixel footprint (m)
        float n1 = n_fbm3(wp * 7.0 + 3.0, 3);
        float n2 = n_fbm3(wp * 1.7 + 11.0, 2);
        float aa3 = 1.0 - smoothstep(0.004, 0.012, px);
        float n3 = n_fbm3(wp * 23.0, 2) * aa3;
        vec3 gld = vec3(1.0, 0.745, 0.37);
        vec3 col = gld * (0.93 + 0.07 * n1 + 0.04 * n3);
        float cavW = smoothstep(0.55, 0.92, cav);
        float pol = 1.0 - smoothstep(0.2, 0.45, cav);           // raised, hand-polished arrises
        float tarn = clamp(smoothstep(-0.1, 0.7, n2) * 0.32 + cavW * 0.75 - pol * 0.3, 0.0, 1.0);
        col = mix(col, gld * vec3(0.44, 0.32, 0.19), tarn * 0.8);
        // verdigris blooms in the deepest recesses (copper-rich gilt bronze)
        float verd = cavW * smoothstep(0.05, 0.6, n1 + 0.3 * n3);
        col = mix(col, vec3(0.11, 0.25, 0.18), verd * 0.6);
        float gx = 0.0, grv = 0.0, matte = 0.0;
        if (petal < 0.5) {
          float ang = vGib.x;
          // band A: chased karakusa scroll (running vine with curls) on a punched ground
          float inA = smoothstep(${gibC(GIB.bandA[0])}, ${gibC(GIB.bandA[0] + 0.0012)}, h) * (1.0 - smoothstep(${gibC(GIB.bandA[1] - 0.0012)}, ${gibC(GIB.bandA[1])}, h));
          if (inA > 0.0) {
            vec2 q = vec2(ang * 40.0, (h - ${gibC((GIB.bandA[0] + GIB.bandA[1]) / 2)}) / 0.0122);
            float aaq = 1.0 - smoothstep(0.12, 0.35, length(fwidth(q)));
            float c = floor(q.x); vec2 f = vec2(fract(q.x) - 0.5, q.y);
            float fl = mod(c, 2.0) * 2.0 - 1.0;
            float vine = 1.0 - smoothstep(0.03, 0.09, abs(f.y - 0.36 * fl * cos(f.x * 3.14159)));
            vec2 sc = f - vec2(0.05 * fl, -0.2 * fl);
            float rS = length(sc); float aS = atan(sc.y, sc.x * fl);
            float spl = abs(fract(aS / 6.2832 + rS * 3.4) - 0.5);
            float spiral = (1.0 - smoothstep(0.08, 0.17, spl)) * (1.0 - smoothstep(0.25, 0.3, rS)) * smoothstep(0.02, 0.05, rS);
            grv = max(vine, spiral) * aaq * inA;
            matte = inA * (1.0 - grv);
          }
          // band B: ring-punched ground under the stud ring
          float inB = smoothstep(${gibC(GIB.bandB[0])}, ${gibC(GIB.bandB[0] + 0.001)}, h) * (1.0 - smoothstep(${gibC(GIB.bandB[1] - 0.001)}, ${gibC(GIB.bandB[1])}, h));
          matte = max(matte, inB);
          if (matte > 0.0) {
            vec2 qd = vec2(ang * 360.0, h / 0.00135);
            float aad = 1.0 - smoothstep(0.15, 0.4, length(fwidth(qd)));
            float rd = length(fract(qd) - 0.5);
            float ringd = (1.0 - smoothstep(0.06, 0.14, abs(rd - 0.3))) * aad * matte;
            gx -= ringd * 0.25;
            col *= 1.0 - 0.2 * ringd;
          }
          // bulb: incised rings at the girth and below the point; hammered raising marks
          float onB = step(${gibC(GIB.bulb0)}, h);
          float fwh = max(fwidth(h), 1e-6);
          float rings = 0.0;
          rings = max(rings, 1.0 - smoothstep(0.0004, 0.0004 + fwh * 1.5, abs(h - ${gibC(GIB.rings[0])})));
          rings = max(rings, 1.0 - smoothstep(0.0004, 0.0004 + fwh * 1.5, abs(h - ${gibC(GIB.rings[1])})));
          rings = max(rings, 1.0 - smoothstep(0.0004, 0.0004 + fwh * 1.5, abs(h - ${gibC(GIB.rings[2])})));
          grv = max(grv, rings * onB * (1.0 - smoothstep(0.0007, 0.002, fwh)));
          float aah = 1.0 - smoothstep(0.0015, 0.004, px);
          // shallow round planishing dimples (smooth-edged), barely breaking the reflection
          vec2 wo = n_worley3(wp * 110.0);
          float dim = 1.0 - smoothstep(0.0, 0.42, wo.x * wo.x);
          gx -= dim * dim * 0.035 * aah * onB;
        } else {
          // lotus petal: veins fanning along the petal, darker toward the root
          float v = vGib.x, u = vGib.y;
          float aav = 1.0 - smoothstep(0.12, 0.4, fwidth(v * 3.5));
          float veins = (1.0 - smoothstep(0.1, 0.22, abs(fract(v * 3.5 + 0.5) - 0.5))) * aav * (1.0 - u * 0.5) * (1.0 - smoothstep(0.75, 1.0, abs(v)));
          grv = max(grv, veins * 0.55);
        }
        col *= 1.0 - 0.45 * grv;
        col = mix(col, col * vec3(0.72, 0.6, 0.45), grv * 0.45);  // dirt held in the cuts
        diffuseColor.rgb = diffuse * col * bright;
        g_h = n1 * 0.12 - grv * 0.7 + gx;
        g_r = tarn * 0.15 + matte * 0.2 + grv * 0.16 + verd * 0.4 - pol * 0.04;
      }
    `,
    fragRough: /* glsl */ `roughnessFactor = clamp(roughnessFactor + g_r, 0.07, 1.0);`,
    // micro relief, then specular anti-aliasing: widen the lobe where the normal turns within a pixel
    fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0006);
      { vec3 dn = fwidth(normal); roughnessFactor = max(roughnessFactor, clamp(length(dn) * 0.9, 0.0, 0.42)); }`,
  });
  gib.name = 'bridgeGiboshi';
  const RIVET = new THREE.SphereGeometry(0.0048, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2); RIVET.rotateX(Math.PI / 2); RIVET.scale(1, 1, 0.75);
  const TSUKA_BAND = new RBox(0.074, 0.022, 0.074, 1, 0.004);
  const RIVET_HI = new THREE.SphereGeometry(0.0048, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2); RIVET_HI.rotateX(Math.PI / 2); RIVET_HI.scale(1, 1, 0.75);

  // granite (piers, abutments, slabs) with a waterline algae band and wet darkening
  const GP = mat.PROC.granite('0.45', 'vec3(0.62, 0.635, 0.66)');
  const granite = mat.std({ color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: true }, {
    fragHead: GP.fragHead + ARC_GLSL + 'float g_wet;',
    fragColor: GP.fragColor + /* glsl */ `
      {
        vec3 wpS = vWPos; vec3 wnS = normalize(vWNrm);
        // weathering patches, lichen rosettes, vertical run-off streaks
        float wpat = n_fbm3(wpS * 1.8 + 31.0, 3);
        diffuseColor.rgb *= 0.74 + 0.34 * smoothstep(-0.45, 0.5, wpat);
        vec2 wl = n_worley3(wpS * 7.0 + 5.0);
        float lichP = smoothstep(0.05, 0.45, n_fbm3(wpS * 1.3 + 2.0, 2));
        float lich = (1.0 - smoothstep(0.1, 0.24, wl.x)) * lichP;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.40, 0.33), lich * 0.55);
        float sideS = 1.0 - abs(wnS.y);
        float vs = n_fbm3(vec3((wpS.x + wpS.z) * 7.0, wpS.y * 0.7, 3.0), 3);
        diffuseColor.rgb *= 1.0 - sideS * smoothstep(0.0, 0.45, vs) * 0.28;
        // granular salt-and-pepper crystals + tooling pits (faded out when sub-pixel)
        float gq = n_snoise3(wpS * 170.0), gq2 = n_snoise3(wpS * 90.0 + 11.0);
        float aaG = 1.0 - smoothstep(0.12, 0.4, length(fwidth(wpS * 170.0)));
        diffuseColor.rgb *= 1.0 + aaG * (0.22 * smoothstep(0.35, 0.8, gq2) - 0.35 * smoothstep(0.45, 0.85, gq));
        float pxS = length(fwidth(wpS));
        float pits = smoothstep(0.55, 0.85, n_snoise3(wpS * 38.0 + 3.0)) * (1.0 - smoothstep(0.004, 0.012, pxS));
        g_h += aaG * (gq * 0.05 + gq2 * 0.04) - pits * 0.12 + n_fbm3(wpS * 14.0, 2) * 0.1;
        float h = vWPos.y - WATER_Y;
        float n1 = n_fbm3(vWPos * vec3(3.0, 1.2, 3.0), 3);
        float wet = 1.0 - smoothstep(0.02, 0.5 + 0.25 * n1, h);
        float band = smoothstep(-0.3, -0.04, h) * (1.0 - smoothstep(0.04, 0.2 + 0.12 * n1, h));
        float under = 1.0 - smoothstep(-0.35, -0.02, h);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.52, 0.50, 0.45), wet * 0.85);
        vec3 algae = mix(vec3(0.030, 0.040, 0.014), vec3(0.06, 0.07, 0.025), n1 * 0.5 + 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, algae, band * 0.88);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.045, 0.028), under * 0.75);
        // tide lines: thin dark rings left by past water levels on the vertical faces
        float fwh = fwidth(h);
        float tide = 0.0;
        tide += (1.0 - smoothstep(0.004, 0.012 + fwh, abs(h - 0.075 - 0.012 * n1))) * 0.55;
        tide += (1.0 - smoothstep(0.003, 0.01 + fwh, abs(h - 0.17 - 0.02 * n1))) * 0.35;
        tide += (1.0 - smoothstep(0.003, 0.009 + fwh, abs(h - 0.3 - 0.03 * n1))) * 0.2;
        tide *= sideS * (1.0 - smoothstep(0.006, 0.02, pxS));
        diffuseColor.rgb *= 1.0 - tide * 0.45;
        // moss: cushions on the upward faces (footing steps, ledges, coping, capitals) and creeping up the
        // damp lower courses; fine clumpy texture resolved only up close
        float upS = smoothstep(0.3, 0.85, wnS.y);
        float mN = n_fbm3(wpS * 2.6 + 13.0, 3) * 0.5 + 0.5;
        float aaM = 1.0 - smoothstep(0.003, 0.01, pxS);
        float mF = n_fbm3(wpS * 26.0 + 5.0, 2) * aaM;
        float nearWS = 1.0 - smoothstep(0.25, 2.2, h);
        float walk = smoothstep(-0.12, 0.02, vWPos.y) * (1.0 - smoothstep(${f6(HW + 0.2)}, ${f6(HW + 0.55)}, abs(vWPos.x - BR_X0)));
        float moss = upS * smoothstep(0.46, 0.66, mN + 0.22 * nearWS) * (1.0 - walk * 0.85)
                   + sideS * nearWS * smoothstep(0.58, 0.78, mN + 0.1 * mF) * 0.75 * (1.0 - under);
        moss = clamp(moss * (0.8 + 0.35 * mF), 0.0, 1.0);
        vec3 mossC = mix(vec3(0.045, 0.07, 0.018), vec3(0.12, 0.14, 0.035), smoothstep(0.3, 0.8, mN + 0.3 * mF));
        diffuseColor.rgb = mix(diffuseColor.rgb, mossC, moss * 0.88);
        g_h += moss * (0.25 + 0.35 * mF) - tide * 0.05;
        g_wet = max(wet, band) * (1.0 - moss * 0.6);
      }
    `,
    fragRough: GP.fragRough + `roughnessFactor = mix(roughnessFactor, 0.32, g_wet * 0.7);`,
    fragNormal: GP.fragNormal,
    fragLight: AO_GLSL,
  });
  granite.name = 'bridgeGranite';

  // ---------------------------------------------------------------- geometry helpers
  const B = new Builder();
  const MODE_ARC = 0.0, MODE_VERT = 0.5, MODE_X = 1.0;

  function paint(g, r, gg, b) {
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  }
  // kind 1 = railing member (shu), 0 = fascia / substructure (oxblood)
  const addLac = (g, mode, dirt, m = null, kind = 0) => B.add(paint(g, mode, dirt + 2 * kind, rnd.next()), lac, m);
  // gold pieces: tint = brightness, matte = extra roughness (punched ground)
  const addGold = (g, m = null, tint = 1, matte = 0) => B.add(paint(g, tint * (0.93 + 0.1 * rnd.next()), matte, rnd.next()), gold, m);
  const addDark = (g, m = null) => B.add(paint(g, 1, 1, 1), dark, m);
  const addStone = (g, m = null, tone = 1) => { const t = tone * (0.72 + 0.36 * rnd.next()); const w = rnd.next(); return B.add(paint(g, t * (1.0 + 0.06 * w), t * (0.97 + 0.03 * w), t * (0.9 + 0.08 * (1 - w))), granite, m); };

  // profiles: arrays of [u, v, nu, nv], counter-clockwise
  function rrect(w, h, r, k = 3) {
    const out = []; const cx = w / 2 - r, cy = h / 2 - r;
    const corners = [[cx, -cy, -Math.PI / 2], [cx, cy, 0], [-cx, cy, Math.PI / 2], [-cx, -cy, Math.PI]];
    for (const [x, y, a0] of corners) for (let i = 0; i <= k; i++) {
      const a = a0 + (i / k) * Math.PI / 2;
      out.push([x + r * Math.cos(a), y + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
    return out;
  }
  function ellipse(a, b, n = 22) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const nx = Math.cos(t) / a, ny = Math.sin(t) / b; const l = Math.hypot(nx, ny);
      out.push([a * Math.cos(t), b * Math.sin(t), nx / l, ny / l]);
    }
    return out;
  }
  // sweep a profile along points lying in a constant-x plane (frame: side = +x, up = perpendicular in y-z)
  function sweep(pts, prof, capA = true, capB = true) {
    const n = pts.length, m = prof.length;
    const pos = [], nor = [], idx = [];
    const T = new THREE.Vector3();
    const frame = (i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)]; T.subVectors(b, a).normalize(); return [T.z, -T.y]; };
    for (let i = 0; i < n; i++) {
      const [ny, nz] = frame(i); const p = pts[i];
      for (const [u, v, nu, nv] of prof) { pos.push(p.x + u, p.y + v * ny, p.z + v * nz); nor.push(nu, nv * ny, nv * nz); }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < m; j++) {
      const j1 = (j + 1) % m; const a = i * m + j, b = (i + 1) * m + j, c = (i + 1) * m + j1, d = i * m + j1;
      idx.push(a, d, c, a, c, b);
    }
    const cap = (i, sgn) => {
      const [ny, nz] = frame(i); const p = pts[i];
      const tx = 0, ty = -nz, tz = ny; // tangent
      const base = pos.length / 3;
      let cu = 0, cv = 0; for (const q of prof) { cu += q[0]; cv += q[1]; } cu /= m; cv /= m;
      pos.push(p.x + cu, p.y + cv * ny, p.z + cv * nz); nor.push(tx * sgn, ty * sgn, tz * sgn);
      for (const [u, v] of prof) { pos.push(p.x + u, p.y + v * ny, p.z + v * nz); nor.push(tx * sgn, ty * sgn, tz * sgn); }
      for (let j = 0; j < m; j++) { const j1 = (j + 1) % m; if (sgn > 0) idx.push(base, base + 1 + j, base + 1 + j1); else idx.push(base, base + 1 + j1, base + 1 + j); }
    };
    if (capA) cap(0, -1);
    if (capB) cap(n - 1, +1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  function arcPts(off, z0, z1, x, step = 0.1) {
    const t0 = thAtZ(z0, off), t1 = thAtZ(z1, off);
    const n = Math.max(2, Math.ceil((Math.abs(t1 - t0) * (RA + off)) / step) + 1);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(ptTh(t0 + ((t1 - t0) * i) / (n - 1), off, x));
    return pts;
  }
  const rbox = (w, h, d, r, seg = 2) => new RBox(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.45));

  // cheap deterministic 3D value noise for rough stone
  const hash3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const L1 = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L1(L1(L1(c(0, 0, 0), c(1, 0, 0), u), L1(c(0, 1, 0), c(1, 1, 0), u), v), L1(L1(c(0, 0, 1), c(1, 0, 1), u), L1(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const fbm3 = (x, y, z) => vnoise3(x, y, z) * 0.55 + vnoise3(x * 2.1 + 7, y * 2.1, z * 2.1) * 0.3 + vnoise3(x * 4.3, y * 4.3 + 3, z * 4.3) * 0.15;

  // rough-hewn granite block: subdivided rounded box with noise displacement (centred at origin)
  function stoneBlock(w, h, d, r = 0.035, amp = 0.012, step = 0.09, seed = 0, faceBulge = 0.0) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    r = Math.min(r, hx * 0.45, hy * 0.45, hz * 0.45);
    const axis = (half) => {
      const inner = half - r; const pts = [-half, -half + r * 0.3, -inner];
      // extra rows across the drafted margin
      const m1 = half - 0.06, m2 = half - 0.1;
      const useM = m2 > 0.04 && m1 < inner - 0.008;
      const lo = useM ? m2 : inner;
      if (useM) pts.push(-m1, -m2);
      const n = Math.max(1, Math.ceil((2 * lo) / step));
      for (let i = 1; i < n; i++) pts.push(-lo + (2 * lo * i) / n);
      if (useM) pts.push(m2, m1);
      pts.push(inner, half - r * 0.3, half); return pts;
    };
    const C = [axis(hx), axis(hy), axis(hz)], Hh = [hx, hy, hz];
    const pos = [], idx = [];
    const faces = [[0, 1, 2], [1, 2, 0], [2, 0, 1]]; // [normal axis, b, c] with b x c = a
    for (const [a, b, c] of faces) for (const s of [1, -1]) {
      const cb = C[b], cc = C[c]; const base = pos.length / 3;
      for (let j = 0; j < cc.length; j++) for (let i = 0; i < cb.length; i++) { const p = [0, 0, 0]; p[a] = s * Hh[a]; p[b] = cb[i]; p[c] = cc[j]; pos.push(p[0], p[1], p[2]); }
      const nb = cb.length;
      for (let j = 0; j < cc.length - 1; j++) for (let i = 0; i < nb - 1; i++) {
        const v00 = base + j * nb + i, v10 = v00 + 1, v01 = v00 + nb, v11 = v01 + 1;
        if (s > 0) idx.push(v00, v10, v11, v00, v11, v01); else idx.push(v00, v11, v10, v00, v01, v11);
      }
    }
    const ih = [hx - r, hy - r, hz - r];
    for (let k = 0; k < pos.length; k += 3) {
      const p = [pos[k], pos[k + 1], pos[k + 2]];
      const q = [clamp(p[0], -ih[0], ih[0]), clamp(p[1], -ih[1], ih[1]), clamp(p[2], -ih[2], ih[2])];
      let dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2]; const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l;
      // face-centre bulge (rock-faced ashlar) + noise
      // in-face distance to the nearest arris (metres) -> drafted margin + rock-faced centre
      const dd = [Hh[0] - Math.abs(p[0]), Hh[1] - Math.abs(p[1]), Hh[2] - Math.abs(p[2])].sort((a, b) => a - b);
      const dEdge = dd[1];
      const inC = sm(0.035, 0.09, dEdge);
      const bul = faceBulge * inC;
      const rough = (fbm3(p[0] * 9 + seed, p[1] * 9 + seed * 0.3, p[2] * 9 - seed) - 0.5) * 2 * amp;
      const pitch = (vnoise3(p[0] * 31 + seed, p[1] * 31, p[2] * 31 - seed) - 0.5) * amp * 0.6;
      // chipped arrises: knock material off near edges/corners
      const chip = -amp * 2.2 * (1 - sm(0.0, 0.05, dEdge)) * Math.max(0, fbm3(p[0] * 13 - seed, p[1] * 13 + seed, p[2] * 13) - 0.4) * 2.5;
      const nz = (rough + pitch) * (0.35 + 0.65 * inC) + bul + chip;
      pos[k] = q[0] + dx * (r + nz); pos[k + 1] = q[1] + dy * (r + nz); pos[k + 2] = q[2] + dz * (r + nz);
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g = geom.mergeVertices(g, 1e-5);
    g.computeVertexNormals();
    return g;
  }

  // shapes
  function polarShape(fn, n = 160) {
    const s = new THREE.Shape();
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const [x, y] = fn(a); if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); }
    s.closePath(); return s;
  }
  function circlePath(cx, cy, r, n = 20, cw = true) {
    const p = new THREE.Path();
    for (let i = 0; i < n; i++) { const a = (cw ? -1 : 1) * (i / n) * Math.PI * 2; const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); if (i === 0) p.moveTo(x, y); else p.lineTo(x, y); }
    p.closePath(); return p;
  }
  // extrude a shape toward +z (thickness t) with a soft bevel; result sits on z = 0..t
  function relief(shape, t, bevel, segs = 2) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(t - bevel * 2, 0.0005), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segs, curveSegments: 6, steps: 1 });
    g.translate(0, 0, bevel);
    return g;
  }

  // ---------------------------------------------------------------- ornaments (local: plate in XY, facing +Z)
  // large kazari-kanagu: lobed gilt plate with openwork, raised rosette, boss and karakusa scrolls
  function scrollCurve(x0, y0, dir, sgn, len, turns, r0) {
    const pts = []; let x = x0, y = y0, a = dir;
    const n1 = 14; const st = len / n1;
    for (let i = 0; i < n1; i++) { pts.push(new THREE.Vector3(x, y, 0)); a += sgn * 0.05; x += Math.cos(a) * st; y += Math.sin(a) * st; }
    // volute
    const cx = x + Math.cos(a + sgn * Math.PI / 2) * r0, cy = y + Math.sin(a + sgn * Math.PI / 2) * r0;
    const phi0 = Math.atan2(y - cy, x - cx); const n2 = 34;
    for (let i = 0; i <= n2; i++) {
      const t = i / n2; const phi = phi0 + sgn * t * turns * Math.PI * 2; const r = r0 * Math.exp(-1.1 * t * turns);
      pts.push(new THREE.Vector3(cx + Math.cos(phi) * r, cy + Math.sin(phi) * r, 0));
    }
    return pts;
  }
  // returns [[geometry, matte], ...] in the plate frame (XY plane, relief toward +Z)
  function ornamentParts(S) {
    const out = [];
    const T0 = 0.0055 * S + 0.002;
    // leaf arm with a trefoil tip and a heart-shaped (inome) opening, pointing +x
    const leaf = (len, wid, x0) => {
      const s = new THREE.Shape();
      s.moveTo(x0, 0);
      s.bezierCurveTo(x0 + len * 0.1, wid * 1.15, x0 + len * 0.6, wid * 1.2, x0 + len * 0.76, wid * 0.5);
      s.quadraticCurveTo(x0 + len * 0.84, wid * 0.95, x0 + len * 0.94, wid * 0.46);
      s.quadraticCurveTo(x0 + len * 1.07, wid * 0.24, x0 + len, 0);
      s.quadraticCurveTo(x0 + len * 1.07, -wid * 0.24, x0 + len * 0.94, -wid * 0.46);
      s.quadraticCurveTo(x0 + len * 0.84, -wid * 0.95, x0 + len * 0.76, -wid * 0.5);
      s.bezierCurveTo(x0 + len * 0.6, -wid * 1.2, x0 + len * 0.1, -wid * 1.15, x0, 0);
      const h = new THREE.Path();
      const hx = x0 + len * 0.47, hw = wid * 0.5, hl = len * 0.2;
      h.moveTo(hx + hl, 0);
      h.bezierCurveTo(hx + hl * 0.4, hw * 0.95, hx - hl * 0.5, hw * 1.05, hx - hl * 0.6, hw * 0.4);
      h.quadraticCurveTo(hx - hl * 0.32, 0, hx - hl * 0.6, -hw * 0.4);
      h.bezierCurveTo(hx - hl * 0.5, -hw * 1.05, hx + hl * 0.4, -hw * 0.95, hx + hl, 0);
      s.holes.push(h);
      return s;
    };
    const arms = [[0, 0.25, 0.078], [Math.PI, 0.25, 0.078], [Math.PI / 2, 0.15, 0.06], [-Math.PI / 2, 0.15, 0.06]];
    arms.forEach(([ang, len, wid], i) => {
      const g = relief(leaf(len * S, wid * S, 0.045 * S), T0 + 0.0004 * (i + 1), 0.0022, 1);
      g.rotateZ(ang); out.push([g, 2.22]); // punched ground + engraved scrolls
      // raised midrib + scroll pair (warabi) on each arm, polished
      const z = T0 + 0.0025;
      const sc = len / 0.25;
      for (const sy of [-1, 1]) {
        const pts = scrollCurve(0.07 * S, sy * 0.012 * S, sy * 0.3, -sy, 0.085 * S * sc, 0.8, 0.03 * S * Math.sqrt(sc)).map((p) => p.setZ(z));
        const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.005 * S + 0.0012, 5, false);
        tg.rotateZ(ang); out.push([tg, 0]);
      }
      // small leaf bud at the tip, polished
      const bud = relief(polarShape((a) => { const r = (0.02 + 0.006 * Math.cos(a * 3)) * S * Math.sqrt(sc); return [r * Math.cos(a) * 1.2, r * Math.sin(a)]; }, 36), 0.006 * S, 0.0025 * S, 2);
      bud.translate((0.045 + len * 0.86) * S, 0, T0); bud.rotateZ(ang); out.push([bud, 0]);
      // rivet at the tip
      const rv = new THREE.SphereGeometry(0.008 * S + 0.002, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); rv.rotateX(Math.PI / 2);
      rv.translate((0.045 + len * 1.01) * S + 0.004, 0, T0 * 0.6); rv.rotateZ(ang); out.push([rv, 0]);
    });
    // diagonal small teardrop leaves between the arms
    for (let k = 0; k < 4; k++) {
      const ang = Math.PI / 4 + k * Math.PI / 2;
      const tear = new THREE.Shape();
      const r0 = 0.07 * S, r1 = 0.15 * S, w = 0.03 * S;
      tear.moveTo(r0, 0); tear.bezierCurveTo(r0 + 0.02 * S, w * 1.4, r1 - 0.03 * S, w * 0.9, r1, 0); tear.bezierCurveTo(r1 - 0.03 * S, -w * 0.9, r0 + 0.02 * S, -w * 1.4, r0, 0);
      const g = relief(tear, T0 + 0.003, 0.002, 2); g.rotateZ(ang); out.push([g, 0.1]);
    }
    // centre: matte disc, 16-petal chrysanthemum, ring, boss
    const disc = relief(polarShape((a) => [0.088 * S * Math.cos(a), 0.088 * S * Math.sin(a)], 48), T0, 0.002, 1);
    out.push([disc, 0.03]);
    const ros = polarShape((a) => { const r = (0.056 + 0.016 * Math.pow(Math.abs(Math.cos(a * 8)), 0.55)) * S; return [r * Math.cos(a), r * Math.sin(a)]; }, 192);
    const rg = relief(ros, 0.01 * S, 0.0045 * S, 3); rg.translate(0, 0, T0 - 0.001); out.push([rg, -1]); // dark lacquered chrysanthemum inside the gilt rim
    const ring = new THREE.TorusGeometry(0.04 * S, 0.0045 * S, 6, 36); ring.translate(0, 0, T0 + 0.009 * S); out.push([ring, 0]);
    const boss = new THREE.SphereGeometry(0.027 * S, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.85); boss.translate(0, 0, T0 + 0.006 * S); out.push([boss, 0]);
    // beaded ring round the rosette (tama-buchi)
    for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; const bd = new THREE.SphereGeometry(0.0036 * S + 0.001, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); bd.rotateX(Math.PI / 2); bd.translate(Math.cos(a) * 0.08 * S, Math.sin(a) * 0.08 * S, T0); out.push([bd, 0]); }
    return out;
  }
  // small square fitting with cut corners and a centre boss (sumikiri kanagu)
  function squarePlate(w, h, t = 0.005) {
    const c = Math.min(w, h) * 0.18;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + c, -h / 2); s.lineTo(w / 2 - c, -h / 2); s.lineTo(w / 2, -h / 2 + c); s.lineTo(w / 2, h / 2 - c);
    s.lineTo(w / 2 - c, h / 2); s.lineTo(-w / 2 + c, h / 2); s.lineTo(-w / 2, h / 2 - c); s.lineTo(-w / 2, -h / 2 + c); s.closePath();
    const out = [[relief(s, t, 0.0015, 1), 0.3]];
    const inner = new THREE.Shape(); const w2 = w * 0.62, h2 = h * 0.62, c2 = c * 0.6;
    inner.moveTo(-w2 / 2 + c2, -h2 / 2); inner.lineTo(w2 / 2 - c2, -h2 / 2); inner.lineTo(w2 / 2, -h2 / 2 + c2); inner.lineTo(w2 / 2, h2 / 2 - c2);
    inner.lineTo(w2 / 2 - c2, h2 / 2); inner.lineTo(-w2 / 2 + c2, h2 / 2); inner.lineTo(-w2 / 2, h2 / 2 - c2); inner.lineTo(-w2 / 2, -h2 / 2 + c2); inner.closePath();
    const ig = relief(inner, t * 0.6, 0.0012, 1); ig.translate(0, 0, t); out.push([ig, 0]);
    const boss = new THREE.SphereGeometry(Math.min(w, h) * 0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.7); boss.translate(0, 0, t * 1.5); out.push([boss, 0]);
    return out;
  }
  // beam-end fitting (kiguchi kanagu): black-lacquer inset framed by the gilt sleeve, a gilt
  // chrysanthemum boss and corner rivets. returns [[geom, 'gold'|'dark', matte]]
  function endFitting(w, h) {
    const out = [];
    const m = Math.min(w, h) * 0.5;
    const pnl = new RBox(w * 0.76, h * 0.76, 0.004, 1, 0.0015); pnl.translate(0, 0, 0.002);
    out.push([pnl, 'dark', 0]);
    const ros = polarShape((a) => { const r = (0.26 + 0.07 * Math.pow(Math.abs(Math.cos(a * 8)), 0.55)) * m; return [r * Math.cos(a), r * Math.sin(a)]; }, 128);
    const rg = relief(ros, 0.009, 0.003, 2); rg.translate(0, 0, 0.003); out.push([rg, 'gold', 0.05]);
    const ring = new THREE.TorusGeometry(0.17 * m, 0.022 * m + 0.001, 5, 28); ring.translate(0, 0, 0.012); out.push([ring, 'gold', 0]);
    const boss = new THREE.SphereGeometry(0.11 * m, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2); boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.8); boss.translate(0, 0, 0.011); out.push([boss, 'gold', 0]);
    // domed rivets in the four corners of the gilt frame
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const rv = new THREE.SphereGeometry(0.075 * m, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2); rv.rotateX(Math.PI / 2); rv.scale(1, 1, 0.7);
      rv.translate(sx * w * 0.44, sy * h * 0.44, 0.0); out.push([rv, 'gold', 0]);
    }
    return out;
  }
  // pointed lozenge plate for the post faces
  function lozengePlate(w, h, t = 0.004, simple = false) {
    const s = new THREE.Shape(); const n = simple ? 24 : 36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; const c = Math.cos(a), si = Math.sin(a);
      const k = Math.pow(Math.abs(c), 1.6) + Math.pow(Math.abs(si), 1.6);
      const r = 1 / Math.pow(k, 1 / 1.6) * (1 + 0.08 * Math.cos(a * 6));
      const x = c * r * w / 2, y = si * r * h / 2; if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    const out = [[relief(s, t, 0.0015, 1), 0.25]];
    const boss = new THREE.SphereGeometry(w * 0.16, simple ? 10 : 14, simple ? 4 : 7, 0, Math.PI * 2, 0, Math.PI / 2); boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.75); boss.translate(0, 0, t); out.push([boss, 0]);
    if (!simple) { const ring = new THREE.TorusGeometry(w * 0.24, w * 0.025, 5, 20); ring.translate(0, 0, t + 0.0005); out.push([ring, 0]); }
    return out;
  }
  // gold sleeve pendant (downward pointed shield)
  function pendantPlate(w, h, t = 0.0035) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0);
    s.bezierCurveTo(w / 2, -h * 0.35, w * 0.18, -h * 0.55, 0, -h);
    s.bezierCurveTo(-w * 0.18, -h * 0.55, -w / 2, -h * 0.35, -w / 2, 0);
    const out = [[relief(s, t, 0.0012, 1), 0.25]];
    const boss = new THREE.SphereGeometry(w * 0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); boss.rotateX(Math.PI / 2); boss.translate(0, -h * 0.38, t); out.push([boss, 0]);
    return out;
  }

  // ---------------------------------------------------------------- GIBOSHI (gilt-bronze onion finial)
  // Lathe profile (local: base on the cap plate at y = 0, scale 1 for a 0.16 m post): foot bead,
  // cavetto, a chased band between raised rims, a second cavetto, a stud-ring seat, a waisted neck
  // with a collar bead, the onion bulb (hoju) and a drawn-out point. A double lotus-petal collar
  // hugs the base of the bulb. uv = (angle fraction, local height) drives the chasing in the
  // shader; colour g = cavity (0 polished arris .. 1 deep recess -> patina).
  function giboshiProfileHi(nb) {
    const P = [];
    const add = (r, y) => P.push([Math.max(r, 0.0001), y]);
    const bead = (rb, yc, rad, n) => { for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; add(rb + rad * Math.sin(a), yc - rad * Math.cos(a)); } };
    add(0.0001, 0); add(0.060, 0); add(0.0655, 0.0012); add(0.068, 0.0035);
    bead(0.068, 0.009, 0.0048, 6);
    add(0.0668, 0.015); add(0.0638, 0.0185); add(0.0624, 0.0222); add(0.0634, 0.0258); add(0.0668, 0.0288); add(0.0738, 0.0305); add(0.0766, 0.0310);
    bead(0.0766, 0.0346, 0.0034, 5);
    add(0.0775, 0.0384); add(0.0775, 0.0484); add(0.0775, 0.0583);
    bead(0.0766, 0.0621, 0.0034, 5);
    add(0.0738, 0.066); add(0.0700, 0.0685); add(0.0684, 0.0722); add(0.0694, 0.0758); add(0.0722, 0.0782);
    add(0.0738, 0.0795); add(0.0738, 0.0865); add(0.0738, 0.0935);
    add(0.0722, 0.0948); add(0.0690, 0.0962);
    add(0.0640, 0.0995); add(0.0575, 0.1035); add(0.0515, 0.1075); add(0.0478, 0.1115); add(0.0466, 0.1145);
    bead(0.0466, 0.1192, 0.0045, 5);
    add(0.0462, 0.1250);
    const { bulb0: y0, H, Rm, tEnd } = GIB;
    for (let i = 1; i <= nb; i++) {
      const t = (i / nb) * tEnd; let f;
      if (t < 0.3) f = 0.535 + 0.465 * Math.pow(Math.sin((t / 0.3) * Math.PI / 2), 0.85);
      else { const q = (t - 0.3) / 0.7; f = Math.pow(1 - q, 1.55) * (1 + 1.55 * q); }
      add(Rm * f, y0 + H * t);
    }
    const yb = y0 + H * tEnd;
    bead(0.0052, yb + 0.0035, 0.0022, 4);
    add(0.0040, yb + 0.0095); add(0.0026, yb + 0.016); add(0.0013, yb + 0.023); add(0.0001, yb + 0.03);
    return P;
  }
  const GP_HI = giboshiProfileHi(40);
  const bulbR = (y) => {
    for (let j = 1; j < GP_HI.length; j++) if (GP_HI[j][1] >= y) { const [r0, y0] = GP_HI[j - 1], [r1, y1] = GP_HI[j]; return r0 + (r1 - r0) * (y - y0) / Math.max(y1 - y0, 1e-6); }
    return 0;
  };
  // the giboshi parts as geometries (uv + colour baked), detail level hero / standard
  function giboshiParts(hero) {
    const out = [];
    const prof = hero ? GP_HI : giboshiProfileHi(26);
    const cav = prof.map(([r, y], j) => {
      let s = 0, w = 0;
      for (let k = 0; k < prof.length; k++) { const dy = Math.abs(prof[k][1] - y); if (k === j || dy > 0.006) continue; const wt = 1 - dy / 0.006; s += wt * prof[k][0]; w += wt; }
      return w ? clamp(0.5 + (s / w - r) / 0.004, 0, 1) : 0.5;
    });
    const segs = hero ? 72 : 40;
    const lat = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs);
    {
      const n = prof.length, uv = lat.attributes.uv, cnt = uv.count, col = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) { const j = i % n; uv.setXY(i, Math.floor(i / n) / segs, prof[j][1]); col[i * 3] = 1; col[i * 3 + 1] = cav[j]; col[i * 3 + 2] = 0; }
      lat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    out.push(lat);
    // lotus collar: 8 broad front petals over 8 narrower ones set between them
    const petal = (phi, ya, yb2, wAng, thick, flare, rOff, nu, nv) => {
      const pos = [], uvA = [], colA = [], idx = [];
      const surf = (outer) => {
        const base = pos.length / 3;
        for (let i = 0; i <= nu; i++) {
          const u = i / nu, y = ya + (yb2 - ya) * u;
          const w = Math.pow(Math.sin(Math.PI * Math.pow(Math.max(u, 0.0), 0.72)), 0.6);
          for (let j = 0; j <= nv; j++) {
            const v = (j / nv) * 2 - 1;
            const a = phi + v * Math.max(w, 0.04) * wAng;
            const lift = flare * Math.pow(u, 2.4) * (1 - 0.6 * v * v);
            const th = outer ? thick * (1 - v * v) * (1 - 0.5 * u) + 0.0011 * Math.pow(1 - Math.abs(v), 8) * (1 - u * 0.7) : 0;
            const r = Math.max(bulbR(y), 0.0512) + rOff + lift + th;
            pos.push(r * Math.sin(a), y + lift * 0.35, r * Math.cos(a));
            uvA.push(v, u);
            const c = outer ? clamp(0.5 - 0.3 * Math.pow(1 - Math.abs(v), 6) + 0.45 * Math.pow(1 - u, 3), 0, 1) : 0.85;
            colA.push(3.0, c, 0);
          }
        }
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
          const a0 = base + i * (nv + 1) + j, a1 = a0 + 1, b0 = a0 + nv + 1, b1 = b0 + 1;
          if (outer) idx.push(a0, a1, b1, a0, b1, b0); else idx.push(a0, b1, a1, a0, b0, b1);
        }
      };
      surf(true); surf(false);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
      g.setIndex(idx); g.computeVertexNormals();
      // make sure the outer face points away from the axis
      const p = g.attributes.position, nn = g.attributes.normal; const mid = Math.floor((nu / 2) * (nv + 1) + nv / 2);
      if (p.getX(mid) * nn.getX(mid) + p.getZ(mid) * nn.getZ(mid) < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
      return g;
    };
    const nu = hero ? 12 : 6, nv = hero ? 8 : 4;
    for (let k = 0; k < 8; k++) {
      out.push(petal((k + 0.5) * Math.PI / 4, 0.1205, 0.1685, 0.25, 0.0016, 0.0035, 0.0003, nu, nv));
      out.push(petal(k * Math.PI / 4, 0.1195, 0.1645, 0.36, 0.0034, 0.0065, 0.0027, nu, nv));
    }
    // ring of hemispherical studs on the seat band (patina collects round their feet)
    const nS = hero ? 28 : 20;
    const st = new THREE.SphereGeometry(0.0034, hero ? 10 : 6, hero ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2);
    st.rotateX(Math.PI / 2); // dome toward +z
    {
      const p = st.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { col[i * 3] = 1; col[i * 3 + 1] = 0.75 - 0.5 * clamp(p.getZ(i) / 0.0034, 0, 1); }
      st.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    for (let k = 0; k < nS; k++) {
      const a = (k / nS) * Math.PI * 2;
      const g = st.clone(); g.applyMatrix4(mat4([0.0738 * Math.sin(a), 0.0865, 0.0738 * Math.cos(a)], [0, a, 0]));
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, a / (Math.PI * 2), 0.2); // outside the chased bands
      out.push(g);
    }
    return out;
  }
  const GIB_HERO = giboshiParts(true), GIB_STD = giboshiParts(false);

  function addPostTop(x, yTop, z, w, scale, hero = false) {
    // gold sleeve, rims, cap plate, pendants, giboshi
    const s = w / PW;
    addGold(rbox(w + 0.012, 0.115 * s, w + 0.012, 0.004), mat4([x, yTop - 0.0575 * s, z]), 0.95, 2.12);
    addGold(rbox(w + 0.026, 0.02 * s, w + 0.026, 0.006, 1), mat4([x, yTop - 0.112 * s, z]), 1, 0.04);
    addGold(rbox(w + 0.022, 0.014 * s, w + 0.022, 0.005, 1), mat4([x, yTop - 0.004 * s, z]), 1, 0.04);
    addGold(rbox(w + 0.034, 0.016 * s, w + 0.034, 0.006, 1), mat4([x, yTop + 0.008 * s, z]), 1, 0.04);
    const pend = pendantPlate(w * 0.62, 0.1 * s);
    for (let k = 0; k < 4; k++) {
      const ry = k * Math.PI / 2; const off = w / 2 + 0.0005;
      const px = x + Math.sin(ry) * off, pz = z + Math.cos(ry) * off;
      for (const [g, mt] of pend) addGold(g, mat4([px, yTop - 0.121 * s, pz], [0, ry, 0]), mt ? 0.88 : 1, mt);
    }
    // lozenge on the sleeve faces
    const loz = lozengePlate(w * 0.5, 0.075 * s, 0.003, true);
    for (let k = 0; k < 4; k++) {
      const ry = k * Math.PI / 2; const off = w / 2 + 0.0065;
      // dark lacquer inlay diamond with a gilt boss
      for (const [g, mt] of loz) { const M4 = mat4([x + Math.sin(ry) * off, yTop - 0.058 * s, z + Math.cos(ry) * off], [0, ry, 0]); if (mt) addDark(g, M4); else addGold(g, M4); }
      // domed rivets pinning the sleeve at its upper and lower margins
      for (const yy of [-0.017, -0.099]) for (const tt of [-0.36, 0.36]) {
        const M4 = mat4([x + Math.sin(ry) * (w / 2 + 0.006) + Math.cos(ry) * tt * w, yTop + yy * s, z + Math.cos(ry) * (w / 2 + 0.006) - Math.sin(ry) * tt * w], [0, ry, 0]);
        addGold(hero ? RIVET_HI : RIVET, M4, 1.0, 0.0);
      }
    }
    const M = mat4([x, yTop + 0.016 * s, z], [0, rnd.next() * 6.28, 0], scale);
    for (const g of (hero ? GIB_HERO : GIB_STD)) B.add(g, gib, M);
  }

  // ---------------------------------------------------------------- DECK planks
  {
    const L2 = 2 * thE * RA;
    const count = Math.round(L2 / 0.245);
    PLANK_PITCH = L2 / count; PLANK_S0 = -L2 / 2;
    plankUniforms.uPlank.value.set(PLANK_S0, PLANK_PITCH);
    const pw = BAND.u0 * 2 + 0.01;
    for (let i = 0; i < count; i++) {
      const s = PLANK_S0 + (i + 0.5) * PLANK_PITCH;
      const th = s / RA;
      const gap = 0.008 + rnd.next() * 0.006;
      const wdt = PLANK_PITCH - gap;
      const t = 0.058 + rnd.next() * 0.006;
      const lift = (rnd.next() - 0.5) * 0.005;
      const c = ptTh(th, -t / 2 + lift, X0 + (rnd.next() - 0.5) * 0.01);
      const pwi = pw - rnd.next() * 0.02;
      const rx = th + (rnd.next() - 0.5) * 0.006, rz = (rnd.next() - 0.5) * 0.004;
      if (rnd.next() < 0.72) {
        // two boards: butt joint off-centre (staggered from plank to plank), each with its own lift/tone
        const jx = (rnd.next() - 0.5) * 1.5, jg = 0.0025 + rnd.next() * 0.002;
        const la = pwi / 2 + jx - jg / 2, lb = pwi / 2 - jx - jg / 2;
        for (const [len, cx, b] of [[la, -pwi / 2 + la / 2, 0], [lb, pwi / 2 - lb / 2, 1]]) {
          const g = rbox(len, t, wdt, 0.009, 2);
          paint(g, rnd.next(), rnd.next(), b);
          const dl = (rnd.next() - 0.5) * 0.004;
          const cc = ptTh(th, -t / 2 + lift + dl, c.x + cx);
          B.add(g, wood, mat4([cc.x, cc.y, cc.z], [rx + (rnd.next() - 0.5) * 0.003, 0, rz + (rnd.next() - 0.5) * 0.006]));
        }
      } else {
        const g = rbox(pwi, t, wdt, 0.009, 2);
        paint(g, rnd.next(), rnd.next(), 0.5);
        B.add(g, wood, mat4([c.x, c.y, c.z], [rx, 0, rz]));
      }
    }
  }

  // ---------------------------------------------------------------- fallen maple leaves + a few cherry petals
  // drifted against the railing sills and into the board joints (wind from the west piles them on the east side)
  {
    const leafMat = mat.std({ color: 0xffffff, roughness: 0.62, metalness: 0, vertexColors: true, side: THREE.DoubleSide }, {
      fragHead: 'float g_h;',
      fragColor: /* glsl */ `
        {
          vec3 wp = vWPos;
          float n = n_fbm3(wp * 40.0, 2) * (1.0 - smoothstep(0.002, 0.006, length(fwidth(wp))));
          diffuseColor.rgb = diffuse * vColor.rgb * (0.85 + 0.25 * n);
          g_h = n;
        }
      `,
      fragNormal: /* glsl */ `normal = n_bumpView(-vViewPosition, normal, g_h, 0.0006);`,
    });
    leafMat.name = 'bridgeLeaves';
    const leafGeo = (R, lobes, curl, petal) => {
      const N = petal ? 10 : 28; const pos = [0, curl * 0.6, 0], idx = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        let r;
        if (petal) r = R * (0.75 + 0.25 * Math.cos(a)) * (1 - 0.35 * Math.pow(Math.max(Math.cos(a), 0), 30)); // notched tip
        else { const k = Math.abs(Math.cos(a * lobes / 2)); r = R * (0.42 + 0.58 * Math.pow(k, 0.45)) * (a > Math.PI * 0.82 && a < Math.PI * 1.18 ? 0.55 : 1); }
        pos.push(r * Math.cos(a), curl * Math.pow(r / R, 2) * (0.6 + 0.4 * Math.sin(a * 2)), r * Math.sin(a));
        idx.push(0, 1 + ((i + 1) % N), 1 + i);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const lr = ctx.rng('bridgeLeaves');
    const pals = [[0.42, 0.045, 0.02], [0.5, 0.12, 0.02], [0.33, 0.06, 0.03], [0.55, 0.26, 0.04], [0.2, 0.09, 0.035], [0.16, 0.11, 0.05]];
    const L2 = 2 * thE * RA;
    for (let i = 0; i < 170; i++) {
      const petal = i % 5 === 4;
      const s = (lr.next() - 0.5) * (L2 - 0.4);
      const th = s / RA;
      // mostly against the sills (east side heavier), some scattered across the boards
      const side = lr.next() < 0.68 ? 1 : -1;
      const u = lr.next() < 0.75 ? side * (HW - 0.32 - Math.pow(lr.next(), 2) * 0.55) : (lr.next() - 0.5) * 2.4;
      const R = petal ? 0.011 + lr.next() * 0.004 : 0.03 + lr.next() * 0.025;
      const g = leafGeo(R, 5 + (lr.next() < 0.5 ? 2 : 0), (lr.next() - 0.3) * R * 0.5, petal);
      g.rotateY(lr.next() * Math.PI * 2);
      const c0 = petal ? [0.78, 0.5, 0.52] : pals[Math.floor(lr.next() * pals.length)];
      const k = 0.8 + lr.next() * 0.35;
      paint(g, c0[0] * k, c0[1] * k, c0[2] * k);
      const c = ptTh(th, 0.003 + lr.next() * 0.003, X0 + u);
      B.add(g, leafMat, mat4([c.x, c.y, c.z], [th + (lr.next() - 0.5) * 0.12, 0, (lr.next() - 0.5) * 0.12]));
    }
  }

  // ---------------------------------------------------------------- FASCIA arch boards + dark band
  {
    const thF = thE + 0.035;
    const n = 260;
    const top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const th = -thF + (2 * thF * i) / n;
      const p = ptTh(th, FT);
      top.push(p);
    }
    for (let i = 0; i <= n; i++) {
      const p = top[i];
      const d = fasciaDepth(p.z);
      // bottom: vertical drop from the top edge (keeps the face crisp & monotonic)
      bot.push(new THREE.Vector3(p.x, p.y - d, p.z));
    }
    const shape = new THREE.Shape();
    shape.moveTo(top[0].z, top[0].y);
    for (let i = 1; i <= n; i++) shape.lineTo(top[i].z, top[i].y);
    for (let i = n; i >= 0; i--) shape.lineTo(bot[i].z, bot[i].y);
    shape.closePath();
    const th = 0.22, bv = 0.014;
    const fg = new THREE.ExtrudeGeometry(shape, { depth: th - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv, bevelSegments: 2, curveSegments: 1, steps: 1 });
    fg.translate(0, 0, bv); // z: 0..th
    for (const side of [-1, 1]) {
      // rotate so shape x -> world z, shape y -> world y, extrude z -> world -x
      const xOuter = X0 + side * HW;
      const m = side > 0 ? mat4([xOuter, 0, 0], [0, -Math.PI / 2, 0]) : mat4([xOuter + th, 0, 0], [0, -Math.PI / 2, 0]);
      addLac(fg, MODE_ARC, 0.05, m);
    }
    // dark capping band
    const bandProf = rrect(BAND.u1 - BAND.u0, BAND.v1 - BAND.v0, 0.012, 3);
    for (const side of [-1, 1]) {
      const uc = side * (BAND.u0 + BAND.u1) / 2;
      const pts = arcPts((BAND.v0 + BAND.v1) / 2, zEndN - 0.02, zEndS + 0.02, X0 + uc, 0.08);
      addDark(sweep(pts, bandProf));
    }
  }

  // ---------------------------------------------------------------- substructure: inner girders, floor beams
  {
    const prof = rrect(0.18, -GIRDER_BOT - 0.06, 0.02, 2);
    const vc = (GIRDER_BOT - 0.06) / 2;
    for (const gx of GIRDER_X) {
      const pts = arcPts(vc, faceN - 0.6, faceS + 0.6, X0 + gx, 0.15);
      addLac(sweep(pts, prof), MODE_ARC, 0.45);
    }
    // floor beams under the planks
    const n = Math.round((thAtZ(faceS) - thAtZ(faceN)) * RA / 1.05);
    const t0 = thAtZ(faceN) + 0.02, t1 = thAtZ(faceS) - 0.02;
    for (let i = 0; i <= n; i++) {
      const th = t0 + ((t1 - t0) * i) / n;
      const c = ptTh(th, -0.06 - 0.075);
      addLac(rbox(2 * (HW - 0.22) + 0.02, 0.15, 0.12, 0.012, 1), MODE_X, 0.5, mat4([c.x, c.y, c.z], [th, 0, 0]));
    }
  }

  // ---------------------------------------------------------------- BENTS: granite piers + vermilion cap beams
  const bentZ = [ZC - 3.4, ZC + 3.4];
  for (const zb of bentZ) {
    const fb = (z) => yAt(z, FT) - fasciaDepth(z);
    const capTop = Math.max(fb(zb - 0.2), fb(zb + 0.2), yAt(zb, GIRDER_BOT) + 0.005, yAt(zb - 0.2, GIRDER_BOT), yAt(zb + 0.2, GIRDER_BOT));
    const capH = 0.30, capD = 0.36, capL = 2 * HW + 0.84;
    const capY = capTop - capH / 2;
    addLac(rbox(capL, capH, capD, 0.025, 2), MODE_X, 0.35, mat4([X0, capY, zb]));
    // gilt end caps on the cap beam
    for (const side of [-1, 1]) {
      const xe = X0 + side * (capL / 2);
      addGold(rbox(0.07, capH + 0.012, capD + 0.012, 0.006), mat4([xe - side * 0.03, capY, zb]), 0.9, 2.06);
      addGold(rbox(0.018, capH + 0.026, capD + 0.026, 0.006, 1), mat4([xe - side * 0.058, capY, zb]), 1, 0.02);
      for (const [g, kind, mt] of endFitting(capD + 0.012, capH + 0.012)) {
        const M4 = mat4([xe + side * 0.0045, capY, zb], [0, side * Math.PI / 2, 0]);
        if (kind === 'dark') addDark(g, M4); else addGold(g, M4, 1, mt);
      }
    }
    // granite capitals, pillars of stacked rough ashlar, stepped footings
    const capitalH = 0.22, capitalW = 0.78;
    const pillarTop = capTop - capH - capitalH;
    const footTop = WATER + 0.13;
    for (const side of [-1, 1]) {
      const px = X0 + side * 1.62;
      const sr = ctx.rng('pier' + zb.toFixed(1) + side);
      addStone(stoneBlock(capitalW, capitalH, capitalW, 0.03, 0.007, 0.1, zb + side, 0.004), mat4([px, pillarTop + capitalH / 2, zb], [0, (sr.next() - 0.5) * 0.03, 0]), 0.95);
      // course heights
      const H = pillarTop - footTop;
      const hs = []; let acc = 0;
      while (acc < H - 0.2) { const h = 0.3 + sr.next() * 0.2; hs.push(h); acc += h; }
      const kS = H / acc;
      let y = footTop;
      hs.forEach((h0, k) => {
        const h = h0 * kS;
        const W = 0.58, j = 0.012;
        const cx = px + (sr.next() - 0.5) * 0.025, cz = zb + (sr.next() - 0.5) * 0.025, ry = (sr.next() - 0.5) * 0.025;
        const split = sr.next() < 0.55;
        if (!split) {
          addStone(stoneBlock(W + (sr.next() - 0.5) * 0.03, h - j, W + (sr.next() - 0.5) * 0.03, 0.018, 0.01, 0.08, sr.next() * 50, 0.012), mat4([cx, y + h / 2, cz], [0, ry, 0]), 0.8 + sr.next() * 0.25);
        } else {
          const f = 0.38 + sr.next() * 0.24; const alongX = k % 2 === 0;
          const a = W * f, b = W * (1 - f);
          for (const [len, off] of [[a, -W / 2 + a / 2], [b, W / 2 - b / 2]]) {
            const g = alongX ? stoneBlock(len - j, h - j, W, 0.018, 0.01, 0.08, sr.next() * 50, 0.011) : stoneBlock(W, h - j, len - j, 0.018, 0.01, 0.08, sr.next() * 50, 0.011);
            addStone(g, mat4([cx + (alongX ? off : 0), y + h / 2, cz + (alongX ? 0 : off)], [0, ry, 0]), 0.78 + sr.next() * 0.28);
          }
        }
        y += h;
      });
      // wedge (kusabi) driven through the tie just outside the pillar
      {
        const ny = footTop + (pillarTop - footTop) * 0.56;
        addLac(rbox(0.05, 0.36, 0.075, 0.008, 1), MODE_VERT, 0.6, mat4([px + side * 0.345, ny + 0.02, zb]));
      }
      // footings (two steps), from below the pond floor to just above the water
      const f1Top = WATER - 0.22;
      addStone(stoneBlock(1.1, f1Top - (BOTTOM - 0.5), 1.1, 0.05, 0.016, 0.14, zb * 2 + side, 0.006), mat4([px, (f1Top + BOTTOM - 0.5) / 2, zb], [0, (sr.next() - 0.5) * 0.06, 0]), 0.85);
      addStone(stoneBlock(0.84, footTop - f1Top + 0.01, 0.84, 0.045, 0.012, 0.1, zb * 3 + side, 0.006), mat4([px, (footTop + f1Top) / 2, zb], [0, (sr.next() - 0.5) * 0.05, 0]), 0.88);
    }
    // vermilion through-tie (nuki) binding the pillar pair, gilt end caps
    {
      const ny = footTop + (pillarTop - footTop) * 0.56;
      const nL = 2 * (1.62 + 0.29 + 0.17);
      addLac(rbox(nL, 0.22, 0.13, 0.015, 2), MODE_X, 0.45, mat4([X0, ny, zb]));
      for (const side of [-1, 1]) {
        const xe = X0 + side * nL / 2;
        addGold(rbox(0.05, 0.232, 0.142, 0.005), mat4([xe - side * 0.02, ny, zb]), 0.9, 0.06);
        for (const [g, kind, mt] of endFitting(0.142, 0.232)) {
          const M4 = mat4([xe + side * 0.0055, ny, zb], [0, side * Math.PI / 2, 0]);
          if (kind === 'dark') addDark(g, M4); else addGold(g, M4, 1, mt);
        }
      }
    }
  }

  // ---------------------------------------------------------------- ABUTMENTS + landing slabs
  function abutment(face, end, dir) {
    // dir = -1 for the north abutment (land toward -z), +1 south
    const zOut = end + dir * 1.9;               // land-side end
    const zIn = face;                           // pond face
    const z0 = Math.min(zIn, zOut), z1 = Math.max(zIn, zOut);
    const xa = X0 - 2.45, xb = X0 + 2.45;
    const yb = BOTTOM - 0.45, yt = ABUT_TOP;
    const H = yt - 0.2 - yb; // walls stop under the coping course
    const nC = Math.max(3, Math.round(H / 0.4));
    const ch = H / nC;
    const r = ctx.rng('abut' + dir);
    const depth = 0.55;
    const wall = (along0, along1, perp, out, axis) => {
      for (let k = 0; k < nC; k++) {
        let a = along0 + (k % 2 ? 0.35 : 0) * 0;
        let first = true;
        const y = yb + ch * (k + 0.5);
        while (a < along1 - 0.05) {
          let len = first && k % 2 ? 0.45 + r.next() * 0.3 : 0.75 + r.next() * 0.55;
          first = false;
          if (along1 - (a + len) < 0.35) len = along1 - a;
          const c = a + len / 2;
          // cull blocks that can never be seen: below the pond floor, or buried in the bank
          const ox = axis === 'x' ? c : perp + out * 0.35, oz = axis === 'x' ? perp + out * 0.35 : c;
          const yTopB = y + ch / 2;
          let floorHere = BOTTOM;
          if (pondSite && pondSite.floorY) { try { floorHere = pondSite.floorY(ox, oz); } catch (e) { /* keep */ } }
          const wet = inWater(ox, oz) || inWater(ox + 0.4, oz) || inWater(ox - 0.4, oz) || inWater(ox, oz + 0.4) || inWater(ox, oz - 0.4);
          if (yTopB < floorHere - 0.03 || (!wet && yTopB < Y0 - 0.25)) { a += len; continue; }
          const g = axis === 'x'
            ? stoneBlock(len - 0.014, ch - 0.014, depth, 0.035, 0.014, 0.22, r.next() * 100, 0.022)
            : stoneBlock(depth, ch - 0.014, len - 0.014, 0.035, 0.014, 0.22, r.next() * 100, 0.022);
          const pz = perp - out * depth / 2;
          const m = axis === 'x' ? mat4([c, y, pz]) : mat4([pz, y, c]);
          addStone(g, m, 0.95 + r.next() * 0.1);
          a += len;
        }
      }
    };
    // pond face (normal along -dir in z), side walls (normals +-x)
    wall(xa, xb, zIn, -dir, 'x');
    wall(z0 + (dir > 0 ? depth : 0), z1 - (dir < 0 ? depth : 0), xb, +1, 'z');
    wall(z0 + (dir > 0 ? depth : 0), z1 - (dir < 0 ? depth : 0), xa, -1, 'z');
    // coping slabs over the top
    const nS = Math.max(2, Math.round((z1 - z0) / 1.0));
    for (let i = 0; i < nS; i++) {
      const za = z0 + ((z1 - z0) * i) / nS, zb2 = z0 + ((z1 - z0) * (i + 1)) / nS;
      addStone(stoneBlock(xb - xa + 0.08, 0.2, zb2 - za - 0.012, 0.03, 0.006, 0.2, za * 7), mat4([X0, yt - 0.1 + 0.001, (za + zb2) / 2]), 1.06);
    }
    // landing slabs beyond the deck end (top at LAND_TOP)
    const lz0 = Math.min(end, end + dir * 1.9), lz1 = Math.max(end, end + dir * 1.9);
    const slabT = LAND_TOP - yt;
    for (let i = 0; i < 2; i++) {
      const za = lz0 + ((lz1 - lz0) * i) / 2, zb2 = lz0 + ((lz1 - lz0) * (i + 1)) / 2;
      addStone(stoneBlock(2 * HW + 0.9, slabT, zb2 - za - 0.012, 0.03, 0.004, 0.2, za * 13 + 5), mat4([X0, yt + slabT / 2, (za + zb2) / 2]), 1.1);
    }
  }
  abutment(faceN, zEndN, -1);
  abutment(faceS, zEndS, +1);

  // ---------------------------------------------------------------- RAILINGS
  const arcLenDeck = 2 * thE * RA;
  const nPosts = Math.max(BR.posts || 9, Math.round(arcLenDeck / 2.3) + 1);
  const endOut = 0.24; // end posts stand on the landing, beyond the deck end
  const zPostN = zEndN - endOut, zPostS = zEndS + endOut;
  const postZ = [zPostN];
  for (let k = 1; k < nPosts - 1; k++) { const th = -thE + (2 * thE * k) / (nPosts - 1); postZ.push(ZC + RA * Math.sin(th)); }
  postZ.push(zPostS);

  for (const side of [-1, 1]) {
    const xr = X0 + side * XR;
    // base sill (jifuku)
    addLac(sweep(arcPts((SILL.v0 + SILL.v1) / 2, zPostN, zPostS, xr, 0.08), rrect(SILL.w, SILL.v1 - SILL.v0, 0.016, 3)), MODE_ARC, 0.15, null, 1);
    // mid rail (hira-nuki)
    addLac(sweep(arcPts((MID.v0 + MID.v1) / 2, zPostN, zPostS, xr, 0.08), rrect(MID.w, MID.v1 - MID.v0, 0.012, 3)), MODE_ARC, 0.05, null, 1);
    // top rail (hoko-gi) with curled ends + gilt end ferrules
    {
      const main = arcPts(TOP.v, zPostN, zPostS, xr, 0.06);
      // beyond the end posts the rail runs on and sweeps up to level (sori), ending in a gilt cap
      const curl = (pts, atStart) => {
        const n = pts.length; const p = (atStart ? pts[0] : pts[n - 1]).clone();
        const q = atStart ? pts[1] : pts[n - 2];
        const d = p.clone().sub(q).normalize(); // outward
        const out = [];
        const sgnZ = Math.sign(d.z);
        const turn = Math.asin(clamp(-d.y, -1, 1)) + 0.1; // rotate until slightly rising
        const N = 9;
        for (let k = 1; k <= N; k++) {
          const a = k <= 2 ? 0 : turn / (N - 2);
          const dz = d.z, dy = d.y;
          const ca = Math.cos(a), sa = Math.sin(a);
          if (sgnZ > 0) { d.z = dz * ca - dy * sa; d.y = dz * sa + dy * ca; } else { d.z = dz * ca + dy * sa; d.y = -dz * sa + dy * ca; }
          p.addScaledVector(d, 0.034);
          out.push(p.clone());
        }
        return out;
      };
      const cN = curl(main, true).reverse(), cS = curl(main, false);
      const pts = [...cN, ...main, ...cS];
      addLac(sweep(pts, ellipse(TOP.a, TOP.b, 24)), MODE_ARC, 0.0, null, 1);
      // gilt end caps: sleeve with a raised rim + domed end
      const capProf = ellipse(TOP.a + 0.006, TOP.b + 0.006, 24);
      const rimProf = ellipse(TOP.a + 0.011, TOP.b + 0.011, 24);
      const endCap = (tip) => {
        addGold(sweep(tip.slice(-3), capProf, true, false), null, 1, 0.08);
        const r0 = tip[tip.length - 3], r1 = tip[tip.length - 2];
        addGold(sweep([r0, r0.clone().lerp(r1, 0.35)], rimProf, true, true), null, 1, 0.02);
        const p = tip[tip.length - 1], T = p.clone().sub(tip[tip.length - 2]).normalize();
        const Sx = new THREE.Vector3(1, 0, 0), Nn = new THREE.Vector3(0, -T.z, T.y);
        const dome = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
        const m = new THREE.Matrix4().makeBasis(Sx, T, Nn).scale(new THREE.Vector3(TOP.a + 0.006, 0.022, TOP.b + 0.006)).setPosition(p);
        addGold(dome, m, 1, 0.02);
        const knob = new THREE.SphereGeometry(0.009, 12, 8);
        addGold(knob, new THREE.Matrix4().makeTranslation(p.x + T.x * 0.02, p.y + T.y * 0.02, p.z + T.z * 0.02), 1, 0);
      };
      endCap(cN.slice().reverse());
      endCap(cS);
      // gilt ferrules where the top rail enters each post
      for (let k = 0; k < postZ.length; k++) {
        const zp = postZ[k]; const w = (k === 0 || k === postZ.length - 1) ? EPW : PW;
        for (const s2 of [-1, 1]) {
          if ((k === 0 && s2 < 0) || (k === postZ.length - 1 && s2 > 0)) continue;
          const za = zp + s2 * (w / 2 - 0.005), zb2 = zp + s2 * (w / 2 + 0.032);
          addGold(sweep(arcPts(TOP.v, Math.min(za, zb2), Math.max(za, zb2), xr, 0.01), ellipse(TOP.a + 0.006, TOP.b + 0.006, 24)), null, 1, 2.08);
          // raised rim at the ferrule mouth + a domed nail on its crown
          const zr0 = zp + s2 * (w / 2 + 0.024), zr1 = zp + s2 * (w / 2 + 0.034);
          addGold(sweep(arcPts(TOP.v, Math.min(zr0, zr1), Math.max(zr0, zr1), xr, 0.005), ellipse(TOP.a + 0.0105, TOP.b + 0.0105, 24)), null, 1, 0.02);
          const zn = zp + s2 * (w / 2 + 0.013), thn = thAtZ(zn, TOP.v + TOP.b + 0.006);
          const cn = ptTh(thn, TOP.v + TOP.b + 0.005, xr);
          addGold(RIVET, mat4([cn.x, cn.y, cn.z], [thn - Math.PI / 2, 0, 0]), 1, 0);
        }
      }
    }
    // posts
    for (let k = 0; k < postZ.length; k++) {
      const zp = postZ[k];
      const isEnd = k === 0 || k === postZ.length - 1;
      const w = isEnd ? EPW : PW;
      const railY = yAt(zp, TOP.v);
      const yTop = railY + (isEnd ? 0.27 : 0.2);
      const yBot = isEnd ? LAND_TOP + 0.17 : yAt(zp, BAND.v0) + 0.01;
      addLac(rbox(w, yTop - yBot, w, 0.014, 2), MODE_VERT, 0.0, mat4([xr, (yTop + yBot) / 2, zp]), 1);
      addPostTop(xr, yTop, zp, w, isEnd ? 1.32 : 1.0, side < 0 && k >= 3 && k <= 5);
      // lozenge plates on outer + inner faces between the rails
      const yl = (yAt(zp, MID.v1) + yAt(zp, TOP.v - TOP.b)) / 2;
      const loz = lozengePlate(w * 0.62, 0.15, 0.004, true);
      for (const fs of [-1, 1]) for (const [g, mt] of loz) addGold(g, mat4([xr + fs * (w / 2 + 0.0005), yl, zp], [0, fs * Math.PI / 2, 0]), mt ? 0.88 : 1, mt);
      // gilt band where the mid rail meets the post
      const ym = yAt(zp, (MID.v0 + MID.v1) / 2);
      for (const fs of [-1, 1]) for (const [g, mt] of squarePlate(w * 0.8, 0.17, 0.004)) addGold(g, mat4([xr + fs * (w / 2 + 0.0005), ym, zp], [0, fs * Math.PI / 2, 0]), mt ? 0.85 : 1, mt);
      if (isEnd) {
        // granite base + gilt foot band
        addStone(stoneBlock(0.42, 0.18, 0.42, 0.03, 0.004, 0.08, zp + side), mat4([xr, LAND_TOP + 0.09, zp]), 1.1);
        addGold(rbox(w + 0.02, 0.09, w + 0.02, 0.006), mat4([xr, yBot + 0.045, zp]), 1, 2.05);
        addGold(rbox(w + 0.03, 0.016, w + 0.03, 0.006), mat4([xr, yBot + 0.094, zp]));
      } else {
        // gilt foot band where the post rises through the sill
        const ys = yAt(zp, SILL.v1);
        addGold(rbox(w + 0.014, 0.04, w + 0.014, 0.005, 1), mat4([xr, ys + 0.02, zp]), 0.95, 2.1);
        addGold(rbox(w + 0.022, 0.009, w + 0.022, 0.004, 1), mat4([xr, ys + 0.043, zp]), 1, 0.02);
        // square fitting on the dark band below the post
        const th = thAtZ(zp, -0.065);
        const c = ptTh(th, -0.065, X0 + side * (BAND.u1 + 0.0005));
        for (const [g, mt] of squarePlate(0.15, 0.1, 0.005)) addGold(g, mat4([c.x, c.y, c.z], [0, side * Math.PI / 2, side * th]), mt ? 0.85 : 1, mt);
      }
    }
    // struts (tsuka) between posts, lower and upper rows, plus nail heads on the mid rail
    for (let k = 0; k < postZ.length - 1; k++) {
      const za = postZ[k], zb2 = postZ[k + 1];
      const ta = thAtZ(za), tb = thAtZ(zb2);
      const gapLen = (tb - ta) * RA;
      const m = Math.max(1, Math.round(gapLen / 0.6) - 1);
      for (let j = 1; j <= m; j++) {
        const th = ta + ((tb - ta) * j) / (m + 1);
        const z = ZC + RA * Math.sin(th);
        const lb = yAt(z, SILL.v1) - 0.015, lt = yAt(z, MID.v0) + 0.015;
        const ub = yAt(z, MID.v1) - 0.015, ut = yAt(z, TOP.v - TOP.b * 0.5);
        addLac(rbox(0.062, lt - lb, 0.062, 0.008, 1), MODE_VERT, 0.05, mat4([xr, (lb + lt) / 2, z]), 1);
        addLac(rbox(0.062, ut - ub, 0.062, 0.008, 1), MODE_VERT, 0.0, mat4([xr, (ub + ut) / 2, z]), 1);
        // nail heads + gilt washers on both faces of the mid rail
        const ym = yAt(z, (MID.v0 + MID.v1) / 2);
        for (const fs of [-1, 1]) {
          const fx = xr + fs * (MID.w / 2);
          const wsh = new THREE.CylinderGeometry(0.027, 0.028, 0.004, 14); wsh.rotateZ(Math.PI / 2);
          addGold(wsh, mat4([fx + fs * 0.002, ym, z]));
          const hd = new THREE.SphereGeometry(0.017, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2); hd.rotateZ(-fs * Math.PI / 2);
          addDark(hd, mat4([fx + fs * 0.004, ym, z]));
        }
        // small gilt stud on the band face
        const tb2 = thAtZ(z, -0.065);
        const c = ptTh(tb2, -0.065, X0 + side * (BAND.u1 + 0.001));
        const st = new THREE.SphereGeometry(0.014, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2); st.rotateZ(-side * Math.PI / 2); st.scale(0.7, 1, 1);
        addGold(st, mat4([c.x, c.y, c.z]));
        // gilt collars binding the struts to the rails
        for (const [yb0, yt0] of [[lb, lt], [ub, ut]]) {
          addGold(TSUKA_BAND, mat4([xr, yb0 + 0.012, z]), 0.92, 2.1);
          addGold(TSUKA_BAND, mat4([xr, yt0 - 0.012, z]), 0.92, 2.1);
        }
      }
    }
    // forged iron nail heads in two rows along the black capping band (clear of the gilt fittings)
    for (let th = -thE + 0.02; th < thE - 0.02; th += 0.22 / RA) {
      const z = ZC + RA * Math.sin(th);
      if (postZ.some((zp) => Math.abs(zp - z) < 0.11)) continue;
      for (const v of [-0.024, -0.106]) {
        const c = ptTh(th, v, X0 + side * (BAND.u1 + 0.0004));
        addDark(RIVET, mat4([c.x, c.y, c.z], [0, side * Math.PI / 2, 0]));
      }
    }
  }

  // ---------------------------------------------------------------- large ornaments on the fascia faces
  {
    const orn = ornamentParts(1.22);
    const ornS = ornamentParts(1.12);
    const spots = [[0, orn], [0.245, ornS], [-0.245, ornS]];
    for (const side of [-1, 1]) {
      for (const [th, parts] of spots) {
        const zc = ZC + RA * Math.sin(th);
        if (zc < faceN + 0.6 || zc > faceS - 0.6) continue;
        const topY = yAt(zc, FT);
        const d = fasciaDepth(zc);
        const yc = topY - Math.min(d, 0.95) * 0.5;
        const x = X0 + side * (HW + 0.0005);
        for (const [g, matte] of parts) { const M4 = mat4([x, yc, zc], [0, side * Math.PI / 2, side * th]); if (matte < 0) addDark(g, M4); else addGold(g, M4, matte > 0.05 ? 0.78 : 1.0, matte); }
      }
    }
  }

  // ---------------------------------------------------------------- assemble
  const group = B.build({ name: 'bridge', castShadow: true, receiveShadow: true });
  group.name = 'bridge';
  {
    const parts = [];
    let total = 0;
    for (const m of group.children) { const t = m.geometry.attributes.position.count / 3; total += t; parts.push(`${m.material.name}:${Math.round(t / 1000)}k`); }
    console.log(`[world] bridge stats: ${group.children.length} meshes, ${Math.round(total / 1000)}k tris (${parts.join(' ')})`);
  }

  return {
    object: group,
    finalize: (c) => debugEnv(c),
    showcase: [
      { cam: [3, 0.3, 22.5], look: [10, 1.0, 17], focal: 30 },        // sunlit west face, piers + ties, lotus
      { cam: [11.15, 3.4, 22], look: [10.3, 4.2, -16], focal: 30 },   // on the deck walking north, giboshi at eye level
      { cam: [-2, 1.6, 24], look: [10, 1.2, 15], focal: 28 },         // classic side elevation over the lotus
      { cam: [2, 2.2, 30], look: [10, 1.3, 16], focal: 30 },          // elevated south-west 3/4
      { cam: [5.5, 0.1, 19], look: [8.2, 1.9, 16], focal: 40 },       // crown kazari-kanagu from water level
    ],
  };

  // debug context (only with ?bridgeDebug=1): pond hole in the fallback ground + water + floor
  function debugEnv(c) {
    let q = null; try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (!q || !q.has('bridgeDebug') || c.modules.pond || c.modules.terrain) return;
    const fb = c.scene.getObjectByName('fallbackGround');
    if (fb) fb.visible = false;
    const poly = (L.pond && L.pond.outline) || [[0, 7], [20, 7], [20, 33], [0, 33]];
    const sh = new THREE.Shape([new THREE.Vector2(-300, 300), new THREE.Vector2(300, 300), new THREE.Vector2(300, -300), new THREE.Vector2(-300, -300)]);
    const hole = new THREE.Path(); poly.forEach(([x, z], i) => (i ? hole.lineTo(x, -z) : hole.moveTo(x, -z))); hole.closePath();
    sh.holes.push(hole);
    const gg = new THREE.ShapeGeometry(sh); gg.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(gg, c.M.graniteMossy); ground.receiveShadow = true; c.scene.add(ground);
    const ws = new THREE.Shape(); poly.forEach(([x, z], i) => (i ? ws.lineTo(x, -z) : ws.moveTo(x, -z)));
    const wg = new THREE.ShapeGeometry(ws); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg.clone().translate(0, WATER, 0), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setRGB(0.006, 0.012, 0.011), roughness: 0.05, metalness: 0.0 }));
    water.receiveShadow = true; c.scene.add(water);
    const floor = new THREE.Mesh(wg.clone().translate(0, BOTTOM, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.05, 0.045, 0.03), roughness: 1 }));
    c.scene.add(floor);
  }
}
