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
    const radius =
      index === 4 || index === 8
        ? Math.max(3.5, width / 80)
        : Math.max(2, width / 120);

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
  stepNode.classList.toggle("tutorial-step--pending", !isDone && !isActive);
  if (isDone) {
    statusNode.textContent = "DONE";
  } else if (isActive) {
    statusNode.textContent = "NOW";
  } else {
    statusNode.textContent = "UP NEXT";
  }
}

function clearTimers(timers) {
  while (timers.length) {
    window.clearTimeout(timers.pop());
  }
}

function renderStarMarkup(count) {
  return Array.from(
    { length: 3 },
    (_, index) => `
      <span
        class="result-star ${index < count ? "result-star--earned" : ""}"
        data-star-index="${index}"
        aria-hidden="true"
      >
        ★
      </span>
    `,
  ).join("");
}

function animateCount(node, value, durationMs, onTick) {
  if (!node) return;
  const start = performance.now();
  const finish = Math.max(value, 0);

  const tick = (now) => {
    const progress = Math.min((now - start) / durationMs, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    node.textContent = Math.round(finish * eased).toLocaleString();
    onTick?.(progress);

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    }
  };

  node.textContent = "0";
  window.requestAnimationFrame(tick);
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
              and high-vis signal yellow. Pull back, release, and break the balance between structure and impact.
            </p>
          </div>
          <div class="home-actions">
            <button id="homeStartBtn" class="btn-primary" type="button">START SESSION</button>
            <button id="homeContinueBtn" class="btn-secondary" type="button">CONTINUE RUN</button>
            <div class="home-note">CAMERA WAKES ON FIRST TAP. TRACK THE HAND, LOCK THE SLING, RELEASE CLEAN.</div>
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
            <button id="calibrationMuteBtn" class="nav-link nav-link--button" type="button">MUTE</button>
          </header>

          <div class="screen-content calibration-shell">
            <div class="calibration-demo game-root">
              <div class="game-root__bg grid-bg"></div>

              <canvas
                id="calibrationPhysicsCanvas"
                class="calibration-demo__canvas"
                width="1280"
                height="720"
              ></canvas>

              <canvas
                id="calibrationVfxCanvas"
                class="calibration-demo__canvas calibration-demo__canvas--vfx"
                width="1280"
                height="720"
              ></canvas>

              <div class="webcam-window webcam-window--calibration">
                <video id="calibrationVideo" autoplay playsinline muted></video>
                <canvas id="calibrationOverlay" width="1280" height="720"></canvas>
                <div class="webcam-window__pinch" id="calibrationPinchDot"></div>
                <div class="webcam-window__rec" id="calibrationRecDot"></div>
                <div class="webcam-window__label">
                  <span>TRAINING CAM</span>
                  <span id="calibrationFeedLabel">WAITING FOR HAND</span>
                </div>
              </div>

              <div class="hud-top calibration-demo__hud">
                <div class="hud-group">
                  <div class="level-badge">
                    <span class="level-badge__label">MODE</span>
                    <span class="level-badge__value">TRAIN</span>
                  </div>
                  <div class="hud-meta">
                    <span class="hud-meta__label">TRACKER</span>
                    <span class="hud-meta__value" id="calibrationTrackerCopy">OFFLINE</span>
                  </div>
                </div>

                <div class="hud-group hud-group--center">
                  <div class="hud-meta">
                    <span class="hud-meta__label">STEP</span>
                    <span class="hud-meta__value" id="calibrationGuideProgress">STEP 1 / 4</span>
                  </div>
                </div>

                <div class="hud-score">
                  <span class="hud-score__label">STATUS</span>
                  <span class="hud-score__value" id="calibrationDemoStatus">WAIT</span>
                </div>
              </div>

              <div class="calibration-demo__guide guide-card">
                <span class="guide-card__eyebrow">LIVE TRAINING</span>
                <h2 class="guide-card__title calibration-demo__guide-title">FOLLOW THE NEXT CUE.</h2>
                <p class="guide-card__copy" id="calibrationGuideCopy">
                  SHOW ONE HAND TO THE CAMERA TO BEGIN THE LIVE DEMO.
                </p>

                <div class="tutorial-steps tutorial-steps--compact">
                  <div class="tutorial-step tutorial-step--compact" id="calibrationStepHand">
                    <div class="tutorial-step__body">
                      <span class="tutorial-step__label">Show Your Hand</span>
                    </div>
                    <span class="tutorial-step__state" id="calibrationStepHandState">WAIT</span>
                  </div>

                  <div class="tutorial-step tutorial-step--compact" id="calibrationStepZone">
                    <div class="tutorial-step__body">
                      <span class="tutorial-step__label">Pinch To Lock</span>
                    </div>
                    <span class="tutorial-step__state" id="calibrationStepZoneState">WAIT</span>
                  </div>

                  <div class="tutorial-step tutorial-step--compact" id="calibrationStepPull">
                    <div class="tutorial-step__body">
                      <span class="tutorial-step__label">Pull Back</span>
                    </div>
                    <span class="tutorial-step__state" id="calibrationStepPullState">WAIT</span>
                  </div>

                  <div class="tutorial-step tutorial-step--compact" id="calibrationStepRelease">
                    <div class="tutorial-step__body">
                      <span class="tutorial-step__label">Open To Fire</span>
                    </div>
                    <span class="tutorial-step__state" id="calibrationStepReleaseState">WAIT</span>
                  </div>
                </div>

                <div class="tracker-copy calibration-demo__guide-hint">
                  MOVE INTO RANGE, PINCH TO LOCK, THEN OPEN YOUR HAND TO RELEASE.
                </div>
              </div>
          
<button id="enterSiteBtn" class="calibration-demo__enter-final" type="button" disabled>
  ENTER THE RANGE
</button>

              <div class="hud-bottom calibration-demo__footer">
                <div class="hud-bottom__group">
                  <div class="hud-meta hud-meta--dark">
                    <span class="hud-meta__label">INSTRUCTION</span>
                    <span class="hud-meta__value calibration-demo__caption" id="calibrationTrainingCaption">
                      WAITING FOR HAND INPUT.
                    </span>
                  </div>
                </div>

                <div class="hud-bottom__group hud-bottom__group--right calibration-demo__progress">
                  <span class="rail-block__label">TRAINING PROGRESS</span>
                  <div class="rail-block__track">
                    <div id="calibrationRailFill" class="rail-block__fill"></div>
                  </div>
                </div>
              </div>
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
          <div class="screen-content level-select-layout">
            <div class="level-select-copy">
              <span class="guide-card__eyebrow">UNLOCK PATH</span>
              <h2 class="guide-card__title">CLEAR EACH DEMOLITION SITE TO OPEN THE NEXT STRUCTURAL TEST.</h2>
              <p class="guide-card__copy">
                Pick the active site, clear it cleanly, and unlock the next structural challenge.
              </p>
            </div>
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

            <div class="gameplay-callout" id="gameplayCallout" aria-live="polite"></div>
            <div class="gameplay-center-overlay" id="gameplayCenterOverlay" aria-live="polite"></div>
            <div class="gameplay-prompt" id="gameplayPrompt">MOVE INTO THE SLING ZONE AND PINCH TO LOCK.</div>

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

              <div class="hud-actions">
                <button id="gameplayMuteBtn" class="btn-secondary hud-btn hud-btn--mute" type="button">MUTE</button>
                <button id="gameplayHomeBtn" class="btn-secondary hud-btn hud-btn--home" type="button">HOME</button>
                <button id="gameplayRestartBtn" class="btn-primary hud-btn hud-btn--restart" type="button">RESTART</button>
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
            <span class="screen-bar__hero screen-bar__hero--yellow" id="completeHeadline">SITE CLEARED</span>
          </header>
          <div class="screen-content result-layout">
            <div class="result-burst" aria-hidden="true">
              <div class="result-burst__flash" id="completeFlash"></div>
              <div class="result-burst__confetti" id="completeConfetti"></div>
            </div>
            <p class="result-copy" id="completeTagline">THE STRUCTURE LOST THE ARGUMENT.</p>
            <div class="result-stars" id="completeStars"></div>
            <div class="result-metrics">
              <div class="result-card">
                <span class="result-card__label">SCORE</span>
                <span class="result-card__value" id="completeScore">0</span>
              </div>
              <div class="result-card">
                <span class="result-card__label">PAR</span>
                <span class="result-card__value" id="completePar">4,200</span>
              </div>
              <div class="result-card result-card--signal">
                <span class="result-card__label">BONUS</span>
                <span class="result-card__value" id="completeBonus">+400 RESERVE</span>
              </div>
            </div>
            <div class="result-actions">
              <button id="completeRetryBtn" class="btn-secondary" type="button">RUN IT AGAIN</button>
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
            <span class="screen-bar__hero screen-bar__hero--fail">TEST FAILED</span>
          </header>
          <div class="screen-content fail-layout">
            <p class="result-copy">THE STRUCTURE IS STILL HOLDING. RESET, REAIM, TRY AGAIN.</p>
            <div class="fail-row">
              <span>TARGETS REMAINING</span>
              <span id="failPigsRemaining">1</span>
            </div>
            <div class="fail-row">
              <span>SCORE</span>
              <span id="failScore">1,200</span>
            </div>
            <div class="result-actions result-actions--stacked">
              <button id="failRetryBtn" class="btn-primary" type="button">TRY AGAIN</button>
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

  const resultTimers = [];
  let gameplayCalloutTimer = 0;
  let gameplayCenterOverlayTimer = 0;

  const refs = {
    homeContinueBtn: document.getElementById("homeContinueBtn"),

    calibrationVideo: document.getElementById("calibrationVideo"),
    calibrationOverlay: document.getElementById("calibrationOverlay"),
    calibrationPinchDot: document.getElementById("calibrationPinchDot"),
    calibrationRecDot: document.getElementById("calibrationRecDot"),
    calibrationFeedLabel: document.getElementById("calibrationFeedLabel"),
    calibrationPhysicsCanvas: document.getElementById("calibrationPhysicsCanvas"),
    calibrationVfxCanvas: document.getElementById("calibrationVfxCanvas"),
    calibrationGuideCopy: document.getElementById("calibrationGuideCopy"),
    calibrationGuideProgress: document.getElementById("calibrationGuideProgress"),
    calibrationDemoStatus: document.getElementById("calibrationDemoStatus"),
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
    calibrationTrainingCaption: document.getElementById("calibrationTrainingCaption"),
    calibrationMuteBtn: document.getElementById("calibrationMuteBtn"),
    enterSiteBtn: document.getElementById("enterSiteBtn"),

    levelCardGrid: document.getElementById("levelCardGrid"),

    completeLevelLabel: document.getElementById("completeLevelLabel"),
    completeHeadline: document.getElementById("completeHeadline"),
    completeTagline: document.getElementById("completeTagline"),
    completeStars: document.getElementById("completeStars"),
    completeScore: document.getElementById("completeScore"),
    completePar: document.getElementById("completePar"),
    completeBonus: document.getElementById("completeBonus"),
    completeNextBtn: document.getElementById("completeNextBtn"),
    completeFlash: document.getElementById("completeFlash"),
    completeConfetti: document.getElementById("completeConfetti"),

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
      gameplayCallout: document.getElementById("gameplayCallout"),
      gameplayCenterOverlay: document.getElementById("gameplayCenterOverlay"),
      gameplayPrompt: document.getElementById("gameplayPrompt"),
      levelNumber: document.getElementById("levelNumber"),
      levelName: document.getElementById("levelName"),
      parScore: document.getElementById("parScore"),
      shotState: document.getElementById("shotState"),
      hudScore: document.getElementById("hudScore"),
      birdQueue: document.getElementById("birdQueue"),
      tensionPct: document.getElementById("tensionPct"),
      tensionFill: document.getElementById("tensionFill"),
      gameplayMuteBtn: document.getElementById("gameplayMuteBtn"),
      gameplayHomeBtn: document.getElementById("gameplayHomeBtn"),
      gameplayRestartBtn: document.getElementById("gameplayRestartBtn"),
    },
  };

  document.getElementById("homeStartBtn").addEventListener("click", callbacks.onStart);
  refs.homeContinueBtn.addEventListener("click", callbacks.onContinue);
  document.getElementById("calibrationBackBtn").addEventListener("click", callbacks.onBackHome);
  refs.calibrationMuteBtn.addEventListener("click", callbacks.onToggleMute);
  refs.enterSiteBtn.addEventListener("click", callbacks.onEnterSite);
  document.getElementById("levelSelectBackBtn").addEventListener("click", callbacks.onBackHome);
  document.getElementById("completeRetryBtn").addEventListener("click", callbacks.onRetryCurrent);
  document.getElementById("completeNextBtn").addEventListener("click", callbacks.onNextLevel);
  document.getElementById("failRetryBtn").addEventListener("click", callbacks.onRetryCurrent);
  document.getElementById("failLevelSelectBtn").addEventListener("click", callbacks.onBackToSelect);
  refs.gameplayRefs.gameplayMuteBtn.addEventListener("click", callbacks.onToggleMute);
  refs.gameplayRefs.gameplayHomeBtn.addEventListener("click", callbacks.onGameplayHome);
  refs.gameplayRefs.gameplayRestartBtn.addEventListener("click", callbacks.onGameplayRestart);

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

    updateMuteButtons({ muted }) {
      const label = muted ? "UNMUTE" : "MUTE";
      refs.calibrationMuteBtn.textContent = label;
      refs.gameplayRefs.gameplayMuteBtn.textContent = label;
      refs.calibrationMuteBtn.classList.toggle("nav-link--active", muted);
      refs.gameplayRefs.gameplayMuteBtn.classList.toggle("hud-btn--muted", muted);
    },

    updateCalibration({ trackerStatus, handDetected, pinchActive, tutorial }) {
      refs.calibrationFeedLabel.textContent = handDetected ? "HAND DETECTED" : "WAITING FOR HAND";
      refs.calibrationGuideCopy.textContent = tutorial.guideCopy;
      refs.calibrationGuideProgress.textContent = tutorial.progressLabel;
      refs.calibrationRailFill.style.width = `${tutorial.progressPct}%`;
      refs.calibrationTrackerCopy.textContent = trackerStatus;

      if (refs.calibrationDemoStatus) {
        refs.calibrationDemoStatus.textContent = tutorial.ready
          ? "READY"
          : pinchActive
            ? "PINCHED"
            : handDetected
              ? "LIVE"
              : "WAIT";
      }

      refs.calibrationPinchDot?.classList.toggle("webcam-window__pinch--active", pinchActive);
      refs.calibrationRecDot?.classList.toggle("webcam-window__rec--active", handDetected);

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

      refs.calibrationTrainingCaption.textContent = tutorial.caption;
      refs.enterSiteBtn.disabled = !tutorial.ready;
      refs.enterSiteBtn.classList.toggle("calibration-demo__enter-final--visible", tutorial.ready);
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
      clearTimers(resultTimers);

      refs.completeLevelLabel.textContent = `LEVEL ${String(levelId).padStart(2, "0")}`;

      refs.completeHeadline.textContent =
        stars >= 3 ? "SITE CLEARED" : stars === 2 ? "STRUCTURE DOWN" : "TARGET COMPLETE";

      refs.completeTagline.textContent =
        stars >= 3
          ? "CLEAN RELEASE. CLEAN COLLAPSE. CLEAN FINISH."
          : stars === 2
            ? "THE TARGET FELL. THE TIMING CAN STILL GET SHARPER."
            : "THE OBJECTIVE IS DOWN. EFFICIENCY COMES NEXT.";

      refs.completeStars.innerHTML = renderStarMarkup(stars);
      refs.completeScore.textContent = "0";
      refs.completePar.textContent = par.toLocaleString();
      refs.completeBonus.textContent = `+${birdsRemaining * 400} RESERVE`;
      refs.completeNextBtn.textContent = hasNextLevel ? "NEXT SITE →" : "BACK TO LEVELS";

      refs.completeFlash.classList.remove("is-live");
      void refs.completeFlash.offsetWidth;
      refs.completeFlash.classList.add("is-live");

      refs.completeConfetti.innerHTML = Array.from({ length: 18 }, (_, index) => {
        const left = 8 + (index % 6) * 16 + Math.random() * 8;
        const delay = (index % 3) * 90;
        const drift = (Math.random() * 48 - 24).toFixed(1);

        return `
          <span
            class="confetti-bit"
            style="left:${left}%;animation-delay:${delay}ms;--confetti-drift:${drift}px"
          ></span>
        `;
      }).join("");

      refs.completeStars.querySelectorAll(".result-star").forEach((star, index) => {
        const timer = window.setTimeout(() => {
          star.classList.add("is-visible");
        }, CONSTANTS.STAR_REVEAL_INTERVAL_MS * index);

        resultTimers.push(timer);
      });

      animateCount(refs.completeScore, score, CONSTANTS.SCORE_COUNTUP_MS);
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

    setGameplayCallout({ text = "", tone = "default" }) {
      window.clearTimeout(gameplayCalloutTimer);
      const node = refs.gameplayRefs.gameplayCallout;
      if (!node) return;

      if (!text) {
        node.classList.remove("is-visible", "gameplay-callout--celebration", "gameplay-callout--danger");
        node.textContent = "";
        return;
      }

      node.classList.remove("is-visible", "gameplay-callout--celebration", "gameplay-callout--danger");
      node.textContent = text;

      if (tone === "celebration") {
        node.classList.add("gameplay-callout--celebration");
      } else if (tone === "danger") {
        node.classList.add("gameplay-callout--danger");
      }

      void node.offsetWidth;
      node.classList.add("is-visible");

      gameplayCalloutTimer = window.setTimeout(() => {
        node.classList.remove("is-visible", "gameplay-callout--celebration", "gameplay-callout--danger");
      }, 1800);
    },

    setGameplayCenterOverlay({ text = "", tone = "default", durationMs = 900 }) {
      window.clearTimeout(gameplayCenterOverlayTimer);
      const node = refs.gameplayRefs.gameplayCenterOverlay;
      if (!node) return;

      if (!text) {
        node.classList.remove("is-visible", "gameplay-center-overlay--danger");
        node.textContent = "";
        return;
      }

      node.classList.remove("is-visible", "gameplay-center-overlay--danger");
      node.textContent = text;

      if (tone === "danger") {
        node.classList.add("gameplay-center-overlay--danger");
      }

      void node.offsetWidth;
      node.classList.add("is-visible");

      gameplayCenterOverlayTimer = window.setTimeout(() => {
        node.classList.remove("is-visible", "gameplay-center-overlay--danger");
      }, durationMs);
    },

    updateGameplayPrompt(text) {
      if (refs.gameplayRefs.gameplayPrompt) {
        refs.gameplayRefs.gameplayPrompt.textContent = text;
      }
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