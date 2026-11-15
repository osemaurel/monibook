import { ServiceError } from "../services/types.ts";

/** Messages stored on failed jobs and shown as is to the user. */
export const JOB_ERROR_MESSAGES = {
  generation_failed: "La génération n'a pas abouti après plusieurs tentatives.",
  invalid_input: "Les paramètres de cette génération sont invalides.",
  unknown_job_kind: "Ce type de génération n'est pas disponible.",
  service_unavailable: "Le service de génération est momentanément indisponible.",
  content_rejected: "Ce contenu n'a pas pu être généré. Veuillez reformuler votre demande.",
  job_timeout: "La génération a pris trop de temps et a été interrompue.",
  simulated_failure: "Échec simulé pour le test du moteur.",
} as const;

export type JobErrorCode = keyof typeof JOB_ERROR_MESSAGES;

export class JobError extends Error {
  constructor(
    readonly code: JobErrorCode,
    readonly retryable: boolean,
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = "JobError";
  }
}

/** The attempt was taken over (retried or recovered): this worker must stop silently. */
export class JobFencedError extends Error {
  constructor() {
    super("job_not_active");
    this.name = "JobFencedError";
  }
}

export function toJobError(error: unknown): JobError {
  if (error instanceof JobError) return error;
  if (error instanceof ServiceError) {
    switch (error.code) {
      case "invalid_request":
        return new JobError("invalid_input", false, error.message);
      case "content_rejected":
        return new JobError("content_rejected", false, error.message);
      case "service_unavailable":
        return new JobError("service_unavailable", error.retryable, error.message);
      case "service_failed":
        return new JobError("generation_failed", error.retryable, error.message);
    }
  }
  return new JobError("generation_failed", true, error instanceof Error ? error.message : String(error));
}
