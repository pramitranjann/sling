import { CONSTANTS } from "../constants.js";

const { PINCH_THRESHOLD, PINCH_HYSTERESIS, SLINGSHOT_ORIGIN, SLINGSHOT_ZONE_RADIUS } =
  CONSTANTS;
const {
  PINCH_THRESHOLD_RATIO,
  PINCH_RATIO_HYSTERESIS,
  PINCH_CONFIRM_FRAMES,
  RELEASE_CONFIRM_FRAMES,
} = CONSTANTS;

function distanceBetween(a, b) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getPinchDistance(hand) {
  const thumb = hand?.points?.[4];
  const index = hand?.points?.[8];
  if (!thumb || !index) return Infinity;
  return Math.hypot(thumb.x - index.x, thumb.y - index.y);
}

export function getHandScale(hand) {
  const points = hand?.points;
  if (!points) return 0;

  const palmWidth = distanceBetween(points[5], points[17]);
  const wristToIndex = distanceBetween(points[0], points[5]);
  const wristToPinky = distanceBetween(points[0], points[17]);

  return (palmWidth + wristToIndex + wristToPinky) / 3;
}

export function getNormalizedPinchDistance(hand) {
  const pinchDistance = getPinchDistance(hand);
  const handScale = getHandScale(hand);
  if (!Number.isFinite(pinchDistance) || handScale <= 0) return Infinity;
  return pinchDistance / handScale;
}

export function isPinching(hand, currentlyPinching = false) {
  const pinchThreshold = currentlyPinching
    ? PINCH_THRESHOLD + PINCH_HYSTERESIS
    : PINCH_THRESHOLD;

  const ratioThreshold = currentlyPinching
    ? PINCH_THRESHOLD_RATIO + PINCH_RATIO_HYSTERESIS
    : PINCH_THRESHOLD_RATIO;

  return (
    getPinchDistance(hand) < pinchThreshold ||
    getNormalizedPinchDistance(hand) < ratioThreshold
  );
}

export function updatePinchState(
  hand,
  prevState = { active: false, event: "IDLE", pinchFrames: 0, releaseFrames: 0 },
) {
  if (!hand) {
    return { active: false, event: "IDLE", pinchFrames: 0, releaseFrames: 0 };
  }

  const pinching = isPinching(hand, prevState.active);
  const pinchFrames = pinching ? (prevState.pinchFrames ?? 0) + 1 : 0;
  const releaseFrames = pinching ? 0 : (prevState.releaseFrames ?? 0) + 1;

  if (!prevState.active && pinchFrames >= PINCH_CONFIRM_FRAMES) {
    return { active: true, event: "PINCH_START", pinchFrames, releaseFrames: 0 };
  }

  if (prevState.active && pinching) {
    return { active: true, event: "PINCH_HOLD", pinchFrames, releaseFrames: 0 };
  }

  if (prevState.active && releaseFrames >= RELEASE_CONFIRM_FRAMES) {
    return { active: false, event: "PINCH_RELEASE", pinchFrames: 0, releaseFrames };
  }

  return {
    active: Boolean(prevState.active),
    event: prevState.active ? "PINCH_HOLD" : "IDLE",
    pinchFrames,
    releaseFrames,
  };
}

export function getHandCenter(hand) {
  const points = hand?.points;
  if (!points) return { x: hand?.x ?? 0, y: hand?.y ?? 0 };

  return {
    x: (points[0].x + points[5].x + points[9].x) / 3,
    y: (points[0].y + points[5].y + points[9].y) / 3,
  };
}

export function getPinchAnchor(hand) {
  const thumb = hand?.points?.[4];
  const index = hand?.points?.[8];

  if (thumb && index) {
    return {
      x: (thumb.x + index.x) * 0.5,
      y: (thumb.y + index.y) * 0.5,
    };
  }

  return getHandCenter(hand);
}

export function getActiveHand(hands = []) {
  if (hands.length === 0) return null;
  if (hands.length === 1) return hands[0];

  const byConfidence = hands
    .slice()
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  if ((byConfidence[0].confidence ?? 0) - (byConfidence[1].confidence ?? 0) > 0.1) {
    return byConfidence[0];
  }

  return hands.reduce((closest, hand) => {
    const handCenter = getHandCenter(hand);
    const closestCenter = getHandCenter(closest);
    const handDist = Math.hypot(
      handCenter.x - SLINGSHOT_ORIGIN.x,
      handCenter.y - SLINGSHOT_ORIGIN.y,
    );
    const closestDist = Math.hypot(
      closestCenter.x - SLINGSHOT_ORIGIN.x,
      closestCenter.y - SLINGSHOT_ORIGIN.y,
    );
    return handDist < closestDist ? hand : closest;
  });
}

export function isInSlingshotZone(handCenter) {
  return (
    Math.hypot(
      handCenter.x - SLINGSHOT_ORIGIN.x,
      handCenter.y - SLINGSHOT_ORIGIN.y,
    ) < SLINGSHOT_ZONE_RADIUS
  );
}
