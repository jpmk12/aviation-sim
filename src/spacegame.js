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
  function blank(p) { return { profileId: p.id, icon: p.icon, color: p.color, tailNumber: tailFromInitials(p.initials || p.name), deliveries: [], missions: 0 }; }
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

function makeBeaconRing(color, size) {
  var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  var ring = new THREE.Mesh(new THREE.TorusGeometry(size * 1.25, size * 0.06, 8, 40), m);
  ring.userData.mat = m; return ring;
}

// A rocket for launch: body + nose + fins + two detachable boosters + flame.
function makeRocket(color) {
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 16, 14), mat('#eef1f5'));
  g.add(body);
  var nose = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 14), mat(color)); nose.position.y = 10.5; g.add(nose);
  var band = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 2.4, 14), mat(color)); band.position.y = 3; g.add(band);
  [0, 1, 2].forEach(function (i) { var fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 3), mat(shade(color, -0.2))); var a = i / 3 * TAU; fin.position.set(Math.cos(a) * 3, -6, Math.sin(a) * 3); fin.rotation.y = -a; g.add(fin); });
  // detachable boosters
  var boosters = new THREE.Group();
  [-1, 1].forEach(function (s) {
    var b = new THREE.Group();
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 11, 10), mat('#d7dde4')); b.add(tube);
    var bn = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 10), mat(shade(color, -0.1))); bn.position.y = 6.7; b.add(bn);
    b.position.set(s * 4.4, -2, 0); boosters.add(b);
  });
  g.add(boosters);
  // engine flame (scaled by throttle)
  var flame = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 12), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, fog: false }));
  flame.position.y = -12; flame.rotation.x = Math.PI; g.add(flame);
  var flame2 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5, 12), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9, fog: false }));
  flame2.position.y = -10.5; flame2.rotation.x = Math.PI; g.add(flame2);
  g.userData = { boosters: boosters, flame: flame, flame2: flame2, body: body };
  return g;
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
    // ground + pad
    var ground = new THREE.Mesh(new THREE.CircleGeometry(1200, 40), mat('#6bae52')); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    var pad = new THREE.Mesh(new THREE.CylinderGeometry(40, 46, 6, 20), mat('#7c828c', false)); pad.position.y = 3; sc.add(pad);
    var tower = new THREE.Mesh(new THREE.BoxGeometry(4, 60, 4), mat('#b9bec6', false)); tower.position.set(-34, 30, 0); sc.add(tower);
    var rocket = makeRocket('#ff8a3d'); rocket.position.y = 14; sc.add(rocket);
    // exhaust smoke pool
    var smoke = [];
    launch = { sc: sc, rocket: rocket, stars: stars, ground: ground, pad: pad, tower: tower, smoke: smoke,
               y: 0, vy: 0, sep: false, done: false };
    return sc;
  }
  function enterLaunch() {
    if (!launch) buildLaunch();
    G.stageName = 'launch'; G.running = true;
    var l = launch;
    // recolor rocket nose to pilot colour, reset
    l.rocket.position.set(0, 14, 0); l.y = 0; l.vy = 0; l.sep = false; l.done = false;
    l.rocket.userData.boosters.visible = true;
    l.rocket.userData.boosters.position.set(0, 0, 0);
    G.throttle = 0; G.ignited = false;
    scenes.launch = l.sc;
    UI.showLaunch();
  }
  var _shake = 0;
  function updateLaunch(dt) {
    var l = launch; if (!l) return;
    var mass = (SPACE.C.M_FULL + (G.buddy ? G.buddy.mass : 0)) * (l.sep ? (SPACE.C.M_LIGHT / SPACE.C.M_FULL) : 1);
    var thr = G.ignited ? G.throttle : 0;
    Audio.rumbleTo(thr);
    if (G.ignited) {
      var a = SPACE.launchAccel(thr, mass);
      l.vy += a * dt;
      if (l.vy < 0 && l.y <= 0) l.vy = 0;
      l.y += l.vy * dt; if (l.y < 0) l.y = 0;
      // booster separation
      if (!l.sep && l.y >= SPACE.C.ALT_SEP) {
        l.sep = true; Audio.sep();
        l.rocket.userData.boosters.userData.drop = true;
        l.rocket.userData.boosters.userData.vy = -8;
      }
      if (l.y >= SPACE.C.ALT_SPACE && !l.done) { l.done = true; enterSpace(); return; }
    }
    // visuals
    l.rocket.position.y = 14 + l.y;
    var b = l.rocket.userData.boosters;
    if (b.userData.drop) { b.userData.vy -= 30 * dt; b.position.y += b.userData.vy * dt; b.rotation.z += dt * 1.5; b.children.forEach(function (c, i) { c.rotation.x += dt * (2 + i); }); if (b.position.y < -600) b.visible = false; }
    var flScale = G.ignited ? (0.3 + thr * 1.1) : 0;
    l.rocket.userData.flame.scale.set(1, flScale, 1); l.rocket.userData.flame2.scale.set(1, flScale * 1.1, 1);
    l.rocket.userData.flame.visible = l.rocket.userData.flame2.visible = flScale > 0.01;
    // sky darkens + stars fade with altitude
    var k = clamp(l.y / SPACE.C.ALT_SPACE, 0, 1);
    l.sc.background.setRGB(lerp(0.75, 0.02, k), lerp(0.89, 0.02, k), lerp(1.0, 0.08, k));
    l.stars.visible = k > 0.35; if (l.stars.material) l.stars.material.opacity = k;
    // camera: side view, close at the pad then pulls back as it climbs
    var camDist = 46 + l.y * 0.1;
    _shake = lerp(_shake, G.ignited ? thr * 2.2 : 0, 0.2);
    var sh = (Math.sin(G.t * 60) * _shake);
    camera.position.set(camDist, 18 + l.y + sh, camDist);
    camera.lookAt(0, 16 + l.y, 0);
    // throttle lever feedback
    UI.setLaunchAltitude(k, l.sep);
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
    space = { sc: sc, planets: planetObjs, rocks: rocks, gems: gems, warp: warpField,
              q: new THREE.Quaternion(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, -1), thrusting: false };
    return sc;
  }
  function enterSpace() {
    if (!space) buildSpace();
    G.stageName = 'space'; G.running = true;
    var s = space;
    // start near origin, facing the destination
    s.pos.set(0, 0, 0); s.vel.set(0, 0, 0);
    var tp = G.planet.pos;
    var ang = Math.atan2(tp[0] - s.pos.x, -(tp[2] - s.pos.z));
    s.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    s.fwd.set(0, 0, -1).applyQuaternion(s.q);
    // beacon only on destination
    Object.keys(s.planets).forEach(function (k) { s.planets[k].ring.visible = (k === G.planet.id); });
    // decorate planets with delivered buddies (dots in orbit)
    decoratePlanets(s);
    // strew some asteroids + collectible stars along the route
    buildRoute(s, tp);
    G.collected = 0;
    // reset switches display
    scenes.space = s.sc;
    Audio.rumbleTo(0);
    UI.showSpace();
  }
  function decoratePlanets(s) {
    var byPlanet = {};
    (G.save.deliveries || []).forEach(function (d) { (byPlanet[d.planetId] = byPlanet[d.planetId] || []).push(d); });
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
  function updateSpace(dt) {
    var s = space; if (!s) return;
    // steering: stick x = yaw, y = pitch
    var yaw = -G.stickX * 1.1 * dt, pitch = -G.stickY * 1.0 * dt;
    _dqy.setFromAxisAngle(AXy, yaw); s.q.premultiply(_dqy);
    _dqp.setFromAxisAngle(AXx, pitch); s.q.multiply(_dqp);
    s.fwd.set(0, 0, -1).applyQuaternion(s.q);
    // thrust (+ warp boost)
    var boost = G.switches.warp ? 1.8 : 1;
    if (s.thrusting) { s.vel.addScaledVector(s.fwd, SPACE.C.SPACE_ACCEL * boost * dt); Audio.hiss(1); Audio.rumbleTo(0.4); }
    else Audio.rumbleTo(0.05);
    // gentle arcade drift: ease velocity toward the nose, tiny damping, cap
    var sp = s.vel.length();
    if (sp > 0.01) { var want = s.fwd.clone().multiplyScalar(sp); s.vel.lerp(want, clamp(SPACE.C.SPACE_ALIGN * dt, 0, 1)); }
    s.vel.multiplyScalar(1 - SPACE.C.SPACE_DAMP * dt);
    if (s.vel.length() > SPACE.C.SPACE_VMAX * boost) s.vel.setLength(SPACE.C.SPACE_VMAX * boost);
    s.pos.addScaledVector(s.vel, dt);
    // soft tether
    var d = s.pos.length(); if (d > SPACE.C.TETHER_R) { s.pos.multiplyScalar(SPACE.C.TETHER_R / d); s.vel.multiplyScalar(0.5); }
    // asteroids: comedy bonk
    for (var i = 0; i < s.rocks.children.length; i++) { var r = s.rocks.children[i]; r.rotation.x += r.userData.spin.x * dt; r.rotation.y += r.userData.spin.y * dt; if (s.pos.distanceTo(r.position) < 55) { Audio.boing(); var push = s.pos.clone().sub(r.position).setLength(60); s.vel.addScaledVector(push, 1); s.vel.multiplyScalar(0.6); } }
    // gems: collect
    for (var j = s.gems.children.length - 1; j >= 0; j--) { var gm = s.gems.children[j]; gm.rotation.y += dt * 2; gm.position.y += Math.sin(G.t * 2 + j) * dt * 3; if (s.pos.distanceTo(gm.position) < 60) { s.gems.remove(gm); Audio.star(); G.collected++; UI.setStars(G.collected); UI.lightDashBulb(G.collected); } }
    // beacon pulse + planet spin
    Object.keys(s.planets).forEach(function (k) { var po = s.planets[k]; po.grp.rotation.y += dt * 0.05; if (po.ring.visible) { po.ring.userData.mat.opacity = 0.4 + Math.sin(G.t * 3) * 0.2; po.ring.lookAt(s.pos); } });
    // warp field
    s.warp.visible = G.switches.warp; if (G.switches.warp) { s.warp.position.copy(s.pos); s.warp.rotation.z += dt * 2; }
    // camera = cockpit (a touch behind the eye-point for a hint of nose)
    camera.position.copy(s.pos); camera.quaternion.copy(s.q);
    // approach destination -> land
    var dp = s.pos.distanceTo(new THREE.Vector3(G.planet.pos[0], G.planet.pos[1], G.planet.pos[2]));
    UI.updateSpaceHud(camera, G.planet, s.pos, dp);
    if (dp < G.planet.size + SPACE.C.APPROACH_R) { enterLanding(); return; }
  }

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
    landing = { sc: sc, ground: ground, pad: pad, lander: lander, stars: stars, y: 0, vy: 0, x: 0, vx: 0, done: false, delivered: null, puffs: [] };
    return sc;
  }
  function enterLanding() {
    if (!landing) buildLanding();
    G.stageName = 'landing'; G.running = true;
    var l = landing;
    l.sc.background = new THREE.Color(G.planet.sky);
    l.ground.material.color = new THREE.Color(G.planet.ground);
    l.y = SPACE.C.ALT_LAND_START; l.vy = SPACE.C.VY_LAND_START; l.x = (Math.sin(G.t) * 30); l.vx = 0; l.done = false; l.delivered = null;
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
      var thr = G.throttle;
      Audio.rumbleTo(thr * 0.8);
      var a = SPACE.landingAccel(thr, mass, G.planet.gravity);
      l.vy += a * dt; l.y += l.vy * dt;
      // small lateral nudge to line up with the pad (x=0)
      l.vx += (G.nudge * 14) * dt; l.vx *= (1 - 1.2 * dt); l.x += l.vx * dt;
      // flame
      var fl = 0.2 + thr * 1.2; l.lander.userData.flame.scale.set(1, fl, 1); l.lander.userData.flame.visible = thr > 0.02;
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
  function touchdown(l) {
    l.done = true;
    var tier = SPACE.landingTier(l.vy);
    dust(l, tier === 'bounce' ? 16 : 8);
    Audio.thump();
    if (tier === 'bounce') { Audio.boing(); l.lander.position.y = 6; l.bounce = 1; } // little squash-bounce, still lands
    var offPad = Math.abs(l.x) < 30;
    var big = tier === 'soft' && offPad;
    Audio.chime(big);
    if (big) confetti(l);
    // buddy hops out and waves
    var def = G.buddy;
    var hop = makeCreature(def); hop.scale.setScalar(3.2 * def.scale); hop.position.set(l.x + 6, 0, 6); hop.userData.t = 0; l.sc.add(hop); l.hopper = hop;
    // record delivery
    var rec = { creatureId: def.id, planetId: G.planet.id, tier: tier, ts: 0 };
    G.save.deliveries.push(rec); G.save.missions = (G.save.missions || 0) + 1; Persist.save(G.save);
    UI.deliveryBanner(big ? 'bull' : tier === 'bounce' ? 'ok' : 'close');
    setTimeout(function () { UI.showAfterLanding(); }, 2200);
  }
  function dust(l, n) { for (var i = 0; i < n; i++) { var m = new THREE.Mesh(new THREE.SphereGeometry(2 + (i % 3), 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(shade(G.planet.ground, 0.3)), transparent: true, opacity: 0.8, fog: false })); m.position.set(l.x, 1, 0); var a = i / n * TAU; l.sc.add(m); l.puffs.push({ m: m, vel: new THREE.Vector3(Math.cos(a) * 16, 6 + i, Math.sin(a) * 16), life: 1 }); } }
  function confetti(l) { for (var i = 0; i < 40; i++) { var hue = (i * 37) % 360; var m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color('hsl(' + hue + ',85%,60%)'), fog: false })); m.position.set(l.x, 8, 0); var a = i / 40 * TAU, sp = 14 + (i % 5) * 5; l.sc.add(m); l.puffs.push({ m: m, vel: new THREE.Vector3(Math.cos(a) * sp, 24 + (i % 6) * 3, Math.sin(a) * sp), life: 1.6 }); } }

  /* ==================================================================
   * flow between stages / menus
   * ================================================================== */
  function chooseProfile(p) {
    Audio.unlock(); G.profile = p; G.save = Persist.load(p.id) || Persist.blank(p);
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
  G.stickX = 0; G.stickY = 0; G.nudge = 0;
  function onDown(e) {
    Audio.unlock();
    if (e.target && e.target.dataset && e.target.dataset.btn) return;
    if (G.stageName === 'space' && e.clientX < window.innerWidth * 0.5 && stickId < 0) {
      stickId = e.pointerId; stickOX = e.clientX; stickOY = e.clientY; UI.showStick(e.clientX, e.clientY);
    }
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
    ignite: function () { G.ignited = true; Audio.unlock(); },
    setThrottle: function (v) { G.throttle = clamp(v, 0, 1); },
    setThrust: function (on) { if (space) space.thrusting = on; },
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
  // headless-test hook: jump the ship near the current destination so the
  // approach->landing transition fires without flying the full distance.
  App.testWarpToPlanet = function () { if (space && G.planet) { var tp = G.planet.pos; space.pos.set(tp[0] * 0.86, tp[1] * 0.86, tp[2] * 0.86); } };
  App.testLandingState = function () { return landing ? { y: landing.y, vy: landing.vy, done: landing.done } : null; };

  UI.init(App, CONFIG);
  resize(); UI.showProfile(); frame();
}

/* ============================================================================
 * UI  —  DOM overlays for every stage. Built in JS; styling in spaceshell.html.
 * ==========================================================================*/
var UI = (function () {
  var app, cfg, root, screens = {}, portrait = false, preview;
  var stickEl, chevronEl, dash = {}, throttleFill;

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
    return sc;
  }

  /* ---- map (planet) ---- */
  function showMap() { hideAll(); if (screens.map) screens.map.remove(); screens.map = buildMap(); root.appendChild(screens.map); screens.map.style.display = 'flex'; }
  function buildMap() {
    var sc = el('div', 'screen center space-bg'); el('div', 'bigtitle', sc).textContent = 'Where to?';
    var row = el('div', 'cardrow wrap', sc);
    cfg.planets.forEach(function (p) { var card = el('button', 'destcard', row); card.style.borderColor = p.color; card.style.background = shade(p.color, 0.86).getStyle(); var img = el('img', 'cimg', card); try { img.src = previewURL(function () { var o = makePlanet(p); return o; }, 240); } catch (e) {} el('div', 'destname', card).textContent = p.label; card.onclick = function () { app.actions.choosePlanet(p); }; });
    return sc;
  }

  /* ---- launch HUD ---- */
  function buildLaunchHud() {
    var hud = el('div', 'hud', root); screens.launch = hud; hud.style.display = 'none';
    var ign = el('button', 'ignite', hud); ign.dataset.btn = '1'; ign.textContent = '🔥'; ign.title = 'IGNITION';
    ign.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.ignite(); ign.classList.add('lit'); });
    // vertical throttle lever
    var wrap = el('div', 'throttle', hud); wrap.dataset.btn = '1';
    throttleFill = el('div', 'throttle-fill', wrap);
    var knob = el('div', 'throttle-knob', wrap);
    var dragging = false;
    function setFromY(clientY) { var r = wrap.getBoundingClientRect(); var v = clamp(1 - (clientY - r.top) / r.height, 0, 1); app.actions.setThrottle(v); throttleFill.style.height = (v * 100) + '%'; knob.style.bottom = 'calc(' + (v * 100) + '% - 22px)'; }
    wrap.addEventListener('pointerdown', function (e) { e.stopPropagation(); dragging = true; app.actions.ignite(); ign.classList.add('lit'); setFromY(e.clientY); });
    window.addEventListener('pointermove', function (e) { if (dragging) setFromY(e.clientY); });
    window.addEventListener('pointerup', function () { dragging = false; });
    var sepBadge = el('div', 'sepbadge', hud); sepBadge.textContent = '💥'; sepBadge.style.opacity = '0'; screens._sep = sepBadge;
    el('div', 'hint hint-launch', hud).textContent = '⬆';
  }
  function showLaunch() { hideAll(); if (!screens.launch) buildLaunchHud(); screens.launch.style.display = 'block'; }
  function setLaunchAltitude(k, sep) { if (screens._sep) screens._sep.style.opacity = sep ? '0' : '0'; }

  /* ---- space cockpit HUD ---- */
  function buildSpaceHud() {
    var hud = el('div', 'hud cockpit', root); screens.space = hud; hud.style.display = 'none';
    el('div', 'cockpit-frame', hud); // CSS window struts / vignette
    // chevron to destination
    chevronEl = el('div', 'chevron', hud); chevronEl.textContent = '▲'; chevronEl.style.display = 'none';
    // star counter
    dash.stars = el('div', 'starcount', hud); dash.stars.innerHTML = '⭐ 0';
    // dashboard with switches
    var panel = el('div', 'dashboard', hud);
    var defs = [['light', '💡'], ['comms', '📡'], ['warp', '🌀'], ['map', '🗺️'], ['music', '🎵'], ['gear', '⚙️']];
    dash.bulbs = el('div', 'bulbs', panel);
    for (var b = 0; b < 5; b++) { el('span', 'bulb', dash.bulbs); }
    var sw = el('div', 'switches', panel);
    dash.switchEls = {};
    defs.forEach(function (d) { var btn = el('button', 'switch', sw); btn.dataset.btn = '1'; btn.textContent = d[1]; dash.switchEls[d[0]] = btn; btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); var on = app.actions.toggleSwitch(d[0]); btn.classList.toggle('on', on); applyCockpitLight(); }); });
    // thrust button (right)
    var thrust = el('button', 'thrust', hud); thrust.dataset.btn = '1'; thrust.textContent = '🚀';
    thrust.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setThrust(true); thrust.classList.add('on'); });
    window.addEventListener('pointerup', function () { app.actions.setThrust(false); thrust.classList.remove('on'); });
    // stick visual
    stickEl = el('div', 'stick', hud); stickEl.style.display = 'none'; el('div', 'stick-knob', stickEl);
    dash.cockpitGlow = el('div', 'cockpit-glow', hud);
    dash.hud = hud;
  }
  function applyCockpitLight() { if (dash.cockpitGlow) dash.cockpitGlow.style.opacity = app.G.switches.light ? '1' : '0'; }
  function showSpace() { hideAll(); if (!screens.space) buildSpaceHud(); screens.space.style.display = 'block'; setStars(app.G.collected); }
  function setStars(n) { if (dash.stars) dash.stars.innerHTML = '⭐ ' + n; }
  function lightDashBulb(n) { if (dash.bulbs) { var b = dash.bulbs.children[(n - 1) % dash.bulbs.children.length]; if (b) b.classList.add('lit'); } }

  var _v = new THREE.Vector3();
  function updateSpaceHud(camera, planet, pos, dist) {
    if (!chevronEl) return;
    _v.set(planet.pos[0], planet.pos[1], planet.pos[2]);
    var p = _v.clone().project(camera);
    var onScreen = p.z < 1 && Math.abs(p.x) < 0.92 && Math.abs(p.y) < 0.92;
    if (onScreen) { chevronEl.style.display = 'none'; return; }
    var dx = p.x, dy = p.y; if (p.z > 1) { dx = -dx; dy = -dy; }
    var ang = Math.atan2(dy, dx), w = window.innerWidth, h = window.innerHeight, m = 70;
    var cx = w / 2 + Math.cos(ang) * (w / 2 - m), cy = h / 2 - Math.sin(ang) * (h / 2 - m);
    chevronEl.style.display = 'flex'; chevronEl.style.left = (cx - 34) + 'px'; chevronEl.style.top = (cy - 34) + 'px';
    chevronEl.style.color = planet.color; chevronEl.style.transform = 'rotate(' + (90 - ang / Math.PI * 180) + 'deg)';
  }

  /* ---- landing HUD ---- */
  function buildLandingHud() {
    var hud = el('div', 'hud', root); screens.landing = hud; hud.style.display = 'none';
    var wrap = el('div', 'throttle retro', hud); wrap.dataset.btn = '1';
    var fill = el('div', 'throttle-fill', wrap); var knob = el('div', 'throttle-knob', wrap);
    var dragging = false;
    function setFromY(y) { var r = wrap.getBoundingClientRect(); var v = clamp(1 - (y - r.top) / r.height, 0, 1); app.actions.setThrottle(v); fill.style.height = (v * 100) + '%'; knob.style.bottom = 'calc(' + (v * 100) + '% - 22px)'; }
    wrap.addEventListener('pointerdown', function (e) { e.stopPropagation(); dragging = true; setFromY(e.clientY); });
    window.addEventListener('pointermove', function (e) { if (dragging) setFromY(e.clientY); });
    window.addEventListener('pointerup', function () { dragging = false; });
    // left/right nudge
    var lr = el('div', 'nudge', hud);
    var lb = el('button', 'nudgebtn', lr); lb.dataset.btn = '1'; lb.textContent = '◀';
    var rb = el('button', 'nudgebtn', lr); rb.dataset.btn = '1'; rb.textContent = '▶';
    lb.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setNudge(-1); });
    rb.addEventListener('pointerdown', function (e) { e.stopPropagation(); app.actions.setNudge(1); });
    window.addEventListener('pointerup', function () { app.actions.setNudge(0); });
    el('div', 'hint hint-retro', hud).textContent = '🔥⬇';
    var banner = el('div', 'banner', hud); banner.style.display = 'none'; screens._banner = banner;
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
    showLaunch: showLaunch, setLaunchAltitude: setLaunchAltitude,
    showSpace: showSpace, setStars: setStars, lightDashBulb: lightDashBulb, updateSpaceHud: updateSpaceHud,
    showLanding: showLanding, deliveryBanner: deliveryBanner, showAfterLanding: showAfterLanding,
    showStick: showStick, moveStick: moveStick, hideStick: hideStick, checkPortrait: checkPortrait,
    get portrait() { return portrait; }, set portrait(v) { portrait = v; }
  };
  return UIobj;
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
window.SpaceSchool = App;

})();
