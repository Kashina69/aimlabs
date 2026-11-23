# Developer Taste & Quality Preferences

These guidelines represent core development habits, UI/UX principles, and game design standards established for this project.

### 1. Game Feel & Interaction Standards
- **Instant Interaction Feedback**: Gameplay interactions must resolve in the exact same frame. On click, hit targets must be removed from the live set immediately; cosmetic flourishes (shards, pop-flash) should be fast (~100ms) rather than lingering. Slow feedback in an aim trainer reads as input lag or a hit-registration bug.
- **Smooth Eased Motion**: Anything that moves in this game must ease, never snap or flip instantly. For tracking targets, both speed and heading ease toward re-rolled targets over seconds (see `TargetMotion`), avoiding abrupt stops or jarring direction reversals.
- **Continuous Streak & Progress Feedback**: Real-time feedback should compare current streaks against session records (e.g. current continuous hold vs. session best hold meter in Hold Track; trend indicators vs. previous session).
- **Discernible Visual Changes**: Visual/scene adjustments must be clearly discernible to the human eye, not just technically tweaked in code. Use noticeable contrast, distinct color values, and physical framing anchors (e.g. skirting boards, seams, lighting contrast) so changes are immediately visible.

### 2. UI, State & Navigation Principles
- **No Dead-End UI States**: Closing any modal (via Escape or Close button) must land somewhere usable. When idle, return to the main menu. When a session is active, Escape must toggle pause/resume like a standard FPS.
- **Strict Pointer-Lock Gating**: Pointer lock must only be enabled during active gameplay sessions. Never allow a locked cursor when a menu, modal, or drawer is open (avoiding the trapped-cursor dead-end).
- **Single Canonical Control**: Prefer a single, always-visible canonical control over redundant per-surface duplicates (e.g. persistent fullscreen toggle in the corner rather than scattered buttons).
- **Clean Feature Stripping**: When removing a setting or feature, strip it completely rather than leaving dead code behind: remove the UI input, the storage keys, dependent readouts/calculations, and unused helper functions.

### 3. Engineering & Bug Prevention
- **Pooled Objects Never Hold Timers**: Pooled/recycled instances must never carry pending timeouts or delayed callbacks across reuse (which causes phantom kills when the recycled instance is re-spawned). Always use clock/timestamp-based lifetimes (`spawnedAt + lifeMs`) evaluated inside the frame update loop.
- **Three.js Physical Light Units**: Three.js r155+ uses physical light units (candela falloff). Point and spot lights require candela-scale intensities (~50–130 at room distances). Also remember that `PlaneGeometry` faces +Z by default; back walls must be rotated π so the lit face faces the camera.
- **Stale Browser Caching Awareness**: When live in-browser testing contradicts freshly edited code, check for aggressive browser caching first (especially with ES modules) before modifying logic further.

### 4. Git & Workflow Standards
- **Two-Way Integration for Merges**: When resolving merges, integrate both feature sets by understanding what each branch intended rather than blindly discarding one side.
- **Repo Hygiene & Safety**: Never track local tool state, secrets, or temporary logs. Verify branch equality before destructive git operations.
- **Small Purpose-Scoped Commits, Code First**: When work is ready to commit, stage and commit the code files (`.js`, `.css`, `.html`) first and split them into several separate commits grouped by what each file does / which change it delivers — not one giant commit. Docs and unrelated working-tree changes stay out unless explicitly asked. Confidence: 0.75
- **End-to-End Verification Checkpoints**: At session checkpoints, audit git status/diff, syntax-check touched files, verify live functionality, and clean up any temporary artifacts.
