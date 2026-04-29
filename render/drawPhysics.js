import { CONSTANTS } from "../constants.js";

export function readPalette() {
  const styles = getComputedStyle(document.documentElement);

  const getVar = (name) => styles.getPropertyValue(name).trim();

  return {
    bg: getVar("--color-bg"),
    bgGrid: getVar("--color-bg-grid"),
    black: getVar("--color-black"),
    yellow: getVar("--color-yellow"),
    concrete: getVar("--color-concrete"),
    concreteDark: getVar("--color-concrete-dark"),
    concreteDust: getVar("--color-concrete-dust"),
    pig: getVar("--color-pig"),
    pigHit: getVar("--color-pig-hit"),
    surfaceDim: getVar("--color-surface-dim"),
  };
}

function drawGround(ctx, palette) {
  ctx.fillStyle = palette.surfaceDim;
  ctx.fillRect(0, CONSTANTS.CANVAS_H - 18, CONSTANTS.CANVAS_W, 18);

  ctx.fillStyle = palette.bgGrid;
  ctx.fillRect(0, CONSTANTS.CANVAS_H - 22, CONSTANTS.CANVAS_W, 4);
}

function drawSlingshot(ctx, palette) {
  const pillars = [
    { x: 136, y: 576, w: 16, h: 166 },
    { x: 160, y: 576, w: 16, h: 166 },
  ];
  const forks = [
    { x: 130, y: 572, w: 6, h: 14 },
    { x: 176, y: 572, w: 6, h: 14 },
  ];

  ctx.save();
  ctx.fillStyle = palette.concrete;
  ctx.strokeStyle = palette.black;
  ctx.lineWidth = 1.5;

  pillars.forEach((pillar) => {
    ctx.fillRect(pillar.x, pillar.y, pillar.w, pillar.h);
    ctx.strokeRect(pillar.x, pillar.y, pillar.w, pillar.h);
  });

  ctx.fillStyle = palette.concreteDark;
  forks.forEach((fork) => {
    ctx.fillRect(fork.x, fork.y, fork.w, fork.h);
    ctx.strokeRect(fork.x, fork.y, fork.w, fork.h);
  });
  ctx.restore();
}

function drawCracks(ctx, width, height, variant, severity, palette) {
  const patterns = [
    () => {
      ctx.beginPath();
      ctx.moveTo(-width * 0.3, -height * 0.4);
      ctx.lineTo(width * 0.2, height * 0.3);
      ctx.stroke();
    },
    () => {
      ctx.beginPath();
      ctx.moveTo(-width * 0.1, -height * 0.5);
      ctx.lineTo(width * 0.3, height * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-width * 0.4, height * 0.1);
      ctx.lineTo(width * 0.1, height * 0.5);
      ctx.stroke();
    },
    () => {
      [[-1, -1], [1, -0.8], [-0.8, 1], [0.9, 0.7]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dx * width * 0.45, dy * height * 0.45);
        ctx.stroke();
      });
    },
  ];

  ctx.save();
  ctx.strokeStyle = palette.black;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.4 + severity * 0.4;
  patterns[variant]?.();
  ctx.restore();
}

function drawBlocks(ctx, scene, palette) {
  scene.blocks.forEach((block) => {
    const size = CONSTANTS.BLOCK_SIZES[block.blockType] ?? CONSTANTS.BLOCK_SIZES["1x1"];
    const healthRatio = Math.max(block.health / block.maxHealth, 0);
    const damage = 1 - healthRatio;
    const gray = Math.round(154 - damage * 40);

    ctx.save();
    ctx.translate(block.position.x, block.position.y);
    ctx.rotate(block.angle);

    ctx.fillStyle = `rgb(${gray}, ${gray - 6}, ${gray - 12})`;
    ctx.fillRect(-size.w / 2, -size.h / 2, size.w, size.h);

    ctx.strokeStyle = palette.black;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-size.w / 2, -size.h / 2, size.w, size.h);

    if (healthRatio < 1) {
      drawCracks(ctx, size.w, size.h, block.crackVariant ?? 0, 1 - healthRatio, palette);
    }

    ctx.restore();
  });
}

function drawDeadPig(ctx, pig, palette) {
  ctx.save();
  ctx.translate(pig.position.x, pig.position.y);
  ctx.fillStyle = palette.pigHit;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(-15, -8, 30, 16);
  ctx.restore();
}

function drawPigs(ctx, scene, palette) {
  scene.pigs.forEach((pig) => {
    if (pig.dead) {
      drawDeadPig(ctx, pig, palette);
      return;
    }

    const size = CONSTANTS.PIG_SIZES[pig.pigVariant] ?? CONSTANTS.PIG_SIZES.standard;
    const healthRatio = Math.max(pig.health / pig.maxHealth, 0);

    ctx.save();
    ctx.translate(pig.position.x, pig.position.y);
    ctx.rotate(pig.angle);

    ctx.fillStyle = healthRatio < 1 ? palette.pigHit : palette.pig;
    ctx.strokeStyle = palette.black;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-size.w / 2, size.h / 2);
    ctx.lineTo(-size.w / 2, -size.h / 4);
    ctx.arc(0, -size.h / 4, size.w / 2, Math.PI, 0);
    ctx.lineTo(size.w / 2, size.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2A4030";
    const innerWidth = size.w * 0.45;
    const innerHeight = size.h * 0.28;
    ctx.fillRect(-innerWidth / 2, -size.h / 4 - innerHeight / 2 + 4, innerWidth, innerHeight);
    ctx.strokeRect(-innerWidth / 2, -size.h / 4 - innerHeight / 2 + 4, innerWidth, innerHeight);

    ctx.fillStyle = healthRatio < 1 ? "rgba(255, 209, 0, 0.3)" : palette.yellow;
    ctx.beginPath();
    ctx.arc(0, -size.h / 2 + 2, 4, 0, Math.PI * 2);
    ctx.fill();

    if (healthRatio < 1) {
      ctx.strokeStyle = palette.black;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-size.w * 0.3, 0);
      ctx.lineTo(size.w * 0.1, size.h * 0.3);
      ctx.stroke();
    }

    ctx.restore();
  });
}

function drawBall(ctx, body, palette) {
  if (!body) return;

  const radius = body.def?.radius ?? CONSTANTS.BALL.standard.radius;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle ?? 0);

  ctx.fillStyle = "#2A2828";
  ctx.strokeStyle = palette.black;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#3A3836";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  if (body.def?.blastRadius > 0) {
    ctx.strokeStyle = palette.yellow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.65, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.65, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.fillStyle = palette.yellow;
    ctx.fillRect(-2, -radius - 4, 4, 6);
  }

  if (body.def?.piercing) {
    ctx.strokeStyle = "#555550";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function getBallPreviewBody(scene) {
  const activeBird = scene.birdQueue.find((bird) => bird.status === "active");
  const variant = activeBird?.variant ?? "standard";

  return {
    position: scene.dragging ? scene.pull.position : CONSTANTS.SLINGSHOT_ORIGIN,
    angle: 0,
    def: CONSTANTS.BALL[variant] ?? CONSTANTS.BALL.standard,
  };
}

function drawCurrentBall(ctx, scene, palette) {
  if (scene.currentBall) {
    drawBall(ctx, scene.currentBall, palette);
    return;
  }

  if (scene.subState === "READY" || scene.subState === "DRAGGING") {
    drawBall(ctx, getBallPreviewBody(scene), palette);
  }
}

function drawSlingshotBand(ctx, scene, palette) {
  const target = scene.currentBall
    ? scene.currentBall.position
    : scene.dragging
      ? scene.pull.position
      : CONSTANTS.SLINGSHOT_ORIGIN;

  ctx.save();
  ctx.strokeStyle = palette.black;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CONSTANTS.BAND_LEFT.x, CONSTANTS.BAND_LEFT.y);
  ctx.lineTo(target.x, target.y);
  ctx.lineTo(CONSTANTS.BAND_RIGHT.x, CONSTANTS.BAND_RIGHT.y);
  ctx.stroke();
  ctx.restore();
}

function drawTrajectoryArc(ctx, scene, palette) {
  const points = scene.trajectoryPoints;
  if (!points || points.length < 2) return;

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = palette.black;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }

  ctx.stroke();
  ctx.restore();
}

function drawLaunchArrow(ctx, scene, palette) {
  if (!scene.dragging || scene.pull.distance <= 6) return;

  const start = {
    x: scene.pull.position.x + scene.pull.vector.x * 18,
    y: scene.pull.position.y + scene.pull.vector.y * 18,
  };
  const end = {
    x: start.x + scene.pull.vector.x * 72,
    y: start.y + scene.pull.vector.y * 72,
  };
  const angle = Math.atan2(scene.pull.vector.y, scene.pull.vector.x);
  const wing = 14;

  ctx.save();
  ctx.strokeStyle = palette.yellow;
  ctx.fillStyle = palette.yellow;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - wing * Math.cos(angle - 0.55), end.y - wing * Math.sin(angle - 0.55));
  ctx.lineTo(end.x - wing * Math.cos(angle + 0.55), end.y - wing * Math.sin(angle + 0.55));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFragments(ctx, scene, palette) {
  scene.fragments.forEach((fragment) => {
    const width = fragment.bounds.max.x - fragment.bounds.min.x;
    const height = fragment.bounds.max.y - fragment.bounds.min.y;

    ctx.save();
    ctx.translate(fragment.position.x, fragment.position.y);
    ctx.rotate(fragment.angle);
    ctx.fillStyle = palette.concreteDust;
    ctx.strokeStyle = palette.black;
    ctx.lineWidth = 1;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  });
}

function drawShockwaves(ctx, scene, palette) {
  scene.shockwaves.forEach((wave) => {
    const age = Math.min((performance.now() - wave.startedAt) / CONSTANTS.SHOCKWAVE_DURATION_MS, 1);
    const radius = wave.radius * age;

    ctx.save();
    ctx.strokeStyle = palette.black;
    ctx.globalAlpha = 1 - age;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawPinchZoneRing(ctx, scene, palette) {
  if (!scene.gesture?.inZone && scene.dragSource !== "gesture") return;

  const pulse = Math.sin(performance.now() / 180) * 6;
  const radius = 60 + pulse;
  const opacity = scene.dragSource === "gesture" ? 0.95 : 0.45;

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = palette.yellow;
  ctx.lineWidth = 2;
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.arc(
    CONSTANTS.SLINGSHOT_ORIGIN.x,
    CONSTANTS.SLINGSHOT_ORIGIN.y,
    radius,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function drawHandCursor(ctx, scene, palette) {
  const handCenter =
    scene.gesture?.locked && scene.dragSource === "gesture"
      ? scene.gesture?.lockPoint
      : scene.gesture?.handCenter;
  if (!handCenter) return;

  ctx.save();
  ctx.strokeStyle = scene.gesture.pinchActive ? palette.yellow : palette.black;
  ctx.fillStyle = scene.gesture.pinchActive ? palette.yellow : "rgba(17, 17, 17, 0.25)";
  ctx.lineWidth = 2;
  ctx.globalAlpha = scene.gesture.locked || scene.gesture.inZone ? 1 : 0.7;
  ctx.beginPath();
  ctx.arc(handCenter.x, handCenter.y, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(handCenter.x, handCenter.y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawScene({ scene, physicsCtx, vfxCtx, palette }) {
  physicsCtx.clearRect(0, 0, CONSTANTS.CANVAS_W, CONSTANTS.CANVAS_H);
  vfxCtx.clearRect(0, 0, CONSTANTS.CANVAS_W, CONSTANTS.CANVAS_H);

  drawGround(physicsCtx, palette);
  drawSlingshot(physicsCtx, palette);
  drawSlingshotBand(physicsCtx, scene, palette);
  drawBlocks(physicsCtx, scene, palette);
  drawPigs(physicsCtx, scene, palette);
  drawFragments(physicsCtx, scene, palette);
  drawCurrentBall(physicsCtx, scene, palette);

  drawTrajectoryArc(vfxCtx, scene, palette);
  drawLaunchArrow(vfxCtx, scene, palette);
  drawPinchZoneRing(vfxCtx, scene, palette);
  drawHandCursor(vfxCtx, scene, palette);
  drawShockwaves(vfxCtx, scene, palette);
}
