import { engineTest } from "./kinds/engine-test.ts";
import type { JobKindDefinition } from "./types.ts";

// A kind can only be launched if it is listed here AND priced in settings.credit_costs.
// deno-lint-ignore no-explicit-any
export const JOB_KINDS: Record<string, JobKindDefinition<any>> = {
  engine_test: engineTest,
};
