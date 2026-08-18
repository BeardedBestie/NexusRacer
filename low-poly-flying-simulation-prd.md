# Product Requirements Document

## Low-Poly Procedural Flying Simulation

**Status:** Draft  
**Platform:** Modern web browsers  
**Primary technology:** Three.js / WebGL (with a future-compatible rendering abstraction)  
**Product type:** Single-player exploratory flying simulation  
**Document owner:** Product / Technical Design  

---

## 1. Product summary

Create a performant, browser-based flying simulation set in an endlessly streamable, low-poly procedural environment. Players fly an aircraft through a stylized world of mountains, coasts, forests, islands, settlements, and atmospheric weather-like conditions. The world is generated deterministically from a seed, so terrain, landmarks, vegetation, and points of interest remain consistent across sessions.

The experience prioritizes flight feel, visual readability from altitude, exploration, and a cohesive stylized aesthetic over photorealism or simulation-grade avionics. It must load quickly, run smoothly on mainstream laptops, and degrade gracefully on lower-end devices.

### Product promise

> A beautiful, responsive browser flight experience where players can freely explore a vast low-poly world that is generated as they fly.

---

## 2. Problem and opportunity

### Problem

Most browser 3D experiences face competing constraints:

- Large worlds require more geometry, texture memory, and draw calls than browser hardware budgets comfortably allow.
- Procedural terrain can look repetitive, noisy, or visually incoherent without biome and landmark rules.
- Flight simulations need stable terrain queries, distant visibility, and consistent physics, all of which become difficult when terrain is streamed dynamically.
- High-fidelity visuals are costly and can make a web experience slow to load or unusable on integrated GPUs.

### Opportunity

A low-poly aesthetic turns hardware limitations into a distinctive visual direction. A procedural, deterministic world enables large-scale exploration without shipping a massive asset library. A short session loop—take off, explore, discover a landmark, land or continue—fits browser play while allowing more advanced simulation features later.

---

## 3. Goals

### Primary goals

- Deliver an enjoyable and intuitive flying experience in a modern desktop browser.
- Generate a visually coherent procedural world from a reproducible seed.
- Stream terrain and environmental content continuously around the player.
- Sustain a target frame rate of 60 FPS on a mid-range laptop under the default quality preset.
- Achieve a visually intentional low-poly aesthetic without dependency on large texture downloads.
- Support long-distance traversal without floating-point precision artifacts or visible terrain seams.
- Make the world navigable through recognizable landforms and landmarks.

### Secondary goals

- Support shareable world seeds and deep links to a seed and spawn location.
- Support configurable graphics quality settings.
- Establish an architecture that can later accommodate missions, races, landing challenges, AI traffic, multiplayer, or user-generated routes.
- Provide a developer mode for inspecting world coordinates, chunk loading, terrain height, frame time, and draw calls.

---

## 4. Non-goals

The initial release will not aim to provide:

- Photorealistic terrain, vegetation, water, lighting, or weather.
- Full civilian-flight-simulator realism, real-world terrain, real-world navigation databases, or regulated flight procedures.
- Multiplayer, persistent shared worlds, or networked synchronization.
- Complex cockpit instrumentation or clickable cockpit interactions.
- Detailed damage modeling, combat, weapons, or destructive terrain.
- Unlimited visibility or a fully rendered globe.
- Native mobile-first control design; mobile support may be evaluated after desktop performance and controls are validated.

---

## 5. Target users

### Primary user: exploratory player

A player who wants a relaxing, visually appealing flight experience without the learning curve of a full simulator. They value atmosphere, discovery, responsive controls, and scenic traversal.

### Secondary user: technical or creative player

A player interested in procedural worlds, seed-based exploration, screenshots, smooth browser graphics, and systems that produce emergent landscapes.

### Tertiary user: developer or creator

A technically inclined user who may inspect, share, or experiment with seeds, terrain parameters, landmarks, and performance settings.

---

## 6. Experience principles

- **Readable from altitude:** The world must communicate terrain type, elevation, hazards, routes, and landmarks from the aircraft’s normal flight height.
- **Stylized by design:** Facets, a limited palette, flat shading, and simplified objects should feel authored rather than unfinished.
- **Explore, do not grind:** The core loop is curiosity and movement, not resource collection or repetitive objectives.
- **Smoothness before spectacle:** Maintain predictable input and frame pacing before adding expensive visual effects.
- **Deterministic and debuggable:** The same seed and world coordinate must reproduce the same terrain and environmental placements.
- **Graceful degradation:** Players should be able to reduce render distance, object density, shadows, and pixel ratio without breaking gameplay.

---

## 7. User stories

### Core flight

- As a player, I want to take off and fly immediately so I can experience the world without lengthy setup.
- As a player, I want controls to feel responsive and forgiving so I can enjoy exploration even without aviation experience.
- As a player, I want to understand my speed, altitude, heading, and throttle state at a glance.
- As a player, I want an optional assisted-flight mode so I can avoid accidental stalls or unrecoverable rolls.
- As a player, I want to restart or respawn quickly after a crash or difficult landing.

### Exploration

- As a player, I want mountains, coastlines, islands, rivers or valleys, forests, and settlements to be visually distinct.
- As a player, I want recognizable landmarks so I can navigate without constantly reading a map.
- As a player, I want the environment to continue loading smoothly as I travel.
- As a player, I want a world seed I can share and revisit.

### Presentation

- As a player, I want terrain to look intentional at both low and high altitude.
- As a player, I want haze, sky, clouds, and lighting to create a sense of scale.
- As a player, I want graphics settings that explain their impact and preserve playable performance.

### Development and operations

- As a developer, I want deterministic generation so a reported issue can be reproduced from a seed and position.
- As a developer, I want performance telemetry so I can identify draw-call, memory, terrain-generation, and frame-time bottlenecks.
- As a developer, I want procedural systems to be modular so I can tune biomes, terrain, prop rules, and flight behavior independently.

---

## 8. Core gameplay loop

1. Player enters a seeded world at a runway, clearing, carrier-like platform, or airborne spawn.
2. Player takes off or resumes flight using simplified controls.
3. Player follows visual curiosity, landmarks, terrain corridors, or optional navigation cues.
4. The world streams terrain, props, clouds, water, and distant scenery around the aircraft.
5. Player discovers notable features: mountain ranges, isolated islands, forests, villages, radio towers, airstrips, or scenic viewpoints.
6. Player lands, crashes and respawns, changes the seed, or continues exploring.

The minimum viable experience is successful if a player can fly for 10–20 minutes, encounter varied scenery, orient themselves by landmarks, and remain within a stable performance budget.

---

## 9. Functional requirements

### 9.1 World seed and persistence

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| WR-01 | The application shall generate a world from a numeric or string seed. | Must | A supplied seed produces the same sampled height, biome, and landmark result at the same world coordinates across reloads. |
| WR-02 | The application shall support a default random seed for new sessions. | Must | A player can enter without configuring a seed. |
| WR-03 | The application shall display and allow copying of the active seed. | Should | The player can copy a seed from the UI without developer tools. |
| WR-04 | The application shall support a shareable route or URL state containing seed and spawn data. | Should | Opening a valid shared state recreates the expected world and initial location. |
| WR-05 | The application shall persist player settings locally. | Must | Graphics and control preferences remain after reload. |

### 9.2 Procedural terrain

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| TR-01 | Terrain shall be generated in square world-space chunks. | Must | The player can travel continuously while chunks are created and recycled around them. |
| TR-02 | Adjacent chunks shall not show height discontinuities. | Must | Shared edges produce matching world-space elevation values. |
| TR-03 | Terrain generation shall combine multiple spatial scales of variation. | Must | Generated worlds include broad regions, local relief, and controlled detail rather than uniform noise. |
| TR-04 | The system shall classify terrain into configurable biomes. | Must | Biome classification is based on deterministic environmental inputs such as elevation, slope, moisture proxy, temperature proxy, and noise. |
| TR-05 | Terrain shall support water-level classification. | Must | Elevation at or below a configured sea level produces water or shoreline behavior. |
| TR-06 | Terrain shall support slope-aware material or color assignment. | Must | Steep slopes are visually distinguishable from flatter ground. |
| TR-07 | The terrain system shall provide a synchronous or cache-backed height query for any world coordinate needed by flight systems. | Must | Aircraft altitude-above-ground and collision logic do not require waiting for visible chunk meshes. |
| TR-08 | Terrain tiles shall support multiple geometry resolutions. | Must | Near and far terrain have visibly different mesh densities while maintaining acceptable seams and transitions. |

### 9.3 Environmental props

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| EP-01 | The world shall place vegetation and rocks according to biome and slope rules. | Must | Trees do not appear in water or on invalid steep surfaces; prop placement is stable for a given seed. |
| EP-02 | The world shall include at least five prop categories at MVP: trees, rocks, shrubs, settlements, and navigation landmarks. | Must | Each category appears in appropriate regions at configurable densities. |
| EP-03 | Repeated prop types shall use instanced rendering or equivalent batching. | Must | Increasing prop density does not create one independent draw call per prop. |
| EP-04 | The world shall include distinctive navigation landmarks. | Should | At minimum, towers, airstrips, settlements, unusual peaks, and island/coastal forms are available in generation rules. |
| EP-05 | Props shall have distance-based visibility rules. | Must | Props are hidden, clustered, simplified, or replaced at distance according to quality settings. |

### 9.4 Water, sky, and atmosphere

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| AT-01 | The application shall render a stylized sky with a horizon-aware gradient. | Must | The horizon remains visually coherent across normal pitch and roll ranges. |
| AT-02 | The application shall use configurable atmospheric haze or fog. | Must | Distant terrain transitions smoothly toward the horizon and render distance boundary is not distracting. |
| AT-03 | Water shall visually distinguish sea-level regions from land. | Must | Water remains stable across streamed chunk boundaries. |
| AT-04 | The system shall support a time-of-day lighting parameter. | Should | Sun direction and sky palette can be changed without requiring a terrain regeneration. |
| AT-05 | The system shall support lightweight clouds or cloud layers. | Should | Cloud visuals do not cause unacceptable frame-time spikes under the default preset. |

### 9.5 Aircraft and flight simulation

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FL-01 | The application shall provide one default aircraft with a simple low-poly visual model. | Must | The aircraft is visible in third-person view and has a stable orientation. |
| FL-02 | The simulation shall support throttle, pitch, roll, yaw, and reset controls. | Must | Keyboard input controls each required axis with documented bindings. |
| FL-03 | Flight updates shall use a fixed simulation timestep. | Must | Aircraft behavior is materially consistent across different rendering frame rates. |
| FL-04 | The flight model shall include thrust, drag, lift approximation, gravity, and angular damping. | Must | The aircraft can take off, climb, bank, descend, stall or lose lift under extreme conditions, and recover with normal inputs. |
| FL-05 | The game shall provide an assisted-flight mode. | Must | Optional stabilization limits excessive roll and helps maintain controllable speed/attitude. |
| FL-06 | The game shall provide terrain collision and altitude-above-ground checks. | Must | Contact with terrain triggers a defined impact or landing outcome. |
| FL-07 | The game shall provide rapid respawn or reset behavior. | Must | A player can resume from a safe state within two user actions. |
| FL-08 | The game shall display a minimal flight HUD. | Must | HUD includes speed, altitude, heading, throttle, and optional waypoint/seed information. |

### 9.6 Camera and controls

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| CC-01 | The default camera shall be a third-person chase camera. | Must | Camera follows aircraft smoothly without excessive lag or disorienting clipping. |
| CC-02 | The game shall support at least one alternate view: cockpit-like forward or free-look orbit. | Should | Player can switch views via a documented input. |
| CC-03 | Camera smoothing shall be configurable. | Should | Players can choose reduced cinematic lag for precision flying. |
| CC-04 | Keyboard controls shall be accessible and discoverable. | Must | The game presents a controls overlay on first launch and from pause/settings. |
| CC-05 | Gamepad support shall be supported if browser APIs are available. | Should | Standard analog axes map to pitch, roll, yaw, and throttle with configurable sensitivity. |

### 9.7 Interface

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| UI-01 | The application shall show a lightweight loading state before controls become active. | Must | The player sees progress or a clear ready state before entering flight. |
| UI-02 | The application shall include a pause/settings menu. | Must | Player can change controls, graphics, audio, and seed-related options. |
| UI-03 | The application shall offer at least Low, Balanced, and High graphics presets. | Must | Presets alter documented values such as render distance, terrain resolution, prop density, shadows, and pixel ratio cap. |
| UI-04 | The application shall include an optional performance overlay. | Should | Overlay shows FPS, frame time, active chunks, draw calls, renderer memory, and world coordinates. |
| UI-05 | The interface shall remain usable at typical laptop viewport sizes. | Must | Core controls and HUD do not overlap or become unreadable at 1280×720 and above. |

---

## 10. Terrain generation specification

### 10.1 Coordinate system

Use a stable global world coordinate system for generation. Every terrain, biome, landmark, and prop decision must be derived from absolute world coordinates plus the active seed.

Visible scene objects may be repositioned using a floating-origin system, but generation must never depend on shifted local render coordinates.

### 10.2 Height function

The terrain generator should combine several deterministic components:

\[
h(x,z)=B(x,z)+R(x,z)+D(x,z)-C(x,z)
\]

Where:

- \(B(x,z)\) is broad continental structure and low-frequency terrain mass.
- \(R(x,z)\) is ridge, mountain, or directional relief contribution.
- \(D(x,z)\) is limited high-frequency surface variation.
- \(C(x,z)\) is coast, river, basin, valley, or erosion-like carving.

The exact algorithm may vary, but it must preserve the following design constraints:

- Large features should exist at scales substantially larger than a single visible terrain chunk.
- Mountains should form ranges or ridges rather than isolated noise spikes.
- Flat terrain should be intentionally reserved for grasslands, airstrips, settlements, or plateaus.
- Coastlines should contain variation and recognizable bays, peninsulas, or islands.
- Fine detail should be subtle enough to preserve the low-poly silhouette.

### 10.3 Biome classification

Biome classification should be a pure deterministic function using inputs including:

- Elevation
- Slope or terrain normal
- Continentality or distance-like proxy from water
- Moisture-like noise field
- Temperature-like noise field or latitude-like world-space factor
- Local variation noise

Initial target biomes:

- Deep water
- Shallow water / coastal water
- Beach or shoreline
- Grassland
- Forest
- Dry scrubland
- Desert or badlands
- Rocky highland
- Alpine terrain
- Snowcap

Biomes are visual and placement rules, not necessarily a physically realistic climate simulation.

### 10.4 Low-poly mesh treatment

- Use a coarse grid near the aircraft and coarser grids at larger distances.
- Use flat shading as the default presentation mode.
- Prefer silhouette and face orientation variation over dense displacement.
- Assign material color through vertex colors, face colors, shader logic, or a small procedural palette lookup.
- Avoid high-resolution photo textures as a core dependency.
- Use skirts, edge stitching, geomorphing, or another established method to hide LOD cracks.

---

## 11. Visual direction

### 11.1 Art style

The visual target is clean, faceted, colorful, and atmospheric. The environment should resemble a stylized miniature landscape at low altitude and an illustrated map at high altitude.

Key characteristics:

- Flat or controlled faceted shading.
- Limited, harmonious palette.
- Strong elevation and biome readability.
- Large, graphic cloud and haze forms.
- Simplified geometry with intentional variation.
- Emphasis on warm/cool lighting and horizon depth.

### 11.2 Palette strategy

Use a constrained palette rather than texture-heavy realism. Suggested categories include:

- Deep and shallow water colors.
- Beach and coastal colors.
- Several grass and forest colors.
- Dry terrain and exposed-rock colors.
- High-elevation and snow colors.
- Aerial-perspective variants for distant terrain.

Color selection should incorporate height, slope, biome, and low-frequency stable variation. The system should avoid a single uninterrupted color across large areas unless that is an intentional biome design choice.

### 11.3 Programmatic texture use

Programmatic textures are optional enhancements, not the primary source of terrain identity. Suitable uses include:

- Subtle water movement or normal variation.
- Runway markings and landing pads.
- Stylized cloud masks.
- Foliage or sand detail in close-range props.
- UI map overlays.

Textures should be small, repeatable, generated at runtime or bundled compactly, and used sparingly. Terrain should remain visually coherent with vertex color alone.

---

## 12. World streaming and LOD

### 12.1 Chunk streaming model

- Maintain a configurable square or circular set of terrain chunks centered on the aircraft.
- Recycle chunks as the aircraft crosses chunk boundaries, rather than allocating and destroying the entire active set.
- Generate a high-priority near ring first, then progressively generate outer rings.
- Ensure the next likely flight-direction chunks receive prioritization.
- Keep a cache of recently used terrain data where it meaningfully reduces regeneration work and memory remains within budget.

### 12.2 Levels of detail

Initial LOD tiers:

| Tier | Relative distance | Terrain detail | Props | Shadows |
|---|---|---|---|---|
| Near | Immediate flight corridor | Highest available grid resolution | Full density, instanced | Limited dynamic shadows allowed |
| Mid | Visible navigation zone | Medium grid resolution | Reduced density and simplified meshes | Optional or reduced shadows |
| Far | Horizon support | Coarse grid resolution | Clusters, billboards, or none | No dynamic shadows |

Exact distances must be exposed to graphics presets and adjusted through profiling.

### 12.3 Seam prevention

The implementation shall prevent or obscure:

- Height gaps between neighboring chunks.
- Visible cracks when adjacent chunks use different LOD levels.
- Abrupt changes in biome color or water level at chunk boundaries.
- Prop pop-in that is visible during standard forward flight.

Acceptable mitigation methods include overlapping transitions, fade-in/out, LOD skirts, shared border sampling, deferred prop appearance, and fog-assisted culling.

### 12.4 Floating origin

For long-distance traversal, the application shall support a floating-origin policy:

- Track player and generator coordinates in a high-range global coordinate model.
- Recenter render-space positions when the player passes a configurable distance threshold.
- Preserve deterministic terrain and prop generation after recentering.
- Avoid noticeable shifts in camera, physics, particles, or active chunk alignment.

---

## 13. Flight model requirements

### 13.1 Design target

The initial flight model should feel believable, readable, and forgiving rather than aeronautically exact. It should reward smooth control inputs and basic energy management without requiring formal aviation knowledge.

### 13.2 Required forces and behaviors

- Gravity continuously influences the aircraft.
- Engine thrust accelerates the aircraft in its forward direction.
- Drag increases with speed and/or angle of attack proxy.
- Lift is dependent on forward speed and aircraft orientation relative to travel direction.
- Pitch, roll, and yaw change aircraft orientation with inertia and damping.
- Excessive pitch or low speed reduces lift and can cause a stall-like descent.
- Landing or collision outcomes are determined from ground contact speed, vertical speed, attitude, and surface type where practical.

### 13.3 Assistance modes

| Mode | Intended user | Behavior |
|---|---|---|
| Assisted | New and casual players | Auto-level tendency, roll limits, stall protection where possible, forgiving control response |
| Standard | Returning players | Reduced stabilization, normal stall-like behavior, more momentum |
| Advanced, future | Simulation-oriented players | Minimal assistance, tighter energy and attitude management |

MVP requires Assisted and Standard modes.

### 13.4 Simulation timing

- Physics uses a fixed timestep independent of render timing.
- Rendered motion may interpolate between physics states for smoothness.
- Maximum simulation catch-up work per animation frame must be bounded to prevent severe recovery stalls.
- Input handling must remain responsive under moderate frame-rate drops.

---

## 14. Performance requirements

### 14.1 Target device classes

| Class | Example expectation | Product target |
|---|---|---|
| Baseline | Recent integrated GPU laptop | Playable at Low or Balanced settings |
| Target | Mid-range laptop or desktop GPU | Stable 60 FPS at Balanced settings |
| High-end | Modern discrete GPU desktop | 60 FPS or higher at High settings with extended visual range |

### 14.2 Performance budgets

These are initial targets to validate with profiling and revise based on final visual scope:

| Metric | Balanced target | Low target | High target |
|---|---:|---:|---:|
| Frame rate | 60 FPS target | 30–60 FPS target | 60 FPS target |
| Frame time | Approximately 16.7 ms | Approximately 33.3 ms maximum target | Approximately 16.7 ms |
| Initial interactive load | Under 10 seconds on a typical broadband desktop connection | Under 12 seconds | Under 12 seconds |
| Terrain generation hitch | No persistent hitch; isolated work should remain difficult to perceive | Short degradation acceptable | No persistent hitch |
| Draw calls | Controlled through batching and instancing | Lowest practical | Capped and monitored |

### 14.3 Required optimizations

- Reuse geometry, materials, and chunk allocations when possible.
- Use instancing for repeated environmental assets.
- Use frustum culling and distance culling.
- Avoid per-frame allocations in the animation and physics loops.
- Limit shadow map rendering distance and number of shadow-casting lights.
- Cap device pixel ratio or expose a resolution scale setting.
- Make expensive postprocessing optional.
- Move heavy non-rendering generation work off the main thread when profiling demonstrates a need.

### 14.4 Performance telemetry

Development builds shall expose:

- FPS and rolling frame-time distribution.
- Active terrain chunks by LOD tier.
- Terrain generation queue length and generation duration.
- Draw calls, triangles, texture count, geometry count, and renderer memory estimates where available.
- Number of active prop instances by category.
- Player global position, local render position, seed, altitude, and speed.

---

## 15. Technical architecture

### 15.1 High-level modules

| Module | Responsibilities |
|---|---|
| Application shell | Initialization, loading, input wiring, settings persistence, page lifecycle |
| Renderer | Scene, camera, lighting, fog, quality settings, render loop |
| World generator | Seeded noise, height function, biome function, landmarks, prop placement rules |
| Chunk manager | Active chunk selection, queues, pooling, LOD assignment, mesh lifecycle |
| Terrain mesh builder | Sampling, geometry generation, vertex attributes, color assignment, seam handling |
| Prop system | Deterministic placement, instanced batches, LOD and culling |
| Aircraft simulation | Fixed-step state update, forces, collision queries, assistance modes |
| Camera system | Chase camera, alternate views, smoothing, collision/clipping mitigation |
| UI system | HUD, menus, seed sharing, settings, controls reference, debug overlay |
| Audio system, future | Engine, wind, ambient loops, spatial cues |

### 15.2 Data boundaries

- World generation functions must not directly mutate the Three.js scene.
- Scene objects must not be treated as the source of truth for terrain height or aircraft physics.
- Flight simulation state must remain independent of camera state.
- UI state must not directly control rendering internals without a settings interface.
- Quality settings must apply through documented configuration values, not scattered conditional behavior.

### 15.3 Worker strategy

Use a worker when chunk generation causes material main-thread frame stalls. Suitable worker responsibilities include:

- Noise sampling for terrain heightmaps.
- Biome classification arrays.
- Terrain vertex/index/color data generation.
- Deterministic prop-candidate generation.

The main thread remains responsible for GPU resource creation, scene graph changes, input, UI, and rendering.

### 15.4 Deterministic randomization

All procedural decisions must use a seeded pseudo-random source derived from world seed and stable spatial keys. Do not use unseeded runtime randomness for persistent terrain or prop placement.

Examples of stable keys:

- Chunk coordinate pair.
- Biome cell coordinate.
- Landmark region coordinate.
- Prop grid cell coordinate.

---

## 16. Accessibility and usability

- Provide remappable keyboard controls or at minimum configurable sensitivity and inversion options.
- Provide a clear first-run controls guide.
- Avoid relying only on color to indicate critical HUD warnings.
- Provide motion-reduction options for camera lag, screen shake, and visual effects.
- Support pause at any time.
- Keep HUD text legible under bright terrain and sky conditions.
- Provide an optional horizon indicator for players who experience spatial disorientation.

---

## 17. Analytics and success metrics

Analytics must be privacy-conscious and avoid collecting unnecessary personal data. Use aggregated, opt-in or policy-aligned telemetry where required.

### Product metrics

| Metric | Definition | Initial success signal |
|---|---|---|
| Time to first flight | Time from page load to controlled airborne state | Median under 90 seconds for new users |
| Session length | Active session duration | Meaningful exploratory sessions beyond a brief technical demo |
| First-session retention | Users who return after first flight | Demonstrates replay value through seeds and exploration |
| Crash/reset frequency | Resets per session | High enough to indicate challenge, low enough to avoid frustration |
| Graphics preset distribution | Settings selected by device class | Informs default-preset tuning |
| Frame-time stability | Percent of frames within target budget | More useful than average FPS alone |
| Seed sharing or reuse | Copy/share/open seed actions | Indicates procedural-world interest |

### Technical metrics

- Time to generate each LOD chunk.
- Longest frame time during high-speed traversal.
- GPU memory growth during a 30-minute uninterrupted flight.
- Number of active meshes and instances by quality preset.
- Frequency of missing terrain, terrain seams, collision mismatches, or asset pop-in reports.

---

## 18. Quality settings

### Low

- Shorter render distance.
- Fewer active chunks.
- Coarser near and far terrain resolution.
- Reduced prop density.
- No dynamic shadows or severely limited shadows.
- Lower pixel-ratio cap.
- Simplified clouds and water.
- Reduced or disabled postprocessing.

### Balanced

- Default target preset.
- Moderate render distance with near/mid/far LOD tiers.
- Standard vegetation and landmark density.
- Limited dynamic shadows near the aircraft.
- Moderate pixel-ratio cap.
- Atmospheric haze, basic water animation, and lightweight clouds.

### High

- Longer render distance.
- Higher near-terrain resolution.
- Increased prop density and broader landmark visibility.
- Improved shadow distance and cloud quality.
- Higher pixel-ratio cap within safe device constraints.
- Optional aesthetic effects subject to profiling.

---

## 19. MVP scope

### Included in MVP

- Browser-based Three.js application.
- One low-poly aircraft.
- Keyboard controls and third-person chase camera.
- Assisted and Standard flight modes.
- Fixed-timestep flight simulation with thrust, lift approximation, drag, gravity, and collision.
- Seeded procedural terrain with chunk streaming.
- At least three broad terrain families: coast/water, grass or forest, and mountain/highland.
- Flat-shaded low-poly terrain with biome/slope-based coloring.
- Water plane/surface and sky/fog system.
- Terrain LOD with at least near and far tiers.
- Instanced trees, rocks, and at least one settlement or landmark archetype.
- Basic HUD: speed, altitude, heading, throttle, reset.
- Pause/settings UI with Low, Balanced, and High presets.
- Local persistence of settings and visible/copyable seed.
- Debug performance overlay for development.

### Explicitly deferred

- Multiplayer.
- Realistic cockpit.
- Formal missions, achievements, progression, or economy.
- AI aircraft and air traffic control.
- Dynamic weather simulation.
- Advanced water reflections.
- Full map or navigation chart system.
- Mobile touch controls.
- Terrain editing or user-generated content tools.

---

## 20. Phased roadmap

### Phase 0: Technical prototype

Objective: Validate core feasibility.

- Render a fixed low-poly terrain tile.
- Implement basic aircraft movement and chase camera.
- Implement deterministic height generation.
- Prove terrain height query matches visual terrain.
- Profile baseline render loop and establish device test matrix.

Exit criteria: A plane can fly above a single generated terrain area with stable controls and acceptable rendering on a target laptop.

### Phase 1: Streamed world MVP

Objective: Deliver the core exploration experience.

- Add chunk streaming and pooling.
- Add near/far terrain LOD.
- Add biomes, water, fog, sky, and palette system.
- Add instanced vegetation, rocks, and landmarks.
- Add HUD, reset, seed display, settings, and graphics presets.
- Add performance telemetry and stress tests.

Exit criteria: A player can fly continuously through a varied seeded world for at least 20 minutes without major seams, memory growth, or recurring generation stutters.

### Phase 2: Playability and polish

Objective: Improve feel, identity, and replayability.

- Add gamepad support.
- Add improved landing zones and surface rules.
- Add cloud layers and time-of-day options.
- Improve landmark variety and regional composition.
- Add optional navigation aids or scenic routes.
- Improve audio and UI presentation.

Exit criteria: External testers can understand controls, enjoy exploration, and identify visual landmarks without developer guidance.

### Phase 3: Expansion options

Objective: Evaluate higher-level content systems.

- Landing challenges, races, deliveries, or discovery objectives.
- AI traffic or ambient wildlife.
- Shareable routes and replay capture.
- More aircraft handling profiles.
- WebGPU or advanced rendering path evaluation.
- Multiplayer feasibility study.

---

## 21. Acceptance test scenarios

### World consistency

1. Launch seed A and record height, biome, and visible landmark data at selected world coordinates.
2. Reload the application and re-enter seed A.
3. Verify the sampled data and placements match within expected numeric precision.
4. Enter seed B and verify the world differs meaningfully.

### Seam and LOD traversal

1. Fly repeatedly across chunk boundaries at normal and high speeds.
2. Verify no height cracks, visible holes, or water discontinuities occur.
3. Verify terrain detail changes are unobtrusive under fog and normal camera motion.
4. Verify prop transitions do not present obvious dense popping directly in front of the player.

### Long-distance flight

1. Maintain continuous flight through multiple floating-origin recentering events.
2. Verify aircraft controls, camera, terrain height queries, and landmark generation remain stable.
3. Verify scene memory does not grow unbounded over a 30-minute test flight.

### Performance stress

1. Fly at high speed toward new terrain in a prop-dense biome.
2. Test on target and baseline hardware profiles.
3. Record frame-time spikes, generation queue duration, draw calls, and active instance counts.
4. Confirm Low preset remains playable and Balanced preset approaches the 60 FPS target on target hardware.

### Flight usability

1. New tester launches the application without instructions beyond first-run UI.
2. Tester takes off, turns, climbs, descends, and resets after an impact.
3. Tester identifies speed, altitude, heading, and throttle from the HUD.
4. Tester can enable Assisted mode and recover from an extreme bank or low-speed state.

---

## 22. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Chunk generation causes visible hitches | Breaks flight feel | Pool chunks, prioritize forward path, limit per-frame work, move heavy generation to workers, prefetch based on velocity |
| Procedural terrain looks like noise | Weakens exploration | Use macro landform rules, regional biome masks, ridge shaping, landmarks, and curated parameter presets |
| Too many props create draw-call or GPU bottlenecks | Low frame rate | Instance repeated assets, cull aggressively, cluster distant vegetation, limit material variants |
| LOD transitions produce cracks or popping | Visual quality issues | Shared edge sampling, skirts or stitching, fog, fade transitions, LOD constraints between adjacent chunks |
| Physics differs by frame rate | Controls feel inconsistent | Fixed timestep, bounded catch-up loop, simulation tests at varied render frame rates |
| Terrain collision disagrees with visuals | Unfair crashes or hovering | Use same height function or a verified shared heightfield source for visual and physics queries |
| Large coordinates cause precision errors | Camera jitter or terrain misalignment | Implement floating origin and preserve absolute generator coordinates separately |
| Visual effects exceed browser budgets | Poor accessibility across devices | Make shadows, pixel ratio, clouds, postprocessing, and distance configurable and optional |
| Scope expands toward full flight simulator | Delays release | Keep MVP centered on exploratory arcade-simulation flight and seed-based procedural beauty |

---

## 23. Open questions

- What is the intended primary interaction: relaxed sightseeing, skill-based flying, landing challenges, or a mix?
- Is the desired aircraft a plane, glider, seaplane, fantasy craft, drone, or multiple vehicle types?
- What visual references should define the palette and environmental mood?
- Should water be traversable or landable, requiring seaplane support?
- How prominent should failures be: instant respawn, damage states, score penalties, or optional hardcore mode?
- Should the world be truly unbounded through procedural generation or bounded by a designed regional map at launch?
- Is a shareable seed sufficient, or should players share named landmarks, routes, and screenshot coordinates?
- What browser/device matrix is mandatory for release?
- Does the product need audio at MVP to make flight feel complete?
- Is WebGPU a future enhancement only, or should renderer abstraction be designed for it from the first prototype?

---

## 24. Definition of done for MVP

The MVP is complete when:

- A player can open the web application, learn basic controls, and become airborne without external instructions.
- The player can fly through a continuously streamed seeded world with visibly varied terrain and landmarks.
- Terrain, biome color, prop placement, and height queries are deterministic for a seed and coordinate.
- Chunk boundaries and LOD changes are not materially distracting during typical flight.
- The flight model is stable across common frame rates and provides both Assisted and Standard modes.
- Low, Balanced, and High settings work and persist locally.
- The target hardware tier sustains the defined Balanced performance target in representative terrain.
- The development overlay can diagnose frame rate, chunk behavior, generation load, and world state.
- No critical bugs remain involving missing terrain, collision through terrain, unbounded memory growth, unusable controls, or irrecoverable game state.
