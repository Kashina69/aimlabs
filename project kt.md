**Project Summary**  
- Purpose: lightweight browser Aim Trainer (Three.js, ES modules). Minimal, performance-focused, extensible modes and settings.

**How to run**  
- Serve project root and open browser:
```bash
cd learning/project/aimsight/learning/project/aimlabs
python3 -m http.server 8001
# open http://localhost:8001
```

**High-level architecture (one line)**  
- Single-page ES module app: rendering layer → input layer → scene/mode logic → UI layer → Storage/Stats.

**Code flow (startup → frame)**  
- index.html loads main.js → constructs `Game` (`src/core/Game.js`) → `Game.init()` builds `Renderer`, `Input`, `Scene`, `Pool`, `AudioManager`, HUD/Menu, then starts `animate()` → each frame: read `Input.mouse`, update `Camera`, call `currentMode.update()`, render scene, update HUD.

**Key files (what to open first)**  
- src/core/Game.js — central coordinator, mode switching, input handling, shooting, UI glue.  
- src/core/Renderer.js — creates canvas and Three renderer.  
- src/core/Input.js — pointer lock, mouse deltas, key state.  
- src/core/Pool.js — object pooling; use `Pool.acquire()` / `Pool.release()`.  
- src/core/Target.js — target mesh + lifecycle.  
- src/modes/*.js — mode implementations (FlickMode, TrackingMode, ReactionMode, StaticMode, etc.).  
- src/audio/AudioManager.js — WebAudio fallback (Howler commented guidance).  
- src/ui/*.js — Menu, HUD, Settings, Stats UI.  
- src/three-shim.js — central Three.js import point (switch CDN/local here).  
- src/utils/Storage.js — LocalStorage wrapper used across code.  
- style.css — UI and HUD styling.  
- README.md — run notes.

**Design & choices (why things are arranged)**  
- ES modules: easy dynamic imports for modes.  
- `three-shim.js`: single place to swap CDN vs local Three.  
- Object pooling (`Pool`) to avoid GC spikes for many targets.  
- WebAudio fallback for zero-dependency audio; Howler optional.  
- Lightweight DOM UI (no heavy frameworks) so UI runs in low-end browsers.

**Extending / Fixing a mode (steps)**  
1. Add `src/modes/MyMode.js` (export class MyMode { constructor(game){...} start()/update()/onClick()/end() }).  
2. Register in `showModeSelect()` in `src/core/Game.js` (use dynamic import for lazy load).  
3. Use `this.game.pool.acquire(pos,size,health)` and call `this.game.pool.release(obj)` when finished.  
4. Ensure `end()` releases any owned targets and the `Game.clearActiveTargets()` is used on mode switch.

**Pooling & memory rules**  
- Always call `pool.release(obj)` after `obj.deactivate()`; `Pool.active` tracks in-use objects.  
- On mode switch `Game.clearActiveTargets()` is called; if adding persistent objects, ensure they are removed from scene and released.

**Input, pointer lock, camera**  
- `Renderer.canvas` is focusable; `Input` binds pointer lock to this canvas.  
- Camera rotation uses `game.settings.sensitivity` and `game.settings.invertY` (applied in `Game.animate()`); mouse deltas are reset after application to prevent drift.

**Audio & assets**  
- `AudioManager` uses WebAudio beeps; comment shows how to switch to Howler and `assets/sounds/`. To add real sounds, add WAVs in `assets/sounds/` and update AudioManager (example in file).

**Settings & persistence**  
- `Storage` wrapper stores settings and stats under keys like `settings.*` and `audio.*`. Update Settings UI in src/ui/Settings.js.

**Stats & sessions (what’s implemented & how to extend)**  
- Basic session counters live per mode (hits, shots, score). Implemented per-mode `end()` returns summary.  
- To add persistent sessions: extend `src/ui/Stats.js` and create `StatsManager` that stores session arrays in `Storage` (timestamp, mode, duration, score, accuracy, reaction times). For charts, plug any lightweight chart library and feed it session arrays.

**Modals / ESC / UI behavior**  
- Menu/modals are DOM elements appended to `#ui-root`. `Game` handles ESC to call `pause()`; ensure new submenus call `el.remove()` and register Escape handlers if nested. Use `menu.hide()` + `Game.clearActiveTargets()` on mode change.

**Common bugs & quick fixes**  
- Leftover targets after mode switch: ensure `mode.end()` releases targets and `Game.clearActiveTargets()` is invoked before starting a new mode.  
- Hits not registering: confirm `raycaster.intersectObjects()` is using `pool.objects.map(t => t.mesh)` and that `mesh.visible` is set for active targets.  
- Pointer lock fails: must be triggered by user gesture; ensure `startMode()` is called from a click and `renderer.canvas.requestPointerLock()` is used.

**Performance tips**  
- Use `Pool` and release objects promptly.  
- For many targets, switch to `InstancedMesh` in `Target` and update instance matrices.  
- Limit renderer pixel ratio: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`.

**Where to start to fix a one-line bug**  
- Identify feature: open corresponding mode in `src/modes/`.  
- Reproduce: run server and check console logs.  
- Fix pattern: update mode to `release` targets, use `Pool.release()`, and ensure UI removal.  
- Run: refresh page, re-enter mode, check for leftover meshes and console errors.

**Recent Updates (automated by assistant)**
- **Menu & Modes:** Robust dynamic mode loading added; `Grid` and `Strafing` removed from the selectable menu per request. (See `src/core/Game.js` changes.)
- **Mode safety:** All modes audited and updated to clear pending timers and release pooled targets on `end()` to avoid leftover objects (Flick, Reaction, Static, Grid, Strafing, Tracking). See `src/modes/` for edits.
- **Pooling & Target:** `Target` now sets `mesh.userData.target` for reliable raycast mapping; `Pool` usage audited. (`src/core/Target.js`, `src/core/Pool.js`)
- **UI:** Added a visible gun sprite and muzzle/hit animations; hitmarker now uses class-based animations for hit/miss. (`style.css`, `src/core/Game.js`, `src/ui/Menu.js`)
- **Audio:** `AudioManager` now attempts to load optional local WAVs at `assets/sounds/shoot.wav` and `assets/sounds/hit.wav` and falls back to WebAudio-generated tones if missing. To use real sounds, add WAVs to `assets/sounds/`.
- **Difficulty controls:** Spawn speed, movement speed and target size sliders persist to settings and are used by modes. (`src/core/Game.js`)
- **Stats:** Added `StatsManager` and improved `StatsUI` with session list and lightweight chart. (`src/utils/StatsManager.js`, `src/ui/Stats.js`)
- **Modal/ESC handling:** Modal stack handling improved; `Esc` closes top modal or pauses game; page visibility auto-pauses the game.
 - **Precise numeric controls:** All sliders in the Settings and Mode difficulty panels now have adjacent editable numeric inputs allowing decimal values (bidirectionally synced with sliders). (`src/ui/Settings.js`, `src/core/Game.js`)

**Manual next steps for other devs/AI agents**
- To add real audio: place `shoot.wav` and `hit.wav` in `assets/sounds/` (or update `AudioManager._loadSample` paths) and refresh the page.
- To fully delete unused modes: remove `src/modes/GridMode.js` and `src/modes/StrafingMode.js` if you want them gone entirely (they are currently hidden from menu only).
 - Unused mode files deleted: `src/modes/GridMode.js` and `src/modes/StrafingMode.js` have been removed from the repo per request.
- To test pointer-lock manually: open the page in a browser and click `Start Training` → select a mode and click the canvas to request pointer lock; automated tests can't fully simulate user gesture for pointer lock.

**Commands used for quick smoke test**
```bash
cd learning/project/aimsight/learning/project/aimlabs
python3 -m http.server 8001
# open http://localhost:8001 in a browser
```

If you want, I can now: run a full automated audit that searches for any remaining setTimeout usages, remove the unused mode files, and add placeholder WAV assets (you must approve downloading CC0 samples or provide URLs). 

