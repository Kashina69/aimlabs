# AGENTS.MD — Development & Collaboration Guide for AI Agents

Welcome to the **AimLabs (Web 3D Aim Trainer)** project.
This document serves as the primary operational directive for all AI agents and contributors working on this codebase. Follow the principles, conventions, and workflows outlined below to keep this project clean, maintainable, performant, and self-documenting.

---

## 1. Prime Directive: Code Readability & "Plain English" Architecture

Write code that reads like a clear, high-level story. A developer or another AI agent should be able to scan high-level orchestration logic (loops, conditionals, state transitions) and immediately grasp the entire gameplay flow without having to dive into complex math or rendering minutiae.

### A. The "Plain English" Rule (Self-Descriptive Flow)
- High-level functions must orchestrate operations using descriptive, domain-specific verbs:
  - Good: `spawnTargetAtRandomPosition()`, `applyPopAnimation(target)`, `recordHitMetric(timestamp)`, `evaluateDifficultyScaling()`.
  - Bad: `run()`, `process()`, `handleData()`, `doUpdate()`.
- Keep orchestration functions concise and declarative:
  ```javascript
  // Orchestration reads like a diagram/script:
  function handlePlayerShot(crosshairRay) {
    const hitTarget = findClosestTargetUnderCrosshair(crosshairRay);
    if (!hitTarget) {
      registerMissAtCrosshair(crosshairRay);
      playMissFeedback();
      return;
    }

    registerHitOnTarget(hitTarget);
    triggerKillFeedback(hitTarget);
    replaceTargetWithCooldown(hitTarget);
    updatePlayerSessionStats();
  }
  ```

### B. Functional Abstraction (Decouple *What* from *How*)
- You do **not** need heavy object-oriented inheritance hierarchies to achieve abstraction. Favor pure functions, modular utility helpers, and small composable modules.
- The caller should understand **what result is produced in the grand scheme of things**, while the inner implementation details (Three.js vector math, matrix transformations, audio nodes, canvas scaling) remain encapsulated inside focused helper functions.

### C. Standard Top-Line Docstring Format (What, Why, How)
Every substantial function or exported module must start with a concise **What / Why / How** comment block. This prevents agents and humans from having to read the entire body just to understand its intent:

```javascript
/**
 * What: Spawns a new target inside the player's primary 45-degree field of view.
 * Why:  Forces players to practice tight micro-flicks and warm-up corrections
 *       rather than wide 180-degree blind flicks.
 * How:  Calculates a random polar coordinate offset clamped to the cone bounding
 *       box, retrieves an inactive target from the pool, and initiates spawn scaling.
 */
export function spawnConeTarget(pool, scene, bounds) {
  // ...
}
```

---

## 2. Chunking, Atomicity & File Organization

Avoid monolithic files. Split code into modular chunks, single-responsibility files, and clear subfolders.

1. **Atomicity**: Each file must own **one** distinct responsibility (e.g., sound playback, HUD updates, a specific training mode, mathematical projections).
2. **File Size**: Aim to keep functional modules under 250–350 lines. When a file grows beyond that, evaluate whether it contains mixed concerns (e.g., rendering logic mixed with scoring rules, or UI rendering mixed with data persistence) and extract sub-modules.
3. **Directory Structure**:
   - `src/core/`: Scene graph, camera, input, weapons, object pooling, rendering pipeline.
   - `src/modes/`: Individual training modes (`StaticMode`, `FlickMode`, etc.). Each mode inherits the standard drill lifecycle contract (`start`, `update`, `onClick`, `teardown`).
   - `src/ui/`: DOM components, HUD, modals, screens, and settings drawers. Keep UI generation cleanly separated from game math.
   - `src/audio/`: WebAudio sound synthesizers and volume management.
   - `src/utils/`: Pure utility helpers, math calculations, local storage, statistical formulas.
   - `src/fx/`: Visual feedback, hit shards, miss marks, and menu previews.

---

## 3. Strict Performance & Gameplay Constraints

Because this is a competitive browser-based aim trainer targeting 60–144+ FPS:
1. **Zero Garbage Collection in the Main Loop**:
   - Never instantiate objects, arrays, or Three.js vectors (`new THREE.Vector3()`, `new THREE.Raycaster()`) inside per-frame `animate()` loops or hot event paths (`mousemove`, `render`).
   - Reuse pre-allocated scratch objects, module-level singletons, and object pools (`Pool.js`).
2. **Timestamp-Based Lifetimes**:
   - **Never** use `setTimeout` or `setInterval` for pooled game objects (e.g., target lifetimes, particle expirations).
   - Use frame timestamps (`spawnedAt + lifeMs`) checked inside `mode.update(dt)`. Releasing pooled objects via stale timeouts causes critical reuse bugs.
3. **Raycast Active Pool Targets Only**:
   - Always raycast against active targets (`pool.active`), never the free stack or raw scene children.
4. **Vanilla First**:
   - Do not introduce heavy dependencies, state libraries, or front-end frameworks (React, Vue, Tailwind, etc.). Stick to lightweight vanilla JS, CSS tokens, and Three.js.
5. **Development & Environment Constraints**:
   - The project strictly uses standard ES modules. Running directly via `file://` protocol causes CORS / module blocking in modern browsers; always serve via a local HTTP server (`python3 -m http.server 8001`).
   - All modules must be explicitly imported with `.js` extensions.
   - When creating or adding new modes:
     1. Add the mode file under `src/modes/` implementing the standard mode lifecycle (`start()`, `update(dt)`, `onClick(hitTarget)`, `teardown()`).
     2. Register the mode in `src/core/ModeRegistry.js` and add its metadata to `src/modes/catalog.js`.

---

## 4. Knowledge Transfer (`project kt.md`) Maintenance Rule

**Mandatory for every AI Agent:**
Whenever you:
1. Complete, add, or alter a game mode, feature, or mechanic,
2. Modify the application state machine, data schemas, or game loop flow,
3. Discover or fix a subtle bug (e.g., pointer lock quirks, camera limits, audio context policies, pool recycling),
4. Change styling tokens or file architectures,

👉 **You MUST immediately document it in `project kt.md`.**

### Purpose of `project kt.md`:
`project kt.md` is the shared memory bank for AI agents across sessions. It condenses the full project context so future agents can consume minimal tokens while maintaining complete architectural awareness. Keeping it accurate, updated, and concise prevents recurring bugs and eliminates redundant exploration turns.

---

## 5. Verification Checklist Before Finishing Any Task

Before marking any task complete, every agent must verify:
- [ ] **No regressions**: Opening `index.html` (or running `python3 -m http.server 8001`) works without console errors or missing imports.
- [ ] **No broken imports**: All imports use explicit relative paths with extensions (`.js`).
- [ ] **Code reads like plain English**: High-level loops and functions are self-describing; inner complexities are abstracted behind well-named verbs.
- [ ] **Top-line docstrings added**: Every new or altered function has a clear **What / Why / How** summary.
- [ ] **`project kt.md` updated**: Architectural notes or changes are recorded.
- [ ] **`requirement.txt` updated**: If requirements were addressed or completed, update their status indicator (`[✓]`, `[~]`, `[✗]`).
