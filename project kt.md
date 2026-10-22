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
6. CRITICAL FIX (Flick blink): NEVER schedule setTimeout lifetimes on pooled targets — the pool hands the SAME instance to the next target, and a stale timer later fires `if (t.active) release` against the NEW target (the "ball appears 0.1s, vanishes, respawns" cycle after ~2 shots). Target lifetimes must be timestamp-based: `spawnedAt` + `lifeMs` reaped in the mode's `update()` (StaticMode pattern), and instant kill on hit. FlickMode was rewritten this way.

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
- Back wall is now a PROPER visible wall: lighter material (0x323c4c) + base emissive lift, plane ROTATED π so its lit face points at the player (it used to face away and render as a black plane), skirting board at the floor line, faint vertical panel seams, warm glow SpotLight + cyan PointLight from buildAccents. Old neon framing strips are gone — don't reintroduce floating accent lines in front of the wall.
- Renderer uses PHYSICAL light units (three r155+ decay): point/spotlights need candela-scale intensities (~50-130 at these distances; legacy values like 0.25 are invisible). Fog matches bg color 0x10151d.
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
- Implemented/selectable: `Static`, `Flick`, `Click Track` (moved target, click it — smooth TargetMotion), `Hold Track` (hold LMB on drifting target, score = hold seconds), `Reaction`. (Old `TrackingMode.js` was replaced by `ClickTrackMode.js` both renamed /rewritten.)
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
- Sessions are saved in `localStorage` via `StatsManager` key `aimlabs.sessions` (cap 500). `StatsManager.clear()` wipes them.
- Stats modal: per-mode filter `<select>` ("All modes" + every stored mode), rows/chart filtered by it, two-step "Clear stats" confirm button, and an "Aim Report" shortcut.
- Sessions store mode-specific detail: Static/Flick/ClickTrack score+accuracy+maxCombo; Reaction adds avgReaction/bestReaction/reactionSpread/reactionCount; Hold Track adds bestStreak + accuracy time-based (hits = seconds on target).
- **Aim Report (`src/ui/AimReport.js` + `src/utils/AimProfile.js`)**: adds an "Aim Report" menu button (also in Stats modal). `computeAimProfile()` reads all stored sessions → 6 axes (Precision, Reaction, Tracking, Flicking, Consistency, Control) scored 0-100 with status chips, canvas HEXAGON radar (rings at 25/50/75/100, skill polygon + labels), overall + balance scores, "Practice plan" (weakest axes with drills/targets, unplayed-mode hints, inconsistency notes typed like typing-master), and a per-mode recent trend table (▲/▼ vs previous session). Missing-data axes show "Unplayed" and score 0 (polygon uses a tiny 2% floor so unplayed axes read as holes). Reaction axis calibrations: avg reaction (450-avg)/3 bands; tracking = 60% on-target% + 40% bestStreak/6s; consistency = 100 − CV×170 across 3+ sessions of the same mode.

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

**Security posture (audited)**
- Three.js is VENDORED at `src/vendor/three.module.js` (pinned r159) via `src/three-shim.js` — no third-party CDN code executes. Upgrade = replace the vendored file deliberately.
- `firebase.json` sends security headers on hosting: CSP (script-src 'self'; inline styles required by the UI), nosniff, no-referrer, frame-ancestors/DENY, permissions lockout. Header set is validated locally by the scratchpad no-cache server (mirrors the same headers).
- Crosshair config (round-trips localStorage) is sanitized in `mergeCrosshairConfig`: style whitelist, 6-digit hex color, numeric clamps. Never loosen it — that path feeds SVG markup.
- Stats rows are built with DOM APIs (textContent), not innerHTML; layouts accept only object-shaped sessions.
- `Storage` never throws on corrupt JSON (drops the key, uses fallback). Secrets: none in repo; workflow uses GitHub secrets only.
- Dev affordance: `window.game` global intentionally exposed for debugging — remove for releases if paranoid.

**Known Gaps / Next MVP Steps**
- Add session duration limit with summary modal for other modes too (Static has it; Flick/Tracking/Reaction are endless).
- Add one more focused mode (micro-adjustment).
- OS display scale / browser zoom shifts sensitivity from the MR 1:1 mapping; consider a calibration option or documenting it in settings UI.
