# SLING. — Webcam Window Spec
*Source of truth for Claude Code. The webcam is a small PIP monitor, not a background composite.*
**LOAD IF:** working on the webcam PIP window, skeleton overlay, or calibration screen
**SKIP IF:** working on physics, audio, or level design
**DEPENDS ON:** constants.js (CAM_W, CAM_H, CAM_TOP, CAM_LEFT)


---

## What We Are NOT Doing

No background removal. No player composited into the scene. No segmentation mask.

Bowl attempted full-screen compositing with segmentation. It was unreliable, performance-heavy, and visually unstable. SLING. uses a small picture-in-picture webcam window instead.

---

## Concept

A **site security camera monitor** embedded in the game HUD. Construction sites have CCTV. The player sees their own hand in a small corner feed, styled like a black-and-white surveillance monitor. MediaPipe hand skeleton renders on top of the feed inside the window.

The window sits in the **top-left of the gameplay scene**, just below the HUD bar. This keeps the lower-left entirely clear for the slingshot interaction zone — placing it bottom-left would overlap directly with where the player's hand needs to be.

---

## Window Dimensions & Position

```
Width:    240px
Height:   180px   (4:3 — classic CCTV aspect ratio)
Position: top-left of gameplay canvas, below the top HUD bar
X:        24px from left edge
Y:        (hudTopHeight + 8)px from top
          = 44 + 8 = 52px
```

So the window sits just below the top HUD bar with 8px clearance, left-anchored.

The window occupies x=24–264, y=52–232 — entirely above the slingshot zone (x=160, y=580) with zero overlap. The player's upper body and hand are naturally visible in the feed without competing with the interaction zone.

---

## Visual Design

The window looks like a **laminated CCTV monitor** stuck on the site hoarding. Black border, scan timestamp, recording indicator.

### Layers (draw order, inside the window)

1. **Video frame** — raw webcam feed, mirrored, clipped to window bounds
2. **Hand skeleton** — MediaPipe landmarks drawn as thin lines + dots, color: `#FFD100` at 80% opacity
3. **Pinch indicator** — small dot in top-right of window: yellow = pinching, dim = not pinching
4. **Scanline overlay** — repeating horizontal lines at 2px spacing, black at 6% opacity. Gives slight CRT feel without being heavy.
5. **Corner chrome** — top-left label "SITE CAM 01", bottom-right timestamp (frame counter or live clock)
6. **Border** — 2.5px solid #111111 on all sides
7. **Recording dot** — top-right, 6px circle, red (#CC2200) when hand detected, dim when not

### CSS / Canvas spec

```css
/* The outer container — positioned absolutely over the game canvas */
.webcam-window {
  position: absolute;
  left: 24px;
  top: calc(var(--hud-height-top) + 8px);
  width: 240px;
  height: 180px;
  border: var(--border-primary);   /* 2.5px solid #111 */
  background: #000;
  overflow: hidden;
  z-index: 10;
}

/* Video element fills the container, mirrored */
.webcam-window video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);   /* mirror so it feels like a mirror, not a camera */
  filter: contrast(1.05);  /* slight contrast boost — CCTV look */
  display: block;
}

/* Canvas overlay for skeleton + effects — same size, on top of video */
.webcam-window canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* Bottom label bar */
.webcam-window__label {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: rgba(0,0,0,0.65);
  padding: 3px 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.webcam-window__label span {
  font-family: var(--font-primary);
  font-size: 8px;
  color: #FFD100;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

/* Recording dot */
.webcam-window__rec {
  position: absolute;
  top: 7px; right: 8px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #CC2200;
  opacity: 0.3;
  transition: opacity 0.2s;
}

.webcam-window__rec--active {
  opacity: 1;
  animation: recBlink 1.4s ease-in-out infinite;
}

@keyframes recBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

/* Pinch state dot — top-left */
.webcam-window__pinch {
  position: absolute;
  top: 7px; left: 8px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #7A5210;   /* dim yellow = not pinching */
  transition: background 0.08s;
}

.webcam-window__pinch--active {
  background: #FFD100;   /* bright yellow = pinching */
}
```

---

## Scanline Overlay (Canvas)

Draw this on the webcam overlay canvas each frame, on top of the skeleton:

```js
function drawScanlines(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < height; y += 2) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}
```

---

## Hand Skeleton Rendering (inside webcam window)

MediaPipe returns normalized 0–1 coordinates. Scale to the window size (240×180), not the full canvas.

```js
// Scale factor for webcam window
const { CAM_W, CAM_H } = CONSTANTS;


function scaleToWindow(point) {
  // MediaPipe coords are already mirrored by the video transform
  // Just scale 0–1 to window px
  return {
    x: point.x * CAM_W,
    y: point.y * CAM_H,
  };
}

// Connections to draw (MediaPipe hand landmark pairs)
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],         // thumb
  [0,5],[5,6],[6,7],[7,8],         // index
  [5,9],[9,10],[10,11],[11,12],    // middle
  [9,13],[13,14],[14,15],[15,16],  // ring
  [13,17],[17,18],[18,19],[19,20], // pinky
  [0,17],                          // palm base
];

function drawHandSkeleton(ctx, hand, isPinching) {
  if (!hand) return;
  const kp = hand.points.map(p => scaleToWindow(p));

  // Lines
  ctx.save();
  ctx.strokeStyle = isPinching ? '#FFD100' : 'rgba(255, 209, 0, 0.6)';
  ctx.lineWidth = 1.2;
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(kp[a].x, kp[a].y);
    ctx.lineTo(kp[b].x, kp[b].y);
    ctx.stroke();
  });

  // Landmark dots
  ctx.fillStyle = isPinching ? '#FFD100' : 'rgba(255, 209, 0, 0.5)';
  kp.forEach((p, i) => {
    const r = (i === 4 || i === 8) ? 3.5 : 2;  // thumb tip + index tip larger
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}
```

---

## Per-Frame Render Loop (webcam window)

```js
function renderWebcamWindow(hand, pinchState) {
  const ctx = webcamOverlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, CAM_W, CAM_H);

  // 1. Draw skeleton
  drawHandSkeleton(ctx, hand, pinchState.active);

  // 2. Draw scanlines
  drawScanlines(ctx, CAM_W, CAM_H);

  // 3. Update DOM indicators
  recDot.classList.toggle('webcam-window__rec--active', hand !== null);
  pinchDot.classList.toggle('webcam-window__pinch--active', pinchState.active);
}
```

---

## HTML Structure

```html
<div class="webcam-window" id="webcamWindow">
  <video id="webcamVideo" autoplay playsinline muted></video>
  <canvas id="webcamCanvas" width="240" height="180"></canvas>

  <div class="webcam-window__rec" id="recDot"></div>
  <div class="webcam-window__pinch" id="pinchDot"></div>

  <div class="webcam-window__label">
    <span>SITE CAM 01</span>
    <span id="camTimestamp">00:00</span>
  </div>
</div>
```

Timestamp ticks up in MM:SS from level start:

```js
let levelStartTime = null;

function startLevelTimer() {
  levelStartTime = Date.now();
}

function updateCamTimestamp() {
  if (!levelStartTime) return;
  const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  document.getElementById('camTimestamp').textContent = `${mm}:${ss}`;
}
// Call updateCamTimestamp() in the render loop
```

---

## Calibration Screen Webcam

On the calibration screen, the webcam is displayed larger — 16:9, centered, full-width of the content area. This is the only screen where the webcam feed is large. Apply the same skeleton rendering scaled to the larger canvas dimensions.

```js
const CALIB_W = 560;
const CALIB_H = 315;   // 16:9

// Same drawHandSkeleton() function, different scale:
function scaleToCalib(point) {
  return { x: point.x * CALIB_W, y: point.y * CALIB_H };
}
```

On calibration, the hand border turns yellow (CSS: `border-color: #FFD100`) when a hand is detected, and the "HAND ✓" panel fills yellow with black text when tracking is confirmed.

---

## What Changes in the Main Spec

Remove these references from `sling-spec.md` Part D Gameplay Screen:

~~`[webcam feed — full width, player composited, no bg removal overlay needed — player visible against paper]`~~

Replace with:

`[webcam window — 240×180px, top-left, see webcam-spec.md]`

The gameplay scene background is pure CSS grid paper (`grid-bg` utility class from tokens.css). No video layer behind the physics canvas.

---

## Why This Works Better Than Compositing

- **No segmentation** — segmentation is slow, jittery, and produces ugly edges. Not needed.
- **No green screen** — player doesn't need any setup.
- **Performance** — one small canvas at 240×180 instead of full-screen pixel manipulation.
- **Aesthetically correct** — a security camera monitor on a construction site IS the world. It's not a hack, it's a design decision.
- **ALBERS precedent** — same approach proved reliable in ALBERS. Carry it forward.
