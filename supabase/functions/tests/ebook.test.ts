import { assert, assertEquals, assertMatch, assertStringIncludes } from "@std/assert";
import { chapterPrompt, renderBible } from "../_shared/ebook/prompts.ts";
import { applyEdit, firstParagraph, lastParagraph } from "../_shared/jobs/kinds/ebook/shared.ts";
import { WRITE_BUDGET_MS } from "../_shared/jobs/kinds/ebook/write.ts";
import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import { runJob } from "../_shared/jobs/runner.ts";
import type { ClaimedJob } from "../_shared/jobs/types.ts";
import { createServices } from "../_shared/services/index.ts";
import {
  dataAccess,
  EBOOK,
  fakeJobStore,
  type MemoryEbookStore,
  memoryEbookStore,
  memoryFiles,
  PROJECT,
  sampleChapters,
  sampleEbook,
  USER,
} from "./fakes.ts";

const simulation = createServices({ text: "simulation", image: "simulation" });

function job(kind: string, input: unknown, attempts = 1): ClaimedJob {
  return { id: crypto.randomUUID(), user_id: USER, project_id: PROJECT, kind, input, attempts };
}

/** Runs one worker invocation; `stepMs` is how much time each clock read advances. */
async function invoke(claimed: ClaimedJob, ebooks: MemoryEbookStore, options: { stepMs?: number } = {}) {
  const store = fakeJobStore();
  const files = memoryFiles();
  let clock = 0;
  const outcome = await runJob(claimed, {
    store,
    services: simulation,
    data: dataAccess(ebooks, files),
    kinds: JOB_KINDS,
    sleep: () => Promise.resolve(),
    now: () => (clock += options.stepMs ?? 0),
    log: () => {},
  });
  return { outcome, recorded: store.recorded, files: files.files };
}

Deno.test("titles, summary and outline are generated in the shape each step expects", async () => {
  const ebooks = memoryEbookStore(sampleEbook({ title: null, summary: null }));
  const titles = await invoke(job("ebook_titles", { ebook_id: EBOOK }), ebooks);
  assertEquals(
    titles.recorded.completed?.output.titles && (titles.recorded.completed.output.titles as string[]).length,
    5,
  );

  ebooks.ebook.title = "Cuisiner vite et bien";
  await invoke(job("ebook_summary", { ebook_id: EBOOK }), ebooks);
  assert((ebooks.ebook.summary ?? "").length >= 200);

  await invoke(job("ebook_outline", { ebook_id: EBOOK }), ebooks);
  assert(ebooks.chapters.length >= 6 && ebooks.chapters.length <= 8, "short ebook: 6 to 8 chapters");
  assertEquals(ebooks.log, ["titles:5", "summary", `outline:${ebooks.chapters.length}`]);
});

Deno.test("writing: bible first, chapters in order with previous summaries, then coherence", async () => {
  const ebooks = memoryEbookStore(sampleEbook(), sampleChapters(6));
  const { outcome, recorded } = await invoke(job("ebook_write_short", { ebook_id: EBOOK }), ebooks);

  assertEquals(outcome, "completed");
  assertEquals(ebooks.log.slice(0, 7), [
    "bible",
    "chapter:1",
    "chapter:2",
    "chapter:3",
    "chapter:4",
    "chapter:5",
    "chapter:6",
  ]);
  assertEquals(ebooks.log.at(-1), "finished:true");
  assert(ebooks.chapters.every((c) => c.status === "written" && c.content && c.summary));
  assertEquals(ebooks.ebook.bible?.outline.length, 6);
  assertEquals(
    recorded.progress.map(([, step]) => step).filter((s) => s.startsWith("Chapitre")),
    ebooks.chapters.map((c, i) => `Chapitre ${i + 1} sur 6 : ${c.title}`),
  );
  assertEquals(recorded.progress.at(-1)?.[1], "Passe de cohérence sur l'ensemble du livre");
  assert((recorded.completed?.output.words as number) > 1000);
});

Deno.test("writing hands over before the time limit and resumes at the next unwritten chapter", async () => {
  const ebooks = memoryEbookStore(sampleEbook(), sampleChapters(6));
  // Each clock read advances 20 s: the budget runs out after a few chapters.
  const first = await invoke(job("ebook_write_short", { ebook_id: EBOOK }), ebooks, { stepMs: 20_000 });
  assertEquals(first.outcome, "yielded");
  assertEquals(first.recorded.yielded, 1);
  const writtenFirst = ebooks.chapters.filter((c) => c.status === "written").length;
  assert(writtenFirst > 0 && writtenFirst < 6, `partial progress, got ${writtenFirst}`);
  assert(WRITE_BUDGET_MS / 20_000 >= writtenFirst - 1);

  const second = await invoke(job("ebook_write_short", { ebook_id: EBOOK }), ebooks);
  assertEquals(second.outcome, "completed");
  const chapterWrites = ebooks.log.filter((entry) => entry.startsWith("chapter:")).slice(0, 6);
  assertEquals(chapterWrites, ["chapter:1", "chapter:2", "chapter:3", "chapter:4", "chapter:5", "chapter:6"]);
  assertEquals(ebooks.log.filter((entry) => entry === "bible").length, 1, "bible built once");
});

Deno.test("writing refuses another user's ebook and a price that does not match the length", async () => {
  const foreign = memoryEbookStore(sampleEbook({ user_id: crypto.randomUUID() }), sampleChapters(6));
  const refused = await invoke(job("ebook_write_short", { ebook_id: EBOOK }), foreign);
  assertEquals(refused.recorded.failed?.code, "invalid_input");
  assertEquals(refused.recorded.failed?.retryable, false);

  const cheaper = memoryEbookStore(sampleEbook({ length: "complete" }), sampleChapters(16));
  const mismatch = await invoke(job("ebook_write_short", { ebook_id: EBOOK }), cheaper);
  assertEquals(mismatch.recorded.failed?.code, "invalid_input");
  assertEquals(cheaper.log, [], "nothing written");
});

Deno.test("cover: three artworks stored under the project and declared as assets", async () => {
  const ebooks = memoryEbookStore(sampleEbook(), sampleChapters(6));
  const claimed = job("ebook_cover", { ebook_id: EBOOK });
  const { recorded, files } = await invoke(claimed, ebooks);
  const assets = recorded.completed?.assets ?? [];
  assertEquals(assets.length, 3);
  for (const asset of assets) {
    assertEquals(asset.kind, "image");
    assertMatch(asset.storage_path!, new RegExp(`^${USER}/${PROJECT}/ebook/covers/${claimed.id}-\\d\\.svg$`));
    assert(files.has(asset.storage_path!));
    assertStringIncludes(new TextDecoder().decode(files.get(asset.storage_path!)!.data), "<svg");
  }
});

Deno.test("rewrite: one chapter only, with the bible and the other chapters as context", async () => {
  const ebooks = memoryEbookStore(sampleEbook(), sampleChapters(6));
  await invoke(job("ebook_write_short", { ebook_id: EBOOK }), ebooks);
  const before = ebooks.chapters.map((c) => c.content);
  ebooks.log.length = 0;

  const target = ebooks.chapters[2];
  const { recorded } = await invoke(
    job("ebook_chapter_rewrite", { ebook_id: EBOOK, chapter_id: target.id, instructions: "Plus d'exemples" }),
    ebooks,
  );
  assertEquals(recorded.completed?.output.chapter_id, target.id);
  assertEquals(ebooks.log, ["chapter:3"]);
  assertEquals(ebooks.chapters.filter((c, i) => c.content !== before[i]).length <= 1, true);
});

Deno.test("chapter prompts carry the bible and the summaries of what was already written", () => {
  const ebook = sampleEbook();
  const bible = {
    title: "Cuisiner vite et bien",
    subtitle: null,
    author: "Awa",
    language: "fr" as const,
    template: "method_guide" as const,
    length: "short" as const,
    promise: "Cuisinez sain chaque jour",
    audience: "Étudiants",
    tone: "Chaleureux",
    instructions: "Tutoyer le lecteur",
    summary: ebook.summary!,
    audience_profile: "Étudiants pressés",
    voice_guidelines: "Phrases courtes",
    key_messages: ["La régularité prime"],
    terminology: [{ term: "batch cooking", definition: "Cuisiner à l'avance" }],
    rules: ["Un exemple par section"],
    outline: [{ number: 1, title: "Les bases", brief: "Matériel" }, {
      number: 2,
      title: "Les recettes",
      brief: "Dix recettes",
    }],
  };
  const prompt = chapterPrompt(
    bible,
    [{ number: 1, title: "Les bases", summary: "Matériel et principes vus." }],
    { number: 2, title: "Les recettes", brief: "Dix recettes" },
    2,
    undefined,
  ).prompt;
  for (
    const expected of [
      renderBible(bible),
      "Cuisinez sain chaque jour",
      "Tutoyer le lecteur",
      "batch cooking",
      "Chapitre 1 — Les bases : Matériel et principes vus.",
      "Chapitre 2 sur 2",
      "dernier chapitre",
      ":::encadre",
    ]
  ) {
    assertStringIncludes(prompt, expected);
  }
});

Deno.test("coherence edits replace only the opening and closing paragraphs", () => {
  const content = [
    "Ouverture d'origine.",
    "## Section",
    "Paragraphe du milieu.",
    ":::encadre À retenir\nTexte de l'encadré.\n:::",
    "> Une citation",
    "Clôture d'origine.",
  ].join("\n\n");
  assertEquals(firstParagraph(content), "Ouverture d'origine.");
  assertEquals(lastParagraph(content), "Clôture d'origine.");
  const edited = applyEdit(content, { opening: "Nouvelle ouverture.", closing: "Nouvelle clôture." });
  assertEquals(edited.split("\n\n"), [
    "Nouvelle ouverture.",
    "## Section",
    "Paragraphe du milieu.",
    ":::encadre À retenir\nTexte de l'encadré.\n:::",
    "> Une citation",
    "Nouvelle clôture.",
  ]);
});
