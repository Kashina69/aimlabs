**Project Summary**
- Minimal browser Aim Trainer (Three.js + vanilla JS), tuned for simple flow, low overhead, and easy maintenance.

**Run**
```bash
cd learning/project/aimlabs
python3 -m http.server 8001
# open http://localhost:8001
```

**Architecture (current)**
- `main.js` -> `Game.init()`
- `Game` owns core systems: renderer, scene, input, audio, pool, mode lifecycle, HUD, overlays.
- `OverlayManager` owns exactly one modal/overlay at a time (menu, settings, stats, mode picker).
- `ModeRegistry` lazy-loads selectable modes so mode import failures do not break the menu.

**Important Code Flow**
1. `Game.init()` binds global events, creates HUD on persistent UI layer (initially hidden), shows main menu.
2. `showModeSelect()` renders mode buttons + difficulty controls (target size/spawn speed/move speed).
3. `startMode()` safely ends old mode, saves session stats, clears pooled targets, resets camera facing, starts new mode.
4. `animate()` computes dt -> weapon recoil/sway update -> FPS -> camera look -> mode update -> HUD update -> renderer draw.
5. `shootAtCrosshair()` raycasts ACTIVE pooled targets and routes hit/miss to current mode.
   CRITICAL FIX: raycast over `pool.active` (always re-derive), never `pool.objects` — that array is the free stack, so active targets are not in it. Filtering alive `mesh.userData.target` keeps killed pop-corpses unhittable.

**Camera Look Limits (intentional design)**
- Targets always spawn at +Z in front of a back wall (z 5..13, x ±5, y 0.7..4.5). Keep new modes inside this range.
- `Camera` uses YXZ rotation order; `updateCameraFromMouse()` clamps through `Camera.clampRotation()`:
  - Yaw: 180 degrees total facing the target wall (90 deg each side of +Z).
  - Pitch: ±82 degrees (~164 total) so you can never stare straight at floor or ceiling.
- `startMode()` calls `camera.reset()` so every session begins center-facing the target wall.
- Mouse deltas ACCUMULATE in `Input.mouse` (do not overwrite them; game clears them after applying).
- invertY only flips pitch axis. Default (non-inverted) = moving mouse down looks down.

**3D Environment (src/core/Scene.js)**
- Enclosed room: floor, two side walls, back wall at z=14.5, CEILING at y=9 with warm emissive light panels + soft point glows.
- Neon cyan strips frame the back wall; cyan point glow near wall. Fog matches bg color 0x10151d.
- If you widen target spawn ranges, keep them INSIDE the room or targets spawn outside walls.

**Weapon Viewmodel (src/core/Weapon.js)**
- Pistol + two-handed stance built from boxes/cylinders, attached to the camera (camera must be added to the scene for it to render — done in Game constructor).
- `weapon.shoot()` drives recoil kick + muzzle flash (point light + additive plane); `weapon.sway(dx,dy)` feeds raw mouse movement.
- Has its own small fill light so gunmetal stays readable in the dark room.
- The old CSS gun/muzzle DOM elements were removed; do not recreate them.

**UI/State Model**
- `#ui-root` has two layers:
  - `persistentLayer`: hit marker, HUD (both toggled by `Game.setInGameUI`).
  - `overlayLayer`: menu/settings/stats/mode picker.
- `#ui-root` is `pointer-events:none` — critical: it previously swallowed ALL canvas clicks. Overlay popups re-enable pointer events themselves (`.glass` inside `#ui-overlay`).
- HUD + crosshair hide while any menu is open (`setInGameUI`); DO NOT toggle them individually.
- DO NOT wipe `uiRoot.innerHTML` during flow changes (past bug); toggle state instead.
- ESC behavior is now the full state machine described in "Session lifecycle".

**Modes**
- Implemented/selectable: `Static`, `Flick`, `Reaction`, `Tracking`.
- `Static` (gridshot drill): 4 concurrent targets, each fades in (~220ms), holds, fades out (~700ms tail). Hit -> INSTANT pop: target leaves the live set same frame, a white scale-up pop-flash plays ~110ms (cosmetic corpse in `mode.corpses` only), replacement spawns immediately. Session is a 60s countdown (`mode.timeLeft` -> HUD "Time" row); on 0 runs `endSession`.
- `Reaction`: one ball after unknowable 0.5-3.0s delay; ball ages out after `1800 - spawnSpeed*250` ms (difficulty scales it, min 500ms). Hit -> reaction-time score (max 2000 - ms), stats track avg/best reaction. Vanish resets combo, next spawn follows. Shooting early = miss + combo reset.
- Tracking mode bug fixed: now respawns a target after each hit (continuous loop).
- Reaction mode safety fixed: clears stale target reference after release.

**Sensitivity (Marvel Rivals scale)**
- `Game.updateCameraFromMouse` uses `sens * 0.0176 degrees per count` (Marvel Rivals/UE5 yaw constant, 0.8x Source's 0.022).
- Pasting an exact Marvel Rivals sensitivity gives 1:1 turn speed; assumes browser `movementX` px = mouse counts (true at 100% OS scale & unzoomed Chrome; OS DPI scaling/zoom shifts it).
- Quick keys `[` / `]` adjust the same value.

**Session lifecycle (new)**
- A mode may set `this.finished = true`; `animate()` then calls `Game.endSession()`:
  saves stats, clears targets/UI timers, unlocks pointer, shows a results modal (score/accuracy/combo/avg reaction + Retry + Main Menu).
- `Game.closeOverlayToMenu()` must be used by every modal close path (Settings/Stats buttons, Escape) so the user ALWAYS lands on a menu, never an empty screen.
- Escape state machine (`handleGlobalKeydown`):
  - pause menu open + active session -> resume
  - other modal open -> close, return to menu if idle
  - running -> pause
  - idle -> open settings
- `Input.lockEnabled` gates pointer lock: pointer can only lock while a session runs (prevents locked-cursor-dead-menu trap).
- Losing pointer lock mid-session auto-pauses (browser often swallows the Esc keydown).

**Stats**
- Sessions are saved in `localStorage` via `StatsManager` key `aimlabs.sessions`.
- Saved fields: mode, start/end, score, accuracy/hits/shots/etc. (mode dependent).
- Stats modal shows list + lightweight canvas line chart.

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
- Settings modal has a live preview (checker box) + shape/rotation/length/thickness/gap/color/opacity/dot/outline controls + Reset button. Update via `updateCrosshair(patch)` (merges + persists + re-renders game crosshair + preview).

**Files to Read First**
- `src/core/Game.js` (main orchestrator)
- `src/core/ModeRegistry.js` (mode loading)
- `src/ui/OverlayManager.js` (modal lifecycle)
- `src/modes/*.js` (gameplay rules)

**Dev gotchas**
- Chrome caches JS modules with heuristic TTL (~10% of file age). Restart with a no-store server or bust URLs, or you may test stale code that MATCHES nothing on disk.
- Headless screenshots: `agent-browser` with `AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`. Pointer lock fails headless; use `window.game` evals to drive state.

**Known Gaps / Next MVP Steps**
- Add session duration limit with summary modal for other modes too (Static has it; Flick/Tracking/Reaction are endless).
- Add one more focused mode (micro-adjustment).
- OS display scale / browser zoom shifts sensitivity from the MR 1:1 mapping; consider a calibration option or documenting it in settings UI.
