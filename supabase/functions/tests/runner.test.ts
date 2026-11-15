import { assert, assertEquals } from "jsr:@std/assert@1";
import { z } from "../_shared/deps.ts";
import { JOB_ERROR_MESSAGES, type JobError, JobFencedError } from "../_shared/jobs/errors.ts";
import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import { type JobStore, runJob } from "../_shared/jobs/runner.ts";
import { type ClaimedJob, defineJobKind } from "../_shared/jobs/types.ts";
import { createServices, ServiceError } from "../_shared/services/index.ts";

interface Recorded {
  progress: Array<[number, string]>;
  completed?: { output: Record<string, unknown>; assets: unknown[] };
  failed?: { code: string; retryable: boolean; message: string };
}

function fakeStore(options: { fenceProgressAt?: number } = {}): JobStore & { recorded: Recorded } {
  const recorded: Recorded = { progress: [] };
  return {
    recorded,
    setProgress(_id, _attempt, percent, step) {
      if (options.fenceProgressAt !== undefined && recorded.progress.length === options.fenceProgressAt) {
        return Promise.reject(new JobFencedError());
      }
      recorded.progress.push([percent, step]);
      return Promise.resolve();
    },
    complete(_id, _attempt, output, assets) {
      recorded.completed = { output, assets };
      return Promise.resolve();
    },
    fail(_id, _attempt, error: JobError, message) {
      recorded.failed = { code: error.code, retryable: error.retryable, message };
      return Promise.resolve();
    },
  };
}

function job(input: unknown, attempts = 1, kind = "engine_test"): ClaimedJob {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    project_id: crypto.randomUUID(),
    kind,
    input,
    attempts,
  };
}

async function run(claimed: ClaimedJob, store: JobStore, kinds = JOB_KINDS) {
  const slept: number[] = [];
  await runJob(claimed, {
    store,
    services: createServices({ text: "simulation" }),
    kinds,
    sleep: (ms) => {
      slept.push(ms);
      return Promise.resolve();
    },
    log: () => {},
  });
  return slept;
}

Deno.test("engine_test: 6 steps over 30 s, then a text result and a text asset", async () => {
  const store = fakeStore();
  const slept = await run(job({ topic: "Cuisine" }), store);

  assertEquals(slept.reduce((a, b) => a + b, 0), 30_000);
  assertEquals(store.recorded.progress.map(([p]) => p), [0, 17, 33, 50, 67, 83]);
  assertEquals(store.recorded.progress[0][1], "Étape 1 sur 6 : Préparation");
  assert(String(store.recorded.completed?.output.text).includes("« Cuisine »"));
  assertEquals((store.recorded.completed?.assets[0] as { kind: string }).kind, "text");
  assertEquals(store.recorded.failed, undefined);
});

Deno.test("engine_test: simulated failure is retryable and carries a French message", async () => {
  const store = fakeStore();
  await run(job({ topic: "Cuisine", simulate_failure: "always" }, 3), store);
  assertEquals(store.recorded.completed, undefined);
  assertEquals(store.recorded.failed, {
    code: "simulated_failure",
    retryable: true,
    message: JOB_ERROR_MESSAGES.simulated_failure,
  });
});

Deno.test("engine_test: 'first_attempt' fails once, succeeds on attempt 2", async () => {
  const first = fakeStore();
  await run(job({ topic: "x", simulate_failure: "first_attempt" }, 1), first);
  assertEquals(first.recorded.failed?.code, "simulated_failure");

  const second = fakeStore();
  await run(job({ topic: "x", simulate_failure: "first_attempt" }, 2), second);
  assert(second.recorded.completed);
});

Deno.test("invalid input and unknown kinds fail at once, without retry", async () => {
  const invalid = fakeStore();
  await run(job({ topic: "" }), invalid);
  assertEquals(invalid.recorded.failed?.code, "invalid_input");
  assertEquals(invalid.recorded.failed?.retryable, false);

  const unknown = fakeStore();
  await run(job({}, 1, "not_registered"), unknown);
  assertEquals(unknown.recorded.failed?.code, "unknown_job_kind");
  assertEquals(unknown.recorded.failed?.retryable, false);
});

Deno.test("a superseded attempt stops silently: no completion, no failure", async () => {
  const store = fakeStore({ fenceProgressAt: 2 });
  await run(job({ topic: "x" }), store);
  assertEquals(store.recorded.progress.length, 2);
  assertEquals(store.recorded.completed, undefined);
  assertEquals(store.recorded.failed, undefined);
});

Deno.test("service errors map to stable codes; raw details never reach the message", async () => {
  const kinds = {
    flaky: defineJobKind({
      input: z.object({}),
      run: () =>
        Promise.reject(new ServiceError("service_failed", true, "upstream said 503 with secret details")),
    }),
    refused: defineJobKind({
      input: z.object({}),
      run: () => Promise.reject(new ServiceError("content_rejected", false, "policy violation")),
    }),
    crash: defineJobKind({ input: z.object({}), run: () => Promise.reject(new TypeError("boom")) }),
  };
  const expectations: Record<string, [string, boolean]> = {
    flaky: ["generation_failed", true],
    refused: ["content_rejected", false],
    crash: ["generation_failed", true],
  };
  for (const [kind, [code, retryable]] of Object.entries(expectations)) {
    const store = fakeStore();
    await run(job({}, 1, kind), store, kinds);
    assertEquals(store.recorded.failed?.code, code);
    assertEquals(store.recorded.failed?.retryable, retryable);
    assertEquals(store.recorded.failed?.message, JOB_ERROR_MESSAGES[code as keyof typeof JOB_ERROR_MESSAGES]);
  }
});
