import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import { runJob } from "../_shared/jobs/runner.ts";
import {
  claimJobs,
  createSupabaseJobStore,
  recoverStaleJobs,
  verifyRunnerSecret,
} from "../_shared/jobs/store.ts";
import { createServices } from "../_shared/services/index.ts";
import { readProviderSettings } from "../_shared/settings.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { createJobRunHandler } from "./handler.ts";

declare const EdgeRuntime: { waitUntil(work: Promise<unknown>): void };

const admin = createAdminClient();
const store = createSupabaseJobStore(admin);

Deno.serve(createJobRunHandler({
  verifySecret: (secret) => verifyRunnerSecret(admin, secret),
  recoverStaleJobs: () => recoverStaleJobs(admin),
  claimJobs: (limit) => claimJobs(admin, limit),
  async runJob(job) {
    const services = createServices(await readProviderSettings(admin));
    await runJob(job, {
      store,
      services,
      kinds: JOB_KINDS,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log: (message, details) => console.log(JSON.stringify({ message, ...details })),
    });
  },
  waitUntil: (work) => EdgeRuntime.waitUntil(work),
}));
