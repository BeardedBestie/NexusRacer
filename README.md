# NEXUS RACER

A browser flight game built on three.js — an endless, seed-deterministic low-poly
world with two ways to fly it.

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

## Modes

| Mode | Loop |
|---|---|
| **Free Range** | Endless procedural world. Hunt landmark-scale shards and Nexus cores, fight patrol drones, fly anywhere. |
| **Endless Circuit** | An infinite gate track against five AI rivals. Gates buy you time; the clock is the only thing that ends the run. |

Both modes accept an optional **goal** (10 / 25 / 50 pickups or gates) or run
endlessly. Mouse sensitivity, assist level and audio are set in the hangar dock.

## Combat

Hostiles fly real hulls from the same model library (never your own) and always
enter from in front — once overshot they disengage and come back around rather
than trailing uselessly on your six.

A sticky lock-on picks whatever sits closest to the nose inside a ~26° cone and
holds it until something is clearly better centred, or until you cycle it with
`T`. Guns and lasers auto-lead the locked target's intercept point; missiles
seek it. On-screen brackets show range, hull, and an edge arrow when the locked
target slips behind you.

## Controls

| | |
|---|---|
| Mouse | Virtual stick — holds its deflection, so you can carry a bank through a full 180. Click the canvas to capture. |
| `X` | Recentre the stick |
| `W` / `S` | Throttle |
| `A` / `D` | Roll · `Q` / `E` rudder |
| `Shift` | Boost · `Ctrl` airbrake |
| `LMB` / `Space` | Primary weapon (auto-leads the locked target) |
| `RMB` / `F` | Secondary weapon (missiles seek the lock) |
| `T` | Cycle lock target |
| `R` | Signature ability |
| `C` | Camera (chase / far / cockpit) |
| `M` | Mute · `Esc` pause |

## Fleet

14 craft, each with its own accel / top speed / handling / boost / hull / mass
profile, a primary and secondary weapon, and a signature ability. Weapons cover
pulse and rail lasers, a beam lance, vulcan machine guns, scatter blasters,
seeker missiles, rocket pods and siege rockets — with heat, ammo and cooldown
budgets that differ per hull.

## Adding assets

**Models** — drop a `.glb` in `public/models/`, then add an entry to `SHIPS` in
[src/ships.js](src/ships.js). Orientation is detected from geometry (mirror
symmetry finds the length axis, taper finds the nose); override with `modelYaw`
on the ship, or nudge it live with the hangar's *Model Facing* arrows. Manual
nudges persist in localStorage — the **⟲** button clears one and restores the
auto-detected facing.

Every ship noses down **-Z**. Use `quaternion.setFromUnitVectors(FWD, dir)` to
aim one, never `Object3D.lookAt` — that aims **+Z** and will fly the hull
tail-first.

Check every hull at once with the contact sheet: `/?grid=1` — a correctly
oriented ship points **left**.

**Sounds** — drop clips in `public/sound/` and run `npm run sounds` (also run
automatically by `npm run dev`). Files are classified by keyword in the filename
(`music`, `boost`, `whoosh`/`gate`, `laser`/`shot`, `missile`, `explosion`,
`pickup`/`ring`, `hurt`, `ui`); anything unrecognised is spread across the
events that most need a clip. The script also renames files containing
URL-hostile characters like `#`. All audio is sample-based — there is no
synthesised fallback.

## Layout

| File | Role |
|---|---|
| `src/main.js` | Bootstrap, state machine, game loop, mode logic |
| `src/terrain.js` | Height field, biome colouring, chunked LOD streaming |
| `src/flight.js` | Fixed-timestep flight model (lift, drag, bank-to-turn, stall) |
| `src/ships.js` | Fleet roster, weapon archetypes, GLB load + auto-orient |
| `src/weapons.js` | Projectiles, missiles, beams, explosions, loadout state |
| `src/world.js` | Deterministic collectible field, drone swarm |
| `src/race.js` | Endless track spline, gates, AI racers |
| `src/environment.js` | Sky, sun, fog, water, clouds, sky-derived IBL |
| `src/hangar.js` | Menu backdrop with the rotating ship preview |
| `src/hud.js` | Splash, ship select, HUD, scanner, results |
| `src/audio.js` · `src/soundbank.js` | Sample playback and classification |
