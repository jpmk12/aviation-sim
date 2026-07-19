// Headless end-to-end verification of dist/flightschool.html — the full
// pilot's loop: takeoff -> climb -> drop -> stall lesson -> fly home -> land.
//
// Drives the built game in Chromium. Requires Playwright:
//   npm i playwright        (and a Chromium/headless-shell binary)
// Point CHROME at your browser via env PW_CHROME, or leave unset for
// Playwright's default.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'flightschool.html');
const CHROME = process.env.PW_CHROME || undefined; // undefined -> Playwright's default

const sleep = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  // dsf=1: swiftshader is slow; the sim advances by wall-clock dt, so high pixel
  // counts run it in slow-motion. A real iPad has a GPU + DPR cap.
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(FILE, { waitUntil: 'load' });
  await sleep(page, 600);

  const boot = await page.evaluate(() => ({
    three: !!window.THREE, aero: !!window.AERO,
    app: !!(window.FlightSchool && window.FlightSchool.sim),
    canvas: !!document.querySelector('#stage canvas'),
    profile: !!document.querySelector('.pilotcard')
  }));
  console.log('BOOT', JSON.stringify(boot));

  await page.click('.pilotcard'); await sleep(page, 250);
  const hangar = await page.evaluate(() => document.querySelectorAll('.creaturecard').length);
  await page.evaluate(() => document.querySelectorAll('.creaturecard')[2].click()); // heavy bear
  await sleep(page, 200);
  const dest = await page.evaluate(() => document.querySelectorAll('.destcard').length);
  await page.evaluate(() => document.querySelectorAll('.destcard')[0].click());
  await sleep(page, 300);
  console.log('MENUS hangar=%d dest=%d', hangar, dest);

  const S = () => page.evaluate(() => {
    const s = window.FlightSchool.sim, g = window.FlightSchool.G;
    const r = new window.THREE.Vector3(1, 0, 0).applyQuaternion(s.q);
    return { v: s.v, x: s.pos.x, y: s.pos.y, z: s.pos.z, fx: s.forward.x, fy: s.forward.y,
             bankY: r.y, stalled: s.stalled, phase: g.phase, screen: g.screen };
  });
  const set = (p, r) => page.evaluate(([p, r]) => { const s = window.FlightSchool.sim; s.pitchIn = p; s.rollIn = r; }, [p, r]);

  // ---- 1) TAKEOFF: starts on the runway at rest, spools, rotates on pull ----
  const start = await S();
  console.log('START phase=%s v=%s y=%s', start.phase, start.v.toFixed(1), start.y.toFixed(0));
  const startedOnGround = start.phase === 'roll' && start.v < 10 && start.y < 30;
  // pull immediately — should NOT rotate until rotation speed
  await set(1, 0); await sleep(page, 600);
  const early = await S();
  const heldUntilSpeed = early.phase === 'roll' || early.v >= 36;
  // wait for rotation
  let lifted = null;
  for (let i = 0; i < 30; i++) { await sleep(page, 400); const s = await S(); if (s.phase === 'fly') { lifted = s; break; } }
  console.log('TAKEOFF rotated=%s v=%s', !!lifted, lifted ? lifted.v.toFixed(1) : '-');

  // climb to working altitude (gentle pitch — a hard pull would bleed speed),
  // then level off
  await set(0.45, 0);
  for (let i = 0; i < 70; i++) { await sleep(page, 400); const s = await S(); if (s.y > 140) break; }
  await set(0, 0); await sleep(page, 800);
  const cruise = await S();
  console.log('CLIMB y=%s v=%s', cruise.y.toFixed(0), cruise.v.toFixed(1));

  // ---- 2) DROP: chute -> land -> delivery persisted; home beacon comes on ----
  const carrying = await page.evaluate(() => !!window.FlightSchool.G.carrying);
  await page.evaluate(() => window.FlightSchool.actions.drop());
  for (let i = 0; i < 60; i++) { await sleep(page, 700); const d = await page.evaluate(() => window.FlightSchool.G.save.deliveries.length); if (d > 0) break; }
  const persisted = await page.evaluate(() => {
    const g = window.FlightSchool.G;
    const raw = (function () { try { return localStorage.getItem('flightschool:profile:' + g.profile.id); } catch (e) { return null; } })();
    return { deliveries: g.save.deliveries.length, saved: raw ? JSON.parse(raw).deliveries.length : -1,
             homeLZ: g.activeLZ && g.activeLZ.id === 'home' };
  });
  const storageOK = await page.evaluate(() => { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch (e) { return false; } });
  console.log('DROP carrying=%s deliveries=%d saved=%d homeBeacon=%s', carrying, persisted.deliveries, persisted.saved, persisted.homeLZ);

  // ---- 3) ROLL + AUTO-LEVEL (quick regression of the energy-lesson controls) ----
  const preRoll = await S();
  await set(0, 1); await sleep(page, 1400);
  const rolled = await S(); await set(0, 0);
  let leveled = rolled;
  for (let i = 0; i < 6; i++) { await sleep(page, 500); leveled = await S(); if (Math.abs(leveled.bankY) < 0.1) break; }
  console.log('ROLL bankY %s -> %s -> %s', preRoll.bankY.toFixed(2), rolled.bankY.toFixed(2), leveled.bankY.toFixed(2));

  // ---- 4) SUSTAINED PULL -> stall -> auto recovery ----
  const before = await S();
  await set(1, 0);
  let minV = 99, everStall = false;
  for (let i = 0; i < 30; i++) { await sleep(page, 400); const s = await S(); minV = Math.min(minV, s.v); if (s.stalled) { everStall = true; break; } }
  await set(0, 0);
  let recov = await S();
  for (let i = 0; i < 20; i++) { await sleep(page, 700); recov = await S(); if (!recov.stalled && recov.v > 40) break; }
  console.log('PULL v %s -> minV %s stalled=%s | RECOVER v=%s stalled=%s',
    before.v.toFixed(1), minV.toFixed(1), everStall, recov.v.toFixed(1), recov.stalled);

  // ---- 5) LANDING: place on final approach, descend; flare cushion + rollout ----
  await page.evaluate(() => {
    const s = window.FlightSchool.sim;
    s.pos.set(0, 90, 620);                       // short final, south of the runway
    s.q.identity();                              // facing -z, straight in
    s.v = 48; s.stalled = false;
    s.forward.set(0, 0, -1).applyQuaternion(s.q);
    s.vel.copy(s.forward).multiplyScalar(s.v);
  });
  // fly it like a kid: push over to descend, then let go — the flare cushion
  // and settle assist do the last few feet (a hot arrival bounces, bleeds
  // speed, and lands anyway)
  await set(-0.28, 0);
  let landed = null;
  for (let i = 0; i < 110; i++) {
    await sleep(page, 500);
    const s = await S();
    if (s.phase === 'fly' && s.y < 45) await set(0, 0);          // release the stick low
    if (s.phase === 'rollout') await set(0, 0);
    if (i % 12 === 0) console.log('  final: phase=%s y=%s z=%s v=%s', s.phase, s.y.toFixed(0), s.z.toFixed(0), s.v.toFixed(0));
    if (s.screen === 'hangar') { landed = s; break; }
  }
  console.log('LANDING reachedHangar=%s', !!landed);

  await page.screenshot({ path: path.resolve(__dirname, '..', 'dist', '_verify_shot.png') });
  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 10).forEach(e => console.log('  !', e));
  await browser.close();

  const ok =
    boot.three && boot.aero && boot.app && boot.canvas && boot.profile &&
    hangar === 4 && dest === 3 &&
    startedOnGround && heldUntilSpeed && !!lifted &&   // real takeoff happened
    cruise.y > 60 &&
    persisted.deliveries >= 1 && (storageOK ? persisted.saved >= 1 : true) &&
    persisted.homeLZ &&                                 // home beacon guides back
    rolled.bankY < -0.3 &&
    Math.abs(leveled.bankY) < Math.abs(rolled.bankY) - 0.05 &&
    everStall && recov.v > 35 && !recov.stalled &&
    !!landed &&                                         // the loop closed at home
    errors.length === 0;
  console.log(ok ? '\nVERIFY: PASS ✅' : '\nVERIFY: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
