function now(ctx) {
  return ctx.currentTime;
}

function exponentialRamp(param, value, time) {
  param.exponentialRampToValueAtTime(Math.max(value, 0.0001), time);
}

export function createAudioSystem() {
  let ctx = null;
  let master = null;
  let compressor = null;
  let noiseBuffer = null;
  let ambientNodes = null;
  let chargeFuseNodes = null;
  let disabled = false;

  function failSoft(error) {
    disabled = true;
    ambientNodes = null;
    chargeFuseNodes = null;
    console.warn(error);
  }

  function ensureContext() {
    if (ctx) return ctx;

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      throw new Error("Web Audio API is unavailable in this browser.");
    }

    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    return ctx;
  }

  function getNoiseBuffer() {
    const audioCtx = ensureContext();
    if (noiseBuffer) return noiseBuffer;

    const length = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;
    return noiseBuffer;
  }

  async function unlock() {
    if (disabled) return false;

    const audioCtx = ensureContext();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    return true;
  }

  function connectOutput(node, gainValue = 0.1) {
    const audioCtx = ensureContext();
    const gain = audioCtx.createGain();
    gain.gain.value = gainValue;
    node.connect(gain);
    gain.connect(master);
    return gain;
  }

  function oneshotOsc({
    type = "sine",
    startFreq,
    endFreq = startFreq,
    duration = 0.12,
    gain = 0.1,
    attack = 0.005,
    release = duration,
    filterType = null,
    filterFreq = 800,
  }) {
    const audioCtx = ensureContext();
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now(audioCtx));
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), now(audioCtx) + duration);

    let sourceNode = osc;
    if (filterType) {
      const filter = audioCtx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = filterFreq;
      osc.connect(filter);
      sourceNode = filter;
    }

    const amp = connectOutput(sourceNode, 0.0001);
    amp.gain.setValueAtTime(0.0001, now(audioCtx));
    exponentialRamp(amp.gain, gain, now(audioCtx) + attack);
    exponentialRamp(amp.gain, 0.0001, now(audioCtx) + release);

    osc.start();
    osc.stop(now(audioCtx) + duration + 0.05);
  }

  function oneshotNoise({
    duration = 0.12,
    gain = 0.1,
    filterType = "bandpass",
    startFreq = 600,
    endFreq = startFreq,
    q = 1,
    attack = 0.005,
    release = duration,
    playbackRate = 1,
  }) {
    const audioCtx = ensureContext();
    const src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuffer();
    src.loop = true;
    src.playbackRate.value = playbackRate;

    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, now(audioCtx));
    filter.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 40), now(audioCtx) + duration);
    filter.Q.value = q;

    src.connect(filter);
    const amp = connectOutput(filter, 0.0001);
    amp.gain.setValueAtTime(0.0001, now(audioCtx));
    exponentialRamp(amp.gain, gain, now(audioCtx) + attack);
    exponentialRamp(amp.gain, 0.0001, now(audioCtx) + release);

    src.start();
    src.stop(now(audioCtx) + duration + 0.05);
  }

  function startAmbientHum() {
    if (ambientNodes) return;
    const audioCtx = ensureContext();

    const oscA = audioCtx.createOscillator();
    const oscB = audioCtx.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "sawtooth";
    oscA.frequency.value = 42;
    oscB.frequency.value = 47;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;

    const gain = connectOutput(filter, 0.0001);
    gain.gain.setValueAtTime(0.0001, now(audioCtx));
    exponentialRamp(gain.gain, 0.06, now(audioCtx) + 0.3);

    oscA.connect(filter);
    oscB.connect(filter);
    oscA.start();
    oscB.start();

    ambientNodes = { oscA, oscB, gain };
  }

  function stopAmbientHum() {
    if (!ambientNodes || !ctx) return;
    const { oscA, oscB, gain } = ambientNodes;
    exponentialRamp(gain.gain, 0.0001, now(ctx) + 0.5);
    oscA.stop(now(ctx) + 0.55);
    oscB.stop(now(ctx) + 0.55);
    ambientNodes = null;
  }

  function startChargeFuse() {
    if (chargeFuseNodes) return;
    const audioCtx = ensureContext();
    const src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuffer();
    src.loop = true;
    src.playbackRate.value = 0.8;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    filter.Q.value = 3;

    src.connect(filter);
    const gain = connectOutput(filter, 0.0001);
    gain.gain.setValueAtTime(0.0001, now(audioCtx));
    exponentialRamp(gain.gain, 0.08, now(audioCtx) + 0.04);
    src.start();

    chargeFuseNodes = { src, gain };
  }

  function stopChargeFuse() {
    if (!chargeFuseNodes || !ctx) return;
    exponentialRamp(chargeFuseNodes.gain.gain, 0.0001, now(ctx) + 0.08);
    chargeFuseNodes.src.stop(now(ctx) + 0.12);
    chargeFuseNodes = null;
  }

  function playUiConfirm() {
    oneshotOsc({ type: "square", startFreq: 220, endFreq: 280, duration: 0.1, gain: 0.09, release: 0.1 });
  }

  function playUiBack() {
    oneshotOsc({ type: "square", startFreq: 180, endFreq: 140, duration: 0.08, gain: 0.07, release: 0.08 });
  }

  function playSlingCreak() {
    oneshotOsc({ type: "sawtooth", startFreq: 280, endFreq: 180, duration: 0.18, gain: 0.11, release: 0.18, filterType: "lowpass", filterFreq: 1200 });
  }

  function playLaunchWhoosh() {
    oneshotNoise({ duration: 0.15, gain: 0.12, filterType: "bandpass", startFreq: 400, endFreq: 2400, q: 2.8, release: 0.15 });
  }

  function playBallImpactHeavy() {
    oneshotOsc({ type: "sine", startFreq: 95, endFreq: 38, duration: 0.14, gain: 0.24, release: 0.14 });
    oneshotNoise({ duration: 0.08, gain: 0.06, filterType: "lowpass", startFreq: 240, endFreq: 140, q: 0.8, release: 0.08, playbackRate: 0.7 });
  }

  function playBallImpactLight() {
    oneshotOsc({ type: "sine", startFreq: 90, endFreq: 40, duration: 0.08, gain: 0.12, release: 0.08 });
  }

  function playBlockCrack() {
    oneshotNoise({
      duration: 0.04,
      gain: 0.18,
      filterType: "highpass",
      startFreq: 1600,
      endFreq: 2600,
      q: 0.7,
      release: 0.04,
      playbackRate: 0.8 + Math.random() * 0.4,
    });
  }

  function playBlockCollapse() {
    oneshotNoise({ duration: 0.55, gain: 0.2, filterType: "lowpass", startFreq: 900, endFreq: 420, q: 0.6, release: 0.55, playbackRate: 0.65 });
    oneshotOsc({ type: "sine", startFreq: 72, endFreq: 30, duration: 0.22, gain: 0.12, release: 0.22 });
  }

  function playPigHit() {
    oneshotOsc({ type: "square", startFreq: 60, endFreq: 60, duration: 0.18, gain: 0.11, release: 0.18 });
    oneshotOsc({ type: "square", startFreq: 142, endFreq: 118, duration: 0.12, gain: 0.07, release: 0.12 });
  }

  function playPigDeath() {
    oneshotOsc({ type: "sine", startFreq: 55, endFreq: 28, duration: 0.24, gain: 0.2, release: 0.24 });
    oneshotNoise({ duration: 0.18, gain: 0.08, filterType: "lowpass", startFreq: 480, endFreq: 200, q: 0.6, release: 0.18, playbackRate: 0.8 });
  }

  function playDustSettle() {
    oneshotNoise({ duration: 1.2, gain: 0.08, filterType: "lowpass", startFreq: 600, endFreq: 240, q: 0.3, release: 1.2, playbackRate: 0.75 });
  }

  function playChargeBlast() {
    oneshotNoise({ duration: 0.4, gain: 0.22, filterType: "lowpass", startFreq: 160, endFreq: 70, q: 0.5, release: 0.4, playbackRate: 0.55 });
    oneshotOsc({ type: "sawtooth", startFreq: 62, endFreq: 24, duration: 0.38, gain: 0.26, release: 0.38 });
  }

  function playStar(index) {
    const freqs = [180, 260, 360];
    oneshotOsc({ type: "triangle", startFreq: freqs[index] ?? 180, endFreq: (freqs[index] ?? 180) * 1.05, duration: 0.5, gain: 0.14, release: 0.5 });
  }

  function playLevelComplete() {
    oneshotOsc({ type: "sawtooth", startFreq: 130, endFreq: 130, duration: 0.5, gain: 0.16, release: 0.5 });
    oneshotOsc({ type: "sawtooth", startFreq: 196, endFreq: 196, duration: 0.5, gain: 0.12, release: 0.5 });
  }

  function playLevelFail() {
    oneshotOsc({ type: "sawtooth", startFreq: 140, endFreq: 55, duration: 0.8, gain: 0.18, release: 0.8 });
  }

  function playScoreTick() {
    oneshotOsc({ type: "square", startFreq: 320, endFreq: 320, duration: 0.04, gain: 0.04, release: 0.04 });
  }

  function playLevelCompleteSequence(stars = 3) {
    playLevelComplete();
    for (let index = 0; index < stars; index += 1) {
      window.setTimeout(() => {
        playStar(index);
      }, 400 * (index + 1));
    }
  }

  function handleSceneEvent(type, detail = {}) {
    switch (type) {
      case "PINCH_START":
        playSlingCreak();
        break;
      case "LAUNCH":
        playLaunchWhoosh();
        break;
      case "BALL_IMPACT_HEAVY":
        playBallImpactHeavy();
        break;
      case "BALL_IMPACT_LIGHT":
        playBallImpactLight();
        break;
      case "BLOCK_DAMAGED":
        playBlockCrack();
        break;
      case "BLOCK_DESTROYED":
        playBlockCollapse();
        window.setTimeout(() => playDustSettle(), 1500);
        break;
      case "PIG_DAMAGED":
        playPigHit();
        break;
      case "PIG_DESTROYED":
        playPigDeath();
        break;
      case "CHARGE_FUSE_START":
        startChargeFuse();
        break;
      case "CHARGE_FUSE_STOP":
        stopChargeFuse();
        break;
      case "CHARGE_DETONATE":
        stopChargeFuse();
        playChargeBlast();
        break;
      case "LEVEL_COMPLETE":
        stopChargeFuse();
        playLevelCompleteSequence(detail.stars ?? 3);
        break;
      case "LEVEL_FAIL":
        stopChargeFuse();
        playLevelFail();
        break;
      case "SCORE_TICK":
        playScoreTick();
        break;
      default:
        break;
    }
  }

  return {
    async unlock() {
      try {
        return await unlock();
      } catch (error) {
        failSoft(error);
        return false;
      }
    },
    startAmbientHum() {
      if (disabled) return;
      try {
        startAmbientHum();
      } catch (error) {
        failSoft(error);
      }
    },
    stopAmbientHum() {
      if (disabled) return;
      try {
        stopAmbientHum();
      } catch (error) {
        failSoft(error);
      }
    },
    playUiConfirm() {
      if (disabled) return;
      try {
        playUiConfirm();
      } catch (error) {
        failSoft(error);
      }
    },
    playUiBack() {
      if (disabled) return;
      try {
        playUiBack();
      } catch (error) {
        failSoft(error);
      }
    },
    handleSceneEvent(type, detail) {
      if (disabled) return;
      try {
        handleSceneEvent(type, detail);
      } catch (error) {
        failSoft(error);
      }
    },
  };
}
