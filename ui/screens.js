import { buildLevelCards } from "./levelSelect.js";

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
                <div class="calibration-feed__status">
                  <span class="calibration-dot" id="calibrationDot"></span>
                  <span id="calibrationFeedLabel">WAITING FOR HAND</span>
                </div>
              </div>
            </div>
            <div class="calibration-stack">
              <div class="status-card">
                <span class="status-card__label">HAND</span>
                <span class="status-card__value" id="calibrationHandCheck">PENDING</span>
              </div>
              <div class="status-card">
                <span class="status-card__label">PINCH TEST</span>
                <span class="status-card__value" id="calibrationPinchCheck">PENDING</span>
              </div>
              <div class="rail-block">
                <span class="rail-block__label">PINCH TO TEST →</span>
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
    calibrationDot: document.getElementById("calibrationDot"),
    calibrationFeedLabel: document.getElementById("calibrationFeedLabel"),
    calibrationHandCheck: document.getElementById("calibrationHandCheck"),
    calibrationPinchCheck: document.getElementById("calibrationPinchCheck"),
    calibrationRailFill: document.getElementById("calibrationRailFill"),
    calibrationTrackerCopy: document.getElementById("calibrationTrackerCopy"),
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
    updateCalibration({ trackerStatus, handDetected, handPassed, pinchPassed, pinchActive }) {
      refs.calibrationDot.classList.toggle("calibration-dot--active", handDetected);
      refs.calibrationFeedLabel.textContent = handDetected ? "HAND DETECTED" : "WAITING FOR HAND";
      refs.calibrationHandCheck.textContent = handPassed ? "HAND ✓" : "PENDING";
      refs.calibrationPinchCheck.textContent = pinchPassed ? "PINCH ✓" : pinchActive ? "TESTING" : "PENDING";
      refs.calibrationRailFill.style.width = pinchPassed ? "100%" : pinchActive ? "66%" : "0%";
      refs.calibrationTrackerCopy.textContent = trackerStatus;
      refs.enterSiteBtn.disabled = !(handPassed && pinchPassed);
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
