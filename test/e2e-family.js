// Verifies the opt-in shared family world (IMPROVEMENT_PLAN 3.5) in BOTH games.
// Seeds two pilots' saves with deliveries, then confirms:
//   - default (own worlds): a pilot sees only their own buddies
//   - ?family=1 (shared):   a pilot sees every pilot's buddies merged
//
//   npm i playwright   (+ a Chromium/headless-shell binary; PW_CHROME to point at it)
const { chromium } = require('playwright');
const path = require('path');
const CHROME = process.env.PW_CHROME || undefined;
const sleep = (p, ms) => p.waitForTimeout(ms);

const FS = 'file://' + path.resolve(__dirname, '..', 'dist', 'flightschool.html');
const SS = 'file://' + path.resolve(__dirname, '..', 'dist', 'spaceschool.html');

// seed two profiles' saves directly in localStorage before the game reads them
function seedFlight() {
  var mk = function (id, color, dels) {
    return JSON.stringify({ profileId: id, icon: '🦊', color: color, tailNumber: 'N-X',
      collection: [], deliveries: dels, patches: [], flightSeconds: 0 });
  };
  localStorage.setItem('flightschool:profile:p1', mk('p1', '#ff8a3d', [
    { creatureId: 'creature_liz', lzId: 'grandma', pos: [100, 0, 100], rot: 0, ts: 0, tier: 'ok' },
    { creatureId: 'creature_fox', lzId: 'island', pos: [200, 0, -200], rot: 0, ts: 0, tier: 'ok' }
  ]));
  localStorage.setItem('flightschool:profile:p2', mk('p2', '#5b8cff', [
    { creatureId: 'creature_bear', lzId: 'mountain', pos: [-300, 0, -300], rot: 0, ts: 0, tier: 'ok' }
  ]));
}
function seedSpace() {
  var mk = function (id, dels) {
    return JSON.stringify({ profileId: id, icon: '🦊', color: '#ff8a3d', tailNumber: 'N-X',
      deliveries: dels, missions: dels.length, stars: 0, patches: [] });
  };
  localStorage.setItem('spaceschool:profile:p1', mk('p1', [
    { creatureId: 'creature_liz', planetId: 'red', tier: 'soft', ts: 0 },
    { creatureId: 'creature_fox', planetId: 'ice', tier: 'soft', ts: 0 }
  ]));
  localStorage.setItem('spaceschool:profile:p2', mk('p2', [
    { creatureId: 'creature_bear', planetId: 'red', tier: 'soft', ts: 0 }
  ]));
}

(async () => {
  const browser = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // ---- FLIGHT SCHOOL ------------------------------------------------------
  await page.goto(FS, { waitUntil: 'load' }); await sleep(page, 400);
  await page.evaluate(seedFlight);
  // own world: pilot p1 sees only their 2 buddies
  await page.goto(FS, { waitUntil: 'load' }); await sleep(page, 500);
  await page.click('.pilotcard'); await sleep(page, 500);            // p1
  const fsOwn = await page.evaluate(() => window.FlightSchool.testWorldDeliveries());
  const fsOwnMesh = await page.evaluate(() => window.FlightSchool.testDeliveredCount());
  // shared world: p1 now sees p1(2) + p2(1) = 3
  await page.goto(FS + '?family=1', { waitUntil: 'load' }); await sleep(page, 500);
  await page.click('.pilotcard'); await sleep(page, 500);            // p1
  const fsFam = await page.evaluate(() => window.FlightSchool.testWorldDeliveries());
  const fsFamMesh = await page.evaluate(() => window.FlightSchool.testDeliveredCount());
  console.log('FLIGHT own=%d/%d family=%d/%d', fsOwn, fsOwnMesh, fsFam, fsFamMesh);

  // ---- SPACE SCHOOL -------------------------------------------------------
  await page.goto(SS, { waitUntil: 'load' }); await sleep(page, 400);
  await page.evaluate(seedSpace);
  await page.goto(SS, { waitUntil: 'load' }); await sleep(page, 500);
  await page.click('.pilotcard'); await sleep(page, 500);            // p1
  const ssOwn = await page.evaluate(() => window.SpaceSchool.testWorldDeliveries());
  await page.goto(SS + '?family=1', { waitUntil: 'load' }); await sleep(page, 500);
  await page.click('.pilotcard'); await sleep(page, 500);            // p1
  const ssFam = await page.evaluate(() => window.SpaceSchool.testWorldDeliveries());
  console.log('SPACE own=%d family=%d', ssOwn, ssFam);

  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 8).forEach(e => console.log('  !', e));
  await browser.close();

  const ok =
    fsOwn === 2 && fsOwnMesh === 2 &&        // own world: just p1's buddies
    fsFam === 3 && fsFamMesh === 3 &&        // shared: p1 + p2 merged
    ssOwn === 2 && ssFam === 3 &&
    errors.length === 0;
  console.log(ok ? '\nFAMILY: PASS ✅' : '\nFAMILY: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
