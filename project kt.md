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
1. `Game.init()` binds global events, creates HUD on persistent UI layer, shows main menu.
2. `showModeSelect()` renders mode buttons + difficulty controls (target size/spawn speed/move speed).
3. `startMode()` safely ends old mode, saves session stats, clears pooled targets, starts new mode.
4. `animate()` updates FPS -> camera look -> mode update -> HUD update -> renderer draw.
5. `shootAtCrosshair()` raycasts visible target meshes and routes hit/miss to current mode.

**UI/State Model**
- `#ui-root` has two layers:
  - `persistentLayer`: gun sprite, muzzle flash, hit marker, HUD.
  - `overlayLayer`: menu/settings/stats/mode picker.
- Previous bug fixed: we no longer wipe `uiRoot.innerHTML` during flow changes.
- ESC behavior:
  - close overlay if open
  - otherwise pause if in match

**Modes**
- Implemented/selectable: `Static`, `Flick`, `Tracking`, `Reaction`.
- Tracking mode bug fixed: now respawns a target after each hit (continuous loop).
- Reaction mode safety fixed: clears stale target reference after release.

**Stats**
- Sessions are saved in `localStorage` via `StatsManager` key `aimlabs.sessions`.
- Saved fields: mode, start/end, score, accuracy/hits/shots/etc. (mode dependent).
- Stats modal shows list + lightweight canvas line chart.

**Performance + Leak Prevention**
- Target object pooling is used (`Pool.acquire/release`).
- Mode switch always clears active pooled targets.
- UI animation timers are tracked and cleared on mode changes.
- Dynamic mode import is isolated in `ModeRegistry`.

**QoL Added**
- Quick sensitivity tuning while playing:
  - `[` decreases sensitivity
  - `]` increases sensitivity
- Values are clamped and persisted.

**Files to Read First**
- `src/core/Game.js` (main orchestrator)
- `src/core/ModeRegistry.js` (mode loading)
- `src/ui/OverlayManager.js` (modal lifecycle)
- `src/modes/*.js` (gameplay rules)

**Known Gaps / Next MVP Steps**
- Add session duration limit with summary modal (currently endless until manual pause/restart).
- Add one more focused mode (micro-adjustment).
- Optional: move target geometry recreation to scale-based reuse to reduce allocations further.
