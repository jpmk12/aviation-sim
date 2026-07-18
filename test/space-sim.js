/* ============================================================================
 * test/space-sim.js  —  Space School flight-model acceptance (SPACE_SCHOOL.md)
 *   node test/space-sim.js
 * Proves, with the real numbers from src/space.js:
 *   1. A half-hearted throttle can't leave the pad (thrust < weight).
 *   2. Full throttle lifts off and reaches space; booster separation surges it.
 *   3. In space, cutting the engine keeps you coasting (no air stops you).
 *   4. A retro-burn can set the craft down softly (landing always reachable).
 * ==========================================================================*/
'use strict';
var SPACE = require('../src/space.js');
var C = SPACE.C;

var fails = 0;
function check(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  — ' + detail : ''));
  if (!cond) fails++;
}

// --- LAUNCH: integrate a vertical ascent with booster separation ----------
function launch(throttle) {
  var dt = 1 / 60, y = 0, vy = 0, m = C.M_FULL, sep = false, tSpace = -1;
  for (var t = 0; t < 60; t += dt) {
    if (!sep && y >= C.ALT_SEP) { sep = true; m = C.M_LIGHT; }
    var a = SPACE.launchAccel(throttle, m);
    vy += a * dt;
    if (vy < 0 && y <= 0) { vy = 0; }        // sits on the pad, no negative sink
    y += vy * dt; if (y < 0) y = 0;
    if (y >= C.ALT_SPACE && tSpace < 0) { tSpace = t; break; }
  }
  return { y: y, vy: vy, reachedSpace: tSpace >= 0, tSpace: tSpace };
}

var timid = launch(0.3);
check('a timid throttle cannot leave the pad', !timid.reachedSpace && timid.y < 1,
  'y=' + timid.y.toFixed(1) + ' u after 60s');

var full = launch(1.0);
check('full throttle lifts off and reaches space', full.reachedSpace,
  'reached ' + C.ALT_SPACE + 'u in ' + full.tSpace.toFixed(1) + 's');

// booster sep must increase acceleration (lighter rocket, same thrust)
var aBefore = SPACE.launchAccel(1, C.M_FULL), aAfter = SPACE.launchAccel(1, C.M_LIGHT);
check('booster separation surges the climb', aAfter > aBefore + 5,
  'a ' + aBefore.toFixed(1) + ' -> ' + aAfter.toFixed(1) + ' u/s^2');

// --- SPACE: cut the engine, keep coasting ---------------------------------
function coast(seconds) {
  var dt = 1 / 60, v = 100; // start at a good clip, throttle 0 (no thrust)
  for (var t = 0; t < seconds; t += dt) v *= (1 - C.SPACE_DAMP * dt);
  return v;
}
var after3 = coast(3);
check('cutting the engine keeps you coasting (no air)', after3 > 80,
  'v 100 -> ' + after3.toFixed(1) + ' u/s after 3s');

// --- LANDING: a retro-burn can set down softly ----------------------------
// gravity for a sample planet; hover throttle = m*g/THRUST should be < 1
function land(planetG, mass, pilot) {
  var dt = 1 / 60, y = C.ALT_LAND_START, vy = C.VY_LAND_START;
  var hover = mass * planetG / C.THRUST_LAND;
  for (var t = 0; t < 40 && y > 0; t += dt) {
    // simple "autopilot pilot": burn harder the faster we're falling / lower we are
    var thr = pilot(y, vy, hover);
    vy += SPACE.landingAccel(thr, mass, planetG) * dt;
    y += vy * dt;
  }
  return { vy: vy, tier: SPACE.landingTier(vy), hover: hover };
}
var planetG = 5.0, mass = 1.2;
var noBurn = land(planetG, mass, function () { return 0; });
check('no burn = a hard arrival (gravity wins)', SPACE.landingTier(noBurn.vy) === 'bounce',
  'impact vy=' + noBurn.vy.toFixed(1) + ' -> ' + noBurn.tier);

var soft = land(planetG, mass, function (y, vy, hover) {
  // ease down: hold a gentle descent, then flare near the ground. Burn HARDER
  // (throttle above hover) when we're falling faster than we want (error > 0).
  var wantVy = y > 50 ? -14 : -4;
  return SPACE.clamp(hover + (wantVy - vy) * 0.06, 0, 1);
});
check('a measured retro-burn lands softly', soft.tier === 'soft',
  'touchdown vy=' + soft.vy.toFixed(1) + ' -> ' + soft.tier + ' (hover thr ' + soft.hover.toFixed(2) + ')');

check('hover throttle sits below full (headroom to slow down)', land(planetG, mass, function () { return 0; }).hover < 0.85,
  'hover=' + (mass * planetG / C.THRUST_LAND).toFixed(2));

console.log(fails === 0
  ? '\nALL CHECKS PASSED — launch/coast/land all behave.'
  : '\n' + fails + ' CHECK(S) FAILED — retune src/space.js.');
process.exit(fails === 0 ? 0 : 1);
