# SLING. — Session Index
**READ THIS FIRST. Every session. Load only the files listed for your current task.**

---

## File Registry

| File | Size | Purpose |
|---|---|---|
| `constants.js` | ~80 lines | All magic numbers. Import everywhere. |
| `tokens.css` | ~200 lines | All design tokens + utility classes. |
| `structure.md` | ~100 lines | Folder layout, module ownership, build order. |
| `sling-spec.md` | ~550 lines | World brief, UI system, all screen specs. |
| `physics-spec.md` | ~300 lines | Matter.js setup, bodies, collision, VFX. |
| `gesture-spec.md` | ~250 lines | Pinch detection, hand tracking, slingshot binding. |
| `renderer-spec.md` | ~250 lines | Canvas layers, draw order, all sprite drawing. |
| `webcam-spec.md` | ~200 lines | PIP camera window, skeleton overlay. |
| `state-spec.md` | ~150 lines | App states, transitions, save data. |
| `audio-spec.md` | ~80 lines | Sound map, Freesound sourcing, event hookup. |
| `levels.json` | ~100 lines | All 5 levels authored. |

---

## Load by Task

### Starting fresh / orienting
```
structure.md → constants.js → sling-spec.md
```

### Building physics
```
constants.js → physics-spec.md
```

### Building gesture / hand tracking
```
constants.js → gesture-spec.md
```

### Building renderer / sprites
```
constants.js → tokens.css → renderer-spec.md
```

### Building UI screens
```
constants.js → tokens.css → sling-spec.md → state-spec.md
```

### Building webcam window
```
constants.js → tokens.css → webcam-spec.md
```

### Building audio
```
constants.js → audio-spec.md
```

### Authoring / tuning levels
```
constants.js → levels.json → physics-spec.md (tuning notes section only)
```

### Wiring everything together (integration step)
```
constants.js → state-spec.md → structure.md
```

---

## Rules

- **Always load `constants.js` first.** Never hardcode a value that exists there.
- **Load only what your task needs.** Loading all 10 files wastes tokens.
- **If a value isn't in constants.js and you need it in multiple files, add it to constants.js first.**
- **If you're continuing a session, state which task you're on** so the right files get loaded.
- Design tokens (colors, spacing, typography) live in `tokens.css`. Never restate them in JS.
- Physics values (masses, thresholds, speeds) live in `constants.js`. Never restate them in specs.

---

## Build Order (current status)

```
Step 1 — Gesture scaffold    [x] Copy bowl files, add pinch detection
Step 2 — Physics scene       [x] Matter.js world, click-to-launch
Step 3 — Gesture → physics   [x] Pinch wired to launch
Step 4 — UI screens          [x] All screens built from tokens
Step 5 — Integration         [ ] State machine wires UI to game
Step 6 — Visual pass         [ ] Sprites, VFX, webcam window
Step 7 — Levels              [ ] All 5 levels loaded and playable
Step 8 — Audio               [ ] All sounds wired to events
```

Mark steps complete as they ship. State the current step at the start of every session.
