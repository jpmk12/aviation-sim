// Headless end-to-end for Space School: boot -> profile -> buddy -> planet ->
// launch -> space -> landing -> delivery, with a screenshot at each stage.
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'spaceschool.html');
const CHROME = process.env.PW_CHROME || undefined; // undefined -> Playwright default
const OUT = path.resolve(__dirname, '..', 'dist') + '/';
const sleep = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const b = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  const p = await b.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await p.goto(FILE, { waitUntil: 'load' }); await sleep(p, 600);
  const boot = await p.evaluate(() => ({ three: !!window.THREE, space: !!window.SPACE, app: !!(window.SpaceSchool && window.SpaceSchool.G), canvas: !!document.querySelector('#stage canvas'), profile: !!document.querySelector('.pilotcard') }));
  console.log('BOOT', JSON.stringify(boot));
  await p.screenshot({ path: OUT + '_sp_profile.png' });

  await p.click('.pilotcard'); await sleep(p, 400);
  const buddies = await p.evaluate(() => document.querySelectorAll('.creaturecard').length);
  await p.screenshot({ path: OUT + '_sp_hangar.png' });
  await p.evaluate(() => document.querySelectorAll('.creaturecard')[2].click()); await sleep(p, 400); // heavy bear
  const planets = await p.evaluate(() => document.querySelectorAll('.destcard').length);
  await p.screenshot({ path: OUT + '_sp_map.png' });
  await p.evaluate(() => document.querySelectorAll('.destcard')[0].click()); await sleep(p, 500); // red planet
  const st1 = await p.evaluate(() => window.SpaceSchool.G.stageName);
  console.log('MENUS buddies=%d planets=%d -> stage=%s', buddies, planets, st1);

  // LAUNCH: ignite + full throttle, wait to reach space
  await p.evaluate(() => { window.SpaceSchool.actions.ignite(); window.SpaceSchool.actions.setThrottle(1); });
  await sleep(p, 1500);
  await p.screenshot({ path: OUT + '_sp_launch.png' });
  let reachedSpace = false;
  for (let i = 0; i < 40; i++) { await sleep(p, 500); const s = await p.evaluate(() => window.SpaceSchool.G.stageName); if (s === 'space') { reachedSpace = true; break; } }
  console.log('LAUNCH -> reachedSpace=%s', reachedSpace);

  // SPACE: flip some switches, thrust, then warp near planet to trigger landing
  await sleep(p, 600);
  await p.evaluate(() => { window.SpaceSchool.actions.toggleSwitch('light'); window.SpaceSchool.actions.toggleSwitch('map'); window.SpaceSchool.actions.setThrust(true); });
  await sleep(p, 1200);
  await p.screenshot({ path: OUT + '_sp_space.png' });
  const spaceState = await p.evaluate(() => ({ stage: window.SpaceSchool.G.stageName, switches: window.SpaceSchool.G.switches }));
  console.log('SPACE', JSON.stringify(spaceState));
  await p.evaluate(() => { window.SpaceSchool.actions.setThrust(false); });
  // warp near planet + fly in
  let reachedLanding = false;
  for (let i = 0; i < 20; i++) { await p.evaluate(() => window.SpaceSchool.testWarpToPlanet()); await sleep(p, 400); const s = await p.evaluate(() => window.SpaceSchool.G.stageName); if (s === 'landing') { reachedLanding = true; break; } }
  console.log('SPACE -> reachedLanding=%s', reachedLanding);

  // LANDING: fly a real retro-burn descent — burn harder when falling faster
  // than we want, flare near the ground — and confirm it lands (softly).
  await sleep(p, 400);
  await p.screenshot({ path: OUT + '_sp_landing.png' });
  let delivered = 0;
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => window.SpaceSchool.testLandingState());
    if (st) {
      const wantVy = st.y > 45 ? -20 : -4;   // descend briskly, flare at the bottom
      const hover = (1.0 + 0.6) * 5.5 / 22;   // m*g/THRUST
      const thr = Math.max(0, Math.min(1, hover + (wantVy - st.vy) * 0.06));
      await p.evaluate((t) => window.SpaceSchool.actions.setThrottle(t), thr);
    }
    await sleep(p, 150);
    delivered = await p.evaluate(() => window.SpaceSchool.G.save.deliveries.length);
    if (delivered > 0) break;
  }
  await sleep(p, 1500);
  await p.screenshot({ path: OUT + '_sp_delivered.png' });
  const persist = await p.evaluate(() => { const g = window.SpaceSchool.G; const raw = (function(){try{return localStorage.getItem('spaceschool:profile:'+g.profile.id);}catch(e){return null;}})(); const last = g.save.deliveries[g.save.deliveries.length-1]||{}; return { deliveries: g.save.deliveries.length, saved: raw ? JSON.parse(raw).deliveries.length : -1, tier: last.tier, planet: last.planetId }; });
  const storageOK = await p.evaluate(() => { try { localStorage.setItem('_t','1'); localStorage.removeItem('_t'); return true; } catch(e){ return false; } });
  console.log('LANDING delivered=%d saved=%d tier=%s planet=%s', persist.deliveries, persist.saved, persist.tier, persist.planet);

  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 10).forEach(e => console.log('  !', e));
  await b.close();
  const ok = boot.three && boot.space && boot.app && boot.canvas && boot.profile && buddies === 4 && planets === 4 && st1 === 'launch' && reachedSpace && reachedLanding && persist.deliveries >= 1 && (storageOK ? persist.saved >= 1 : true) && persist.tier !== 'bounce' && persist.planet === 'red' && errors.length === 0;
  console.log(ok ? '\nSPACE VERIFY: PASS ✅' : '\nSPACE VERIFY: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
