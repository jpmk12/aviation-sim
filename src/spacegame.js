/* ============================================================================
 *  SPACE SCHOOL  —  a three-stage cockpit space-flight for little pilots
 *  See SPACE_SCHOOL.md. Depends on inlined globals THREE (r150) and SPACE
 *  (src/space.js — the flight numbers). Sections: CONFIG / PERSIST / AUDIO /
 *  BUILDERS / STAGES (launch, space, landing) / UI / MAIN.
 * ==========================================================================*/
(function () {
'use strict';

/* ============================================================================
 * CONFIG  —  the grown-up's block: who flies, where they go, what they carry.
 * ==========================================================================*/
var CONFIG = {
  // Shared pilots with Flight School (identity = icon + colour).
  profiles: [
    { id: 'p1', name: 'Fox',    initials: 'F', icon: '🦊', color: '#ff8a3d' },
    { id: 'p2', name: 'Dragon', initials: 'D', icon: '🐉', color: '#5b8cff' }
  ],

  // Destinations. gravity feeds the landing burn (a heavier world needs a
  // firmer hand). sky/ground colour the landing scene; ring adds a ring.
  planets: [
    { id: 'red',   label: 'The Red Planet', color: '#e0674a', sky: '#f2b39c', ground: '#c2523a', gravity: 5.5, size: 340, ring: false, pos: [-1500, 260, -2700] },
    { id: 'ice',   label: 'The Ice Moon',   color: '#a8dcea', sky: '#d8f2fa', ground: '#c3e8f2', gravity: 3.5, size: 250, ring: false, pos: [ 1900, -280, -2300] },
    { id: 'ring',  label: 'The Ring World', color: '#e6c862', sky: '#efe1a6', ground: '#caa93f', gravity: 6.5, size: 430, ring: true,  pos: [ 300,  520, -3700] },
    { id: 'green', label: 'The Green World',color: '#79cc6b', sky: '#cbeec4', ground: '#4f9e46', gravity: 5.0, size: 300, ring: false, pos: [ 2700, 420,  900] }
  ],

  // Cargo buddies (shared designs with Flight School). mass makes a heavy buddy
  // a heavier rocket (slower climb) AND a harder soft landing — the same
  // load-planning lesson, carried across both games.
  creatures: [
    { id: 'creature_liz',  name: 'Pip',     kind: 'lizard', mass: 0.15, color: '#7fd858', scale: 0.80 },
    { id: 'creature_fox',  name: 'Rusty',   kind: 'fox',    mass: 0.35, color: '#ff8a3d', scale: 1.00 },
    { id: 'creature_bear', name: 'Bramble', kind: 'bear',   mass: 0.60, color: '#b5794a', scale: 1.35 },
    { id: 'creature_drag', name: 'Ember',   kind: 'dragon', mass: 0.80, color: '#9b6bff', scale: 1.60 }
  ]
};
CONFIG.gameMeta = { id: 'spaceschool', title: 'Space School', icon: '🚀' };
// Shared family world (SPACE_SCHOOL / CLAUDE.md §11.3, IMPROVEMENT_PLAN 3.5):
// off by default (each pilot's own worlds), opt-in to see every pilot's buddies
// on the planets. Also live-toggleable: spaceschool.html?family=1
CONFIG.familyWorld = false;
try { if (/[?&]family=1\b/.test(location.search)) CONFIG.familyWorld = true; } catch (e) {}

// Constellations — the stars you scoop in space fill these in, one point per
// star, across sessions (per profile). Each is a closed polyline in chart
// space [-1,1]; `dir` places it in the sky. Completing one lights it gold up
// there forever — a night sky the child builds, one star at a time.
CONFIG.constellations = [
  { id: 'rocket', icon: '🚀', name: 'The Rocket', dir: [-0.7, 0.6, -1],
    points: [[0, 1], [0.45, 0.15], [0.6, -0.75], [0, -1], [-0.6, -0.75], [-0.45, 0.15]] },
  { id: 'star', icon: '⭐', name: 'The Star', dir: [0.85, 0.65, -0.25],
    points: [[0, 1], [0.95, 0.31], [0.59, -0.81], [-0.59, -0.81], [-0.95, 0.31]] },
  { id: 'house', icon: '🏠', name: 'The House', dir: [0.25, 0.6, 1],
    points: [[-0.7, -0.85], [-0.7, 0.15], [0, 1], [0.7, 0.15], [0.7, -0.85]] }
];
CONFIG.constTotal = CONFIG.constellations.reduce(function (a, c) { return a + c.points.length; }, 0);

// --- Mission patches (IMPROVEMENT_PLAN 3.3): a wordless trophy room, matching
// Flight School's. Earned by doing a thing once; the icon carries the meaning.
// Per-profile, persisted. The "planet" patches follow CONFIG.planets.
function planetIcon(id) {
  return id === 'red' ? '🔴' : id === 'ice' ? '❄️' : id === 'ring' ? '🪐' : id === 'green' ? '🌍' : '🌑';
}
var HEAVY_MASS = CONFIG.creatures.reduce(function (m, c) { return Math.max(m, c.mass); }, 0);
var PATCHES = [
  { id: 'launch',        icon: '🚀', ring: '#ffd23f', label: 'Reached space' },
  { id: 'dock',          icon: '🛰️', ring: '#a8dcea', label: 'Docked with the station' },
  { id: 'constellation', icon: '✨', ring: '#ffe38a', label: 'Completed a constellation' }
].concat(CONFIG.planets.map(function (p) {
  return { id: p.id, icon: planetIcon(p.id), ring: p.color, label: 'Landed on ' + p.label };
})).concat([
  { id: 'feather', icon: '🪶', ring: '#cbeec4', label: 'Feather landing' },
  { id: 'heavy',   icon: '🐉', ring: '#9b6bff', label: 'Heavy hauler' }
]);
function patchById(id) { for (var i = 0; i < PATCHES.length; i++) if (PATCHES[i].id === id) return PATCHES[i]; return null; }

/* ============================================================================
 * small utilities
 * ==========================================================================*/
var TAU = Math.PI * 2, DEG = Math.PI / 180;
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function shade(hex, amt) {
  var c = new THREE.Color(hex), t = amt < 0 ? 0 : 1, p = Math.abs(amt);
  c.r = lerp(c.r, t, p); c.g = lerp(c.g, t, p); c.b = lerp(c.b, t, p); return c;
}
function tailFromInitials(s) { s = (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); return 'N-' + (s || 'XX'); }

/* ============================================================================
 * PERSIST  —  per-profile, spaceschool namespace. Each delivery = a buddy that
 * now lives on a planet, visible from orbit forever.
 * ==========================================================================*/
var Persist = (function () {
  var mem = {}, ok = (function () { try { localStorage.setItem('__s', '1'); localStorage.removeItem('__s'); return true; } catch (e) { return false; } })();
  function key(id) { return 'spaceschool:profile:' + id; }
  function load(id) { var r; try { r = ok ? localStorage.getItem(key(id)) : mem[id]; } catch (e) { r = mem[id]; } if (!r) return null; try { return JSON.parse(r); } catch (e) { return null; } }
  function save(o) { var r = JSON.stringify(o); try { if (ok) localStorage.setItem(key(o.profileId), r); else mem[o.profileId] = r; } catch (e) { mem[o.profileId] = r; } }
  function blank(p) { return { profileId: p.id, icon: p.icon, color: p.color, tailNumber: tailFromInitials(p.initials || p.name), deliveries: [], missions: 0, stars: 0, patches: [] }; }
  return { load: load, save: save, blank: blank, available: ok };
})();

/* ============================================================================
 * AUDIO  —  Web Audio synthesis only. The rocket rumble tracks the throttle:
 * the loudest, most physical feedback channel there is.
 * ==========================================================================*/
var Audio = (function () {
  var ctx, master, noiseBuf, rumble, unlocked = false, comms = null, music = null;
  function build() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    var n = ctx.sampleRate * 0.6; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), s = 99; for (var i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    // rocket rumble: filtered noise + low sine, gain ∝ throttle
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    var sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 46;
    var g = ctx.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(g); sub.connect(g); g.connect(master); src.start(); sub.start();
    rumble = { g: g, lp: lp };
  }
  function unlock() { if (unlocked) return; if (!ctx) build(); if (ctx && ctx.state === 'suspended') ctx.resume(); unlocked = !!ctx; }
  function now() { return ctx ? ctx.currentTime : 0; }
  function rumbleTo(level) { if (!rumble) return; var t = now(); rumble.g.gain.setTargetAtTime(clamp(level, 0, 1) * 0.5, t, 0.1); rumble.lp.frequency.setTargetAtTime(180 + level * 500, t, 0.1); }
  function tone(type, f0, f1, dur, vol, at) { if (!ctx) return; at = at || 0; var t = now() + at; var o = ctx.createOscillator(); o.type = type; var g = ctx.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); }
  function noise(dur, vol, lp, at) { if (!ctx || !noiseBuf) return; at = at || 0; var t = now() + at; var s = ctx.createBufferSource(); s.buffer = noiseBuf; var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur); }
  function toggleComms(on) {
    if (!ctx) return;
    if (comms) { clearInterval(comms); comms = null; }
    if (on) { comms = setInterval(function () { tone('square', 700 + Math.abs(Math.sin(now()) * 400), 900, 0.06, 0.06); tone('square', 500, 620, 0.05, 0.05, 0.08); }, 1400); }
  }
  function toggleMusic(on) {
    if (!ctx) return;
    if (music) { clearInterval(music); music = null; }
    if (on) { var step = 0, notes = [110, 138, 146, 138]; music = setInterval(function () { tone('triangle', notes[step % 4], notes[step % 4], 0.18, 0.05); step++; }, 320); }
  }
  return {
    unlock: unlock, rumbleTo: rumbleTo,
    hiss: function (v) { noise(0.14, 0.12 * v, 2200); },
    click: function () { tone('square', 240, 200, 0.05, 0.12); },
    sep:   function () { noise(0.3, 0.4, 500); tone('sine', 180, 70, 0.35, 0.3); },
    warp:  function () { noise(0.5, 0.25, 3000); tone('sawtooth', 200, 1200, 0.5, 0.12); },
    countBeep: function (isZero) {
      if (isZero) { tone('square', 880, 880, 0.5, 0.2); tone('square', 1100, 1100, 0.45, 0.14, 0.05); }
      else tone('square', 620, 620, 0.12, 0.16);
    },
    whooshCloud: function () { noise(0.6, 0.3, 900); },
    clunk: function () { noise(0.12, 0.35, 550); tone('square', 170, 85, 0.2, 0.22); tone('triangle', 950, 720, 0.08, 0.1, 0.03); },
    undockHiss: function () { noise(0.38, 0.22, 1900); tone('sine', 300, 210, 0.25, 0.08, 0.05); },
    star:  function () { tone('triangle', 880, 1320, 0.18, 0.16); },
    boing: function () { tone('sine', 320, 90, 0.28, 0.28); tone('sine', 260, 140, 0.28, 0.1, 0.02); },
    thump: function () { noise(0.18, 0.4, 480); tone('sine', 110, 55, 0.24, 0.3); },
    chime: function (big) { tone('triangle', 660, 660, 0.5, 0.2); tone('triangle', 831, 831, 0.5, 0.18, 0.06); if (big) tone('triangle', 990, 990, 0.6, 0.18, 0.12); },
    toggleComms: toggleComms, toggleMusic: toggleMusic,
    get available() { return !!ctx; }
  };
})();

/* ============================================================================
 * BUILDERS  —  low-poly, cheerful, flat-shaded.
 * ==========================================================================*/
function mat(color, flat) { return new THREE.MeshLambertMaterial({ color: new THREE.Color(color), flatShading: flat !== false }); }

function makeStars(count, radius) {
  var g = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), col = new Float32Array(count * 3), seed = 7;
  function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  for (var i = 0; i < count; i++) {
    var u = rnd() * 2 - 1, th = rnd() * TAU, r = radius * (0.6 + rnd() * 0.4), s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * s * Math.sin(th);
    var b = 0.6 + rnd() * 0.4; col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b * (0.9 + rnd() * 0.1);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: radius * 0.006, vertexColors: true, sizeAttenuation: true, fog: false }));
}

function makePlanet(p) {
  var g = new THREE.Group();
  var ball = new THREE.Mesh(new THREE.SphereGeometry(p.size, 20, 16), mat(p.color, false));
  g.add(ball);
  // a couple of darker continents/craters
  for (var i = 0; i < 5; i++) {
    var blob = new THREE.Mesh(new THREE.SphereGeometry(p.size * (0.16 + (i % 3) * 0.06), 8, 6), mat(shade(p.color, i % 2 ? -0.22 : 0.18), false));
    var a = i * 1.7, b = Math.sin(i * 2.1);
    blob.position.set(Math.cos(a) * p.size * 0.82, b * p.size * 0.7, Math.sin(a) * p.size * 0.82);
    ball.add(blob);
  }
  if (p.ring) {
    var ring = new THREE.Mesh(new THREE.RingGeometry(p.size * 1.35, p.size * 2.1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(shade(p.color, 0.3)), side: THREE.DoubleSide, transparent: true, opacity: 0.75, fog: false }));
    ring.rotation.x = Math.PI * 0.42; g.add(ring);
  }
  return g;
}

// A friendly space station: central hub, big rotating habitat wheel (facing
// the approach), solar panels, and a docking port whose glowing ring is both
// the target and the speed light (green = slow enough to dock, amber = too
// hot). Built with the dock port along +z; lookAt() aims it at the approach.
function makeStation() {
  var g = new THREE.Group();
  var hull = mat('#e8ecf2'), dark = mat('#4a5568', false), blue = mat('#2b4d8f', false);
  var hub = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 30, 12), hull);
  hub.rotation.x = Math.PI / 2; g.add(hub);                    // hub along z
  var wheel = new THREE.Mesh(new THREE.TorusGeometry(36, 6.5, 10, 28), hull);
  g.add(wheel);                                                // habitat wheel in xy
  for (var i = 0; i < 4; i++) {
    var a = i / 4 * TAU + Math.PI / 4;
    var spoke = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 6), dark);
    spoke.rotation.z = a + Math.PI / 2;
    spoke.position.set(Math.cos(a) * 17, Math.sin(a) * 17, 0);
    wheel.add(spoke);
  }
  // solar wings off the back of the hub
  [-1, 1].forEach(function (s) {
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 26, 6), dark);
    arm.rotation.z = Math.PI / 2; arm.position.set(s * 18, 0, -12); g.add(arm);
    var panel = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 12), blue);
    panel.position.set(s * 32, 0, -12); g.add(panel);
  });
  // docking port + the glowing ring (speed light)
  var port = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.5, 9, 10), dark);
  port.rotation.x = Math.PI / 2; port.position.z = 19; g.add(port);
  var ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd858'), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var ring = new THREE.Mesh(new THREE.TorusGeometry(15, 2.0, 10, 28), ringMat);
  ring.position.z = 25; g.add(ring);
  g.userData = { wheel: wheel, ring: ring, ringMat: ringMat };
  return g;
}

function makeBeaconRing(color, size) {
  var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var ring = new THREE.Mesh(new THREE.TorusGeometry(size * 1.25, size * 0.06, 8, 40), m);
  ring.userData.mat = m; return ring;
}

// A rocket for launch: body + nose + fins + two detachable boosters + flame.
// A big SLS-style rocket: burnt-orange core stage, twin white solid rocket
// boosters (detachable), engine cluster, Orion capsule + launch-abort tower.
// Built with its base (engine bottom) at y=0, extending up ~52 units.
function makeRocket(color) {
  var g = new THREE.Group();
  var orange = mat('#d0602e'), white = mat('#eef1f5'), dark = mat('#3a3f47', false),
      silver = mat('#c9ced6'), red = mat('#d94b3a'), grey = mat('#d8dce2');

  // --- core stage (orange) ---
  var core = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 30, 18), orange); core.position.y = 17; g.add(core);
  // a band in the pilot's colour, so each kid's rocket is "theirs"
  var band = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 2.2, 18), mat(color)); band.position.y = 27.5; g.add(band);
  // engine section + 4 RS-25 nozzles
  var eng = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.5, 2.4, 18), dark); eng.position.y = 2.6; g.add(eng);
  [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(function (p) {
    var noz = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 2.6, 10), dark); noz.position.set(p[0], 0.9, p[1]); g.add(noz);
  });
  // --- upper stack: interstage, ICPS, Orion, abort tower ---
  var inter = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.2, 3, 18), grey); inter.position.y = 33.5; g.add(inter);
  var icps = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 6, 18), white); icps.position.y = 38.2; g.add(icps);
  var orion = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.3, 3, 16), silver); orion.position.y = 42.7; g.add(orion);
  var cap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 14), white); cap.position.y = 45.2; g.add(cap);
  // Orion solar wings — folded flat against the service module; unfold when the
  // rocket reaches space (the "we made it" moment). rotation.z: folded -> out.
  var wings = new THREE.Group();
  [-1, 1].forEach(function (s) {
    var hinge = new THREE.Group(); hinge.position.set(s * 2.1, 41.6, 0);
    var panel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.6), mat('#2b4d8f', false));
    panel.position.x = s * 2.5; hinge.add(panel);
    hinge.rotation.z = s * Math.PI / 2;      // folded up along the body
    hinge.userData.side = s;
    wings.add(hinge);
  });
  g.add(wings);
  var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 4.5, 8), red); tower.position.y = 48.5; g.add(tower);
  var tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1, 8), red); tip.position.y = 51.2; g.add(tip);

  // --- twin solid rocket boosters (detachable) ---
  var boosters = new THREE.Group();
  [-1, 1].forEach(function (s) {
    var b = new THREE.Group();
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 26, 12), white); tube.position.y = 15; b.add(tube);
    var seg = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.6, 12), grey); seg.position.y = 20; b.add(seg);
    var nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.5, 12), red); nose.position.y = 30.2; b.add(nose);
    var bnoz = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 2.4, 10), dark); bnoz.position.y = 0.8; b.add(bnoz);
    var bfl = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 12), new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.9, fog: false }));
    bfl.position.y = -4; bfl.rotation.x = Math.PI; b.add(bfl); b.userData.flame = bfl;
    b.position.set(s * 5.0, 1.5, 0); boosters.add(b);
  });
  g.add(boosters);

  // --- core engine flame (scaled by throttle) ---
  var flame = new THREE.Mesh(new THREE.ConeGeometry(3.0, 12, 16), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.95, fog: false }));
  flame.position.y = -5; flame.rotation.x = Math.PI; g.add(flame);
  var flame2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 16), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.95, fog: false }));
  flame2.position.y = -3; flame2.rotation.x = Math.PI; g.add(flame2);
  g.userData = { boosters: boosters, flame: flame, flame2: flame2, core: core, wings: wings };
  return g;
}

// A little flock of birds for the low sky — they flap, then scatter as the
// rocket thunders past (ascent milestone #1).
function makeBirdFlock() {
  var flock = new THREE.Group();
  for (var i = 0; i < 6; i++) {
    var bird = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), mat('#4a4f57', false)); bird.add(body);
    [-1, 1].forEach(function (s) {
      var wing = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), mat('#5d636c', false));
      wing.rotation.z = s * Math.PI / 2; wing.position.x = s * 1.6; wing.userData.side = s; bird.add(wing);
    });
    bird.position.set(34 + (i % 3) * 7, 100 + Math.sin(i * 2.1) * 14, -20 + (i * 9) % 40);
    bird.userData = { phase: i * 1.3, vel: null };
    flock.add(bird);
  }
  flock.userData = { scattered: false, altitude: 110 };
  return flock;
}
function stepBirds(flock, rocketY, t, dt) {
  var u = flock.userData;
  if (!u.scattered && Math.abs(rocketY - u.altitude) < 45 && rocketY > 20) {
    u.scattered = true;
    flock.children.forEach(function (b, i) {
      var a = (i / flock.children.length) * TAU;
      b.userData.vel = new THREE.Vector3(Math.cos(a) * 26 + 14, 6 + (i % 3) * 4, Math.sin(a) * 26);
    });
  }
  flock.children.forEach(function (b) {
    var flap = Math.sin(t * (u.scattered ? 16 : 9) + b.userData.phase) * 0.6;
    b.children.forEach(function (w) { if (w.userData.side) w.rotation.x = flap * w.userData.side; });
    if (b.userData.vel) b.position.addScaledVector(b.userData.vel, dt);
    else b.position.x += Math.sin(t * 0.7 + b.userData.phase) * dt * 2;
  });
}

// A puffy cloud deck around the launch axis — the rocket punches through it
// with a whoosh (ascent milestone #2).
function makeCloudLayer(y) {
  var layer = new THREE.Group();
  for (var i = 0; i < 14; i++) {
    var a = (i / 14) * TAU, r = 30 + ((i * 53) % 100);
    var puff = new THREE.Mesh(new THREE.SphereGeometry(16 + (i * 7) % 22, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, flatShading: true }));
    puff.position.set(Math.cos(a) * r, y + Math.sin(i * 2.7) * 12, Math.sin(a) * r);
    puff.scale.y = 0.55;
    layer.add(puff);
  }
  layer.userData = { y: y, pierced: false };
  return layer;
}

// Billowing exhaust/pad smoke for the launch stage.
function spawnLaunchSmoke(l, n) {
  var baseY = 6 + l.y;
  for (var i = 0; i < n; i++) {
    var s = 3 + Math.random() * 4;
    var m = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe2e6ec), transparent: true, opacity: 0.85, fog: false }));
    var a = Math.random() * TAU, rr = Math.random() * 9;
    m.position.set(Math.cos(a) * rr, baseY - 2 + Math.random() * 3, Math.sin(a) * rr);
    l.smokeGroup.add(m);
    l.smoke.push({ m: m, vel: new THREE.Vector3(Math.cos(a) * (10 + Math.random() * 16), 3 + Math.random() * 6, Math.sin(a) * (10 + Math.random() * 16)), life: 1 + Math.random() * 0.6 });
  }
}
function stepLaunchSmoke(l, dt) {
  for (var i = l.smoke.length - 1; i >= 0; i--) {
    var p = l.smoke[i];
    p.m.position.addScaledVector(p.vel, dt); p.m.scale.multiplyScalar(1 + dt * 0.8); p.vel.multiplyScalar(1 - 0.6 * dt);
    p.life -= dt * 0.5; p.m.material.opacity = Math.max(0, p.life * 0.7);
    if (p.life <= 0) { l.smokeGroup.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); l.smoke.splice(i, 1); }
  }
}

// A lander for the landing stage: capsule + legs + descent flame.
function makeLander(color) {
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.6, 6, 12), mat('#eef1f5')); body.position.y = 2; g.add(body);
  var cap = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 8, 0, TAU, 0, Math.PI / 2), mat(color)); cap.position.y = 5; g.add(cap);
  var win = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.7, flatShading: true })); win.position.set(0, 5.4, 2.6); g.add(win);
  [0, 1, 2, 3].forEach(function (i) { var a = i / 4 * TAU + 0.4; var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5), mat(shade(color, -0.2))); leg.position.set(Math.cos(a) * 3.4, -0.6, Math.sin(a) * 3.4); leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5; g.add(leg); var foot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 8), mat(shade(color, -0.3))); foot.position.set(Math.cos(a) * 5, -3, Math.sin(a) * 5); g.add(foot); });
  var flame = new THREE.Mesh(new THREE.ConeGeometry(1.8, 6, 12), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, fog: false })); flame.position.y = -3; flame.rotation.x = Math.PI; g.add(flame);
  g.userData = { flame: flame };
  return g;
}

// Shared low-poly creature (compact port of Flight School's builder).
function makeCreature(def) {
  var g = new THREE.Group(), body = mat(def.color), belly = mat(shade(def.color, 0.35)), white = mat('#fff', false), black = mat('#20242c', false);
  var torso = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), body); torso.scale.set(1, 1.12, 0.92); torso.position.y = 0.78; g.add(torso);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 10, 8), body); head.position.y = 1.55; g.add(head);
  [-0.17, 0.17].forEach(function (x) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), white); e.position.set(x, 1.6, 0.36); g.add(e); var pp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), black); pp.position.set(x, 1.6, 0.44); g.add(pp); });
  if (def.kind === 'fox' || def.kind === 'bear') { [-0.24, 0.24].forEach(function (x) { var ear = new THREE.Mesh(def.kind === 'fox' ? new THREE.ConeGeometry(0.16, 0.34, 5) : new THREE.SphereGeometry(0.16, 6, 6), body); ear.position.set(x, 1.92, 0); g.add(ear); }); }
  if (def.kind === 'dragon') { [-1, 1].forEach(function (s) { var wing = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 3), belly); wing.scale.set(0.35, 1, 1); wing.rotation.z = s * 1.2; wing.position.set(s * 0.6, 1, -0.35); g.add(wing); }); }
  if (def.kind === 'lizard') { var frill = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 3), mat(shade(def.color, -0.3))); frill.position.set(0, 1.75, -0.2); g.add(frill); }
  var sh = new THREE.Group(); sh.position.set(0.6, 1.05, 0.05); var ra = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 3, 6), body); ra.position.set(0, -0.22, 0); sh.add(ra); g.add(sh);
  var la = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 3, 6), body); la.position.set(-0.62, 0.85, 0.05); la.rotation.z = 0.4; g.add(la);
  [-0.26, 0.26].forEach(function (x) { var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.28, 3, 6), body); leg.position.set(x, 0.24, 0.05); g.add(leg); });
  g.userData = { def: def, waveArm: sh };
  return g;
}

/* ============================================================================
 * MAIN  —  renderer, stage machine, per-stage scenes, loop.
 * ==========================================================================*/
var App = {};
function boot() {
  var stage = document.getElementById('stage');
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = true;
  stage.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  var camera = new THREE.PerspectiveCamera(60, 1, 0.5, 20000);

  // -------- game state --------
  var G = {
    stageName: 'profile', profile: null, save: null,
    buddy: null, planet: null,
    running: false, t: 0,
    // per-run
    throttle: 0, ignited: false,
    switches: { light: false, comms: false, warp: false, gear: false, map: false, music: false },
    collected: 0
  };
  App.G = G;

  // Scenes are built lazily, one per stage.
  var scenes = {};

  /* ==================================================================
   * LAUNCH STAGE
   * ================================================================== */
  var launch = null;
  function buildLaunch() {
    var sc = new THREE.Scene();
    sc.background = new THREE.Color('#bfe3ff');
    sc.add(new THREE.HemisphereLight('#eaf6ff', '#5b7a55', 1.1));
    var sun = new THREE.DirectionalLight('#fff6e0', 0.9); sun.position.set(-400, 600, 300); sc.add(sun);
    var stars = makeStars(700, 9000); stars.visible = false; sc.add(stars);
    // ground + pad + service tower (with arms) so the SLS looks parked at a pad
    var ground = new THREE.Mesh(new THREE.CircleGeometry(1600, 40), mat('#6bae52')); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    var pad = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 6, 24), mat('#7c828c', false)); pad.position.y = 3; sc.add(pad);
    var tower = new THREE.Group();
    var mast = new THREE.Mesh(new THREE.BoxGeometry(3, 58, 3), mat('#b9bec6', false)); mast.position.y = 29; tower.add(mast);
    [16, 30, 44].forEach(function (y) { var arm = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 1.4), mat('#a6abb3', false)); arm.position.set(5, y, 0); tower.add(arm); });
    tower.position.set(-11, 0, 0); sc.add(tower);
    var rocket = makeRocket('#ff8a3d'); rocket.position.y = 6; sc.add(rocket);
    var smokeGroup = new THREE.Group(); sc.add(smokeGroup);
    var birds = makeBirdFlock(); sc.add(birds);
    var clouds = makeCloudLayer(750); sc.add(clouds);
    launch = { sc: sc, rocket: rocket, stars: stars, ground: ground, pad: pad, tower: tower,
               smokeGroup: smokeGroup, smoke: [], smokeT: 0, birds: birds, clouds: clouds,
               y: 0, vy: 0, prevY: 0, prevVy: 0, sep: false, done: false, landedBack: false,
               count: -1, enginesLit: false, wingsOut: false, wingsT: 0, att: 0 };
    return sc;
  }
  function enterLaunch() {
    if (!launch) buildLaunch();
    G.stageName = 'launch'; G.running = true;
    var l = launch;
    // (re)build the rocket in the pilot's colour, reset to the pad
    if (l.rocket) l.sc.remove(l.rocket);
    l.rocket = makeRocket(G.profile ? G.profile.color : '#ff8a3d');
    l.rocket.position.set(0, 6, 0); l.sc.add(l.rocket);
    l.y = 0; l.vy = 0; l.prevY = 0; l.prevVy = 0; l.sep = false; l.done = false; l.landedBack = false;
    l.count = -1; l.enginesLit = false; l.wingsOut = false; l.wingsT = 0; l.att = 0;
    G.pitch = 0;
    while (l.smokeGroup.children.length) l.smokeGroup.remove(l.smokeGroup.children[0]); l.smoke.length = 0;
    // fresh birds + clouds each mission (the flock re-forms, the deck re-puffs)
    l.sc.remove(l.birds); l.birds = makeBirdFlock(); l.sc.add(l.birds);
    l.sc.remove(l.clouds); l.clouds = makeCloudLayer(750); l.sc.add(l.clouds);
    G.throttle = 0; G.ignited = false;
    scenes.launch = l.sc;
    UI.showLaunch();
  }
  var _shake = 0;
  function updateLaunch(dt) {
    var l = launch; if (!l) return;
    // heavier buddy = heavier rocket = needs more throttle to leave the pad
    var mass = (SPACE.C.M_FULL + (G.buddy ? G.buddy.mass : 0)) * (l.sep ? (SPACE.C.M_LIGHT / SPACE.C.M_FULL) : 1);

    // --- countdown ritual: 5-4-3-2-1, engines light at 3, clamps release at 0.
    if (l.count > 0) {
      var before = Math.ceil(l.count);
      l.count -= dt;
      var after = Math.max(0, Math.ceil(l.count));
      if (after !== before) { UI.setCountdown(after); Audio.countBeep(after === 0); }
      if (!l.enginesLit && l.count <= 3) { l.enginesLit = true; spawnLaunchSmoke(l, 10); }
      if (l.count <= 0) { l.count = -1; G.ignited = true; }
    }

    // engines can be lit (flames, smoke, rumble) while the hold-down clamps
    // still grip the rocket — physics only flows once G.ignited (release).
    var lit = G.ignited || l.enginesLit;
    var thr = lit ? G.throttle : 0;
    Audio.rumbleTo(thr);

    // --- attitude minigame: a gentle wind wanders the rocket off vertical; the
    // child holds the tilt control to keep it straight. Bounded + oscillatory,
    // so it never runs away, and staying aligned climbs faster (never a fail).
    var eff = 1;
    if (G.ignited && l.y > 1) {
      var gust = Math.sin(G.t * 0.55) * 0.6 + Math.sin(G.t * 1.3 + 2.0) * 0.4;   // ~[-1,1]
      l.att += (gust * SPACE.C.ATT_DRIFT + (G.pitch || 0) * SPACE.C.ATT_RATE) * dt;
      // self-centre toward vertical when the tilt control is released (forgiving)
      if (Math.abs(G.pitch || 0) < 0.05) l.att -= Math.sign(l.att) * Math.min(Math.abs(l.att), SPACE.C.ATT_RETURN * dt);
      l.att = clamp(l.att, -SPACE.C.ATT_MAX, SPACE.C.ATT_MAX);
      eff = SPACE.launchClimbEff(l.att);
    }

    if (G.ignited) {
      // a = throttle*THRUST/m - g - drag(vy). Below the hover throttle the rocket
      // slows, stops, and sinks back to the pad — the thrust-vs-gravity lesson —
      // and drag caps the climb speed so the ascent is a real journey. Attitude
      // efficiency trims the effective throttle: fly straight, climb sooner.
      var a = SPACE.launchAccel(thr * eff, mass, l.vy);
      l.vy += a * dt;
      if (l.vy < 0 && l.y <= 0) l.vy = 0;      // sits on the pad
      l.y += l.vy * dt; if (l.y < 0) l.y = 0;
      if (!l.sep && l.y >= SPACE.C.ALT_SEP) {
        l.sep = true; Audio.sep();
        var bg = l.rocket.userData.boosters; bg.userData.drop = true; bg.userData.vy = -8;
      }
      if (l.y >= SPACE.C.ALT_SPACE && !l.done) { l.done = true; UI.setCountdown(null); enterSpace(); return; }
    }

    // --- ascent milestones ---
    stepBirds(l.birds, l.y, G.t, dt);
    l.birds.visible = l.y < 500;
    if (!l.clouds.userData.pierced && l.y > l.clouds.userData.y - 40) {
      l.clouds.userData.pierced = true; Audio.whooshCloud();
    }
    l.clouds.visible = Math.abs(l.y - l.clouds.userData.y) < 900;
    if (!l.wingsOut && l.y >= 2200) { l.wingsOut = true; Audio.chime(true); }
    if (l.wingsOut && l.wingsT < 1) {
      l.wingsT = Math.min(1, l.wingsT + dt / 1.3);
      var k2 = l.wingsT * l.wingsT * (3 - 2 * l.wingsT); // smooth unfold
      l.rocket.userData.wings.children.forEach(function (h) {
        h.rotation.z = h.userData.side * (Math.PI / 2) * (1 - k2);
      });
    }
    // came back down to the pad after falling -> soft thump + dust (never a crash)
    if (l.y <= 0 && l.prevY > 1 && l.prevVy < -4 && !l.landedBack) { l.landedBack = true; Audio.thump(); spawnLaunchSmoke(l, 12); }
    if (l.y > 2) l.landedBack = false;
    l.prevY = l.y; l.prevVy = l.vy;

    // visuals
    l.rocket.position.y = 6 + l.y;
    l.rocket.rotation.z = -l.att;          // lean with attitude (base-pivot)
    var b = l.rocket.userData.boosters;
    if (b.userData.drop) { b.userData.vy -= 30 * dt; b.position.y += b.userData.vy * dt; b.rotation.z += dt * 1.2; b.children.forEach(function (c, i) { c.rotation.x += dt * (1.5 + i); if (c.userData.flame) c.userData.flame.visible = false; }); if (b.position.y < -900) b.visible = false; }
    var flScale = lit ? (0.25 + thr * 1.25) : 0;
    l.rocket.userData.flame.scale.set(1, flScale, 1); l.rocket.userData.flame2.scale.set(1, flScale * 1.1, 1);
    l.rocket.userData.flame.visible = l.rocket.userData.flame2.visible = flScale > 0.02;
    if (!l.sep) b.children.forEach(function (c) { if (c.userData.flame) { c.userData.flame.visible = flScale > 0.02; c.userData.flame.scale.set(1, flScale, 1); } });

    // exhaust / pad smoke while thrusting low (including the clamped hold-down)
    l.smokeT += dt;
    if (lit && thr > 0.12 && l.y < 200 && l.smokeT > 0.05) { l.smokeT = 0; spawnLaunchSmoke(l, 1); }
    stepLaunchSmoke(l, dt);

    // sky darkens + stars fade in with altitude
    var k = clamp(l.y / SPACE.C.ALT_SPACE, 0, 1);
    l.sc.background.setRGB(lerp(0.75, 0.02, k), lerp(0.89, 0.02, k), lerp(1.0, 0.08, k));
    l.stars.visible = k > 0.3; if (l.stars.material) l.stars.material.opacity = k;

    // camera frames the rocket big and close on the pad, then follows it up
    var camDist = 42 + l.y * 0.085;
    _shake = lerp(_shake, lit ? thr * 2.0 : 0, 0.2);
    var sh = Math.sin(G.t * 55) * _shake;
    camera.position.set(camDist * 0.7, 30 + l.y + sh, camDist);
    camera.lookAt(0, 30 + l.y, 0);
    // report attitude to the HUD indicator (keep-it-green gauge)
    UI.updateAttitude(l.att / SPACE.C.ATT_MAX, Math.abs(l.att) <= SPACE.C.ATT_BAND);
  }

  /* ==================================================================
   * SPACE STAGE  (first-person cockpit)
   * ================================================================== */
  var space = null;
  function buildSpace() {
    var sc = new THREE.Scene();
    sc.background = new THREE.Color('#05060f');
    sc.add(new THREE.HemisphereLight('#404a80', '#101018', 0.7));
    var sun = new THREE.DirectionalLight('#ffffff', 1.1); sun.position.set(1, 0.6, 0.4); sc.add(sun);
    sc.add(makeStars(1400, 14000));
    // planets
    var planetObjs = {};
    CONFIG.planets.forEach(function (p) {
      var g = makePlanet(p); g.position.set(p.pos[0], p.pos[1], p.pos[2]); sc.add(g);
      var ring = makeBeaconRing(p.color, p.size); ring.position.copy(g.position); ring.visible = false; sc.add(ring);
      planetObjs[p.id] = { grp: g, ring: ring, p: p };
    });
    // asteroids + floating stars (rebuilt on enter for the active route)
    var rocks = new THREE.Group(); sc.add(rocks);
    var gems = new THREE.Group(); sc.add(gems);
    var warpField = makeStars(600, 4000); warpField.visible = false; sc.add(warpField);
    var station = makeStation(); sc.add(station);
    space = { sc: sc, planets: planetObjs, rocks: rocks, gems: gems, warp: warpField,
              station: station, dockPos: new THREE.Vector3(), sparks: [],
              constLayer: null, constGlow: [],
              q: new THREE.Quaternion(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, -1), thrusting: false };
    return sc;
  }
  function enterSpace() {
    if (!space) buildSpace();
    G.stageName = 'space'; G.running = true;
    award('launch');                          // reached space (3.3)
    var s = space;
    // start near origin
    s.pos.set(0, 0, 0); s.vel.set(0, 0, 0);
    var tp = G.planet.pos;
    // beacon only on destination (dim during the station leg — the station is
    // the first goal; the planet ring brightens after undocking)
    Object.keys(s.planets).forEach(function (k) { s.planets[k].ring.visible = (k === G.planet.id); });
    // decorate planets with delivered buddies (dots in orbit)
    decoratePlanets(s);
    // strew some asteroids + collectible stars along the route
    buildRoute(s, tp);
    // the space station sits on the way to the planet, dock facing the arrival
    var st = SPACE.C.STATION_T;
    s.station.position.set(tp[0] * st, tp[1] * st + 60, tp[2] * st);
    s.station.lookAt(s.pos.x, s.pos.y, s.pos.z);      // +z (the port) faces us
    s.station.updateMatrixWorld(true);
    s.station.userData.ring.getWorldPosition(s.dockPos);
    faceTarget(s, s.dockPos);              // face leg one's goal: the station
    G.dockState = 'toStation'; G.dockT = 0; G.bounceCool = 0;
    G.collected = 0;
    // the night sky the child has built so far (persisted per profile)
    buildConstellations(s);
    // reset switches display
    scenes.space = s.sc;
    Audio.rumbleTo(0);
    UI.showSpace();
    UI.drawChart();
    UI.showGoal('🛰️');   // after showSpace so the HUD (and the card) exists
  }
  // buddies to show in orbit: this pilot's, or everyone's if the shared family
  // world is on (IMPROVEMENT_PLAN 3.5). Current pilot's live save wins.
  function worldDeliveries() {
    if (!CONFIG.familyWorld) return G.save.deliveries || [];
    var all = [];
    CONFIG.profiles.forEach(function (pr) {
      var list = (pr.id === G.profile.id) ? G.save.deliveries
               : (function () { var sv = Persist.load(pr.id); return sv && sv.deliveries; })();
      if (list && list.length) all = all.concat(list);
    });
    return all;
  }
  function decoratePlanets(s) {
    var byPlanet = {};
    worldDeliveries().forEach(function (d) { (byPlanet[d.planetId] = byPlanet[d.planetId] || []).push(d); });
    Object.keys(s.planets).forEach(function (k) {
      var po = s.planets[k]; if (po.decorated) { po.grp.remove(po.decorated); }
      var list = byPlanet[k]; if (!list || !list.length) return;
      var deco = new THREE.Group();
      list.slice(0, 8).forEach(function (d, i) {
        var def = CONFIG.creatures.filter(function (c) { return c.id === d.creatureId; })[0]; if (!def) return;
        var m = new THREE.Mesh(new THREE.SphereGeometry(po.p.size * 0.12, 8, 6), mat(def.color, false));
        var a = i / 8 * TAU; m.position.set(Math.cos(a) * po.p.size * 1.05, Math.sin(a * 1.3) * po.p.size * 0.5, Math.sin(a) * po.p.size * 1.05);
        deco.add(m);
      });
      po.grp.add(deco); po.decorated = deco;
    });
  }
  function buildRoute(s, tp) {
    while (s.rocks.children.length) s.rocks.remove(s.rocks.children[0]);
    while (s.gems.children.length) s.gems.remove(s.gems.children[0]);
    var seed = Math.floor(Math.abs(tp[0]) + Math.abs(tp[2]));
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var dir = new THREE.Vector3(tp[0], tp[1], tp[2]).normalize();
    for (var i = 0; i < 16; i++) {
      var t = 0.15 + rnd() * 0.7;
      var base = new THREE.Vector3(tp[0] * t, tp[1] * t, tp[2] * t);
      var off = new THREE.Vector3((rnd() - 0.5) * 900, (rnd() - 0.5) * 700, (rnd() - 0.5) * 900);
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(20 + rnd() * 45, 0), mat(shade('#8a7f74', (rnd() - 0.5) * 0.4)));
      rock.position.copy(base).add(off); rock.userData.spin = new THREE.Vector3(rnd(), rnd(), rnd()).multiplyScalar(0.4);
      s.rocks.add(rock);
    }
    for (var j = 0; j < 14; j++) {
      var t2 = 0.12 + rnd() * 0.75;
      var gem = new THREE.Mesh(new THREE.OctahedronGeometry(14, 0), new THREE.MeshBasicMaterial({ color: 0xffe66a, fog: false }));
      gem.position.set(tp[0] * t2 + (rnd() - 0.5) * 500, tp[1] * t2 + (rnd() - 0.5) * 400, tp[2] * t2 + (rnd() - 0.5) * 500);
      gem.userData.gem = true; s.gems.add(gem);
    }
  }
  var _dqp = new THREE.Quaternion(), _dqy = new THREE.Quaternion(), AXx = new THREE.Vector3(1, 0, 0), AXy = new THREE.Vector3(0, 1, 0);
  var _right = new THREE.Vector3(), _up = new THREE.Vector3(), _lookM = new THREE.Matrix4(), WORLD_UP = new THREE.Vector3(0, 1, 0);
  // point the ship at a world target (fixed per leg) — you translate, not rotate
  function faceTarget(s, t) { _lookM.lookAt(s.pos, t, WORLD_UP); s.q.setFromRotationMatrix(_lookM); s.fwd.set(0, 0, -1).applyQuaternion(s.q); }
  function updateSpace(dt) {
    var s = space; if (!s) return;

    // --- docking sequence: controls paused, the game glides you in ---------
    if (G.dockState === 'docking' || G.dockState === 'docked') {
      G.dockT += dt;
      s.station.userData.wheel.rotation.z += dt * 0.12;
      if (G.dockState === 'docking') {
        s.vel.set(0, 0, 0);
        s.pos.lerp(s.dockPos, clamp(2.2 * dt, 0, 1));
        if (G.dockT >= 1.1) {
          G.dockState = 'docked'; G.dockT = 0;
          Audio.clunk(); Audio.chime(true); spawnSparks(s);
          award('dock');                     // matched speeds and docked (3.3)
        }
      } else if (G.dockT >= 2.4) {
        // auto-undock: a push-off back out of the port, then on to the planet
        G.dockState = 'toPlanet';
        Audio.undockHiss();
        var out = s.dockPos.clone().sub(s.station.position).normalize();
        s.vel.copy(out.multiplyScalar(30));
        faceTarget(s, new THREE.Vector3(G.planet.pos[0], G.planet.pos[1], G.planet.pos[2])); // now face the planet
        UI.showGoal('🪐');
      }
      stepSparks(s, dt);
      Audio.rumbleTo(0);
      camera.position.copy(s.pos); camera.quaternion.copy(s.q);
      return;
    }
    // --- RCS translation controls -----------------------------------------
    // The ship holds a fixed orientation facing the current goal (set on each
    // leg). You SLIDE it with the left pad (up/down/left/right) and push in/out
    // with the right fore/aft control — real docking, no rotation to fight.
    var boost = G.switches.warp ? 1.8 : 1;
    s.fwd.set(0, 0, -1).applyQuaternion(s.q);
    _right.set(1, 0, 0).applyQuaternion(s.q);
    _up.set(0, 1, 0).applyQuaternion(s.q);
    var acc = SPACE.C.SPACE_ACCEL * boost, rcs = SPACE.C.RCS_ACCEL * boost, firing = false;
    if (s.thrusting) { s.vel.addScaledVector(s.fwd, acc * dt); firing = true; }        // fore
    if (s.braking)   { s.vel.addScaledVector(s.fwd, -acc * dt); firing = true; }       // aft (retro)
    if (G.transX)    { s.vel.addScaledVector(_right, G.transX * rcs * dt); firing = true; }
    if (G.transY)    { s.vel.addScaledVector(_up, G.transY * rcs * dt); firing = true; }
    if (firing) { Audio.hiss(1); Audio.rumbleTo(0.35); } else Audio.rumbleTo(0.05);
    // Newton coasts (tiny damping only, so cutting thrust keeps you drifting —
    // the lesson); use aft to actually slow down.
    s.vel.multiplyScalar(1 - SPACE.C.SPACE_DAMP * dt);
    if (s.vel.length() > SPACE.C.SPACE_VMAX * boost) s.vel.setLength(SPACE.C.SPACE_VMAX * boost);
    s.pos.addScaledVector(s.vel, dt);
    // soft tether
    var d = s.pos.length(); if (d > SPACE.C.TETHER_R) { s.pos.multiplyScalar(SPACE.C.TETHER_R / d); s.vel.multiplyScalar(0.5); }
    // asteroids: comedy bonk
    for (var i = 0; i < s.rocks.children.length; i++) { var r = s.rocks.children[i]; r.rotation.x += r.userData.spin.x * dt; r.rotation.y += r.userData.spin.y * dt; if (s.pos.distanceTo(r.position) < 55) { Audio.boing(); var push = s.pos.clone().sub(r.position).setLength(60); s.vel.addScaledVector(push, 1); s.vel.multiplyScalar(0.6); } }
    // gems: collect -> trip counter + a permanent star toward the constellations
    for (var j = s.gems.children.length - 1; j >= 0; j--) { var gm = s.gems.children[j]; gm.rotation.y += dt * 2; gm.position.y += Math.sin(G.t * 2 + j) * dt * 3; if (s.pos.distanceTo(gm.position) < 60) { s.gems.remove(gm); G.collected++; UI.setStars(G.collected); UI.lightDashBulb(G.collected); onStarCollected(s); } }
    // completed constellations gently pulse up in the sky
    if (s.constGlow.length) { var op = 0.72 + Math.sin(G.t * 2) * 0.28; for (var ci = 0; ci < s.constGlow.length; ci++) s.constGlow[ci].opacity = op; }
    // beacon pulse + planet spin (destination ring stays dim while the station
    // is the goal, then brightens for leg two)
    Object.keys(s.planets).forEach(function (k) { var po = s.planets[k]; po.grp.rotation.y += dt * 0.05; if (po.ring.visible) { var base = G.dockState === 'toStation' ? 0.10 : 0.4; po.ring.userData.mat.opacity = base + Math.sin(G.t * 3) * base * 0.5; po.ring.lookAt(s.pos); } });

    // --- the station: leg one's goal. Ring = speed light: green means "slow
    // enough to dock", amber means "too hot". Gentle arrival docks; a hot one
    // boings you back out to try again slower (matching speeds IS the lesson).
    s.station.userData.wheel.rotation.z += dt * 0.12;
    var spd = s.vel.length();
    var canDock = spd <= SPACE.C.DOCK_SPEED;
    if (G.dockState === 'toStation') {
      var rm = s.station.userData.ringMat;
      rm.color.set(canDock ? '#7fd858' : '#ffb01a');
      rm.opacity = 0.55 + Math.sin(G.t * (canDock ? 3 : 9)) * 0.3;
      if (G.bounceCool > 0) G.bounceCool -= dt;
      var dd = s.pos.distanceTo(s.dockPos);
      if (dd < SPACE.C.DOCK_RADIUS) {
        if (canDock) { G.dockState = 'docking'; G.dockT = 0; }
        else if (G.bounceCool <= 0) {
          Audio.boing(); G.bounceCool = 1.2;
          var away = s.pos.clone().sub(s.dockPos).normalize();
          s.vel.copy(away.multiplyScalar(spd * 0.6 + 26));
        }
      }
    }
    stepSparks(s, dt);

    // DSKY speed readout (Apollo panel): shows current speed; green while the
    // station leg is on and you're slow enough to dock, amber when too hot.
    UI.updateDsky(s.vel.length(), G.dockState === 'toStation' && s.vel.length() <= SPACE.C.DOCK_SPEED, G.dockState === 'toStation');

    // warp field
    s.warp.visible = G.switches.warp; if (G.switches.warp) { s.warp.position.copy(s.pos); s.warp.rotation.z += dt * 2; }
    // camera = cockpit (a touch behind the eye-point for a hint of nose)
    camera.position.copy(s.pos); camera.quaternion.copy(s.q);
    // nav chevron: the station first, then the planet (colour matches the goal)
    var navTarget = G.dockState === 'toStation'
      ? { pos: [s.dockPos.x, s.dockPos.y, s.dockPos.z], color: canDock ? '#7fd858' : '#ffb01a' }
      : G.planet;
    UI.updateSpaceHud(camera, navTarget, s.pos, 0);
    // approach destination -> land (never gated on docking — a kid who blasts
    // straight past the station can still finish the mission)
    var dp = s.pos.distanceTo(new THREE.Vector3(G.planet.pos[0], G.planet.pos[1], G.planet.pos[2]));
    if (dp < G.planet.size + SPACE.C.APPROACH_R) { enterLanding(); return; }
  }

  function spawnSparks(s) {
    for (var i = 0; i < 14; i++) {
      var m = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('hsl(' + (i * 26 % 360) + ',85%,65%)'), fog: false }));
      m.position.copy(s.dockPos);
      s.sc.add(m);
      var a = i / 14 * TAU;
      s.sparks.push({ m: m, vel: new THREE.Vector3(Math.cos(a) * 24, (i % 5 - 2) * 8, Math.sin(a) * 24), life: 1.1 });
    }
  }
  function stepSparks(s, dt) {
    for (var i = s.sparks.length - 1; i >= 0; i--) {
      var p = s.sparks[i];
      p.m.position.addScaledVector(p.vel, dt); p.m.rotation.x += dt * 6; p.life -= dt;
      if (p.life <= 0) { s.sc.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); s.sparks.splice(i, 1); }
    }
  }

  /* ---- constellations: the night sky the child builds (persistent) -------- */
  // Draw every started/completed constellation into the sky from save.stars.
  function buildConstellations(s) {
    if (s.constLayer) { s.sc.remove(s.constLayer); }
    var layer = new THREE.Group(); s.sc.add(layer); s.constLayer = layer; s.constGlow = [];
    var stars = (G.save && G.save.stars) || 0;
    var R = 7200, SZ = 640;
    var offset = 0, current = firstUnfinished(stars);
    CONFIG.constellations.forEach(function (c, ci) {
      var L = c.points.length;
      var lit = clamp(stars - offset, 0, L); offset += L;
      var completed = lit === L;
      var isCurrent = ci === current;
      if (lit === 0 && !isCurrent) return;   // not started and not the goal yet

      var g = new THREE.Group();
      var dir = new THREE.Vector3(c.dir[0], c.dir[1], c.dir[2]).normalize();
      g.position.copy(dir.multiplyScalar(R)); g.lookAt(0, 0, 0);
      // lines first (behind points)
      for (var k = 0; k < L; k++) {
        var a = k, b = (k + 1) % L;
        if (!(a < lit && b < lit)) continue;   // both endpoints lit (wrap only when full)
        var geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(c.points[a][0] * SZ, c.points[a][1] * SZ, 0),
          new THREE.Vector3(c.points[b][0] * SZ, c.points[b][1] * SZ, 0)]);
        var lm = new THREE.LineBasicMaterial({ color: new THREE.Color(completed ? '#ffe066' : '#ffffff'), transparent: true, opacity: completed ? 0.9 : 0.7, fog: false });
        g.add(new THREE.Line(geo, lm));
        if (completed) s.constGlow.push(lm);
      }
      // points
      c.points.forEach(function (p, j) {
        var on = j < lit;
        var col = completed ? '#ffe066' : (on ? '#ffffff' : '#39415c');
        var m = new THREE.Mesh(new THREE.SphereGeometry(on || completed ? 26 : 15, 8, 6),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: on || completed ? 1 : 0.4, fog: false }));
        m.position.set(p[0] * SZ, p[1] * SZ, 0); g.add(m);
        if (completed) s.constGlow.push(m.material);
      });
      layer.add(g);
    });
  }
  function firstUnfinished(stars) {
    var cum = 0;
    for (var i = 0; i < CONFIG.constellations.length; i++) {
      cum += CONFIG.constellations[i].points.length;
      if (stars < cum) return i;
    }
    return -1;   // all done
  }
  // one gem collected -> one permanent star; light it, redraw, celebrate a
  // finished picture. Extra stars past the last constellation just chime.
  function onStarCollected(s) {
    var before = (G.save.stars || 0);
    if (before >= CONFIG.constTotal) { Audio.star(); return; }
    G.save.stars = before + 1; Persist.save(G.save);
    // did this star complete a constellation?
    var cum = 0, done = null;
    CONFIG.constellations.forEach(function (c) { cum += c.points.length; if (G.save.stars === cum && before < cum) done = c; });
    buildConstellations(s); UI.drawChart();
    if (done) { Audio.chime(true); UI.showGoal(done.icon); award('constellation'); } // finished a picture (3.3)
    else { Audio.star(); }
  }
  App.testAddStar = function () { if (space) onStarCollected(space); };
  App.testStarState = function () { return { stars: (G.save && G.save.stars) || 0, total: CONFIG.constTotal }; };

  /* ==================================================================
   * LANDING STAGE  (3/4 external view, retro-burn)
   * ================================================================== */
  var landing = null;
  function buildLanding() {
    var sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#ffffff', '#333', 1.0));
    var sun = new THREE.DirectionalLight('#fff', 0.9); sun.position.set(-1, 1, 0.5); sc.add(sun);
    var stars = makeStars(500, 8000); sc.add(stars);
    var ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 40), mat('#c2523a')); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    var pad = new THREE.Mesh(new THREE.CylinderGeometry(26, 30, 3, 20), mat('#8a8f98', false)); pad.position.y = 1.5; sc.add(pad);
    var lander = makeLander('#ff8a3d'); sc.add(lander);
    landing = { sc: sc, ground: ground, pad: pad, lander: lander, stars: stars, y: 0, vy: 0, x: 0, vx: 0, padX: 0, done: false, delivered: null, puffs: [] };
    return sc;
  }
  function enterLanding() {
    if (!landing) buildLanding();
    G.stageName = 'landing'; G.running = true;
    var l = landing;
    l.sc.background = new THREE.Color(G.planet.sky);
    l.ground.material.color = new THREE.Color(G.planet.ground);
    // the touchdown pad sits off to one side — steer left/right to find it
    l.padX = (Math.random() * 2 - 1) * 120;
    l.pad.position.x = l.padX;
    l.y = SPACE.C.ALT_LAND_START; l.vy = SPACE.C.VY_LAND_START; l.x = 0; l.vx = 0; l.done = false; l.delivered = null;
    if (l.hopper) { l.sc.remove(l.hopper); l.hopper = null; }
    l.lander.visible = true; l.lander.position.set(l.x, l.y, 0); l.lander.rotation.set(0, 0, 0);
    G.throttle = 0;
    scenes.landing = l.sc;
    UI.showLanding();
  }
  function updateLanding(dt) {
    var l = landing; if (!l) return;
    var mass = 1.0 + (G.buddy ? G.buddy.mass : 0);
    if (!l.done) {
      var thr = G.throttle;                                   // the raw lever (0..1)
      Audio.rumbleTo(thr * 0.8);
      // hover-centred lever -> actual throttle: middle of the lever holds
      // altitude, so small nudges make small, controllable changes
      var hov = SPACE.hoverThrottle(mass, G.planet.gravity);
      var eff = SPACE.leverToThrottle(thr, hov);
      var a = SPACE.landingAccel(eff, mass, G.planet.gravity);
      l.vy += a * dt; l.y += l.vy * dt;
      // small lateral nudge to line up with the pad (x=0)
      l.vx += (G.nudge * 14) * dt; l.vx *= (1 - 1.2 * dt); l.x += l.vx * dt;
      // flame
      var fl = 0.2 + thr * 1.2; l.lander.userData.flame.scale.set(1, fl, 1); l.lander.userData.flame.visible = thr > 0.02;
      // gauges: altitude + descent rate, and the steer-to-pad alignment strip
      UI.updateLander(clamp(l.y / SPACE.C.ALT_LAND_START, 0, 1), l.vy,
                      clamp((l.x - l.padX) / 200, -1, 1), Math.abs(l.x - l.padX) < 30);
      if (l.y <= 0) { l.y = 0; touchdown(l); }
    }
    l.lander.position.set(l.x, Math.max(l.y, 0), 0);
    l.lander.rotation.z = clamp(-l.vx * 0.02, -0.3, 0.3);
    // dust puffs
    for (var i = l.puffs.length - 1; i >= 0; i--) { var p = l.puffs[i]; p.m.position.addScaledVector(p.vel, dt); p.life -= dt; p.m.material.opacity = Math.max(0, p.life); if (p.life <= 0) { l.sc.remove(p.m); l.puffs.splice(i, 1); } }
    if (l.hopper) { l.hopper.userData.t += dt; var hp = l.hopper; hp.userData.waveArm.rotation.z = -2 + Math.sin(hp.userData.t * 10) * 0.6; }
    // camera: 3/4 view, follows descent
    var cy = Math.max(l.y, 0) + 18;
    camera.position.set(l.x + 34, cy + 22, 60);
    camera.lookAt(l.x, Math.max(l.y, 6), 0);
  }
  // award a mission patch (once) — new badge -> persist + a fly-in toast
  function award(id) {
    if (!G.save) return;
    if (!G.save.patches) G.save.patches = [];
    if (G.save.patches.indexOf(id) >= 0) return;
    var def = patchById(id); if (!def) return;
    G.save.patches.push(id); Persist.save(G.save); UI.patchEarned(def);
  }

  function touchdown(l) {
    l.done = true;
    var tier = SPACE.landingTier(l.vy);
    dust(l, tier === 'bounce' ? 16 : 8);
    Audio.thump();
    if (tier === 'bounce') { Audio.boing(); l.lander.position.y = 6; l.bounce = 1; } // little squash-bounce, still lands
    var onPad = Math.abs(l.x - l.padX) < 30;      // touched down on the pad?
    var big = tier === 'soft' && onPad;           // soft AND on the pad = confetti
    Audio.chime(big);
    if (big) confetti(l);
    // buddy hops out and waves
    var def = G.buddy;
    var hop = makeCreature(def); hop.scale.setScalar(3.2 * def.scale); hop.position.set(l.x + 6, 0, 6); hop.userData.t = 0; l.sc.add(hop); l.hopper = hop;
    // record delivery
    var rec = { creatureId: def.id, planetId: G.planet.id, tier: tier, ts: 0 };
    G.save.deliveries.push(rec); G.save.missions = (G.save.missions || 0) + 1; Persist.save(G.save);
    UI.deliveryBanner(big ? 'bull' : tier === 'bounce' ? 'ok' : 'close');
    // mission patches (IMPROVEMENT_PLAN 3.3)
    if (G.planet && patchById(G.planet.id)) award(G.planet.id);   // the planet patch
    if (tier === 'soft') award('feather');                        // softest touchdown
    if (def.mass >= HEAVY_MASS - 1e-6) award('heavy');            // landed the biggest buddy
    setTimeout(function () { UI.showAfterLanding(); }, 2200);
  }
  function dust(l, n) { for (var i = 0; i < n; i++) { var m = new THREE.Mesh(new THREE.SphereGeometry(2 + (i % 3), 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(shade(G.planet.ground, 0.3)), transparent: true, opacity: 0.8, fog: false })); m.position.set(l.x, 1, 0); var a = i / n * TAU; l.sc.add(m); l.puffs.push({ m: m, vel: new THREE.Vector3(Math.cos(a) * 16, 6 + i, Math.sin(a) * 16), life: 1 }); } }
  function confetti(l) { for (var i = 0; i < 40; i++) { var hue = (i * 37) % 360; var m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color('hsl(' + hue + ',85%,60%)'), fog: false })); m.position.set(l.x, 8, 0); var a = i / 40 * TAU, sp = 14 + (i % 5) * 5; l.sc.add(m); l.puffs.push({ m: m, vel: new THREE.Vector3(Math.cos(a) * sp, 24 + (i % 6) * 3, Math.sin(a) * sp), life: 1.6 }); } }

  /* ==================================================================
   * flow between stages / menus
   * ================================================================== */
  function chooseProfile(p) {
    Audio.unlock(); G.profile = p; G.save = Persist.load(p.id) || Persist.blank(p);
    if (!G.save.patches) G.save.patches = [];       // older saves predate patches
    G.stageName = 'hangar'; G.running = false; UI.showHangar();
  }
  function chooseBuddy(def) { G.buddy = def; G.stageName = 'map'; G.running = false; UI.showMap(); }
  function choosePlanet(p) { G.planet = p; enterLaunch(); }
  function afterLanding() { G.stageName = 'map'; G.running = false; Audio.rumbleTo(0); UI.showMap(); } // fly another mission

  // stage transitions set which scene renders + running flag
  function setStage(name) { G.stageName = name; G.running = (name === 'launch' || name === 'space' || name === 'landing'); }
  App.enterSpaceDirect = function () { setStage('space'); enterSpace(); }; // test hook

  /* ==================================================================
   * input
   * ================================================================== */
  var stickId = -1, stickOX = 0, stickOY = 0;
  G.stickX = 0; G.stickY = 0; G.nudge = 0; G.transX = 0; G.transY = 0;
  function onDown(e) {
    Audio.unlock();
    if (e.target && e.target.dataset && e.target.dataset.btn) return;
    // (space steering is now the on-screen RCS pad + fore/aft buttons — no
    // free-floating nose stick)
    e.preventDefault();
  }
  function onMove(e) {
    if (e.pointerId === stickId) {
      var dx = clamp((e.clientX - stickOX) / 120, -1, 1), dy = clamp((e.clientY - stickOY) / 120, -1, 1);
      G.stickX = dx; G.stickY = dy; UI.moveStick(stickOX + dx * 120, stickOY + dy * 120); e.preventDefault();
    }
  }
  function onUp(e) { if (e.pointerId === stickId) { stickId = -1; G.stickX = 0; G.stickY = 0; UI.hideStick(); } }
  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  // iOS: kill pinch-zoom, double-tap-zoom and rubber-band scroll so a touch only
  // ever flies the craft. A stray pinch would zoom the page and turn every drag
  // into a scroll instead of a control.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  var _lastTap = 0;
  document.addEventListener('touchend', function (e) { var n = Date.now(); if (n - _lastTap < 350) e.preventDefault(); _lastTap = n; }, { passive: false });

  /* ==================================================================
   * loop
   * ================================================================== */
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05); G.t += dt;
    if (!UI.portrait) {
      if (G.stageName === 'launch') updateLaunch(dt);
      else if (G.stageName === 'space') updateSpace(dt);
      else if (G.stageName === 'landing') updateLanding(dt);
      else Audio.rumbleTo(0);
    }
    var sc = scenes[G.stageName];
    if (sc) renderer.render(sc, camera);
  }

  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); UI.checkPortrait(); }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);

  // expose actions to UI + tests
  App.actions = {
    chooseProfile: chooseProfile, chooseBuddy: chooseBuddy, choosePlanet: choosePlanet,
    ignite: function () { G.ignited = true; Audio.unlock(); },  // direct release (used by tests)
    startCountdown: function () {
      Audio.unlock();
      if (!launch || launch.count > 0 || G.ignited) return;
      launch.count = 5.0; G.throttle = 1;   // throttle starts full; the lever can trim it mid-climb
      UI.setCountdown(5); Audio.countBeep(false);
    },
    setThrottle: function (v) { G.throttle = clamp(v, 0, 1); },
    setThrust: function (on) { if (space) space.thrusting = on; },       // fore
    setBrake: function (on) { if (space) space.braking = on; },          // aft (retro)
    setTranslate: function (x, y) { G.transX = clamp(x, -1, 1); G.transY = clamp(y, -1, 1); }, // RCS up/down/left/right
    setPitch: function (v) { G.pitch = clamp(v, -1, 1); },     // launch attitude tilt
    setNudge: function (v) { G.nudge = clamp(v, -1, 1); },
    toggleSwitch: function (name) {
      G.switches[name] = !G.switches[name]; Audio.unlock(); Audio.click();
      if (name === 'comms') Audio.toggleComms(G.switches.comms);
      if (name === 'music') Audio.toggleMusic(G.switches.music);
      if (name === 'warp' && G.switches.warp) Audio.warp();
      return G.switches[name];
    },
    afterLanding: afterLanding, backToMap: function () { UI.showMap(); }
  };
  App.setStage = setStage;
  App.testWorldDeliveries = function () { return worldDeliveries().length; }; // family-world test hook
  // headless-test hook: jump the ship near the current destination so the
  // approach->landing transition fires without flying the full distance.
  App.testWarpToPlanet = function () { if (space && G.planet) { var tp = G.planet.pos; space.pos.set(tp[0] * 0.86, tp[1] * 0.86, tp[2] * 0.86); } };
  App.testLandingState = function () { return landing ? { y: landing.y, vy: landing.vy, x: landing.x, padX: landing.padX, done: landing.done } : null; };
  App.testLaunchState = function () { return launch ? { y: launch.y, vy: launch.vy, sep: launch.sep, ignited: G.ignited, count: launch.count, enginesLit: launch.enginesLit, wingsOut: launch.wingsOut, att: launch.att, cloudsPierced: launch.clouds ? launch.clouds.userData.pierced : false, birdsScattered: launch.birds ? launch.birds.userData.scattered : false } : null; };
  App.testDockSpeed = function () { return space ? space.vel.length() : null; };
  App.testBrakeSetup = function (v) { if (space) { space.pos.set(0, 0, 0); space.fwd.set(0, 0, -1).applyQuaternion(space.q); space.vel.copy(space.fwd).multiplyScalar(v); } }; // approach speed along the facing — aft thrust slows it
  App.testWarpToSpace = function () { if (launch) { launch.y = SPACE.C.ALT_SPACE - 15; launch.vy = 120; } }; // skip the climb in tests
  App.testWarpToStation = function () { if (space) { var d = space.dockPos; var back = d.clone().normalize().multiplyScalar(-160); space.pos.copy(d).add(back); space.vel.set(0, 0, 0); } };
  App.testDockState = function () { return space ? { state: G.dockState, dist: space.pos.distanceTo(space.dockPos), speed: space.vel.length() } : null; };
  App.testSetVelTowardDock = function (speed) {
    if (!space) return;
    var dir = space.dockPos.clone().sub(space.pos).normalize();
    space.vel.copy(dir.clone().multiplyScalar(speed));
    // aim the nose too (drift alignment would otherwise bend the path away)
    space.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(space.pos, space.dockPos, new THREE.Vector3(0, 1, 0)));
    space.fwd.set(0, 0, -1).applyQuaternion(space.q);
  };

  UI.init(App, CONFIG);
  resize(); UI.showProfile(); frame();
}

/* ============================================================================
 * UI  —  DOM overlays for every stage. Built in JS; styling in spaceshell.html.
 * ==========================================================================*/
var UI = (function () {
  var app, cfg, root, screens = {}, portrait = false, preview;
  var stickEl, chevronEl, dash = {}, throttleFill, launchSetVisual;

  function el(t, c, p) { var e = document.createElement(t); if (c) e.className = c; if (p) p.appendChild(e); return e; }
  function init(a, c) { app = a; cfg = c; root = document.getElementById('ui'); buildPortrait(); }

  function previewURL(buildFn, size) {
    size = size || 220;
    if (!preview) { preview = new THREE.WebGLRenderer({ antialias: true, alpha: true }); preview.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); preview.outputEncoding = THREE.sRGBEncoding; }
    preview.setSize(size, size);
    var s = new THREE.Scene(); s.add(new THREE.HemisphereLight('#fff', '#556', 1.2)); var d = new THREE.DirectionalLight('#fff', 0.8); d.position.set(2, 3, 2); s.add(d);
    var o = buildFn(); s.add(o);
    var box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    var maxD = Math.max(sz.x, sz.y, sz.z), fov = 34, dist = (maxD * 0.5) / Math.tan(fov * 0.5 * DEG) * 1.5;
    var cam = new THREE.PerspectiveCamera(fov, 1, Math.max(0.05, dist * 0.01), dist * 6 + maxD * 4);
    cam.position.copy(c).add(new THREE.Vector3(0.9, 0.55, 1.7).normalize().multiplyScalar(dist)); cam.lookAt(c);
    preview.render(s, cam); return preview.domElement.toDataURL('image/png');
  }

  function hideAll() { Object.keys(screens).forEach(function (k) { if (screens[k] && screens[k].style) screens[k].style.display = 'none'; }); if (chevronEl) chevronEl.style.display = 'none'; if (stickEl) stickEl.style.display = 'none'; }

  /* ---- profile ---- */
  function showProfile() { hideAll(); if (!screens.profile) screens.profile = buildProfile(); screens.profile.style.display = 'flex'; }
  function buildProfile() {
    var sc = el('div', 'screen center space-bg', root); el('div', 'bigtitle', sc).textContent = 'Who is flying?';
    var row = el('div', 'cardrow', sc);
    cfg.profiles.forEach(function (p) { var card = el('button', 'pilotcard', row); card.style.background = p.color; el('div', 'picon', card).textContent = p.icon; el('div', 'pname', card).textContent = p.name; card.onclick = function () { app.actions.chooseProfile(p); }; });
    return sc;
  }

  /* ---- hangar (buddy) ---- */
  function showHangar() { hideAll(); if (screens.hangar) screens.hangar.remove(); screens.hangar = buildHangar(); root.appendChild(screens.hangar); screens.hangar.style.display = 'flex'; }
  function buildHangar() {
    var sc = el('div', 'screen center space-bg'); el('div', 'bigtitle', sc).textContent = 'Pick your buddy';
    var row = el('div', 'cardrow wrap', sc);
    cfg.creatures.forEach(function (def) { var card = el('button', 'creaturecard', row); var s = 120 + def.mass * 150; card.style.width = s + 'px'; card.style.height = (s + 40) + 'px'; var img = el('img', 'cimg', card); try { img.src = previewURL(function () { return makeCreature(def); }, 220); } catch (e) {} var pips = el('div', 'pips', card); var n = Math.round(def.mass / 0.2) + 1; for (var i = 0; i < n; i++) { el('span', 'pip', pips).style.background = def.color; } card.onclick = function () { app.actions.chooseBuddy(def); }; });
    // trophy room: a corner badge opens the patch wall (3.3)
    var trophy = el('button', 'cornerbtn', sc); trophy.dataset.btn = '1'; trophy.textContent = '🏅';
    trophy.onclick = function () { showPatches(); };
    return sc;
  }

  /* ---- mission patches: the trophy wall (3.3) ---- */
  function showPatches() {
    hideAll();
    if (screens.patches) screens.patches.remove();
    screens.patches = buildPatches(); root.appendChild(screens.patches); screens.patches.style.display = 'flex';
  }
  function buildPatches() {
    var earned = (app.G.save && app.G.save.patches) || [];
    var sc = el('div', 'screen center space-bg'); el('div', 'bigtitle', sc).textContent = 'My Patches';
    var grid = el('div', 'patchgrid', sc);
    PATCHES.forEach(function (p) {
      var b = el('div', 'patch' + (earned.indexOf(p.id) >= 0 ? '' : ' locked'), grid);
      b.style.setProperty('--ring', p.ring); b.textContent = p.icon;
    });
    var back = el('button', 'patchback', sc); back.dataset.btn = '1'; back.textContent = '🏠';
    back.onclick = function () { showHangar(); };
    return sc;
  }
  var toastWrap = null, toastTimer = null;
  function patchEarned(def) {
    if (!toastWrap) toastWrap = el('div', 'patchtoasts', root);
    var t = el('div', 'patchtoast', toastWrap); t.style.setProperty('--ring', def.ring); t.textContent = def.icon;
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (!toastWrap) return; var w = toastWrap; toastWrap = null; w.classList.add('out');
      setTimeout(function () { w.remove(); }, 520);
    }, 2000);
  }

  /* ---- map (planet) ---- */
  function showMap() { hideAll(); if (screens.map) screens.map.remove(); screens.map = buildMap(); root.appendChild(screens.map); screens.map.style.display = 'flex'; }
  function buildMap() {
    var sc = el('div', 'screen center space-bg'); el('div', 'bigtitle', sc).textContent = 'Where to?';
    var row = el('div', 'cardrow wrap', sc);
    cfg.planets.forEach(function (p) {
      var card = el('button', 'destcard', row); card.style.borderColor = p.color; card.style.background = shade(p.color, 0.86).getStyle();
      var img = el('img', 'cimg', card); try { img.src = previewURL(function () { var o = makePlanet(p); return o; }, 240); } catch (e) {}
      // gravity pips — the same countable-dot language as buddy weight: more
      // dots = this world pulls harder = burn harder to land soft (§ landing)
      var pips = el('div', 'pips', card);
      var n = Math.max(1, Math.round(p.gravity / 1.6));
      for (var i = 0; i < n; i++) { el('span', 'pip', pips).style.background = shade(p.color, -0.25).getStyle(); }
      el('div', 'destname', card).textContent = p.label;
      card.onclick = function () { app.actions.choosePlanet(p); };
    });
    return sc;
  }

  /* ---- launch HUD ---- */
  function buildLaunchHud() {
    var hud = el('div', 'hud', root); screens.launch = hud; hud.style.display = 'none';
    // vertical throttle lever — drag up for more thrust. It does NOT light the
    // engines; the big LAUNCH button does, so the flow is: press LAUNCH, then
    // fly the climb with the lever.
    var wrap = el('div', 'throttle', hud); wrap.dataset.btn = '1';
    throttleFill = el('div', 'throttle-fill', wrap);
    var knob = el('div', 'throttle-knob', wrap);
    function setVisual(v) { throttleFill.style.height = (v * 100) + '%'; knob.style.bottom = 'calc(' + (v * 100) + '% - 22px)'; }
    launchSetVisual = setVisual;
    var dragging = false;
    function setFromY(clientY) { var r = wrap.getBoundingClientRect(); var v = clamp(1 - (clientY - r.top) / r.height, 0, 1); app.actions.setThrottle(v); setVisual(v); }
    wrap.addEventListener('pointerdown', function (e) { e.stopPropagation(); dragging = true; setFromY(e.clientY); });
    window.addEventListener('pointermove', function (e) { if (dragging) setFromY(e.clientY); });
    window.addEventListener('pointerup', function () { dragging = false; });
    // big LAUNCH button: lights the engines and throttles up to full, then the
    // lever takes over. Disappears once pressed.
    var lb = el('button', 'launchbtn', hud); lb.dataset.btn = '1'; lb.textContent = '🚀'; screens._launchBtn = lb;
    lb.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.startCountdown(); setVisual(1); lb.classList.add('gone'); });
    el('div', 'hint hint-launch', hud).textContent = '⬆';
    // attitude indicator (top-centre): keep the 🚀 marker in the green zone by
    // tilting — a wordless "fly it straight". Green when aligned, amber when off.
    var att = el('div', 'attind', hud); screens._attind = att;
    el('div', 'attind-zone', att);
    dash.attMarker = el('div', 'attind-marker', att);   // a CSS triangle (recolours)
    // tilt control (bottom-right; the throttle lever is on the left)
    var tilt = el('div', 'tilt', hud);
    var tl = el('button', 'tiltbtn', tilt); tl.dataset.btn = '1'; tl.textContent = '◀';
    var tr = el('button', 'tiltbtn', tilt); tr.dataset.btn = '1'; tr.textContent = '▶';
    tl.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setPitch(-1); tl.classList.add('on'); });
    tr.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setPitch(1); tr.classList.add('on'); });
    window.addEventListener('pointerup', function () { app.actions.setPitch(0); tl.classList.remove('on'); tr.classList.remove('on'); });
    // giant countdown number, dead centre
    var cn = el('div', 'countnum', hud); cn.style.display = 'none'; screens._count = cn;
  }
  // move the attitude marker (norm in [-1,1]) and colour it by alignment
  function updateAttitude(norm, ok) {
    if (!dash.attMarker) return;
    dash.attMarker.style.left = (50 + clamp(norm, -1, 1) * 44) + '%';
    dash.attMarker.classList.toggle('ok', !!ok);
    if (screens._attind) screens._attind.classList.toggle('ok', !!ok);
  }
  function showLaunch() {
    hideAll(); if (!screens.launch) buildLaunchHud(); screens.launch.style.display = 'block';
    if (screens._launchBtn) screens._launchBtn.classList.remove('gone');
    if (screens._count) screens._count.style.display = 'none';
    if (launchSetVisual) launchSetVisual(0);
  }
  // n: 5..1 shows the number; 0 shows the liftoff rocket; null hides.
  function setCountdown(n) {
    var cn = screens._count; if (!cn) return;
    if (n === null) { cn.style.display = 'none'; return; }
    cn.style.display = 'flex';
    cn.textContent = n === 0 ? '🚀' : String(n);
    cn.classList.remove('tick'); void cn.offsetWidth; cn.classList.add('tick');
    if (n === 0) setTimeout(function () { cn.style.display = 'none'; }, 1400);
  }

  /* ---- space cockpit HUD ---- */
  function buildSpaceHud() {
    var hud = el('div', 'hud cockpit', root); screens.space = hud; hud.style.display = 'none';
    el('div', 'cockpit-frame', hud); // CSS window struts / vignette
    // chevron to destination
    chevronEl = el('div', 'chevron', hud); chevronEl.textContent = '▲'; chevronEl.style.display = 'none';
    // star counter
    dash.stars = el('div', 'starcount', hud); dash.stars.innerHTML = '⭐ 0';
    // corner star-chart: the constellation you're currently filling in
    dash.chart = el('canvas', 'starchart', hud); dash.chart.width = 128; dash.chart.height = 128;
    // --- Apollo-style console: metallic panel, round gauges, a DSKY speed
    // readout (green = slow enough to dock), and metallic toggle switches ---
    var panel = el('div', 'dashboard apollo', hud);
    // left cluster: two round gauges (the speed dial is live; the other is trim)
    var gl = el('div', 'gaugecluster', panel);
    dash.gaugeSpeed = makeGauge(gl); dash.gaugeTrim = makeGauge(gl);
    dash.gaugeTrim.needle.style.transform = 'rotate(-28deg)';   // static flavour
    // centre: the DSKY (numeric speed + dock/fast lamps)
    var dsky = el('div', 'dsky', panel);
    el('div', 'dsky-label', dsky).textContent = 'SPEED';        // for the grown-up
    dash.dskyNum = el('div', 'dsky-num', dsky); dash.dskyNum.textContent = '000';
    var lamps = el('div', 'dsky-lamps', dsky);
    dash.lampDock = el('div', 'dsky-lamp dock', lamps);
    dash.lampFast = el('div', 'dsky-lamp fast', lamps);
    // right cluster: the collectible bulbs + the toy toggle switches
    var rc = el('div', 'rightcluster', panel);
    dash.bulbs = el('div', 'bulbs', rc);
    for (var b = 0; b < 5; b++) { el('span', 'bulb', dash.bulbs); }
    var sw = el('div', 'switches', rc);
    var defs = [['light', '💡'], ['comms', '📡'], ['warp', '🌀'], ['map', '🗺️'], ['music', '🎵'], ['gear', '⚙️']];
    dash.switchEls = {};
    defs.forEach(function (d) { var btn = el('button', 'switch', sw); btn.dataset.btn = '1'; btn.textContent = d[1]; dash.switchEls[d[0]] = btn; btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); var on = app.actions.toggleSwitch(d[0]); btn.classList.toggle('on', on); applyCockpitLight(); }); });
    // alignment reticle (centre): line the goal ring up in the crosshair by
    // sliding — it locks green when you're centred on the dock
    dash.reticle = el('div', 'reticle', hud); dash.reticle.style.display = 'none';
    el('div', 'reticle-ring', dash.reticle);
    el('div', 'reticle-cross h', dash.reticle); el('div', 'reticle-cross v', dash.reticle);
    dash.reticleTgt = el('div', 'reticle-tgt', hud); dash.reticleTgt.style.display = 'none';
    // --- RCS translation pad (left): slide up / down / left / right ---
    var pad = el('div', 'rcs', hud);
    var tx = 0, ty = 0;
    function send() { app.actions.setTranslate(tx, ty); }
    [['up', 0, 1, '▲'], ['down', 0, -1, '▼'], ['left', -1, 0, '◀'], ['right', 1, 0, '▶']].forEach(function (d) {
      var btn = el('button', 'rcsbtn ' + d[0], pad); btn.dataset.btn = '1'; btn.textContent = d[3];
      btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); tx = d[1] || tx; ty = d[2] || ty; if (d[1]) tx = d[1]; if (d[2]) ty = d[2]; btn.classList.add('on'); send(); });
      var release = function () { if (d[1]) tx = 0; if (d[2]) ty = 0; btn.classList.remove('on'); send(); };
      btn.addEventListener('pointerup', release); btn.addEventListener('pointerleave', release); btn.addEventListener('pointercancel', release);
    });
    window.addEventListener('pointerup', function () { tx = 0; ty = 0; app.actions.setTranslate(0, 0); Array.prototype.forEach.call(pad.querySelectorAll('.rcsbtn'), function (b) { b.classList.remove('on'); }); });
    // --- fore / aft control (right): push in toward the goal, or retro to slow ---
    var fa = el('div', 'foreaft', hud);
    var fore = el('button', 'fabtn fore', fa); fore.dataset.btn = '1'; fore.textContent = '🚀';
    var aft = el('button', 'fabtn aft', fa); aft.dataset.btn = '1'; aft.textContent = '🛑';
    fore.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setThrust(true); fore.classList.add('on'); });
    aft.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setBrake(true); aft.classList.add('on'); });
    window.addEventListener('pointerup', function () { app.actions.setThrust(false); app.actions.setBrake(false); fore.classList.remove('on'); aft.classList.remove('on'); });
    // stick visual (retained for other stages; hidden here)
    stickEl = el('div', 'stick', hud); stickEl.style.display = 'none'; el('div', 'stick-knob', stickEl);
    dash.cockpitGlow = el('div', 'cockpit-glow', hud);
    // wordless goal card: 🛰️ at leg one, 🪐 after undocking
    dash.goal = el('div', 'goalbanner', hud); dash.goal.style.display = 'none';
    dash.hud = hud;
  }
  // a round Apollo-style gauge with a needle (returns {el, needle})
  function makeGauge(parent) {
    var g = el('div', 'gauge', parent);
    el('div', 'gauge-face', g);
    var needle = el('div', 'gauge-needle', g);
    el('div', 'gauge-hub', g);
    return { el: g, needle: needle };
  }
  // drive the DSKY numeric speed + dock/fast lamps + the speed gauge needle
  function updateDsky(speed, dockOK, legOn) {
    if (dash.dskyNum) {
      var n = Math.round(clamp(speed, 0, 999));
      dash.dskyNum.textContent = (n < 10 ? '00' : n < 100 ? '0' : '') + n;
      dash.dskyNum.className = 'dsky-num' + (legOn ? (dockOK ? ' ok' : ' hot') : '');
    }
    if (dash.lampDock) dash.lampDock.classList.toggle('lit', !!(legOn && dockOK));
    if (dash.lampFast) dash.lampFast.classList.toggle('lit', !!(legOn && !dockOK));
    if (dash.gaugeSpeed) {
      var a = clamp(speed / 60, 0, 1) * 240 - 120;   // -120°..+120° across 0..60
      dash.gaugeSpeed.needle.style.transform = 'rotate(' + a + 'deg)';
    }
  }
  function showGoal(glyph) {
    if (!dash.goal) return;
    dash.goal.textContent = glyph;
    dash.goal.style.display = 'flex';
    dash.goal.classList.remove('show'); void dash.goal.offsetWidth; dash.goal.classList.add('show');
    setTimeout(function () { dash.goal.style.display = 'none'; }, 2000);
  }
  function applyCockpitLight() { if (dash.cockpitGlow) dash.cockpitGlow.style.opacity = app.G.switches.light ? '1' : '0'; }
  function showSpace() { hideAll(); if (!screens.space) buildSpaceHud(); screens.space.style.display = 'block'; setStars(app.G.collected); drawChart(); }
  function setStars(n) { if (dash.stars) dash.stars.innerHTML = '⭐ ' + n; }
  // draw the current (or last, if all done) constellation filling in
  function drawChart() {
    var cv = dash.chart; if (!cv) return;
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    var list = cfg.constellations, stars = (app.G.save && app.G.save.stars) || 0;
    var cum = 0, cur = null, lit = 0, allDone = false;
    for (var i = 0; i < list.length; i++) { var L = list[i].points.length; var l = clamp(stars - cum, 0, L); if (l < L) { cur = list[i]; lit = l; break; } cum += L; }
    if (!cur) { cur = list[list.length - 1]; lit = cur.points.length; allDone = true; }
    var sz = Math.min(W, H) - 34, cx = W / 2, cy = H / 2 + 4;
    function px(p) { return [cx + p[0] * sz / 2, cy - p[1] * sz / 2]; }
    var n = cur.points.length;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.strokeStyle = allDone ? '#ffe066' : 'rgba(255,255,255,0.85)';
    for (var k = 0; k < n; k++) { var a = k, b = (k + 1) % n; if (!(a < lit && b < lit)) continue; var pa = px(cur.points[a]), pb = px(cur.points[b]); ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke(); }
    for (var j = 0; j < n; j++) { var on = j < lit; var pp = px(cur.points[j]); ctx.beginPath(); ctx.arc(pp[0], pp[1], on ? 5 : 3.2, 0, TAU); ctx.fillStyle = allDone ? '#ffe066' : (on ? '#fff' : 'rgba(255,255,255,0.32)'); if (on) { ctx.shadowColor = allDone ? '#ffe066' : '#fff'; ctx.shadowBlur = 8; } ctx.fill(); ctx.shadowBlur = 0; }
  }
  function lightDashBulb(n) { if (dash.bulbs) { var b = dash.bulbs.children[(n - 1) % dash.bulbs.children.length]; if (b) b.classList.add('lit'); } }

  var _v = new THREE.Vector3();
  function updateSpaceHud(camera, planet, pos, dist) {
    if (!chevronEl) return;
    _v.set(planet.pos[0], planet.pos[1], planet.pos[2]);
    var p = _v.clone().project(camera);
    var w = window.innerWidth, h = window.innerHeight, m = 70;
    var onScreen = p.z < 1 && Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.92;
    if (onScreen) {
      // alignment reticle: a fixed centre crosshair + a marker on the goal.
      // Slide (RCS) to bring the marker into the crosshair — it locks green.
      chevronEl.style.display = 'none';
      var sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      var locked = Math.hypot(p.x, p.y) < 0.09;
      if (dash.reticle) { dash.reticle.style.display = 'block'; dash.reticle.classList.toggle('locked', locked); }
      if (dash.reticleTgt) {
        dash.reticleTgt.style.display = 'block';
        dash.reticleTgt.style.left = (sx - 26) + 'px'; dash.reticleTgt.style.top = (sy - 26) + 'px';
        dash.reticleTgt.style.borderColor = locked ? '#7fd858' : planet.color;
      }
      return;
    }
    if (dash.reticle) dash.reticle.style.display = 'none';
    if (dash.reticleTgt) dash.reticleTgt.style.display = 'none';
    var dx = p.x, dy = p.y; if (p.z > 1) { dx = -dx; dy = -dy; }
    var ang = Math.atan2(dy, dx);
    var cx = w / 2 + Math.cos(ang) * (w / 2 - m), cy = h / 2 - Math.sin(ang) * (h / 2 - m);
    chevronEl.style.display = 'flex'; chevronEl.style.left = (cx - 34) + 'px'; chevronEl.style.top = (cy - 34) + 'px';
    chevronEl.style.color = planet.color; chevronEl.style.transform = 'rotate(' + (90 - ang / Math.PI * 180) + 'deg)';
  }

  /* ---- landing HUD ---- */
  function buildLandingHud() {
    var hud = el('div', 'hud', root); screens.landing = hud; hud.style.display = 'none';
    // retro throttle lever (right): drag up to burn harder and slow the fall
    var wrap = el('div', 'throttle retro', hud); wrap.dataset.btn = '1';
    var fill = el('div', 'throttle-fill', wrap); var knob = el('div', 'throttle-knob', wrap);
    el('div', 'throttle-hover', wrap);                 // mid-lever = hold altitude
    el('div', 'throttle-cap', wrap).textContent = '🔥';
    var dragging = false;
    function setFromY(y) { var r = wrap.getBoundingClientRect(); var v = clamp(1 - (y - r.top) / r.height, 0, 1); app.actions.setThrottle(v); fill.style.height = (v * 100) + '%'; knob.style.bottom = 'calc(' + (v * 100) + '% - 22px)'; }
    wrap.addEventListener('pointerdown', function (e) { e.stopPropagation(); dragging = true; setFromY(e.clientY); });
    window.addEventListener('pointermove', function (e) { if (dragging) setFromY(e.clientY); });
    window.addEventListener('pointerup', function () { dragging = false; });
    // altitude + descent-rate gauge (left): the fill is how high you are; its
    // colour is your fall speed — green safe, amber quick, red too fast (burn!)
    var ag = el('div', 'altgauge', hud); dash.altGauge = ag;
    dash.altFill = el('div', 'altgauge-fill', ag);
    dash.altMark = el('div', 'altgauge-mark', ag); dash.altMark.textContent = '🛸';
    el('div', 'altgauge-ground', ag);
    // steer-to-pad alignment strip (top): centre the 🛸 over the pad zone
    var lt = el('div', 'landtarget', hud); dash.landTarget = lt;
    el('div', 'landtarget-zone', lt);
    dash.landMark = el('div', 'landtarget-mark', lt); dash.landMark.textContent = '🛸';
    // steer buttons (bottom-centre): move left / right to find the pad
    var steer = el('div', 'steer', hud);
    var lb = el('button', 'steerbtn', steer); lb.dataset.btn = '1'; lb.textContent = '◀';
    var rb = el('button', 'steerbtn', steer); rb.dataset.btn = '1'; rb.textContent = '▶';
    lb.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setNudge(-1); lb.classList.add('on'); });
    rb.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setNudge(1); rb.classList.add('on'); });
    window.addEventListener('pointerup', function () { app.actions.setNudge(0); lb.classList.remove('on'); rb.classList.remove('on'); });
    var banner = el('div', 'banner', hud); banner.style.display = 'none'; screens._banner = banner;
  }
  // altitude gauge fill + descent-rate colour + steer-to-pad strip
  function updateLander(altFrac, vy, latNorm, onPad) {
    if (dash.altFill) dash.altFill.style.height = (altFrac * 100) + '%';
    if (dash.altMark) dash.altMark.style.bottom = 'calc(' + (altFrac * 100) + '% - 14px)';
    if (dash.altGauge) { var rate = Math.abs(vy); dash.altGauge.className = 'altgauge ' + (rate <= SPACE.C.SOFT ? 'safe' : rate <= SPACE.C.MED ? 'ok' : 'hot'); }
    if (dash.landMark) dash.landMark.style.left = (50 + latNorm * 44) + '%';
    if (dash.landTarget) dash.landTarget.classList.toggle('on', !!onPad);
  }
  function showLanding() { hideAll(); if (!screens.landing) buildLandingHud(); screens.landing.style.display = 'block'; }
  function deliveryBanner(tier) { var b = screens._banner; if (!b) return; b.textContent = tier === 'bull' ? '🎉' : tier === 'close' ? '👏' : '🙂'; b.className = 'banner show'; b.style.display = 'flex'; setTimeout(function () { b.style.display = 'none'; }, 2000); }
  function showAfterLanding() { app.actions.afterLanding(); }

  /* ---- shared stick ---- */
  function showStick(x, y) { if (!stickEl) return; stickEl.style.display = 'block'; stickEl.style.left = (x - 70) + 'px'; stickEl.style.top = (y - 70) + 'px'; moveStick(x, y); }
  function moveStick(x, y) { if (!stickEl) return; var k = stickEl.firstChild; if (k) { k.style.left = (x - stickEl.offsetLeft - 35) + 'px'; k.style.top = (y - stickEl.offsetTop - 35) + 'px'; } }
  function hideStick() { if (stickEl) stickEl.style.display = 'none'; }

  /* ---- portrait ---- */
  function buildPortrait() { var p = el('div', 'portrait', root); screens.portrait = p; p.style.display = 'none'; el('div', 'roticon', p).textContent = '📱↻'; el('div', 'portmsg', p).textContent = 'Turn me sideways!'; }
  function checkPortrait() { portrait = window.innerHeight > window.innerWidth; UIobj.portrait = portrait; screens.portrait.style.display = portrait ? 'flex' : 'none'; }

  var UIobj = {
    init: init, showProfile: showProfile, showHangar: showHangar, showMap: showMap,
    showLaunch: showLaunch, setCountdown: setCountdown, updateAttitude: updateAttitude,
    showSpace: showSpace, showGoal: showGoal, setStars: setStars, drawChart: drawChart, lightDashBulb: lightDashBulb, updateSpaceHud: updateSpaceHud, updateDsky: updateDsky,
    showLanding: showLanding, deliveryBanner: deliveryBanner, showAfterLanding: showAfterLanding,
    updateLander: updateLander, patchEarned: patchEarned,
    showStick: showStick, moveStick: moveStick, hideStick: hideStick, checkPortrait: checkPortrait,
    get portrait() { return portrait; }, set portrait(v) { portrait = v; }
  };
  return UIobj;
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
window.SpaceSchool = App;

})();
