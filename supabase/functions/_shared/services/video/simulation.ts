import type { VideoAdapter } from "./index.ts";

/** Development adapter: completes on the first poll with an empty file, calls nothing. */
export function createSimulatedVideoAdapter(): VideoAdapter {
  return {
    submit() {
      return Promise.resolve({ taskId: `simulation-${crypto.randomUUID()}` });
    },
    poll() {
      return Promise.resolve({
        state: "done",
        video: { data: new Uint8Array(), mimeType: "video/mp4" },
      });
    },
  };
}
