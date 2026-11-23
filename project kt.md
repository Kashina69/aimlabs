**Project Summary**
- Minimal browser Aim Trainer (Three.js + vanilla JS), tuned for simple flow, low overhead, and easy maintenance.
- Visual design (redesign overhaul): dark graphite range, ONE acid-lime accent (`--signal`) that means "thing you shoot / thing you press". Restrained precision-instrument theme (calm, dark, feedback-first motion, dedicated gun viewmodel, and procedural arena range).

**Run**
```bash
python -m http.server 8001
# open http://localhost:8001
```

**Architecture (current)**
- `main.js` -> `Game.init()`
- `Game` owns core systems: renderer, scene, input, audio, pool, fx, drill lifecycle (phase machine), HUD, screens, settings.
- `OverlayManager` owns exactly one full-screen screen at a time (home, pause, results, stats). `show(el, owner)` calls `owner.destroy()` when replaced.
- `ModeRegistry` lazy-loads selectable modes so mode import failures do not break the menu. `Game.modes` is the loaded map, keyed `Static | Flick | Click Track | Hold Track | Reaction | Cone 45 | Sens Finder`. Only `MODE_ORDER` drills appear in the menu/stats; `Sens Finder` is launched from the rail (`F`), Settings and its own result screen, so it never pollutes drill stats or the Aim Report.
- `src/modes/catalog.js`: display titles/descriptions/diagrams + difficulty presets. Keys stay the stored session `mode` names (Static displays as "Gridshot"), so renaming a title never breaks stats.

**Important code flow**
1. `Game.init()` binds global events, creates the HUD, loads selectable modes through `ModeRegistry` and shows the home screen.
2. `startMode()` abandons the old drill (no save), clears pooled targets/FX, resets the camera, sets phase `arming` and requests pointer lock.
3. `animate()`: weapon/FX update -> FPS -> (countdown | live) camera look -> mode update -> HUD -> render.
4. `shootAtCrosshair()` raycasts ACTIVE pooled targets and routes hit/miss to the current mode.
   CRITICAL: raycast over `pool.active` (always re-derive), never `pool.objects` — that array is the free stack, so active targets are not in it. Filtering alive `mesh.userData.target` keeps killed pop-corpses unhittable.
5. CRITICAL (Flick blink): NEVER schedule setTimeout lifetimes on pooled targets — the pool hands the SAME instance to the next target, and a stale timer later fires `if (t.active) release` against the NEW target (the "ball appears 0.1s, vanishes, respawns" cycle). Target lifetimes are timestamp-based: `spawnedAt` + `lifeMs` reaped in the mode's `update()`, with instant kill on hit.

**Styling system (no framework, no inline cssText)**
- `styles/tokens.css`: ALL colours (OKLCH), type scale, spacing, radius, z-index layers, motion curves. Change design here first.
- `styles/base.css` (reset, layers, focus, reduced motion, shared `rise` keyframes), `components.css` (btn, kbd, field, slider, switch, segmented, tabs, swatch, badge, panel, hold-to-confirm), then one file per screen: `home.css`, `game.css` (HUD/crosshair/countdown/lock prompt/pause), `results.css`, `settings.css`, `stats.css`.
- Fonts are SELF-HOSTED in `assets/fonts` (Geist + Geist Mono, OFL). CSP is `default-src 'self'`, so Google Fonts/CDNs would be blocked. Changing numbers use `.num` (Geist Mono + tabular-nums).
- `src/core/palette.js` mirrors the tokens as hex for Three.js materials + target colour presets. Keep in sync with tokens.css.
- DOM is built with `h()` from `src/ui/dom.js` (text children are text nodes, never HTML). Also `fmt` (int/pct/ms/clock/date), `token()` (read CSS var for canvas), `prepareCanvas()` (HiDPI), `syncSliderFill()`.
- Motion rules: transform/opacity only, `--ease-out` / `--ease-drawer` curves, <= 320ms. Pause, Esc, restart and HUD numbers NEVER animate (used constantly). Delight budget is only on results (score ticker, staggered stats). Reduced motion handled globally in base.css.

**Drill lifecycle: `Game.phase`**
- `idle` home/stats -> `startMode(key)` -> `arming` (pointer lock requested; `#lock-prompt` "Click to start" shows after 250ms if not locked) -> lock gained -> `countdown` (3-2-1, 400ms steps, targets not spawned, camera can move) -> `beginLive()` calls `mode.start()` -> `live`.
- Lock lost / Esc / tab hidden while live|countdown|arming|resuming -> `pause()` -> `paused` (pause sheet). `resume()` -> `resuming` (live drill) or `arming` (countdown restarts) -> lock -> back to live.
- `mode.finished` -> `endSession()`: saves session (with `difficulty`, `avgKillMs`), computes `previousBest` BEFORE saving, shows results with the in-memory `shotLog`. `currentMode` is cleared, `lastModeName` is kept for Retry/R.
- `abandonCurrentMode()` ends a drill WITHOUT saving (quit, restart, switching drill). It sets phase idle BEFORE unlocking so the lock-loss handler does not pause.
- Esc: settings open -> close; live/countdown/arming/resuming -> pause; paused -> resume (ignores the echo within 300ms of pausing, Chrome can send Esc as both lock exit and keydown); results/stats -> home; home -> open settings.
- Keys: `R` restart (any non-idle phase), `[ ]` sens, `Enter` start on home, `↑ ↓` choose drill on home.
- `Input.lockEnabled` gates pointer lock: only true while a drill is arming/running.

**Screens (src/ui)**
- `screens/Home.js` `HomeScreen` (launcher): left **rail** (brand, drill rows with diagram tile + best + number key, Loadout card showing crosshair/sens/cm360/FOV that opens Settings > Controls, nudge if sens never set, Stats/Settings, total runs/time) and right **stage** with the drill card (title, description, facts, Best/Last/Runs/Accuracy + sparkline, difficulty, Start). Below 980px it becomes one column ordered brand, drills, card, loadout, links (`.rail { display: contents }` + `order`).
- Ghost run: `src/fx/MenuPreview.js` replays the selected drill in the 3D range behind the stage (own 4 meshes, uses Shards for pops, never touches the pool). `Game.applyHomeViewOffset()` uses `camera.setViewOffset` with `home.stageOffset()` so the target zone is centred in the stage; `startMode` calls `clearViewOffset()`. Weapon hidden on home.
- Home keys (via `Game.handleKeydown`): `1-6` pick drill, `↑ ↓`, `Enter` start, `S` stats, `F` sens finder, `,` settings.
- Settings drawer is modal: `openSettings(tab)` sets `inert` on overlay + HUD layers, focuses the active tab, and focus returns to the opener on close.
- `HUD.js`: top-center score / timer / accuracy, streak (>= 5), bottom-right fps + sens (toggle "Show FPS and sensitivity"), `.hit-ticks` kill confirmation around crosshair. Writes text only when it changes.
- `screens/Pause.js`, `screens/Results.js` (score ticker, record line, stat grid, shot placement map, recent-runs trend), `screens/Prompts.js` (lock prompt, countdown, touch-device gate).
- `screens/SensSetup.js` (`#sens-setup`) and `screens/SensResults.js` (`#sens-results`): the finder's setup and report. Both are idle/results overlays; Esc from setup goes home, Esc from results goes home via the existing `phase === 'results'` branch.
- `Settings.js` `SettingsDrawer`: right slide-over in `#ui-drawer` (screen underneath stays). Tabs Controls (sens + cm/360 readout using DPI, FOV, invert Y), Crosshair (presets, builder, base64 share code run through the sanitizer), Targets (colour), Video (Low/Medium/High, show weapon, show meta), Audio (volume, hit sound tick/pop/off).
- `Stats.js` `StatsPage`: per-drill tabs, records, trend chart with hover readout, recent runs table, hold-to-clear (1.2s). Empty state has a Play button.
- `charts.js`: sparkline, trend, shot placement map + `describeMisses()` text.
- Layers in `#ui-root` (pointer-events none; screens opt in with `.interactive`): `#ui-persistent` (HUD, ticks) < `#ui-overlay` < `#ui-drawer` < `#ui-prompt`. Crosshair is `#crosshair` above all.

**Settings data**
- All writes go through `Game.setSetting(key, value)` -> memory, Storage (`settings.<key>`, except `audio.volume` / `audio.hitSound`), then `applySettings()`.
- Keys: sensitivity, dpi, fov (HORIZONTAL degrees, default 103; Camera converts to vertical by aspect), invertY, crosshair, volume, hitSound, graphics (low|medium|high), showWeapon, showMeta, targetColor (preset id), difficulty (easy|normal|hard|custom), targetSize, spawnSpeed, movementSpeed.
- `setDifficulty(id)` writes the preset's targetSize/spawnSpeed/movementSpeed; `custom` keeps current values.
- `game` selects the sensitivity profile (`src/ui/GameProfiles.js`); `sensitivity` is stored in that game's own scale.
- Finder-specific data lives outside `settings.*`: `sensFinder.config` (last setup: length, measured 360 distance, probe on/off, dpi, game) and `aimlabs.sensTests` (completed test history, aggregates only — see `src/utils/SensTestStore.js`). Keep it that way: writing these through `setSetting` would trigger `applySettings()` and let raw trial data into settings storage.

**Camera Look Limits (intentional design)**
- Targets always spawn at +Z in front of a back wall (z 5..13, x ±5, y 0.7..4.5). Keep new modes inside this range (the back wall has corner brackets marking it).
- `Camera` uses YXZ rotation order; `updateCameraFromMouse()` clamps through `Camera.clampRotation()`: yaw 180° total facing the wall, pitch ±82°.
- `startMode()` calls `camera.reset()`. Facing +Z means world -X is screen-right.
- Mouse deltas ACCUMULATE in `Input.mouse` (do not overwrite them; game clears them after applying).

**3D Environment (src/core/Scene.js)**
- Closed graphite room (all 4 walls, floor, ceiling) with canvas-drawn panel-seam textures (no image files), baseboards, two housed ceiling light strips at x ±7.5 (kept off top-center so they never sit behind the HUD), fog = `--bg`.
- Back wall is a PROPER visible wall: `addSurface` plane ROTATED π so its lit face points at the player (it used to face away and render black), then tinted lighter (0x323c4c) with a small emissive lift so it terminates the range instead of blending in. A skirting board pins it to the floor.
- Fake AO: `buildAmbientOcclusion()` lays gradient planes (dark edge = texture top) along every seam; `buildFloorMarkers()` 5 m / 10 m lines + labels; `buildSignage()` "AIMLABS / RANGE 01" on the left wall (+x is screen-left when facing the wall).
- `buildAccents()` adds a cyan PointLight wash + warm SpotLight on the back wall.
- In-game vignette: `body.in-game #container::after` (toggled by `setInGameUI`).
- `scene.surfaces` = room meshes, used for miss-mark raycasts.
- Renderer uses PHYSICAL light units (three r155+ decay): point/spotlights need candela-scale intensities (~40-130 at these distances; legacy values like 0.25 are invisible). Hemisphere 2.4, key 1.6, wash point 40, accents 55/130.
- If you widen target spawn ranges, keep them INSIDE the room or targets spawn outside walls.

**Targets (src/core/Target.js)**
- Shared sphere geometry, per-target material from `createTargetMaterial()`: dim albedo (0.28 x colour) for shading, emissive carries the hue, fresnel rim via `onBeforeCompile`, `toneMapped: false` so the colour stays pure. Shared program via `customProgramCacheKey`.
- `setTargetColor()` sets the colour new spawns use. Spawn settle 80%->100% over 90ms (`updateSpawn`, run by Game before `mode.update`). `setFocus()` brightens a target; `HoldTrackMode` drives emissive directly while held.
- `Game.shootAtCrosshair` refreshes live target matrices before raycasting (a target spawned this frame has a stale matrixWorld otherwise).

**FX (src/fx)**
- `Shards`: one InstancedMesh (96 shards, 12 per kill) + 4 pooled rings. `MissMarks`: 24 pooled rings placed on the wall where a miss landed. Both disabled on Low quality.
- Kill detection is mode-agnostic: Game compares `mode.hits` before/after `onClick`.
- Shot placement: `measurePlacement()` finds the closest live target angularly and logs crosshair offset in target radii (x right, y up). In-memory only (max 400), NOT saved to localStorage.

**Quality (src/core/Quality.js + Renderer)**
- Low: pixel ratio 1, no fx. Medium (default): pixel ratio <= 1.5, fx on. High: <= 2, soft shadows, bloom via vendored r159 `src/vendor/addons/postprocessing` (EffectComposer/RenderPass/UnrealBloomPass/OutputPass; imports rewritten to `three-shim.js`).
- Toggling shadows marks all materials `needsUpdate`.

**Weapon Viewmodel (src/core/Weapon.js + src/core/weapon/)**
- `weapon/PistolModel.js`: real-scale polymer pistol from bevelled side-profile extrusions (`extrudeProfile`, (u,v) = forward/up), trigger guard with a hole, serrations, ejection port, sights with lime fibre dot. Returns `{ root, slide, muzzle, port }`.
- No hands or arms: several attempts (procedural, WebXR rigged hands, MakeHuman FPS arms) were rejected by the user as looking unnatural and removed. The pistol is shown alone, bottom-right, about 60% on screen with the grip and rear cut off (`REST` / `REST_ROT` in Weapon.js).
- The gun is NOT in the range scene: `Weapon` owns `scene` + `camera` (fixed 54° vertical FOV), registered with `Renderer.setOverlay()` and drawn after the range with depth cleared (also a second RenderPass in the bloom composer). It never clips walls or stretches with player FOV. Reflections: RoomEnvironment PMREM on the gun scene only (`initEnvironment(renderer)`).
- Motion: recoil kick, slide blowback, mouse-lag sway, breathing, `equip()` raise (called in `startMode`), star muzzle flash, 6 pooled brass shells, `attachRoomLight(worldCamera)` flashes a light in the range per shot.
- Rest pose constants `REST` / `REST_ROT` at the top of Weapon.js. Vendored r159 add-ons used: `geometries/RoundedBoxGeometry.js`, `environments/RoomEnvironment.js`.

**Modes**
- Implemented/selectable: `Static`, `Flick`, `Click Track` (moved target, click it — smooth TargetMotion), `Hold Track` (hold LMB on drifting target, score = hold seconds), `Reaction`, `Cone 45`. (Old `TrackingMode.js` was replaced by `ClickTrackMode.js`/`HoldTrackMode.js`.)
- `Cone 45` (`src/modes/ConeMode.js`): 60 s pre-game warm-up. 2 concurrent small (0.20) far (9–12 m) targets, spawn only inside ±22.5° of the anchor, camera clamped to ±30° yaw / ±18° pitch for the whole drill. Scoring is Flick-style (`100 × combo`) so Stats/records work unchanged. `spawnZones.js` owns the geometry and is shared with the finder.
- `Static` (gridshot drill): 4 concurrent targets, each fades in (~220ms), holds, fades out (~700ms tail). Hit -> INSTANT pop: target leaves the live set same frame, a white scale-up pop-flash plays ~110ms (cosmetic corpse in `mode.corpses` only), replacement spawns immediately. Session is a 60s countdown (`mode.timeLeft` -> HUD "Time" row); on 0 runs `endSession`.
- `Flick`: single target with timestamped short lifetime (max(400, 1200 - spawnSpeed*200) ms), repawns on timeout or hit.
- `Click Track`: one strafing target, click it; +150 × combo per hit, respawn after hit. Movement via `TargetMotion` (see below) so speed changes are gradual; speed scales with the `movementSpeed` difficulty setting.
- `Hold Track`: hold LMB with the crosshair on a drifting target; each held second = 100 points. HUD streak meter (`trackMeter()` on the mode) shows the CURRENT continuous hold vs the session's best hold. Target glows (emissive 3.2) while held. 45s session; summary shows "Longest hold".
- `Reaction`: one ball after unknowable 0.5-3.0s delay; ball ages out after `1800 - spawnSpeed*250` ms (difficulty scales it, min 500ms). Hit -> reaction-time score (max 2000 - ms), stats track avg/best reaction. Vanish resets combo, next spawn follows. Shooting early = miss + combo reset.
- `TargetMotion` (`src/core/TargetMotion.js`): drift steering helper used by both track modes. Speed eases toward a re-rolled target every ~2s (SPEED_EASE), heading eases toward re-rolled headings and gets inward-biased steering near room margins (no instant stops/flips). Bounds: x ±4.6, y 0.9..4.2 — targets stay inside the room.
- `Input.primaryDown` tracks LMB held (document-level mousedown/up) for hold-tracking.

**Sensitivity (multi-game profiles, `src/ui/GameProfiles.js`)**
- Turn speed = `sens * profile.yaw` degrees per mouse count (`updateCameraFromMouse`). Each stored `settings.sensitivity` lives in its OWN game's scale; `settings.game` selects the profile.
- Yaw table (verified against converter docs + pro-player cm/360 data): Marvel Rivals / OW2 / CoD(MW,Warzone,BO6) / The Finals / Destiny 2 = 0.0066; CS2/Apex/TF2/Quake = 0.022; Halo Infinite = 0.0225; Valorant = 0.07; R6 Siege = 0.00572958 (default multiplier); Fortnite = 0.005555 per X-axis %. Plus `custom` = 0.0176 (the old pre-profiles constant, kept reachable).
- IMPORTANT: the old belief "MR = 0.0176 (UE5)" was WRONG — pro MR sens 4-8 at 800dpi gives 21-43 cm/360, which only fits 0.0066. MR sens transfers 1:1 to OW2/CoD/D2. Legacy saves (no `settings.game` key) are auto-converted once from the 0.0176 scale into the default profile so tuned feel is preserved.
- Settings modal: game <select> + sens slider/number. Choosing a game converts the entered value (`changeGame`), so "paste sens in game X, switch dropdown to Y" is the converter. Pasting the selected game's own value = 1:1 feel (assumes browser `movementX` px = mouse counts, true at 100% OS scale & unzoomed Chrome).
- Quick keys `[` / `]` adjust within the profile's min/max clamp. HUD shows e.g. `Sen: MR 6.67`.
- Free-cursor mode: middle click during a session exits pointer lock (normal cursor, crosshair hidden, banner hint) and freezes gameplay (updates require `input.isLocked`); clicking the canvas or middle-clicking again re-locks and resumes. `pointerlockchange` auto-pause is skipped while `input.freeCursor`; all lifecycle resets (start/pause/resume/end) clear the flag to avoid the locked-cursor dead-end trap.
- Fullscreen: `toggleFullscreen()` on Game, driven by the persistent top-right corner button `#fullscreen-btn` (usable in menus + free-cursor mode; pointer lock routes locked-session clicks to the canvas). Label syncs on `fullscreenchange` (`syncFullscreenLabel`).
- Session clock: `sessionClock.js` `tickSessionClock(mode, deltaMs)` counts `timeLeft` down and sets `finished`; `Game.animate` then calls `endSession()`. Static/Flick/Click Track/Cone 45 60s, Hold Track 45s, Reaction 30s.

**Sensitivity Finder (`src/modes/SensFinderMode.js` + `src/sensfinder/`)**
- Entry: Home rail "Sens finder" (`F`), Settings > Controls > "Find my sensitivity", or "Test again" on its result screen. `Game.openSensSetup()` shows `#sens-setup`; `Game.startSensFinder(config)` sets the game/DPI, stores `sensFinder.config` on `Game`, then `startMode('Sens Finder')`.
- Module split (agents.md file-size/atomicity rule): `SensFinderMode` is orchestration only. `sensfinder/Bearing` = angular measurement; `Aggregate` = error scores; `Bracket` = search/fit/CI; `RoundPlan` = candidates + shared sequences + block queue; `TrialRunner` = one trial's target/click/lifetime; `BuildResult` = persisted report shape; `CalibrationProbe` = input check; `ui/SensProgress` = in-session DOM; `ui/screens/SensSetup|SensResults` = overlays; `utils/SensTestStore` = history. Put new mechanics in these files rather than growing the mode.
- It is a **measurement test**, not a subjective A/B: three candidates per round, each played on the SAME seeded target sequence, scored on squared angular landing error in **target radii** (`mse = bias² + spread²`, so the minimum is real).
- Two zones in every test, all skills in both: `cone` (45°, real-world, **60% weight**, smaller/farther targets) and `wide` (targets 22–48° off-centre alternating sides, **40% weight**, mouse control). Zone scores are normalised by the round mean before weighting so the 60/40 split is honest. `src/modes/spawnZones.js` owns both zones; camera clamps are intentionally WIDER than the spawn window so overshoot past the outer target is measurable (cone ±30°/±18°, wide ±75°/±25°).
- Trial loop (`TrialRunner`): ready gap 220–450 ms → target spawn (records `originDir`) → clicks measured with `Bearing.measureShotInto` → hit resolves instantly; a miss opens a 900 ms correction window. Target lifetimes are clock-based (never `setTimeout` on pooled objects). Tracking trials are un-clicked sinusoidal arcs; `spawnZones.trackingPositionAt` samples a per-zone precomputed path into a scratch vector, and `measureTrackingInto` fills a reused object, so the per-frame tracking path allocates nothing. Each tracking trial contributes ONE mean (`along² + across²`) to `zone.track`, not one entry per frame.
- Round algorithm (`src/sensfinder/RoundPlan.js` + `Bracket.js`): `RoundPlan` builds three candidates, one seeded sequence per zone, and the rotated block queue. `Bracket` works in `ln(cm360)`: test `center/step, center, center*step`; exact parabola through the three scores → next centre = vertex; `step = max(1.03, 1 + (step-1)*0.45)`; Quick = 2 rounds, Thorough = 4. The LAST round's three points bracket the estimate and double as the final A/B; the reported value is the fitted vertex (fallback: best measured point). CI = seeded bootstrap of the vertex (`vertexInterval`).
- `BuildResult.buildSensResult` owns the record shape + confidence rules; the mode only supplies rounds/bounds/cpi/checks/saved. Do not grow the record inside the mode.
- Precision contract: **5 decimals is arithmetic precision, not experimental precision.** `bestCm360` is the exact conversion of the fitted optimum; `ci` is the honest uncertainty; the report shows both. `applySensResult` writes 6-dp sensitivity (`Math.round(v*1e6)/1e6`); the slider/HUD still display 2 dp.
- Calibration: optional measured 360 distance in setup (derives `effectiveCpi` via `effectiveCpiFromDistance`, bypassing DPI/DPR/zoom). In-session probe compares `Input.travel.x` for a slow vs fast sweep (`Input.freezeLook` keeps the view still); >6% difference flags pointer acceleration and caps confidence at Low. `checks.dpr !== 1` caps High at Medium when not pad-calibrated.
- Pause-safe by construction: `this.clock += deltaMs` in `update()`; `update()` does not run while paused/unlocked, so pauses freeze the test instead of manufacturing timeouts. `onPause/onResume` hide/show the prompt-layer progress + banner (the prompt layer is above the pause overlay).
- **Restore invariants on every exit** (normal finish, Esc→quit, restart, tab hide): original `settings.sensitivity`, `camera.maxYawOffset`, `camera.maxPitch`, `settings.showMeta`, `input.freezeLook`, `input.travel`, weapon visibility, free-cursor state, and every pooled target released + `#sens-progress`/`.sens-banner` removed. `end()` must be safe when called before `start()` (quit during arming). Quick assertion when testing: `game.camera.maxYawOffset === Math.PI / 2`.
- Mode contract additions: `resultKind: 'sens-finder'` (custom store + screen), `flushInputBeforeShot` (`Game.shootAtCrosshair` applies accumulated mouse deltas and refreshes camera matrices before the raycast so the click-time aim is measured; other modes keep the rendered state), `hideWeapon`, and optional `onPause/onResume`. `Game.endSession()` branches on `resultKind`: pushes to `SensTestStore` and shows `createSensResultsScreen` with `shotLog`, never `StatsManager`/`bestFor`.
- Mouse travel for the probe: `Input.travel` accumulates `Math.abs(movementX/Y)`; reset with `resetTravel()`. `Game.updateCameraFromMouse()` zeroes deltas and returns while `input.freezeLook`.
- Report (`SensResults.js`): 5-dp cm/360 + in/360, CI + confidence badge, counts/360, eDPI, effective CPI, error-curve canvas (tested points + fitted parabola + optimum), 45° vs Wide bars, shot map (reused `drawMissMap`), all-game conversion table, input-integrity checks, apply/undo, copy cm/in/all. History comes from `SensTestStore.summary()` (previous + median of last tests).
- Pixel/DPI caveat: `movementX` is CSS px after OS ballistics. Without a measured 360 distance the absolute cm/360 can be off by several percent (OS scale, browser zoom, pointer acceleration). This is exactly why the probe + measured-distance path exist, and why the report always shows a CI.

**Audio (src/audio/AudioManager.js)**
- Synthesised WebAudio with envelopes (no files, no 404s). Sounds: shoot, hit-tick, hit-pop, miss, click, countdown, go, complete, best. Optional recorded audio samples: list them in `SAMPLE_URLS` under `assets/sounds/` if custom audio files are desired.
- Master gain node; context resumes on first play.

**Three.js Import Architecture (src/three-shim.js)**
- Three.js is vendored locally in `src/vendor/three.module.js` and exported via `src/three-shim.js`.
- All Three.js imports throughout the codebase import from `three-shim.js` (or relative path to it), keeping the external library boundary centralized.

**Stats**
- Sessions are saved in `localStorage` via `StatsManager` key `aimlabs.sessions` (cap 500). `StatsManager.clear()` wipes them; `src/utils/records.js` = read helpers (runsFor, bestFor, lastFor, scoreHistory, summarize).
- Stats screen: per-drill tabs, records row, score trend chart with hover readout, recent-runs table, an "Aim report" button and a hold-to-clear button.
- Sessions store mode-specific detail: Static/Flick/ClickTrack score+accuracy+maxCombo; Reaction adds avgReaction/bestReaction/reactionSpread/reactionCount; Hold Track adds bestStreak + accuracy time-based (hits = seconds on target).
- **Aim Report (`src/ui/AimReport.js` + `src/utils/AimProfile.js`)**: reachable from the home rail and the Stats screen. `computeAimProfile()` reads all stored sessions → 6 axes (Precision, Reaction, Tracking, Flicking, Consistency, Control) scored 0-100 with status chips, canvas HEXAGON radar (rings at 25/50/75/100, skill polygon + labels), overall + balance scores, "Practice plan" (weakest axes with drills/targets, unplayed-mode hints, inconsistency notes typed like typing-master), and a per-mode recent trend table (▲/▼ vs previous session). Missing-data axes show "Unplayed" and score 0 (polygon uses a tiny 2% floor so unplayed axes read as holes). Reaction axis calibrations: avg reaction (450-avg)/3 bands; tracking = 60% on-target% + 40% bestStreak/6s; consistency = 100 − CV×170 across 3+ sessions of the same mode.

**Performance + Leak Prevention**
- Target object pooling is used (`Pool.acquire/release`).
- Target uses ONE shared base sphere geometry; size changes apply `mesh.scale` (clone no longer leaks geometries per spawn). Old approach disposed nothing.
- Mode switch always clears active pooled targets.
- UI animation timers are tracked and cleared on mode changes.
- Dynamic mode import is isolated in `ModeRegistry`.
- Renderer: antialias on, ACES tone mapping, PCF soft shadows (targets cast, floor/walls receive).
- Volume setting read key is `audio.volume` (AudioManager and Game both use it).

**QoL Added**
- Quick sensitivity tuning while playing:
  - `[` decreases sensitivity
  - `]` increases sensitivity
- Values are clamped and persisted.

**Crosshair Builder (src/ui/Crosshair.js)**
- Crosshair config: `{style cross|x|t|circle|square, size, thickness, gap, dot, dotSize, color, outline, rotation, opacity}` stored under `settings.crosshair`; merge with `CROSSHAIR_DEFAULTS` so old saves render fine.
- `buildCrosshairSVG(cfg)` renders inline SVG (100x100 viewBox, rotation via transform). `Game.applyCrosshair()` renders into `#crosshair` element; call it after any crosshair change.
- Settings drawer has a live preview, presets, shape/rotation/length/thickness/gap/colour/opacity/dot/outline controls, a base64 share code (sanitised on import) and Reset. Update via `updateCrosshair(patch)` (merges + persists + re-renders game crosshair + preview).

**Files to Read First**
- `src/core/Game.js` (orchestrator + phase machine), `styles/tokens.css` (design), `src/ui/screens/*`, `src/modes/*.js`.

**Dev gotchas**
- Chrome caches modules heuristically. Disable cache (DevTools or CDP `Network.setCacheDisabled`) when testing. For agent-driven runs, serve with `Cache-Control: no-store` (a ~10-line `SimpleHTTPRequestHandler` subclass) — a plain `python -m http.server` will keep serving stale modules and cost you an hour.
- Finder test harness: pointer lock fails headless. Start a shortened test from the console (`game.sensFinderConfig = { length:'quick', ..., probe:false }`; `game.startMode('Sens Finder')`; patch `game.currentMode.length` before `game.beginLive()`), fake `game.input.isLocked = true`, and drive a synthetic player in a `setInterval`. The live trial lives at `mode.runner.trial` and the target at `mode.runner.target` (the mode no longer owns them). Stubbing `game.renderer.render` for the run takes it from ~4 fps to ~60 fps because the measurement is camera math + raycasts, not pixels. Remember to `camera.updateMatrixWorld()` after setting the rotation in the harness for non-flush drills, and restore `renderer.render` afterwards.
- Headless testing: pointer lock fails headless. Drive with `window.game`: `game.startMode('Static')`, then fake lock with `game.input.isLocked = true; game.hideLockPrompt(); game.startCountdown()`. Aim by setting `game.camera.instance.rotation` (yaw = atan2(-dx,-dz), pitch = atan2(dy, horiz)), call `updateMatrixWorld()`, then `game.shootAtCrosshair()`. End a run fast with `game.currentMode.timeLeft = 0.02`.
- Headless WebGL (SwiftShader) runs ~15 fps; that is the test renderer, not the game.

**Security posture (audited)**
- Three.js core + post-processing add-ons are VENDORED (pinned r159). No third-party CDN code executes.
- `firebase.json` CSP: script/style/font all `'self'` (inline styles allowed). Do not add external font or script hosts.
- Crosshair config (localStorage and share codes) is sanitized in `mergeCrosshairConfig`. Never loosen it; that path feeds SVG markup.
- Stats/results text is built with `h()` text nodes, not innerHTML. `Storage` never throws on corrupt JSON.
- `window.game` is intentionally exposed for debugging.

**Known Gaps / Next MVP Steps**
- Micro-adjustment is now covered by `Cone 45` (warm-up) and the finder's micro shots. A dedicated long-form micro drill is still open if wanted.
- The finder uses the in-session body of the test only; passive refinement from normal drill sessions (Aimlabs/Mouselabs style) is not implemented. `SensTestStore` already keeps the history needed if that is added later.
- OS display scale / browser zoom shifts the 1:1 sensitivity mapping outside the finder too. The finder's measured 360 distance solves it for its own result; the rest of the app still treats `movementX` as raw counts.
