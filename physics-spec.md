# SLING. — Physics Spec
*Source of truth for Codex. Read before touching Matter.js.*
**LOAD IF:** working on physics, collision, fragments, scoring, or launch mechanics
**SKIP IF:** working on UI, gestures, audio, or webcam
**DEPENDS ON:** constants.js (all magic numbers live there — do not restate them here)


---

## World Setup

```js
const engine = Matter.Engine.create({
  gravity: { x: 0, y: CONSTANTS.GRAVITY_Y },   // heavier than real — demolition feels weighty
  positionIterations: 10,        // default 6 — higher = more accurate stacking
  velocityIterations: 8,
});

const render = Matter.Render.create({
  canvas: gameCanvas,
  engine: engine,
  options: {
    width: CONSTANTS.CANVAS_W,
    height: CONSTANTS.CANVAS_H,
    wireframes: false,           // use sprites/fills, not debug outlines
    background: 'transparent',   // canvas overlays on top of CSS grid-bg
  }
});
```

**Scale convention:** 1 physics unit = 1 CSS pixel. Do not introduce a separate scale factor — it creates translation bugs. All positions in level JSON are pixel coordinates at 1280×720.

**World bounds:** Static bodies forming a floor and two side walls. Ceiling is open — balls can leave the top. Objects that fall below y=800 (off-screen below floor) are removed from the world.

```js
const ground = Matter.Bodies.rectangle(CONSTANTS.CANVAS_W/2, CONSTANTS.GROUND_Y + 20, CONSTANTS.CANVAS_W, 40, {
  isStatic: true,
  label: 'ground',
  restitution: 0.1,
  friction: 0.8,
});

const wallLeft  = Matter.Bodies.rectangle(-20, 360, 40, 720, { isStatic: true, label: 'wall' });
const wallRight = Matter.Bodies.rectangle(1300, 360, 40, 720, { isStatic: true, label: 'wall' });
```

---

## Body Definitions

### Concrete Block

Three sizes. All use the same physics properties — only dimensions differ.

```js
function createBlock(x, y, type) {
  const sizes = {
    '1x1': { w: 40,  h: 40  },
    '1x2': { w: 80,  h: 40  },
    '2x2': { w: 80,  h: 80  },
    '2x1': { w: 40,  h: 80  },  // vertical plank
    '3x1': { w: 120, h: 40  },  // wide horizontal
  };
  const { w, h } = sizes[type];

  return Matter.Bodies.rectangle(x, y, w, h, {
    label: 'block',
    restitution:  0.15,   // low bounce — concrete doesn't spring
    friction:     0.70,   // high surface friction — blocks grip each other
    frictionAir:  0.008,  // slight air resistance
    density:      0.003,  // heavier than Matter.js default (0.001)
    render: { fillStyle: 'transparent' },
    // Custom properties (attach directly to body after creation):
    // body.blockType = type
    // body.health = BLOCK_HEALTH[type]
    // body.maxHealth = BLOCK_HEALTH[type]
    // body.damageAccum = 0
  });
}

const BLOCK_HEALTH = {
  '1x1': 1,
  '1x2': 2,
  '2x1': 2,
  '2x2': 3,
  '3x1': 2,
};
```

### Pig / Bunker

```js
function createPig(x, y, variant) {
  // Pigs are rectangles with a rounded top — approximate with a rectangle
  // Visual rounding is handled in the renderer, not the physics body
  const sizes = {
    standard:   { w: 44, h: 38 },
    fortified:  { w: 60, h: 50 },
  };
  const { w, h } = sizes[variant];

  return Matter.Bodies.rectangle(x, y, w, h, {
    label: 'pig',
    restitution:  0.20,
    friction:     0.60,
    frictionAir:  0.012,
    density:      0.004,
    render: { fillStyle: 'transparent' },
    // Custom properties:
    // body.pigVariant = variant
    // body.health = PIG_HEALTH[variant]
    // body.maxHealth = PIG_HEALTH[variant]
    // body.dead = false
  });
}

const PIG_HEALTH = {
  standard:  1,
  fortified: 2,
};

const PIG_SCORE = {
  standard:  200,
  fortified: 350,
};
```

### Wrecking Ball

Three variants with different physics. All are circles.

```js
const BALL_DEFS = {
  standard: {
    radius: 14,
    mass: 8,          // override density with explicit mass
    restitution: 0.35,
    frictionAir: 0.005,
    piercing: false,
    blastRadius: 0,
    blastDelay: 0,
  },
  heavy: {
    radius: 18,
    mass: 18,
    restitution: 0.15,
    frictionAir: 0.003,
    piercing: true,   // passes through first block it destroys
    blastRadius: 0,
    blastDelay: 0,
  },
  charge: {
    radius: 14,
    mass: 7,
    restitution: 0.30,
    frictionAir: 0.006,
    piercing: false,
    blastRadius: 120, // px — area damage radius on detonation
    blastDelay: 0.6,  // seconds after first impact before detonation
  },
};

function createBall(variant) {
  const def = BALL_DEFS[variant];
  const body = Matter.Bodies.circle(
    SLINGSHOT_ORIGIN.x,
    SLINGSHOT_ORIGIN.y,
    def.radius,
    {
      label: 'ball',
      restitution:  def.restitution,
      frictionAir:  def.frictionAir,
      render: { fillStyle: 'transparent' },
    }
  );
  Matter.Body.setMass(body, def.mass);
  body.ballVariant = variant;
  body.def = def;
  body.hasImpacted = false;
  body.detonationTimer = null;
  return body;
}
```

---

## Slingshot & Launch

```js
// Slingshot anchor — fixed world position

       // px — maximum stretch distance
const { MAX_LAUNCH_SPEED, MAX_PULL_DIST, SLINGSHOT_ORIGIN } = CONSTANTS;     // px/frame at 60fps

function getLaunchVelocity(pullVec, pullDist) {
  // pullVec: normalized {x, y} pointing FROM hand TO slingshot origin
  // pullDist: 0–MAX_PULL_DIST
  const tension = pullDist / MAX_PULL_DIST;            // 0–1
  const speed = tension * MAX_LAUNCH_SPEED;
  return {
    x: pullVec.x * speed,
    y: pullVec.y * speed,
  };
}

function launchBall(ball, pullVec, pullDist) {
  const velocity = getLaunchVelocity(pullVec, pullDist);
  Matter.Body.setVelocity(ball, velocity);
  Matter.Body.setPosition(ball, { ...SLINGSHOT_ORIGIN });
  Matter.World.add(engine.world, ball);
}
```

---

## Trajectory Arc Preview

Drawn on the canvas each frame while the player is pulling back. Uses projectile motion — no physics simulation needed, just math.

```js
function getTrajectoryPoints(pullVec, pullDist, steps = 40, stepTime = 3) {
  // stepTime: how many physics frames to skip per arc point
  // Higher = longer arc preview, less resolution
  const velocity = getLaunchVelocity(pullVec, pullDist);
  const gravity = engine.gravity.y * 0.001 * (stepTime * stepTime);
  // Matter.js gravity is applied as px/frame², scale accordingly

  const points = [];
  let x = SLINGSHOT_ORIGIN.x;
  let y = SLINGSHOT_ORIGIN.y;
  let vx = velocity.x;
  let vy = velocity.y;

  for (let i = 0; i < steps; i++) {
    points.push({ x, y });
    x += vx * stepTime;
    y += vy * stepTime;
    vy += engine.gravity.y * stepTime;   // gravity accumulates each step

    // Stop arc preview at ground level
    if (y > 720) break;
  }
  return points;
}

// Drawing — call this in the render loop while state.dragging
function drawTrajectoryArc(ctx, points) {
  if (points.length < 2) return;
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // Arrowhead at last point
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  ctx.setLineDash([]);
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(last.x - 10 * Math.cos(angle - 0.4), last.y - 10 * Math.sin(angle - 0.4));
  ctx.lineTo(last.x - 10 * Math.cos(angle + 0.4), last.y - 10 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
```

---

## Collision Handling

### Force threshold

Matter.js collision events provide `pairs[i].collision.depth` (penetration depth) and relative velocity. Use relative velocity magnitude to calculate impact force.

```js
Matter.Events.on(engine, 'collisionStart', (event) => {
  event.pairs.forEach(pair => {
    const { bodyA, bodyB } = pair;
    const relVel = Matter.Vector.magnitude(
      Matter.Vector.sub(bodyA.velocity, bodyB.velocity)
    );

    // Ball hitting something
    if (bodyA.label === 'ball' || bodyB.label === 'ball') {
      const ball    = bodyA.label === 'ball' ? bodyA : bodyB;
      const other   = ball === bodyA ? bodyB : bodyA;
      handleBallImpact(ball, other, relVel);
    }

    // Block hitting block / ground (structural collapse damage)
    if (bodyA.label === 'block' || bodyB.label === 'block') {
      const block = bodyA.label === 'block' ? bodyA : bodyB;
      const other = block === bodyA ? bodyB : bodyA;
      if (other.label === 'block' || other.label === 'ground') {
        handleBlockImpact(block, relVel);
      }
    }
  });
});
```

### Ball impact handler

```js
const { BALL_DAMAGE_THRESHOLD, BLOCK_COLLAPSE_THRESHOLD, SETTLE_SPEED_THRESHOLD, SETTLE_FRAMES_REQUIRED, BALL_TIMEOUT_MS } = CONSTANTS;     // min relative velocity to deal damage
const BLOCK_DAMAGE_FROM_BALL = 1;    // damage per ball hit (regardless of speed above threshold)
const PIG_DAMAGE_FROM_BALL   = 1;

function handleBallImpact(ball, other, relVel) {
  if (relVel < BALL_DAMAGE_THRESHOLD) return;
  if (ball.hasImpacted && !ball.def.piercing) return;

  if (other.label === 'block') {
    damageBlock(other, BLOCK_DAMAGE_FROM_BALL);
    triggerShockwave(ball.position, 60);
    if (!ball.hasImpacted) {
      ball.hasImpacted = true;
      if (ball.def.blastDelay > 0) {
        scheduleDetonation(ball);
      }
    }
  }

  if (other.label === 'pig') {
    damagePig(other, PIG_DAMAGE_FROM_BALL);
    triggerShockwave(ball.position, 50);
    ball.hasImpacted = true;
  }
}
```

### Block damage handler (structural collapse)

```js
    // velocity for block-on-block damage
const BLOCK_DAMAGE_FROM_COLLAPSE = 1;

function handleBlockImpact(block, relVel) {
  if (relVel < BLOCK_COLLAPSE_THRESHOLD) return;
  // Accumulate damage — blocks can be weakened by multiple small impacts
  block.damageAccum += relVel * 0.05;
  if (block.damageAccum >= 1) {
    block.damageAccum = 0;
    damageBlock(block, BLOCK_DAMAGE_FROM_COLLAPSE);
  }
}
```

### Damage and destruction

```js
function damageBlock(block, amount) {
  block.health -= amount;
  updateBlockVisual(block);   // renderer reads block.health / block.maxHealth
  if (block.health <= 0) destroyBlock(block);
}

function destroyBlock(block) {
  Matter.World.remove(engine.world, block);
  spawnFragments(block.position, block.blockType);
  spawnDustCloud(block.position);
  addScore(BLOCK_SCORE[block.blockType]);
  checkLevelComplete();
}

const BLOCK_SCORE = {
  '1x1': 50,
  '1x2': 80,
  '2x1': 80,
  '2x2': 120,
  '3x1': 100,
};

function damagePig(pig, amount) {
  if (pig.dead) return;
  pig.health -= amount;
  updatePigVisual(pig);
  if (pig.health <= 0) destroyPig(pig);
}

function destroyPig(pig) {
  pig.dead = true;
  updatePigVisual(pig);        // renderer shows death state
  setTimeout(() => {
    Matter.World.remove(engine.world, pig);
    checkLevelComplete();
  }, 600);                     // slight delay so death animation plays
  addScore(PIG_SCORE[pig.pigVariant]);
}
```

---

## Fragment System

When a block is destroyed, spawn 4–6 small physics bodies that scatter outward, then fade and remove.

```js
const FRAGMENT_COUNT = { '1x1': 4, '1x2': 5, '2x2': 6, '2x1': 5, '3x1': 6 };

function spawnFragments(position, blockType) {
  const count = FRAGMENT_COUNT[blockType] ?? 4;
  const fragments = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const speed = 3 + Math.random() * 5;
    const size  = 6 + Math.random() * 10;

    const frag = Matter.Bodies.rectangle(
      position.x + (Math.random() - 0.5) * 20,
      position.y + (Math.random() - 0.5) * 20,
      size, size,
      {
        label: 'fragment',
        restitution: 0.4,
        friction: 0.5,
        frictionAir: 0.04,
        render: { fillStyle: 'transparent' },
        collisionFilter: { mask: 0x0001 },  // only collide with ground
      }
    );

    Matter.Body.setVelocity(frag, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed - 3,   // slight upward bias
    });

    frag.isFragment = true;
    frag.createdAt = Date.now();
    fragments.push(frag);
    Matter.World.add(engine.world, frag);
  }

  // Remove fragments after 3 seconds
  setTimeout(() => {
    fragments.forEach(f => Matter.World.remove(engine.world, f));
  }, 3000);
}
```

---

## Charge Ball Detonation

```js
function scheduleDetonation(ball) {
  ball.detonationTimer = setTimeout(() => {
    detonateBall(ball);
  }, ball.def.blastDelay * 1000);
}

function detonateBall(ball) {
  const pos = ball.position;
  const radius = ball.def.blastRadius;

  triggerShockwave(pos, radius);
  spawnDustCloud(pos, radius * 0.5);

  // Apply blast force to all bodies within radius
  Matter.Composite.allBodies(engine.world).forEach(body => {
    if (body.isStatic || body.label === 'ball') return;
    const dist = Matter.Vector.magnitude(Matter.Vector.sub(body.position, pos));
    if (dist < radius) {
      const falloff = 1 - (dist / radius);
      const force = falloff * 0.06;
      const dir = Matter.Vector.normalise(Matter.Vector.sub(body.position, pos));
      Matter.Body.applyForce(body, body.position, {
        x: dir.x * force,
        y: dir.y * force - 0.02,   // upward bias on blast
      });

      // Damage nearby blocks and pigs
      if (body.label === 'block') damageBlock(body, falloff > 0.6 ? 2 : 1);
      if (body.label === 'pig')   damagePig(body, falloff > 0.5 ? 2 : 1);
    }
  });

  Matter.World.remove(engine.world, ball);
}
```

---

## Ball Settle Detection

The game needs to know when a launched ball has stopped moving so it can advance the bird queue and check level state.

```js
// see CONSTANTS;     // px/frame — below this = "settled"
     // consecutive frames below threshold
   // hard timeout in case ball gets stuck

function watchForSettle(ball) {
  let settleFrames = 0;

  const hardTimeout = setTimeout(() => {
    onBallSettled(ball);
  }, BALL_TIMEOUT_MS);

  function checkSettle() {
    if (!engine.world.bodies.includes(ball)) return;  // already removed
    const speed = Matter.Vector.magnitude(ball.velocity);
    if (speed < SETTLE_SPEED_THRESHOLD) {
      settleFrames++;
      if (settleFrames >= SETTLE_FRAMES_REQUIRED) {
        clearTimeout(hardTimeout);
        onBallSettled(ball);
        return;
      }
    } else {
      settleFrames = 0;
    }
    requestAnimationFrame(checkSettle);
  }
  requestAnimationFrame(checkSettle);
}

function onBallSettled(ball) {
  // Remove ball from world
  if (engine.world.bodies.includes(ball)) {
    Matter.World.remove(engine.world, ball);
  }
  // Advance game state
  advanceBirdQueue();
}
```

---

## Shockwave Effect

Not a physics body — purely visual, drawn on the canvas overlay.

```js
const activeShockwaves = [];

function triggerShockwave(position, maxRadius) {
  activeShockwaves.push({
    x: position.x,
    y: position.y,
    radius: 0,
    maxRadius,
    opacity: 0.8,
    createdAt: Date.now(),
    duration: 400,   // ms
  });
}

// Call in render loop
function drawShockwaves(ctx) {
  const now = Date.now();
  for (let i = activeShockwaves.length - 1; i >= 0; i--) {
    const s = activeShockwaves[i];
    const progress = (now - s.createdAt) / s.duration;
    if (progress >= 1) {
      activeShockwaves.splice(i, 1);
      continue;
    }
    const eased = 1 - Math.pow(1 - progress, 3);   // ease out cubic
    ctx.save();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2 * (1 - progress);
    ctx.globalAlpha = s.opacity * (1 - progress);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.maxRadius * eased, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
```

---

## Dust Cloud Effect

```js
const activeDustClouds = [];

function spawnDustCloud(position, radius = 40) {
  const particles = [];
  const count = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x: position.x + (Math.random() - 0.5) * 20,
      y: position.y + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 6 + Math.random() * (radius * 0.4),
      opacity: 0.4 + Math.random() * 0.3,
    });
  }
  activeDustClouds.push({
    particles,
    createdAt: Date.now(),
    duration: 1200,
  });
}

function drawDustClouds(ctx) {
  const now = Date.now();
  for (let i = activeDustClouds.length - 1; i >= 0; i--) {
    const cloud = activeDustClouds[i];
    const progress = (now - cloud.createdAt) / cloud.duration;
    if (progress >= 1) { activeDustClouds.splice(i, 1); continue; }

    cloud.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;           // gentle gravity on dust
      p.vx *= 0.98;           // air resistance

      ctx.save();
      ctx.globalAlpha = p.opacity * (1 - progress);
      ctx.fillStyle = '#C8C0A8';   // --color-concrete-dust
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}
```

---

## Score System

```js
let currentScore = 0;
const scorePopups = [];

function addScore(amount) {
  currentScore += amount;
  updateScoreDisplay(currentScore);
}

function addScoreAtPosition(amount, x, y) {
  addScore(amount);
  scorePopups.push({ amount, x, y, createdAt: Date.now(), duration: 800 });
}

function drawScorePopups(ctx) {
  const now = Date.now();
  for (let i = scorePopups.length - 1; i >= 0; i--) {
    const p = scorePopups[i];
    const progress = (now - p.createdAt) / p.duration;
    if (progress >= 1) { scorePopups.splice(i, 1); continue; }
    const y = p.y - 40 * progress;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = '#111111';
    ctx.font = `bold 14px Impact, sans-serif`;
    ctx.letterSpacing = '0.08em';
    ctx.textAlign = 'center';
    ctx.fillText(`+${p.amount}`, p.x, y);
    ctx.restore();
  }
}
```

---

## Level Complete Check

```js
function checkLevelComplete() {
  const pigs = Matter.Composite.allBodies(engine.world)
    .filter(b => b.label === 'pig' && !b.dead);

  if (pigs.length === 0) {
    // All pigs dead — wait for any in-flight balls to settle then trigger
    setTimeout(() => triggerLevelComplete(), 800);
  }
}

function triggerLevelComplete() {
  const birdsRemaining = state.birdQueue.filter(b => b.status === 'unused').length;
  const birdsBonus = birdsRemaining * 400;
  addScore(birdsBonus);

  const stars = birdsRemaining >= 1 ? 3
              : state.birdQueue.every(b => b.status !== 'unused') ? 2
              : 1;

  emitGameEvent('LEVEL_COMPLETE', { score: currentScore, stars, birdsRemaining });
}
```

---

## Physics Tuning Notes

These values are starting points. Tune in this order:

1. **Gravity (1.8)** — if structures feel like they're falling on the moon, increase to 2.2. If they collapse too fast before the player launches, decrease to 1.5.

2. **MAX_LAUNCH_SPEED (28)** — if the ball feels like it can't reach the right side of long levels, increase to 32. If it always overshoots, decrease to 24.

3. **Block density (0.003)** — if tall structures wobble and fall on their own, decrease to 0.002. If they never topple from impact, increase to 0.004.

4. **BALL_DAMAGE_THRESHOLD (4)** — if glancing shots deal damage, increase. If direct hits sometimes deal no damage, decrease to 3.

5. **Fragment count** — purely visual. Adjust freely without affecting gameplay.

Do not tune during level design — lock physics first, then author levels.
