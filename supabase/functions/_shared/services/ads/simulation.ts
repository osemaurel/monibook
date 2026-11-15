import type { AdsAdapter } from "./index.ts";

/** Development adapter: returns fictitious ads, calls nothing. */
export function createSimulatedAdsAdapter(): AdsAdapter {
  return {
    search(request) {
      const ads = Array.from({ length: Math.min(request.limit, 3) }, (_, i) => ({
        id: `simulation-${i + 1}`,
        advertiser: `Annonceur fictif ${i + 1}`,
        text: `Annonce simulée sur « ${request.query} » (${request.country}).`,
      }));
      return Promise.resolve({ ads });
    },
  };
}
