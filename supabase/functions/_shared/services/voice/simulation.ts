import type { VoiceAdapter } from "./index.ts";

const SAMPLE_RATE = 8_000;

// Half a second of 8-bit mono silence.
function silentWav(seconds: number): Uint8Array {
  const samples = Math.round(SAMPLE_RATE * seconds);
  const buffer = new ArrayBuffer(44 + samples);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  new Uint8Array(buffer, 44).fill(128);
  return new Uint8Array(buffer);
}

/** Development adapter: returns silence, costs nothing, calls nothing. */
export function createSimulatedVoiceAdapter(): VoiceAdapter {
  return {
    synthesize() {
      return Promise.resolve({ audio: { data: silentWav(0.5), mimeType: "audio/wav" } });
    },
  };
}
