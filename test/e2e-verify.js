// Headless end-to-end verification of dist/flightschool.html
//
// Drives the built game in Chromium: boots, walks profile -> hangar ->
// destination -> fly, then exercises drop/persist, roll+auto-level, and the
// sustained-pull stall + auto-recovery. Requires Playwright:
//   npm i playwright        (and a Chromium/headless-shell binary)
// Point CHROME at your browser, or set env PW_CHROME. On CI the default
// chromium.executablePath() usually works; override only if needed.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'flightschool.html');
const CHROME = process.env.PW_CHROME || undefined; // undefined -> Playwright's default

const sleep = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  // dsf=1: swiftshader (software GL) is slow; the sim advances by wall-clock dt,
  // so high pixel counts run it in slow-motion. A real iPad has a GPU + DPR cap.
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
  await sleep(page, 400);
  console.log('MENUS hangar=%d dest=%d', hangar, dest);

  const S = () => page.evaluate(() => {
    const s = window.FlightSchool.sim;
    const r = new window.THREE.Vector3(1, 0, 0).applyQuaternion(s.q);
    return { v: s.v, x: s.pos.x, y: s.pos.y, z: s.pos.z, fx: s.forward.x, fy: s.forward.y, bankY: r.y, stalled: s.stalled };
  });
  const set = (p, r) => page.evaluate(([p, r]) => { const s = window.FlightSchool.sim; s.pitchIn = p; s.rollIn = r; }, [p, r]);

  const start = await S();
  const storageOK = await page.evaluate(() => window.FlightSchool && (function(){try{localStorage.setItem('_t','1');localStorage.removeItem('_t');return true;}catch(e){return false;}})());
  console.log('START v=%s y=%s fx=%s  storageOK=%s', start.v.toFixed(1), start.y.toFixed(0), start.fx.toFixed(2), storageOK);

  // 1) DROP first (from cruise altitude) -> chute -> land -> delivery persisted.
  // NB: poll in small steps — a single long idle sleep lets headless Chromium
  // throttle requestAnimationFrame, which would stall the sim (test artifact).
  const carrying = await page.evaluate(() => !!window.FlightSchool.G.carrying);
  await page.evaluate(() => window.FlightSchool.actions.drop());
  for (let i = 0; i < 24; i++) { await sleep(page, 700); const d = await page.evaluate(() => window.FlightSchool.G.save.deliveries.length); if (d > 0) break; }
  const persisted = await page.evaluate(() => {
    const g = window.FlightSchool.G;
    const raw = (function(){try{return localStorage.getItem('flightschool:profile:' + g.profile.id);}catch(e){return null;}})();
    return { deliveries: g.save.deliveries.length, saved: raw ? JSON.parse(raw).deliveries.length : -1,
             worldMeshes: window.FlightSchool ? -1 : -1 };
  });
  console.log('DROP carrying=%s deliveries=%d savedToStorage=%d', carrying, persisted.deliveries, persisted.saved);

  // 2) ROLL RIGHT from level -> right wing drops (bank) + heading swings; release auto-levels
  const preRoll = await S();
  await set(0, 1); await sleep(page, 1400);
  const rolled = await S(); await set(0, 0);
  let leveled = await S();
  for (let i = 0; i < 6; i++) { await sleep(page, 500); leveled = await S(); if (Math.abs(leveled.bankY) < 0.1) break; }
  console.log('ROLL bankY %s -> %s   heading fx %s -> %s', preRoll.bankY.toFixed(2), rolled.bankY.toFixed(2), preRoll.fx.toFixed(2), rolled.fx.toFixed(2));
  console.log('AUTO-LEVEL after release: bankY %s -> %s', rolled.bankY.toFixed(2), leveled.bankY.toFixed(2));

  // 3) SUSTAINED FULL PULL -> stall (whoop / auto recovery)
  const before = await S();
  await set(1, 0);
  let minV = 99, everStall = false, tStall = -1;
  for (let i = 0; i < 30; i++) { await sleep(page, 400); const s = await S(); minV = Math.min(minV, s.v); if (s.stalled && !everStall) { everStall = true; tStall = (i + 1) * 0.4; } if (everStall) break; }
  await set(0, 0);
  console.log('PULL v %s -> minV %s  everStalled=%s  (~%ss)', before.v.toFixed(1), minV.toFixed(1), everStall, tStall);
  // poll recovery (automatic, always succeeds — spec §3.4)
  let recov = await S();
  for (let i = 0; i < 20; i++) { await sleep(page, 700); recov = await S(); if (!recov.stalled && recov.v > 40) break; }
  console.log('RECOVER v=%s fy=%s stalled=%s', recov.v.toFixed(1), recov.fy.toFixed(2), recov.stalled);
  await page.screenshot({ path: '/home/user/aviation-sim/dist/_verify_shot.png' });
  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 10).forEach(e => console.log('  !', e));
  await browser.close();

  const ok =
    boot.three && boot.aero && boot.app && boot.canvas && boot.profile &&
    hangar === 4 && dest === 3 &&
    start.y > 50 &&
    rolled.bankY < -0.3 &&                      // right roll dropped the right wing (banked right)
    Math.abs(rolled.fx - preRoll.fx) > 0.03 &&  // heading actually changed
    Math.abs(leveled.bankY) < Math.abs(rolled.bankY) - 0.05 && // auto-leveled on release
    everStall &&                               // sustained pull DID stall
    recov.v > 35 && !recov.stalled &&          // auto-recovered out of the stall
    persisted.deliveries >= 1 &&               // delivery recorded
    (storageOK ? persisted.saved >= 1 : true) && // persisted when storage available
    errors.length === 0;
  console.log(ok ? '\nVERIFY: PASS ✅' : '\nVERIFY: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
