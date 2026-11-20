# AimLabs redesign plan

Branch: `design-updates`. Scope: every screen, the in-game HUD, and the 3D range itself.
Skills applied (from `Desktop/New folder`): redesign-existing-projects, design-taste-frontend,
impeccable, high-end-visual-design, better-colors, better-typography, better-layout,
emil-design-eng, animate, find-animation-opportunities, superfuture-design-review.

---

## 1. Design read

> Reading this as: a **redesign (overhaul)** of a browser FPS aim trainer for **competitive
> players who grind short 60s drills**, with a **precision-instrument** language
> (calm, dark, nothing moves unless it means something), leaning toward vanilla CSS tokens,
> self-hosted Geist + Geist Mono, and feedback-first motion.

**Physical scene** (impeccable rule: theme must be forced by a real scene):
a player in a dim room, eyes locked on the center of a 24-27" monitor for 60 seconds,
restarting the drill 20-40 times a session. That forces: **dark theme**, **nothing near
screen center except the crosshair**, **instant restart**, and **results that are readable
in 3 seconds** before hitting Retry.

**Dials** (design-taste-frontend): `DESIGN_VARIANCE 6 / MOTION_INTENSITY 4 / VISUAL_DENSITY 5`.
Menus can breathe; the game itself must be quiet.

References studied: Aim Lab (gridshot flow, results breakdown, miss heatmap), KovaaK's
(scenario browser, PB tracking, sens in cm/360), Valorant Range (clean HUD, hit ticks),
3D Aim Trainer / aimtrainer.io (browser constraints).

---

## 2. Audit of the current UI (what gets retired)

| Area | Problem today | Skill rule broken |
|---|---|---|
| Fonts | `Courier New` everywhere | redesign: font swap is the #1 lever |
| Colour | Pure neon cyan `#0ff` on text, borders, glows, targets, crosshair | design-taste 9.A "no neon outer glows", one accent with one meaning |
| Surfaces | Every panel is the same blurred glass card with cyan glow | impeccable ban: glassmorphism as default, ghost-card (border + wide shadow) |
| Layout | Every screen is a centered box; mode select is a row of identical buttons | anti-center bias, no structure |
| Code | Styles are inline `style.cssText` in JS, `z-index: 9999 / 10000` | redesign code-quality: no inline styles, semantic z-index scale |
| Text | Title Case labels, `Sen:` / `Acc:` abbreviations, "AimTrainer.js" title | sentence case, plain labels |
| States | No hover/focus/active states, no empty state on Stats, no countdown, no PB | full state cycles required |
| Numbers | Proportional digits on score/timer (they jitter) | better-typography #11 tabular nums |
| Motion | `transition: 0.3s` / `all` / `ease`, `scale(1.05)` hover on menu buttons | animate: never `transition: all`, strong ease-out, no hover scale on UI |
| Accessibility | No focus rings, `user-select:none` on whole body, no reduced-motion | a11y requirements |
| 3D | GridHelper floor, flat walls, cyan sphere with no shape, no hit/miss feedback in world | targets don't read as objects; misses give no info |

---

## 3. Visual system

### 3.1 Colour (OKLCH, "restrained" strategy: tinted neutrals + one accent ≤10%)

The category reflex for aim trainers is cyan neon on navy. We drop it.
Environment is **cool graphite**; the one accent is an **acid yellow-green signal** (chosen
by the user) used for exactly one meaning: *the thing you shoot / the thing you press*.
Lime is the highest-luminance hue, so targets read instantly against a dark range and
stay distinct for most colour-vision types.

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.16 0.012 250)` | page / scene clear colour |
| `--surface-1` | `oklch(0.20 0.012 250)` | panels |
| `--surface-2` | `oklch(0.24 0.012 250)` | raised controls, inputs |
| `--line` | `oklch(0.32 0.012 250)` | hairlines (used sparingly) |
| `--ink` | `oklch(0.96 0.005 250)` | primary text |
| `--ink-2` | `oklch(0.78 0.01 250)` | secondary text (≥ 4.5:1 on surface-1) |
| `--ink-3` | `oklch(0.62 0.012 250)` | captions only, never body |
| `--signal` | `oklch(0.9 0.2 122)` | targets, primary button, PB, timer < 10s |
| `--signal-ink` | `oklch(0.2 0.05 122)` | text on signal buttons |
| `--good` | `oklch(0.80 0.14 155)` | "new best", accuracy up |
| `--bad` | `oklch(0.68 0.17 25)` | miss marker, accuracy down |

Rules: no glow `box-shadow` on UI, shadows tinted to hue 250, max one filled button per view.
Target colour is user-selectable (Signal lime default, plus Cyan, Orange, Magenta, White
presets for colour-blind players). Since `--good` would collide with the lime accent,
"new best" uses the signal colour itself and `--good` is dropped. Crosshair default becomes white-with-dark-outline
(industry standard), not cyan.

### 3.2 Typography

CSP is `default-src 'self'`, so Google Fonts would be blocked. **Self-host woff2** in
`assets/fonts/`:

- **Geist** (400/500/600): all UI text
- **Geist Mono** (500): every number that changes (score, timer, accuracy, sens, FPS) with `tabular-nums`

Scale (rem): 0.75 caption · 0.875 UI · 1 body · 1.25 h3 · 1.75 h2 · 3 display · 4.5 results score.
Display tracking −0.02em, small labels +0.04em, `text-wrap: balance` on headings.
Sentence case everywhere ("Start training", not "Start Training").

### 3.3 Shape, space, layers

- Radius rule: controls 8px, panels 14px, pills only for segmented toggles. Nothing above 16px.
- Spacing scale 4/8/12/16/24/32/48/64, group gap ≥ 2× inner gap.
- z-index scale tokens: `--z-hud 10, --z-overlay 20, --z-modal 30, --z-toast 40, --z-crosshair 50`.
- Texture: one fixed, pointer-events-none 3% noise layer on menus only (never in game).

---

## 4. Screens (flow stays the same, layout changes)

```
Home ──► Mode detail ──► [click to lock] ──► 3-2-1 ──► Playing ──► Results
  │            ▲                                  │  Esc            │ R / Retry
  │            └────────────── Quit ◄── Pause ◄───┘                 │
  ├─► Settings (slide-over, reachable from Home, Pause, Results)    │
  └─► Stats (full page)  ◄─────────────────────────────────────────┘
```

### 4.1 Home (replaces centered "AimTrainer.js" box)
- The **live 3D range renders behind the menu** with a slow idle camera drift and 3 idle
  targets bobbing. The game *is* the hero; no stock imagery.
- **Left column** (max 420px, 64px inset): wordmark, then the **mode list as rows**
  (name, one-line description, your best score in mono). Not cards, not a grid.
- **Right column**: last session at a glance (score, accuracy, delta vs PB) or a composed
  empty state on first run: "No runs yet. Gridshot is a good first drill."
- Footer row: Settings, Stats, keyboard hints (`Esc` pause · `R` restart · `[ ]` sens).

### 4.2 Mode detail (replaces the "Select Mode" modal)
- Selecting a row expands a detail pane in place: what the drill trains, duration,
  a small geometric diagram of target layout, PB and last 5 runs sparkline.
- Difficulty as a **segmented control**: Easy / Normal / Hard / Custom. Custom reveals the
  existing target size / spawn speed / move speed sliders (progressive disclosure).
- One filled **Start** button (signal). Enter key starts.

### 4.3 Pre-round
- "Click to start" lock prompt, then a **3-2-1 stepped countdown** (each digit 1 frame
  swap + 150ms fade, no scaling). Targets spawn on "Go". Gives players a clean start
  and prevents the first shot being wasted on pointer-lock.

### 4.4 In-game HUD (center is sacred)
- **Top-center cluster**: timer in mono (large), score left of it, accuracy right of it.
  No panel behind it, just text with a soft dark text-shadow for legibility.
- Timer turns signal colour under 10s. Score ticks without animation (it updates 100+ times).
- Streak shown as a small mono number under the timer only when ≥ 5.
- **Bottom-right, tiny**: FPS and sens. Hidden by a setting.
- **Hit marker** replaces the 140px ring: four short diagonal ticks around the crosshair,
  80ms in, 120ms out. Kill = white ticks; miss = no ticks (the world shows it, see 5.3).
- Removed: glass HUD box, "Combo:" label wall.

### 4.5 Pause (Esc)
- Appears **instantly** (keyboard-initiated, 100+/day: animate skill says never animate).
- Scene dims with a scrim, compact centered sheet: Resume, Restart, Settings, Quit to menu.

### 4.6 Results (the one place we spend the delight budget)
- Left: big score in mono with a 600ms **number ticker**, "New best" badge in `--good` when it is one.
- Stat grid (no cards, plain aligned columns): accuracy, hits / shots, kills per second,
  best streak, avg reaction (Reaction mode), avg time-to-kill.
- Right: **miss map**: a plot of where shots landed relative to target centers (dots, hit
  vs miss), so players see if they over- or under-flick. Below it, score trend for the last
  10 runs of this mode.
- Actions: **Retry (R)** filled, Back to menu as text button. R works immediately.

### 4.7 Settings (slide-over panel from the right, not a modal)
- Tabs: Controls · Crosshair · Targets · Video · Audio.
- **Controls**: sensitivity with live **cm/360** readout (needs DPI field), FOV, invert Y.
- **Crosshair**: existing builder kept, preview now drawn on top of the real game
  backdrop + 4 presets (Classic, Dot, Circle, Small cross) + import/export code string.
- **Targets**: colour presets incl. colour-blind options.
- **Video**: quality preset (Low / Medium / High), render scale, show weapon, show FPS.
- **Audio**: master volume, hit sound (Tick / Pop / Off).
- Changes apply live; panel is scrollable, labels above inputs, every input ≥ 4.5:1.

### 4.8 Stats (full page)
- Tabs per mode, PB at the top, score trend line chart (canvas, token colours, hover readout),
  recent runs table with tabular numbers, Clear history behind a hold-to-confirm button.
- Composed empty state.

### 4.9 Small screens / misc
- Mobile can't pointer-lock: show a clear "Desktop with a mouse required" screen instead of a broken menu.
- Restyle `404.html` to match; add favicon, meta description, proper `<title>` ("AimLabs").

---

## 5. 3D range and graphics

### 5.1 Environment
- Replace GridHelper with a **matte graphite arena**: procedurally generated canvas
  textures (no image downloads) for subtle wall panel seams and a floor with soft falloff.
- Back wall gets a faint **target zone frame** so depth reads instantly.
- Lighting: hemisphere + one soft key; ceiling strips kept but neutral white, cyan strips removed.
- Fog matched to `--bg` so the room fades, never ends hard.

### 5.2 Targets
- Sphere with a **fresnel rim** (shader tweak on MeshStandardMaterial) so it reads as a
  ball, not a flat disc; emissive in the chosen target colour.
- Spawn: scale 0.7 → 1 in 90ms ease-out (never from 0). Expiring: fades as now.
- Tracking mode: target brightens while the crosshair is on it (on-target feedback).

### 5.3 Feedback in the world
- **Kill**: 10-14 pooled shards (one InstancedMesh) burst outward + a thin ring, 160ms.
- **Miss**: small dark impact mark on the wall at the ray hit point, fades over 800ms
  (pooled, max 24). Tells you *where* you missed, which is the point of training.
- Muzzle flash smaller and shorter; weapon viewmodel optional (Video setting, default on).

### 5.4 Quality presets (keeps 60-144 FPS on low-end PCs)
| Preset | Pixel ratio | Shadows | Bloom | Shards |
|---|---|---|---|---|
| Low | 1 | off | off | off |
| Medium (default) | ≤1.5 | off | off | on |
| High | ≤2 | soft | light bloom on emissives | on |

Bloom needs EffectComposer / UnrealBloomPass vendored from three r159 (same version as
the vendored core, no CDN, CSP stays intact).

---

## 6. Motion system

Tokens (from animate / emil-design-eng, not invented):
```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--dur-press: 120ms; --dur-ui: 200ms; --dur-panel: 320ms;
```

| Moment | Frequency | Motion |
|---|---|---|
| Button press | tens/run | `scale(0.97)`, 120ms ease-out |
| Hover on rows | tens/run | background tint only, 150ms, gated by `(hover: hover)` |
| Settings slide-over | occasional | `translateX(100%) → 0`, 320ms ease-drawer, exits same edge |
| Mode detail expand | occasional | opacity + 8px rise, 200ms ease-out |
| Home list first load | once | 40ms stagger, never blocks clicks |
| Results score | per run, delight | 600ms number ticker, stat rows 40ms stagger |
| Pause, restart, Esc | 100+/day | **none, instant** |
| HUD numbers | constant | **none** (tabular digits only) |

Rejected on purpose: animated backgrounds behind the HUD, hover scale on menu buttons,
pulsing "Play" button, score pop-ups near the crosshair (pull eyes off center).
Every animation has a `prefers-reduced-motion` variant (opacity only).

---

## 7. Code structure changes (no framework, same stack)

```
assets/fonts/            Geist, Geist Mono (woff2)
styles/
  tokens.css             colour, type, space, radius, z, motion tokens
  base.css               reset, body, focus rings, reduced motion
  components.css         button, segmented, slider, tabs, row, badge
  screens/home.css  hud.css  results.css  settings.css  stats.css
src/ui/
  dom.js                 tiny `el()` helper so screens build markup with classes, not cssText
  screens/Home.js ModeDetail.js Countdown.js Pause.js Results.js
  Settings.js Stats.js HUD.js (rewritten onto classes)
src/fx/
  Shards.js  MissDecals.js  PostFX.js (bloom, High only)
src/core/Quality.js      applies Low / Medium / High
```

Game logic (modes, pool, input, camera clamp, sens maths, Esc state machine) is kept as-is;
only how it is shown changes. `project kt.md` is updated at the end.

---

## 8. Build order (each phase is shippable and testable on its own)

1. **Foundation**: tokens, self-hosted fonts, base CSS, `dom.js`, z-index scale, strip inline styles.
2. **Menus**: Home with live range backdrop, mode detail + difficulty, Stats page, Settings slide-over.
3. **Game loop UI**: countdown, new HUD, hit ticks, pause sheet.
4. **Results**: ticker, PB, stat grid, miss map, trend.
5. **3D range**: arena textures, target rim shader, shards, miss decals, quality presets, bloom.
6. **Polish**: motion pass, reduced motion, focus states, contrast check, 404/favicon/meta,
   mobile gate, KT file update, screenshots of every screen.
