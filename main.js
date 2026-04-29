import {
  createPhysicsScene,
  destroyPhysicsScene,
  handleGestureFrame,
  handlePointerEvent,
  stepPhysicsScene,
} from "./game/physics.js";
import { getLevelById, getLevelIndex, getNextLevel, loadLevelData } from "./game/levelLoader.js";
import { getActiveHand, getHandCenter, isInSlingshotZone, updatePinchState } from "./gesture/gestureUtils.js";
import { HandTracker } from "./gesture/vision.js";
import { initWebcam } from "./gesture/webcamManager.js";
import { drawScene, readPalette } from "./render/drawPhysics.js";
import { CONSTANTS } from "./constants.js";
import {
  APP_STATES,
  ensureSaveExists,
  getCurrentPlayableLevelId,
  getLevelRecord,
  hasSavedProgress,
  isLevelUnlocked,
  loadSave,
  resetCalibrationProgress,
  setAppState,
  state,
  writeSave,
} from "./state/state.js";
import { initScreens } from "./ui/screens.js";

const sensorVideo = document.getElementById("sensorVideo");
const palette = readPalette();

let ui = null;
let gameplayRefs = null;
let physicsCtx = null;
let vfxCtx = null;

let levels = [];
let scene = null;
let animationFrame = 0;
let lastFrameTime = 0;

let tracker = null;
let trackerStatus = "OFFLINE";
let gestureReady = false;
let gestureBootPromise = null;
let pinchState = { active: false, event: "IDLE" };

function setTrackerStatus(message) {
  trackerStatus = String(message ?? "OFFLINE").toUpperCase();
}

function countRemainingPigs(sceneRef) {
  return sceneRef.pigs.filter((pig) => !pig.dead).length;
}

function countUnusedBirds(sceneRef) {
  return sceneRef.birdQueue.filter((bird) => bird.status === "unused").length;
}

function calculateStars(sceneRef) {
  const birdsRemaining = countUnusedBirds(sceneRef);
  if (birdsRemaining >= 1) return 3;
  if (sceneRef.birdQueue.every((bird) => bird.status !== "unused")) return 2;
  return 1;
}

function formatLevelNumber(levelId) {
  return String(levelId).padStart(2, "0");
}

function makeSaveHelpers() {
  return { getLevelRecord, isLevelUnlocked };
}

function makeGestureFrame() {
  return {
    trackerStatus,
    activeHand: null,
    handCenter: null,
    pinchState,
    inZone: false,
  };
}

async function ensureGestureBoot() {
  if (gestureReady) return true;
  if (gestureBootPromise) return gestureBootPromise;

  gestureBootPromise = (async () => {
    try {
      setTrackerStatus("REQUESTING CAMERA");
      const stream = await initWebcam(sensorVideo);
      ui.attachSharedStream(stream);

      tracker = new HandTracker(sensorVideo);
      await tracker.start(setTrackerStatus);
      gestureReady = true;
      setTrackerStatus("TRACKER LIVE");
      return true;
    } catch (error) {
      tracker = null;
      gestureReady = false;
      pinchState = { active: false, event: "IDLE" };
      setTrackerStatus(error.message || "GESTURE UNAVAILABLE");
      console.error(error);
      return false;
    } finally {
      gestureBootPromise = null;
    }
  })();

  return gestureBootPromise;
}

function updateHomeScreen() {
  ui.updateHome({ continueEnabled: hasSavedProgress() });
}

function updateCalibrationScreen(gestureFrame) {
  const handDetected = Boolean(gestureFrame.activeHand);

  state.calibration.handFrames = handDetected ? state.calibration.handFrames + 1 : 0;
  if (state.calibration.handFrames >= 10) {
    state.calibration.handPassed = true;
  }

  if (gestureFrame.pinchState.event === "PINCH_START") {
    state.calibration.pinchPassed = true;
  }

  ui.updateCalibration({
    trackerStatus,
    handDetected,
    handPassed: state.calibration.handPassed,
    pinchPassed: state.calibration.pinchPassed,
    pinchActive: gestureFrame.pinchState.active,
  });
  ui.renderCalibrationOverlay({
    hand: gestureFrame.activeHand,
    pinchActive: gestureFrame.pinchState.active,
  });
}

function updateGameplayHUD() {
  if (!scene) return;

  gameplayRefs.levelNumber.textContent = formatLevelNumber(scene.level.id);
  gameplayRefs.levelName.textContent = scene.level.name;
  gameplayRefs.parScore.textContent = scene.level.par.toLocaleString();
  gameplayRefs.shotState.textContent = scene.subState.replace("_", " ");
  gameplayRefs.hudScore.textContent = scene.score.toLocaleString();
  gameplayRefs.tensionPct.textContent = `${Math.round(scene.tension * 100)}%`;
  gameplayRefs.tensionFill.style.width = `${Math.round(scene.tension * 100)}%`;

  gameplayRefs.birdQueue.innerHTML = "";
  scene.birdQueue.forEach((bird) => {
    const dot = document.createElement("div");
    dot.className = "bird-dot";
    dot.classList.toggle("bird-dot--active", bird.status === "active");
    dot.classList.toggle("bird-dot--used", bird.status === "used");
    gameplayRefs.birdQueue.append(dot);
  });
}

function updateGameplayCamera(gestureFrame) {
  ui.updateGameplayCamera({
    trackerStatus,
    handDetected: Boolean(gestureFrame.activeHand),
    pinchActive: gestureFrame.pinchState.active,
  });
  ui.renderGameplayOverlay({
    hand: gestureFrame.activeHand,
    pinchActive: gestureFrame.pinchState.active,
  });
}

function renderGameplay() {
  if (!scene || state.current !== APP_STATES.GAMEPLAY) return;
  drawScene({ scene, physicsCtx, vfxCtx, palette });
  updateGameplayHUD();
}

function destroyScene() {
  if (!scene) return;
  destroyPhysicsScene(scene);
  scene = null;
}

function mountLevel(levelId) {
  const level = getLevelById(levels, levelId) ?? levels[0] ?? null;
  if (!level) return;

  destroyScene();
  state.levelId = level.id;
  scene = createPhysicsScene(level);
  scene.gesture.trackerStatus = trackerStatus;
  lastFrameTime = 0;
  renderGameplay();
}

function renderLevelSelect() {
  ui.renderLevelSelect({
    levels,
    currentLevelId: getCurrentPlayableLevelId(),
    saveHelpers: makeSaveHelpers(),
  });
}

function transition(nextState, data = {}) {
  if (state.current === APP_STATES.GAMEPLAY && nextState !== APP_STATES.GAMEPLAY) {
    destroyScene();
  }

  if (nextState !== APP_STATES.CALIBRATION && nextState !== APP_STATES.GAMEPLAY) {
    ui.clearWebcamOverlays();
  }

  setAppState(nextState);
  ui.setActiveScreen(nextState);

  if (nextState === APP_STATES.HOME) {
    updateHomeScreen();
    return;
  }

  if (nextState === APP_STATES.CALIBRATION) {
    resetCalibrationProgress();
    ui.updateCalibration({
      trackerStatus,
      handDetected: false,
      handPassed: false,
      pinchPassed: false,
      pinchActive: false,
    });
    void ensureGestureBoot();
    return;
  }

  if (nextState === APP_STATES.LEVEL_SELECT) {
    renderLevelSelect();
    return;
  }

  if (nextState === APP_STATES.GAMEPLAY) {
    const nextLevelId = data.levelId ?? state.levelId ?? getCurrentPlayableLevelId();
    mountLevel(nextLevelId);
    void ensureGestureBoot();
    return;
  }

  if (nextState === APP_STATES.LEVEL_COMPLETE) {
    ui.updateLevelComplete(data);
    return;
  }

  if (nextState === APP_STATES.LEVEL_FAIL) {
    ui.updateLevelFail(data);
  }
}

function finalizeLevelComplete(sceneRef) {
  const birdsRemaining = countUnusedBirds(sceneRef);
  const bonus = birdsRemaining * CONSTANTS.BIRDS_REMAINING_BONUS;
  const finalScore = sceneRef.score + bonus;
  const stars = calculateStars(sceneRef);
  const nextLevel = getNextLevel(levels, sceneRef.level.id);

  writeSave(sceneRef.level.id, stars, finalScore);

  transition(APP_STATES.LEVEL_COMPLETE, {
    levelId: sceneRef.level.id,
    score: finalScore,
    par: sceneRef.level.par,
    stars,
    birdsRemaining,
    hasNextLevel: Boolean(nextLevel),
  });
}

function finalizeLevelFail(sceneRef) {
  transition(APP_STATES.LEVEL_FAIL, {
    levelId: sceneRef.level.id,
    score: sceneRef.score,
    pigsRemaining: countRemainingPigs(sceneRef),
  });
}

function handleStart() {
  if (hasSavedProgress()) {
    transition(APP_STATES.LEVEL_SELECT);
  } else {
    transition(APP_STATES.CALIBRATION);
  }
}

function handleContinue() {
  transition(APP_STATES.LEVEL_SELECT);
}

function handleEnterSite() {
  ensureSaveExists();
  transition(APP_STATES.LEVEL_SELECT);
}

function handleSelectLevel(levelId) {
  transition(APP_STATES.GAMEPLAY, { levelId });
}

function handleRetryCurrent() {
  transition(APP_STATES.GAMEPLAY, { levelId: state.levelId });
}

function handleNextLevel() {
  const nextLevel = getNextLevel(levels, state.levelId);

  if (!nextLevel) {
    transition(APP_STATES.LEVEL_SELECT);
    return;
  }

  transition(APP_STATES.GAMEPLAY, { levelId: nextLevel.id });
}

function handleBackHome() {
  transition(APP_STATES.HOME);
}

function bindPointerInput() {
  gameplayRefs.gameRoot.addEventListener("pointerdown", (event) => {
    if (state.current !== APP_STATES.GAMEPLAY || !scene) return;

    const rect = gameplayRefs.gameRoot.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * gameplayRefs.physicsCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * gameplayRefs.physicsCanvas.height,
    };

    const handled = handlePointerEvent(scene, "down", point);
    if (handled) {
      gameplayRefs.gameRoot.setPointerCapture(event.pointerId);
      renderGameplay();
    }
  });

  gameplayRefs.gameRoot.addEventListener("pointermove", (event) => {
    if (state.current !== APP_STATES.GAMEPLAY || !scene?.dragging) return;

    const rect = gameplayRefs.gameRoot.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * gameplayRefs.physicsCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * gameplayRefs.physicsCanvas.height,
    };

    handlePointerEvent(scene, "move", point);
    renderGameplay();
  });

  const finishPointer = (event) => {
    if (state.current !== APP_STATES.GAMEPLAY || !scene?.dragging) return;

    const rect = gameplayRefs.gameRoot.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * gameplayRefs.physicsCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * gameplayRefs.physicsCanvas.height,
    };

    handlePointerEvent(scene, "up", point);
    if (gameplayRefs.gameRoot.hasPointerCapture(event.pointerId)) {
      gameplayRefs.gameRoot.releasePointerCapture(event.pointerId);
    }
    renderGameplay();
  };

  gameplayRefs.gameRoot.addEventListener("pointerup", finishPointer);
  gameplayRefs.gameRoot.addEventListener("pointercancel", finishPointer);
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (state.current === APP_STATES.GAMEPLAY && event.key.toLowerCase() === "r") {
      mountLevel(state.levelId);
      return;
    }

    if (state.current === APP_STATES.GAMEPLAY && event.key === "Escape") {
      transition(APP_STATES.LEVEL_SELECT);
      return;
    }

    if (!event.altKey) return;

    if (event.key === "1") transition(APP_STATES.HOME);
    if (event.key === "2") transition(APP_STATES.CALIBRATION);
    if (event.key === "3") transition(APP_STATES.LEVEL_SELECT);
    if (event.key === "4") transition(APP_STATES.GAMEPLAY, { levelId: state.levelId || 1 });
    if (event.key === "5") {
      const level = getLevelById(levels, state.levelId) ?? getLevelById(levels, 3);
      transition(APP_STATES.LEVEL_COMPLETE, {
        ...state.preview.complete,
        levelId: level?.id ?? 3,
        par: level?.par ?? state.preview.complete.par,
        hasNextLevel: Boolean(getNextLevel(levels, level?.id ?? 3)),
      });
    }
    if (event.key === "6") {
      transition(APP_STATES.LEVEL_FAIL, state.preview.fail);
    }
  });
}

function buildGestureFrame(now) {
  const gestureFrame = makeGestureFrame();

  if (
    !gestureReady ||
    !tracker ||
    (state.current !== APP_STATES.CALIBRATION && state.current !== APP_STATES.GAMEPLAY)
  ) {
    return gestureFrame;
  }

  const hands = tracker.detect(now, {
    x: 0,
    y: 0,
    width: gameplayRefs.physicsCanvas.width,
    height: gameplayRefs.physicsCanvas.height,
  });

  const activeHand = getActiveHand(hands);

  if (!activeHand) {
    pinchState = pinchState.active
      ? { active: false, event: "PINCH_RELEASE" }
      : { active: false, event: "IDLE" };
    return { ...gestureFrame, pinchState };
  }

  const handCenter = getHandCenter(activeHand);
  pinchState = updatePinchState(activeHand, pinchState);

  return {
    trackerStatus,
    activeHand,
    handCenter,
    pinchState,
    inZone: isInSlingshotZone(handCenter),
  };
}

function frame(now) {
  if (!lastFrameTime) {
    lastFrameTime = now;
  }

  const deltaMs = Math.min(now - lastFrameTime, 32);
  lastFrameTime = now;

  const gestureFrame = buildGestureFrame(now);

  if (state.current === APP_STATES.CALIBRATION) {
    updateCalibrationScreen(gestureFrame);
  }

  if (state.current === APP_STATES.GAMEPLAY && scene) {
    handleGestureFrame(scene, gestureFrame);
    scene.gesture.trackerStatus = trackerStatus;
    stepPhysicsScene(scene, deltaMs);
    renderGameplay();
    updateGameplayCamera(gestureFrame);

    if (!scene.outcomeHandled && scene.subState === "SITE_CLEAR") {
      scene.outcomeHandled = true;
      finalizeLevelComplete(scene);
    } else if (!scene.outcomeHandled && scene.subState === "OUT_OF_BIRDS") {
      scene.outcomeHandled = true;
      finalizeLevelFail(scene);
    }
  }

  animationFrame = requestAnimationFrame(frame);
}

async function boot() {
  if (!window.Matter) {
    throw new Error("Matter.js failed to load.");
  }

  const levelPayload = await loadLevelData(new URL("./data/levels.json", import.meta.url));
  levels = levelPayload.levels;
  loadSave();

  ui = initScreens({
    onStart: handleStart,
    onContinue: handleContinue,
    onBackHome: handleBackHome,
    onEnterSite: handleEnterSite,
    onSelectLevel: handleSelectLevel,
    onRetryCurrent: handleRetryCurrent,
    onNextLevel: handleNextLevel,
    onBackToSelect: () => transition(APP_STATES.LEVEL_SELECT),
  });

  gameplayRefs = ui.refs.gameplayRefs;
  physicsCtx = gameplayRefs.physicsCanvas.getContext("2d");
  vfxCtx = gameplayRefs.vfxCanvas.getContext("2d");

  bindPointerInput();
  bindKeyboardShortcuts();

  ui.updateLevelComplete({
    ...state.preview.complete,
    hasNextLevel: true,
  });
  ui.updateLevelFail(state.preview.fail);
  transition(APP_STATES.HOME);

  animationFrame = requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  cancelAnimationFrame(animationFrame);
});
