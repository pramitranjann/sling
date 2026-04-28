import { CONFIG } from "../config.js";
import { CONSTANTS } from "../constants.js";

const INDEX_TIP = 8;
const INDEX_BASE = 7;

function toPixelPoint(point, frame) {
  return {
    x: frame.x + (1 - point.x) * frame.width,
    y: frame.y + point.y * frame.height,
    z: point.z ?? 0,
  };
}

function inferLabel(handednessEntry) {
  return handednessEntry?.[0]?.categoryName ?? handednessEntry?.[0]?.displayName ?? "Unknown";
}

function inferConfidence(handednessEntry) {
  return handednessEntry?.[0]?.score ?? 0;
}

function smoothPoint(previousPoint, nextPoint, smoothing) {
  if (!previousPoint) return nextPoint;
  return {
    x: previousPoint.x + (nextPoint.x - previousPoint.x) * smoothing,
    y: previousPoint.y + (nextPoint.y - previousPoint.y) * smoothing,
    z: previousPoint.z + ((nextPoint.z ?? 0) - (previousPoint.z ?? 0)) * smoothing,
  };
}

export class HandTracker {
  constructor(videoEl) {
    this.videoEl = videoEl;
    this.handLandmarker = null;
    this.previousHands = [];
    this.nextHandId = 1;
  }

  async start(statusCallback = () => {}) {
    if (this.handLandmarker) return;

    statusCallback("Loading MediaPipe Tasks Vision...");

    const { FilesetResolver, HandLandmarker } = await import(
      CONFIG.mediaPipeVisionUrl
    );

    const vision = await FilesetResolver.forVisionTasks(CONFIG.mediaPipeWasmRoot);

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: CONFIG.mediaPipeHandModel },
      runningMode: "VIDEO",
      numHands: CONSTANTS.MEDIAPIPE_MAX_HANDS,
      minHandDetectionConfidence: CONSTANTS.MEDIAPIPE_DETECTION_CONF,
      minHandPresenceConfidence: CONSTANTS.MEDIAPIPE_DETECTION_CONF,
      minTrackingConfidence: CONSTANTS.MEDIAPIPE_TRACKING_CONF,
    });

    statusCallback("Tracker ready");
  }

  detect(nowMs, cameraFrame) {
    if (!this.handLandmarker || this.videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return [];
    }

    const results = this.handLandmarker.detectForVideo(this.videoEl, nowMs);
    const landmarks = results.landmarks ?? [];
    const handednesses = results.handednesses ?? [];

    const candidates = landmarks.map((landmarkSet, index) => {
      const points = landmarkSet.map((point) => toPixelPoint(point, cameraFrame));
      const tip = points[INDEX_TIP] ?? points[0];
      const base = points[INDEX_BASE] ?? points[0];

      return {
        label: inferLabel(handednesses[index]),
        color: CONFIG.handColors[inferLabel(handednesses[index])] ?? CONFIG.handColors.default,
        confidence: inferConfidence(handednesses[index]),
        points,
        rawX: tip.x,
        rawY: tip.y,
        baseRawX: base.x,
        baseRawY: base.y,
        z: tip.z ?? 0,
      };
    });

    const resolved = this.reconcileHands(candidates, nowMs);
    this.previousHands = resolved.map((hand) => ({ ...hand }));
    return resolved;
  }

  reconcileHands(candidates, nowMs) {
    const unmatchedPrev = [...this.previousHands];

    return candidates.map((candidate) => {
      let matchedIndex = -1;
      let matchedPrev = null;
      let nearestDistance = Infinity;

      unmatchedPrev.forEach((prevHand, index) => {
        const distance = Math.hypot(candidate.rawX - prevHand.rawX, candidate.rawY - prevHand.rawY);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          matchedPrev = prevHand;
          matchedIndex = index;
        }
      });

      const isMatch =
        matchedPrev && nearestDistance <= CONFIG.handMatchDistance;

      if (isMatch) {
        unmatchedPrev.splice(matchedIndex, 1);
      }

      const previous = isMatch ? matchedPrev : null;
      const dtMs = previous ? Math.max(nowMs - previous.detectedAt, 1) : 16.7;
      const dt = dtMs / 1000;
      const velocityX = previous ? (candidate.rawX - previous.rawX) / dt : 0;
      const velocityY = previous ? (candidate.rawY - previous.rawY) / dt : 0;
      const speed = Math.hypot(velocityX, velocityY);
      const smoothing =
        speed > CONFIG.handFastVelocity ? CONFIG.handFastSmoothing : CONFIG.handSmoothing;
      const points = candidate.points.map((point, index) =>
        smoothPoint(previous?.points?.[index], point, smoothing),
      );
      const tipPoint = points[INDEX_TIP] ?? points[0];
      const basePoint = points[INDEX_BASE] ?? points[0];

      return {
        id: previous?.id ?? `hand-${this.nextHandId++}`,
        label: candidate.label,
        color: candidate.color,
        x: tipPoint.x,
        y: tipPoint.y,
        baseX: basePoint.x,
        baseY: basePoint.y,
        rawX: candidate.rawX,
        rawY: candidate.rawY,
        velocityX,
        velocityY,
        confidence: candidate.confidence,
        z: candidate.z,
        detectedAt: nowMs,
        points,
      };
    });
  }
}
