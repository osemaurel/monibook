import { JOB_INPUTS } from "../_shared/jobs/inputs.ts";
import { authenticatedUserId, createAdminClient, sqlErrorCode } from "../_shared/supabase.ts";
import { createJobCreateHandler, CreateJobRejected } from "./handler.ts";

const admin = createAdminClient();

Deno.serve(createJobCreateHandler({
  inputs: JOB_INPUTS,
  async kick() {
    const { error } = await admin.rpc("kick_job_runner");
    if (error) throw new Error(error.message);
  },
  authenticate: (req) => authenticatedUserId(req, admin),
  async createJob(userId, projectId, kind, input) {
    const { data, error } = await admin.rpc("create_job", {
      p_user_id: userId,
      p_project_id: projectId,
      p_kind: kind,
      p_input: input,
    });
    if (error) {
      const code = sqlErrorCode(error);
      if (code) throw new CreateJobRejected(code);
      throw new Error(error.message);
    }
    return { id: (data as { id: string }).id };
  },
}));
