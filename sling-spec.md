# SLING. — Design & Implementation Spec
*A webcam-controlled brutalist demolition game. Working title: SLING.*
**LOAD IF:** starting the project, designing in Figma, or orienting a new AI session
**SKIP IF:** already oriented — load task-specific spec instead
**DEPENDS ON:** tokens.css, constants.js


> **Note to Claude Code / Codex:** Read this entire document before writing a single line. Part 0 is the world. Part A is the UI system. Part B is the gesture system (reuse from bowl). Part C is game mechanics. Part D is screen specs. Part E is the asset list. Part F is the build sequence.

---

## Part 0 — World & Concept Brief

### The reframe

This is not a casual clone. It is a **demolition ritual** — the satisfaction of watching something heavy fly, something solid collapse, something fortified break. The player's motivation: *"I want to destroy something, and I want it to feel earned."*

Genre: physics-based destruction game. References: Angry Birds (mechanism), Monument Valley (art restraint), Factorio (UI language), construction site blueprint aesthetic.

### The sensory world

**Raw concrete. Brutalist architecture. Construction site.**

Eastern European bloc housing. Exposed aggregate. Rebar. Stencil typography. Hazard tape. Blueprint grid. The silence before a demolition charge goes off. The dust cloud after.

This is not warm. This is **material**. Weight, friction, impact — everything communicates mass. Sounds are heavy. Motion is ballistic. The UI looks like it was printed on a site drawing and laminated.

### Design principles

**Mass is everything.** Every element communicates weight. Blocks don't disappear — they crack, splinter, fall. Pigs don't pop like bubbles — they get crushed.

**The UI is site signage.** Hazard tape borders, hard hat sticker type, safety warning panels. Think: job site perimeter fence, not game HUD. Not blueprint, not terminal — *warning board*.

**Yellow is the signal color.** One accent: #FFD100. It means active, live, selected, complete, danger. Black is structure. Yellow is signal. Nothing else.

**Light mode.** This is daylight. Draft paper ground, white card panels, maximum contrast. The only dark surfaces are the black HUD bars — and even those use yellow type. This makes SLING. immediately distinct from both bowl and ALBERS at a portfolio glance.

**Zero radius.** No rounded corners anywhere. Hard cuts only. This is a construction site, not a consumer app.

---

## Part A — UI System

### Aesthetic direction

**Site safety / high-vis.** The UI is built from the visual language of construction site signage — hazard tape, warning boards, safety data sheets, site perimeter fencing. Everything is bold, high-contrast, and immediately readable. This is a **light mode** game. The ground is draft paper, not void.

This is deliberately unlike ALBERS (dark terminal, amber on black) and unlike bowl (dark tropical, warm soft). SLING. is the loudest, most graphic project in the set.

### Color tokens

```css
/* Surfaces */
--color-bg:             #EDE8DC   /* draft paper — the world ground */
--color-bg-grid:        #D8D0C0   /* grid lines on draft paper */
--color-surface-white:  #FFFFFF   /* card/panel fill */
--color-surface-dim:    #C8C0A8   /* ground plane, inactive fills */

/* The two primaries — nothing else */
--color-black:          #111111   /* headers, borders, type, buttons */
--color-yellow:         #FFD100   /* THE signal — active, live, selected, complete */

/* Concrete (scene only — not UI) */
--color-concrete:       #9A9488   /* block fill */
--color-concrete-dark:  #7A7468   /* block shadow/edge */
--color-concrete-dust:  #C8C0A8   /* post-destruction debris */

/* Pig / bunker */
--color-pig:            #5C8C68   /* military green */
--color-pig-hit:        #4A7455   /* darker on damage */

/* Sky (scene only) */
--color-sky:            #EDE8DC   /* same as bg — daylight, no horizon drama */

/* State colors */
--color-fail:           #CC2200   /* level failed — only use of red */
--color-star-full:      #FFD100   /* filled star */
--color-star-empty:     #CCCCCC   /* empty star */

/* Text */
--color-text-primary:   #111111
--color-text-secondary: #888078
--color-text-dim:       #B0A890
--color-text-on-yellow: #111111   /* type sitting on --color-yellow */
--color-text-on-black:  #FFD100   /* primary text on dark bars */
--color-text-on-black-2:#FFFFFF   /* secondary text on dark bars */
```

### Hazard stripe

The signature visual element. Used as a top and bottom border on every screen frame, as a divider between major sections, and as an accent on active/danger states.

```css
/* CSS — use as background on a div with height: 10px */
background: repeating-linear-gradient(
  -45deg,
  #FFD100,
  #FFD100 10px,
  #111111 10px,
  #111111 20px
);
```

In Figma: create as a component with a Frame fill using an angle gradient with color stops at exactly 0%, 50%, 50%, 100% repeating. Every instance links to this component — never draw a new stripe.

### Typography

One font family. No mixing.

```css
--font-primary: Impact, 'Arial Narrow', Arial, sans-serif;
```

Why Impact: it IS construction site signage. It is the font on a hard hat sticker, a site warning board, a road closure sign. It requires zero styling to communicate the world — the typeface is the world.

Scale:
```css
--text-xs:    8px  / letter-spacing: 0.2em   /* metadata, coordinates */
--text-sm:    9px  / letter-spacing: 0.15em  /* secondary labels */
--text-md:    11px / letter-spacing: 0.12em  /* primary HUD labels */
--text-lg:    14px / letter-spacing: 0.08em  /* button text, nav */
--text-xl:    22px / letter-spacing: 0.04em  /* score values, level numbers */
--text-2xl:   48px / letter-spacing: 0.04em  /* screen heroes */
--text-3xl:   72px / letter-spacing: 0.06em  /* level complete / fail */
```

All type is uppercase. No exceptions in UI — the world of SLING. has no lowercase.

### Spacing (8pt base)

```css
--space-1: 4px    --space-2: 8px    --space-3: 12px   --space-4: 16px
--space-5: 24px   --space-6: 32px   --space-7: 48px   --space-8: 64px
```

### Border rules

All borders are `2px solid #111111` (or `2.5px` on hero/primary containers). No border-radius anywhere — SLING. has zero rounded corners. Hard cuts only.

### Components

**Screen Frame** — every screen is bordered top and bottom by a hazard stripe (10px). Between the stripes: content on --color-bg. The frame itself communicates "this is a live site."

**HUD Bar (top)** — full-width, `background: #111111`, height 44px. Left: yellow level badge (yellow bg, black text). Center: par info. Right: score in white. No border-radius.

**HUD Bar (bottom)** — full-width, `background: #FFD100`, height 44px with 3px top border in black. Left: bird queue. Right: tension indicator. All type in black.

**Level Badge** — a yellow rectangle inset in the black HUD bar. Contains the stencil label "LEVEL" (8px, dim) and the number below it (22px, black). Tight padding: 4px vertical, 12px horizontal.

**Tension Indicator** — label "TENSION" + a 130px rail. Rail background: black. Fill: hazard stripe pattern at the filled portion (not solid yellow — *striped* — so it reads as an active warning). Empty portion: --color-bg.

**Bird Queue** — 3 circles in a row. Active: solid black fill, 18px diameter. Remaining: black outline, 16px, transparent fill. Used: hidden/removed.

**Primary Button** — full black fill, no radius, height 48px. Type in yellow, letter-spacing 0.4em. Hover: yellow fill, black type.

**Secondary Button** — --color-bg fill, 2.5px black border, black type. Hover: white fill.

**Level Card** — white fill, 2.5px black border, no radius, fixed 112×170px. Header strip (40px, black fill, yellow number). Stars below. Score metadata at bottom. Active/current card: yellow fill, black border 3px. Locked card: all fills and type in --color-text-dim, dashed border.

**Star Rating** — three stars at 20px. Full: #FFD100. Empty: #CCCCCC. No animation size change — reveal in sequence, 0.4s apart, each fading in from opacity 0.

**Trajectory Arc** — dashed black line (`stroke-dasharray: 6,4`), 2px stroke, with a filled arrowhead at the projected landing. Not yellow — black on the light bg for clarity. Arrow snaps direction to pull vector.

**Wrecking Ball** — matte dark sphere with a cast-iron texture (dark concentric rings). At rest in slingshot: 28px diameter. In flight: same, with a short motion blur trail in --color-black at 30% opacity.

**Concrete Block** — flat --color-concrete fill, 1.5px --color-concrete-dark border. Crack overlay: 2–3 SVG fracture-line variants, randomized on damage, in --color-concrete-dark. At 0 health: explode into 4–6 fragments + dust cloud.

**Pig / Bunker** — squat rectangle with a semicircular top. --color-pig fill, 2px black border. Indicator light: 6px circle on top center, yellow fill. On hit: --color-pig-hit, light flickers. On death: collapse + light off.

**Grid Paper Background** — `background: --color-bg` with a CSS repeating grid (40px intervals, 0.5px lines in --color-bg-grid). Applied to all scene areas and screen backgrounds outside of HUD bars. Not decorative — it IS the world surface.

---

## Part B — Gesture System (Reuse from bowl)

### Files to copy from bowl project

| bowl file | Action |
|---|---|
| `handTracker.js` | Copy as-is. Same MediaPipe Hands setup, same landmarks. |
| `gestureUtils.js` | Copy, then add pinch logic below. Keep swipe logic but dormant. |
| `webcamManager.js` | Copy as-is. Same webcam init and segmentation. |
| `handRenderer.js` | Copy, change trail/slice color to amber (#F5A623), remove slice trail. |

### New function to add to gestureUtils.js

```js
// Pinch detection — landmark 4 (thumb tip) to landmark 8 (index tip)
const PINCH_THRESHOLD = 24; // px, calibrate in testing

export function isPinching(hand) {
  const thumbTip  = hand.keypoints[4];
  const indexTip  = hand.keypoints[8];
  const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  return dist < PINCH_THRESHOLD;
}

// Pinch state machine — call once per frame
export function updatePinchState(hand, prevState) {
  const pinching = isPinching(hand);
  if (!prevState.active && pinching)  return { active: true,  event: 'PINCH_START'   };
  if ( prevState.active && pinching)  return { active: true,  event: 'PINCH_HOLD'    };
  if ( prevState.active && !pinching) return { active: false, event: 'PINCH_RELEASE' };
  return { active: false, event: 'IDLE' };
}
```

### Either-hand logic (copy from bowl's handTracker.js)

```js
const activeHand = hands.length === 1
  ? hands[0]
  : hands.find(h => h.score > 0.85) ?? hands[0];
```

### Slingshot binding logic (new, add to gameLoop.js)

```js
// Called each frame in the game loop
function handleGesture(hand, pinchState, slingshotOrigin, maxPullDist) {
  const handPos = getHandCenter(hand); // midpoint of palm landmarks

  if (pinchState.event === 'PINCH_START') {
    if (isNearSlingshot(handPos, slingshotOrigin, 120)) {
      state.dragging = true;
    }
  }

  if (pinchState.event === 'PINCH_HOLD' && state.dragging) {
    const pullVec = {
      x: slingshotOrigin.x - handPos.x,
      y: slingshotOrigin.y - handPos.y
    };
    const pullDist = Math.min(Math.hypot(pullVec.x, pullVec.y), maxPullDist);
    const pullNorm = normalize(pullVec);
    state.currentPull = { vec: pullNorm, dist: pullDist };
    state.tension = pullDist / maxPullDist; // 0–1, drives tension bar
  }

  if (pinchState.event === 'PINCH_RELEASE' && state.dragging) {
    launchBird(state.currentPull);
    state.dragging = false;
    state.currentPull = null;
    state.tension = 0;
  }
}
```

### Pinch zone ring

When hand center is within 120px of the slingshot origin, render a pulsing amber ring (canvas, 2px stroke, #F5A623 at 40% opacity, radius 60px, pulse period 1.2s). On PINCH_START, ring collapses (scale to 0 over 0.15s) and bird locks to hand.

---

## Part C — Game Mechanics

### Physics library

Use **Matter.js**. It is lightweight and sufficient. If already in bowl's package.json, carry it over.

### Block properties

```js
{ label: 'block', restitution: 0.2, friction: 0.6, frictionAir: 0.01 }
```

Block health: 1 (thin/small), 2 (standard), 3 (reinforced). On collision above force threshold: decrement health, update visual. At 0: fragment into 4–6 smaller bodies with scatter velocity, emit dust burst, remove after 3s.

### Pig properties

```js
{ label: 'pig', restitution: 0.3, friction: 0.5, health: 1 or 2 }
```

Standard pig: health 1. Fortified pig: health 2. On death: amber light off, collapse animation, removed after 2s. Score popup: +200 (standard), +350 (fortified).

### Wrecking ball properties

```js
{ label: 'ball', mass: 8, restitution: 0.35, frictionAir: 0.005 }
```

Launch velocity derived from pull vector and tension: `velocity = pullNorm * (tension * MAX_LAUNCH_SPEED)`. Suggested MAX_LAUNCH_SPEED: 28.

### Star scoring

| Result | Stars |
|---|---|
| All pigs + ≥1 bird remaining | ★★★ |
| All pigs, no birds remaining | ★★ |
| All pigs (any method) | ★ |
| Pigs survive | 0 (fail) |

### Bird queue

3 birds per level, types defined in level JSON. Displayed bottom-left: amber icon = current, outlined = remaining, dim = used. Automatically advances on ball settle or after 5s.

### Level fail

All birds used, ≥1 pig alive → LEVEL FAILED state.

---

## Part D — Screen Specs

All screens are framed top and bottom by a hazard stripe (10px). All backgrounds are --color-bg (draft paper) except HUD bars. Zero border-radius throughout.

### 1. Home Screen

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← hazard stripe (10px)
┌─────────────────────────────────┐
│  SLING.          [ SET ]        │  black bar, yellow wordmark, yellow button
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │      SLING.             │    │  yellow panel, black Impact 72px
│  │  DEMOLITION TRAINING    │    │  black 10px, letter-spacing 6
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │        START            │    │  black fill, yellow type
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │        CONTINUE         │    │  white fill, black border, dim type
│  └─────────────────────────┘    │  (disabled if no save)
│                                 │
│  WEBCAM REQUIRED                │  text-xs, --color-text-dim
└─────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← hazard stripe (10px)
```

No music on home screen. Low industrial hum, distant machinery.

### 2. Webcam Calibration Screen

(Reskin of bowl's calibration — same logic, new visual tokens.)

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
┌─────────────────────────────────┐
│  CALIBRATION                    │  black bar
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │   [webcam feed, 16:9]      │  │  3px black border, yellow on hand detect
│  │   ◉  HAND DETECTED         │  │  yellow dot + label overlay
│  └───────────────────────────┘  │
│                                 │
│  ┌──────────┐ ┌──────────────┐  │
│  │ HAND  ✓  │ │ PINCH TEST   │  │  white cards, black border 2px
│  └──────────┘ └──────────────┘  │
│                                 │
│  PINCH TO TEST →                │
│  [hazard-stripe fill░░░░░░░░░]  │  tension rail, stripe fill = active
│                                 │
│  [        ENTER SITE        ]   │  black fill, yellow type — enabled on pass
└─────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

### 3. Level Select

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
┌─────────────────────────────────────────────────────────────┐
│  ← BACK                       LEVEL SELECT                  │  black bar
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────┐  │
│  │ ██ 01  │  │ ██ 02  │  │ ██ 03  │  │ ▒▒ 04  │  │░░ 05 │  │
│  │  ★★★   │  │  ★★☆   │  │  ★☆☆   │  │   —    │  │  🔒  │  │
│  │ 3,200  │  │ 3,900  │  │ACTIVE  │  │UNLOCK  │  │LOCKD │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  └──────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

Card states: completed → white fill, black border, black header strip. Active/current → yellow fill, black border 3px, yellow header. Unplayed → white fill, black dashed border, grey header. Locked → dim fill, dim dashed border, all text in --color-text-dim.

### 4. Gameplay Screen

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
┌──────────────────────────────────────────────────────┐
│ [LEVEL 03]   [★★★  PAR 4,200]   [SCORE 3,180]       │  black bar, 44px
├──────────────────────────────────────────────────────┤
│                                                       │
│   [grid paper bg — --color-bg + --color-bg-grid]     │
│   [webcam window — 240×180px, top-left, below HUD,  │
│    see webcam-spec.md]                               │
│   [black dashed trajectory arc]                      │
│   [concrete structure — blocks + pigs]               │
│   [slingshot — left quarter of screen]               │
│   [ground plane — bottom 15%, --color-surface-dim]   │
│                                                       │
├──────────────────────────────────────────────────────┤
│ [● ○ ○]  WRECKING BALLS      TENSION [▓▓▓▓░░░░░░]   │  yellow bar, 44px
└──────────────────────────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

Top HUD (black): left = yellow level badge. Center = par score (white). Right = live score (white, counts up).
Bottom HUD (yellow): left = bird queue (black circles). Right = tension rail with hazard-stripe fill.

Gameplay overlays:
- Yellow dashed circle ring pulsing near slingshot (pinch zone indicator)
- Black dashed trajectory arc with arrowhead at landing point
- Shockwave ring (black, expands + fades) on impact
- Score popup (+200, +350) in Impact black, fades upward over 0.8s
- Dust cloud (--color-concrete-dust particles) on block destruction

### 5. Level Complete

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
┌─────────────────────────────────┐
│  LEVEL 03                       │  black bar, dim label
│  COMPLETE                       │  yellow, Impact 48px
├─────────────────────────────────┤
│                                 │
│      ★   ★   ☆                  │  yellow/grey, reveal 0.4s each
│                                 │
│  ┌──────────┐ ┌───────┐ ┌────┐  │
│  │  SCORE   │ │  PAR  │ │+400│  │  three white cards, black border
│  │  4,450   │ │ 4,200 │ │BRD │  │  third card: yellow fill, black type
│  └──────────┘ └───────┘ └────┘  │
│                                 │
│  ┌──────────┐  ┌──────────────┐ │
│  │  RETRY   │  │  NEXT SITE → │ │  secondary / primary
│  └──────────┘  └──────────────┘ │
│                                 │
└─────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

Score counts up from 0 over 1.2s. Collapse rumble fades over 3s.

### 6. Level Failed

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
┌─────────────────────────────────┐
│  LEVEL 03                       │  black bar
│  FAILED                         │  --color-fail (#CC2200), Impact 48px
├─────────────────────────────────┤
│                                 │
│  PIGS REMAINING    1            │
│  SCORE         1,200            │
│                                 │
│  ┌─────────────────────────┐    │
│  │          RETRY          │    │  black fill, yellow type
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │       LEVEL SELECT      │    │  white fill, black border
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

Red is used only here. --color-fail is not used anywhere else in the game.

---

## Part E — Asset List

### Sprites (build via canvas or SVG)

| Asset | Notes |
|---|---|
| Wrecking ball — standard | Dark metal sphere, concentric ring texture, 28px |
| Wrecking ball — heavy | Wider (36px), heavier appearance, rebar band |
| Wrecking ball — charge | Same as standard + yellow stripe band + fuse nub |
| Block 1×1, 1×2, 2×2 | --color-concrete fill, 1.5px --color-concrete-dark border |
| Block crack overlays (3 variants) | Fracture lines in --color-concrete-dark, randomize on damage |
| Pig — healthy | Squat military-green turret, yellow indicator light on |
| Pig — hit | Cracked, yellow light dim |
| Pig — dead | Collapsed fragments (handled by physics) |
| Slingshot | Two tapered concrete pillars (--color-concrete), band in black |
| Dust cloud | --color-concrete-dust particles, 8–24px, varied opacity |
| Shockwave ring | Black, 2px stroke, expands from impact point + fades |
| Stars (filled/empty) | --color-yellow / --color-star-empty |
| Pinch zone ring | Yellow dashed circle, pulsing opacity animation |
| Score popup | Impact typeface, --color-black, floats up 40px over 0.8s |

### Level data (JSON per level)

```json
{
  "id": 1,
  "par": 3000,
  "birds": ["standard", "standard", "heavy"],
  "structures": [
    {
      "blocks": [
        { "type": "1x2", "x": 680, "y": 380 },
        { "type": "1x1", "x": 680, "y": 330 }
      ],
      "pigs": [
        { "type": "standard", "x": 700, "y": 300 }
      ]
    }
  ]
}
```

### Sounds

| Sound | Method |
|---|---|
| Ambient industrial hum | Web Audio — low drone 40–60Hz |
| Slingshot creak | Web Audio — short elastic transient |
| Launch whoosh | Web Audio — short rising burst |
| Ball impact (heavy) | Freesound — concrete thud |
| Block crack | Web Audio — short crack transient |
| Block collapse | Freesound — debris/rubble |
| Pig death | Web Audio — low metallic clunk |
| Dust settle | Web Audio — fading white noise |
| Star reveal (×3) | Web Audio — brief rising tone, 0.4s spacing |
| Level complete | Web Audio — short low brass stab |
| Level fail | Web Audio — descending low tone |

---

## Part F — Build Sequence

1. **Codex reads Part 0 + Part B.** Copies bowl's four hand tracking files. Adds `isPinching()` and `updatePinchState()` to `gestureUtils.js`. Delivers a test page: webcam + hand overlay + pinch state logged to console. No game yet.

2. **Codex builds the physics scene.** Matter.js setup, block/pig rigid bodies, collision handling, health system. Delivers a click-to-launch test scene. No gestures yet.

3. **Codex wires gesture → physics.** Pinch lock → pull vector → release → launch. Tension bar value updates. Trajectory arc draws. Delivers fully playable gesture loop with placeholder visuals.

4. **Claude Code reads Part A + Part D.** Builds all UI screens using Part A tokens loaded from `tokens.css`. No game logic — just screens, components, and state rendering. Screenshot input from Figma frames where available.

5. **Codex + Claude Code integrate.** Game state drives UI state. Score propagates to HUD. Level complete/fail triggers screen transitions. Bird queue updates.

6. **Claude Code does the visual pass.** Sprites, particles, shockwave, dust, slingshot band rendering, all animations. Part A color tokens throughout. Zero hardcoded colors — everything references `tokens.css`.

7. **Level JSON authored.** 5 level files built on Part E schema, tuned for difficulty progression.

8. **Sound pass.** Web Audio synthesis for all synthesized sounds. Freesound assets integrated.

---

## What SLING. is not

- Not a cartoon. No googly eyes, no red birds, no green pigs with mustaches.
- Not mobile. Fullscreen webcam, desktop only.
- Not dark. SLING. is the only light mode project in the set. That IS the portfolio move.
- Not bowl. bowl is warm, dark, and soft. SLING. is bright, loud, and hard.
- Not ALBERS. ALBERS is amber terminal on black. SLING. is yellow hazard on draft paper.
- Not rounded. Zero border-radius. Anywhere. If you find yourself adding border-radius, stop.
- Not multi-color. Black and yellow in the UI. Concrete grey and military green in the scene. Red only on fail. That is the complete palette.

---

*End of spec. Build in the order listed in Part F.*
