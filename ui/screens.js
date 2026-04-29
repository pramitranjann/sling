import { CONSTANTS } from "../constants.js";
import { buildLevelCards } from "./levelSelect.js";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function clearOverlay(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawScanlines(ctx, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
  for (let y = 0; y < height; y += 2) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}

function drawHandSkeleton(canvas, hand, pinchActive) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (!hand?.points?.length) {
    drawScanlines(ctx, width, height);
    return;
  }

  const points = hand.points.map((point) => ({
    x: (point.x / CONSTANTS.CANVAS_W) * width,
    y: (point.y / CONSTANTS.CANVAS_H) * height,
  }));

  ctx.save();
  ctx.strokeStyle = pinchActive ? "#FFD100" : "rgba(255, 209, 0, 0.68)";
  ctx.fillStyle = pinchActive ? "#FFD100" : "rgba(255, 209, 0, 0.56)";
  ctx.lineWidth = Math.max(1.2, width / 180);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  HAND_CONNECTIONS.forEach(([from, to]) => {
    const a = points[from];
    const b = points[to];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  points.forEach((point, index) => {
    const radius = index === 4 || index === 8 ? Math.max(3.5, width / 80) : Math.max(2, width / 120);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
  drawScanlines(ctx, width, height);
}

function applyTutorialStep(stepNode, statusNode, isDone, isActive) {
  if (!stepNode || !statusNode) return;
  stepNode.classList.toggle("tutorial-step--done", isDone);
  stepNode.classList.toggle("tutorial-step--active", !isDone && isActive);
  statusNode.textContent = isDone ? "DONE" : isActive ? "LIVE" : "WAIT";
}

function markup() {
  return {
    home: `
      <div class="screen-frame">
        <div class="stripe"></div>
        <section class="screen-panel screen-panel--home">
          <div class="screen-panel__hero">
            <span class="eyebrow">DEMOLITION TRAINING / STATE LINKED BUILD</span>
            <h1 class="hero-title">SLING.</h1>
            <p class="hero-copy">
              A webcam-controlled demolition ritual built in black hazard bars, draft paper grid,
              and high-vis signal yellow. Pull back, release, and watch the site fold.
            </p>
          </div>
          <div class="home-actions">
            <button id="homeStartBtn" class="btn-primary" type="button">START</button>
            <button id="homeContinueBtn" class="btn-secondary" type="button">CONTINUE</button>
            <div class="home-note">WEBCAM REQUIRED</div>
          </div>
        </section>
        <div class="stripe"></div>
      </div>
    `,
    calibration: `
      <div class="screen-frame">
        <div class="stripe"></div>
        <section class="screen-panel">
          <header class="screen-bar">
            <button id="calibrationBackBtn" class="nav-link" type="button">← BACK</button>
            <span class="screen-bar__title">CALIBRATION</span>
            <span class="screen-bar__spacer"></span>
          </header>
          <div class="screen-content calibration-layout">
            <div class="calibration-stage">
              <div class="calibration-feed">
                <video id="calibrationVideo" autoplay playsinline muted></video>
                <canvas id="calibrationOverlay" width="1280" height="720"></canvas>
                <div class="calibration-feed__status">
                  <span class="calibration-dot" id="calibrationDot"></span>
                  <span id="calibrationFeedLabel">WAITING FOR HAND</span>
                </div>
              </div>
            </div>
            <div class="calibration-stack">
              <div class="guide-card">
                <span class="guide-card__eyebrow">TRAINING WALKTHROUGH</span>
                <h2 class="guide-card__title">LEARN THE SHOT BEFORE YOU ENTER THE SITE.</h2>
                <p class="guide-card__copy" id="calibrationGuideCopy">
                  SHOW ONE HAND TO THE CAMERA TO BEGIN THE LIVE DEMO.
                </p>
                <div class="guide-card__progress" id="calibrationGuideProgress">STEP 1 / 4</div>
              </div>

              <div class="tutorial-steps">
                <div class="tutorial-step" id="calibrationStepHand">
                  <div>
                    <span class="tutorial-step__index">01</span>
                    <span class="tutorial-step__label">SHOW YOUR HAND</span>
                  </div>
                  <span class="tutorial-step__state" id="calibrationStepHandState">WAIT</span>
                </div>
                <div class="tutorial-step" id="calibrationStepZone">
                  <div>
                    <span class="tutorial-step__index">02</span>
                    <span class="tutorial-step__label">MOVE INTO THE SLING ZONE</span>
                  </div>
                  <span class="tutorial-step__state" id="calibrationStepZoneState">WAIT</span>
                </div>
                <div class="tutorial-step" id="calibrationStepPull">
                  <div>
                    <span class="tutorial-step__index">03</span>
                    <span class="tutorial-step__label">PINCH AND PULL BACK</span>
                  </div>
                  <span class="tutorial-step__state" id="calibrationStepPullState">WAIT</span>
                </div>
                <div class="tutorial-step" id="calibrationStepRelease">
                  <div>
                    <span class="tutorial-step__index">04</span>
                    <span class="tutorial-step__label">OPEN TO RELEASE</span>
                  </div>
                  <span class="tutorial-step__state" id="calibrationStepReleaseState">WAIT</span>
                </div>
              </div>

              <div class="training-pad">
                <div class="training-pad__zone"></div>
                <div class="training-pad__origin"></div>
                <div class="training-pad__hand" id="calibrationTrainingHand"></div>
                <div class="training-pad__caption" id="calibrationTrainingCaption">
                  WAITING FOR HAND INPUT.
                </div>
              </div>

              <div class="rail-block">
                <span class="rail-block__label">TRAINING PROGRESS</span>
                <div class="rail-block__track">
                  <div id="calibrationRailFill" class="rail-block__fill"></div>
                </div>
              </div>
              <div class="tracker-copy" id="calibrationTrackerCopy">TRACKER OFFLINE</div>
              <button id="enterSiteBtn" class="btn-primary" type="button" disabled>ENTER SITE</button>
            </div>
          </div>
        </section>
        <div class="stripe"></div>
      </div>
    `,
    levelSelect: `
      <div class="screen-frame">
        <div class="stripe"></div>
        <section class="screen-panel">
          <header class="screen-bar">
            <button id="levelSelectBackBtn" class="nav-link" type="button">← BACK</button>
            <span class="screen-bar__title">LEVEL SELECT</span>
            <span class="screen-bar__spacer"></span>
          </header>
          <div class="screen-content">
            <div id="levelCardGrid" class="level-card-grid"></div>
          </div>
        </section>
        <div class="stripe"></div>
      </div>
    `,
    gameplay: `
      <div class="screen-frame screen-frame--gameplay">
        <div class="stripe"></div>
        <section class="screen-panel screen-panel--gameplay">
          <div id="game-root" class="game-root">
            <div class="game-root__bg grid-bg"></div>
            <canvas id="canvas-physics" width="1280" height="720"></canvas>
            <canvas id="canvas-vfx" width="1280" height="720"></canvas>

            <div class="webcam-window" id="gameplayWebcamWindow">
              <video id="gameplayVideo" autoplay playsinline muted></video>
              <canvas id="gameplayOverlay" width="240" height="180"></canvas>
              <div class="webcam-window__pinch" id="gameplayPinchDot"></div>
              <div class="webcam-window__rec" id="gameplayRecDot"></div>
              <div class="webcam-window__label">
                <span>SITE CAM 01</span>
                <span id="gameplayCamLabel">TRACKER OFFLINE</span>
              </div>
            </div>

            <div class="hud-top">
              <div class="hud-group">
                <div class="level-badge">
                  <span class="level-badge__label">LEVEL</span>
                  <span class="level-badge__value" id="levelNumber">01</span>
                </div>
                <div class="hud-meta">
                  <span class="hud-meta__label">SITE</span>
                  <span class="hud-meta__value" id="levelName">SITE A</span>
                </div>
              </div>

              <div class="hud-group hud-group--center">
                <div class="hud-meta">
                  <span class="hud-meta__label">PAR</span>
                  <span class="hud-meta__value" id="parScore">0</span>
                </div>
                <div class="hud-meta">
                  <span class="hud-meta__label">STATE</span>
                  <span class="hud-meta__value" id="shotState">READY</span>
                </div>
              </div>

              <div class="hud-score">
                <span class="hud-score__label">SCORE</span>
                <span class="hud-score__value" id="hudScore">0</span>
              </div>
            </div>

            <div class="hud-bottom">
              <div class="hud-bottom__group">
                <div class="hud-meta hud-meta--dark">
                  <span class="hud-meta__label">WRECKING BALLS</span>
                </div>
                <div class="bird-queue" id="birdQueue"></div>
              </div>

              <div class="hud-bottom__group hud-bottom__group--right">
                <div class="hud-meta hud-meta--dark">
                  <span class="hud-meta__label">TENSION</span>
                  <span class="hud-meta__value" id="tensionPct">0%</span>
                </div>
                <div class="tension-rail">
                  <div class="tension-fill" id="tensionFill"></div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div class="stripe"></div>
      </div>
    `,
    complete: `
      <div class="screen-frame">
        <div class="stripe"></div>
        <section class="screen-panel">
          <header class="screen-bar screen-bar--stacked">
            <span class="screen-bar__eyebrow" id="completeLevelLabel">LEVEL 03</span>
            <span class="screen-bar__hero screen-bar__hero--yellow">COMPLETE</span>
          </header>
          <div class="screen-content result-layout">
            <div class="result-stars" id="completeStars">★ ★ ☆</div>
            <div class="result-metrics">
              <div class="result-card">
                <span class="result-card__label">SCORE</span>
                <span class="result-card__value" id="completeScore">4,450</span>
              </div>
              <div class="result-card">
                <span class="result-card__label">PAR</span>
                <span class="result-card__value" id="completePar">4,200</span>
              </div>
              <div class="result-card result-card--signal">
                <span class="result-card__label">BONUS</span>
                <span class="result-card__value" id="completeBonus">+400 BRD</span>
              </div>
            </div>
            <div class="result-actions">
              <button id="completeRetryBtn" class="btn-secondary" type="button">RETRY</button>
              <button id="completeNextBtn" class="btn-primary" type="button">NEXT SITE →</button>
            </div>
          </div>
        </section>
        <div class="stripe"></div>
      </div>
    `,
    fail: `
      <div class="screen-frame">
        <div class="stripe"></div>
        <section class="screen-panel">
          <header class="screen-bar screen-bar--stacked">
            <span class="screen-bar__eyebrow" id="failLevelLabel">LEVEL 03</span>
            <span class="screen-bar__hero screen-bar__hero--fail">FAILED</span>
          </header>
          <div class="screen-content fail-layout">
            <div class="fail-row">
              <span>PIGS REMAINING</span>
              <span id="failPigsRemaining">1</span>
            </div>
            <div class="fail-row">
              <span>SCORE</span>
              <span id="failScore">1,200</span>
            </div>
            <div class="result-actions result-actions--stacked">
              <button id="failRetryBtn" class="btn-primary" type="button">RETRY</button>
              <button id="failLevelSelectBtn" class="btn-secondary" type="button">LEVEL SELECT</button>
            </div>
          </div>
        </section>
        <div class="stripe"></div>
      </div>
    `,
  };
}

export function initScreens(callbacks) {
  const roots = {
    HOME: document.getElementById("screen-home"),
    CALIBRATION: document.getElementById("screen-calibration"),
    LEVEL_SELECT: document.getElementById("screen-level-select"),
    GAMEPLAY: document.getElementById("screen-gameplay"),
    LEVEL_COMPLETE: document.getElementById("screen-level-complete"),
    LEVEL_FAIL: document.getElementById("screen-level-fail"),
  };

  const templates = markup();
  roots.HOME.innerHTML = templates.home;
  roots.CALIBRATION.innerHTML = templates.calibration;
  roots.LEVEL_SELECT.innerHTML = templates.levelSelect;
  roots.GAMEPLAY.innerHTML = templates.gameplay;
  roots.LEVEL_COMPLETE.innerHTML = templates.complete;
  roots.LEVEL_FAIL.innerHTML = templates.fail;

  const refs = {
    homeContinueBtn: document.getElementById("homeContinueBtn"),
    calibrationVideo: document.getElementById("calibrationVideo"),
    calibrationOverlay: document.getElementById("calibrationOverlay"),
    calibrationDot: document.getElementById("calibrationDot"),
    calibrationFeedLabel: document.getElementById("calibrationFeedLabel"),
    calibrationGuideCopy: document.getElementById("calibrationGuideCopy"),
    calibrationGuideProgress: document.getElementById("calibrationGuideProgress"),
    calibrationRailFill: document.getElementById("calibrationRailFill"),
    calibrationTrackerCopy: document.getElementById("calibrationTrackerCopy"),
    calibrationStepHand: document.getElementById("calibrationStepHand"),
    calibrationStepHandState: document.getElementById("calibrationStepHandState"),
    calibrationStepZone: document.getElementById("calibrationStepZone"),
    calibrationStepZoneState: document.getElementById("calibrationStepZoneState"),
    calibrationStepPull: document.getElementById("calibrationStepPull"),
    calibrationStepPullState: document.getElementById("calibrationStepPullState"),
    calibrationStepRelease: document.getElementById("calibrationStepRelease"),
    calibrationStepReleaseState: document.getElementById("calibrationStepReleaseState"),
    calibrationTrainingHand: document.getElementById("calibrationTrainingHand"),
    calibrationTrainingCaption: document.getElementById("calibrationTrainingCaption"),
    enterSiteBtn: document.getElementById("enterSiteBtn"),
    levelCardGrid: document.getElementById("levelCardGrid"),
    completeLevelLabel: document.getElementById("completeLevelLabel"),
    completeStars: document.getElementById("completeStars"),
    completeScore: document.getElementById("completeScore"),
    completePar: document.getElementById("completePar"),
    completeBonus: document.getElementById("completeBonus"),
    completeNextBtn: document.getElementById("completeNextBtn"),
    failLevelLabel: document.getElementById("failLevelLabel"),
    failPigsRemaining: document.getElementById("failPigsRemaining"),
    failScore: document.getElementById("failScore"),
    gameplayVideo: document.getElementById("gameplayVideo"),
    gameplayOverlay: document.getElementById("gameplayOverlay"),
    gameplayCamLabel: document.getElementById("gameplayCamLabel"),
    gameplayPinchDot: document.getElementById("gameplayPinchDot"),
    gameplayRecDot: document.getElementById("gameplayRecDot"),
    gameplayRefs: {
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
    },
  };

  document.getElementById("homeStartBtn").addEventListener("click", callbacks.onStart);
  refs.homeContinueBtn.addEventListener("click", callbacks.onContinue);
  document.getElementById("calibrationBackBtn").addEventListener("click", callbacks.onBackHome);
  refs.enterSiteBtn.addEventListener("click", callbacks.onEnterSite);
  document.getElementById("levelSelectBackBtn").addEventListener("click", callbacks.onBackHome);
  document.getElementById("completeRetryBtn").addEventListener("click", callbacks.onRetryCurrent);
  document.getElementById("completeNextBtn").addEventListener("click", callbacks.onNextLevel);
  document.getElementById("failRetryBtn").addEventListener("click", callbacks.onRetryCurrent);
  document.getElementById("failLevelSelectBtn").addEventListener("click", callbacks.onBackToSelect);

  return {
    roots,
    refs,
    setActiveScreen(nextState) {
      Object.entries(roots).forEach(([name, node]) => {
        node.classList.toggle("is-active", name === nextState);
      });
    },
    updateHome({ continueEnabled }) {
      refs.homeContinueBtn.disabled = !continueEnabled;
    },
    updateCalibration({ trackerStatus, handDetected, pinchActive, tutorial }) {
      refs.calibrationDot.classList.toggle("calibration-dot--active", handDetected);
      refs.calibrationFeedLabel.textContent = handDetected ? "HAND DETECTED" : "WAITING FOR HAND";
      refs.calibrationGuideCopy.textContent = tutorial.guideCopy;
      refs.calibrationGuideProgress.textContent = tutorial.progressLabel;
      refs.calibrationRailFill.style.width = `${tutorial.progressPct}%`;
      refs.calibrationTrackerCopy.textContent = trackerStatus;
      applyTutorialStep(
        refs.calibrationStepHand,
        refs.calibrationStepHandState,
        tutorial.handDone,
        tutorial.activeStep === 1,
      );
      applyTutorialStep(
        refs.calibrationStepZone,
        refs.calibrationStepZoneState,
        tutorial.zoneDone,
        tutorial.activeStep === 2,
      );
      applyTutorialStep(
        refs.calibrationStepPull,
        refs.calibrationStepPullState,
        tutorial.pullDone,
        tutorial.activeStep === 3,
      );
      applyTutorialStep(
        refs.calibrationStepRelease,
        refs.calibrationStepReleaseState,
        tutorial.releaseDone,
        tutorial.activeStep === 4,
      );

      refs.calibrationTrainingHand.classList.toggle("training-pad__hand--visible", tutorial.handVisible);
      refs.calibrationTrainingHand.classList.toggle("training-pad__hand--pinched", pinchActive);
      refs.calibrationTrainingHand.classList.toggle("training-pad__hand--in-zone", tutorial.inZone);
      refs.calibrationTrainingHand.style.left = `${tutorial.handXPct}%`;
      refs.calibrationTrainingHand.style.top = `${tutorial.handYPct}%`;
      refs.calibrationTrainingCaption.textContent = tutorial.caption;
      refs.enterSiteBtn.disabled = !tutorial.ready;
    },
    renderCalibrationOverlay({ hand, pinchActive }) {
      drawHandSkeleton(refs.calibrationOverlay, hand, pinchActive);
    },
    renderLevelSelect({ levels, currentLevelId, saveHelpers }) {
      buildLevelCards({
        container: refs.levelCardGrid,
        levels,
        currentLevelId,
        saveHelpers,
        onSelect: callbacks.onSelectLevel,
      });
    },
    updateLevelComplete({ levelId, score, par, stars, birdsRemaining, hasNextLevel }) {
      refs.completeLevelLabel.textContent = `LEVEL ${String(levelId).padStart(2, "0")}`;
      refs.completeStars.textContent = Array.from({ length: 3 }, (_, index) => (index < stars ? "★" : "☆")).join(" ");
      refs.completeScore.textContent = score.toLocaleString();
      refs.completePar.textContent = par.toLocaleString();
      refs.completeBonus.textContent = `+${birdsRemaining * 400} BRD`;
      refs.completeNextBtn.textContent = hasNextLevel ? "NEXT SITE →" : "LEVEL SELECT";
    },
    updateLevelFail({ levelId, score, pigsRemaining }) {
      refs.failLevelLabel.textContent = `LEVEL ${String(levelId).padStart(2, "0")}`;
      refs.failPigsRemaining.textContent = String(pigsRemaining);
      refs.failScore.textContent = score.toLocaleString();
    },
    updateGameplayCamera({ trackerStatus, handDetected, pinchActive }) {
      refs.gameplayCamLabel.textContent = trackerStatus;
      refs.gameplayRecDot.classList.toggle("webcam-window__rec--active", handDetected);
      refs.gameplayPinchDot.classList.toggle("webcam-window__pinch--active", pinchActive);
    },
    renderGameplayOverlay({ hand, pinchActive }) {
      drawHandSkeleton(refs.gameplayOverlay, hand, pinchActive);
    },
    clearWebcamOverlays() {
      clearOverlay(refs.calibrationOverlay);
      clearOverlay(refs.gameplayOverlay);
    },
    attachSharedStream(stream) {
      [refs.calibrationVideo, refs.gameplayVideo].forEach((video) => {
        if (!video) return;
        if (video.srcObject !== stream) {
          video.srcObject = stream;
        }
        video.play().catch(() => {});
      });
    },
  };
}
