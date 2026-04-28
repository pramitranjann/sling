# SLING. — Renderer Spec
*Source of truth for Codex. Defines canvas layers, draw order, and sprite rendering.*
**LOAD IF:** working on canvas rendering, sprite drawing, VFX, or HUD DOM updates
**SKIP IF:** working on physics logic, gesture logic, or audio
**DEPENDS ON:** constants.js, tokens.css, physics-spec.md (for body shapes)


---

## Canvas Architecture

The game uses **three overlapping canvases** plus the CSS background layer. All canvases are `1280×720` and positioned absolute, stacked via z-index.

```
z-index 0  — CSS background (grid paper, HUD bars) — DOM, not canvas
z-index 1  — physics canvas   (Matter.js bodies rendered as sprites)
z-index 2  — vfx canvas       (shockwaves, dust, trajectory arc, score popups)
z-index 3  — webcam window    (separate DOM element, see webcam-spec.md)
z-index 10 — HUD overlay      (DOM — top and bottom bars, always on top)
```

```html
<div id="game-root" style="position:relative; width:1280px; height:720px;">

  <!-- z-index 0: CSS grid paper background -->
  <div class="grid-bg" style="position:absolute;inset:0;z-index:0;"></div>

  <!-- z-index 1: Physics canvas -->
  <canvas id="canvas-physics" width="1280" height="720"
    style="position:absolute;top:0;left:0;z-index:1;background:transparent;"></canvas>

  <!-- z-index 2: VFX canvas -->
  <canvas id="canvas-vfx" width="1280" height="720"
    style="position:absolute;top:0;left:0;z-index:2;background:transparent;pointer-events:none;"></canvas>

  <!-- z-index 3: Webcam window — see webcam-spec.md -->
  <div class="webcam-window" id="webcamWindow" style="z-index:3;"></div>

  <!-- z-index 10: HUD (DOM elements) -->
  <div class="hud-top"    id="hud-top"    style="position:absolute;top:0;left:0;right:0;z-index:10;"></div>
  <div class="hud-bottom" id="hud-bottom" style="position:absolute;bottom:0;left:0;right:0;z-index:10;"></div>

</div>
```

---

## Render Loop

Single `requestAnimationFrame` loop. Both canvases clear and redraw every frame.

```js
function renderLoop() {
  const physCtx = document.getElementById('canvas-physics').getContext('2d');
  const vfxCtx  = document.getElementById('canvas-vfx').getContext('2d');

  physCtx.clearRect(0, 0, 1280, 720);
  vfxCtx.clearRect(0, 0, 1280, 720);

  // === PHYSICS CANVAS (z-index 1) ===
  drawGround(physCtx);
  drawSlingshot(physCtx);
  drawBlocks(physCtx);
  drawPigs(physCtx);
  drawCurrentBall(physCtx);

  // === VFX CANVAS (z-index 2) ===
  if (state.current === 'GAMEPLAY') {
    if (state.tension > 0) drawTrajectoryArc(vfxCtx);
    drawSlingshotBand(vfxCtx);
    drawShockwaves(vfxCtx);
    drawDustClouds(vfxCtx);
    drawScorePopups(vfxCtx);
    drawPinchZoneRing(vfxCtx);
  }

  // === WEBCAM WINDOW (separate canvas, see webcam-spec.md) ===
  renderWebcamWindow(activeHand, pinchState);

  // === HUD DOM updates ===
  updateHUDScore(state.score);
  updateBirdQueue(state.birdQueue);
  updateTensionBar(state.tension);
  updateCamTimestamp();

  requestAnimationFrame(renderLoop);
}
```

---

## Sprite Rendering

### Ground Plane

```js
function drawGround(ctx) {
  // Flat fill — ground body is static, never moves
  ctx.fillStyle = '#C8C0A8';   // --color-surface-dim
  ctx.fillRect(0, 740, 1280, 40);

  // Top edge — darker line for weight
  ctx.fillStyle = '#B0A890';
  ctx.fillRect(0, 738, 1280, 3);
}
```

---

### Slingshot

Two concrete pillars + fork tips. Static, never moves.

```js
const SL = {
  leftPillar:  { x: 136, y: 576, w: 16, h: 166 },
  rightPillar: { x: 160, y: 576, w: 16, h: 166 },
  forkLeft:    { x: 130, y: 572, w: 6,  h: 14  },
  forkRight:   { x: 176, y: 572, w: 6,  h: 14  },
};

function drawSlingshot(ctx) {
  ctx.fillStyle = '#9A9488';      // --color-concrete
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;

  // Pillars
  [SL.leftPillar, SL.rightPillar].forEach(r => {
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });

  // Fork tips (slightly darker)
  ctx.fillStyle = '#7A7468';      // --color-concrete-dark
  [SL.forkLeft, SL.forkRight].forEach(r => {
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });
}
```

---

### Concrete Block

Three health states drive which visual to draw. Health ratio = `body.health / body.maxHealth`.

```js
function drawBlock(ctx, body) {
  const { x, y }  = body.position;
  const angle      = body.angle;
  const sizes      = { '1x1':[40,40],'1x2':[80,40],'2x1':[40,80],'2x2':[80,80],'3x1':[120,40] };
  const [w, h]     = sizes[body.blockType] ?? [40, 40];
  const healthRatio = body.health / body.maxHealth;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Fill — darken with damage
  const damage = 1 - healthRatio;
  const grey   = Math.round(154 - damage * 40);   // 154 = #9A (concrete), fades to darker
  ctx.fillStyle = `rgb(${grey},${grey - 6},${grey - 12})`;
  ctx.fillRect(-w/2, -h/2, w, h);

  // Border
  ctx.strokeStyle = '#111111';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(-w/2, -h/2, w, h);

  // Crack overlay at health < max
  if (healthRatio < 1) {
    drawCracks(ctx, w, h, body.crackVariant ?? 0, 1 - healthRatio);
  }

  ctx.restore();
}

// Three crack variants — assigned on block creation (random 0–2)
function drawCracks(ctx, w, h, variant, severity) {
  ctx.save();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth   = 0.8;
  ctx.globalAlpha = 0.4 + severity * 0.4;

  const patterns = [
    // Variant 0: diagonal slash
    () => { ctx.beginPath(); ctx.moveTo(-w*0.3, -h*0.4); ctx.lineTo(w*0.2, h*0.3); ctx.stroke(); },
    // Variant 1: two cracks
    () => {
      ctx.beginPath(); ctx.moveTo(-w*0.1, -h*0.5); ctx.lineTo(w*0.3, h*0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w*0.4, h*0.1);  ctx.lineTo(w*0.1, h*0.5); ctx.stroke();
    },
    // Variant 2: starburst from center
    () => {
      [[-1,-1],[1,-0.8],[-0.8,1],[0.9,0.7]].forEach(([dx,dy]) => {
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(dx*w*0.45, dy*h*0.45); ctx.stroke();
      });
    },
  ];
  patterns[variant]?.();
  ctx.restore();
}
```

On block creation, assign: `body.crackVariant = Math.floor(Math.random() * 3)`.

---

### Pig / Bunker

Squat rectangle with rounded top (drawn, not a border-radius — physics body stays rectangular).

```js
function drawPig(ctx, body) {
  if (!body || body.dead) return;
  const { x, y } = body.position;
  const angle     = body.angle;
  const size      = body.pigVariant === 'fortified' ? { w:60, h:50 } : { w:44, h:38 };
  const { w, h }  = size;
  const healthRatio = body.health / (body.pigVariant === 'fortified' ? 2 : 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Body fill
  ctx.fillStyle = healthRatio < 1 ? '#4A7455' : '#5C8C68';   // hit = darker
  ctx.strokeStyle = '#111111';
  ctx.lineWidth   = 2;

  // Turret body — rectangle with D-shaped top
  ctx.beginPath();
  ctx.moveTo(-w/2, h/2);
  ctx.lineTo(-w/2, -h/4);
  ctx.arc(0, -h/4, w/2, Math.PI, 0);  // rounded top
  ctx.lineTo(w/2, h/2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Interior window (small dark rectangle)
  ctx.fillStyle = '#2A4030';
  const iw = w * 0.45, ih = h * 0.28;
  ctx.fillRect(-iw/2, -h/4 - ih/2 + 4, iw, ih);
  ctx.strokeRect(-iw/2, -h/4 - ih/2 + 4, iw, ih);

  // Indicator light (top center)
  const lightOn = healthRatio >= 1;
  const flickering = healthRatio < 1 && healthRatio > 0;
  const lightAlpha = flickering ? (Math.random() > 0.3 ? 1 : 0.2) : (lightOn ? 1 : 0.15);
  ctx.fillStyle = `rgba(255, 209, 0, ${lightAlpha})`;   // #FFD100
  ctx.beginPath();
  ctx.arc(0, -h/2 + 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Crack overlay if hit
  if (healthRatio < 1) {
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(-w*0.3, 0); ctx.lineTo(w*0.1, h*0.3); ctx.stroke();
  }

  ctx.restore();
}
```

Dead pig: do not render. Physics body is removed after 600ms (see physics-spec.md). Before removal, render collapsed state:

```js
function drawDeadPig(ctx, body) {
  // Just a rubble pile — small irregular shape
  const { x, y } = body.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#4A7455';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(-15, -8, 30, 16);
  ctx.restore();
}
```

---

### Wrecking Ball

```js
function drawBall(ctx, body) {
  if (!body) return;
  const { x, y } = body.position;
  const def       = body.def;
  const r         = def.radius;

  ctx.save();
  ctx.translate(x, y);

  // Outer sphere
  ctx.fillStyle   = '#2A2828';
  ctx.strokeStyle = '#111111';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Embossed ring
  ctx.strokeStyle = '#3A3836';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  // Charge variant: yellow stripe band
  if (def.blastRadius > 0) {
    ctx.strokeStyle = '#FFD100';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();

    // Fuse nub (top)
    ctx.fillStyle = '#FFD100';
    ctx.fillRect(-2, -r - 4, 4, 6);
  }

  // Heavy variant: rebar ring
  if (def.piercing) {
    ctx.strokeStyle = '#555550';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Highlight (specular)
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.3, r * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
```

---

### Ball Resting in Slingshot

When no ball is in flight (READY sub-state), draw a static ball at the slingshot origin before physics body is created.

```js
function drawCurrentBall(ctx) {
  if (state.currentBall && engine.world.bodies.includes(state.currentBall)) {
    // Ball is in physics world — draw at its physics position
    drawBall(ctx, state.currentBall);
  } else if (state.subState === 'READY' && state.birdQueue.some(b => b.status === 'active')) {
    // Ball waiting in slingshot — draw at origin
    const variant = state.birdQueue.find(b => b.status === 'active')?.variant ?? 'standard';
    const fakebody = { position: SLINGSHOT_ORIGIN, def: BALL_DEFS[variant], angle: 0 };
    drawBall(ctx, fakebody);
  }
}
```

---

## HUD DOM Updates

These run in the render loop but update DOM, not canvas.

```js
function updateHUDScore(score) {
  document.getElementById('hud-score').textContent = score.toLocaleString();
}

function updateBirdQueue(queue) {
  const dots = document.querySelectorAll('.bird-dot');
  queue.forEach((bird, i) => {
    if (!dots[i]) return;
    dots[i].classList.toggle('bird-dot--active', bird.status === 'active');
    dots[i].classList.toggle('bird-dot--used',   bird.status === 'used');
  });
}

function updateTensionBar(tension) {
  const fill = document.querySelector('.tension-fill');
  if (fill) fill.style.width = `${Math.round(tension * 100)}%`;
  const label = document.getElementById('tension-pct');
  if (label) label.textContent = `${Math.round(tension * 100)}%`;
}
```
