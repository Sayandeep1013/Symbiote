// Shared by the main-thread mass driver and its worker (which must not import
// rig.js and its three.js scene objects).
const RES = 64;
const HALF = 2.0; // field covers [-HALF, HALF]^3 in creature space
const CELL = (2 * HALF) / RES;

export const MASS = {
  RES,
  HALF,
  // a kernel reaches SUPPORT * r, and ISO = (1 - (1/2)^2)^3 puts a lone
  // strand's surface at ~1.12 r: just outside its tube, so they never z-fight
  SUPPORT: 2.24,
  ISO: 0.4219,
  // thinner than about a cell can't be represented; leave that to the tubes
  R_MIN: CELL * 0.9,
  BODY_R: 0.8,
  // how far the body's fillet reaches out to meet the roots
  BODY_BLEND: 0.2,
  MAX_POLYS: 160000,
};
