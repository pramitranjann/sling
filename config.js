import { CONSTANTS } from "./constants.js";

export const CONFIG = {
  mediaPipeVisionUrl:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js",
  mediaPipeWasmRoot:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
  mediaPipeHandModel:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  webcamConstraints: {
    video: {
      width: CONSTANTS.CANVAS_W,
      height: CONSTANTS.CANVAS_H,
      facingMode: "user",
    },
    audio: false,
  },
  minHandConfidence: CONSTANTS.MEDIAPIPE_DETECTION_CONF,
  handDetectFps: 60,
  handMatchDistance: 180,
  minHandSeparation: 110,
  handFastVelocity: 900,
  handSmoothing: 0.42,
  handFastSmoothing: 0.78,
  handLostHoldMs: 90,
  handPredictionMs: 55,
  handColors: { Left: "#FFD100", Right: "#FFD100", default: "#FFD100" },
  sliceBladeBackOffset: 0,
  sliceBladeHalfWidth: 0,
};
