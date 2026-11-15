import { JOB_KINDS } from "../_shared/jobs/registry.ts";
import { authenticatedUserId, createAdminClient, sqlErrorCode } from "../_shared/supabase.ts";
import { createJobCreateHandler, CreateJobRejected } from "./handler.ts";

const admin = createAdminClient();

Deno.serve(createJobCreateHandler({
  kinds: JOB_KINDS,
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
