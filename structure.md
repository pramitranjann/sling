# SLING. — Project Structure
*Source of truth for both Codex and Claude Code. Agree on this before writing a single file.*
**LOAD IF:** starting a new session and need to orient to the project layout
**SKIP IF:** already know the file structure
**DEPENDS ON:** nothing — read this first


---

## Folder Layout

```
sling/
├── index.html
├── main.js                  ← entry point, bootstraps everything
│
├── state/
│   └── state.js             ← global state object + transition() function
│
├── ui/
│   ├── screens.js           ← renderScreen(), show/hide logic
│   ├── hud.js               ← updateHUDScore(), updateBirdQueue(), updateTensionBar()
│   └── levelSelect.js       ← build level card grid, handle clicks
│
├── game/
│   ├── gameLoop.js          ← requestAnimationFrame loop, calls renderers
│   ├── physics.js           ← Matter.js setup, world, body factories
│   ├── levelLoader.js       ← reads levels.json, builds world from level data
│   ├── scoring.js           ← addScore(), checkLevelComplete(), triggerLevelComplete()
│   └── birdQueue.js         ← queue management, advanceBirdQueue()
│
├── gesture/
│   ├── vision.js       ← [COPY FROM BOWL] MediaPipe init + results handler
│   ├── webcamManager.js     ← write fresh (short) — bowl compositor not reused getUserMedia, stream management
│   ├── gestureUtils.js      ← write fresh — pinch logic + active hand (see gesture-spec.md) pinch detection, state machine
│   └── vision.js            ← [COPY FROM BOWL src/vision.js] Tasks Vision API, remove segmenter skeleton draw, color changed to #111
│
├── render/
│   ├── renderer.js          ← main render loop, calls all draw functions
│   ├── drawPhysics.js       ← drawGround, drawSlingshot, drawBlocks, drawPigs, drawBall
│   ├── drawVFX.js           ← drawTrajectoryArc, drawSlingshotBand, drawShockwaves, drawDust, drawScorePopups, drawPinchZoneRing
│   └── webcamWindow.js      ← webcam PIP window, skeleton overlay, scanlines, indicators
│
├── audio/
│   └── audio.js             ← all Web Audio synthesis + Freesound buffer loading
│
├── data/
│   └── levels.json          ← level definitions (see levels.json)
│
├── styles/
│   ├── tokens.css           ← design tokens (see tokens.css)
│   └── main.css             ← layout, screen containers, HUD, webcam window, buttons
│
└── assets/
    ├── sounds/
    │   ├── ball-impact-heavy.mp3
    │   ├── block-collapse.mp3
    │   └── charge-blast.mp3
    └── (no image assets — all sprites drawn in canvas)
```

---

## File Responsibilities

### index.html

Single HTML file. Loads CSS, declares screen divs, loads `main.js`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SLING.</title>
  <link rel="stylesheet" href="styles/tokens.css">
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>

  <!-- Screens — all present in DOM, visibility controlled by state -->
  <div id="screen-home"           style="display:flex;"></div>
  <div id="screen-calibration"    style="display:none;"></div>
  <div id="screen-level-select"   style="display:none;"></div>
  <div id="screen-gameplay"       style="display:none; position:relative;"></div>
  <div id="screen-level-complete" style="display:none;"></div>
  <div id="screen-level-fail"     style="display:none;"></div>

  <script type="module" src="main.js"></script>
</body>
</html>
```

---

### main.js

Bootstrap only. Wires everything together. No logic.

```js
import { state, transition } from './state/state.js';
import { initScreens }       from './ui/screens.js';
import { initWebcam }        from './gesture/webcamManager.js';
import { initHands }         from './gesture/vision.js';
import { startRenderLoop }   from './render/renderer.js';
import { loadSave }          from './state/state.js';

async function boot() {
  loadSave();
  initScreens();
  startRenderLoop();
  // Webcam + hands init deferred to CALIBRATION enter hook
}

boot();
```

---

## Module Boundaries

**Codex owns:**
- `game/` — all physics, level loading, scoring, bird queue
- `gesture/` — hand tracking, gesture detection, game loop integration
- `render/drawPhysics.js` and `render/drawVFX.js` — canvas sprite rendering
- `state/state.js` — global state and transition logic

**Claude Code owns:**
- `ui/` — all screen HTML construction and DOM updates
- `render/webcamWindow.js` — webcam PIP window
- `render/renderer.js` — render loop shell (calls Codex's draw functions)
- `styles/` — tokens.css already provided; main.css to build
- `audio/audio.js` — all sound synthesis

**Shared:**
- `data/levels.json` — provided (see levels.json)
- `index.html` — either can write; coordinate to avoid conflict

---

## Import Rules

- All files use ES modules (`import`/`export`). No CommonJS.
- `state.js` is the only cross-cutting import — everything else should only import from its own module or from `state.js`.
- No circular imports. Game modules do not import from UI modules.
- Render modules import from game modules (to read body positions) but game modules do not import from render modules.

---

## Build Order (mirrors Part F of sling-spec.md)

1. **Codex:** Copy bowl gesture files → `gesture/`. Add pinch logic. Test page: webcam + console log.
2. **Codex:** Write `game/physics.js` + `render/drawPhysics.js`. Click-to-launch test.
3. **Codex:** Write `game/gameLoop.js` wiring gesture → physics. Trajectory arc. Full gesture test.
4. **Claude Code:** Write all `ui/` files + `styles/main.css` + screen HTML. No game logic. UI test.
5. **Both:** Wire `state/state.js`. Transition function connects UI screens to game events.
6. **Claude Code:** Full visual pass — `render/drawPhysics.js` sprite details, `render/drawVFX.js`, `render/webcamWindow.js`.
7. **Codex:** Level JSON loaded via `game/levelLoader.js`. All 5 levels playable.
8. **Claude Code:** `audio/audio.js` — all sounds wired to game events.

---

## Coordinate System

- Canvas size: `1280 × 720` (CSS pixels, 1:1 with physics world)
- Origin: top-left
- Y increases downward
- Ground at y=740 (below visible area — ground body at 740, top of visible ground plane at ~720)
- Slingshot at x=160, y=580 (left quarter, lower third)
- All level JSON coordinates are in this space

---

## Environment

- Browser only. No Node.js, no bundler required for v1.
- ES modules via `<script type="module">` — works in any modern browser.
- Matter.js loaded via CDN: `https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js`
- MediaPipe loaded via CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js`
- No React, no TypeScript, no build step.
- All font loading via Google Fonts in `<head>`:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap" rel="stylesheet">
  ```
  (Impact is a system font — no import needed. Bebas Neue dropped — Impact only per Part A.)
