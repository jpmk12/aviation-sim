// Headless verification of the Flight School RESCUE mission (IMPROVEMENT_PLAN
// 2.1): pick the 🆘 card -> fly out empty -> scoop the stranded buddy on a low
// pass -> carry it home -> land -> it joins the home colony, persisted.
//   npm i playwright ; PW_CHROME=<browser> node test/e2e-rescue.js
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'dist', 'flightschool.html');
const CHROME = process.env.PW_CHROME || undefined;
const OUT = path.resolve(__dirname, '..', 'dist') + '/';
const sleep = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const b = await chromium.launch(Object.assign({ args: ['--use-gl=swiftshader'] }, CHROME ? { executablePath: CHROME } : {}));
  const p = await b.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(FILE, { waitUntil: 'load' }); await sleep(p, 500);
  await p.click('.pilotcard'); await sleep(p, 300);
  const hasRescue = !!(await p.$('.rescuecard'));

  await p.evaluate(() => document.querySelector('.rescuecard').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(p, 400);
  const start = await p.evaluate(() => ({ mode: window.FlightSchool.G.mode, phase: window.FlightSchool.G.phase, hasTarget: !!window.FlightSchool.G.rescueTarget }));
  console.log('RESCUE start', JSON.stringify(start));

  const set = (pi, ro) => p.evaluate(([pi, ro]) => { const s = window.FlightSchool.sim; s.pitchIn = pi; s.rollIn = ro; }, [pi, ro]);
  await set(1, 0);
  for (let i = 0; i < 20; i++) { await sleep(p, 300); if ((await p.evaluate(() => window.FlightSchool.G.phase)) === 'fly') break; }
  await set(0, 0); await sleep(p, 300);

  // low, near pass over the stranded buddy -> scoop
  await p.evaluate(() => { const g = window.FlightSchool.G, s = window.FlightSchool.sim, t = g.rescueTarget.pos; s.pos.set(t[0], t[1] + 45, t[2] + 40); s.q.identity(); s.v = 42; s.forward.set(0, 0, -1).applyQuaternion(s.q); s.vel.copy(s.forward).multiplyScalar(s.v); });
  let rescued = false;
  for (let i = 0; i < 16; i++) { await sleep(p, 250); const st = await p.evaluate(() => ({ r: window.FlightSchool.G.rescued, c: !!window.FlightSchool.G.carrying, home: window.FlightSchool.G.activeLZ && window.FlightSchool.G.activeLZ.id === 'home' })); if (st.r) { rescued = st.c && st.home; break; } }
  console.log('SCOOPED rescued=%s', rescued);

  // carry it home and land
  const before = await p.evaluate(() => window.FlightSchool.G.save.deliveries.filter(d => d.lzId === 'home').length);
  await p.evaluate(() => { const s = window.FlightSchool.sim; s.pos.set(0, 85, 600); s.q.identity(); s.v = 46; s.forward.set(0, 0, -1).applyQuaternion(s.q); s.vel.copy(s.forward).multiplyScalar(s.v); });
  await set(-0.28, 0);
  let landed = false;
  for (let i = 0; i < 90; i++) {
    await sleep(p, 500);
    const st = await p.evaluate(() => ({ screen: window.FlightSchool.G.screen, phase: window.FlightSchool.G.phase, y: window.FlightSchool.sim.pos.y }));
    if (st.phase === 'fly' && st.y < 45) await set(0, 0);
    if (st.phase === 'rollout') await set(0, 0);
    if (st.screen === 'hangar') { landed = true; break; }
  }
  const after = await p.evaluate(() => {
    const g = window.FlightSchool.G;
    const home = g.save.deliveries.filter(d => d.lzId === 'home').length;
    const saved = (function () { try { return JSON.parse(localStorage.getItem('flightschool:profile:' + g.profile.id)).deliveries.filter(d => d.lzId === 'home').length; } catch (e) { return -1; } })();
    return { home: home, saved: saved };
  });
  const storageOK = await p.evaluate(() => { try { localStorage.setItem('_t', '1'); localStorage.removeItem('_t'); return true; } catch (e) { return false; } });
  console.log('LANDED=%s homeColony %d->%d saved=%d', landed, before, after.home, after.saved);

  console.log('CONSOLE_ERRORS', errs.length); errs.slice(0, 8).forEach(e => console.log('  !', e));
  await b.close();
  const ok = hasRescue && start.mode === 'rescue' && start.hasTarget && rescued && landed &&
    after.home === before + 1 && (storageOK ? after.saved === after.home : true) && errs.length === 0;
  console.log(ok ? '\nRESCUE VERIFY: PASS ✅' : '\nRESCUE VERIFY: FAIL ❌');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
