import { CONFIG } from "../config.js";

let webcamStream = null;

function waitForVideoReady(videoEl) {
  if (videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onReady = () => {
      videoEl.removeEventListener("loadeddata", onReady);
      resolve();
    };
    videoEl.addEventListener("loadeddata", onReady, { once: true });
  });
}

export async function initWebcam(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("getUserMedia is not available in this browser context.");
  }

  if (!webcamStream) {
    webcamStream = await navigator.mediaDevices.getUserMedia(
      CONFIG.webcamConstraints,
    );
  }

  if (videoEl.srcObject !== webcamStream) {
    videoEl.srcObject = webcamStream;
  }

  await waitForVideoReady(videoEl);

  try {
    await videoEl.play();
  } catch (error) {
    if (error.name !== "AbortError") {
      throw error;
    }
  }

  return webcamStream;
}

export function getWebcamStream() {
  return webcamStream;
}

export function stopWebcam() {
  if (!webcamStream) return;
  webcamStream.getTracks().forEach((track) => track.stop());
  webcamStream = null;
}
