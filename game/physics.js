import { CONSTANTS } from "../constants.js";

function emitSceneEvent(scene, type, detail = {}) {
  scene.onEvent?.(type, detail);
}

function getMatter() {
  if (!window.Matter) {
    throw new Error("Matter.js is not available.");
  }

  return window.Matter;
}

function makeBirdQueue(birds = []) {
  return birds.map((variant, index) => ({
    variant,
    status: index === 0 ? "active" : "unused",
  }));
}

function createBounds(Matter) {
  return [
    Matter.Bodies.rectangle(
      CONSTANTS.CANVAS_W / 2,
      CONSTANTS.GROUND_Y + 20,
      CONSTANTS.CANVAS_W,
      40,
      { isStatic: true, label: "ground" },
    ),
    Matter.Bodies.rectangle(-20, CONSTANTS.CANVAS_H / 2, 40, CONSTANTS.CANVAS_H, {
      isStatic: true,
      label: "wall",
    }),
    Matter.Bodies.rectangle(
      CONSTANTS.CANVAS_W + 20,
      CONSTANTS.CANVAS_H / 2,
      40,
      CONSTANTS.CANVAS_H,
      { isStatic: true, label: "wall" },
    ),
  ];
}

function createBlock(scene, x, y, type) {
  const Matter = scene.Matter;
  const { w, h } = CONSTANTS.BLOCK_SIZES[type] ?? CONSTANTS.BLOCK_SIZES["1x1"];
  const body = Matter.Bodies.rectangle(x, y, w, h, {
    label: "block",
    restitution: CONSTANTS.BLOCK_PHYSICS.restitution,
    friction: CONSTANTS.BLOCK_PHYSICS.friction,
    frictionAir: CONSTANTS.BLOCK_PHYSICS.frictionAir,
    density: CONSTANTS.BLOCK_PHYSICS.density,
  });

  body.blockType = type;
  body.health = CONSTANTS.BLOCK_HEALTH[type];
  body.maxHealth = CONSTANTS.BLOCK_HEALTH[type];
  body.damageAccum = 0;
  body.crackVariant = Math.floor(Math.random() * 3);

  return body;
}

function createPig(scene, x, y, variant) {
  const Matter = scene.Matter;
  const { w, h } = CONSTANTS.PIG_SIZES[variant] ?? CONSTANTS.PIG_SIZES.standard;
  const body = Matter.Bodies.rectangle(x, y, w, h, {
    label: "pig",
    restitution: CONSTANTS.PIG_PHYSICS.restitution,
    friction: CONSTANTS.PIG_PHYSICS.friction,
    frictionAir: CONSTANTS.PIG_PHYSICS.frictionAir,
    density: CONSTANTS.PIG_PHYSICS.density,
  });

  body.pigVariant = variant;
  body.health = CONSTANTS.PIG_HEALTH[variant];
  body.maxHealth = CONSTANTS.PIG_HEALTH[variant];
  body.dead = false;

  return body;
}

function createBall(scene, variant) {
  const Matter = scene.Matter;
  const def = CONSTANTS.BALL[variant] ?? CONSTANTS.BALL.standard;
  const body = Matter.Bodies.circle(
    CONSTANTS.SLINGSHOT_ORIGIN.x,
    CONSTANTS.SLINGSHOT_ORIGIN.y,
    def.radius,
    {
      label: "ball",
      restitution: def.restitution,
      frictionAir: def.frictionAir,
    },
  );

  Matter.Body.setMass(body, def.mass);
  body.ballVariant = variant;
  body.def = def;
  body.hasImpacted = false;
  body._chargeScheduled = false;
  return body;
}

function createFragment(scene, position, angle, speed, size) {
  const Matter = scene.Matter;
  const fragment = Matter.Bodies.rectangle(position.x, position.y, size, size * 0.72, {
    label: "fragment",
    restitution: 0.2,
    friction: 0.6,
    frictionAir: 0.02,
    density: 0.0015,
  });

  Matter.Body.setVelocity(fragment, {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  });
  fragment.createdAt = performance.now();
  scene.fragments.push(fragment);
  Matter.World.add(scene.world, fragment);

  const timer = window.setTimeout(() => {
    removeBody(scene, fragment);
  }, CONSTANTS.FRAGMENT_REMOVE_MS);
  scene.activeTimers.add(timer);
}

function createShockwave(scene, position, radius) {
  scene.shockwaves.push({
    x: position.x,
    y: position.y,
    radius,
    startedAt: performance.now(),
  });
}

function removeBody(scene, body) {
  if (!body) return;

  scene.Matter.World.remove(scene.world, body);
  scene.blocks = scene.blocks.filter((entry) => entry !== body);
  scene.pigs = scene.pigs.filter((entry) => entry !== body);
  scene.fragments = scene.fragments.filter((entry) => entry !== body);

  if (scene.currentBall === body) {
    scene.currentBall = null;
  }
}

function buildLevel(scene, level) {
  const bodies = [];

  level.structures.forEach((structure) => {
    structure.blocks.forEach((block) => {
      const body = createBlock(scene, block.x, block.y, block.type);
      scene.blocks.push(body);
      bodies.push(body);
    });

    structure.pigs.forEach((pig) => {
      const body = createPig(scene, pig.x, pig.y, pig.variant);
      scene.pigs.push(body);
      bodies.push(body);
    });
  });

  scene.Matter.World.add(scene.world, bodies);
}

function getActiveBird(scene) {
  return scene.birdQueue.find((bird) => bird.status === "active") ?? null;
}

function setNextActiveBird(scene) {
  const nextBird = scene.birdQueue.find((bird) => bird.status === "unused");
  if (nextBird) {
    nextBird.status = "active";
    scene.subState = "READY";
    scene.statusText = "PINCH IN-ZONE TO ARM THE NEXT SHOT.";
    return true;
  }

  scene.subState = scene.pigs.length === 0 ? "SITE_CLEAR" : "OUT_OF_BIRDS";
  scene.statusText =
    scene.pigs.length === 0
      ? "SITE CLEARED. MOVE TO THE NEXT TEST SITE."
      : "NO CHARGES LEFT. RESET OR MOVE TO ANOTHER SITE.";
  return false;
}

function getLaunchVelocity(pullVector, pullDistance) {
  const tension = pullDistance / CONSTANTS.MAX_PULL_DIST;
  const speed = tension * CONSTANTS.MAX_LAUNCH_SPEED;
  return {
    x: pullVector.x * speed,
    y: pullVector.y * speed,
  };
}

function getTrajectoryPoints(scene, pullVector, pullDistance, steps = 40, stepTime = 3) {
  const points = [];
  const velocity = getLaunchVelocity(pullVector, pullDistance);
  let x = scene.pull.position.x;
  let y = scene.pull.position.y;
  let vx = velocity.x;
  let vy = velocity.y;

  for (let index = 0; index < steps; index += 1) {
    points.push({ x, y });
    x += vx * stepTime;
    y += vy * stepTime;
    vy += scene.engine.gravity.y * stepTime;

    if (y > CONSTANTS.CANVAS_H) break;
  }

  return points;
}

function clampPull(point) {
  const dx = CONSTANTS.SLINGSHOT_ORIGIN.x - Math.min(point.x, CONSTANTS.SLINGSHOT_ORIGIN.x);
  const dy = CONSTANTS.SLINGSHOT_ORIGIN.y - point.y;
  const distance = Math.min(Math.hypot(dx, dy), CONSTANTS.MAX_PULL_DIST);
  const safeDistance = Math.max(distance, 0.0001);
  const vector = {
    x: dx / safeDistance,
    y: dy / safeDistance,
  };

  return {
    distance,
    vector,
    position: {
      x: CONSTANTS.SLINGSHOT_ORIGIN.x - vector.x * distance,
      y: CONSTANTS.SLINGSHOT_ORIGIN.y - vector.y * distance,
    },
  };
}

function resetPull(scene) {
  scene.dragging = false;
  scene.dragSource = null;
  scene.tension = 0;
  scene.trajectoryPoints = [];
  scene.pull = {
    distance: 0,
    vector: { x: 1, y: 0 },
    position: { ...CONSTANTS.SLINGSHOT_ORIGIN },
  };
}

function beginDrag(scene, source, point, message) {
  if (scene.subState !== "READY") return false;

  scene.dragging = true;
  scene.dragSource = source;
  scene.subState = "DRAGGING";
  scene.inputMode = source === "gesture" ? "GESTURE" : "MOUSE";
  scene.statusText = message;
  updateDragging(scene, point);
  if (source === "gesture") {
    emitSceneEvent(scene, "PINCH_START");
  }
  return true;
}

function cancelDrag(scene, message) {
  resetPull(scene);
  scene.subState = "READY";
  scene.statusText = message;
}

function completeShot(scene, message) {
  emitSceneEvent(scene, "CHARGE_FUSE_STOP");
  if (scene.currentBall) {
    removeBody(scene, scene.currentBall);
  }

  scene.settleFrames = 0;
  scene.launchStartedAt = 0;

  const activeBird = getActiveBird(scene);
  if (activeBird) {
    activeBird.status = "used";
  }

  resetPull(scene);

  if (scene.pigs.length === 0) {
    scene.subState = "SITE_CLEAR";
    scene.statusText = "SITE CLEARED. MOVE TO THE NEXT TEST SITE.";
    return;
  }

  setNextActiveBird(scene);
  if (message && scene.subState === "READY") {
    scene.statusText = message;
  }
}

function damageBlock(scene, block, amount) {
  if (!block || block._removed) return;

  block.health -= amount;
  emitSceneEvent(scene, "BLOCK_DAMAGED", {
    blockType: block.blockType,
    health: block.health,
    maxHealth: block.maxHealth,
  });
  if (block.health <= 0) {
    block._removed = true;
    destroyBlock(scene, block);
  }
}

function destroyBlock(scene, block) {
  const countMap = { "1x1": 4, "1x2": 5, "2x1": 5, "2x2": 6, "3x1": 6 };
  const fragmentCount = countMap[block.blockType] ?? 4;

  for (let index = 0; index < fragmentCount; index += 1) {
    const angle = (index / fragmentCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
    const speed = 3 + Math.random() * 5;
    const size = 8 + Math.random() * 10;
    createFragment(scene, block.position, angle, speed, size);
  }

  createShockwave(scene, block.position, 48);
  scene.score += CONSTANTS.BLOCK_SCORE[block.blockType] ?? 0;
  emitSceneEvent(scene, "BLOCK_DESTROYED", {
    blockType: block.blockType,
    score: scene.score,
  });
  removeBody(scene, block);
}

function damagePig(scene, pig, amount) {
  if (!pig || pig.dead) return;

  pig.health -= amount;
  emitSceneEvent(scene, "PIG_DAMAGED", {
    variant: pig.pigVariant,
    health: pig.health,
    maxHealth: pig.maxHealth,
  });
  if (pig.health <= 0) {
    pig.dead = true;
    scene.score += CONSTANTS.PIG_SCORE[pig.pigVariant] ?? 0;
    createShockwave(scene, pig.position, 42);
    emitSceneEvent(scene, "PIG_DESTROYED", {
      variant: pig.pigVariant,
      score: scene.score,
    });

    const timer = window.setTimeout(() => {
      removeBody(scene, pig);
      if (scene.pigs.length === 0 && !scene.currentBall) {
        scene.subState = "SITE_CLEAR";
        scene.statusText = "SITE CLEARED. MOVE TO THE NEXT TEST SITE.";
      }
    }, CONSTANTS.PIG_DEATH_REMOVE_MS);
    scene.activeTimers.add(timer);
  }
}

function detonateCharge(scene, ball) {
  if (!ball || scene.currentBall !== ball) return;

  const blastRadius = ball.def.blastRadius;
  createShockwave(scene, ball.position, blastRadius);
  emitSceneEvent(scene, "CHARGE_DETONATE", { radius: blastRadius });

  scene.blocks.slice().forEach((block) => {
    const distance = scene.Matter.Vector.magnitude(
      scene.Matter.Vector.sub(block.position, ball.position),
    );
    if (distance <= blastRadius) {
      damageBlock(scene, block, 1);
    }
  });

  scene.pigs.slice().forEach((pig) => {
    const distance = scene.Matter.Vector.magnitude(
      scene.Matter.Vector.sub(pig.position, ball.position),
    );
    if (distance <= blastRadius) {
      damagePig(scene, pig, 1);
    }
  });

  completeShot(scene, "CHARGE DETONATED. NEXT BALL LOADED.");
}

function scheduleCharge(scene, ball) {
  if (ball._chargeScheduled || ball.def.blastDelay <= 0) return;
  ball._chargeScheduled = true;
  emitSceneEvent(scene, "CHARGE_FUSE_START", { delay: ball.def.blastDelay });

  const timer = window.setTimeout(() => detonateCharge(scene, ball), ball.def.blastDelay * 1000);
  scene.activeTimers.add(timer);
}

function handleBallImpact(scene, ball, other, relVel) {
  if (relVel < CONSTANTS.BALL_DAMAGE_THRESHOLD) {
    emitSceneEvent(scene, "BALL_IMPACT_LIGHT", { velocity: relVel, target: other.label });
    return;
  }
  if (ball.hasImpacted && !ball.def.piercing) return;
  emitSceneEvent(scene, "BALL_IMPACT_HEAVY", { velocity: relVel, target: other.label });

  if (other.label === "block") {
    damageBlock(scene, other, CONSTANTS.BLOCK_DAMAGE_FROM_BALL);
    createShockwave(scene, ball.position, 60);
    if (!ball.hasImpacted) {
      ball.hasImpacted = true;
      scheduleCharge(scene, ball);
    }
  }

  if (other.label === "pig") {
    damagePig(scene, other, CONSTANTS.PIG_DAMAGE_FROM_BALL);
    createShockwave(scene, ball.position, 52);
    ball.hasImpacted = true;
    scheduleCharge(scene, ball);
  }
}

function handleBlockImpact(scene, block, relVel) {
  if (relVel < CONSTANTS.BLOCK_COLLAPSE_THRESHOLD || block._removed) return;

  block.damageAccum += relVel * 0.05;
  if (block.damageAccum >= 1) {
    block.damageAccum = 0;
    damageBlock(scene, block, CONSTANTS.BLOCK_DAMAGE_FROM_COLLAPSE);
  }
}

function bindCollisionHandlers(scene) {
  scene.Matter.Events.on(scene.engine, "collisionStart", (event) => {
    event.pairs.forEach((pair) => {
      const { bodyA, bodyB } = pair;
      const relVelocity = scene.Matter.Vector.magnitude(
        scene.Matter.Vector.sub(bodyA.velocity, bodyB.velocity),
      );

      if (bodyA.label === "ball" || bodyB.label === "ball") {
        const ball = bodyA.label === "ball" ? bodyA : bodyB;
        const other = ball === bodyA ? bodyB : bodyA;
        handleBallImpact(scene, ball, other, relVelocity);
      }

      if (bodyA.label === "block" || bodyB.label === "block") {
        const block = bodyA.label === "block" ? bodyA : bodyB;
        const other = block === bodyA ? bodyB : bodyA;
        if (other.label === "block" || other.label === "ground") {
          handleBlockImpact(scene, block, relVelocity);
        }
      }
    });
  });
}

function updateDragging(scene, point) {
  scene.pull = clampPull(point);
  scene.tension = scene.pull.distance / CONSTANTS.MAX_PULL_DIST;
  scene.trajectoryPoints = getTrajectoryPoints(scene, scene.pull.vector, scene.pull.distance);
}

function launch(scene) {
  const activeBird = getActiveBird(scene);
  if (!activeBird) return;

  const ball = createBall(scene, activeBird.variant);
  scene.Matter.Body.setPosition(ball, scene.pull.position);
  scene.Matter.Body.setVelocity(ball, getLaunchVelocity(scene.pull.vector, scene.pull.distance));
  scene.Matter.World.add(scene.world, ball);

  scene.currentBall = ball;
  scene.subState = "FLYING";
  scene.launchStartedAt = performance.now();
  scene.statusText = `BALL AWAY. ${activeBird.variant.toUpperCase()} ROUND IN FLIGHT.`;
  scene.inputMode = scene.dragSource === "gesture" ? "GESTURE" : "MOUSE";
  emitSceneEvent(scene, "LAUNCH", {
    variant: activeBird.variant,
    inputMode: scene.inputMode,
  });
  scene.dragging = false;
  scene.dragSource = null;
  scene.tension = 0;
  scene.trajectoryPoints = [];
}

function updateLaunchedBall(scene) {
  if (!scene.currentBall) return;

  const speed = scene.Matter.Vector.magnitude(scene.currentBall.velocity);

  if (speed < CONSTANTS.SETTLE_SPEED_THRESHOLD) {
    scene.settleFrames += 1;
  } else {
    scene.settleFrames = 0;
  }

  if (scene.settleFrames >= CONSTANTS.SETTLE_FRAMES_REQUIRED) {
    completeShot(scene, "SHOT SETTLED. NEXT BALL LOADED.");
    return;
  }

  if (performance.now() - scene.launchStartedAt > CONSTANTS.BALL_TIMEOUT_MS) {
    completeShot(scene, "SHOT TIMED OUT. NEXT BALL LOADED.");
  }
}

function cleanupOffscreenBodies(scene) {
  scene.blocks.slice().forEach((block) => {
    if (block.position.y > 840) {
      block._removed = true;
      destroyBlock(scene, block);
    }
  });

  scene.pigs.slice().forEach((pig) => {
    if (pig.position.y > 840) {
      damagePig(scene, pig, pig.health);
    }
  });

  scene.fragments.slice().forEach((fragment) => {
    if (fragment.position.y > 860) {
      removeBody(scene, fragment);
    }
  });

  if (scene.currentBall && scene.currentBall.position.y > 860) {
    completeShot(scene, "SHOT LOST OFF-SITE. NEXT BALL LOADED.");
  }
}

export function createPhysicsScene(level, hooks = {}) {
  const Matter = getMatter();
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: CONSTANTS.GRAVITY_Y },
    positionIterations: 10,
    velocityIterations: 8,
  });

  const scene = {
    Matter,
    engine,
    world: engine.world,
    level,
    onEvent: hooks.onEvent ?? null,
    blocks: [],
    pigs: [],
    fragments: [],
    shockwaves: [],
    birdQueue: makeBirdQueue(level.birds),
    currentBall: null,
    dragging: false,
    dragSource: null,
    tension: 0,
    trajectoryPoints: [],
    pull: {
      distance: 0,
      vector: { x: 1, y: 0 },
      position: { ...CONSTANTS.SLINGSHOT_ORIGIN },
    },
    score: 0,
    subState: "READY",
    statusText: "WAITING FOR PINCH INPUT. MOUSE DRAG IS STILL AVAILABLE.",
    inputMode: "GESTURE",
    outcomeHandled: false,
    settleFrames: 0,
    launchStartedAt: 0,
    activeTimers: new Set(),
    gesture: {
      trackerStatus: "BOOTING",
      activeHandLabel: "NONE",
      pinchEvent: "IDLE",
      pinchActive: false,
      handCenter: null,
      inZone: false,
    },
  };

  Matter.World.add(scene.world, createBounds(Matter));
  buildLevel(scene, level);
  bindCollisionHandlers(scene);

  return scene;
}

export function destroyPhysicsScene(scene) {
  if (!scene) return;

  scene.activeTimers.forEach((timer) => window.clearTimeout(timer));
  scene.activeTimers.clear();
  scene.Matter.World.clear(scene.world, false);
  scene.Matter.Engine.clear(scene.engine);
}

export function handlePointerEvent(scene, type, point) {
  if (!scene) return false;

  if (type === "down") {
    if (scene.subState !== "READY" || scene.dragSource === "gesture") return false;
    const distance = Math.hypot(
      point.x - CONSTANTS.SLINGSHOT_ORIGIN.x,
      point.y - CONSTANTS.SLINGSHOT_ORIGIN.y,
    );
    if (distance > CONSTANTS.SLINGSHOT_ZONE_RADIUS) return false;

    return beginDrag(scene, "mouse", point, "MOUSE DRAG ACTIVE. RELEASE TO FIRE.");
  }

  if (type === "move" && scene.dragging && scene.dragSource === "mouse") {
    updateDragging(scene, point);
    return true;
  }

  if (type === "up" && scene.dragging && scene.dragSource === "mouse") {
    if (scene.pull.distance > 6) {
      launch(scene);
    } else {
      cancelDrag(scene, "DRAG FARTHER TO ARM THE SHOT.");
    }
    return true;
  }

  return false;
}

export function handleGestureFrame(scene, gestureFrame) {
  if (!scene) return;

  scene.gesture = {
    trackerStatus: gestureFrame.trackerStatus ?? scene.gesture.trackerStatus,
    activeHandLabel: gestureFrame.activeHand?.label?.toUpperCase() ?? "NONE",
    pinchEvent: gestureFrame.pinchState?.event ?? "IDLE",
    pinchActive: Boolean(gestureFrame.pinchState?.active),
    handCenter: gestureFrame.handCenter ?? null,
    inZone: Boolean(gestureFrame.inZone),
  };

  if (!gestureFrame.activeHand) {
    if (scene.dragging && scene.dragSource === "gesture") {
      cancelDrag(scene, "HAND LOST. BALL RESET TO SLINGSHOT.");
    }
    return;
  }

  if (
    gestureFrame.pinchState?.event === "PINCH_START" &&
    gestureFrame.inZone &&
    scene.subState === "READY"
  ) {
    beginDrag(scene, "gesture", gestureFrame.handCenter, "PINCH LOCKED. PULL BACK TO ARM.");
    return;
  }

  if (gestureFrame.pinchState?.event === "PINCH_HOLD" && scene.dragSource === "gesture") {
    updateDragging(scene, gestureFrame.handCenter);
    scene.statusText = "PINCH HELD. RELEASE TO FIRE.";
    return;
  }

  if (gestureFrame.pinchState?.event === "PINCH_RELEASE" && scene.dragSource === "gesture") {
    if (scene.pull.distance > 6) {
      launch(scene);
    } else {
      cancelDrag(scene, "PINCH TOO SHORT. RESET TO SLINGSHOT.");
    }
  }
}

export function stepPhysicsScene(scene, deltaMs) {
  if (!scene) return;

  scene.Matter.Engine.update(scene.engine, deltaMs);
  cleanupOffscreenBodies(scene);
  updateLaunchedBall(scene);
  scene.shockwaves = scene.shockwaves.filter(
    (wave) => performance.now() - wave.startedAt < CONSTANTS.SHOCKWAVE_DURATION_MS,
  );
}
