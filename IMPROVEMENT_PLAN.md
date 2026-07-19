# 🧭 Flight Deck — evaluation & improvement plan

**North star:** simulate aviation and space travel well enough — and joyfully
enough — to introduce a 5-year-old (and a supervised younger sibling) to the
*basics* of flight and spaceflight, and make them want to come back.

That's two tests every feature must pass:
1. **Does it teach a real aviation/space basic, by feel?** (never by words)
2. **Is it fun enough to ask for again tomorrow?**

This doc grades the current app against both, then lays out a phased plan.

---

## Part 1 — Honest scorecard

### ✈️ Flight School: what it teaches today

| Aviation basic | Status | How it's felt |
|---|---|---|
| Energy: pulling costs speed | ✅ strong | Stall whoop after a sustained pull; dive builds speed; engine note tracks it |
| Banking = turning | ✅ | Coordinated turns, auto-level on release |
| Stall + recovery | ✅ | "The plane got sleepy" — automatic, funny, never punitive |
| Weight & loading | ✅ | Heavy dragon is genuinely harder; card size + pips telegraph it |
| Navigation | ✅ | Beacon columns + edge chevron; picture-card flight planning |
| **Takeoff** | ❌ | Flights start airborne — the most iconic pilot moment is missing |
| **Landing** | ❌ | Fly-low-over-home auto-returns; the second most iconic moment is missing |
| Throttle / power | ❌ | Auto-throttle only (deliberate v1; the reward path was never built) |
| Weather / wind / time of day | ❌ | Static noon, no wind; the windsock is decoration |
| Airport world | ⚠️ | Runway + windsock exist but nothing *happens* there |

### 🚀 Space School: what it teaches today

| Space basic | Status | How it's felt |
|---|---|---|
| Thrust vs gravity | ✅ strong | Timid throttle rumbles on the pad; cut throttle mid-climb and you sink back |
| Staging | ✅ | Booster separation thunk + surge |
| Newton / coasting | ✅ | Cut the engine in space and you keep drifting |
| Powered landing | ✅ | Retro-burn, softness tiers, always succeeds |
| Different worlds pull differently | ⚠️ | Per-planet gravity *exists in the physics* but nothing telegraphs it — an invisible lesson |
| **The launch ritual** | ❌ | No countdown. Press → instant fire. The single most chantable moment in spaceflight is skipped |
| Ascent milestones | ⚠️ | Sky fades to stars (good) but no events en route — no cloud layer, no "we're in space!" moment |
| Orbit / docking / station | ❌ | Nothing to visit in space except the destination |
| Re-entry | ❌ | Landing starts at low altitude with no arrival-from-space moment |
| Astronomy | ❌ | Stars are decoration; collected star-gems light dashboard bulbs and nothing else |

### Fun & retention

| Mechanic | Status |
|---|---|
| Persistent world-building (the retention engine) | ✅ strongest thing in the app — delivered buddies stay forever |
| Celebration tiers | ✅ confetti / wave / soft chime, never failure |
| Mission variety | ❌ **one verb: deliver.** Every flight is the same sentence |
| Discovery / surprise | ❌ both worlds are static — nothing unexpected ever appears |
| Trophy / collection view | ❌ deliveries are visible only if you fly past them; no "look what I've done" screen |
| Cockpit toys | ⚠️ fun, but FS's landing light and SS's gear switch do nothing meaningful |

### Structural notes

- The Flight School design contract (`CLAUDE.md`) was never committed — it
  exists only in chat history. It should be restored to the repo.
- Both games verified end-to-end in headless Chromium; physics proven by Node
  tests. That pipeline is healthy — every item below should extend it.

**Verdict:** the *lessons that exist are excellent* — honest physics, felt not
told. The gaps are (a) the two bookend rituals of each domain (takeoff/landing;
countdown/arrival-in-space), (b) mission variety, and (c) discovery. The app
teaches flying well but under-delivers *being a pilot* and *being an astronaut*.

---

## Part 2 — Improvement plan

Effort: **S** ≈ an hour-ish of focused work · **M** ≈ an afternoon · **L** ≈ a full session+

### Phase 1 — Complete the classic loops *(highest lesson-density per effort)*

| # | Item | Game | The basic it teaches | The fun | Effort |
|---|---|---|---|---|---|
| 1.1 | **Takeoff.** Start on the runway; auto-throttle spools up (engine note rising); child pulls the stick to rotate. One input, huge "I did it" | FS | Rotation, runways exist for a reason | The moment every kid pilot wants | M |
| 1.2 | **Landing.** Descend to the home field to end the flight: any green touchdown = happy bounce, on-runway = confetti tier. Reuses delivery-tier code | FS | Flare, aim, gentleness = skill | Completes takeoff→fly→drop→return→land | M |
| 1.3 | **Countdown ritual.** Press LAUNCH → big 5-4-3-2-1 lights + beeps → engines light at 3 (smoke billows, hold-down clamps), release at 0 | SS | How real launches actually go | Kids chant along. Guaranteed | S |
| 1.4 | **Ascent milestones.** Pass a flock of birds, then a cloud layer (punch through it), then sky→black; on reaching space Orion's solar wings unfold + chime | SS | Atmosphere is layered; space has an edge | Turns the 20s climb into a story | M |
| 1.5 | **Gravity pips on planet cards.** Same countable-dots language as buddy weight — heavy worlds show more pips, and the landing burn already honors it | SS | Different worlds pull differently (makes an existing invisible lesson visible) | Load-planning meets destination-planning | S |
| 1.6 | **Restore `CLAUDE.md`** (Flight School contract) to the repo | — | — | — | S |

### Phase 2 — More verbs, more world *(mission variety + discovery)*

| # | Item | Game | The basic | The fun | Effort |
|---|---|---|---|---|---|
| 2.1 | ✅ *shipped* — **Rescue missions.** A 🆘 hangar card; fly out empty to a stranded buddy (flare + beacon), low-slow pass scoops it aboard, carry it home, land → it joins a persistent colony by the runway | FS | Search & rescue is real aviation | A second verb: "someone needs us!" | M |
| 2.2 | ✅ *shipped (partial)* — **Sky discoveries.** Hot-air balloons that bob + wobble when you honk, and a flock of birds circling. (Geese-that-scatter / boats / a train still open.) | FS | The world below is alive | Exploration pays | M |
| 2.3 | **Day/night + working landing light.** Dusk flights: runway edge lights come on, and the 💡 toy switch becomes *the* tool for finding home | FS | Night flying; lights have jobs | A toy switch graduates into a real instrument | M |
| 2.4 | ✅ *shipped* — **Space station docking.** Station on the route with a ring that doubles as the speed light (green = slow enough); gentle arrival docks (clunk/chime/sparkle, auto-undock push-off), hot arrival boing-bounces; 🛰️→🪐 goal cards make each leg legible. Not a hard gate | SS | Docking = matching speeds; precision | Stage 2 finally has a near-term goal | M/L |
| 2.5 | ✅ *shipped* — **Constellation collection.** Every scooped star permanently lights the next point of a constellation (rocket/star/house); a corner star-chart shows the current one filling; completing it flares gold in the sky forever + icon flash. Per profile, persisted | SS | Constellations are a thing; stars are collectible knowledge | Persistent sky-building = the retention engine, aimed upward | M |
| 2.6 | **Surface moment.** After touchdown the buddy plants a flag (pilot's color), hops twice; flags persist next to buddies | SS | Flags on other worlds — the iconic image | The photo moment | S |
| 2.7 | **Re-entry glow.** Landing stage opens with 2s of orange plasma shimmer + hiss before the retro-burn phase | SS | Coming back is hot | Drama, cheap | S |

### Phase 3 — Big bets *(one per session, pick by kid demand)*

| # | Item | Game | Why |
|---|---|---|---|
| 3.1 | **Manual throttle unlock** — the long-promised v2 reward; Dad flips a CONFIG flag when a kid is ready. FS gains the power lesson SS already teaches; skills echo across games | FS | The deepest deferred lesson |
| 3.2 | **Second aircraft: helicopter or seaplane.** Helicopter = hover, which *is* the SS throttle lesson transplanted home. Seaplane = water landings anywhere | FS | Aircraft differ; new verbs everywhere |
| 3.3 | **Mission patches.** Every completed mission type earns a NASA-style embroidered patch on the hangar wall — a wordless trophy room ("look what I've done" at a glance) | both | The missing collection view, in authentic aerospace language |
| 3.4 | **Creature forge pipeline** (original spec §9.2): kids' own designed/3D-printed creatures become the cargo, mass and all | both | The reason this project exists — physical → digital loop |
| 3.5 | **Shared family world** (original spec §11.3), strictly opt-in | both | Charming; also a plausible source of tears — Dad's call |

### Guardrails (unchanged, non-negotiable)

- **No scores, no timers, no fail states, no reading.** Every new mission ends happy.
- New content must never gate old content — rescue missions appear *alongside*
  deliveries, the station is optional, night is a choice.
- Every physics change extends `test/*-sim.js`; every stage change extends the
  e2e suites. The "energy lesson" and "thrust-vs-gravity" tests must never regress.
- The real acceptance test stays: hand it over with no explanation; delivering
  within a minute; asking for it again tomorrow.

### Suggested build order

1. ✅ **Session A (rituals)** — *shipped*: 1.3 countdown + 1.4 milestones + 1.5 gravity pips + 1.6 spec restore.
2. ✅ **Session B (the pilot's loop)** — *shipped*: 1.1 takeoff (runway roll, pull to rotate, auto-liftoff safety) + 1.2 landing (gold home beacon after delivery, flare cushion, touchdown → rollout → confetti-on-runway tier; hot arrivals bounce). Also fixed a latent heading bug: `headingQuatTo` mirrored x, so initial/respawn headings pointed off-target (the chevron had been covering for it) — both games corrected.
3. **Session C (variety):** 2.1 rescue + 2.2 discoveries, or 2.4 station + 2.5 constellations — pick per which game the kids are playing more.
4. Then phase 3 by kid demand.
