import { loadOwnedProject } from "../../projects/context.ts";
import type { BinaryFile } from "../../services/types.ts";
import {
  IMAGE_EXTENSIONS,
  MIME_BY_EXTENSION,
  VARIATIONS_PER_BATCH,
  VISUAL_CONCEPTS,
  VISUAL_FORMATS,
} from "../../visuals/config.ts";
import { conceptTexts, visualPrompt, type VisualTexts } from "../../visuals/prompts.ts";
import { JobError } from "../errors.ts";
import { AdVisualsInput } from "../inputs.ts";
import { type AssetDraft, defineJobKind, type JobContext } from "../types.ts";

/** A worker invocation stops starting new visuals after this, and hands over to the next one. */
export const VISUAL_BUDGET_MS = 60_000;
/** Visuals generated at the same time; the batch finishes sooner without hammering the provider. */
const PARALLEL = 2;

function batchFolder(ctx: JobContext): string {
  return `${ctx.userId}/${ctx.projectId}/visuals/${ctx.jobId}`;
}

/** Variation numbers (1-4) already stored by an earlier invocation or attempt of this batch. */
async function storedVariations(ctx: JobContext): Promise<Map<number, { name: string; sizeBytes: number }>> {
  const stored = new Map<number, { name: string; sizeBytes: number }>();
  for (const file of await ctx.data.files.list(batchFolder(ctx))) {
    const match = file.name.match(/^([1-4])\.([a-z]+)$/);
    if (match && MIME_BY_EXTENSION[match[2]]) stored.set(Number(match[1]), file);
  }
  return stored;
}

/** The reference must sit in this project's reference folder: never trust a path from the request. */
async function loadReference(ctx: JobContext, path: string | undefined): Promise<BinaryFile | null> {
  if (!path) return null;
  if (!path.startsWith(`${ctx.userId}/${ctx.projectId}/visuals/references/`)) {
    throw new JobError("invalid_input", false, "reference outside the project");
  }
  const file = await ctx.data.files.download(path);
  if (!file) throw new JobError("invalid_input", false, "reference not found");
  return file;
}

/**
 * A batch of four ad visuals, one per concept, in one format and one style. Each visual is stored as
 * soon as it exists, so a later invocation (or a retry) only makes the missing ones. The assets are
 * declared together when the batch is complete, with the debit.
 */
export const adVisuals = defineJobKind({
  input: AdVisualsInput,
  async run(input, ctx) {
    const project = await loadOwnedProject(ctx);
    const format = VISUAL_FORMATS[input.format];
    const texts: VisualTexts = {
      headline: input.headline,
      promise: input.promise,
      priceFcfa: input.price_fcfa,
      benefits: input.benefits,
      callToAction: input.call_to_action,
      guarantee: input.guarantee,
    };

    const stored = await storedVariations(ctx);
    const pending = VISUAL_CONCEPTS.map((concept, index) => ({ concept, number: index + 1 }))
      .filter((v) => !stored.has(v.number));

    if (pending.length > 0) {
      await ctx.progress(5 + 90 * stored.size / VARIATIONS_PER_BATCH, "Préparation du lot de visuels");
      const reference = await loadReference(ctx, input.reference_path);
      const productPath = project.product?.coverPath ?? project.coverPath;
      const product = productPath ? await ctx.data.files.download(productPath) : null;

      let madeHere = 0;
      for (let i = 0; i < pending.length; i += PARALLEL) {
        if (madeHere > 0 && ctx.elapsedMs() > VISUAL_BUDGET_MS) return { continueLater: true };
        const chunk = pending.slice(i, i + PARALLEL);
        await ctx.progress(
          5 + 90 * (VARIATIONS_PER_BATCH - pending.length + i) / VARIATIONS_PER_BATCH,
          chunk.length === 1
            ? `Création du visuel ${chunk[0].number} sur ${VARIATIONS_PER_BATCH} : ${chunk[0].concept.label}`
            : `Création des visuels ${chunk.map((v) => v.number).join(" et ")} sur ${VARIATIONS_PER_BATCH}`,
        );
        await Promise.all(chunk.map(async ({ concept, number }) => {
          const items = conceptTexts(concept.id, texts);
          const withProduct = concept.id === "product" && product !== null;
          const { images } = await ctx.services.image.generate({
            prompt: visualPrompt({
              project,
              format: input.format,
              style: input.style,
              concept,
              texts: items,
              hasStyleReference: reference !== null,
              hasProductImage: withProduct,
            }),
            width: format.width,
            height: format.height,
            count: 1,
            textToRender: items,
            referenceImages: [
              ...(reference ? [{ role: "style" as const, ...reference }] : []),
              ...(withProduct ? [{ role: "product" as const, ...product! }] : []),
            ],
          });
          const image = images[0];
          if (!image) throw new JobError("generation_failed", true, "no image returned");
          const extension = IMAGE_EXTENSIONS[image.mimeType];
          if (!extension) {
            throw new JobError("generation_failed", true, `unexpected image type ${image.mimeType}`);
          }
          const name = `${number}.${extension}`;
          const sizeBytes = await ctx.data.files.upload(`${batchFolder(ctx)}/${name}`, image);
          stored.set(number, { name, sizeBytes });
        }));
        madeHere += chunk.length;
      }
    }

    await ctx.progress(97, "Enregistrement des visuels");
    const assets: AssetDraft[] = VISUAL_CONCEPTS.map((concept, index) => {
      const number = index + 1;
      const file = stored.get(number)!;
      const extension = file.name.split(".").pop()!;
      return {
        kind: "image",
        title: `Visuel ${format.label} ${number} · ${concept.label}`,
        storage_path: `${batchFolder(ctx)}/${file.name}`,
        mime_type: MIME_BY_EXTENSION[extension],
        size_bytes: file.sizeBytes,
        content: {
          type: "ad_visual",
          format: input.format,
          style: input.style,
          concept: concept.id,
          variation: number,
          width: format.width,
          height: format.height,
        },
      };
    });
    return { output: { format: input.format, style: input.style, visuals: VARIATIONS_PER_BATCH }, assets };
  },
});
