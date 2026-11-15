import { z } from "../../deps.ts";
import { JobError } from "../errors.ts";
import { defineJobKind } from "../types.ts";

const STEPS = [
  "Préparation",
  "Analyse de la demande",
  "Rédaction",
  "Relecture",
  "Mise en forme",
  "Finalisation",
];
const STEP_DURATION_MS = 5_000;
const FAILING_STEP = 2;

/** Waits 30 seconds in six steps and returns a text: exercises the whole job cycle for free. */
export const engineTest = defineJobKind({
  input: z.object({
    topic: z.string().trim().min(1).max(200),
    simulate_failure: z.enum(["none", "first_attempt", "always"]).default("none"),
  }),

  async run(input, ctx) {
    const fails = input.simulate_failure === "always" ||
      (input.simulate_failure === "first_attempt" && ctx.attempt === 1);

    for (const [index, label] of STEPS.entries()) {
      if (fails && index === FAILING_STEP) {
        throw new JobError("simulated_failure", true);
      }
      await ctx.progress(
        Math.round((index / STEPS.length) * 100),
        `Étape ${index + 1} sur ${STEPS.length} : ${label}`,
      );
      await ctx.sleep(STEP_DURATION_MS);
    }

    const text = `Le moteur Monibook fonctionne. Sujet testé : « ${input.topic} ». ` +
      `La génération a duré ${(STEPS.length * STEP_DURATION_MS) / 1000} secondes en ${STEPS.length} étapes ` +
      `(tentative ${ctx.attempt}) et son résultat a été enregistré côté serveur.`;

    return {
      output: { text },
      assets: [{ kind: "text", title: `Test du moteur : ${input.topic}`, content: { text } }],
    };
  },
});
