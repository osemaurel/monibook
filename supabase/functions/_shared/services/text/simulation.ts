import type { TextAdapter } from "./index.ts";

/** Development adapter: answers instantly, costs nothing, calls nothing. */
export function createSimulatedTextAdapter(): TextAdapter {
  return {
    generate(request) {
      const text = request.format === "json"
        ? JSON.stringify({ simulated: true, promptLength: request.prompt.length })
        : `Texte simulé à partir d'une consigne de ${request.prompt.length} caractères.`;
      return Promise.resolve({ text, usage: { inputTokens: 0, outputTokens: 0 } });
    },
  };
}
