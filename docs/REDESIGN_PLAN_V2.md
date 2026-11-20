# AimLabs redesign plan, v2

Follows `REDESIGN_PLAN.md` (v1 shipped: tokens, screens, range, fx). v2 targets the three
things that still read as unfinished: the **gun**, the **range graphics**, and the **main menu**.
Skills applied this round: better-interface (accessibility, layout, writing, UI polish),
better-ui, design-critique, emil-design-eng, apple-ui-designer (restraint), impeccable,
high-end-visual-design.

---

## 1. Critique of v1 (Observation → Impact → Fix)

| Area | Observation | Impact | Fix in v2 |
|---|---|---|---|
| Gun | Built from ~25 plain boxes, flat materials, no reflections, stretched by the 103° FOV | Most visible object on screen during play; reads as a placeholder | New modelled pistol (bevelled extrusions, rounded parts), gloved hands, PBR + environment reflections, own viewmodel camera (fixed FOV, never stretches) |
| Gun motion | Recoil is a single kick, flash is a flat plane | Shots feel weightless | Slide blowback, shell ejection, star muzzle flash that lights the room, raise-in when a drill starts |
| Range | Flat walls, hard corners, nothing tells you distance | Looks like an empty box; no depth cues | Fake ambient occlusion in corners, floor distance markers (5 m / 10 m), housed light strips, wall signage |
| Menu hierarchy | "Train your aim." headline takes the prime spot; the detail panel floats over the range and hides it on narrow screens | The page reads like a SaaS landing page, not a game launcher | Left rail for choosing, right stage for the drill; no marketing headline |
| Menu explanation | The 3D range behind the menu is decorative (3 bobbing balls) | Wasted chance to show what a drill is | **Live drill preview**: the stage plays a ghost run of the selected drill |
| Loadout | Sensitivity only visible as tiny footer text | Players start drills with the wrong sens and blame the game | Loadout card: crosshair preview, sens, cm/360, FOV, one Edit action; nudge when sens was never set |
| Keyboard | Arrow keys only | Slower for repeat players | `1`-`4` pick a drill, `Enter` starts, `S` stats, `,` settings |
| Settings a11y | Drawer does not trap focus or restore it | Tab escapes behind the drawer | `inert` on background, focus first control, restore focus to trigger on close |

---

## 2. Gun (src/core/weapon/)

- **PistolModel.js** builds a modern polymer striker pistol:
  slide (bevelled side-profile extrusion, front chamfer, rear and front serrations,
  ejection port with visible barrel hood), frame with accessory rail and a real trigger
  guard (shape with a hole), angled grip with stippled texture, magazine baseplate,
  barrel crown with dark bore, rear notch sight + front post with lime fibre dot
  (the only accent on the gun).
- **Hands.js**: gloved right hand wrapping the grip with index finger on the trigger,
  support hand cupping it, thumbs forward; tapered forearms into sleeves with cuffs.
  Rounded segments (RoundedBoxGeometry) instead of boxes.
- Materials: nitride slide (metal 0.75, rough 0.38), polymer frame (rough 0.7), steel
  barrel, glove fabric. Reflections from a **RoomEnvironment** PMREM map, applied only
  to the gun so the range lighting is unchanged.
- **Viewmodel pass**: the gun lives in its own scene + camera (55° vertical FOV) and is
  drawn after the range with depth cleared. It never clips into walls and never warps
  with the player's FOV. Works with the bloom composer too.
- Motion: slide blowback 70 ms, recoil kick with ease-back, inertia sway from mouse
  movement, breathing idle, 6 pooled brass casings ejected right with spin + gravity,
  4-point star muzzle flash (canvas texture, additive, random roll) and a 40 ms room
  light flash, 380 ms raise-in when a drill starts.

## 3. Range (src/core/Scene.js)

- Fake ambient occlusion: gradient strips along every wall/floor seam and the ceiling edge.
- Floor distance markers at 5 m and 10 m (painted line + label), dim ink.
- Light strips get a dark housing; High preset blooms them.
- Wall signage: large low-contrast "AIMLABS" + "RANGE 01" painted on the left wall.
- In-game vignette (CSS, outer edges only, center untouched).

## 4. Main menu (src/ui/screens/Home.js)

```
┌───────────────┬──────────────────────────────────────────────┐
│ ◎ AimLabs     │                                              │
│               │         live ghost run of the drill          │
│ Drills        │          (stage, camera offset right)        │
│ [◦◦] Gridshot │                                              │
│ [ ↗] Flick    │                                              │
│ [ ~] Tracking │ ┌──────────────────────────────────────────┐ │
│ [ ◔] Reaction │ │ Gridshot                Best   Last  Runs│ │
│               │ │ description, facts      Difficulty [E N H C]│
│ Loadout       │ │                         [  Start  Enter ]│ │
│ ✛ 2.50 · 26cm │ └──────────────────────────────────────────┘ │
│ Stats Settings│                                              │
└───────────────┴──────────────────────────────────────────────┘
```

- Rail: solid panel, brand, drill rows (diagram tile, name, one-line sub, best), loadout
  card, Stats/Settings. Rows show their number key on hover/focus.
- Stage: `camera.setViewOffset` shifts the 3D view so the target zone is centred in the
  free area. The ghost run (`MenuPreview`) replays the drill: Gridshot pops targets in
  sequence, Flick snaps between single targets, Tracking glides, Reaction waits then pops.
- Drill card: title, description, facts, records (Best / Last / Runs / Avg accuracy +
  sparkline), difficulty, Start. Switching drills crossfades the card (150 ms).
- Empty states point forward ("No runs yet. Start one to set a record.").
- Narrow screens (< 980 px): rail and card stack in one scrolling column; the stage stays
  behind as a dimmed backdrop.

## 5. Done when

- Gun reads as a real pistol at 1440 and 1024, at FOV 90 and 120, in Low and High.
- Menu: every drill switch updates card + ghost run; keyboard path covers everything;
  focus visible everywhere; nothing overlaps at 1024 x 700.
- No console errors in a full scripted run of all four drills.
