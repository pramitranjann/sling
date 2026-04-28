import { CONSTANTS } from "../constants.js";

export const APP_STATES = {
  HOME: "HOME",
  CALIBRATION: "CALIBRATION",
  LEVEL_SELECT: "LEVEL_SELECT",
  GAMEPLAY: "GAMEPLAY",
  LEVEL_COMPLETE: "LEVEL_COMPLETE",
  LEVEL_FAIL: "LEVEL_FAIL",
};

function createLevelRecord() {
  return { completed: false, stars: 0, highScore: 0 };
}

export function createDefaultSave() {
  return {
    levels: Object.fromEntries(
      Array.from({ length: CONSTANTS.LEVEL_COUNT }, (_, index) => [index + 1, createLevelRecord()]),
    ),
  };
}

export const state = {
  current: APP_STATES.HOME,
  prevState: null,
  levelId: 1,
  save: createDefaultSave(),
  saveExists: false,
  calibration: {
    handFrames: 0,
    handPassed: false,
    pinchPassed: false,
  },
  preview: {
    complete: { levelId: 3, score: 4450, par: 4200, stars: 2, birdsRemaining: 1 },
    fail: { levelId: 3, score: 1200, pigsRemaining: 1 },
  },
};

export function loadSave() {
  const raw = window.localStorage.getItem(CONSTANTS.SAVE_KEY);
  state.saveExists = Boolean(raw);

  if (!raw) {
    state.save = createDefaultSave();
    return state.save;
  }

  try {
    const parsed = JSON.parse(raw);
    state.save = {
      levels: {
        ...createDefaultSave().levels,
        ...(parsed?.levels ?? {}),
      },
    };
  } catch {
    state.save = createDefaultSave();
    state.saveExists = false;
  }

  return state.save;
}

export function persistSave() {
  window.localStorage.setItem(CONSTANTS.SAVE_KEY, JSON.stringify(state.save));
  state.saveExists = true;
}

export function ensureSaveExists() {
  if (!state.saveExists) {
    persistSave();
  }
}

export function resetCalibrationProgress() {
  state.calibration.handFrames = 0;
  state.calibration.handPassed = false;
  state.calibration.pinchPassed = false;
}

export function getLevelRecord(levelId) {
  return state.save.levels[levelId] ?? createLevelRecord();
}

export function isLevelUnlocked(levelId) {
  if (levelId <= 1) return true;
  const prev = getLevelRecord(levelId - 1);
  return prev.completed || prev.stars > 0;
}

export function getCurrentPlayableLevelId() {
  for (let levelId = 1; levelId <= CONSTANTS.LEVEL_COUNT; levelId += 1) {
    if (!isLevelUnlocked(levelId)) {
      return Math.max(1, levelId - 1);
    }

    const record = getLevelRecord(levelId);
    if (!record.completed) {
      return levelId;
    }
  }

  return CONSTANTS.LEVEL_COUNT;
}

export function hasSavedProgress() {
  return state.saveExists;
}

export function setAppState(nextState) {
  state.prevState = state.current;
  state.current = nextState;
}
