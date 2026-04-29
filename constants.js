// SLING. — Constants
// Single source of truth for all magic numbers.
// Import this file first. Never hardcode these values anywhere else.
// If a value needs to change, change it here only.

export const CONSTANTS = {

  // ── Canvas ──────────────────────────────────────────────
  CANVAS_W:               1280,
  CANVAS_H:               720,

  // ── HUD ─────────────────────────────────────────────────
  HUD_TOP_H:              44,     // px — black top bar
  HUD_BOT_H:              44,     // px — yellow bottom bar
  STRIPE_H:               10,     // px — hazard stripe height

  // ── Webcam window ────────────────────────────────────────
  CAM_W:                  240,
  CAM_H:                  180,
  CAM_LEFT:               24,     // px from canvas left
  CAM_TOP:                52,     // px from canvas top = HUD_TOP_H + 8

  // ── Slingshot ────────────────────────────────────────────
  SLINGSHOT_ORIGIN:       { x: 160, y: 580 },
  BAND_LEFT:              { x: 148, y: 572 },
  BAND_RIGHT:             { x: 172, y: 572 },
  MAX_PULL_DIST:          120,    // px — max stretch from origin
  MAX_LAUNCH_SPEED:       28,     // px/frame at 60fps
  SLINGSHOT_ZONE_RADIUS:  120,    // px — interaction zone around origin

  // ── Physics world ────────────────────────────────────────
  GRAVITY_Y:              1.8,
  GROUND_Y:               740,    // y of ground body center
  GROUND_VISIBLE_Y:       720,    // y where ground becomes visible

  // ── Ball ─────────────────────────────────────────────────
  BALL: {
    standard: { radius: 14, mass: 8,  restitution: 0.35, frictionAir: 0.005, piercing: false, blastRadius: 0,   blastDelay: 0   },
    heavy:    { radius: 18, mass: 18, restitution: 0.15, frictionAir: 0.003, piercing: true,  blastRadius: 0,   blastDelay: 0   },
    charge:   { radius: 14, mass: 7,  restitution: 0.30, frictionAir: 0.006, piercing: false, blastRadius: 120, blastDelay: 0.6 },
  },

  // ── Block ────────────────────────────────────────────────
  BLOCK_SIZES: {
    '1x1': { w: 40,  h: 40  },
    '1x2': { w: 80,  h: 40  },
    '2x1': { w: 40,  h: 80  },
    '2x2': { w: 80,  h: 80  },
    '3x1': { w: 120, h: 40  },
  },
  BLOCK_HEALTH: {
    '1x1': 1, '1x2': 2, '2x1': 2, '2x2': 3, '3x1': 2,
  },
  BLOCK_SCORE: {
    '1x1': 50, '1x2': 80, '2x1': 80, '2x2': 120, '3x1': 100,
  },
  BLOCK_PHYSICS: {
    restitution: 0.15, friction: 0.70, frictionAir: 0.008, density: 0.003,
  },

  // ── Pig ──────────────────────────────────────────────────
  PIG_SIZES: {
    standard:  { w: 44, h: 38 },
    fortified: { w: 60, h: 50 },
  },
  PIG_HEALTH: {
    standard: 1, fortified: 2,
  },
  PIG_SCORE: {
    standard: 200, fortified: 350,
  },
  PIG_PHYSICS: {
    restitution: 0.20, friction: 0.60, frictionAir: 0.012, density: 0.004,
  },

  // ── Collision damage thresholds ──────────────────────────
  BALL_DAMAGE_THRESHOLD:      4,    // min rel velocity to deal damage
  BLOCK_COLLAPSE_THRESHOLD:   6,    // min rel velocity for block-on-block damage
  BLOCK_DAMAGE_FROM_BALL:     1,
  BLOCK_DAMAGE_FROM_COLLAPSE: 1,
  PIG_DAMAGE_FROM_BALL:       1,

  // ── Ball settle detection ────────────────────────────────
  SETTLE_SPEED_THRESHOLD:     0.5,  // px/frame — below this = settled
  SETTLE_FRAMES_REQUIRED:     30,   // consecutive frames below threshold
  BALL_TIMEOUT_MS:            6000, // hard timeout if ball gets stuck
  BIRD_ADVANCE_DELAY_MS:      5000, // auto-advance if settle not detected

  // ── Scoring ──────────────────────────────────────────────
  BIRDS_REMAINING_BONUS:      400,  // pts per unused bird on level complete

  // ── Gesture ──────────────────────────────────────────────
  PINCH_THRESHOLD:            24,   // px — thumb-to-index distance
  PINCH_HYSTERESIS:           6,    // px — extra gap needed to release
  PINCH_THRESHOLD_RATIO:      0.34,
  PINCH_RATIO_HYSTERESIS:     0.08,
  MEDIAPIPE_MAX_HANDS:        2,
  MEDIAPIPE_DETECTION_CONF:   0.55,
  MEDIAPIPE_TRACKING_CONF:    0.50,

  // ── VFX ──────────────────────────────────────────────────
  SHOCKWAVE_DURATION_MS:      400,
  DUST_DURATION_MS:           1200,
  SCORE_POPUP_DURATION_MS:    800,
  SCORE_POPUP_RISE_PX:        40,
  FRAGMENT_REMOVE_MS:         3000,
  PIG_DEATH_REMOVE_MS:        600,

  // ── UI timing ────────────────────────────────────────────
  STAR_REVEAL_INTERVAL_MS:    400,
  SCORE_COUNTUP_MS:           1200,
  LEVEL_COMPLETE_DELAY_MS:    800,  // pause after last pig dies

  // ── Save ─────────────────────────────────────────────────
  SAVE_KEY:                   'sling_save',
  LEVEL_COUNT:                5,

};
