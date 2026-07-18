/* ============================================================================
 * test/physics-sim.js  —  the ONE acceptance test the spec insists on (§3.6/§12)
 * ----------------------------------------------------------------------------
 *   "verified that a sustained pull induces a stall"
 *
 * Pure scalar longitudinal simulation using the SAME numbers the game flies
 * with (src/aero.js). No THREE, no browser. Run: node test/physics-sim.js
 *
 * Proves four things:
 *   1. Level flight settles at ~cruise (the autothrottle works).
 *   2. A sustained full pull bleeds airspeed THROUGH stall speed (the lesson).
 *   3. A heavier cargo stalls sooner than a light one (§3.7 load planning).
 *   4. A dive builds speed back (push over → energy returns).
 * ==========================================================================*/
'use strict';
var AERO = require('../src/aero.js');
var C = AERO.C;
var DEG = Math.PI / 180;

var failures = 0;
function check(name, cond, detail) {
  var tag = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log('  [' + tag + '] ' + name + (detail ? '  — ' + detail : ''));
}

// Longitudinal-only integrator. pitchCmd in [-1,1] (1 = full pull/nose up).
// Returns a trace of {t, v, pitchDeg, stalled}.
function fly(opts) {
  var dt = 1 / 60;
  var v = opts.v0;
  var pitch = 0;              // radians, + = nose up
  var m = opts.m;
  var stalled = false, everStalled = false, tStall = Infinity;
  var minV = v, maxV = v;
  for (var t = 0; t < opts.seconds; t += dt) {
    // Hard stall region (§3.4): authority gone, forced nose-down until recovered.
    if (v < C.V_STALL) {
      stalled = true;
      if (!everStalled) { everStalled = true; tStall = t; }
    }
    if (stalled) {
      pitch -= C.STALL_NOSE_DOWN * DEG * dt;
      if (v > C.V_STALL * C.STALL_RECOVER) stalled = false;
    } else {
      var rate = AERO.pitchRate(v) * DEG;      // authority scales with airspeed
      pitch += opts.pitchCmd * rate * dt;
    }
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    v += AERO.dvdt(v, Math.sin(pitch), m) * dt;
    if (v < 0) v = 0;
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return { v: v, pitchDeg: pitch / DEG, everStalled: everStalled,
           tStall: tStall, minV: minV, maxV: maxV };
}

console.log('Flight School — flight-model acceptance sim');
console.log('constants: V_STALL=%d V_CRUISE=%d THRUST_MAX=%d K_DRAG=%s G=%s',
  C.V_STALL, C.V_CRUISE, C.THRUST_MAX, C.K_DRAG, C.G);

// 1. Level flight settles into a comfortable cruise (drag pulls the hands-off
//    equilibrium a little below the autothrottle target — that is honest).
var level = fly({ v0: 40, pitchCmd: 0, m: C.M_PLANE, seconds: 25 });
check('level flight settles into a comfortable cruise', level.v > 52 && level.v < 62,
  'v=' + level.v.toFixed(1) + ' u/s (target ' + C.V_CRUISE + ')');

// 2. THE test: sustained full pull with the LIGHTEST cargo still stalls.
var lightMass = C.M_PLANE + 0.15;
var pullLight = fly({ v0: C.V_CRUISE, pitchCmd: 1, m: lightMass, seconds: 18 });
check('sustained pull induces a stall (light cargo)', pullLight.everStalled,
  'min v reached ' + pullLight.minV.toFixed(1) + ' u/s (stall at ' + C.V_STALL + ')');

// 2b. Sanity: the autothrottle must NOT be able to hold cruise through the climb.
check('autothrottle cannot hold cruise in a hard climb', pullLight.minV < C.V_CRUISE - 15,
  'min v ' + pullLight.minV.toFixed(1) + ' u/s << cruise');

// 3. Heavy cargo stalls too, and SOONER — worse thrust-to-weight (§3.7).
var heavyMass = C.M_PLANE + 0.8;
var pullHeavy = fly({ v0: C.V_CRUISE, pitchCmd: 1, m: heavyMass, seconds: 18 });
check('heavy cargo also stalls', pullHeavy.everStalled,
  'min v ' + pullHeavy.minV.toFixed(1) + ' u/s');
check('heavy cargo stalls sooner than light (load planning is real)',
  pullHeavy.tStall < pullLight.tStall,
  'heavy ' + pullHeavy.tStall.toFixed(1) + 's vs light ' + pullLight.tStall.toFixed(1) + 's');

// 4. A dive builds speed back up (energy returns; engine note will rise).
var dive = fly({ v0: C.V_CRUISE, pitchCmd: -1, m: C.M_PLANE, seconds: 6 });
check('a dive builds airspeed back up', dive.maxV > C.V_CRUISE + 8,
  'max v ' + dive.maxV.toFixed(1) + ' u/s');

console.log(failures === 0
  ? '\nALL CHECKS PASSED — the energy lesson survives the tuning.'
  : '\n' + failures + ' CHECK(S) FAILED — retune (see spec §3.6 warning).');
process.exit(failures === 0 ? 0 : 1);
