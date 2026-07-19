// Verifies the second aircraft — the seaplane and its water landing
// (IMPROVEMENT_PLAN 3.2). Picks the seaplane in the hangar, flies a delivery,
// then brings it home to the lake for a SPLASHDOWN (not the runway), and checks
// the 🌊 splash patch is earned and the loop closes at the hangar.
//
//   npm i playwright   (+ a Chromium/headless-shell binary; PW_CHROME to point at it)
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'flightschool.html');
const CHROME = process.env.PW_CHROME || undefined;
const sleep = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(FILE, { waitUntil: 'load' }); await sleep(page, 500);

  // pilot -> pick the SEAPLANE -> buddy -> destination
  await page.click('.pilotcard'); await sleep(page, 300);
  const segCount = await page.evaluate(() => document.querySelectorAll('.acbtn').length);
  await page.evaluate(() => { const b = document.querySelectorAll('.acbtn'); b[b.length - 1].click(); });  // seaplane
  await sleep(page, 200);
  const aircraft = await page.evaluate(() => window.FlightSchool.G.aircraft);
  const lakeHome = await page.evaluate(() => window.FlightSchool.config.homeBase.pos.slice());
  console.log('AIRCRAFT seg=%d picked=%s homeTarget=%j', segCount, aircraft, lakeHome);

  await page.evaluate(() => document.querySelectorAll('.creaturecard:not(.rescuecard)')[0].click()); // light lizard
  await sleep(page, 200);
  await page.evaluate(() => document.querySelectorAll('.destcard')[0].click());
  await sleep(page, 300);

  const S = () => page.evaluate(() => {
    const s = window.FlightSchool.sim, g = window.FlightSchool.G;
    return { v: s.v, x: s.pos.x, y: s.pos.y, z: s.pos.z, phase: g.phase, screen: g.screen, splash: g.splash };
  });
  const set = (p, r) => page.evaluate(([p, r]) => { const s = window.FlightSchool.sim; s.pitchIn = p; s.rollIn = r; }, [p, r]);

  // takeoff (auto-spool rolls it; pull to rotate), climb a little
  const start = await S();
  const startedOnGround = start.phase === 'roll' && start.y < 30;
  await set(1, 0);
  let lifted = false;
  for (let i = 0; i < 30; i++) { await sleep(page, 400); const s = await S(); if (s.phase === 'fly') { lifted = true; break; } }
  await set(0.4, 0);
  for (let i = 0; i < 50; i++) { await sleep(page, 400); const s = await S(); if (s.y > 150) break; }
  await set(0, 0); await sleep(page, 600);

  // drop the buddy -> the gold home beacon now points at the LAKE
  await page.evaluate(() => window.FlightSchool.actions.drop());
  for (let i = 0; i < 40; i++) { await sleep(page, 500); const d = await page.evaluate(() => window.FlightSchool.G.save.deliveries.length); if (d > 0) break; }
  const homeIsLake = await page.evaluate(() => {
    const g = window.FlightSchool.G, L = window.FlightSchool.config.landing.lake;
    return g.activeLZ && g.activeLZ.id === 'home' && Math.abs(g.activeLZ.pos[0] - L.x) < 1 && Math.abs(g.activeLZ.pos[2] - L.z) < 1;
  });
  console.log('DROP deliveries>=1=%s homeBeaconOnLake=%s', true, homeIsLake);

  // put the seaplane on short final over the lake, gliding in, and settle it down
  await page.evaluate(() => {
    const s = window.FlightSchool.sim, L = window.FlightSchool.config.landing.lake;
    s.pos.set(L.x, 70, L.z + 300);     // south of the lake, lined up on it
    s.q.identity();                    // facing -z, straight in toward the lake
    s.v = 46; s.stalled = false;
    s.forward.set(0, 0, -1).applyQuaternion(s.q);
    s.vel.copy(s.forward).multiplyScalar(s.v);
  });
  await set(-0.28, 0);
  let onWaterSeen = false, landed = null;
  for (let i = 0; i < 120; i++) {
    await sleep(page, 500);
    const s = await S();
    if (s.phase === 'fly' && s.y < 45) await set(0, 0);
    if (s.splash) onWaterSeen = true;
    if (i % 12 === 0) console.log('  final: phase=%s y=%s z=%s v=%s splash=%s', s.phase, s.y.toFixed(0), s.z.toFixed(0), s.v.toFixed(0), s.splash);
    if (s.screen === 'hangar') { landed = s; break; }
  }
  const patches = await page.evaluate(() => (window.FlightSchool.G.save.patches || []).slice());
  console.log('SPLASHDOWN reachedHangar=%s sawSplash=%s patches=%j', !!landed, onWaterSeen, patches);

  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 8).forEach(e => console.log('  !', e));
  await browser.close();

  const ok =
    segCount === 2 && aircraft === 'seaplane' &&
    Math.abs(lakeHome[0]) > 1 &&        // home target moved off the runway (to the lake)
    startedOnGround && lifted &&
    homeIsLake &&
    onWaterSeen &&                      // the touchdown registered as a splashdown
    patches.indexOf('splash') >= 0 &&   // 🌊 patch earned
    !!landed &&                         // loop closed at the hangar
    errors.length === 0;
  console.log(ok ? '\nSEAPLANE: PASS ✅' : '\nSEAPLANE: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
