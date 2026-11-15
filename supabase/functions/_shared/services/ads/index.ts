import { z } from "../../deps.ts";
import { parseRequest, selectAdapter } from "../types.ts";
import { createSimulatedAdsAdapter } from "./simulation.ts";

/** Searches ads currently running on a topic, to study a niche and its competition. */
export const AdsSearchRequest = z.object({
  query: z.string().min(1).max(200),
  country: z.string().regex(/^[A-Z]{2}$/),
  limit: z.number().int().min(1).max(50).default(20),
});
export type AdsSearchRequest = z.input<typeof AdsSearchRequest>;
export type ValidAdsSearchRequest = z.output<typeof AdsSearchRequest>;

export interface AdSummary {
  id: string;
  advertiser: string;
  text: string;
  mediaUrl?: string;
  startedAt?: string;
}

export interface AdsSearchResult {
  ads: AdSummary[];
}

export interface AdsAdapter {
  search(request: ValidAdsSearchRequest): Promise<AdsSearchResult>;
}

export interface AdsService {
  search(request: AdsSearchRequest): Promise<AdsSearchResult>;
}

const adapters: Record<string, () => AdsAdapter> = {
  simulation: createSimulatedAdsAdapter,
};

export function createAdsService(providerName: string | undefined): AdsService {
  return {
    async search(request) {
      const valid = parseRequest(AdsSearchRequest, request);
      return await selectAdapter("ads", adapters, providerName).search(valid);
    },
  };
}
