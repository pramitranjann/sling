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
      CONSTANTS.GROUND_VISIBLE_Y + 20,
      CONSTANTS.CANVAS_W,
      40,
      { isStatic: true, label: "ground" },
    ),
  ];
}

function createBlock(scene, x, y, type) {
  const Matter = scene.Matter;
  const { w, h } = CONSTANTS.BLOCK_SIZES[type] ?? CONSTANTS.BLOCK_SIZES["1x1"];
  const body = Matter.Bodies.rectangle(x, y + CONSTANTS.LEVEL_Y_OFFSET, w, h, {
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
  const body = Matter.Bodies.rectangle(x, y + CONSTANTS.LEVEL_Y_OFFSET, w, h, {
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

function getBodySize(body) {
  if (body.label === "block") {
    return CONSTANTS.BLOCK_SIZES[body.blockType] ?? CONSTANTS.BLOCK_SIZES["1x1"];
  }

  if (body.label === "pig") {
    return CONSTANTS.PIG_SIZES[body.pigVariant] ?? CONSTANTS.PIG_SIZES.standard;
  }

  const bounds = body.bounds;
  return {
    w: bounds.max.x - bounds.min.x,
    h: bounds.max.y - bounds.min.y,
  };
}

function placePigOnSupport(scene, pig) {
  const pigSize = getBodySize(pig);
  const supportTop = scene.blocks.reduce((bestTop, block) => {
    const blockSize = getBodySize(block);
    const horizontalGap = Math.abs(block.position.x - pig.position.x);
    const supportedWidth = (blockSize.w + pigSize.w) * 0.5 - 4;
    if (horizontalGap > supportedWidth) {
      return bestTop;
    }

    const blockTop = block.position.y - blockSize.h * 0.5;
    if (blockTop >= pig.position.y) {
      return bestTop;
    }

    return Math.min(bestTop, blockTop);
  }, CONSTANTS.GROUND_VISIBLE_Y);

  scene.Matter.Body.setPosition(pig, {
    x: pig.position.x,
    y: supportTop - pigSize.h * 0.5 - CONSTANTS.PIG_SPAWN_CLEARANCE,
  });
  scene.Matter.Body.setVelocity(pig, { x: 0, y: 0 });
  scene.Matter.Body.setAngularVelocity(pig, 0);
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
      placePigOnSupport(scene, body);
      scene.pigs.push(body);
      bodies.push(body);
    });
  });

  scene.Matter.World.add(scene.world, bodies);
}

function getActiveBird(scene) {
  return scene.birdQueue.find((bird) => bird.status === "active") ?? null;
}

function getTryLabel(scene) {
  return `TRY ${Math.min(scene.tryCount, 3)}`;
}

function getReadyTryPrompt(scene) {
  return `${getTryLabel(scene)}. PINCH AND PULL TO START THE SHOT.`;
}

function getLostHandPrompt(scene) {
  return `${getTryLabel(scene)}. HAND LOST. BRING IT BACK, THEN PINCH AND PULL AGAIN.`;
}

function getShortPullPrompt(scene) {
  return `${getTryLabel(scene)}. TOO SHORT. PINCH AND PULL AGAIN.`;
}

function advanceTry(scene, emitOverlay = true) {
  scene.tryCount = Math.min(scene.tryCount + 1, 3);
  scene.tryActive = false;
  scene.handLostReset = false;
  if (emitOverlay) {
    emitSceneEvent(scene, "TRY_ADVANCE", { tryCount: scene.tryCount });
  }
}

function setNextActiveBird(scene) {
  const nextBird = scene.birdQueue.find((bird) => bird.status === "unused");
  if (nextBird) {
    nextBird.status = "active";
    advanceTry(scene);
    scene.subState = "READY";
    scene.statusText = getReadyTryPrompt(scene);
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
  const Matter = scene.Matter;
  const activeBird = getActiveBird(scene);
  const ballDef = CONSTANTS.BALL[activeBird?.variant] ?? CONSTANTS.BALL.standard;
  const velocity = getLaunchVelocity(pullVector, pullDistance);
  const simEngine = Matter.Engine.create({
    gravity: {
      x: scene.engine.gravity.x,
      y: scene.engine.gravity.y,
      scale: scene.engine.gravity.scale,
    },
  });
  const simBall = Matter.Bodies.circle(
    scene.pull.position.x,
    scene.pull.position.y,
    ballDef.radius,
    {
      restitution: ballDef.restitution,
      frictionAir: ballDef.frictionAir,
    },
  );

  Matter.Body.setMass(simBall, ballDef.mass);
  Matter.Body.setVelocity(simBall, velocity);
  Matter.World.add(simEngine.world, simBall);

  for (let index = 0; index < steps * stepTime; index += 1) {
    if (index % stepTime === 0) {
      points.push({ x: simBall.position.x, y: simBall.position.y });
    }

    Matter.Engine.update(simEngine, 1000 / 60);

    if (
      simBall.position.y > CONSTANTS.CANVAS_H ||
      simBall.position.x > CONSTANTS.CANVAS_W + 120 ||
      simBall.position.x < -120
    ) {
      break;
    }
  }

  Matter.Engine.clear(simEngine);
  return points;
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y } : null;
}

function averagePoints(points) {
  if (!points.length) return null;

  const total = points.reduce(
    (acc, point) => {
      acc.x += point.x;
      acc.y += point.y;
      return acc;
    },
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
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
  scene.pointerType = "mouse";
  scene.dragAnchor = null;
  scene.dragSamples = [];
  scene.gestureLock = null;
  scene.tension = 0;
  scene.trajectoryPoints = [];
  scene.pull = {
    distance: 0,
    vector: { x: 1, y: 0 },
    position: { ...CONSTANTS.SLINGSHOT_ORIGIN },
  };
  scene.band = {
    position: { ...CONSTANTS.SLINGSHOT_ORIGIN },
    velocity: { x: 0, y: 0 },
    attached: true,
    stretch: 0,
  };
}

function beginDrag(scene, source, point, message) {
  if (scene.subState !== "READY") return false;

  scene.dragging = true;
  scene.dragSource = source;
  scene.tryActive = true;
  scene.handLostReset = false;
  scene.dragAnchor = {
    inputStart: clonePoint(point),
    origin: { ...CONSTANTS.SLINGSHOT_ORIGIN },
  };
  scene.dragSamples = [{ ...CONSTANTS.SLINGSHOT_ORIGIN }];
  scene.gestureLock =
    source === "gesture"
      ? {
          handStart: clonePoint(point),
          origin: { ...CONSTANTS.SLINGSHOT_ORIGIN },
        }
      : null;
  scene.subState = "DRAGGING";
  scene.inputMode = source === "gesture" ? "GESTURE" : "MOUSE";
  scene.statusText = message;
  updateDragging(scene, point, source);
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

  const livingPigs = scene.pigs.filter((pig) => !pig.dead).length;
  const wasMiss =
    livingPigs > 0 &&
    livingPigs === scene.pigsAtLaunch &&
    scene.score === scene.scoreAtLaunch;
  if (wasMiss) {
    emitSceneEvent(scene, "SHOT_MISSED");
  }

  scene.settleFrames = 0;
  scene.launchStartedAt = 0;
  scene.pigsAtLaunch = 0;
  scene.scoreAtLaunch = 0;

  const activeBird = getActiveBird(scene);
  if (activeBird) {
    activeBird.status = "used";
  }

  resetPull(scene);

  if (scene.pigs.every((pig) => pig.dead)) {
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
    if (scene.pigs.every((candidate) => candidate.dead)) {
      emitSceneEvent(scene, "LEVEL_CLEARED", { score: scene.score });
      scene.levelClearAt = performance.now() + CONSTANTS.LEVEL_COMPLETE_DELAY_MS;
    }

    const timer = window.setTimeout(() => {
      removeBody(scene, pig);
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

function getGestureLockedPoint(scene, handPoint) {
  if (!scene.dragAnchor?.inputStart || !handPoint) {
    return handPoint;
  }

  const offsetX = handPoint.x - scene.dragAnchor.inputStart.x;
  const offsetY = handPoint.y - scene.dragAnchor.inputStart.y;

  return {
    x: scene.dragAnchor.origin.x + offsetX * CONSTANTS.DRAG_RESPONSE,
    y: scene.dragAnchor.origin.y + offsetY * CONSTANTS.DRAG_RESPONSE,
  };
}

function getLagCompensation(scene, source) {
  if (source === "gesture") return CONSTANTS.GESTURE_LAG_COMPENSATION;
  if (scene.pointerType === "touch") return CONSTANTS.TOUCH_LAG_COMPENSATION;
  return 0;
}

function getSmoothedPoint(scene, point, source) {
  scene.dragSamples.push(clonePoint(point));
  if (scene.dragSamples.length > CONSTANTS.DRAG_SAMPLE_SIZE) {
    scene.dragSamples.shift();
  }

  const averaged = averagePoints(scene.dragSamples) ?? point;
  const lagCompensation = getLagCompensation(scene, source);

  if (scene.dragSamples.length < 2 || lagCompensation <= 0) {
    return averaged;
  }

  const last = scene.dragSamples[scene.dragSamples.length - 1];
  const prev = scene.dragSamples[scene.dragSamples.length - 2];

  return {
    x: averaged.x + (last.x - prev.x) * lagCompensation,
    y: averaged.y + (last.y - prev.y) * lagCompensation,
  };
}

function updateDragging(scene, point, source = scene.dragSource) {
  const anchoredPoint = getGestureLockedPoint(scene, point);
  if (!anchoredPoint) return;

  const nextPoint = getSmoothedPoint(scene, anchoredPoint, source);

  scene.gesture.locked = source === "gesture";
  scene.pull = clampPull(nextPoint);
  scene.gesture.lockPoint =
    source === "gesture" ? clonePoint(CONSTANTS.SLINGSHOT_ORIGIN) : null;
  scene.tension = scene.pull.distance / CONSTANTS.MAX_PULL_DIST;
  scene.trajectoryPoints = getTrajectoryPoints(scene, scene.pull.vector, scene.pull.distance);
  scene.band.position = clonePoint(scene.pull.position);
  scene.band.velocity = { x: 0, y: 0 };
  scene.band.attached = true;
  scene.band.stretch = scene.tension;
}

function launch(scene) {
  const activeBird = getActiveBird(scene);
  if (!activeBird) return;
  const releasedPoint = clonePoint(scene.pull.position);

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
  scene.dragAnchor = null;
  scene.dragSamples = [];
  scene.tension = 0;
  scene.trajectoryPoints = [];
  scene.pigsAtLaunch = scene.pigs.filter((pig) => !pig.dead).length;
  scene.scoreAtLaunch = scene.score;
  scene.band = {
    position: releasedPoint,
    velocity: {
      x: (CONSTANTS.SLINGSHOT_ORIGIN.x - releasedPoint.x) * 0.12,
      y: (CONSTANTS.SLINGSHOT_ORIGIN.y - releasedPoint.y) * 0.12,
    },
    attached: false,
    stretch: Math.min(
      Math.hypot(
        CONSTANTS.SLINGSHOT_ORIGIN.x - releasedPoint.x,
        CONSTANTS.SLINGSHOT_ORIGIN.y - releasedPoint.y,
      ) / CONSTANTS.MAX_PULL_DIST,
      1,
    ),
  };
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

  if (
    scene.currentBall &&
    (
      scene.currentBall.position.y > 860 ||
      scene.currentBall.position.x < -120 ||
      scene.currentBall.position.x > CONSTANTS.CANVAS_W + 120
    )
  ) {
    completeShot(scene, "SHOT LOST OFF-SITE. NEXT BALL LOADED.");
  }
}

function resolveSceneOutcome(scene) {
  const livingPigs = scene.pigs.filter((pig) => !pig.dead).length;
  const shotsRemaining = scene.birdQueue.some(
    (bird) => bird.status === "active" || bird.status === "unused",
  );

  if (livingPigs === 0) {
    if (!scene.levelClearAt) {
      scene.levelClearAt = performance.now() + CONSTANTS.LEVEL_COMPLETE_DELAY_MS;
    }

    if (performance.now() >= scene.levelClearAt) {
      scene.subState = "SITE_CLEAR";
      scene.statusText = "SITE CLEARED. MOVE TO THE NEXT TEST SITE.";
    }
    return;
  }

  scene.levelClearAt = 0;

  if (!scene.currentBall && !scene.dragging && !shotsRemaining) {
    scene.subState = "OUT_OF_BIRDS";
    scene.statusText = "NO CHARGES LEFT. RESET OR MOVE TO ANOTHER SITE.";
  }
}

function updateBand(scene, deltaMs) {
  if (scene.dragging) {
    scene.band.position = clonePoint(scene.pull.position);
    scene.band.velocity = { x: 0, y: 0 };
    scene.band.attached = true;
    scene.band.stretch = scene.tension;
    return;
  }

  const dt = deltaMs / (1000 / 60);
  const dx = CONSTANTS.SLINGSHOT_ORIGIN.x - scene.band.position.x;
  const dy = CONSTANTS.SLINGSHOT_ORIGIN.y - scene.band.position.y;
  const ax =
    dx * CONSTANTS.BAND_SPRING_STIFFNESS - scene.band.velocity.x * CONSTANTS.BAND_SPRING_DAMPING;
  const ay =
    dy * CONSTANTS.BAND_SPRING_STIFFNESS - scene.band.velocity.y * CONSTANTS.BAND_SPRING_DAMPING;

  scene.band.velocity.x += ax * dt;
  scene.band.velocity.y += ay * dt;
  scene.band.position.x += scene.band.velocity.x * dt;
  scene.band.position.y += scene.band.velocity.y * dt;
  scene.band.stretch = Math.min(Math.hypot(dx, dy) / CONSTANTS.MAX_PULL_DIST, 1);

  if (Math.hypot(dx, dy) < 0.6 && Math.hypot(scene.band.velocity.x, scene.band.velocity.y) < 0.4) {
    scene.band.position = { ...CONSTANTS.SLINGSHOT_ORIGIN };
    scene.band.velocity = { x: 0, y: 0 };
    scene.band.attached = true;
    scene.band.stretch = 0;
  }
}

export function createPhysicsScene(level, hooks = {}) {
  const Matter = getMatter();
  const engine = Matter.Engine.create({
    enableSleeping: true,
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
    statusText: getReadyTryPrompt({ tryCount: 1 }),
    tryCount: 1,
    tryActive: false,
    handLostReset: false,
    inputMode: "GESTURE",
    outcomeHandled: false,
    levelClearAt: 0,
    settleFrames: 0,
    launchStartedAt: 0,
    pigsAtLaunch: 0,
    scoreAtLaunch: 0,
    activeTimers: new Set(),
    pointerType: "mouse",
    dragAnchor: null,
    dragSamples: [],
    band: {
      position: { ...CONSTANTS.SLINGSHOT_ORIGIN },
      velocity: { x: 0, y: 0 },
      attached: true,
      stretch: 0,
    },
    gesture: {
      trackerStatus: "BOOTING",
      activeHandLabel: "NONE",
      pinchEvent: "IDLE",
      pinchActive: false,
      handCenter: null,
      inZone: false,
      locked: false,
      lockPoint: null,
    },
    gestureLock: null,
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

function isPointerSource(source) {
  return source === "mouse" || source === "touch";
}

export function handlePointerEvent(scene, type, point, pointerType = "mouse") {
  if (!scene) return false;

  if (type === "down") {
    if (scene.subState !== "READY" || scene.dragSource === "gesture") return false;
    const distance = Math.hypot(
      point.x - CONSTANTS.SLINGSHOT_ORIGIN.x,
      point.y - CONSTANTS.SLINGSHOT_ORIGIN.y,
    );
    if (distance > CONSTANTS.SLINGSHOT_ZONE_RADIUS) return false;

    scene.pointerType = pointerType;
    return beginDrag(scene, "mouse", point, "LOCKED TO THE SLING. DRAG BACK, THEN LET GO.");
  }

  if (type === "move" && scene.dragging && isPointerSource(scene.dragSource)) {
    updateDragging(scene, point);
    return true;
  }

  if (type === "up" && scene.dragging && isPointerSource(scene.dragSource)) {
    if (scene.pull.distance > 8) {
      launch(scene);
    } else {
      advanceTry(scene);
      cancelDrag(scene, getShortPullPrompt(scene));
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
    locked: scene.dragSource === "gesture",
    lockPoint: scene.dragSource === "gesture" ? { ...CONSTANTS.SLINGSHOT_ORIGIN } : null,
  };

  if (gestureFrame.pinchState?.event === "PINCH_RELEASE" && scene.dragSource === "gesture") {
    if (scene.pull.distance > 8) {
      launch(scene);
    } else {
      advanceTry(scene);
      cancelDrag(scene, getShortPullPrompt(scene));
    }
    return;
  }

  if (!gestureFrame.activeHand) {
    if (scene.dragging && scene.dragSource === "gesture") {
      advanceTry(scene, false);
      emitSceneEvent(scene, "HAND_LOST", { tryCount: scene.tryCount });
      scene.handLostReset = true;
      cancelDrag(scene, getLostHandPrompt(scene));
    } else if (scene.subState === "READY" && scene.tryActive) {
      advanceTry(scene, false);
      emitSceneEvent(scene, "HAND_LOST", { tryCount: scene.tryCount });
      scene.handLostReset = true;
      scene.statusText = getLostHandPrompt(scene);
    }
    return;
  }

  if (scene.subState === "READY") {
    if (scene.handLostReset) {
      scene.handLostReset = false;
      scene.statusText = getReadyTryPrompt(scene);
    }
    scene.tryActive = true;
  }

  if (
    scene.subState === "READY" &&
    !scene.dragging &&
    (
      gestureFrame.pinchState?.event === "PINCH_START" ||
      gestureFrame.pinchState?.event === "PINCH_HOLD"
    )
  ) {
    beginDrag(scene, "gesture", gestureFrame.handCenter, "PINCH LOCKED. PULL BACK, THEN OPEN TO FIRE.");
    return;
  }

  if (gestureFrame.pinchState?.active && scene.dragSource === "gesture") {
    updateDragging(scene, gestureFrame.handCenter, "gesture");
    scene.statusText = scene.pull.distance > 8
      ? "SHOT ARMED. OPEN YOUR HAND TO FIRE."
      : "PINCH HELD. PULL BACK FARTHER TO ARM.";
  }
}

export function stepPhysicsScene(scene, deltaMs) {
  if (!scene) return;

  scene.Matter.Engine.update(scene.engine, deltaMs);
  updateBand(scene, deltaMs);
  cleanupOffscreenBodies(scene);
  updateLaunchedBall(scene);
  resolveSceneOutcome(scene);
  scene.shockwaves = scene.shockwaves.filter(
    (wave) => performance.now() - wave.startedAt < CONSTANTS.SHOCKWAVE_DURATION_MS,
  );
}
