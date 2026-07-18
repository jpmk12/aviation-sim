# ✈️ Flight Deck — aviation games for little pilots

A small collection of aviation-themed games built for two young children (target:
a competent 5-year-old, younger sibling supervised). iPad, touch, landscape.
Each game is **one self-contained HTML file** — Three.js is inlined, no CDN, no
network needed at play time.

- **Flight School** — a cargo-flying game. Pick a pilot, load a creature, fly it
  to Grandma's / the mountain / the island, and airdrop it. The creature stays
  there forever. Built. See below.
- **Space School** — a space delivery game (a rocket ferrying cargo to planets
  and moons). Planned next; the launcher already has a slot for it.

The design contract lives in `CLAUDE.md` (Flight School). This README is the
grown-up's manual.

---

## Quick start

```bash
node build.js          # emits dist/flightschool.html + dist/index.html
node test/physics-sim.js   # proves the flight model (stall on a sustained pull)
```

Open `dist/index.html` (the launcher) or `dist/flightschool.html` directly.

There are **no dependencies to install** — `build.js` and the test are plain
Node, and Three.js is vendored in `src/vendor/three.min.js`.

---

## Getting it onto the iPad

Persistence (the world each child builds, one delivery at a time) uses
`localStorage`, which needs a real web origin. **Host the `dist/` folder** on any
static host (this is the spec's recommendation — see `CLAUDE.md` §11.1) and open
it in Safari. Then:

1. Open the launcher URL in Safari.
2. **Share → Add to Home Screen.** Launch it from the home-screen icon so it runs
   fullscreen without the Safari address bar (thumbs find the URL bar within a
   minute otherwise).
3. Turn the iPad **landscape**. Portrait shows a "turn me sideways" screen.
4. **Guided Access** (triple-click the side button) locks the child into the app
   and disables the home-swipe. This is the real fix for accidental exits — it is
   deliberately not solved in code.

`file://` (opening the HTML from the Files app) works to *play*, but Safari
restricts `localStorage` on `file://` origins, so deliveries won't survive
between sessions. The game falls back to in-memory state so it still runs.

---

## How to play (hand it to the kid, say nothing)

1. **Tap a pilot** (the fox or the dragon). That tap also unlocks sound.
2. **Pick a buddy.** Bigger buddy = heavier = harder to fly. The dots under each
   card count the weight.
3. **Pick where to go.** Three picture cards, colour-matched to the beacons.
4. **Fly.** Left thumb anywhere on the left half = a floating stick (up/down =
   climb/dive, left/right = turn). The plane rights itself when you let go.
5. **Press the big red DROP** over the target. A parachute opens, the buddy floats
   down, thumps, stands up and waves. It stays there forever.
6. Fly low back over the runway to return to the hangar for another trip.

**The one thing they'll learn without being told:** pulling up hard bleeds
speed — climb too steeply and the plane gets "sleepy" (a whoop, the nose drops,
it wakes up on its own). Diving builds speed back (listen to the engine). A heavy
buddy makes all of this happen sooner. No crashes, no score, no losing.

---

## For Dad: editing the game

Everything you'd want to change is in the **CONFIG block at the very top of
`src/game.js`** — then re-run `node build.js`.

- **`landmarks`** — name the three destinations after real places (Grandma's
  house is worth more than any terrain). Set `label`, `color`, and `pos: [x, y, z]`
  (y is ignored; they sit on the ground). `color` drives the beacon column and
  the nav arrow.
- **`profiles`** — your kids. Identity is the **icon + colour** (a child can't
  read a name). Put their `name` and `initials`; the tail number paints itself
  from the initials (e.g. initials `"R"` → `N-R` on the tail).
- **`creatures`** — the cargo. `mass` (0.15–0.8) is the important one: it makes
  the plane sluggish. `scale` just makes a heavy creature look big.
- **`invertPitch`** — flip to `true` if your child expects "pull back to climb".
  Default `false` = push the stick up to go up.

The flight-model numbers live in `src/aero.js` with comments explaining every
tuning choice (they were verified, not guessed — see the test).

---

## Project layout

```
src/
  aero.js         flight-model constants + the one equation (framework-free, tested)
  game.js         the whole game: CONFIG / PERSIST / AUDIO / WORLD / CREATURES / PLANE / UI / MAIN
  shell.html      the HTML shell + all CSS + iOS meta tags
  vendor/
    three.min.js  Three.js r150 (UMD), vendored — inlined at build time
build.js          zero-dependency build: src/ -> dist/flightschool.html + dist/index.html
test/
  physics-sim.js  proves a sustained pull stalls, a dive builds speed, heavy stalls sooner
dist/
  flightschool.html   the shippable single file
  index.html          the launcher / dashboard (lists every game)
```

## Verifying a change

- `node test/physics-sim.js` — the flight-model acceptance test. If you retune
  `aero.js`, this tells you whether the energy lesson survived.
- Rebuild and open `dist/flightschool.html`. The real acceptance test (from the
  spec): hand it to the five-year-old with no explanation — they should be
  delivering a creature within 60 seconds, and asking for it again the next day.

## v2 ideas (already scaffolded for)

- **Manual throttle** — flip a CONFIG flag when a kid is ready (`CLAUDE.md` §11.4).
- **Forged creatures** — swap the procedural creatures for meshes the kids design
  and 3D-print; `mass` flows straight into the flight model (`CLAUDE.md` §9.2).
- **Space School** — the launcher already reserves a card; add its HTML to `dist/`
  and uncomment the entry in `build.js`.
