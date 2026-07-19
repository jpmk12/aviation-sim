# FLIGHT SCHOOL — CLAUDE.md
**Project:** A Three.js cargo-flying game for two young children (target: 5-year-old competent, younger sibling supervised).
**Platform:** iPad, touch, landscape.
**Deliverable:** One self-contained HTML file. No CDN. No build-time network access.
**Status:** Greenfield. This document is the contract.
---
## 1. NORTH STAR
> a basic airplane flight simulator. The cockpit should feature some basic buttons and switches for them to play with
secondary north star:** the child should leave with an unnamed, physical intuition that *pulling costs something*. They will never hear the word "energy." They should feel it.
---
## 2. NON-NEGOTIABLE PILLARS
### 2.1 The plane cannot be lost
No crashes. No game over. No score. No timer. No lives.
Ground/terrain contact = comedy `boing`, cargo scatters (and is recoverable — it does not vanish), screen does a small squash, plane respawns 200u up, wings level, at cruise speed, facing the nearest landmark. Total interruption ≤ 1.5s.
Every fail state you add is a five-year-old handing back the iPad.
### 2.2 Steering only (v1)
Auto-throttle. No rudder — ever, in any version. Pitch and roll are the entire control surface of the game.
Manual throttle is a **v2 reward**, not a v1 baseline.
### 2.3 No reading required
The child cannot reliably read. Every affordance must survive with the text removed. Icons, color, size, sound, and motion carry all meaning. Text may exist for the adult, never as the sole signal.
### 2.4 Never lost
A five-year-old is disoriented within eight seconds of losing sight of the target. Two mandatory always-on nav aids:
- **Beacon column:** the active LZ emits a translucent colored column ~400u tall, visible from anywhere in the world, gently pulsing.
- **Nav chevron:** a large screen-edge chevron pointing toward the active LZ whenever it is off-screen. Not a minimap. Not a compass. One arrow.
Do not treat these as optional polish. They are load-bearing.
---
## 3. FLIGHT MODEL
Arcade, but honest. ~40 lines. The lesson survives the simplification.
### 3.1 State
```
quaternion  q          // plane orientation
scalar      v          // airspeed, game units/sec
Vector3     pos
scalar      m          // total mass = plane + loaded cargo
```
Velocity is `forward(q) * v`, blended toward the previous velocity by ~0.12 per frame for a little weight. Do not build a full 6-DOF vector aero model. Nose-follows-velocity arcade is correct for this audience.
### 3.2 The one equation that matters
```
dv/dt = (thrust - k_drag * v²) / m  -  g * sin(pitch)
```
The `g * sin(pitch)` term is the entire pedagogical payload. Pull up → speed bleeds. Push over → speed builds. Do not remove it, do not soften it, do not compensate for it with the autothrottle.
### 3.3 Control authority scales with airspeed
```
pitchRate = MAX_PITCH_RATE * clamp((v - V_STALL) / (V_CRUISE - V_STALL), 0, 1)
rollRate  = MAX_ROLL_RATE  * clamp((v - V_STALL) / (V_CRUISE - V_STALL), 0.3, 1)
```
This *is* the stall, felt rather than modeled. Slow = mushy. The child learns without instruction.
### 3.4 Hard stall
When `v < V_STALL`:
- pitch authority → 0
- apply nose-down torque ~30°/s until `v > V_STALL * 1.15`
- play the **whoop** (descending sine sweep, see §7)
- recovery is automatic and always succeeds
The whoop is a feature. The plane got sleepy. It wakes up. This should read as funny, never as punishment.
### 3.5 Coordinated turn
```
dHeading/dt = g * tan(roll) / v
```
Real equation. Auto-coordinated, no rudder input. Pleasant side effect: slow flight turns tighter, which is correct and feels good.
### 3.6 Auto-throttle (v1)
```
thrust = clamp(K_AT * (V_CRUISE - v), 0, THRUST_MAX)
```
**`THRUST_MAX` must be low enough that a sustained hard pull still bleeds airspeed into a stall.** If the autothrottle can hold cruise through a max-performance climb, the core lesson is dead and this project is just a screensaver. Tune this deliberately and verify it.
### 3.7 Cargo mass
`m` includes the loaded creature. Heavy creature = worse acceleration, worse climb, earlier stall onset in a pull. The big dragon is genuinely harder to fly than the little lizard.
This is the load-planning lesson, and it is legible to a preschooler without a single word of explanation.
### 3.8 Starting constants (tune, don't trust)
```
V_STALL         25   u/s
V_CRUISE        60   u/s
V_MAX          110   u/s
THRUST_MAX      28   u/s²   ← see §3.6 warning
K_AT             1.2
k_drag           0.006
g                6.5         (scaled below 9.8 for a floatier, more forgiving feel)
MAX_PITCH_RATE  45   °/s
MAX_ROLL_RATE   90   °/s
m_plane          1.0
m_creature       0.15 – 0.8  (from creature manifest)
```
*(As-built note: these were retuned per §3.6's own warning — see `src/aero.js` for the shipped values and the reasoning; `test/physics-sim.js` proves the lesson survived. The game also clamps pitch/bank attitude and auto-levels on stick release so the plane can't loop or fly inverted — an extension of §2.4.)*
---
## 4. CONTROLS (iPad, landscape)
### 4.1 Layout
- **Left thumb:** virtual stick, bottom-left, ~140px radius, appears on touch-down anywhere in the left half (floating origin — do not fix its position; small thumbs drift). Up/down = pitch, left/right = roll.
- **Right thumb:** the **DROP** button. Bottom-right. Enormous — minimum 120px diameter. Unmissable. It is the only button on the screen.
Nothing else. No HUD numbers. No altitude tape. No airspeed indicator.
### 4.2 iOS specifics — do not skip
- `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`
- `touch-action: none` on the canvas; `overscroll-behavior: none` on body
- `preventDefault()` on `touchstart`/`touchmove` to kill rubber-band scroll and double-tap zoom
- `apple-mobile-web-app-capable` + Add to Home Screen for fullscreen without Safari chrome. **Required** — otherwise thumbs find the URL bar within a minute.
- Web Audio needs a user-gesture unlock. The profile-pick tap is the unlock moment — free, no "tap to start" screen needed.
- Cap `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`. 3x DPR on an iPad is wasted GPU.
- Portrait: show a large rotate-the-iPad icon, pause the sim. Safari cannot hard-lock orientation without a PWA manifest.
- **Parent note in README:** iOS Guided Access (triple-click) is the answer to accidental home-swipes. Do not attempt to solve this in code.
### 4.3 Rejected for v1
Tilt/gyro steering. Magical when it works, but it fails on a couch, in a car seat, and lying on the floor — which is 90% of actual use. Revisit in v2 as an option, never as the default.
---
## 5. PROFILES & PERSISTENCE
**Both children fly. Separate saves.**
### 5.1 Profile picker
First screen. 2–4 slots. Each slot is a **large animal icon + a signature color** — this is the identity, not the name. Names may render alongside for the adult's benefit but must never be the only differentiator.
Each profile gets a **tail number derived from the child's initials**, painted on the model. They will notice this. It matters more than you'd think.
### 5.2 Save shape
```json
{
  "profileId": "p1",
  "icon": "fox",
  "color": "#ff6b35",
  "tailNumber": "N-XX",
  "collection": ["creature_001", "creature_004"],
  "deliveries": [
    { "creatureId": "creature_001", "lzId": "grandma", "pos": [x,y,z], "rot": 0.4, "ts": 0 }
  ],
  "flightSeconds": 0
}
```
Key: `flightschool:profile:<id>`
### 5.3 Worlds are separate
Each profile sees only their own deliveries. This is deliberate — it removes an entire category of sibling conflict, and it makes the world feel authored by that child.
A shared "family world" is a v2 idea and should be opt-in, never default.
### 5.4 ⚠️ Persistence depends on an unresolved decision — see §11.1
---
## 6. THE LOOP
1. **Pick profile** (icon tap → audio unlock)
2. **Hangar:** choose a creature to load. Big cards. The creature model rotates. Its size telegraphs its weight.
3. **Choose destination:** 3 large picture cards (the landmark, rendered, not named).
4. **Fly.** Beacon column + nav chevron. That's it.
5. **Drop.** Parachute deploys after 0.6s.
6. **Land the cargo.** Thump, dust puff, creature stands up and waves.
7. **The creature stays.** Forever. In that spot.
### 6.1 Delivery feedback — never a failure
| Result | Feedback |
|---|---|
| Bullseye (<30u) | Confetti burst, creature does a full dance, triple chime |
| Close (<100u) | Creature waves enthusiastically, chime |
| Anywhere else | Creature stands up, waves, single soft chime |
No numbers. No stars. No "try again." The creature is always happy to be wherever it landed.
### 6.2 Persistence is the retention mechanic
Fly over the mountain next Saturday and there's the dragon they airdropped, still waving. This is the reason they come back — not score, not progression. **A world they built, one delivery at a time.**
Delivered creatures should be visible from the air at range (billboard/impostor beyond ~300u) and should idle-animate and wave when the plane passes within ~120u.
### 6.3 Landing (v1)
Not required. Fly low over the home field → auto-return-to-hangar with a gentle fade. A five-year-old cannot land an aircraft and should not be asked to.
Forgiving landings are v2: any touchdown on green counts, bounces are funny.
*(As-built: the v2 forgiving landing shipped, replacing the auto-return — see
IMPROVEMENT_PLAN 1.1/1.2. Flights now begin with a takeoff roll (auto-throttle
spools, pull to rotate, gentle auto-liftoff so nobody is ever stuck) and end
with a landing at home: after the delivery a gold home beacon + the chevron
guide back, a flare cushion softens the last few feet for an empty plane,
gentle touchdown → rollout → confetti on the runway / cheer on the grass →
hangar. Too-hot arrivals near home comedy-bounce and keep flying; §2.1's boing
respawn still applies everywhere else and whenever cargo is aboard.)*
---
## 7. AUDIO
Web Audio synthesis only. Zero files. ~60 lines total. **This is 40% of the magic — do not defer it to "polish."**
| Sound | Recipe |
|---|---|
| Engine | Sawtooth osc → lowpass. Freq ∝ `v`. Gain ∝ thrust. Always running. |
| Whoop (stall) | Descending sine sweep, ~400→180Hz over 0.5s |
| Boing (bonk) | Sine with fast pitch-drop + wobble |
| Chute deploy | Filtered noise burst, 0.3s |
| Thump (landing) | Lowpassed noise burst + low sine thud |
| Chime (delivery) | Triangle osc, major-third interval |
The engine note rising as they dive is the single strongest feedback channel for the energy lesson. Prioritize it.
---
## 8. WORLD (v1)
- Flat-ish ground: displaced plane, gentle hills, low-poly, flat shading
- Sky gradient. Light fog at most — **never** thick fog; occlusion is disorientation
- Home airfield with an obvious, oversized runway
- **3 landmarks**, defined in a `CONFIG` block at the very top of the file so Dad can edit names/positions without hunting:
```js
const CONFIG = {
  landmarks: [
    { id: 'grandma',  label: "Grandma's House", color: '#ff6b35', pos: [ 1200, 0, -800] },
    { id: 'mountain', label: "The Big Mountain", color: '#33e1e1', pos: [-1500, 0, -2000] },
    { id: 'island',   label: "The Island",       color: '#7fd858', pos: [ 2400, 0,  1800] },
  ],
  profiles: [ /* names, icons, colors, tail numbers */ ],
};
```
**Name destinations after real people and real places.** Grandma's house as an LZ is worth more than any amount of terrain detail.
---
## 9. CREATURE PIPELINE
### 9.1 v1
3–4 low-poly creatures baked in as inline `BufferGeometry` data. Hardcoded. Ship it.
### 9.2 v2 — the creature-forge link
The parametric creature forge (separate spec) exports STL for the MK3. Those meshes are far too dense for a real-time iPad scene — decimate to **<2k triangles**.
Build step `bake-creatures.js`: read STL → decimate → emit inline geometry + manifest → inject into HTML.
**Define the interchange format now, before either project hardens:**
```json
{
  "id": "creature_007",
  "name": "Spike",
  "mass": 0.62,
  "color": "#7fd858",
  "positions": "<base64 Float32Array>",
  "normals":   "<base64 Float32Array>"
}
```
`mass` is the important field. It flows straight into §3.7 — **the creature they designed and printed is the creature that makes their plane sluggish.** Physical object → digital cargo → flight characteristics. That closed loop is the reason this project exists rather than any other flight game.
---
## 10. TECH & BUILD
- **Three.js inlined**, pinned version. ~600KB → ~1MB total file. This is the project where the no-CDN rule has a real cost; pay it once at build time rather than retrofitting.
  - *Caveat:* the r128 restrictions (no `OrbitControls`, no `CapsuleGeometry`) only apply if this is ever prototyped inside a claude.ai artifact. A locally-built file can use any modern release.
- `build.js` — zero-dep Node script, reads `src/`, emits `dist/flightschool.html`
- Single file, no routing, works from any path
- Perf target: **locked 60fps on the target iPad.** No shadows in v1 (or one low-res directional map, measured). No postprocessing. Flat shading. Instanced delivered-creatures.
- Section the file with comment banners — CONFIG / AERO / WORLD / AUDIO / UI / PERSIST / MAIN
### 10.1 Dashboard integration
Single HTML entry point, no build coupling to the launcher. Expose a title and icon for the dashboard listing. Launches from any path, no server assumptions beyond §11.1.
---
## 11. OPEN QUESTIONS — resolve before coding
### 11.1 ⚠️ How does this reach the iPad? (blocks §5)
Real decision with real consequences:
| Option | Persistence | Notes |
|---|---|---|
| **Host on xile.us** | `localStorage` works cleanly | Requires network — violates the offline instinct, but it's a home iPad, not a SIPR terminal |
| **`file://` via Files app** | Safari restricts `localStorage` on `file://` origins | Would need in-memory state + explicit export/import JSON. Bad UX for kids. |
| **LAN dev server** | Works | Needs a machine running. Fragile for casual Saturday use. |
**Recommendation: host it.** This is the one tool of yours where the offline constraint buys nothing and costs the entire persistence mechanic — which is the retention loop (§6.2). Suggest an explicit, documented exception to the house rule.
*(If this ever runs as a claude.ai artifact: `localStorage` is unavailable there — use `window.storage` instead.)*
*(As-built: hosted on GitHub Pages; the repo root serves the launcher.)*
### 11.2 House style vs. kid palette
Your canonical `#0b0d10` / `#ffb000` / `#33e1e1` monospace is a *tool* aesthetic. This is not a tool.
**Recommendation:** bright, saturated, cheerful game world. Keep the house style in the loader and any adult-facing config screen only. Flagging rather than deciding — it's your call whether the family software shares the squadron's visual language.
*(As-built: bright kid palette everywhere.)*
### 11.3 Shared vs. separate worlds
Spec'd as separate (§5.3). Confirm — a "family world" where each kid sees the other's deliveries is charming and also a plausible source of tears.
*(As-built: separate. Family world remains a v2 opt-in idea.)*
### 11.4 Manual throttle timing
v2 per §2.2. Worth deciding what earns it — flight hours? Deliveries? Just Dad flipping a flag in CONFIG when the kid is ready? (Probably the last one.)
---
## 12. DEFINITION OF DONE (v1)
- [x] Profile picker, 2 profiles, icon-only identification, tail numbers rendered
- [x] Touch stick + DROP button, floating stick origin, iOS gestures suppressed
- [x] Flight model per §3, **verified that a sustained pull induces a stall**
- [x] Whoop + automatic recovery, reads as funny
- [x] Boing respawn, ≤1.5s, cargo recoverable
- [x] 3 landmarks from CONFIG, beacon columns, nav chevron
- [x] Cargo drop → 0.6s → chute → sway → thump → creature stands and waves
- [x] Delivered creatures persist across sessions, per-profile
- [x] Delivered creatures wave on flyby
- [x] Full Web Audio set, engine note tracks airspeed
- [ ] 60fps locked on target iPad *(verify on device)*
- [x] Single self-contained HTML, Three.js inlined
- [ ] Add-to-Home-Screen fullscreen verified *(verify on device)*
### 12.1 The real acceptance test
Hand it to the five-year-old with no explanation. They should be delivering a creature within 60 seconds, and they should ask for it again the next day.
Everything in this document is subordinate to that.

---
*(As-built beyond v1 — see `IMPROVEMENT_PLAN.md`: **rescue missions** add a
second verb — a 🆘 hangar card sends you out empty to a stranded buddy marked by
a flare; a low, slow pass scoops it; carry it home and land, and it joins a
persistent colony beside the runway. A **living world** drifts below: hot-air
balloons that bob and wobble when you honk, and a flock of birds circling.)*

*Restored to the repo after initially living only in the project chat. Follow-up
work is planned in `IMPROVEMENT_PLAN.md`; the space sibling's contract is
`SPACE_SCHOOL.md`. Italicized "as-built" notes above mark where the shipped game
deliberately diverges from or resolves the original text.*
