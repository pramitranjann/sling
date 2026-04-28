import {
  createPhysicsScene,
  destroyPhysicsScene,
  handleGestureFrame,
  handlePointerEvent,
  stepPhysicsScene,
} from "./game/physics.js";
import { getActiveHand, getHandCenter, isInSlingshotZone, updatePinchState } from "./gesture/gestureUtils.js";
import { HandTracker } from "./gesture/vision.js";
import { initWebcam } from "./gesture/webcamManager.js";
import { drawScene, readPalette } from "./render/drawPhysics.js";

const refs = {
  gameRoot: document.getElementById("game-root"),
  physicsCanvas: document.getElementById("canvas-physics"),
  vfxCanvas: document.getElementById("canvas-vfx"),
  levelNumber: document.getElementById("levelNumber"),
  levelName: document.getElementById("levelName"),
  parScore: document.getElementById("parScore"),
  shotState: document.getElementById("shotState"),
  hudScore: document.getElementById("hudScore"),
  birdQueue: document.getElementById("birdQueue"),
  tensionPct: document.getElementById("tensionPct"),
  tensionFill: document.getElementById("tensionFill"),
  statusText: document.getElementById("statusText"),
  trackerState: document.getElementById("trackerState"),
  activeHandMetric: document.getElementById("activeHandMetric"),
  pinchMetric: document.getElementById("pinchMetric"),
  inputModeMetric: document.getElementById("inputModeMetric"),
  prevLevelBtn: document.getElementById("prevLevelBtn"),
  resetLevelBtn: document.getElementById("resetLevelBtn"),
  nextLevelBtn: document.getElementById("nextLevelBtn"),
  webcamVideo: document.getElementById("webcamVideo"),
};

const physicsCtx = refs.physicsCanvas.getContext("2d");
const vfxCtx = refs.vfxCanvas.getContext("2d");
const palette = readPalette();

let levels = [];
let levelIndex = 0;
let scene = null;
let animationFrame = 0;
let lastFrameTime = 0;
let tracker = null;
let trackerStatus = "BOOTING";
let gestureReady = false;
let pinchState = { active: false, event: "IDLE" };

function setTrackerStatus(message) {
  trackerStatus = String(message ?? "BOOTING").toUpperCase();
}

function formatLevelNumber(id) {
  return String(id).padStart(2, "0");
}

function updateBirdQueue(queue) {
  refs.birdQueue.innerHTML = "";

  queue.forEach((bird) => {
    const dot = document.createElement("div");
    dot.className = "bird-dot";
    dot.classList.toggle("bird-dot--active", bird.status === "active");
    dot.classList.toggle("bird-dot--used", bird.status === "used");
    dot.dataset.variant = bird.variant;
    refs.birdQueue.append(dot);
  });
}

function updateHUD() {
  if (!scene) return;

  refs.levelNumber.textContent = formatLevelNumber(scene.level.id);
  refs.levelName.textContent = scene.level.name;
  refs.parScore.textContent = scene.level.par.toLocaleString();
  refs.shotState.textContent = scene.subState.replace("_", " ");
  refs.hudScore.textContent = scene.score.toLocaleString();
  refs.tensionPct.textContent = `${Math.round(scene.tension * 100)}%`;
  refs.tensionFill.style.width = `${Math.round(scene.tension * 100)}%`;
  refs.statusText.textContent = scene.statusText;
  refs.trackerState.textContent = scene.gesture.trackerStatus;
  refs.activeHandMetric.textContent = scene.gesture.activeHandLabel;
  refs.pinchMetric.textContent = scene.gesture.pinchEvent.replace("_", " ");
  refs.inputModeMetric.textContent = scene.inputMode;
  updateBirdQueue(scene.birdQueue);

  refs.prevLevelBtn.disabled = levelIndex === 0;
  refs.nextLevelBtn.disabled = levelIndex === levels.length - 1;
}

function renderFrame() {
  if (!scene) return;
  drawScene({ scene, physicsCtx, vfxCtx, palette });
  updateHUD();
}

function mountLevel(index) {
  if (!levels[index]) return;

  if (scene) {
    destroyPhysicsScene(scene);
  }

  levelIndex = index;
  scene = createPhysicsScene(levels[index]);
  pinchState = { active: false, event: "IDLE" };
  lastFrameTime = 0;
  renderFrame();
}

function toLocalPoint(event) {
  const rect = refs.gameRoot.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * refs.physicsCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * refs.physicsCanvas.height,
  };
}

function bindPointerInput() {
  refs.gameRoot.addEventListener("pointerdown", (event) => {
    const handled = handlePointerEvent(scene, "down", toLocalPoint(event));
    if (handled) {
      refs.gameRoot.setPointerCapture(event.pointerId);
      renderFrame();
    }
  });

  refs.gameRoot.addEventListener("pointermove", (event) => {
    if (!scene?.dragging) return;
    handlePointerEvent(scene, "move", toLocalPoint(event));
    renderFrame();
  });

  const finishPointer = (event) => {
    if (!scene?.dragging) return;
    handlePointerEvent(scene, "up", toLocalPoint(event));
    if (refs.gameRoot.hasPointerCapture(event.pointerId)) {
      refs.gameRoot.releasePointerCapture(event.pointerId);
    }
    renderFrame();
  };

  refs.gameRoot.addEventListener("pointerup", finishPointer);
  refs.gameRoot.addEventListener("pointercancel", finishPointer);
}

function bindControls() {
  refs.resetLevelBtn.addEventListener("click", () => mountLevel(levelIndex));
  refs.prevLevelBtn.addEventListener("click", () => mountLevel(Math.max(levelIndex - 1, 0)));
  refs.nextLevelBtn.addEventListener("click", () => mountLevel(Math.min(levelIndex + 1, levels.length - 1)));

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      mountLevel(levelIndex);
    }
  });
}

function frame(now) {
  if (!scene) return;

  if (!lastFrameTime) {
    lastFrameTime = now;
  }

  const deltaMs = Math.min(now - lastFrameTime, 32);
  lastFrameTime = now;

  const gestureFrame = {
    trackerStatus,
    activeHand: null,
    handCenter: null,
    pinchState,
    inZone: false,
  };

  if (gestureReady && tracker) {
    const hands = tracker.detect(now, {
      x: 0,
      y: 0,
      width: refs.physicsCanvas.width,
      height: refs.physicsCanvas.height,
    });
    const activeHand = getActiveHand(hands);

    if (!activeHand) {
      pinchState = { active: false, event: "IDLE" };
    } else {
      const handCenter = getHandCenter(activeHand);
      pinchState = updatePinchState(activeHand, pinchState);
      gestureFrame.activeHand = activeHand;
      gestureFrame.handCenter = handCenter;
      gestureFrame.pinchState = pinchState;
      gestureFrame.inZone = isInSlingshotZone(handCenter);
    }
  }

  gestureFrame.trackerStatus = trackerStatus;
  gestureFrame.pinchState = pinchState;
  handleGestureFrame(scene, gestureFrame);

  stepPhysicsScene(scene, deltaMs);
  renderFrame();
  animationFrame = requestAnimationFrame(frame);
}

async function bootGesture() {
  try {
    setTrackerStatus("Requesting camera");
    await initWebcam(refs.webcamVideo);

    tracker = new HandTracker(refs.webcamVideo);
    await tracker.start(setTrackerStatus);

    gestureReady = true;
    setTrackerStatus("Tracker live");
    if (scene?.subState === "READY") {
      scene.statusText = "PINCH IN THE SLINGSHOT ZONE TO ARM. MOUSE DRAG IS FALLBACK.";
    }
    renderFrame();
  } catch (error) {
    gestureReady = false;
    tracker = null;
    pinchState = { active: false, event: "IDLE" };
    setTrackerStatus(error.message || "Gesture unavailable");
    if (scene) {
      scene.gesture.trackerStatus = trackerStatus;
      scene.statusText = "CAMERA UNAVAILABLE. USE MOUSE DRAG AS FALLBACK.";
      renderFrame();
    }
    console.error(error);
  }
}

async function loadLevels() {
  const response = await fetch(new URL("./data/levels.json", import.meta.url));
  if (!response.ok) {
    throw new Error(`Failed to load levels.json (${response.status})`);
  }

  const payload = await response.json();
  return payload.levels ?? [];
}

async function boot() {
  if (!window.Matter) {
    throw new Error("Matter.js failed to load.");
  }

  levels = await loadLevels();
  bindPointerInput();
  bindControls();
  mountLevel(0);
  void bootGesture();
  animationFrame = requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  refs.statusText.textContent = error.message || "FAILED TO BOOT GESTURE PHYSICS";
  cancelAnimationFrame(animationFrame);
});
