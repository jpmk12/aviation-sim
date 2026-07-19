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

  // LAUNCH: ignite + full throttle (see it climb), then warp through the long
  // ascent so the test doesn't have to fly the full ~20s climb in slow software GL.
  await p.evaluate(() => { window.SpaceSchool.actions.ignite(); window.SpaceSchool.actions.setThrottle(1); });
  await sleep(p, 1500);
  // ATTITUDE control: the tilt indicator exists, and the tilt control leans the rocket
  const attInd = await p.evaluate(() => !!document.querySelector('.attind'));
  const att0 = await p.evaluate(() => window.SpaceSchool.testLaunchState().att);
  await p.evaluate(() => window.SpaceSchool.actions.setPitch(1));
  for (let i = 0; i < 8; i++) { await sleep(p, 200); }
  const att1 = await p.evaluate(() => window.SpaceSchool.testLaunchState().att);
  await p.evaluate(() => window.SpaceSchool.actions.setPitch(0));
  const attitudeWorks = attInd && Math.abs(att1) > Math.abs(att0) + 0.05;
  console.log('ATTITUDE indicator=%s att %s -> %s works=%s', attInd, att0.toFixed(2), att1.toFixed(2), attitudeWorks);
  await p.screenshot({ path: OUT + '_sp_launch.png' });
  let reachedSpace = false;
  for (let i = 0; i < 30; i++) { await p.evaluate(() => window.SpaceSchool.testWarpToSpace()); await sleep(p, 400); const s = await p.evaluate(() => window.SpaceSchool.G.stageName); if (s === 'space') { reachedSpace = true; break; } }
  console.log('LAUNCH -> reachedSpace=%s', reachedSpace);

  // SPACE: flip some switches, thrust, then warp near planet to trigger landing
  await sleep(p, 600);
  await p.evaluate(() => { window.SpaceSchool.actions.toggleSwitch('light'); window.SpaceSchool.actions.toggleSwitch('map'); window.SpaceSchool.actions.setThrust(true); });
  await sleep(p, 1200);
  await p.screenshot({ path: OUT + '_sp_space.png' });
  const spaceState = await p.evaluate(() => ({ stage: window.SpaceSchool.G.stageName, switches: window.SpaceSchool.G.switches }));
  console.log('SPACE', JSON.stringify(spaceState));
  await p.evaluate(() => { window.SpaceSchool.actions.setThrust(false); });

  // BRAKE THRUSTER: the retro brake bleeds off speed so you can slow to dock
  await p.evaluate(() => window.SpaceSchool.testBrakeSetup(46));
  const vBrake0 = await p.evaluate(() => window.SpaceSchool.testDockSpeed());
  await p.evaluate(() => window.SpaceSchool.actions.setBrake(true));
  for (let i = 0; i < 16; i++) { await sleep(p, 150); if ((await p.evaluate(() => window.SpaceSchool.testDockSpeed())) < 22) break; }
  await p.evaluate(() => window.SpaceSchool.actions.setBrake(false));
  const vBrake1 = await p.evaluate(() => window.SpaceSchool.testDockSpeed());
  const brakeWorks = vBrake1 < vBrake0 - 12;
  console.log('BRAKE speed %s -> %s works=%s', vBrake0.toFixed(0), vBrake1.toFixed(0), brakeWorks);

  // CONSTELLATIONS: scooping stars fills a persistent sky picture (per profile)
  const starsBefore = await p.evaluate(() => window.SpaceSchool.testStarState().stars);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => window.SpaceSchool.testAddStar()); await sleep(p, 60); }
  const starState = await p.evaluate(() => window.SpaceSchool.testStarState());
  const starSaved = await p.evaluate(() => { const g = window.SpaceSchool.G; try { return JSON.parse(localStorage.getItem('spaceschool:profile:' + g.profile.id)).stars; } catch (e) { return -1; } });
  console.log('CONSTELLATION stars %d -> %d saved=%d', starsBefore, starState.stars, starSaved);

  // DOCKING leg: arrive too hot -> boing bounce-off; then slow -> dock ->
  // pause -> auto-undock toward the planet (matching speeds is the lesson)
  await p.evaluate(() => { window.SpaceSchool.testWarpToStation(); window.SpaceSchool.testSetVelTowardDock(55); }); // hot
  // bounce = we got close, stayed undocked (too fast), and were pushed back out
  // (drift-align curves the ship back quickly, so look for any retreat at all)
  let bounced = false, minDist = 1e9, prevDist = 1e9, sawClose = false;
  for (let i = 0; i < 20; i++) {
    await sleep(p, 300);
    const d = await p.evaluate(() => window.SpaceSchool.testDockState());
    minDist = Math.min(minDist, d.dist);
    if (d.dist < 55) sawClose = true;
    if (d.state === 'toStation' && sawClose && d.dist > prevDist + 6) { bounced = true; break; }
    prevDist = d.dist;
    if (d.state !== 'toStation') break; // docked at speed — would be a bug
  }
  await p.evaluate(() => { window.SpaceSchool.testWarpToStation(); window.SpaceSchool.testSetVelTowardDock(18); }); // gentle
  let docked = false, undocked = false, shotTaken = false;
  for (let i = 0; i < 50; i++) {
    await sleep(p, 400);
    const d = await p.evaluate(() => window.SpaceSchool.testDockState());
    if ((d.state === 'docking' || d.state === 'docked') && !shotTaken) { shotTaken = true; await p.screenshot({ path: OUT + '_sp_dock.png' }); }
    if (d.state === 'docked') docked = true;
    if (docked && d.state === 'toPlanet') { undocked = true; break; }
  }
  console.log('DOCK bounced=%s docked=%s undocked=%s', bounced, docked, undocked);

  // warp near planet + fly in
  let reachedLanding = false;
  for (let i = 0; i < 20; i++) { await p.evaluate(() => window.SpaceSchool.testWarpToPlanet()); await sleep(p, 400); const s = await p.evaluate(() => window.SpaceSchool.G.stageName); if (s === 'landing') { reachedLanding = true; break; } }
  console.log('SPACE -> reachedLanding=%s', reachedLanding);

  // LANDING controls: an altitude gauge exists, and steering moves the lander
  // toward the (offset) pad so a kid can find the touchdown spot.
  const altGauge = await p.evaluate(() => !!document.querySelector('.altgauge'));
  const stA = await p.evaluate(() => window.SpaceSchool.testLandingState());
  const steerDir = stA.padX >= stA.x ? 1 : -1;             // steer toward the pad
  await p.evaluate((d) => window.SpaceSchool.actions.setNudge(d), steerDir);
  for (let i = 0; i < 8; i++) { await sleep(p, 150); }
  const stB = await p.evaluate(() => window.SpaceSchool.testLandingState());
  await p.evaluate(() => window.SpaceSchool.actions.setNudge(0));
  const steerWorks = altGauge && Math.abs(stB.x - stA.padX) < Math.abs(stA.x - stA.padX) - 3;
  console.log('LANDER altGauge=%s x %s -> %s (pad %s) steer=%s', altGauge, stA.x.toFixed(0), stB.x.toFixed(0), stA.padX.toFixed(0), steerWorks);

  // LANDING: fly a real retro-burn descent — burn harder when falling faster
  // than we want, flare near the ground — and confirm it lands (softly).
  await sleep(p, 400);
  await p.screenshot({ path: OUT + '_sp_landing.png' });
  let delivered = 0;
  for (let i = 0; i < 120; i++) {
    const st = await p.evaluate(() => window.SpaceSchool.testLandingState());
    if (st) {
      // hover-centred lever: 0.5 holds altitude; nudge around it to control vy
      const wantVy = st.y > 45 ? -18 : -4;   // descend briskly, flare at the bottom
      const lever = Math.max(0, Math.min(1, 0.5 + (wantVy - st.vy) * 0.05));
      await p.evaluate((t) => window.SpaceSchool.actions.setThrottle(t), lever);
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

  // MISSION PATCHES (3.3): the journey should have earned launch + constellation
  // + dock + the red-planet patch. Trophy-wall DOM shares Flight School's
  // (verified there); here we prove the awarding integration end-to-end.
  const spPatches = await p.evaluate(() => (window.SpaceSchool.G.save.patches || []).slice());
  const spPatchesOK = ['launch', 'dock', 'constellation', 'red'].every(id => spPatches.indexOf(id) >= 0);
  console.log('PATCHES %s ok=%s', JSON.stringify(spPatches), spPatchesOK);

  console.log('CONSOLE_ERRORS', errors.length); errors.slice(0, 10).forEach(e => console.log('  !', e));
  await b.close();
  const ok = boot.three && boot.space && boot.app && boot.canvas && boot.profile && buddies === 4 && planets === 4 && st1 === 'launch' && reachedSpace && attitudeWorks && brakeWorks && steerWorks && (starState.stars >= starsBefore + 6) && (storageOK ? starSaved === starState.stars : true) && bounced && docked && undocked && reachedLanding && persist.deliveries >= 1 && (storageOK ? persist.saved >= 1 : true) && persist.tier !== 'bounce' && persist.planet === 'red' && spPatchesOK && errors.length === 0;
  console.log(ok ? '\nSPACE VERIFY: PASS ✅' : '\nSPACE VERIFY: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
