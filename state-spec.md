# SLING. — State Machine Spec
*Source of truth for Codex + Claude Code. One document owns all app states.*
**LOAD IF:** working on screen transitions, save data, or app state management
**SKIP IF:** working on physics internals, gesture internals, or audio internals
**DEPENDS ON:** constants.js (SAVE_KEY, LEVEL_COUNT)


---

## States

```
HOME
CALIBRATION
LEVEL_SELECT
GAMEPLAY
LEVEL_COMPLETE
LEVEL_FAIL
```

Only one state is active at a time. State drives which screen is visible and which systems are running.

---

## State Definitions

### HOME

**What's running:** nothing. Audio context not yet created (requires user interaction).

**What's visible:** Home screen.

**Transitions:**
| Trigger | → State | Data passed |
|---|---|---|
| START clicked (no save) | CALIBRATION | — |
| START clicked (save exists) | LEVEL_SELECT | — |
| CONTINUE clicked | LEVEL_SELECT | — |

**On enter:** Stop all audio. Ensure webcam is off.

**On exit:** Initialize AudioContext (first user interaction — required for Web Audio).

---

### CALIBRATION

**What's running:** webcam, MediaPipe hands, pinch detection.

**What's visible:** Calibration screen with large webcam feed.

**Transitions:**
| Trigger | → State | Data passed |
|---|---|---|
| ENTER SITE clicked (both checks passed) | LEVEL_SELECT | — |
| ← BACK (if accessible) | HOME | — |

**Check logic:**
- HAND ✓ — hand detected for ≥ 10 consecutive frames
- PINCH TEST — isPinching() returns true at least once while panel is in focus

Both must pass to enable ENTER SITE button.

**On enter:** Start webcam stream, initialize MediaPipe. Show checks unchecked.

**On exit:** Keep webcam running (reuse stream in gameplay). Do not stop it.

---

### LEVEL_SELECT

**What's running:** webcam idle (not rendered), save data read.

**What's visible:** Level select screen.

**Transitions:**
| Trigger | → State | Data passed |
|---|---|---|
| Level card clicked (unlocked) | GAMEPLAY | `{ levelId: number }` |
| ← BACK | HOME | — |

**On enter:** Load save data from localStorage. Determine which levels are locked/completed/starred.

**Save data shape:**
```js
// Key: 'sling_save'
{
  levels: {
    1: { completed: true,  stars: 3, highScore: 3200 },
    2: { completed: true,  stars: 2, highScore: 3900 },
    3: { completed: false, stars: 0, highScore: 0    },
    4: { completed: false, stars: 0, highScore: 0    },
    5: { completed: false, stars: 0, highScore: 0    },
  }
}
```

Level unlock rule: level N is unlocked if level N-1 is completed (stars ≥ 1). Level 1 is always unlocked.

---

### GAMEPLAY

**What's running:** webcam, MediaPipe, pinch detection, Matter.js physics, render loop, audio.

**What's visible:** Gameplay screen (HUD bars, scene, webcam window, overlays).

**Internal sub-states (not screens — just gameplay phases):**

```
READY       → ball loaded in slingshot, waiting for pinch
DRAGGING    → player is pulling back
FLYING      → ball in flight
SETTLING    → ball has impacted, waiting to settle
BIRD_USED   → ball settled, queue advancing (brief pause)
```

Sub-state is managed inside the gameplay module, not the global state machine.

**Transitions:**
| Trigger | → State | Data passed |
|---|---|---|
| All pigs destroyed | LEVEL_COMPLETE | `{ levelId, score, stars, birdsRemaining }` |
| All birds used + pigs alive | LEVEL_FAIL | `{ levelId, score }` |

**On enter (`levelId`):**
1. Load level JSON for `levelId`
2. Build Matter.js world (blocks + pigs from level data)
3. Initialize bird queue from level data
4. Load current ball into slingshot
5. Start ambient hum
6. Start webcam window rendering
7. Start level timer

**On exit:**
1. Clear Matter.js world
2. Stop render loop
3. Fade out ambient hum over 0.5s

---

### LEVEL_COMPLETE

**What's running:** audio (star reveals, complete stab), score count-up animation.

**What's visible:** Level complete screen.

**Transitions:**
| Trigger | → State | Data passed |
|---|---|---|
| NEXT SITE → clicked | GAMEPLAY | `{ levelId: currentId + 1 }` |
| RETRY clicked | GAMEPLAY | `{ levelId: currentId }` |
| LEVEL SELECT clicked | LEVEL_SELECT | — |

**On enter (`{ levelId, score, stars, birdsRemaining }`):**
1. Write to save data: update stars/highScore if improved
2. Play level-complete sound
3. Begin score count-up (1.2s duration, playScoreTick() at each increment)
4. Reveal stars with 0.4s spacing: playStarReveal(0), playStarReveal(1), playStarReveal(2)
5. Show birds-saved bonus after score settles

**On exit:** nothing special.

---

### LEVEL_FAIL

**What's running:** nothing. Physics has stopped.

**What's visible:** Level fail screen.

**Transitions:**
| Trigger | → State | Data passed |
|---|---|---|
| RETRY clicked | GAMEPLAY | `{ levelId: currentId }` |
| LEVEL SELECT clicked | LEVEL_SELECT | — |

**On enter (`{ levelId, score }`):**
1. Play level-fail sound
2. Show pigs remaining count

**On exit:** nothing special.

---

## Global State Object

```js
// state.js — the single source of truth for runtime state
export const state = {
  // App state
  current: 'HOME',            // current state name
  prevState: null,

  // Level context (set on GAMEPLAY enter)
  levelId: null,
  levelData: null,
  score: 0,
  stars: 0,

  // Bird queue
  birdQueue: [],              // [{ variant, status: 'unused'|'active'|'used' }]
  currentBall: null,          // Matter.js body of active ball

  // Gesture
  tension: 0,                 // 0–1, drives tension bar UI

  // Webcam
  webcamStream: null,         // MediaStream — persists across states
  handsDetector: null,        // MediaPipe Hands instance

  // Save
  save: null,                 // loaded from localStorage
};
```

---

## Transition Function

All state changes go through one function. Never mutate `state.current` directly.

```js
export function transition(newState, data = {}) {
  const prev = state.current;
  console.log(`[state] ${prev} → ${newState}`, data);

  // Run exit hook for current state
  EXIT_HOOKS[prev]?.();

  // Update state
  state.current  = newState;
  state.prevState = prev;

  // Run enter hook for new state
  ENTER_HOOKS[newState]?.(data);

  // Update visible screen
  renderScreen(newState);
}

const ENTER_HOOKS = {
  HOME:            ()          => onEnterHome(),
  CALIBRATION:     ()          => onEnterCalibration(),
  LEVEL_SELECT:    ()          => onEnterLevelSelect(),
  GAMEPLAY:        (data)      => onEnterGameplay(data),
  LEVEL_COMPLETE:  (data)      => onEnterLevelComplete(data),
  LEVEL_FAIL:      (data)      => onEnterLevelFail(data),
};

const EXIT_HOOKS = {
  HOME:            ()          => onExitHome(),
  CALIBRATION:     ()          => onExitCalibration(),
  LEVEL_SELECT:    ()          => onExitLevelSelect(),
  GAMEPLAY:        ()          => onExitGameplay(),
  LEVEL_COMPLETE:  ()          => {},
  LEVEL_FAIL:      ()          => {},
};
```

---

## Screen Visibility

All screens exist in the DOM simultaneously. Transition shows the active one, hides the rest.

```js
const SCREEN_IDS = {
  HOME:           'screen-home',
  CALIBRATION:    'screen-calibration',
  LEVEL_SELECT:   'screen-level-select',
  GAMEPLAY:       'screen-gameplay',
  LEVEL_COMPLETE: 'screen-level-complete',
  LEVEL_FAIL:     'screen-level-fail',
};

function renderScreen(stateName) {
  Object.entries(SCREEN_IDS).forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = name === stateName ? 'flex' : 'none';
  });
}
```

No CSS transitions between screens. Hard cuts only — consistent with zero-radius, no-softness design principle.

---

## Save Data

```js
const SAVE_KEY = 'sling_save';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    state.save = raw ? JSON.parse(raw) : defaultSave();
  } catch {
    state.save = defaultSave();
  }
}

export function writeSave(levelId, stars, score) {
  const existing = state.save.levels[levelId] ?? { completed: false, stars: 0, highScore: 0 };
  state.save.levels[levelId] = {
    completed: true,
    stars:     Math.max(existing.stars, stars),
    highScore: Math.max(existing.highScore, score),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
}

function defaultSave() {
  return {
    levels: {
      1: { completed: false, stars: 0, highScore: 0 },
      2: { completed: false, stars: 0, highScore: 0 },
      3: { completed: false, stars: 0, highScore: 0 },
      4: { completed: false, stars: 0, highScore: 0 },
      5: { completed: false, stars: 0, highScore: 0 },
    }
  };
}
```
