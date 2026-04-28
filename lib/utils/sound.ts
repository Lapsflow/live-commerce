/**
 * BARCODE-02: 바코드 스캔 사운드 피드백 (Web Audio API)
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playBeep(type: "success" | "error"): void {
  if (typeof window === "undefined") return;

  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // 높은 톤 짧게 (삐!)
      osc.frequency.value = 1200;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      // 낮은 톤 길게 (삐잇-)
      osc.frequency.value = 400;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext not available (SSR, test, etc.)
  }
}
