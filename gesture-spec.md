# SLING. — Gesture Spec
*Source of truth for Codex. Read alongside bowl's hand tracking files.*
**LOAD IF:** working on hand tracking, pinch detection, slingshot binding, or webcam input
**SKIP IF:** working on UI, physics, audio, or renderer
**DEPENDS ON:** constants.js, bowl gesture files


---

## Files to Copy from bowl

Bowl uses the **MediaPipe Tasks Vision API** (`@mediapipe/tasks-vision`). All hand tracking lives in one class: `src/vision.js` → `export class HandTracker`.

| Bowl file | Action |
|---|---|
| `src/vision.js` | Copy to `gesture/vision.js`. Apply the one required edit below. |
| `src/compositor.js` | **Do NOT copy.** Bowl composites player into scene — SLING. uses a PIP window. |
| `src/trail.js` | **Do NOT copy.** Swipe trail is bowl-specific. |

### How HandTracker works

```js
// Instantiate with the video element
const tracker = new HandTracker(videoElement);

// Start — handles getUserMedia + MediaPipe init
await tracker.start(statusCallback);

// Call each frame — returns array of hand objects
const hands = tracker.detect(nowMs, cameraFrame);
// cameraFrame: { x, y, width, height } of the canvas area
// Pass null to use full video dimensions
```

**What each hand object contains:**

```js
{
  id,         // persistent string ID across frames e.g. "hand-1"
  label,      // "Left" or "Right"
  x,          // smoothed pixel X of index tip (landmark 8), already mirrored
  y,          // smoothed pixel Y of index tip (landmark 8)
  baseX,      // smoothed pixel X of index proximal joint (landmark 7)
  baseY,      // smoothed pixel Y of index proximal joint (landmark 7)
  rawX,       // unsmoothed tip X
  rawY,       // unsmoothed tip Y
  velocityX,  // px/s
  velocityY,  // px/s
  confidence, // 0–1
  z,          // depth of tip
  detectedAt, // timestamp ms

  // Bowl-specific — ignore in SLING:
  bladeStartX, bladeStartY, bladeEndX, bladeEndY,
  rawBladeStartX, rawBladeStartY, rawBladeEndX, rawBladeEndY,
}
```

**⚠️ Critical gap:** The full 21-landmark `points` array is computed inside `detect()` but is NOT included in the hand output. Pinch detection requires landmark 4 (thumb tip), which is only in `points`. One edit fixes this.

### Required edit to vision.js

Find this block in `detect()` (around line 476):

```js
const hand = {
  id,
  label: candidate.label,
  color: candidate.color,
  x,
  y,
  baseX,
  // ... rest of fields
```

Add `points` to the object:

```js
const hand = {
  id,
  label: candidate.label,
  color: candidate.color,
  x,
  y,
  baseX,
  points: candidate.points,   // ← ADD THIS LINE — exposes all 21 landmarks
  // ... rest of fields unchanged
```

`candidate.points` is the full array of 21 landmarks already scaled to canvas pixels and mirrored in X. No other changes needed.

### Coordinates coming out of HandTracker

All coordinates are already:
- **Pixel space** — scaled to `cameraFrame.width × cameraFrame.height` (pass SLING.'s canvas dimensions)
- **Mirrored in X** — `(1 - lm.x) * frameWidth` — so left/right match the player's expectation
- **Smoothed** — `x, y` use velocity-adaptive smoothing. `rawX, rawY` are unsmoothed.

Use `hand.points[4]` (thumb tip) and `hand.points[8]` (index tip) for pinch. Use `hand.x, hand.y` for the hand center approximation.

### Segmenter — ignore entirely

`tracker.ensureSegmentation()` and `tracker.segment()` are bowl-specific. Never call them. The segmenter is lazy-loaded and won't initialise unless explicitly triggered.

### CONFIG values SLING. needs

Bowl's `HandTracker` reads from `CONFIG`. SLING.'s `config.js` must include these keys:

```js
// In sling/src/config.js (or equivalent)
export const CONFIG = {
  mediaPipeVisionUrl:    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js',
  mediaPipeWasmRoot:     'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
  mediaPipeHandModel:    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  webcamConstraints:     { video: { width: 1280, height: 720, facingMode: 'user' } },
  minHandConfidence:     CONSTANTS.MEDIAPIPE_DETECTION_CONF,   // 0.75
  handDetectFps:         60,
  handMatchDistance:     180,
  minHandSeparation:     110,
  handFastVelocity:      900,
  handSmoothing:         0.42,
  handFastSmoothing:     0.78,
  handLostHoldMs:        90,
  handPredictionMs:      55,
  handColors:            { Left: '#FFD100', Right: '#FFD100', default: '#FFD100' },

  // Required by HandTracker but bowl-specific — stub with safe defaults
  sliceBladeBackOffset:  0,
  sliceBladeHalfWidth:   0,
};
```

---

## MediaPipe Configuration

Bowl uses `@mediapipe/tasks-vision`. The init pattern is different from the legacy Hands API. Match bowl's `vision.js` init exactly — do not rewrite it. The key values to confirm are present:

```js
// Tasks Vision API pattern (confirm this matches bowl's vision.js)
const { HandLandmarker, FilesetResolver } = await import(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js"
);

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
);

const handLandmarker = await HandLandmarker.createFromOptions(vision, {
  baseOptions: { modelAssetPath: "hand_landmarker.task" },
  runningMode: "VIDEO",
  numHands: 2,                      // CONSTANTS.MEDIAPIPE_MAX_HANDS
  minHandDetectionConfidence: 0.75, // CONSTANTS.MEDIAPIPE_DETECTION_CONF
  minHandPresenceConfidence: 0.75,
  minTrackingConfidence: 0.70,      // CONSTANTS.MEDIAPIPE_TRACKING_CONF
});
```

Results from Tasks Vision use `results.landmarks` (array of hands, each an array of 21 landmarks) rather than the legacy `results.multiHandLandmarks`. Confirm which format bowl's `vision.js` outputs and normalise to it — do not change the output format, only consume it.

**Landmark reference (21 points per hand — same in both APIs):**
```
  8 (index tip)       4 (thumb tip)
  |                   |
  7                   3
  |                   |
  6                   2
  |                   |
  5 (index MCP)       1
                      |
  0 (wrist) ──────────┘
```

Key landmarks for SLING.:
- `4` — thumb tip
- `8` — index tip
- `0` — wrist
- `9` — middle finger MCP (palm center)
- `5` — index MCP (palm center averaging)

---

## Pinch Detection

Add to `gesture/gestureUtils.js` (write fresh):

```js
import { CONSTANTS } from '../constants.js';
const { PINCH_THRESHOLD, PINCH_HYSTERESIS } = CONSTANTS;

// hand.points[4] = thumb tip, hand.points[8] = index tip
// pixel coords, already mirrored — from vision.js after the required edit
export function getPinchDistance(hand) {
  const thumb = hand.points?.[4];
  const index = hand.points?.[8];
  if (!thumb || !index) return Infinity;
  return Math.hypot(thumb.x - index.x, thumb.y - index.y);
}

export function isPinching(hand, currentlyPinching) {
  const dist      = getPinchDistance(hand);
  const threshold = currentlyPinching
    ? PINCH_THRESHOLD + PINCH_HYSTERESIS
    : PINCH_THRESHOLD;
  return dist < threshold;
}

// Call once per frame, pass in previous state
export function updatePinchState(hand, prevState) {
  const pinching = isPinching(hand, prevState.active);
  if (!prevState.active && pinching)  return { active: true,  event: 'PINCH_START'   };
  if ( prevState.active && pinching)  return { active: true,  event: 'PINCH_HOLD'    };
  if ( prevState.active && !pinching) return { active: false, event: 'PINCH_RELEASE' };
  return { active: false, event: 'IDLE' };
}
```

---

## Hand Center Calculation

```js
export function getHandCenter(hand) {
  // Use hand.points (all 21 landmarks) available after vision.js edit
  // Average wrist (0), index MCP (5), middle MCP (9) for stable palm center
  const pts = hand.points;
  if (!pts) return { x: hand.x, y: hand.y };  // fallback to tip if points missing
  return {
    x: (pts[0].x + pts[5].x + pts[9].x) / 3,
    y: (pts[0].y + pts[5].y + pts[9].y) / 3,
  };
}
```

---

## Either-Hand Logic

`HandTracker.detect()` already handles multi-hand smoothing and ID tracking. `getActiveHand` selects which of the returned hands to use for SLING.'s slingshot:

```js
export function getActiveHand(hands) {
  if (hands.length === 0) return null;
  if (hands.length === 1) return hands[0];
  // Prefer higher confidence. Tie-break: closer to slingshot zone.
  const byScore = hands.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  if ((byScore[0].confidence ?? 0) - (byScore[1].confidence ?? 0) > 0.1) {
    return byScore[0];
  }
  // Within 0.1 of each other — use proximity to slingshot
  return hands.reduce((closest, hand) => {
    const center = getHandCenter(hand);
    const distA  = Math.hypot(center.x - SLINGSHOT_ZONE.x, center.y - SLINGSHOT_ZONE.y);
    const closestCenter = getHandCenter(closest);
    const distB  = Math.hypot(closestCenter.x - SLINGSHOT_ZONE.x, closestCenter.y - SLINGSHOT_ZONE.y);
    return distA < distB ? hand : closest;
  });
}

// Slingshot zone center (used for hand proximity check above)
// Matches SLINGSHOT_ORIGIN in physics-spec — keep in sync
const SLINGSHOT_ZONE = CONSTANTS.SLINGSHOT_ORIGIN;
```

---

## Slingshot Interaction Zone

The interaction zone is a circular region around the slingshot. When the hand center enters this zone, the pinch zone ring appears. When pinch starts inside this zone, the ball locks to the hand.

```js
const SLINGSHOT_INTERACTION_RADIUS = CONSTANTS.SLINGSHOT_ZONE_RADIUS;  // px

export function isInSlingshotZone(handCenter) {
  const dist = Math.hypot(
    handCenter.x - SLINGSHOT_ZONE.x,
    handCenter.y - SLINGSHOT_ZONE.y
  );
  return dist < SLINGSHOT_INTERACTION_RADIUS;
}
```

---

## Full Game Loop Integration

`HandTracker.detect(nowMs, cameraFrame)` is called each frame. It returns the processed hands array directly — no results destructuring needed.

```js
// State (persists across frames)
let pinchState  = { active: false, event: 'IDLE' };
let isDragging  = false;
let currentPull = null;

// Call in requestAnimationFrame loop
function onFrame(nowMs) {
  // cameraFrame maps to the gameplay canvas area
  const cameraFrame = { x: 0, y: 0, width: CONSTANTS.CANVAS_W, height: CONSTANTS.CANVAS_H };
  const hands = tracker.detect(nowMs, cameraFrame);
  // hands: array of hand objects — see vision.js output shape above

  const activeHand = getActiveHand(hands);

  if (!activeHand) {
    if (isDragging) cancelDrag();
    pinchState = { active: false, event: 'IDLE' };
    return;
  }

  const handCenter = getHandCenter(activeHand);
  pinchState = updatePinchState(activeHand, pinchState);

  const inZone = isInSlingshotZone(handCenter);
  updatePinchZoneRing(inZone, pinchState.event);

  if (pinchState.event === 'PINCH_START' && inZone && state.currentBall) {
    isDragging = true;
  }

  if (pinchState.event === 'PINCH_HOLD' && isDragging) {
    const pullVec = {
      x: CONSTANTS.SLINGSHOT_ORIGIN.x - handCenter.x,
      y: CONSTANTS.SLINGSHOT_ORIGIN.y - handCenter.y,
    };
    const rawDist  = Math.hypot(pullVec.x, pullVec.y);
    const pullDist = Math.min(rawDist, CONSTANTS.MAX_PULL_DIST);
    const pullNorm = { x: pullVec.x / (rawDist || 1), y: pullVec.y / (rawDist || 1) };
    currentPull    = { vec: pullNorm, dist: pullDist };
    state.tension  = pullDist / CONSTANTS.MAX_PULL_DIST;
    updateBallVisualPosition({
      x: CONSTANTS.SLINGSHOT_ORIGIN.x - pullNorm.x * pullDist,
      y: CONSTANTS.SLINGSHOT_ORIGIN.y - pullNorm.y * pullDist,
    });
  }

  if (pinchState.event === 'PINCH_RELEASE' && isDragging && currentPull) {
    launchBall(state.currentBall, currentPull.vec, currentPull.dist);
    watchForSettle(state.currentBall);
    isDragging = false; currentPull = null; state.tension = 0;
  }
}

function cancelDrag() {
  isDragging = false; currentPull = null; state.tension = 0;
  resetBallToSlingshot();
}
```

---

## Pinch Zone Ring (Visual)

Drawn on the canvas overlay. Call in the render loop.

```js
let pinchRingOpacity = 0;
let pinchRingRadius  = 60;
let pinchRingPulse   = 0;

function updatePinchZoneRing(inZone, event) {
  if (event === 'PINCH_START') {
    pinchRingRadius  = 0;   // collapse on pinch
    pinchRingOpacity = 0;
    return;
  }
  const targetOpacity = inZone ? 0.5 : 0;
  pinchRingOpacity += (targetOpacity - pinchRingOpacity) * 0.1;
  pinchRingPulse   += 0.05;
  pinchRingRadius   = 60 + Math.sin(pinchRingPulse) * 6;
}

function drawPinchZoneRing(ctx) {
  if (pinchRingOpacity < 0.01) return;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#FFD100';   // --color-yellow
  ctx.lineWidth = 2;
  ctx.globalAlpha = pinchRingOpacity;
  ctx.beginPath();
  ctx.arc(SLINGSHOT_ORIGIN.x, SLINGSHOT_ORIGIN.y, pinchRingRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
```

---

## Slingshot Band Rendering

The two rubber band lines from slingshot poles to ball. Drawn on canvas.

```js
// Slingshot pole tips (where band attaches)
const BAND_LEFT  = CONSTANTS.BAND_LEFT;
const BAND_RIGHT = CONSTANTS.BAND_RIGHT;

function drawSlingshotBand(ctx, ballPos) {
  // When not dragging, ball sits at slingshot origin
  const pos = ballPos ?? SLINGSHOT_ORIGIN;

  const tension = currentPull ? currentPull.dist / MAX_PULL_DIST : 0;
  // Band gets brighter / thicker at high tension
  const lineWidth  = 2 + tension * 1.5;
  const color      = tension > 0.8 ? '#FFD100' : '#111111';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = 'round';

  ctx.beginPath();
  ctx.moveTo(BAND_LEFT.x, BAND_LEFT.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(BAND_RIGHT.x, BAND_RIGHT.y);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();

  ctx.restore();
}
```

---

## Coordinate System

MediaPipe returns normalized coordinates (0–1). Bowl's `handTracker.js` already scales to canvas pixels — confirm this scaling is happening:

```js
// Should exist in handTracker.js — verify before building
keypoints: kp.map(p => ({
  x: p.x * canvasWidth,
  y: p.y * canvasHeight,
}))
```

The canvas and the physics world must share the same coordinate space (both 1280×720). If webcam feed is composited at a different size, apply the same scale factor to all landmark coordinates.

**Mirror:** MediaPipe returns mirrored coordinates by default (player raises right hand → x is on the left). Bowl's handTracker should already handle this with `transform: scaleX(-1)` on the video element. Verify it's present — if not, add it.
