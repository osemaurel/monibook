import { z } from "../deps.ts";

export const SERVICE_NAMES = ["text", "image", "video", "voice", "ads"] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export type ServiceErrorCode =
  | "service_unavailable"
  | "service_failed"
  | "content_rejected"
  | "invalid_request";

/** The only error type a service may throw. `detail` is for server logs, never for users. */
export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    readonly retryable: boolean,
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = "ServiceError";
  }
}

export function selectAdapter<T>(
  service: ServiceName,
  adapters: Record<string, () => T>,
  providerName: string | undefined,
): T {
  const factory = providerName ? adapters[providerName] : undefined;
  if (!factory) {
    throw new ServiceError("service_unavailable", false, `No adapter "${providerName ?? ""}" for ${service}`);
  }
  return factory();
}

export function parseRequest<S extends z.ZodType>(schema: S, request: unknown): z.output<S> {
  const parsed = schema.safeParse(request);
  if (!parsed.success) {
    throw new ServiceError("invalid_request", false, z.prettifyError(parsed.error));
  }
  return parsed.data;
}

export interface BinaryFile {
  data: Uint8Array;
  mimeType: string;
}
