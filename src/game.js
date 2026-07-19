/* ============================================================================
 *  FLIGHT SCHOOL  —  a cargo-flying game for very small pilots
 *  See CLAUDE.md for the contract. Depends on two globals inlined ahead of it
 *  at build time: THREE (r150 UMD) and AERO (src/aero.js — the flight numbers).
 *  Sections below are banner-marked: CONFIG / PERSIST / AUDIO / WORLD /
 *  CREATURES / PLANE / UI / MAIN.
 * ==========================================================================*/
(function () {
'use strict';

/* ============================================================================
 * CONFIG  —  Dad edits this block. Everything a grown-up would want to change
 * lives here: who flies, where things are, and what gets delivered. Names and
 * places are for you; the kids fly by colour, icon and picture.
 * ==========================================================================*/
var CONFIG = {
  // Name destinations after real people and real places. A beacon that means
  // "Grandma's house" is worth more than any amount of terrain.  pos: [x, y, z]
  // (y is ignored — landmarks sit on the ground). color drives the beacon +
  // the nav chevron so each place has one unmistakable colour.
  landmarks: [
    { id: 'grandma',  label: "Grandma's House", kind: 'house',    color: '#ff6b35', pos: [ 1400,  0,  -900] },
    { id: 'mountain', label: 'The Big Mountain', kind: 'mountain', color: '#33e1e1', pos: [-1800,  0, -2200] },
    { id: 'island',   label: 'The Island',       kind: 'island',   color: '#7fd858', pos: [ 2600,  0,  1900] }
  ],

  // Two pilots. Identity = icon + colour (a child can't read a name). Put your
  // kids' names + initials here; the tail number paints itself from initials.
  profiles: [
    { id: 'p1', name: 'Fox',    initials: 'F', icon: '🦊', color: '#ff8a3d' },
    { id: 'p2', name: 'Dragon', initials: 'D', icon: '🐉', color: '#5b8cff' }
  ],

  // Cargo. mass (0.15–0.8) is the important field — it makes the plane sluggish
  // and is the load-planning lesson. scale just telegraphs that weight visually.
  // v2 swaps these for meshes forged + printed by the kids (see CLAUDE.md §9.2).
  creatures: [
    { id: 'creature_liz',  name: 'Pip',     kind: 'lizard', mass: 0.15, color: '#7fd858', scale: 0.80 },
    { id: 'creature_fox',  name: 'Rusty',   kind: 'fox',    mass: 0.35, color: '#ff8a3d', scale: 1.00 },
    { id: 'creature_bear', name: 'Bramble', kind: 'bear',   mass: 0.60, color: '#b5794a', scale: 1.35 },
    { id: 'creature_drag', name: 'Ember',   kind: 'dragon', mass: 0.80, color: '#9b6bff', scale: 1.60 }
  ],

  invertPitch: false,       // false = push the stick UP to climb (kid-intuitive)
  bullseye: 30,             // <30u from the beacon = confetti + dance
  close: 100,              // <100u = enthusiastic wave

  // --- the pilot's loop: takeoff & landing (IMPROVEMENT_PLAN 1.1/1.2) ------
  takeoff: {
    accel: 13,             // ground-roll acceleration, u/s^2 (auto-throttle spool)
    vRotate: 38,           // pull the stick at/above this to lift off
    vMaxRoll: 55,          // ground speed cap if they never rotate
    autoAfter: 7           // seconds at rotate speed before a gentle auto-liftoff
  },
  landing: {
    homeRadius: 550,       // touchdowns count as landings inside this (flat home)
    gentleVy: -16,         // sink rate gentler than this = touchdown, else bounce
    runwayHalfW: 95, runwayHalfL: 480,  // on-runway = confetti tier
    rolloutDecel: 16       // u/s^2 braking during rollout
  },
  // rescue missions (IMPROVEMENT_PLAN 2.1): fly low & slow over a stranded
  // buddy to scoop it up, then bring it home. The reverse of a delivery.
  rescue: { scoopDist: 95, scoopAGL: 70 }
};
// Home base pseudo-landmark: after a delivery its gold beacon + the chevron
// guide the pilot back for landing (never lost, §2.4).
CONFIG.homeBase = { id: 'home', label: 'Home', color: '#ffd23f', pos: [0, 0, 0] };

// Dashboard listing metadata (spec §10.1) — the launcher reads title + icon.
CONFIG.gameMeta = { id: 'flightschool', title: 'Flight School', icon: '✈️' };

/* ============================================================================
 * small utilities
 * ==========================================================================*/
var TAU = Math.PI * 2, DEG = Math.PI / 180;
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
function shade(hex, amt) { // amt<0 darken, >0 lighten
  var c = new THREE.Color(hex);
  var t = amt < 0 ? 0 : 1, p = Math.abs(amt);
  c.r = lerp(c.r, t, p); c.g = lerp(c.g, t, p); c.b = lerp(c.b, t, p);
  return c;
}
function tailFromInitials(s) {
  s = (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return 'N-' + (s || 'XX');
}

/* ============================================================================
 * PERSIST  —  per-profile save. localStorage (hosted origin, spec §11.1).
 * If storage is blocked (e.g. file://) we fall back to in-memory so the game
 * still plays for the session; the parent just won't see it next Saturday.
 * ==========================================================================*/
var Persist = (function () {
  var mem = {};
  var ok = (function () {
    try { var k = '__fs_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  })();
  function key(id) { return 'flightschool:profile:' + id; }
  function load(id) {
    var raw;
    try { raw = ok ? localStorage.getItem(key(id)) : mem[id]; } catch (e) { raw = mem[id]; }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function save(obj) {
    var raw = JSON.stringify(obj);
    try { if (ok) localStorage.setItem(key(obj.profileId), raw); else mem[obj.profileId] = raw; }
    catch (e) { mem[obj.profileId] = raw; }
  }
  function blank(profile) {
    return {
      profileId: profile.id, icon: profile.icon, color: profile.color,
      tailNumber: tailFromInitials(profile.initials || profile.name),
      collection: [], deliveries: [], flightSeconds: 0
    };
  }
  return { load: load, save: save, blank: blank, available: ok };
})();

/* ============================================================================
 * AUDIO  —  Web Audio synthesis only, zero files (spec §7). This is 40% of the
 * magic. The engine note rising as they dive is the strongest feedback channel
 * for the energy lesson, so it gets its own always-running voice.
 * ==========================================================================*/
var Audio = (function () {
  var ctx = null, master = null, noiseBuf = null;
  var eng = null; // {osc, filt, gain}
  var unlocked = false;

  function build() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    // one small noise buffer reused for chute/thump/dust
    var n = ctx.sampleRate * 0.5; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    var seed = 22; // deterministic-ish; audio doesn't need real randomness
    for (var i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1; }
    // engine voice
    var osc = ctx.createOscillator(); osc.type = 'sawtooth';
    var filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700;
    var g = ctx.createGain(); g.gain.value = 0.0;
    osc.connect(filt); filt.connect(g); g.connect(master); osc.start();
    eng = { osc: osc, filt: filt, gain: g };
  }
  function unlock() {
    if (unlocked) return;
    if (!ctx) build();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    unlocked = !!ctx;
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  // engine: freq tracks airspeed, gain tracks thrust (+ a little idle) (§7)
  function engine(v, thrust01, running) {
    if (!eng) return;
    var t = now();
    var f = 60 + v * 4.2;                 // Hz, rises with speed
    eng.osc.frequency.setTargetAtTime(f, t, 0.05);
    eng.filt.frequency.setTargetAtTime(500 + v * 12, t, 0.08);
    var target = running ? (0.05 + thrust01 * 0.14) : 0.0;
    eng.gain.gain.setTargetAtTime(target, t, 0.1);
  }

  function tone(type, f0, f1, dur, vol, at) {
    if (!ctx) return; at = at || 0;
    var t = now() + at;
    var o = ctx.createOscillator(); o.type = type;
    var g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, lp) {
    if (!ctx || !noiseBuf) return;
    var t = now();
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }

  return {
    unlock: unlock, engine: engine,
    whoop:  function () { tone('sine', 400, 180, 0.5, 0.25); },          // stall — the plane got sleepy
    boing:  function () { tone('sine', 320, 90, 0.28, 0.3); tone('sine', 260, 140, 0.28, 0.12, 0.02); },
    chute:  function () { noise(0.32, 0.35, 1600); },
    thump:  function () { noise(0.18, 0.4, 500); tone('sine', 120, 60, 0.22, 0.28); },
    chime:  function (big) { tone('triangle', 660, 660, 0.5, 0.22); tone('triangle', 831, 831, 0.5, 0.2, 0.06);
                            if (big) { tone('triangle', 990, 990, 0.6, 0.2, 0.12); } },
    honk:   function () { tone('square', 340, 320, 0.07, 0.22); tone('square', 250, 245, 0.08, 0.18, 0.09); }, // snappy beep-beep
    get available() { return !!ctx; }
  };
})();

/* ============================================================================
 * WORLD  —  terrain (analytic height so collision is exact), sky gradient,
 * light fog, oversized home runway, landmark models, beacon columns.
 * ==========================================================================*/
var WORLD_SIZE = 14000, GROUND_MARGIN = 7;

function terrainHeight(x, z) {
  var d = Math.hypot(x, z);
  var flat = smoothstep(0, 650, d); // pancake-flat at home so the runway is honest
  var h = 0;
  h += Math.sin(x * 0.0016) * Math.cos(z * 0.0016) * 55;
  h += Math.sin(x * 0.0041 + 2.1) * Math.cos(z * 0.0037 - 1.2) * 20;
  h += Math.sin(x * 0.011 + 0.5) * Math.cos(z * 0.009 + 3.3) * 6;
  return h * flat;
}

function makeLambert(color, flat) {
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(color), flatShading: flat !== false });
}

function buildTerrain() {
  var seg = 140;
  var geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  var p = geo.attributes.position;
  for (var i = 0; i < p.count; i++) {
    var x = p.getX(i), z = p.getZ(i);
    p.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  var mat = makeLambert('#5fae4d');
  var mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}

function buildSky() {
  var geo = new THREE.SphereGeometry(6000, 24, 14);
  var mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#2f7fe6') }, bot: { value: new THREE.Color('#cdeaff') } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float h; uniform vec3 top; uniform vec3 bot; void main(){ float t = clamp(h*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bot, top, t),1.0); }'
  });
  return new THREE.Mesh(geo, mat);
}

function buildRunway() {
  var g = new THREE.Group();
  var rw = new THREE.Mesh(new THREE.BoxGeometry(160, 4, 900), makeLambert('#6b6f76', false));
  rw.position.y = 2; g.add(rw);
  // fat centreline dashes so it reads as a runway from the air
  for (var i = -3; i <= 3; i++) {
    var dash = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 70), makeLambert('#eef0f2', false));
    dash.position.set(0, 4.5, i * 120); g.add(dash);
  }
  // a windsock for a splash of life
  var pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 60), makeLambert('#cccccc', false));
  pole.position.set(110, 30, 0); g.add(pole);
  var sock = new THREE.Mesh(new THREE.ConeGeometry(10, 40, 8, 1, true), makeLambert('#ff6b35', false));
  sock.rotation.z = -Math.PI / 2; sock.position.set(130, 55, 0); g.add(sock);
  return g;
}

function buildLandmark(lm) {
  var g = new THREE.Group();
  var col = lm.color;
  if (lm.kind === 'house') {
    var walls = new THREE.Mesh(new THREE.BoxGeometry(120, 100, 120), makeLambert('#f6d67a'));
    walls.position.y = 50; g.add(walls);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(105, 80, 4), makeLambert(col));
    roof.rotation.y = Math.PI / 4; roof.position.y = 140; g.add(roof);
    var door = new THREE.Mesh(new THREE.BoxGeometry(34, 55, 6), makeLambert(shade(col, -0.3)));
    door.position.set(0, 27, 61); g.add(door);
  } else if (lm.kind === 'mountain') {
    var rock = new THREE.Mesh(new THREE.ConeGeometry(520, 760, 7), makeLambert('#8a8f98'));
    rock.position.y = 380; g.add(rock);
    var snow = new THREE.Mesh(new THREE.ConeGeometry(230, 300, 7), makeLambert('#ffffff'));
    snow.position.y = 620; g.add(snow);
  } else { // island
    var beach = new THREE.Mesh(new THREE.CylinderGeometry(360, 420, 60, 20), makeLambert('#f2e2a6'));
    beach.position.y = 30; g.add(beach);
    var palmT = new THREE.Mesh(new THREE.CylinderGeometry(12, 18, 160, 7), makeLambert('#9c6b3f'));
    palmT.position.set(0, 140, 0); palmT.rotation.z = 0.15; g.add(palmT);
    var leaves = new THREE.Mesh(new THREE.ConeGeometry(120, 90, 6), makeLambert(col));
    leaves.position.set(12, 230, 0); g.add(leaves);
  }
  g.position.set(lm.pos[0], terrainHeight(lm.pos[0], lm.pos[2]), lm.pos[2]);
  return g;
}

function buildBeacon(color) {
  var g = new THREE.Group();
  var col = new THREE.Color(color);
  var mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  var cyl = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 400, 14, 1, true), mat);
  cyl.position.y = 200; g.add(cyl);
  var ring = new THREE.Mesh(new THREE.RingGeometry(40, 70, 24), mat.clone());
  ring.rotation.x = -Math.PI / 2; ring.position.y = 3; g.add(ring);
  g.userData.mat = mat;
  return g;
}

/* ---- sky discoveries: a living world below (IMPROVEMENT_PLAN 2.2) --------- */
function makeBalloon(color) {
  var g = new THREE.Group();
  var env = new THREE.Mesh(new THREE.SphereGeometry(22, 14, 12), makeLambert(color));
  env.scale.y = 1.28; env.position.y = 30; g.add(env);
  // a couple of contrast gores
  var gore = new THREE.Mesh(new THREE.SphereGeometry(22.3, 14, 12, 0, TAU / 5), makeLambert(shade(color, -0.25)));
  gore.scale.y = 1.28; gore.position.y = 30; g.add(gore);
  var basket = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 9), makeLambert('#8a5a2b'));
  basket.position.y = 2; g.add(basket);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
    var rope = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 16), makeLambert('#5a4a3a', false));
    rope.position.set(p[0] * 5.5, 13, p[1] * 5.5); g.add(rope);
  });
  return g;
}
function makeBird() {
  var b = new THREE.Group();
  var body = new THREE.Mesh(new THREE.SphereGeometry(2.4, 6, 5), makeLambert('#454b54', false)); body.scale.z = 1.5; b.add(body);
  [-1, 1].forEach(function (s) {
    var w = new THREE.Mesh(new THREE.ConeGeometry(1.7, 6.5, 4), makeLambert('#5a616b', false));
    w.rotation.z = s * Math.PI / 2; w.position.x = s * 4.2; w.userData.side = s; b.add(w);
  });
  return b;
}
function buildAmbientBirds() {
  var g = new THREE.Group();
  for (var i = 0; i < 6; i++) { var bird = makeBird(); bird.userData.phase = i * 1.1; bird.userData.rad = 1 - (i % 3) * 0.05; g.add(bird); }
  g.userData = { t: 0, cx: -500, cz: -400, cy: 320, R: 720 };
  return g;
}
function stepAmbientBirds(g, dt) {
  var u = g.userData; u.t += dt;
  g.children.forEach(function (b, i) {
    var a = u.t * 0.28 + i * 0.5, r = u.R * b.userData.rad;
    b.position.set(u.cx + Math.cos(a) * r, u.cy + Math.sin(u.t * 0.5 + i) * 12, u.cz + Math.sin(a) * r);
    b.rotation.y = -a + Math.PI / 2;
    var flap = Math.sin(u.t * 12 + b.userData.phase) * 0.6;
    b.children.forEach(function (w) { if (w.userData && w.userData.side) w.rotation.x = flap * w.userData.side; });
  });
}

/* ============================================================================
 * CREATURES  —  low-poly, procedurally baked (spec §9.1). mass -> flight,
 * scale -> read-at-a-glance weight. Each has a wave arm on a shoulder pivot.
 * ==========================================================================*/
function makeCreature(def) {
  var g = new THREE.Group();
  var body = makeLambert(def.color), belly = makeLambert(shade(def.color, 0.35)),
      dark = makeLambert(shade(def.color, -0.4)), white = makeLambert('#ffffff', false),
      black = makeLambert('#20242c', false);

  var torso = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), body);
  torso.scale.set(1, 1.12, 0.92); torso.position.y = 0.78; g.add(torso);
  var tummy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), belly);
  tummy.scale.set(1, 1.1, 0.7); tummy.position.set(0, 0.7, 0.34); g.add(tummy);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), body);
  head.position.y = 1.55; g.add(head);
  // eyes
  [-0.17, 0.17].forEach(function (x) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), white); e.position.set(x, 1.6, 0.36); g.add(e);
    var p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), black); p.position.set(x, 1.6, 0.44); g.add(p);
  });

  // per-kind flourishes
  if (def.kind === 'fox') {
    [-0.22, 0.22].forEach(function (x) {
      var ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 5), body);
      ear.position.set(x, 1.92, 0); g.add(ear);
    });
    var snout = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 7), belly);
    snout.rotation.x = Math.PI / 2; snout.position.set(0, 1.5, 0.5); g.add(snout);
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.8, 8), body);
    tail.position.set(0, 0.6, -0.7); tail.rotation.x = -1.0; g.add(tail);
  } else if (def.kind === 'bear') {
    [-0.26, 0.26].forEach(function (x) {
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), body); ear.position.set(x, 1.9, 0); g.add(ear);
    });
    var snout2 = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), belly); snout2.position.set(0, 1.48, 0.4); g.add(snout2);
  } else if (def.kind === 'lizard') {
    var frill = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 3), dark); frill.position.set(0, 1.75, -0.2); g.add(frill);
    var ltail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.0, 6), body); ltail.position.set(0, 0.5, -0.75); ltail.rotation.x = -1.3; g.add(ltail);
  } else if (def.kind === 'dragon') {
    [-0.2, 0.2].forEach(function (x) {
      var horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 5), belly); horn.position.set(x, 1.95, -0.05); horn.rotation.x = -0.3; g.add(horn);
    });
    [-1, 1].forEach(function (s) {
      var wing = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 3), belly);
      wing.scale.set(0.35, 1, 1); wing.rotation.z = s * 1.2; wing.rotation.y = s * 0.4;
      wing.position.set(s * 0.6, 1.0, -0.35); g.add(wing);
    });
    var dtail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), body); dtail.position.set(0, 0.5, -0.8); dtail.rotation.x = -1.2; g.add(dtail);
  }

  // legs
  [-0.26, 0.26].forEach(function (x) {
    var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.28, 3, 6), body);
    leg.position.set(x, 0.24, 0.05); g.add(leg);
  });
  // left arm (static)
  var la = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 3, 6), body);
  la.position.set(-0.62, 0.85, 0.05); la.rotation.z = 0.4; g.add(la);
  // right arm on a shoulder pivot so it can wave
  var shoulder = new THREE.Group(); shoulder.position.set(0.6, 1.05, 0.05);
  var ra = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 3, 6), body);
  ra.position.set(0.0, -0.22, 0); shoulder.add(ra); g.add(shoulder);

  g.userData = { def: def, waveArm: shoulder, wave: 0, bob: Math.random ? 0 : 0 };
  return g;
}

// advance a creature's little life: bob + wave when asked
function animateCreature(g, t, waving) {
  var u = g.userData;
  u.wave = lerp(u.wave, waving ? 1 : 0, 0.12);
  u.waveArm.rotation.z = -2.2 * u.wave + Math.sin(t * 12) * 0.5 * u.wave;
  g.position.y = u.baseY + Math.sin(t * 2 + (u.phase || 0)) * 0.6 * (u.standT || 1);
}

/* ============================================================================
 * PLANE  —  low-poly, painted in the pilot's colour, tail number decal, a
 * spinning prop, and a couple of cockpit toys (light / smoke) that the north
 * star asks for. Steering is stick + DROP only; the toys never affect flight.
 * ==========================================================================*/
function tailTexture(text, color) {
  var c = document.createElement('canvas'); c.width = 256; c.height = 128;
  var x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#ffffff'; x.font = 'bold 74px system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 68);
  var tex = new THREE.CanvasTexture(c); tex.anisotropy = 2; return tex;
}

function makePlane(color, tailNumber) {
  var g = new THREE.Group();
  var main = makeLambert(color), accent = makeLambert(shade(color, -0.25));
  var fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 2.4, 5, 10), main);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  var nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12), accent);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -1.9; g.add(nose);
  var wing = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.14, 1.1), main); wing.position.y = 0.1; g.add(wing);
  var wtip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.0), accent); // dihedral hint
  var tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.7), main); tail.position.set(0, 0.15, 1.7); g.add(tail);
  var fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.7), main); fin.position.set(0, 0.5, 1.75); g.add(fin);
  var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshLambertMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.65, flatShading: true }));
  canopy.scale.set(1, 0.8, 1.4); canopy.position.set(0, 0.5, -0.2); g.add(canopy);

  // tail number decal on the fin (both sides)
  var tex = tailTexture(tailNumber, shade(color, -0.2).getStyle());
  var decMat = new THREE.MeshBasicMaterial({ map: tex });
  var dec = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), decMat);
  dec.position.set(0.07, 0.5, 1.9); dec.rotation.y = Math.PI / 2; g.add(dec);
  var dec2 = dec.clone(); dec2.position.x = -0.07; dec2.rotation.y = -Math.PI / 2; g.add(dec2);

  // spinning prop
  var prop = new THREE.Group(); prop.position.z = -2.4;
  var hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), accent); prop.add(hub);
  var blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 0.05), makeLambert('#2b2f36', false));
  var blade2 = blade.clone(); blade2.rotation.z = Math.PI / 2; prop.add(blade); prop.add(blade2);
  g.add(prop);

  // landing light (a cockpit toy, off by default)
  var light = new THREE.SpotLight(0xfff2c0, 0, 900, 0.5, 0.5, 1);
  light.position.set(0, 0, -1.5); var lt = new THREE.Object3D(); lt.position.set(0, -0.3, -60); g.add(lt); light.target = lt; g.add(light);

  g.scale.setScalar(6.5);
  g.userData = { prop: prop, light: light };
  return g;
}

/* ============================================================================
 * MAIN  —  scene, state machine (profile -> hangar -> destination -> fly),
 * physics integration, input, cargo/delivery, camera, HUD, loop.
 * ==========================================================================*/
var App = {};
function boot() {
  var container = document.getElementById('stage');

  // --- renderer / scene / camera ---
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // spec §4.2: cap DPR
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);
  renderer.domElement.id = 'gl';

  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3ff');
  scene.fog = new THREE.Fog('#cdeaff', 1800, 5600); // light — never occluding (spec §8)

  var camera = new THREE.PerspectiveCamera(62, 1, 1, 12000);

  scene.add(new THREE.HemisphereLight('#dff1ff', '#4f7a3c', 1.05));
  var sun = new THREE.DirectionalLight('#fff6e0', 0.9); sun.position.set(-800, 1200, 600); scene.add(sun);

  var sky = buildSky(); scene.add(sky);
  scene.add(buildTerrain());
  scene.add(buildRunway());

  // landmarks + beacons
  var beacons = {};
  CONFIG.landmarks.forEach(function (lm) {
    scene.add(buildLandmark(lm));
    var b = buildBeacon(lm.color);
    b.position.set(lm.pos[0], terrainHeight(lm.pos[0], lm.pos[2]), lm.pos[2]);
    b.visible = false; scene.add(b); beacons[lm.id] = b;
  });
  // gold home beacon over the runway — lit after a delivery to guide the landing
  var homeBeacon = buildBeacon(CONFIG.homeBase.color);
  homeBeacon.position.set(0, terrainHeight(0, 0), 0);
  homeBeacon.visible = false; scene.add(homeBeacon); beacons.home = homeBeacon;

  // plane + delivered-creatures group
  var plane = null;
  var deliveredGroup = new THREE.Group(); scene.add(deliveredGroup);
  var rescueGroup = new THREE.Group(); scene.add(rescueGroup);   // stranded buddy + flare

  // a living world below: hot-air balloons that bob (and wobble when you honk),
  // and a flock of birds circling the sky (IMPROVEMENT_PLAN 2.2)
  var balloons = [];
  [['#ff6b6b', 700, -400], ['#4dabf7', -650, 350], ['#ffd43b', 1150, 700]].forEach(function (d) {
    var gy = terrainHeight(d[1], d[2]), bal = makeBalloon(d[0]);
    bal.position.set(d[1], gy + 150, d[2]); scene.add(bal);
    balloons.push({ m: bal, baseY: gy + 150, phase: d[1] * 0.01 });
  });
  var ambientBirds = buildAmbientBirds(); scene.add(ambientBirds);

  // --- flight sim state (spec §3.1) ---
  var sim = {
    q: new THREE.Quaternion(), v: AERO.C.V_CRUISE, pos: new THREE.Vector3(),
    vel: new THREE.Vector3(), m: AERO.C.M_PLANE,
    stalled: false, pitchIn: 0, rollIn: 0,
    forward: new THREE.Vector3(0, 0, -1)
  };
  App.sim = sim; // headless verification hook

  // --- game/session state ---
  var G = {
    screen: 'profile', profile: null, save: null,
    carrying: null,     // creature def currently loaded
    activeLZ: null,     // landmark obj we're delivering to
    cargo: null,        // in-flight cargo object
    phase: 'fly',       // 'roll' (takeoff ground run) | 'fly' | 'rollout' (landing)
    rollT: 0,           // seconds spent at/above rotate speed during the roll
    mode: 'deliver',    // 'deliver' | 'rescue'
    rescued: false, rescueTarget: null,
    honkFx: 0,          // decays after a honk -> balloons wobble
    smoke: false, light: false,
    t: 0, prevT: 0,
    running: false
  };
  App.G = G;

  /* ---- helpers bound to the scene ---------------------------------------- */
  var _f = new THREE.Vector3(), _r = new THREE.Vector3(), _up = new THREE.Vector3();
  var WORLD_Y = new THREE.Vector3(0, 1, 0);

  function nearestLandmark(pos) {
    var best = CONFIG.landmarks[0], bd = Infinity;
    CONFIG.landmarks.forEach(function (lm) {
      var d = (lm.pos[0] - pos.x) * (lm.pos[0] - pos.x) + (lm.pos[2] - pos.z) * (lm.pos[2] - pos.z);
      if (d < bd) { bd = d; best = lm; }
    });
    return best;
  }

  function headingQuatTo(fromPos, target) {
    // yaw a about +Y turns (0,0,-1) into (-sin a, 0, -cos a), so facing (dx,dz)
    // needs a = atan2(-dx, -dz). (The old atan2(dx,-dz) mirrored x — verified
    // against THREE directly; the nav chevron had been quietly covering for it.)
    var ang = Math.atan2(-(target[0] - fromPos.x), -(target[2] - fromPos.z));
    var q = new THREE.Quaternion().setFromAxisAngle(WORLD_Y, ang);
    return q;
  }

  function respawn(faceTarget) {
    // spec §2.1 — no crashes. Boing, squash, back up top, wings level, cruise.
    Audio.boing();
    flash();
    var t = faceTarget || (G.activeLZ ? G.activeLZ.pos : nearestLandmark(sim.pos).pos);
    sim.pos.y = terrainHeight(sim.pos.x, sim.pos.z) + 200;
    sim.q.copy(headingQuatTo(sim.pos, t));
    sim.v = AERO.C.V_CRUISE; sim.stalled = false;
    sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
    sim.vel.copy(sim.forward).multiplyScalar(sim.v);
  }

  function startFlight() {
    // Every flight begins ON the runway (the pilot's loop). The auto-throttle
    // spools, the engine note rises, and the child pulls the stick to rotate.
    sim.pos.set(0, terrainHeight(0, 0) + 8, 400);
    sim.q.identity();                       // facing -z, straight down the runway
    sim.v = 0; sim.stalled = false;
    sim.m = AERO.C.M_PLANE + (G.carrying ? G.carrying.mass : 0);
    sim.forward.set(0, 0, -1);
    sim.vel.set(0, 0, 0);
    G.cargo = null; G.phase = 'roll'; G.rollT = 0;
    // beacon on for the active LZ only
    Object.keys(beacons).forEach(function (k) { beacons[k].visible = false; });
    if (G.activeLZ) beacons[G.activeLZ.id].visible = true;
    G.screen = 'fly'; G.running = true;
    UI.showFly();
    UI.setDropVisible(false);               // no dropping until airborne
  }

  /* ---- takeoff ground roll (IMPROVEMENT_PLAN 1.1) ------------------------ */
  function stepRoll(dt) {
    var T = CONFIG.takeoff;
    // auto-throttle spool: heavier cargo accelerates a touch slower (§3.7 echo)
    sim.v = Math.min(sim.v + (T.accel / sim.m) * dt, T.vMaxRoll);
    sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
    sim.vel.copy(sim.forward).multiplyScalar(sim.v);
    sim.pos.addScaledVector(sim.vel, dt);
    sim.pos.y = terrainHeight(sim.pos.x, sim.pos.z) + 8;   // wheels on the ground

    var pitchCmd = (CONFIG.invertPitch ? -1 : 1) * sim.pitchIn;
    var canRotate = sim.v >= T.vRotate;
    UI.showPullHint(canRotate);
    if (canRotate) G.rollT += dt;
    // rotate on a real pull — or gently by itself so nobody is ever stuck
    if ((canRotate && pitchCmd > 0.25) || G.rollT > T.autoAfter) {
      G.phase = 'fly';
      UI.showPullHint(false);
      UI.setDropVisible(!!G.carrying);
      _dqx.setFromAxisAngle(AX, 14 * DEG);                 // nose up ~14°
      sim.q.multiply(_dqx);
      sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
      sim.vel.copy(sim.forward).multiplyScalar(sim.v);
      sim.pos.y += 2;                                      // unstick the wheels
    }
  }

  /* ---- landing rollout (IMPROVEMENT_PLAN 1.2) ---------------------------- */
  function stepRollout(dt) {
    sim.v = Math.max(0, sim.v - CONFIG.landing.rolloutDecel * dt);
    sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
    sim.vel.copy(sim.forward).multiplyScalar(sim.v);
    sim.pos.addScaledVector(sim.vel, dt);
    sim.pos.y = terrainHeight(sim.pos.x, sim.pos.z) + 8;
    if (sim.v < 6 && !G.rolloutDone) {
      G.rolloutDone = true;
      var L = CONFIG.landing;
      var onRunway = Math.abs(sim.pos.x) < L.runwayHalfW && Math.abs(sim.pos.z) < L.runwayHalfL;
      Audio.chime(onRunway);
      UI.deliveryBanner(onRunway ? 'bull' : 'close');
      setTimeout(returnToHangar, 1700);
    }
  }

  /* ---- physics step (spec §3) -------------------------------------------- */
  var _dqx = new THREE.Quaternion(), _dqz = new THREE.Quaternion(), _dqy = new THREE.Quaternion();
  var AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);
  function stepFlight(dt) {
    var C = AERO.C;
    sim.forward.set(0, 0, -1).applyQuaternion(sim.q);

    // hard stall region (§3.4): kill pitch authority, nose-down, whoop once
    if (sim.v < C.V_STALL && !sim.stalled) { sim.stalled = true; Audio.whoop(); }
    if (sim.stalled && sim.v > C.V_STALL * C.STALL_RECOVER) sim.stalled = false;

    var pitchCmd = (CONFIG.invertPitch ? -1 : 1) * sim.pitchIn;
    var rollCmd = sim.rollIn;

    if (sim.stalled) {
      // forced, always-successful recovery — reads as funny, not punishment
      _dqx.setFromAxisAngle(AX, -C.STALL_NOSE_DOWN * DEG * dt);
      sim.q.multiply(_dqx);
    } else {
      var pr = AERO.pitchRate(sim.v) * DEG;
      var rr = AERO.rollRate(sim.v) * DEG;
      var lim = AERO.C.PITCH_LIMIT * DEG;
      var pitchNow = Math.asin(clamp(sim.forward.y, -1, 1));

      // PITCH: full authority while the stick is pushed; when centred, the nose
      // eases gently back to the horizon (self-righting -> "never lost"). Pitch
      // attitude is clamped so the plane can't loop or fly inverted, which turns
      // a held pull into a genuine mushing stall.
      var pd;
      if (Math.abs(pitchCmd) > 0.05) {
        pd = pitchCmd * pr * dt;
        if ((pd > 0 && pitchNow >= lim) || (pd < 0 && pitchNow <= -lim)) pd = 0;
      } else {
        pd = -Math.sign(pitchNow) * Math.min(Math.abs(pitchNow), 18 * DEG * dt);
      }
      _dqx.setFromAxisAngle(AX, pd);
      sim.q.multiply(_dqx);

      // ROLL: full authority while pushed; when centred, the wings ease level.
      // Bank is clamped so a held roll settles into a tight banked turn instead
      // of barrel-rolling inverted (spec "never lost").
      _r.set(1, 0, 0).applyQuaternion(sim.q);
      var bankNow = Math.asin(clamp(-_r.y, -1, 1)); // + = banked right
      var blim = AERO.C.BANK_LIMIT * DEG;
      var rd;
      if (Math.abs(rollCmd) > 0.05) {
        rd = -rollCmd * rr * dt; // rd<0 banks right (bankNow up), rd>0 banks left
        if ((rd < 0 && bankNow >= blim) || (rd > 0 && bankNow <= -blim)) rd = 0;
      } else {
        rd = Math.sign(bankNow) * Math.min(Math.abs(bankNow), 45 * DEG * dt);
      }
      _dqz.setFromAxisAngle(AZ, rd);
      sim.q.multiply(_dqz);
    }

    // §3.5 coordinated turn — real equation, auto, no rudder
    _r.set(1, 0, 0).applyQuaternion(sim.q);
    var bank = Math.asin(clamp(-_r.y, -1, 1));         // + = banked right
    var turn = C.G * Math.tan(bank) / Math.max(sim.v, 8);
    _dqy.setFromAxisAngle(WORLD_Y, -turn * dt);        // right bank -> nose right
    sim.q.premultiply(_dqy);

    // §3.2 the one equation that matters
    sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
    sim.v += AERO.dvdt(sim.v, sim.forward.y, sim.m) * dt;
    sim.v = clamp(sim.v, 6, C.V_MAX);

    // velocity carries a little weight (§3.1)
    _f.copy(sim.forward).multiplyScalar(sim.v);
    sim.vel.lerp(_f, 0.12);
    sim.pos.addScaledVector(sim.vel, dt);

    var gh = terrainHeight(sim.pos.x, sim.pos.z);
    var agl = sim.pos.y - gh;
    var distHome = Math.hypot(sim.pos.x, sim.pos.z);
    var emptyPlane = !G.carrying && !G.cargo;

    // rescue scoop: a low, near pass over the stranded buddy picks it up
    if (G.mode === 'rescue' && !G.rescued && G.rescueTarget) {
      var rt = G.rescueTarget;
      var hd = Math.hypot(sim.pos.x - rt.pos[0], sim.pos.z - rt.pos[2]);
      if (hd < CONFIG.rescue.scoopDist && agl < CONFIG.rescue.scoopAGL) scoopRescue();
    }

    // Landing only counts when homeward bound (activeLZ === home): after a drop
    // or a scoop. This stops the outbound empty rescue leg from auto-landing the
    // instant it clears the runway. A rescued buddy rides home like cargo but
    // may still land (deliver-at-home), so allow empty OR rescued.
    var homeward = G.activeLZ === CONFIG.homeBase;
    var canLand = homeward && (emptyPlane || G.rescued);

    // landing flare cushion: close to the ground the sink rate is gently
    // softened, so a reasonable approach nearly always touches down soft.
    if (canLand && agl < 26 && sim.vel.y < -12) {
      sim.vel.y = lerp(sim.vel.y, -9, clamp(4 * dt, 0, 1));
    }
    // ...and a skimming plane settles on by itself: release the stick in ground
    // effect and it eases down instead of floating forever.
    if (canLand && agl < 14 && Math.abs(sim.pitchIn) < 0.1 && sim.vel.y > -6) {
      sim.vel.y = Math.max(sim.vel.y - 14 * dt, -6);
    }

    // ground contact — three outcomes, none of them a fail state:
    if (sim.pos.y < gh + GROUND_MARGIN) {
      var L = CONFIG.landing;
      if (canLand && distHome < L.homeRadius && sim.vel.y > L.gentleVy) {
        // gentle touchdown at home -> landing rollout (the pilot's loop closes)
        G.phase = 'rollout'; G.rolloutDone = false;
        sim.pos.y = gh + 8;
        // settle to wheels: keep the heading, drop the pitch/bank
        sim.q.setFromAxisAngle(WORLD_Y, Math.atan2(-sim.forward.x, -sim.forward.z));
        sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
        Audio.thump(); dustPuff(sim.pos);
        if (G.rescued) deliverRescueHome();   // the buddy comes home to stay
        Object.keys(beacons).forEach(function (k) { beacons[k].visible = false; });
        UI.setDropVisible(false);
        return;
      }
      if (canLand && distHome < L.homeRadius) {
        // came in too hot at home -> comedy bounce that BLEEDS SPEED, so
        // bounce-bounce-settle always converges to a landing (funny, never
        // frustrating — a hot arrival is two boings and then a touchdown)
        Audio.boing(); dustPuff(sim.pos);
        sim.pos.y = gh + GROUND_MARGIN + 2;
        sim.vel.y = 20;
        sim.v = Math.max(sim.v * 0.6, 28);
        sim.vel.x *= 0.7; sim.vel.z *= 0.7;
        return;
      }
      respawn();   // §2.1 everywhere else (and always with cargo aboard)
    }
  }

  /* ---- cargo drop / delivery (spec §6) ----------------------------------- */
  function dropCargo() {
    if (G.screen !== 'fly' || G.phase !== 'fly' || !G.carrying || G.cargo) return;
    // must be properly airborne — no dumping the buddy on the runway
    if (sim.pos.y - terrainHeight(sim.pos.x, sim.pos.z) < 30) return;
    var def = G.carrying;
    var mesh = makeCreature(def);
    mesh.scale.setScalar(14 * def.scale / 1.0);
    mesh.position.copy(sim.pos);
    var chute = buildChute(def.color); chute.visible = false; chute.scale.setScalar(0.1);
    mesh.add(chute);
    scene.add(mesh);
    G.cargo = { mesh: mesh, chute: chute, vel: sim.vel.clone().multiplyScalar(0.5),
                t: 0, deployed: false, landed: false, def: def };
    // plane is light again the instant the cargo leaves
    sim.m = AERO.C.M_PLANE;
    G.carrying = null;
    UI.setDropReady(false);
  }

  function buildChute(color) {
    var g = new THREE.Group();
    var canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8, 0, TAU, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, flatShading: true }));
    canopy.position.y = 2.4; g.add(canopy);
    // a couple of lines
    [[-0.9, 0], [0.9, 0], [0, -0.9], [0, 0.9]].forEach(function (p) {
      var ln = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4), makeLambert('#ffffff', false));
      ln.position.set(p[0] * 0.5, 1.2, p[1] * 0.5); g.add(ln);
    });
    return g;
  }

  function stepCargo(dt) {
    var c = G.cargo; if (!c) return;
    c.t += dt;
    if (!c.deployed && c.t >= 0.6) { c.deployed = true; c.chute.visible = true; Audio.chute(); }
    var g = 9.8 * 1.2;
    if (c.deployed) {
      c.chute.scale.setScalar(Math.min(1, c.chute.scale.x + dt * 4));
      // parachute terminal descent + gentle sway (brisk enough that a high
      // drop still lands in a few seconds, gentle enough for a soft thump)
      c.vel.y = lerp(c.vel.y, -26, 0.08);
      c.vel.x = lerp(c.vel.x, Math.sin(c.t * 2.2) * 5, 0.05);
      c.vel.z = lerp(c.vel.z, Math.cos(c.t * 1.9) * 5, 0.05);
      c.mesh.rotation.z = Math.sin(c.t * 2.2) * 0.12;
    } else {
      c.vel.y -= g * dt;
    }
    c.mesh.position.addScaledVector(c.vel, dt);
    var gh = terrainHeight(c.mesh.position.x, c.mesh.position.z);
    if (c.mesh.position.y <= gh + 0.5 && !c.landed) {
      c.landed = true;
      landCargo(c);
    }
  }

  function landCargo(c) {
    c.mesh.position.y = terrainHeight(c.mesh.position.x, c.mesh.position.z);
    c.chute.visible = false;
    Audio.thump();
    dustPuff(c.mesh.position);
    // distance to the active beacon decides the celebration tier (§6.1)
    var lz = G.activeLZ;
    var d = lz ? Math.hypot(c.mesh.position.x - lz.pos[0], c.mesh.position.z - lz.pos[2]) : 9999;
    var tier = d < CONFIG.bullseye ? 'bull' : d < CONFIG.close ? 'close' : 'ok';
    Audio.chime(tier === 'bull');
    if (tier === 'bull') confetti(c.mesh.position, lz ? lz.color : '#ffd23f');

    // hand the mesh over to the persistent delivered group and record it
    scene.remove(c.mesh);
    var record = { creatureId: c.def.id, lzId: lz ? lz.id : null,
                   pos: [c.mesh.position.x, c.mesh.position.y, c.mesh.position.z],
                   rot: c.mesh.rotation.y || 0, ts: 0, tier: tier };
    addDelivered(record, true);
    G.save.deliveries.push(record);
    if (G.save.collection.indexOf(c.def.id) < 0) G.save.collection.push(c.def.id);
    Persist.save(G.save);

    G.cargo = null;
    // delivery done -> the gold home beacon lights and the chevron points home:
    // now fly back and land (the pilot's loop, IMPROVEMENT_PLAN 1.2)
    G.activeLZ = CONFIG.homeBase;
    Object.keys(beacons).forEach(function (k) { beacons[k].visible = (k === 'home'); });
    UI.deliveryBanner(tier);
  }

  // instantiate a delivered creature into the world (spec §6.2)
  function addDelivered(rec, justLanded) {
    var def = CONFIG.creatures.filter(function (d) { return d.id === rec.creatureId; })[0];
    if (!def) return;
    var m = makeCreature(def);
    m.scale.setScalar(14 * def.scale / 1.0);
    m.userData.baseY = rec.pos[1];
    m.userData.phase = (rec.pos[0] * 0.7 + rec.pos[2] * 0.3) % TAU;
    m.userData.standT = justLanded ? 0 : 1;
    m.position.set(rec.pos[0], rec.pos[1], rec.pos[2]);
    m.rotation.y = rec.rot;
    deliveredGroup.add(m);
    if (justLanded) m.userData.landT = 0; // pop-up animation
  }

  /* ---- particle bits: dust, confetti, smoke ------------------------------ */
  var puffs = [];
  function dustPuff(pos) {
    for (var i = 0; i < 8; i++) {
      var mm = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.abs(Math.sin(i)) * 3, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.8, fog: false }));
      mm.position.copy(pos); mm.position.y += 2;
      var a = (i / 8) * TAU;
      scene.add(mm);
      puffs.push({ m: mm, vel: new THREE.Vector3(Math.cos(a) * 14, 8 + i, Math.sin(a) * 14), life: 1 });
    }
  }
  function confetti(pos, color) {
    for (var i = 0; i < 40; i++) {
      var hue = (i * 37) % 360;
      var mm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.4),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('hsl(' + hue + ',85%,60%)'), fog: false }));
      mm.position.copy(pos); mm.position.y += 10;
      var a = (i / 40) * TAU, sp = 18 + (i % 5) * 6;
      scene.add(mm);
      puffs.push({ m: mm, vel: new THREE.Vector3(Math.cos(a) * sp, 30 + (i % 7) * 4, Math.sin(a) * sp), life: 1.6, spin: true, grav: true });
    }
  }
  function stepPuffs(dt) {
    for (var i = puffs.length - 1; i >= 0; i--) {
      var p = puffs[i];
      if (p.grav) p.vel.y -= 40 * dt;
      p.m.position.addScaledVector(p.vel, dt);
      if (p.spin) { p.m.rotation.x += dt * 8; p.m.rotation.y += dt * 6; }
      p.life -= dt * (p.grav ? 0.6 : 1.2);
      if (p.m.material.opacity !== undefined && !p.grav) p.m.material.opacity = Math.max(0, p.life);
      if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); puffs.splice(i, 1); }
    }
  }
  var smokeGroup = new THREE.Group(); scene.add(smokeGroup);
  var smokePuffs = [], smokeTimer = 0;
  function stepSmoke(dt) {
    if (G.smoke && G.running && plane) {
      smokeTimer += dt;
      if (smokeTimer > 0.05) {
        smokeTimer = 0;
        var mm = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 5),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(G.profile.color), transparent: true, opacity: 0.45, fog: false }));
        var back = sim.forward.clone().multiplyScalar(-26);
        mm.position.copy(sim.pos).add(back);
        smokeGroup.add(mm); smokePuffs.push({ m: mm, life: 1 });
      }
    }
    for (var i = smokePuffs.length - 1; i >= 0; i--) {
      var p = smokePuffs[i]; p.life -= dt * 0.7;
      p.m.scale.multiplyScalar(1 + dt * 1.2); p.m.material.opacity = Math.max(0, p.life * 0.6);
      if (p.life <= 0) { smokeGroup.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); smokePuffs.splice(i, 1); }
    }
  }

  /* ---- camera chase ------------------------------------------------------ */
  var camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), _back = new THREE.Vector3(), _u2 = new THREE.Vector3();
  function updateCamera(dt) {
    sim.forward.set(0, 0, -1).applyQuaternion(sim.q);
    _u2.set(0, 1, 0).applyQuaternion(sim.q);
    _back.copy(sim.forward).multiplyScalar(-52).add(_u2.clone().multiplyScalar(18));
    var want = _back.add(sim.pos);
    var k = 1 - Math.pow(0.0016, dt); // framerate-independent smoothing
    camPos.lerp(want, k);
    // keep camera above ground
    var cg = terrainHeight(camPos.x, camPos.z) + 8;
    if (camPos.y < cg) camPos.y = cg;
    camera.position.copy(camPos);
    camLook.lerp(sim.pos.clone().add(sim.forward.clone().multiplyScalar(30)), k);
    camera.lookAt(camLook);
  }

  /* ---- screen flash / squash on bonk ------------------------------------- */
  function flash() {
    var f = document.getElementById('flash');
    f.style.transition = 'none'; f.style.opacity = '0.85';
    // force reflow then fade
    void f.offsetWidth;
    f.style.transition = 'opacity 0.5s ease-out'; f.style.opacity = '0';
  }

  /* ---- screen transitions ------------------------------------------------ */
  function returnToHangar() {
    G.running = false; G.screen = 'hangar';
    // save flight time
    Persist.save(G.save);
    UI.fadeThen(function () { UI.showHangar(); });
  }

  /* ---- profile selection wires up everything ----------------------------- */
  function chooseProfile(profile) {
    Audio.unlock(); // the profile tap is the audio-unlock gesture (spec §4.2)
    G.profile = profile;
    G.save = Persist.load(profile.id) || Persist.blank(profile);
    // (re)build the plane in the pilot's colour with their tail number
    if (plane) scene.remove(plane);
    plane = makePlane(profile.color, G.save.tailNumber);
    scene.add(plane);
    // clear + rebuild this pilot's delivered world
    while (deliveredGroup.children.length) deliveredGroup.remove(deliveredGroup.children[0]);
    G.save.deliveries.forEach(function (rec) { addDelivered(rec, false); });
    G.screen = 'hangar';
    UI.showHangar();
  }

  function chooseCreature(def) { G.carrying = def; G.screen = 'dest'; UI.showDest(); }
  function chooseDest(lm) { G.mode = 'deliver'; G.rescued = false; G.rescueTarget = null; G.activeLZ = lm; startFlight(); }

  // Rescue: a stranded buddy is out at a landmark with a flare. Fly out empty,
  // scoop it on a low-and-slow pass, then bring it home to land.
  function chooseRescue() {
    var lm = CONFIG.landmarks[Math.floor(rnd() * CONFIG.landmarks.length)];
    var def = CONFIG.creatures[Math.floor(rnd() * CONFIG.creatures.length)];
    G.mode = 'rescue'; G.rescued = false; G.carrying = null;
    G.activeLZ = lm;
    while (rescueGroup.children.length) rescueGroup.remove(rescueGroup.children[0]);
    var gy = terrainHeight(lm.pos[0], lm.pos[2]);
    var cre = makeCreature(def); cre.scale.setScalar(14 * def.scale);
    cre.position.set(lm.pos[0], gy, lm.pos[2]);
    cre.userData.baseY = gy; cre.userData.standT = 1;
    rescueGroup.add(cre);
    var flare = new THREE.Mesh(new THREE.SphereGeometry(11, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4030, transparent: true, opacity: 0.9, fog: false }));
    flare.position.set(lm.pos[0], gy + 78, lm.pos[2]); rescueGroup.add(flare);
    G.rescueTarget = { def: def, pos: [lm.pos[0], gy, lm.pos[2]], mesh: cre, flare: flare };
    startFlight();
  }
  var _seed = 12345;
  function rnd() { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }

  function scoopRescue() {
    var rt = G.rescueTarget;
    G.rescued = true; G.carrying = rt.def;    // now carry the buddy home
    while (rescueGroup.children.length) rescueGroup.remove(rescueGroup.children[0]);
    Audio.chime(false); dustPuff(new THREE.Vector3(rt.pos[0], rt.pos[1] + 12, rt.pos[2]));
    G.activeLZ = CONFIG.homeBase;
    Object.keys(beacons).forEach(function (k) { beacons[k].visible = (k === 'home'); });
    UI.deliveryBanner('close');               // 👏 — got you!
  }

  function deliverRescueHome() {
    var def = G.carrying; if (!def) return;
    // fan rescued buddies out into a little colony beside the runway
    var n = G.save.deliveries.filter(function (d) { return d.lzId === 'home'; }).length;
    var a = n * 0.9, r = 80 + (n % 4) * 24;
    var x = Math.cos(a) * r + 120, z = 160 + Math.sin(a) * r, gy = terrainHeight(x, z);
    var rec = { creatureId: def.id, lzId: 'home', pos: [x, gy, z], rot: a, ts: 0, tier: 'bull' };
    addDelivered(rec, true); G.save.deliveries.push(rec);
    if (G.save.collection.indexOf(def.id) < 0) G.save.collection.push(def.id);
    Persist.save(G.save);
    confetti(new THREE.Vector3(x, gy + 12, z), def.color);
    G.carrying = null; G.rescued = false;
  }

  /* ---- input: floating stick (left half) + DROP (right) ------------------ */
  var stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0, active: false };
  var STICK_R = 140;
  function onDown(e) {
    Audio.unlock();
    if (G.screen !== 'fly') return;
    var el = e.target;
    if (el && el.dataset && el.dataset.btn) return; // buttons handle themselves
    if (e.clientX < window.innerWidth * 0.5 && stick.id < 0) {
      stick.id = e.pointerId; stick.active = true;
      stick.ox = e.clientX; stick.oy = e.clientY; stick.x = 0; stick.y = 0;
      UI.showStick(e.clientX, e.clientY);
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (e.pointerId === stick.id) {
      var dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      var mag = Math.hypot(dx, dy);
      if (mag > STICK_R) { dx *= STICK_R / mag; dy *= STICK_R / mag; }
      stick.x = dx / STICK_R; stick.y = dy / STICK_R;
      sim.rollIn = clamp(stick.x, -1, 1);
      sim.pitchIn = clamp(-stick.y, -1, 1); // push up on screen -> nose up
      UI.moveStick(stick.ox + dx, stick.oy + dy);
      e.preventDefault();
    }
  }
  function onUp(e) {
    if (e.pointerId === stick.id) {
      stick.id = -1; stick.active = false; stick.x = stick.y = 0;
      sim.rollIn = 0; sim.pitchIn = 0; UI.hideStick();
    }
  }

  /* ---- the loop ---------------------------------------------------------- */
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    G.t += dt;

    if (G.running && G.screen === 'fly' && !UI.portrait) {
      if (G.phase === 'roll') stepRoll(dt);
      else if (G.phase === 'rollout') stepRollout(dt);
      else stepFlight(dt);
      stepCargo(dt);
      G.save.flightSeconds += dt;
      // engine note (§7) — the single strongest energy-lesson channel.
      // Full song during the takeoff roll (spool), quiet idle on rollout.
      var thrust01 = G.phase === 'roll' ? 1 : G.phase === 'rollout' ? 0.1
                   : AERO.thrust(sim.v) / AERO.C.THRUST_MAX;
      Audio.engine(sim.v, thrust01, true);
      // plane follows sim
      plane.position.copy(sim.pos); plane.quaternion.copy(sim.q);
      plane.userData.prop.rotation.z += dt * (18 + sim.v * 0.4);
      plane.userData.light.intensity = G.light ? 2.2 : 0;
      updateCamera(dt);
      UI.updateChevron(camera, G.phase === 'fly' ? G.activeLZ : null, sim.pos);
      UI.updateStallHint(G.phase === 'fly' && sim.v < AERO.C.V_STALL * 1.1);
    } else {
      Audio.engine(0, 0, false);
    }

    // ambient life regardless of screen: birds circle, balloons bob (and
    // wobble briefly after a honk — the world answers back)
    stepPuffs(dt); stepSmoke(dt);
    stepAmbientBirds(ambientBirds, dt);
    if (G.honkFx > 0) G.honkFx = Math.max(0, G.honkFx - dt);
    balloons.forEach(function (b) {
      b.m.position.y = b.baseY + Math.sin(G.t * 0.8 + b.phase) * 7 + Math.sin(G.t * 9) * G.honkFx * 5;
      b.m.rotation.z = Math.sin(G.t * 1.1 + b.phase) * 0.05 + Math.sin(G.t * 11) * G.honkFx * 0.09;
    });
    // beacon pulse (landmarks + the gold home beacon)
    Object.keys(beacons).forEach(function (key) {
      var b = beacons[key]; if (!b.visible) return;
      var pulse = 0.22 + Math.sin(G.t * 3) * 0.12;
      b.userData.mat.opacity = pulse;
    });
    // stranded buddy: pulsing flare + waving for help until scooped
    if (G.mode === 'rescue' && !G.rescued && G.rescueTarget) {
      var fl = G.rescueTarget.flare;
      if (fl) { fl.scale.setScalar(1 + Math.sin(G.t * 6) * 0.28); fl.material.opacity = 0.55 + Math.sin(G.t * 6) * 0.35; }
      animateCreature(G.rescueTarget.mesh, G.t, true);
    }
    // delivered creatures idle + wave on flyby (§6.2)
    deliveredGroup.children.forEach(function (m) {
      if (m.userData.baseY === undefined) m.userData.baseY = m.position.y;
      if (m.userData.landT !== undefined && m.userData.landT < 1) {
        m.userData.landT = Math.min(1, m.userData.landT + dt * 2.5);
        m.userData.standT = m.userData.landT;
        m.scale.setScalar((14 * m.userData.def.scale) * (0.3 + 0.7 * ease(m.userData.landT)));
      }
      var near = G.running && Math.hypot(m.position.x - sim.pos.x, m.position.z - sim.pos.z) < 140;
      animateCreature(m, G.t, near);
    });

    renderer.render(scene, camera);
  }
  function ease(t) { return 1 + 2.2 * t * (1 - t) * (1 - t) * 4 - 0; } // gentle overshoot-ish

  /* ---- resize / orientation --------------------------------------------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    UI.checkPortrait();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // pointer input
  var glc = renderer.domElement;
  glc.style.touchAction = 'none';
  window.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // iOS: kill pinch-zoom, double-tap-zoom and rubber-band scroll so a touch
  // only ever flies the plane (spec §4.2). Without this a stray pinch zooms the
  // page and one-finger drags then scroll the zoomed page instead of steering.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  var _lastTap = 0;
  document.addEventListener('touchend', function (e) { var n = Date.now(); if (n - _lastTap < 350) e.preventDefault(); _lastTap = n; }, { passive: false });

  // expose actions to the UI layer
  App.actions = {
    chooseProfile: chooseProfile, chooseCreature: chooseCreature, chooseDest: chooseDest,
    chooseRescue: chooseRescue,
    drop: dropCargo, honk: function () { Audio.honk(); G.honkFx = 1.3; },
    toggleSmoke: function () { G.smoke = !G.smoke; return G.smoke; },
    toggleLight: function () { G.light = !G.light; return G.light; },
    backToHangar: returnToHangar
  };
  App.state = G;

  UI.init(App, CONFIG);
  resize();
  UI.showProfile();
  frame();
}

/* ============================================================================
 * UI  —  DOM overlays (profile / hangar / destination), touch stick visual,
 * DROP button, cockpit toys, nav chevron, portrait warning. Built in JS so the
 * single HTML file stays a thin shell. Everything survives text removal (§2.3).
 * ==========================================================================*/
var UI = (function () {
  var app, cfg, root, stickEl, chevronEl, dropEl, screens = {}, banner, previewRenderer;
  var portrait = false;

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }

  function init(a, c) {
    app = a; cfg = c; root = document.getElementById('ui');
    buildFlyHud();
    buildPortrait();
  }

  /* ---------- shared preview renderer for cards --------------------------- */
  function previewURL(buildFn, size) {
    size = size || 220;
    if (!previewRenderer) {
      previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      previewRenderer.outputEncoding = THREE.sRGBEncoding;
    }
    previewRenderer.setSize(size, size);
    var s = new THREE.Scene();
    s.add(new THREE.HemisphereLight('#ffffff', '#557', 1.2));
    var d = new THREE.DirectionalLight('#fff', 0.8); d.position.set(2, 3, 2); s.add(d);
    var obj = buildFn(); s.add(obj);
    var box = new THREE.Box3().setFromObject(obj); var c = box.getCenter(new THREE.Vector3()); var sz = box.getSize(new THREE.Vector3());
    var maxDim = Math.max(sz.x, sz.y, sz.z);
    // Fit distance from the FOV with a healthy margin so tall/wide landmarks
    // (mountain, island) sit fully in frame; near/far scale with the object so
    // nothing is clipped the way a fixed 0.1..1000 camera would be.
    var fov = 34;
    var dist = (maxDim * 0.5) / Math.tan(fov * 0.5 * DEG) * 1.5;
    var cam = new THREE.PerspectiveCamera(fov, 1, Math.max(0.05, dist * 0.01), dist * 6 + maxDim * 4);
    var dir = new THREE.Vector3(0.9, 0.55, 1.7).normalize();
    cam.position.copy(c).addScaledVector(dir, dist); cam.lookAt(c);
    previewRenderer.render(s, cam);
    return previewRenderer.domElement.toDataURL('image/png');
  }

  /* ---------- profile picker (spec §5.1) ---------------------------------- */
  function showProfile() {
    hideAll();
    var sc = screens.profile || (screens.profile = buildProfile());
    sc.style.display = 'flex';
  }
  function buildProfile() {
    var sc = el('div', 'screen center', root);
    var h = el('div', 'bigtitle', sc); h.textContent = 'Who is flying?';
    var row = el('div', 'cardrow', sc);
    cfg.profiles.forEach(function (p) {
      var card = el('button', 'pilotcard', row);
      card.style.background = p.color;
      var ic = el('div', 'picon', card); ic.textContent = p.icon;
      var nm = el('div', 'pname', card); nm.textContent = p.name; // for the grown-up
      card.onclick = function () { app.actions.chooseProfile(p); };
    });
    return sc;
  }

  /* ---------- hangar: choose a creature (size telegraphs weight) ---------- */
  function showHangar() {
    hideAll();
    var sc = buildHangar(); // rebuild so it reflects latest
    screens.hangar && screens.hangar.remove();
    screens.hangar = sc; root.appendChild(sc); sc.style.display = 'flex';
  }
  function buildHangar() {
    var sc = el('div', 'screen center');
    el('div', 'bigtitle', sc).textContent = 'Pick your buddy';
    var row = el('div', 'cardrow wrap', sc);
    cfg.creatures.forEach(function (def) {
      var card = el('button', 'creaturecard', row);
      // card size telegraphs weight (spec §2 / §6.2)
      var s = 120 + def.mass * 150;
      card.style.width = s + 'px'; card.style.height = (s + 40) + 'px';
      var img = el('img', 'cimg', card);
      try { img.src = previewURL(function () { return makeCreature(def); }, 220); } catch (e) {}
      // weight pips (dots) — a countable, wordless weight cue
      var pips = el('div', 'pips', card);
      var n = Math.round(def.mass / 0.2) + 1;
      for (var i = 0; i < n; i++) { var d = el('span', 'pip', pips); d.style.background = def.color; }
      card.onclick = function () { app.actions.chooseCreature(def); };
    });
    // a second kind of mission: go rescue a stranded buddy and bring it home
    var rcard = el('button', 'creaturecard rescuecard', row);
    rcard.style.width = '150px'; rcard.style.height = '190px';
    el('div', 'rescueicon', rcard).textContent = '🆘';
    el('div', 'destname', rcard).textContent = 'Rescue!';
    rcard.onclick = function () { app.actions.chooseRescue(); };
    return sc;
  }

  /* ---------- destination cards ------------------------------------------- */
  function showDest() {
    hideAll();
    var sc = buildDest();
    screens.dest && screens.dest.remove(); screens.dest = sc; root.appendChild(sc); sc.style.display = 'flex';
  }
  function buildDest() {
    var sc = el('div', 'screen center');
    el('div', 'bigtitle', sc).textContent = 'Where to?';
    var row = el('div', 'cardrow', sc);
    cfg.landmarks.forEach(function (lm) {
      var card = el('button', 'destcard', row);
      card.style.borderColor = lm.color;
      // pale tint of the landmark colour so white/pale features (snow cap,
      // sand) stay visible and each place reads by colour at a glance
      card.style.background = shade(lm.color, 0.86).getStyle();
      var img = el('img', 'cimg', card);
      try { img.src = previewURL(function () { var o = buildLandmark(lm); o.position.set(0, 0, 0); return o; }, 240); } catch (e) {}
      var swatch = el('div', 'swatch', card); swatch.style.background = lm.color;
      var nm = el('div', 'destname', card); nm.textContent = lm.label;
      card.onclick = function () { app.actions.chooseDest(lm); };
    });
    return sc;
  }

  /* ---------- flight HUD: DROP, toys, stick, chevron ---------------------- */
  function buildFlyHud() {
    var hud = el('div', 'hud', root); screens.fly = hud; hud.style.display = 'none';

    // cockpit toys (top) — playthings the north star asks for; never affect flight
    var toys = el('div', 'toys', hud);
    mkToy(toys, '💡', function (b) { b.classList.toggle('on', app.actions.toggleLight()); });
    mkToy(toys, '💨', function (b) { b.classList.toggle('on', app.actions.toggleSmoke()); });
    mkToy(toys, '📣', function (b) { app.actions.honk(); flashBtn(b); });
    mkToy(toys, '🏠', function () { app.actions.backToHangar(); });

    // DROP — enormous, the only real action button (spec §4.1)
    dropEl = el('button', 'drop', hud); dropEl.dataset.btn = '1';
    dropEl.innerHTML = '<span>DROP</span>';
    dropEl.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.drop(); pulse(dropEl); });

    // floating stick visual
    stickEl = el('div', 'stick', hud); stickEl.style.display = 'none';
    el('div', 'stick-knob', stickEl);

    // nav chevron (always-on off-screen pointer, spec §2.4)
    chevronEl = el('div', 'chevron', hud); chevronEl.innerHTML = '▲'; chevronEl.style.display = 'none';

    // stall hint (visual — the plane got sleepy)
    var sh = el('div', 'stallhint', hud); sh.textContent = '💤'; sh.style.opacity = '0'; screens._stall = sh;

    // pull-up hint — bounces once the takeoff roll reaches rotation speed
    var ph = el('div', 'pullhint', hud); ph.textContent = '⬆️'; ph.style.display = 'none'; screens._pull = ph;

    // delivery banner
    banner = el('div', 'banner', hud); banner.style.display = 'none';
  }
  function mkToy(parent, glyph, fn) {
    var b = el('button', 'toy', parent); b.dataset.btn = '1'; b.textContent = glyph;
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); fn(b); });
    return b;
  }
  function flashBtn(b) { b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 180); }
  function pulse(elm) { elm.classList.remove('pulse'); void elm.offsetWidth; elm.classList.add('pulse'); }

  function showFly() { hideAll(); screens.fly.style.display = 'block'; setDropReady(true); }
  function setDropReady(on) { if (dropEl) dropEl.classList.toggle('ready', !!on); }
  function setDropVisible(on) { if (dropEl) dropEl.style.display = on ? '' : 'none'; }
  function showPullHint(on) { if (screens._pull) screens._pull.style.display = on ? 'block' : 'none'; }

  function showStick(x, y) { stickEl.style.display = 'block'; moveStick(x, y); stickEl.style.left = (x - 70) + 'px'; stickEl.style.top = (y - 70) + 'px'; }
  function moveStick(x, y) { var k = stickEl.firstChild; if (k) { k.style.left = (x - stickEl.offsetLeft - 35) + 'px'; k.style.top = (y - stickEl.offsetTop - 35) + 'px'; } }
  function hideStick() { stickEl.style.display = 'none'; }

  function updateStallHint(on) { if (screens._stall) screens._stall.style.opacity = on ? '1' : '0'; }

  function deliveryBanner(tier) {
    if (!banner) return;
    banner.textContent = tier === 'bull' ? '🎉' : tier === 'close' ? '👏' : '🙂';
    banner.className = 'banner show ' + tier;
    banner.style.display = 'flex';
    setTimeout(function () { banner.style.display = 'none'; }, 1800);
  }

  /* ---------- nav chevron math -------------------------------------------- */
  var _v = null;
  function updateChevron(camera, lz, planePos) {
    if (!lz) { chevronEl.style.display = 'none'; return; }
    if (!_v) _v = new THREE.Vector3();
    _v.set(lz.pos[0], terrainHeight(lz.pos[0], lz.pos[2]) + 150, lz.pos[2]);
    var p = _v.clone().project(camera);
    var onScreen = p.z < 1 && p.x > -0.95 && p.x < 0.95 && p.y > -0.95 && p.y < 0.95;
    if (onScreen) { chevronEl.style.display = 'none'; return; } // beacon column suffices
    // direction from centre; if behind camera, flip
    var dx = p.x, dy = p.y;
    if (p.z > 1) { dx = -dx; dy = -dy; }
    var ang = Math.atan2(dy, dx);
    var w = window.innerWidth, h = window.innerHeight;
    var m = 70; var rx = (w / 2) - m, ry = (h / 2) - m;
    // clamp to an ellipse on the screen edge
    var cx = w / 2 + Math.cos(ang) * rx, cy = h / 2 - Math.sin(ang) * ry;
    chevronEl.style.display = 'flex';
    chevronEl.style.left = (cx - 34) + 'px'; chevronEl.style.top = (cy - 34) + 'px';
    chevronEl.style.color = lz.color;
    chevronEl.style.transform = 'rotate(' + (90 - ang / Math.PI * 180) + 'deg)';
  }

  /* ---------- portrait warning (spec §4.2) -------------------------------- */
  function buildPortrait() {
    var p = el('div', 'portrait', root); screens.portrait = p; p.style.display = 'none';
    el('div', 'roticon', p).textContent = '📱↻';
    el('div', 'portmsg', p).textContent = 'Turn me sideways!';
  }
  function checkPortrait() {
    portrait = window.innerHeight > window.innerWidth;
    UIobj.portrait = portrait;
    screens.portrait.style.display = portrait ? 'flex' : 'none';
  }

  function fadeThen(fn) {
    var f = el('div', 'fade', root); f.style.opacity = '0';
    void f.offsetWidth; f.style.opacity = '1';
    setTimeout(function () { fn(); f.style.opacity = '0'; setTimeout(function () { f.remove(); }, 500); }, 350);
  }

  function hideAll() {
    ['profile', 'hangar', 'dest', 'fly'].forEach(function (k) { if (screens[k]) screens[k].style.display = 'none'; });
    if (chevronEl) chevronEl.style.display = 'none';
    hideStick();
  }

  var UIobj = {
    init: init, showProfile: showProfile, showHangar: showHangar, showDest: showDest,
    showFly: showFly, showStick: showStick, moveStick: moveStick, hideStick: hideStick,
    setDropReady: setDropReady, setDropVisible: setDropVisible, showPullHint: showPullHint,
    updateChevron: updateChevron, updateStallHint: updateStallHint,
    deliveryBanner: deliveryBanner, checkPortrait: checkPortrait, fadeThen: fadeThen,
    get portrait() { return portrait; }, set portrait(v) { portrait = v; }
  };
  return UIobj;
})();

/* ---- go, once the DOM is ready ------------------------------------------- */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// headless-verification hook (harmless in production)
window.FlightSchool = App;

})();
