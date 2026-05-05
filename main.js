import {
  createPhysicsScene,
  destroyPhysicsScene,
  handleGestureFrame,
  handlePointerEvent,
  stepPhysicsScene,
} from "./game/physics.js";
import { getLevelById, getLevelIndex, getNextLevel, loadLevelData } from "./game/levelLoader.js";
import {
  getActiveHand,
  getPinchAnchor,
  isInSlingshotZone,
  updatePinchState,
} from "./gesture/gestureUtils.js";
import { HandTracker } from "./gesture/vision.js";
import { initWebcam } from "./gesture/webcamManager.js";
import { drawScene, readPalette } from "./render/drawPhysics.js";
import { CONSTANTS } from "./constants.js";
import { createAudioSystem } from "./audio/audio.js";
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
const audio = createAudioSystem();
let audioMuted = false;

let levels = [];
let scene = null;
let calibrationScene = null;
let calibrationPhysicsCtx = null;
let calibrationVfxCtx = null;
let calibrationReloadTimer = 0;

let animationFrame = 0;
let lastFrameTime = 0;

let tracker = null;
let trackerStatus = "OFFLINE";
let gestureReady = false;
let gestureBootPromise = null;
let pinchState = { active: false, event: "IDLE", pinchFrames: 0, releaseFrames: 0 };
let lastTrackerTimestampMs = 0;
let audioUnlockStarted = false;

function getMonotonicTrackerTimestamp(now) {
  const timestamp = Math.floor(now);
  const safeTimestamp = Math.max(timestamp, lastTrackerTimestampMs + 1);
  lastTrackerTimestampMs = safeTimestamp;
  return safeTimestamp;
}

const CALLOUTS = {
  launch: [
    "Release clean. Track the arc.",
    "Ball away. Follow through.",
    "Launch confirmed. Watch the collapse.",
  ],
  hit: [
    "Direct hit. Structure weakening.",
    "Impact confirmed. Load path compromised.",
    "Solid contact. Keep pressure on it.",
  ],
  miss: [
    "Missed. Reset and tighten the pull.",
    "Close. Pull longer before release.",
    "No break. Re-center and try again.",
  ],
  pigDown: [
    "Target down. Good transfer.",
    "Contact held. Target removed.",
    "Section cleared. Stay on rhythm.",
  ],
  clear: [
    "Site cleared.",
    "Demolition complete.",
    "Target zone neutralized.",
  ],
};

const CALIBRATION_LEVEL = {
  id: 0,
  name: "TRAINING RANGE",
  par: 1000,
  birds: ["standard"],
  structures: [
    {
      blocks: [
        { x: 700, y: 785, type: "1x1" },
      ],
      pigs: [
        { x: 880, y: 725, variant: "standard" },
      ],
    },
  ],
};

const CALIBRATION_RENDER_Y_OFFSET = 50;
const GAMEPLAY_RENDER_Y_OFFSET = 10;

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)] ?? "";
}

function setTrackerStatus(message) {
  trackerStatus = String(message ?? "OFFLINE").toUpperCase();
}

function ensureAudioUnlocked() {
  if (audioUnlockStarted) return;
  audioUnlockStarted = true;
  void audio.unlock().finally(() => {
    audioUnlockStarted = false;
  });
}

function syncMuteUi() {
  ui?.updateMuteButtons?.({ muted: audioMuted });
}

function countRemainingPigs(sceneRef) {
  return sceneRef.pigs.filter((pig) => !pig.dead).length;
}

function countUnusedBirds(sceneRef) {
  return sceneRef.birdQueue.filter((bird) => bird.status === "unused").length;
}

function calculateStars(sceneRef) {
  const birdsRemaining = countUnusedBirds(sceneRef);
  const projectedScore = sceneRef.score + birdsRemaining * CONSTANTS.BIRDS_REMAINING_BONUS;

  if (projectedScore >= sceneRef.level.par && birdsRemaining >= 1) return 3;
  if (projectedScore >= sceneRef.level.par * 0.8) return 2;
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

function handleSceneAudioAndCallouts(type, detail = {}) {
  audio.handleSceneEvent(type, detail);

  if (!ui) return;

  switch (type) {
    case "LAUNCH":
      ui.setGameplayCallout({ text: pickRandom(CALLOUTS.launch) });
      break;
    case "PIG_DAMAGED":
    case "BALL_IMPACT_HEAVY":
      ui.setGameplayCallout({ text: pickRandom(CALLOUTS.hit) });
      break;
    case "PIG_DESTROYED":
      ui.setGameplayCallout({ text: pickRandom(CALLOUTS.pigDown), tone: "celebration" });
      break;
    case "SHOT_MISSED":
      ui.setGameplayCallout({ text: pickRandom(CALLOUTS.miss), tone: "danger" });
      break;
    case "LEVEL_CLEARED":
      ui.setGameplayCallout({ text: pickRandom(CALLOUTS.clear), tone: "celebration" });
      break;
    case "HAND_LOST":
      ui.setGameplayCenterOverlay({ text: "HAND LOST. BRING IT BACK.", tone: "danger", durationMs: 1100 });
      if (detail.tryCount) {
        window.setTimeout(() => {
          ui?.setGameplayCenterOverlay({
            text: `TRY ${Math.min(detail.tryCount, 3)}`,
            durationMs: 900,
          });
        }, 1150);
      }
      break;
    case "TRY_ADVANCE":
      ui.setGameplayCenterOverlay({ text: `TRY ${Math.min(detail.tryCount ?? 1, 3)}`, durationMs: 900 });
      break;
    default:
      break;
  }
}

function getTrackerVideoSource() {
  if (state.current === APP_STATES.GAMEPLAY && ui?.refs?.gameplayVideo) {
    return ui.refs.gameplayVideo;
  }

  if (state.current === APP_STATES.CALIBRATION && ui?.refs?.calibrationVideo) {
    return ui.refs.calibrationVideo;
  }

  return sensorVideo;
}

async function ensureGestureBoot() {
  if (gestureReady) return true;
  if (gestureBootPromise) return gestureBootPromise;

  gestureBootPromise = (async () => {
    try {
      setTrackerStatus("REQUESTING CAMERA");
      const stream = await initWebcam(sensorVideo);
      ui.attachSharedStream(stream);

      tracker = new HandTracker(getTrackerVideoSource());
      await tracker.start(setTrackerStatus);
      gestureReady = true;
      setTrackerStatus("TRACKER LIVE");
      return true;
    } catch (error) {
      tracker = null;
      gestureReady = false;
      pinchState = { active: false, event: "IDLE", pinchFrames: 0, releaseFrames: 0 };
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

function buildCalibrationTutorial(gestureFrame) {
  const calibrationSlingOffsetY = 240;
  const handDetected = Boolean(gestureFrame.activeHand);
  const pullDistance = gestureFrame.handCenter
    ? Math.hypot(
        CONSTANTS.SLINGSHOT_ORIGIN.x - gestureFrame.handCenter.x,
        CONSTANTS.SLINGSHOT_ORIGIN.y - gestureFrame.handCenter.y,
      )
    : 0;

  state.calibration.handFrames = handDetected ? state.calibration.handFrames + 1 : 0;
  if (state.calibration.handFrames >= 10) {
    state.calibration.handPassed = true;
  }

  if (gestureFrame.pinchState.active) {
    state.calibration.zonePassed = true;
    state.calibration.pinchPassed = true;
  }

  if (gestureFrame.pinchState.active && pullDistance >= 42) {
    state.calibration.pullPassed = true;
  }

  if (gestureFrame.pinchState.event === "PINCH_RELEASE" && state.calibration.pullPassed) {
    state.calibration.releasePassed = true;
  }

  const pullStepDone = state.calibration.pinchPassed && state.calibration.pullPassed;
  const completedSteps = [
    state.calibration.handPassed,
    state.calibration.zonePassed,
    pullStepDone,
    state.calibration.releasePassed,
  ].filter(Boolean).length;

  const activeStep = !state.calibration.handPassed
    ? 1
    : !state.calibration.zonePassed
      ? 2
      : !pullStepDone
        ? 3
        : !state.calibration.releasePassed
          ? 4
          : 4;

  const guideCopy =
    activeStep === 1
      ? "HOLD ONE HAND CLEARLY IN FRAME UNTIL TRACKING STABILISES."
      : activeStep === 2
        ? "MOVE INTO THE SLING ZONE, THEN PINCH TO LOCK."
        : activeStep === 3
          ? "KEEP THE PINCH CLOSED, THEN PULL BACK TO BUILD TENSION."
          : state.calibration.releasePassed
            ? "TRAINING SHOT COMPLETE. YOU'RE READY TO ENTER THE SITE."
            : "OPEN YOUR FINGERS CLEANLY TO RELEASE THE TRAINING SHOT.";

  const caption = !handDetected
    ? "WAITING FOR HAND INPUT."
    : !gestureFrame.pinchState.active
      ? "MOVE TO THE SLING, THEN PINCH TO LOCK."
      : pullDistance < 42
        ? "PULL FARTHER BACK WHILE HOLDING THE PINCH."
        : "OPEN YOUR FINGERS TO RELEASE.";

  return {
    handDone: state.calibration.handPassed,
    zoneDone: state.calibration.zonePassed,
    pullDone: pullStepDone,
    releaseDone: state.calibration.releasePassed,
    activeStep,
    guideCopy,
    caption,
    handVisible: handDetected,
    handX: CONSTANTS.SLINGSHOT_ORIGIN.x,
    handY: CONSTANTS.SLINGSHOT_ORIGIN.y - calibrationSlingOffsetY,
    inZone: gestureFrame.inZone,
    progressPct: (completedSteps / 4) * 100,
    progressLabel: state.calibration.releasePassed
      ? "TRAINING COMPLETE"
      : `STEP ${activeStep} / 4`,
    ready: state.calibration.releasePassed && state.calibration.targetHitPassed,
  };
}

function updateCalibrationScreen(gestureFrame) {
  const handDetected = Boolean(gestureFrame.activeHand);
  const tutorial = buildCalibrationTutorial(gestureFrame);

  ui.updateCalibration({
    trackerStatus,
    handDetected,
    pinchActive: gestureFrame.pinchState.active,
    tutorial,
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

  const prompt =
    scene.subState === "READY"
      ? "PINCH AND PULL TO START THE SHOT."
      : scene.subState === "DRAGGING"
        ? scene.tension > 0.12
          ? "SHOT ARMED. LET GO TO FIRE."
          : "KEEP PINCHING AND PULL BACK FARTHER."
        : scene.subState === "FLYING"
          ? "TRACK THE IMPACT. NEXT SHOT LOADS AFTER SETTLE."
          : scene.statusText;
  ui.updateGameplayPrompt(prompt);
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

function renderCalibrationScene() {
  if (!calibrationScene || state.current !== APP_STATES.CALIBRATION) return;

  drawScene({
    scene: calibrationScene,
    physicsCtx: calibrationPhysicsCtx,
    vfxCtx: calibrationVfxCtx,
    palette,
  });
}

function destroyCalibrationScene() {
  if (calibrationReloadTimer) {
    window.clearTimeout(calibrationReloadTimer);
    calibrationReloadTimer = 0;
  }

  if (!calibrationScene) return;
  destroyPhysicsScene(calibrationScene);
  calibrationScene = null;
}

function mountCalibrationScene() {
  destroyCalibrationScene();
  calibrationScene = createPhysicsScene(CALIBRATION_LEVEL, {
    onEvent: audio.handleSceneEvent,
  });
  calibrationScene.hideGround = true;
  calibrationScene.renderYOffset = CALIBRATION_RENDER_Y_OFFSET;
  calibrationScene.gesture.trackerStatus = trackerStatus;
  lastFrameTime = 0;
  renderCalibrationScene();
}

function queueCalibrationReload(delayMs = 900) {
  if (calibrationReloadTimer) return;
  calibrationReloadTimer = window.setTimeout(() => {
    calibrationReloadTimer = 0;
    if (state.current === APP_STATES.CALIBRATION) {
      mountCalibrationScene();
    }
  }, delayMs);
}

function destroyScene() {
  if (!scene) return;
  destroyPhysicsScene(scene);
  scene = null;
}

function mountLevel(levelId) {
  const level = getLevelById(levels, levelId);
  if (!level) return;
  destroyScene();
  state.levelId = level.id;
  scene = createPhysicsScene(level, {
    onEvent: audio.handleSceneEvent,
  });
  scene.renderYOffset = GAMEPLAY_RENDER_Y_OFFSET;
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

  if (state.current === APP_STATES.CALIBRATION && nextState !== APP_STATES.CALIBRATION) {
    destroyCalibrationScene();
  }

  if (nextState !== APP_STATES.CALIBRATION && nextState !== APP_STATES.GAMEPLAY) {
    ui.clearWebcamOverlays();
  }

  setAppState(nextState);
  ui.setActiveScreen(nextState);

  if (nextState === APP_STATES.HOME) {
    audio.stopAmbientHum();
    updateHomeScreen();
    return;
  }

if (nextState === APP_STATES.CALIBRATION) {
  audio.startAmbientHum();
  resetCalibrationProgress();

  state.calibration.targetHitPassed = false;

  mountCalibrationScene();

  ui.updateCalibration({
    trackerStatus,
    handDetected: false,
    pinchActive: false,
    tutorial: buildCalibrationTutorial(makeGestureFrame()),
  });

  void ensureGestureBoot();
  return;
}

  if (nextState === APP_STATES.LEVEL_SELECT) {
    audio.stopAmbientHum();
    renderLevelSelect();
    return;
  }

  if (nextState === APP_STATES.GAMEPLAY) {
    audio.startAmbientHum();
    const nextLevelId = data.levelId ?? state.levelId ?? getCurrentPlayableLevelId();
    mountLevel(nextLevelId);
    void ensureGestureBoot();
    return;
  }

  if (nextState === APP_STATES.LEVEL_COMPLETE) {
    audio.stopAmbientHum();
    audio.handleSceneEvent("LEVEL_COMPLETE", { stars: data.stars });
    ui.updateLevelComplete(data);
    return;
  }

  if (nextState === APP_STATES.LEVEL_FAIL) {
    audio.stopAmbientHum();
    audio.handleSceneEvent("LEVEL_FAIL");
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
  ensureAudioUnlocked();
  audio.playUiConfirm();
  transition(APP_STATES.CALIBRATION);
}

function handleContinue() {
  ensureAudioUnlocked();
  audio.playUiBack();
  transition(APP_STATES.LEVEL_SELECT);
}

function handleEnterSite() {
  ensureAudioUnlocked();
  audio.playUiConfirm();
  ensureSaveExists();
  transition(APP_STATES.LEVEL_SELECT);
}

function handleSelectLevel(levelId) {
  ensureAudioUnlocked();
  audio.playUiConfirm();
  transition(APP_STATES.GAMEPLAY, { levelId });
}

function handleRetryCurrent() {
  ensureAudioUnlocked();
  audio.playUiConfirm();
  transition(APP_STATES.GAMEPLAY, { levelId: state.levelId });
}

function handleNextLevel() {
  ensureAudioUnlocked();
  audio.playUiConfirm();
  const nextLevel = getNextLevel(levels, state.levelId);

  if (!nextLevel) {
    handleBackToSelect();
    return;
  }

  transition(APP_STATES.GAMEPLAY, { levelId: nextLevel.id });
}

function handleBackToSelect() {
  ensureAudioUnlocked();
  audio.playUiBack();
  transition(APP_STATES.LEVEL_SELECT);
}

function handleBackHome() {
  ensureAudioUnlocked();
  audio.playUiBack();
  transition(APP_STATES.HOME);
}

function handleToggleMute() {
  ensureAudioUnlocked();
  audioMuted = audio.toggleMuted();
  if (!audioMuted) {
    if (state.current === APP_STATES.CALIBRATION || state.current === APP_STATES.GAMEPLAY) {
      audio.startAmbientHum();
    }
  } else {
    audio.stopAmbientHum();
  }
  syncMuteUi();
}

function bindAudioUnlock() {
  const unlock = () => ensureAudioUnlocked();
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

function bindPointerInput() {
  gameplayRefs.gameRoot.addEventListener("pointerdown", (event) => {
    if (state.current !== APP_STATES.GAMEPLAY || !scene) return;
    ensureAudioUnlocked();

    const rect = gameplayRefs.gameRoot.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * gameplayRefs.physicsCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * gameplayRefs.physicsCanvas.height,
    };

    const handled = handlePointerEvent(scene, "down", point, event.pointerType);
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

    handlePointerEvent(scene, "move", point, event.pointerType);
    renderGameplay();
  });

  const finishPointer = (event) => {
    if (state.current !== APP_STATES.GAMEPLAY || !scene?.dragging) return;

    const rect = gameplayRefs.gameRoot.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * gameplayRefs.physicsCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * gameplayRefs.physicsCanvas.height,
    };

    handlePointerEvent(scene, "up", point, event.pointerType);
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
    ensureAudioUnlocked();
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

  tracker.setVideoSource(getTrackerVideoSource());

let hands = [];

try {
  hands = tracker.detect(getMonotonicTrackerTimestamp(now), {
    x: 0,
    y: 0,
    width: gameplayRefs.physicsCanvas.width,
    height: gameplayRefs.physicsCanvas.height,
  });
} catch (error) {
  console.warn("Tracker frame skipped:", error);

  pinchState = { active: false, event: "IDLE", pinchFrames: 0, releaseFrames: 0 };
  setTrackerStatus("TRACKER SYNCING");

  return {
    ...gestureFrame,
    pinchState,
  };
}

  const activeHand = getActiveHand(hands);

  if (!activeHand) {
    pinchState = pinchState.active
      ? { active: false, event: "HAND_LOST", pinchFrames: 0, releaseFrames: 0 }
      : { active: false, event: "IDLE", pinchFrames: 0, releaseFrames: 0 };
    return { ...gestureFrame, pinchState };
  }

  const handCenter = getPinchAnchor(activeHand);
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
    if (calibrationScene) {
      handleGestureFrame(calibrationScene, gestureFrame);
      calibrationScene.gesture.trackerStatus = trackerStatus;
      stepPhysicsScene(calibrationScene, deltaMs);
      

const calibrationTargetHit =
  calibrationScene.pigs?.some((pig) => {
    const health = pig.health ?? pig.maxHealth ?? 1;
    const maxHealth = pig.maxHealth ?? 1;

    return pig.dead || health < maxHealth;
  }) ||
  calibrationScene.subState === "SITE_CLEAR";

if (calibrationTargetHit) {
  state.calibration.targetHitPassed = true;
}

const shouldReloadTrainingBall =
  calibrationScene.subState === "OUT_OF_BIRDS" &&
  !state.calibration.targetHitPassed;

if (shouldReloadTrainingBall) {
  queueCalibrationReload(5000);
}

      renderCalibrationScene();
    }

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


async function waitForMatter(timeoutMs = 4000) {
  const start = performance.now();
  while (!window.Matter) {
    if (performance.now() - start > timeoutMs) {
      throw new Error("Matter.js failed to load.");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

async function boot() {
  await waitForMatter();

  const levelPayload = await loadLevelData(new URL("./data/levels.json", import.meta.url));
  levels = levelPayload.levels;
  loadSave();

  ui = initScreens({
    onStart: handleStart,
    onContinue: handleContinue,
    onBackHome: handleBackHome,
    onToggleMute: handleToggleMute,
    onEnterSite: handleEnterSite,
    onSelectLevel: handleSelectLevel,
    onRetryCurrent: handleRetryCurrent,
    onNextLevel: handleNextLevel,
    onBackToSelect: handleBackToSelect,
    onGameplayHome: handleBackHome,
    onGameplayRestart: handleRetryCurrent,
  });
  syncMuteUi();

  gameplayRefs = ui.refs.gameplayRefs;
  physicsCtx = gameplayRefs.physicsCanvas.getContext("2d");
  vfxCtx = gameplayRefs.vfxCanvas.getContext("2d");
  calibrationPhysicsCtx = ui.refs.calibrationPhysicsCanvas.getContext("2d");
calibrationVfxCtx = ui.refs.calibrationVfxCanvas.getContext("2d");


  bindPointerInput();
  bindKeyboardShortcuts();
  bindAudioUnlock();

  ui.updateLevelComplete({
    ...state.preview.complete,
    hasNextLevel: true,
  });
  ui.updateLevelFail(state.preview.fail);
transition(APP_STATES.LEVEL_SELECT);
animationFrame = requestAnimationFrame(frame);
  // transition(APP_STATES.HOME);

  //animationFrame = requestAnimationFrame(frame);
}

boot().catch((error) => {
  console.error(error);
  cancelAnimationFrame(animationFrame);
});
