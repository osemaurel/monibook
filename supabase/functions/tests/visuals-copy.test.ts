import { assert, assertEquals, assertFalse, assertMatch, assertStringIncludes } from "@std/assert";
import { COPY_ANGLE_IDS } from "../_shared/copy/config.ts";
import { copyPrompt } from "../_shared/copy/prompts.ts";
import { AdVisualsInput, CopyFreeInput } from "../_shared/jobs/inputs.ts";
import { VISUAL_BUDGET_MS } from "../_shared/jobs/kinds/visuals.ts";
import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import { runJob } from "../_shared/jobs/runner.ts";
import type { ClaimedJob } from "../_shared/jobs/types.ts";
import { renderProjectBrief } from "../_shared/projects/context.ts";
import type { ProjectContext } from "../_shared/projects/types.ts";
import { createServices } from "../_shared/services/index.ts";
import type { ImageRequest } from "../_shared/services/image/index.ts";
import { conceptTexts } from "../_shared/visuals/prompts.ts";
import {
  dataAccess,
  fakeJobStore,
  memoryEbookStore,
  memoryFiles,
  memoryProjects,
  PROJECT,
  sampleEbook,
  sampleProject,
  USER,
} from "./fakes.ts";

const simulation = createServices({ text: "simulation", image: "simulation" });
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

function job(kind: string, input: unknown, id = crypto.randomUUID()): ClaimedJob {
  return { id, user_id: USER, project_id: PROJECT, kind, input, attempts: 1 };
}

const VISUAL_INPUT = {
  format: "square",
  style: "bold",
  headline: "Cuisiner sain en 15 minutes",
  promise: "Cuisinez sain en 15 minutes par jour",
  price_fcfa: 1500,
  benefits: ["Des repas prêts en 15 minutes", "Moins de 2 000 FCFA par jour"],
  call_to_action: "Je commande",
  guarantee: "Satisfait ou remboursé pendant 7 jours",
};

async function invoke(
  claimed: ClaimedJob,
  options: {
    files?: ReturnType<typeof memoryFiles>;
    project?: ProjectContext;
    stepMs?: number;
    services?: typeof simulation;
  } = {},
) {
  const store = fakeJobStore();
  const files = options.files ?? memoryFiles();
  let clock = 0;
  const outcome = await runJob(claimed, {
    store,
    services: options.services ?? simulation,
    data: dataAccess(
      memoryEbookStore(sampleEbook()),
      files,
      memoryProjects(options.project ?? sampleProject()),
    ),
    kinds: JOB_KINDS,
    sleep: () => Promise.resolve(),
    now: () => (clock += options.stepMs ?? 0),
    log: () => {},
  });
  return { outcome, recorded: store.recorded, files };
}

Deno.test("visuals: one batch makes four concepts, stored under the project and declared as assets", async () => {
  const files = memoryFiles();
  const cover = `${USER}/${PROJECT}/ebook/covers/cover-1.svg`;
  files.files.set(cover, { data: new TextEncoder().encode("<svg/>"), mimeType: "image/svg+xml" });
  const claimed = job("ad_visuals", VISUAL_INPUT);
  const { outcome, recorded } = await invoke(claimed, { files });

  assertEquals(outcome, "completed");
  const assets = recorded.completed!.assets;
  assertEquals(assets.length, 4);
  assertEquals(assets.map((a) => (a.content as { concept: string }).concept), [
    "product",
    "benefits",
    "promise",
    "offer",
  ]);
  for (const [i, asset] of assets.entries()) {
    assertEquals(asset.kind, "image");
    assertEquals(asset.storage_path, `${USER}/${PROJECT}/visuals/${claimed.id}/${i + 1}.svg`);
    assertEquals((asset.content as { type: string; format: string }).type, "ad_visual");
    assertEquals((asset.content as { width: number; height: number }).height, 1080);
    assert(asset.size_bytes! > 0);
  }
  const product = decode(files.files.get(assets[0].storage_path!)!.data);
  assertStringIncludes(product, "1 500 FCFA");
  assertStringIncludes(product, "Je commande");
  assertStringIncludes(product, "data:image/svg+xml;base64,", "the ebook cover is used as the product");
  const offer = decode(files.files.get(assets[3].storage_path!)!.data);
  assertStringIncludes(offer, "Satisfait ou remboursé");
});

Deno.test("visuals: the vertical format is 1080 × 1920", async () => {
  const { recorded, files } = await invoke(job("ad_visuals", { ...VISUAL_INPUT, format: "vertical" }));
  const asset = recorded.completed!.assets[1];
  assertEquals((asset.content as { height: number }).height, 1920);
  assertStringIncludes(decode(files.files.get(asset.storage_path!)!.data), 'height="1920"');
});

Deno.test("visuals: hands over after the time budget and only makes the missing ones on resume", async () => {
  const files = memoryFiles();
  const id = crypto.randomUUID();
  const first = await invoke(job("ad_visuals", VISUAL_INPUT, id), { files, stepMs: VISUAL_BUDGET_MS + 1 });
  assertEquals(first.outcome, "yielded");
  assertEquals(files.uploads.length, 2);

  const second = await invoke(job("ad_visuals", VISUAL_INPUT, id), { files });
  assertEquals(second.outcome, "completed");
  assertEquals(files.uploads.length, 4, "the two stored visuals are not made again");
  assertEquals(second.recorded.completed!.assets.length, 4);
});

Deno.test("visuals: the reference must be in this project; it is passed as a style reference", async () => {
  const outside = await invoke(job("ad_visuals", {
    ...VISUAL_INPUT,
    reference_path: `${crypto.randomUUID()}/${PROJECT}/visuals/references/r.jpg`,
  }));
  assertEquals(outside.recorded.failed?.code, "invalid_input");
  assertFalse(outside.recorded.failed!.retryable);

  const files = memoryFiles();
  const path = `${USER}/${PROJECT}/visuals/references/r.jpg`;
  files.files.set(path, { data: new Uint8Array([255, 216, 255]), mimeType: "image/jpeg" });
  const seen: ImageRequest[] = [];
  const spy = {
    ...simulation,
    image: { generate: (r: ImageRequest) => (seen.push(r), simulation.image.generate(r)) },
  };
  const { outcome } = await invoke(job("ad_visuals", { ...VISUAL_INPUT, reference_path: path }), {
    files,
    services: spy,
  });
  assertEquals(outcome, "completed");
  assert(seen.every((r) => r.referenceImages?.some((i) => i.role === "style")));
  assertStringIncludes(seen[0].prompt, "image de référence");
});

Deno.test("visuals: another user's project is refused without retry", async () => {
  const { recorded } = await invoke(job("ad_visuals", VISUAL_INPUT), {
    project: sampleProject({ userId: crypto.randomUUID() }),
  });
  assertEquals(recorded.failed?.code, "invalid_input");
});

Deno.test("visuals: each concept shows its own texts, prices in FCFA", () => {
  const texts = {
    headline: "Titre",
    promise: "Promesse",
    priceFcfa: 12500,
    benefits: ["A", "B", "C", "D"],
    callToAction: "Je commande",
    guarantee: "Garantie 7 jours",
  };
  assertEquals(conceptTexts("benefits", texts).filter((t) => t.role === "bullet").length, 3);
  assertEquals(conceptTexts("offer", texts).find((t) => t.role === "price")?.text, "12 500 FCFA");
  assertEquals(conceptTexts("promise", texts)[0], { role: "headline", text: "Promesse" });
  assertEquals(
    conceptTexts("product", { ...texts, priceFcfa: undefined }).some((t) => t.role === "price"),
    false,
  );
});

Deno.test("visuals input: refuses a reference outside the reference folder and unknown styles", () => {
  assertFalse(AdVisualsInput.safeParse({ ...VISUAL_INPUT, reference_path: "../../etc/passwd" }).success);
  assertFalse(AdVisualsInput.safeParse({ ...VISUAL_INPUT, style: "neon" }).success);
  assertFalse(AdVisualsInput.safeParse({ ...VISUAL_INPUT, call_to_action: " " }).success);
  assert(AdVisualsInput.safeParse(VISUAL_INPUT).success);
});

Deno.test("copy: each type writes four variations, one per angle, ready to paste", async () => {
  for (
    const kind of [
      "copy_hooks",
      "copy_facebook_short",
      "copy_sales_page",
      "copy_email_sequence",
      "copy_social_captions",
    ]
  ) {
    const { outcome, recorded } = await invoke(job(kind, {}));
    assertEquals(outcome, "completed", kind);
    const output = recorded.completed!.output as {
      variations: { angle: string; title: string; content: string }[];
    };
    assertEquals(output.variations.map((v) => v.angle), COPY_ANGLE_IDS, kind);
    for (const v of output.variations) {
      assert(v.content.length > 20, kind);
      assertFalse(v.content.includes('{"'), `${kind} is rendered as text, not JSON`);
    }
  }
  const emails = await invoke(job("copy_email_sequence", {}));
  const first =
    (emails.recorded.completed!.output as { variations: { content: string }[] }).variations[0].content;
  assertMatch(first, /^E-MAIL 1 · Jour 0\nObjet : .+\nAperçu : .+/);
  const captions = await invoke(job("copy_social_captions", {}));
  assertMatch(
    (captions.recorded.completed!.output as { variations: { content: string }[] }).variations[0].content,
    /#astuce\d/,
  );
});

Deno.test("copy: free mode writes three approaches from the author's request", async () => {
  const { recorded } = await invoke(
    job("copy_free", { request: "Un message WhatsApp pour relancer mes clients" }),
  );
  const output = recorded.completed!.output as { variations: { angle: null; title: string }[] };
  assertEquals(output.variations.length, 3);
  assert(output.variations.every((v) => v.angle === null && v.title.length > 0));
  assertFalse(CopyFreeInput.safeParse({ request: "court" }).success);
});

Deno.test("copy prompts carry the whole project and forbid invented proof", () => {
  const project = sampleProject();
  const brief = renderProjectBrief(project);
  assertStringIncludes(brief, "Prix : 1 500 FCFA");
  assertStringIncludes(brief, "- Moins de 2 000 FCFA par jour");
  assertStringIncludes(brief, "Sommaire :\n1. Les bases");

  const request = copyPrompt({
    project,
    type: "facebook_short",
    angle: "testimonial",
    instructions: "Ton direct",
  });
  assertStringIncludes(request.prompt, brief);
  assertStringIncludes(request.prompt, "[Prénom du client]");
  assertStringIncludes(request.prompt, "Précision de l'auteur : Ton direct");
  assertStringIncludes(request.instructions!, "n'inventez ni chiffres");
  const english = copyPrompt({ project: { ...project, language: "en" }, type: "hooks", angle: "numbers" });
  assertStringIncludes(english.prompt, "Langue du texte : anglais");
});
