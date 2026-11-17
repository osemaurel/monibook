import type { TextAdapter } from "./index.ts";

/**
 * Development adapter: costs nothing, calls nothing. Structured requests get a placeholder document
 * that follows the requested JSON Schema, so every flow can run end to end.
 */
export function createSimulatedTextAdapter(): TextAdapter {
  // Chapter-sized answers take a moment, as with a real provider, so progress can be watched.
  const latencyMs = Number(Deno.env.get("SIMULATION_LATENCY_MS") ?? 1200);
  return {
    async generate(request) {
      const schema = request.jsonSchema as { properties?: Record<string, unknown> } | undefined;
      if (schema?.properties?.content && latencyMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, latencyMs));
      }
      const text = request.format === "json" && request.jsonSchema
        ? JSON.stringify(fakeFromSchema(request.jsonSchema, "", { counters: new Map() }))
        : `Texte simulé à partir d'une consigne de ${request.prompt.length} caractères.`;
      return { text, usage: { inputTokens: 0, outputTokens: 0 } };
    },
  };
}

type Schema = Record<string, unknown>;
interface FakeState {
  counters: Map<string, number>;
}

const SENTENCES = [
  "Chaque étape s'appuie sur la précédente pour construire une progression solide.",
  "L'objectif est d'obtenir un résultat concret, mesurable et durable.",
  "Commencez petit, observez ce qui fonctionne, puis augmentez progressivement l'effort.",
  "Les erreurs les plus fréquentes viennent d'un manque de méthode plutôt que d'un manque de talent.",
  "Un exemple simple vaut mieux qu'une longue théorie : appliquez immédiatement ce que vous lisez.",
  "Notez vos résultats chaque semaine pour mesurer vos progrès et ajuster votre approche.",
  "La régularité compte davantage que l'intensité : quinze minutes par jour suffisent pour avancer.",
  "Gardez en tête la promesse de départ : chaque action doit vous en rapprocher.",
];

function next(state: FakeState, key: string): number {
  const value = (state.counters.get(key) ?? 0) + 1;
  state.counters.set(key, value);
  return value;
}

function sentences(state: FakeState, count: number): string {
  return Array.from({ length: count }, () => SENTENCES[(next(state, "sentence") - 1) % SENTENCES.length])
    .join(" ");
}

function chapterContent(state: FakeState): string {
  return [
    sentences(state, 4),
    "## Comprendre l'essentiel",
    sentences(state, 5),
    sentences(state, 4),
    "- Définir un objectif précis\n- Préparer le matériel nécessaire\n- Bloquer un créneau régulier",
    "> La méthode compte plus que la motivation. — Proverbe d'atelier",
    "## Passer à la pratique",
    sentences(state, 5),
    "### Les trois réflexes à adopter",
    "1. Commencer par l'étape la plus simple\n2. Vérifier le résultat avant de continuer\n3. Noter ce qui doit être amélioré",
    ":::encadre À retenir\n" + sentences(state, 2) + "\n:::",
    sentences(state, 4),
  ].join("\n\n");
}

function fakeString(key: string, schema: Schema, state: FakeState): string {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return String(schema.enum[0]);
  const name = key.toLowerCase();
  let value: string;
  if (name === "content") value = chapterContent(state);
  else if (name.includes("title")) value = `Titre simulé ${next(state, "title")}`;
  else if (name.includes("hashtag")) value = `#astuce${next(state, "hashtag")}`;
  else if (name.includes("term")) value = `Notion ${next(state, "term")}`;
  else if (name.includes("summary") || name.includes("brief") || name.includes("profile")) {
    value = sentences(state, 4);
  } else value = sentences(state, 2);
  const min = typeof schema.minLength === "number" ? schema.minLength : 0;
  while (value.length < min) value += " " + sentences(state, 2);
  const max = typeof schema.maxLength === "number" ? schema.maxLength : undefined;
  return max ? value.slice(0, max) : value;
}

function fakeFromSchema(schema: Schema, key: string, state: FakeState): unknown {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case "object": {
      const properties = (schema.properties ?? {}) as Record<string, Schema>;
      return Object.fromEntries(
        Object.entries(properties).map(([name, property]) => [name, fakeFromSchema(property, name, state)]),
      );
    }
    case "array": {
      const min = typeof schema.minItems === "number" ? schema.minItems : 3;
      const max = typeof schema.maxItems === "number" ? schema.maxItems : Math.max(min, 3);
      const count = Math.min(Math.max(min, 3), max);
      return Array.from({ length: count }, () => fakeFromSchema((schema.items ?? {}) as Schema, key, state));
    }
    case "integer":
    case "number":
      return typeof schema.minimum === "number" ? schema.minimum : next(state, `n:${key}`);
    case "boolean":
      return true;
    default:
      return fakeString(key, schema, state);
  }
}
