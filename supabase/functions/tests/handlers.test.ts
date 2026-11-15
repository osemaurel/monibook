import { assert, assertEquals } from "jsr:@std/assert@1";
import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import type { ClaimedJob } from "../_shared/jobs/types.ts";
import { createJobCreateHandler, CreateJobRejected } from "../job-create/handler.ts";
import { createJobRunHandler, MAX_JOBS_PER_RUN } from "../job-run/handler.ts";

const USER = crypto.randomUUID();
const PROJECT = crypto.randomUUID();

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/fn", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function jobCreate(
  createJob = (_u: string, _p: string, _k: string, _i: unknown) => Promise.resolve({ id: "job-1" }),
) {
  const calls: unknown[][] = [];
  const handler = createJobCreateHandler({
    kinds: JOB_KINDS,
    authenticate: (req) => Promise.resolve(req.headers.get("Authorization") === "Bearer valid" ? USER : null),
    createJob: (...args) => {
      calls.push(args);
      return createJob(...args);
    },
  });
  return { handler, calls };
}

const auth = { Authorization: "Bearer valid" };
const validBody = { kind: "engine_test", project_id: PROJECT, input: { topic: "Cuisine" } };

Deno.test("job-create: identity comes from the token only", async () => {
  const { handler, calls } = jobCreate();
  assertEquals((await handler(post(validBody))).status, 401);
  assertEquals((await handler(post({ ...validBody, user_id: crypto.randomUUID() }, auth))).status, 400);
  assertEquals(calls.length, 0);

  const res = await handler(post(validBody, auth));
  assertEquals(res.status, 201);
  assertEquals(await res.json(), { job_id: "job-1" });
  assertEquals(calls[0], [USER, PROJECT, "engine_test", { topic: "Cuisine", simulate_failure: "none" }]);
});

Deno.test("job-create: inputs are validated with zod before any write", async () => {
  const { handler, calls } = jobCreate();
  const cases = [
    { kind: "engine_test", project_id: "not-a-uuid", input: { topic: "x" } },
    { kind: "unknown_kind", project_id: PROJECT },
    { kind: "engine_test", project_id: PROJECT, input: { topic: "" } },
    { kind: "engine_test", project_id: PROJECT, input: { topic: "x", simulate_failure: "sometimes" } },
  ];
  for (const body of cases) {
    const res = await handler(post(body, auth));
    assertEquals(res.status, 400, JSON.stringify(body));
  }
  assertEquals(calls.length, 0);
});

Deno.test("job-create: database refusals become French messages", async () => {
  const expectations: Record<string, number> = {
    insufficient_credits: 402,
    access_denied: 403,
    project_not_found: 404,
    unknown_job_kind: 400,
  };
  for (const [code, status] of Object.entries(expectations)) {
    const { handler } = jobCreate(() => Promise.reject(new CreateJobRejected(code)));
    const res = await handler(post(validBody, auth));
    assertEquals(res.status, status);
    const body = await res.json();
    assertEquals(body.error.code, code);
    assert(/[éèàç]|Votre|Ce|Cette/.test(body.error.message));
  }
});

Deno.test("job-run: requires the runner secret, then recovers, claims and runs in background", async () => {
  const claimed: ClaimedJob[] = [{
    id: crypto.randomUUID(),
    user_id: USER,
    project_id: PROJECT,
    kind: "engine_test",
    input: {},
    attempts: 1,
  }];
  const events: string[] = [];
  let background: Promise<unknown> | undefined;
  const handler = createJobRunHandler({
    verifySecret: (secret) => Promise.resolve(secret === "s3cret"),
    recoverStaleJobs: () => {
      events.push("recover");
      return Promise.resolve(2);
    },
    claimJobs: (limit) => {
      events.push(`claim:${limit}`);
      return Promise.resolve(claimed);
    },
    runJob: (job) => {
      events.push(`run:${job.id}`);
      return Promise.resolve();
    },
    waitUntil: (work) => {
      background = work;
    },
  });

  assertEquals((await handler(post({}))).status, 401);
  assertEquals((await handler(post({}, { "x-job-runner-secret": "wrong" }))).status, 401);
  assertEquals(events, []);

  const res = await handler(post({}, { "x-job-runner-secret": "s3cret" }));
  assertEquals(res.status, 202);
  assertEquals(await res.json(), { recovered: 2, claimed: 1 });
  await background;
  assertEquals(events, ["recover", `claim:${MAX_JOBS_PER_RUN}`, `run:${claimed[0].id}`]);
});
