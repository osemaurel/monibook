import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import { runJob } from "../_shared/jobs/runner.ts";
import { createSupabaseEbookStore, createSupabaseFileStore } from "../_shared/ebook/store.ts";
import {
  claimJobs,
  createSupabaseJobStore,
  kickRunner,
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
const data = { ebooks: createSupabaseEbookStore(admin), files: createSupabaseFileStore(admin) };

Deno.serve(createJobRunHandler({
  verifySecret: (secret) => verifyRunnerSecret(admin, secret),
  recoverStaleJobs: () => recoverStaleJobs(admin),
  claimJobs: (limit) => claimJobs(admin, limit),
  async runJob(job) {
    const services = createServices(await readProviderSettings(admin));
    return await runJob(job, {
      store,
      services,
      data,
      kinds: JOB_KINDS,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      now: () => Date.now(),
      log: (message, details) => console.log(JSON.stringify({ message, ...details })),
    });
  },
  kick: () => kickRunner(admin),
  waitUntil: (work) => EdgeRuntime.waitUntil(work),
}));
