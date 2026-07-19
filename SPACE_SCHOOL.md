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
- An SLS-style rocket on a pad with a service tower. A big **LAUNCH button**
  starts the **countdown ritual**: 5-4-3-2-1 in giant numerals with beeps,
  engines light at 3 (smoke billows while the hold-down clamps grip), release
  at 0. Then a **vertical throttle lever** flies the climb.
- Cannot fail: too little throttle just rumbles and sits (thrust < weight), and
  easing off mid-climb slows the rocket until it sinks back to the pad (soft
  thump, never a crash). This *is* the thrust-vs-gravity lesson.
- **Booster separation** partway up: side boosters tumble away with a *thunk*,
  the rocket gets much lighter and surges. Kids love this.
- **Ascent milestones** turn the ~20s climb into a story: a bird flock scatters
  low, a cloud deck gets punched through with a whoosh, the sky fades blue →
  black → stars, and Orion's **solar wings unfold** with a chime on reaching
  space. Auto-transition to the space stage at altitude.
- Rumble, fire, screen-shake all scale with throttle.

*(As-built beyond v1: the launch camera pulls in **close** so the SLS fills the
frame, and a gentle **attitude minigame** adds a second input — a light wind
leans the rocket slightly off vertical, and left/right **tilt buttons** (a fine
trim, small corrections only) + a top-centre "keep the 🚀 in the green zone"
indicator let the child fly it straight. Staying aligned trims the effective
throttle up so it climbs to space sooner; a sloppy attitude just dawdles and
never fails — see `SPACE.launchClimbEff` and `src/space.js` ATT\_\* constants.)*

### 2.2 Space (first-person cockpit — the centrepiece)
- **Dashboard cockpit**: the 3D scene is the window; a panel of chunky **switches
  and lit buttons** frames it. Flipping them is the toy the north star asks for.
- **Fly:** thumb-stick steers the nose (pitch/yaw); a thrust button pushes
  forward. **Gentle arcade drift** — velocity lags the nose a little so it feels
  floaty and space-y, but always trends back to controllable. Soft speed cap; a
  soft tether keeps them from getting lost.
- **Two legs, one goal at a time.** A wordless goal card opens each leg:
  1. **🛰️ Dock.** A space station (hub, rotating habitat wheel, solar panels)
     sits on the route. Its **docking ring is the speed light**: amber = too
     fast, green = slow enough. Glide in green → clunk, chime, sparkle, a
     moment docked, then an automatic push-off. Arrive hot → a comedy **boing**
     bounces you back out to try again slower. *Docking = matching speeds,
     gently — that's the lesson.* Never a hard gate: blasting past the station
     straight to the planet still finishes the mission.
  2. **🪐 The planet.** The destination's beacon ring brightens and the chevron
     retargets; approach → landing stage.
- **Nav (load-bearing):** the current goal glows (station ring, then planet
  ring); a cockpit HUD **chevron** points to it whenever it's off-window.
- **Cockpit toys** (flip = animation + sound, never affect safety): cabin light,
  comms/radio beeps, WARP boost (star-streak + whoosh), landing-gear arm,
  star-map, space-music beat.
- **Fun in the void:** scoop floating **stars**, bonk harmlessly off
  **asteroids** (comedy boing — the craft can't be lost), pass planets already
  decorated from earlier trips.
- **Constellations (a sky the child builds).** Every star scooped is permanent:
  it lights the next point of a **constellation** (🚀 Rocket, ⭐ Star, 🏠 House…)
  drawn in the sky. A corner **star-chart** shows the current picture filling in
  (dots joined by lines — no reading); finishing one flares it **gold in the
  sky forever** with a triumphant chime and its icon. Per profile, across
  sessions — the delivered-creatures retention loop, aimed upward.
- Approach the destination planet → landing stage.

*(As-built beyond v1: the cockpit is restyled to evoke the **Apollo command
module** — a metallic grey console with round gauges, a green **DSKY numeric
speed readout** (amber when too fast to dock, green when slow enough, mirroring
the ring light) and DOCK/FAST lamps, and metallic toggle switches. The control
scheme is now **RCS translation**, not nose-steering: the ship holds a fixed
heading facing the current goal, a **left pad slides it up/down/left/right**, and
a **right fore/aft pair** (blue 🚀 in, red 🛑 retro to slow) closes or opens the
range. A centred **alignment reticle** locks green when the station is lined up.
`SPACE.C.RCS_ACCEL` / `SPACE_ACCEL` in `src/space.js`.)*

### 2.3 Landing (3/4 external view — retro-burn)
- 3/4 view of the craft descending toward a **landing pad**; the child
  **retro-burns** (down-thrust throttle) to slow the fall while gravity pulls.
  Mirrors launch. A little horizontal nudge to line up with the pad.
- Cannot fail: too fast → comedy bounce + dust, settles anyway. **Softness sets
  the celebration tier** (feather-soft → confetti; thumpy → funny squash) — same
  spirit as Flight School's delivery tiers.
- Touchdown: hatch opens, the **buddy hops out and waves**, plants itself on the
  planet **forever** (per profile). Confetti.

*(As-built beyond v1: the lander gets **clear, legible controls** — a vertical
**altitude gauge** (left) whose fill height is your height and whose colour is
your fall speed (green safe → amber → red "burn!"), big **◀ ▶ steer buttons**
(bottom) to walk left/right, and the **🔥 retro lever** (right) for descent. The
touchdown **pad is offset** to one side each time and a top **steer-to-pad strip**
glows green when you're lined up over it — so "find the spot, then set down soft"
is a real, wordless task. Soft **and** on the pad = confetti.)*

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
