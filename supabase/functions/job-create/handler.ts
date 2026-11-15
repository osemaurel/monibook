import { z } from "../_shared/deps.ts";
import { corsHeaders, errorResponse, json, readJson } from "../_shared/http.ts";
import type { JobKindDefinition } from "../_shared/jobs/types.ts";

const Body = z.strictObject({
  kind: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/),
  project_id: z.uuid(),
  input: z.unknown().optional(),
});

export class CreateJobRejected extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export interface JobCreateDeps {
  /** User id from the verified bearer token, or null. Never from the body. */
  authenticate(req: Request): Promise<string | null>;
  createJob(userId: string, projectId: string, kind: string, input: unknown): Promise<{ id: string }>;
  // deno-lint-ignore no-explicit-any
  kinds: Record<string, JobKindDefinition<any>>;
}

const REJECTIONS: Record<string, [number, string]> = {
  insufficient_credits: [402, "Votre solde de crédits est insuffisant pour cette génération."],
  access_denied: [403, "Votre compte n'a pas accès à Monibook."],
  project_not_found: [404, "Ce projet est introuvable."],
  unknown_job_kind: [400, "Cette génération n'est pas disponible."],
  profile_not_found: [403, "Votre compte n'a pas accès à Monibook."],
};

export function createJobCreateHandler(deps: JobCreateDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Méthode non autorisée.");

    const userId = await deps.authenticate(req);
    if (!userId) {
      return errorResponse(401, "unauthorized", "Votre session a expiré. Veuillez vous reconnecter.");
    }

    const body = Body.safeParse(await readJson(req));
    if (!body.success) {
      return errorResponse(400, "invalid_request", "La demande envoyée est invalide.");
    }

    const definition = deps.kinds[body.data.kind];
    if (!definition) {
      return errorResponse(400, "unknown_job_kind", REJECTIONS.unknown_job_kind[1]);
    }

    const input = definition.input.safeParse(body.data.input ?? {});
    if (!input.success) {
      return errorResponse(400, "invalid_input", "Les informations envoyées sont incomplètes ou invalides.");
    }

    try {
      const job = await deps.createJob(userId, body.data.project_id, body.data.kind, input.data);
      return json({ job_id: job.id }, 201);
    } catch (error) {
      if (error instanceof CreateJobRejected && REJECTIONS[error.code]) {
        const [status, message] = REJECTIONS[error.code];
        return errorResponse(status, error.code, message);
      }
      console.error("job-create failed", error);
      return errorResponse(500, "internal_error", "Une erreur est survenue. Veuillez réessayer.");
    }
  };
}
