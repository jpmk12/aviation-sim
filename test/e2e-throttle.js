// Headless verification of the v2 manual-throttle reward (IMPROVEMENT_PLAN 3.1).
// Loads dist/flightschool.html?throttle=1 (the live opt-in), confirms the lever
// exists, that dragging it moves sim.throttle, and — the point of the feature —
// that pulling the throttle back bleeds airspeed while firewalling it builds it
// back, all WITHOUT killing the energy lesson (a sustained pull still stalls).
//
//   npm i playwright   (+ a Chromium/headless-shell binary; PW_CHROME to point at it)
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'flightschool.html') + '?throttle=1';
const CHROME = process.env.PW_CHROME || undefined;
const sleep = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(FILE, { waitUntil: 'load' });
  await sleep(page, 600);

  const manualOn = await page.evaluate(() => !!(window.FlightSchool.config && window.FlightSchool.config.manualThrottle));
  console.log('MANUAL manualThrottle=%s', manualOn);

  // walk into a flight: pilot -> buddy -> dest
  await page.click('.pilotcard'); await sleep(page, 250);
  await page.evaluate(() => document.querySelectorAll('.creaturecard:not(.rescuecard)')[0].click()); // light lizard
  await sleep(page, 200);
  await page.evaluate(() => document.querySelectorAll('.destcard')[0].click());
  await sleep(page, 300);

  const leverPresent = await page.evaluate(() => !!document.querySelector('.throttle'));
  console.log('LEVER present=%s', leverPresent);

  const S = () => page.evaluate(() => {
    const s = window.FlightSchool.sim, g = window.FlightSchool.G;
    return { v: s.v, y: s.pos.y, throttle: s.throttle, stalled: s.stalled, phase: g.phase };
  });
  const set = (p, r) => page.evaluate(([p, r]) => { const s = window.FlightSchool.sim; s.pitchIn = p; s.rollIn = r; }, [p, r]);

  // take off (auto-spool rolls it; pull to rotate) and climb to altitude
  await set(1, 0);
  let lifted = false;
  for (let i = 0; i < 30; i++) { await sleep(page, 400); const s = await S(); if (s.phase === 'fly') { lifted = true; break; } }
  await set(0.4, 0);
  for (let i = 0; i < 60; i++) { await sleep(page, 400); const s = await S(); if (s.y > 180) break; }
  await set(0, 0); await sleep(page, 1200);
  const cruise = await S();
  console.log('CRUISE y=%s v=%s throttle=%s', cruise.y.toFixed(0), cruise.v.toFixed(1), cruise.throttle.toFixed(2));

  // ---- 1) a real pointer drag on the lever changes sim.throttle -----------
  const box = await page.evaluate(() => { const r = document.querySelector('.throttle').getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; });
  // drag to the bottom of the track -> throttle ~0
  await page.mouse.move(box.x, box.top + 4);
  await page.mouse.down();
  await page.mouse.move(box.x, box.bottom - 4, { steps: 6 });
  await page.mouse.up();
  const lowT = await page.evaluate(() => window.FlightSchool.sim.throttle);
  console.log('DRAG-DOWN throttle=%s', lowT.toFixed(2));

  // ---- 2) A/B: full throttle holds a higher speed than idle ---------------
  // level flight, idle first (let it settle to a low floor) then firewall (let
  // it climb) — the power lesson, felt: more throttle = faster.
  await set(0, 0);
  await page.evaluate(() => window.FlightSchool.actions.setThrottle(0));
  let vLow = 99;
  for (let i = 0; i < 40; i++) { await sleep(page, 350); const s = await S(); vLow = Math.min(vLow, s.v); }
  await page.evaluate(() => window.FlightSchool.actions.setThrottle(1));
  let vHi = 0;
  for (let i = 0; i < 40; i++) { await sleep(page, 350); const s = await S(); vHi = Math.max(vHi, s.v); }
  console.log('A/B idleV=%s fullV=%s', vLow.toFixed(1), vHi.toFixed(1));

  // ---- 4) energy lesson intact: firewalled + sustained pull still stalls ---
  await page.evaluate(() => window.FlightSchool.actions.setThrottle(1));
  await set(1, 0);
  let everStall = false, minV = 99;
  for (let i = 0; i < 30; i++) { await sleep(page, 400); const s = await S(); minV = Math.min(minV, s.v); if (s.stalled) { everStall = true; break; } }
  await set(0, 0);
  console.log('PULL@FULL minV=%s stalled=%s', minV.toFixed(1), everStall);

  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 8).forEach(e => console.log('  !', e));
  await browser.close();

  const ok =
    manualOn && leverPresent && lifted &&
    lowT < 0.15 &&                          // the drag reached idle
    vHi > vLow + 8 &&                       // full throttle holds a higher speed
    everStall &&                            // energy lesson survives manual throttle
    errors.length === 0;
  console.log(ok ? '\nTHROTTLE: PASS ✅' : '\nTHROTTLE: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
