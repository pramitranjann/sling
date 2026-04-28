# SLING. — Audio Spec
**LOAD IF:** working on audio pass
**SKIP IF:** working on physics, gestures, UI, or renderer
**DEPENDS ON:** constants.js (for event names only)

---

## Philosophy

Every sound communicates mass and material. Concrete is heavy. Metal impacts hard. Nothing pings, chimes, or sparkles. Three layers: ambient bed (always on), game events (during play), UI punctuation (state transitions).

All synthesis via Web Audio API. Three sounds sourced from Freesound (marked below). Everything else synthesized.

---

## Sound Map

| ID | Trigger | Type | Character |
|---|---|---|---|
| `amb-hum` | Gameplay start → stop | Synth loop | Low industrial drone, two detuned oscillators, 40–50Hz, sawtooth, low-pass filtered at 200Hz |
| `sling-creak` | PINCH_HOLD frame 1 | Synth oneshot | Sawtooth sweep 280→180Hz over 0.12s, 0.18s total |
| `launch-whoosh` | PINCH_RELEASE | Synth oneshot | Bandpass noise, center freq sweeps 400→2400Hz, 0.15s |
| `ball-impact-heavy` | Ball hits body, velocity > threshold | **Freesound** | Deep concrete thud, no metallic ring, no reverb tail |
| `ball-impact-light` | Ball hits body, velocity < threshold | Synth oneshot | Sine 90→40Hz over 0.08s, short |
| `block-crack` | Block health decremented | Synth oneshot | Highpass filtered noise burst, 0.04s, randomize playback rate 0.8–1.2× |
| `block-collapse` | Block health = 0 | **Freesound** | Multiple pieces falling, rubble/debris, 0.5–1s |
| `pig-hit` | Pig health decremented | Synth oneshot | Two square oscillators 60Hz + 142Hz, metallic clunk, 0.18s |
| `pig-death` | Pig health = 0 | Synth oneshot | Low sine thud 55→28Hz + short noise crumble tail |
| `dust-settle` | 1.5s after block-collapse | Synth oneshot | Lowpass filtered noise, 600Hz ceiling, fades over 1.2s |
| `charge-fuse` | After charge ball impact, loops for blastDelay | Synth loop | Crackling noise chunks, looped, 0.08 gain |
| `charge-blast` | Charge detonation | **Freesound** | Heavy bass explosion, no reverb, sub-bass emphasis |
| `star-1/2/3` | Each star reveals, 400ms apart | Synth oneshot | Triangle osc: 180Hz / 260Hz / 360Hz, 0.5s fade |
| `level-complete` | LEVEL_COMPLETE state | Synth oneshot | Two stacked sawtooth oscs 130Hz + 196Hz, 0.5s |
| `level-fail` | LEVEL_FAIL state | Synth oneshot | Sawtooth 140→55Hz sweep over 0.8s |
| `score-tick` | Score count-up each increment | Synth oneshot | Square osc 320Hz, 0.04s, gain 0.04 (quiet) |
| `ui-confirm` | Primary button click | Synth oneshot | Square osc 220→280Hz, 0.1s |
| `ui-back` | Secondary button click | Synth oneshot | Square osc 180→140Hz, 0.08s, softer |

---

## Freesound Sourcing

Search freesound.org. Filter: **Creative Commons 0 only**. Download WAV, convert to MP3 128kbps.

| ID | Search terms | What to reject |
|---|---|---|
| `ball-impact-heavy` | "concrete thud" / "heavy impact cement" | Anything with metallic ring or reverb tail |
| `block-collapse` | "concrete rubble" / "masonry collapse" / "debris fall" | Single thud — needs multiple pieces |
| `charge-blast` | "explosion low no reverb" / "demolition blast bass" | Anything bright or sharp — must be sub-bass heavy |

---

## Volume Mixing

| Layer | Gain |
|---|---|
| Ambient hum | 0.06 |
| Ball impacts | 0.25–0.40 |
| Block crack / collapse | 0.20–0.30 |
| Pig events | 0.20–0.25 |
| Charge fuse / blast | 0.08 / 0.40 |
| Star / complete / fail | 0.14–0.25 |
| Score tick | 0.04 |
| UI | 0.07–0.10 |

---

## Event Hookup

Wire in `gameLoop.js` after collision handlers are working:

```js
on('BLOCK_DAMAGED',     () => play('block-crack'));
on('BLOCK_DESTROYED',   () => { play('block-collapse'); setTimeout(() => play('dust-settle'), 1500); });
on('PIG_DAMAGED',       () => play('pig-hit'));
on('PIG_DESTROYED',     () => play('pig-death'));
on('BALL_IMPACT_HEAVY', () => play('ball-impact-heavy'));
on('BALL_IMPACT_LIGHT', () => play('ball-impact-light'));
on('PINCH_START',       () => play('sling-creak'));
on('PINCH_RELEASE',     () => play('launch-whoosh'));
on('CHARGE_FUSE_START', () => startLoop('charge-fuse'));
on('CHARGE_DETONATE',   () => { stopLoop('charge-fuse'); play('charge-blast'); });
on('LEVEL_COMPLETE',    () => play('level-complete'));
on('LEVEL_FAIL',        () => play('level-fail'));
on('STAR_REVEAL',       (i) => play(`star-${i+1}`));
```

UI buttons: attach `play('ui-confirm')` to all `.btn-primary` clicks, `play('ui-back')` to all `.btn-secondary` clicks.

---

## Implementation Notes

- Create a single shared `AudioContext` on first user interaction. Never create multiple contexts.
- Load Freesound assets as `AudioBuffer` via `fetch` + `decodeAudioData`. Store in a map keyed by ID.
- All synth sounds create oscillators/buffers fresh per call — do not reuse nodes.
- `charge-fuse` is the only looping synth. Store a ref to stop it on detonation.
- Do not play `ball-impact-heavy` and `ball-impact-light` simultaneously — gate on velocity threshold from `constants.js` (`BALL_DAMAGE_THRESHOLD`).
