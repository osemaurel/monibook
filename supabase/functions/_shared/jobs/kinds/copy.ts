import type { z } from "../../deps.ts";
import {
  COPY_ANGLE_IDS,
  COPY_ANGLES,
  COPY_TYPES,
  type CopyAngle,
  type CopyType,
  FREE_APPROACHES,
} from "../../copy/config.ts";
import { copyPrompt } from "../../copy/prompts.ts";
import { loadOwnedProject } from "../../projects/context.ts";
import { CopyFreeInput, CopyInput } from "../inputs.ts";
import { defineJobKind, type JobContext, type JobDefinitionAny } from "../types.ts";

export interface CopyVariation {
  angle: CopyAngle | null;
  title: string;
  content: string;
}

/**
 * Writes the variations of one type of copy in parallel: one per marketing angle (or per approach in
 * free mode), each with the whole project as context. They are kept in the job's output until the
 * user picks one and saves it.
 */
async function writeVariations(
  type: CopyType,
  ctx: JobContext,
  instructions: string | undefined,
): Promise<CopyVariation[]> {
  const project = await loadOwnedProject(ctx);
  const definition = COPY_TYPES[type];
  const schema = definition.schema as z.ZodType<unknown>;
  const render = definition.render as (data: unknown, language: "fr" | "en") => string;
  const plans = type === "free"
    ? FREE_APPROACHES.map((approach) => ({ angle: null, approach }))
    : COPY_ANGLE_IDS.map((angle) => ({ angle, approach: undefined }));

  await ctx.progress(5, "Lecture du contexte du projet");
  let written = 0;
  // Progress updates are chained so they reach the database in order.
  let reported = Promise.resolve();
  const variations = await Promise.all(plans.map(async ({ angle, approach }) => {
    const data = await ctx.services.text.generateJson(
      copyPrompt({ project, type, angle, approach, instructions }),
      schema,
    );
    written++;
    const done = written;
    reported = reported.then(() =>
      ctx.progress(5 + 90 * done / plans.length, `Variation ${done} sur ${plans.length} rédigée`)
    );
    const title = type === "free"
      ? (data as { title: string }).title
      : `${definition.label} · ${COPY_ANGLES[angle!].label}`;
    return { angle, title, content: render(data, project.language).trim() };
  }));
  await reported;
  return variations;
}

function copyKind(type: Exclude<CopyType, "free">): JobDefinitionAny {
  return defineJobKind({
    input: CopyInput,
    async run(input, ctx) {
      return { output: { type, variations: await writeVariations(type, ctx, input.instructions) } };
    },
  });
}

export const COPY_JOB_KINDS: Record<string, JobDefinitionAny> = {
  copy_hooks: copyKind("hooks"),
  copy_facebook_short: copyKind("facebook_short"),
  copy_facebook_long: copyKind("facebook_long"),
  copy_sales_page: copyKind("sales_page"),
  copy_email_sequence: copyKind("email_sequence"),
  copy_product_description: copyKind("product_description"),
  copy_social_captions: copyKind("social_captions"),
  copy_free: defineJobKind({
    input: CopyFreeInput,
    async run(input, ctx) {
      return {
        output: {
          type: "free",
          request: input.request,
          variations: await writeVariations("free", ctx, input.request),
        },
      };
    },
  }),
};
