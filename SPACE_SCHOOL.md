# 🚀 SPACE SCHOOL — design contract

Sibling of Flight School. A **cockpit space-flight** for the same two small
pilots (iPad, touch, landscape). One self-contained HTML file, Three.js inlined,
no CDN, no network at play time. Same non-negotiables: **no crashes, no score,
no timer, no losing, no reading required.** Icons / colour / sound / motion carry
all meaning.

## 1. NORTH STAR
> A cockpit view of a spacecraft with switches and buttons the child can flip for
> fun, that they can actually fly, across three stages: **launch → space → land.**

**Secondary north star (the unnamed lesson):**
> *Your engine is the only thing that changes your motion. Let go, and you keep
> going — or you fall.*

Newton, felt not named. Each stage teaches one face of it:
- **Launch** — push down hard enough to beat gravity and rise.
- **Space** — push to speed up, then coast (no air to stop you).
- **Land** — push down to slow the fall before you touch.
Launch and landing bookend each other (thrust vs gravity); space is the drift.

## 2. THE THREE STAGES

### 2.1 Launch (external side view — throttle)
- Rocket on a pad. A big **vertical throttle lever** the child shoves up; a
  glowing **IGNITION** button to light it.
- Cannot fail: too little throttle just rumbles and sits (thrust < weight); push
  up past ~60% and it lifts. This *is* the thrust-vs-gravity lesson.
- **Booster separation** partway up: side boosters tumble away with a *thunk*,
  the rocket gets much lighter and surges. Kids love this.
- Rumble, fire, screen-shake all scale with throttle. Sky fades blue → black →
  stars. Auto-transition to space at altitude.

### 2.2 Space (first-person cockpit — the centrepiece)
- **Dashboard cockpit**: the 3D scene is the window; a panel of chunky **switches
  and lit buttons** frames it. Flipping them is the toy the north star asks for.
- **Fly:** thumb-stick steers the nose (pitch/yaw); a thrust button pushes
  forward. **Gentle arcade drift** — velocity lags the nose a little so it feels
  floaty and space-y, but always trends back to controllable. Soft speed cap; a
  soft tether keeps them from getting lost.
- **Nav (load-bearing):** the destination planet glows with a beacon ring; a
  cockpit HUD **chevron** points to it whenever it's off-window.
- **Cockpit toys** (flip = animation + sound, never affect safety): cabin light,
  comms/radio beeps, WARP boost (star-streak + whoosh), landing-gear arm,
  star-map, space-music beat.
- **Fun in the void:** scoop floating **stars** (each lights a dash bulb), bonk
  harmlessly off **asteroids** (comedy boing — the craft can't be lost), pass
  planets already decorated from earlier trips.
- Approach the destination planet → landing stage.

### 2.3 Landing (3/4 external view — retro-burn)
- 3/4 view of the craft descending toward a **landing pad**; the child
  **retro-burns** (down-thrust throttle) to slow the fall while gravity pulls.
  Mirrors launch. A little horizontal nudge to line up with the pad.
- Cannot fail: too fast → comedy bounce + dust, settles anyway. **Softness sets
  the celebration tier** (feather-soft → confetti; thumpy → funny squash) — same
  spirit as Flight School's delivery tiers.
- Touchdown: hatch opens, the **buddy hops out and waves**, plants itself on the
  planet **forever** (per profile). Confetti.

## 3. THE LOOP & RETENTION
Pick pilot → pick a **buddy** + a **planet** → launch → fly → land → the buddy
stays on that planet → next trip. Over weeks they build a **decorated solar
system**, visible from orbit — the same "a world they built" retention as Flight
School's airdropped creatures.

## 4. FLIGHT MODEL (arcade, honest — see src/space.js)
- **Launch (1D vertical):** `a = throttle*THRUST/m - g`. Won't lift until
  `throttle*THRUST > m*g`. Booster sep drops `m` → surge.
- **Space (3D):** thrust adds velocity along the nose; almost no damping (it
  coasts); velocity eases toward the nose direction a little (gentle curve);
  speed capped; soft position tether.
- **Landing (1D vertical + small lateral):** `a = throttle*THRUST/m - g_planet`.
  Touchdown speed → tier. Always succeeds.
All numbers live in `src/space.js` and are proven by `test/space-sim.js`.

## 5. CONTROLS (iPad, landscape)
- **Launch:** one big throttle lever (drag up) + IGNITION button.
- **Space:** floating thumb-stick (left half) to steer + a thrust button (right);
  dashboard switches along the bottom.
- **Landing:** throttle lever (retro) + gentle left/right nudge.
No HUD numbers. No reading. Everything survives text removal.

## 6. TECH (reuse Flight School's pipeline)
- Single self-contained `dist/spaceschool.html`; Three.js r150 inlined from
  `src/vendor/three.min.js`; built by the same zero-dep `build.js`; listed in the
  launcher's reserved 🚀 slot.
- Shared pilot identities (fox / dragon, same colours + tail numbers).
- Per-profile `localStorage` under `spaceschool:profile:<id>`.
- Web-Audio synthesis only (rumble, beeps, hiss, warp whoosh, switch clicks,
  thump, chime). Engine/rumble tracks throttle — the strongest feedback channel.
- 60 fps on the target iPad; DPR capped; iOS gesture/orientation handling.

## 7. DEFINITION OF DONE (v1)
- [ ] Profile picker (shared), buddy pick (weight legible), planet pick.
- [ ] Launch: throttle lifts only past threshold, booster sep, sky→space.
- [ ] Space: cockpit dashboard with working fun switches; flyable arcade drift;
      beacon + chevron nav; collect stars; comedy asteroid bonk.
- [ ] Landing: retro-burn descent, soft/med/hard tiers, always succeeds.
- [ ] Buddy delivered to the planet persists across sessions, visible from orbit.
- [ ] Full Web Audio set; rumble tracks throttle.
- [ ] Single self-contained HTML; 60 fps; iOS fullscreen.
- **Real test:** hand it to the five-year-old — they launch, fly, and land a
  buddy within a couple of minutes, and ask for it again tomorrow.
