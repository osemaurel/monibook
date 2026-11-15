import type { ProviderSettings } from "../settings.ts";
import { type AdsService, createAdsService } from "./ads/index.ts";
import { createImageService, type ImageService } from "./image/index.ts";
import { createTextService, type TextService } from "./text/index.ts";
import { createVideoService, type VideoService } from "./video/index.ts";
import { createVoiceService, type VoiceService } from "./voice/index.ts";

export interface Services {
  text: TextService;
  image: ImageService;
  video: VideoService;
  voice: VoiceService;
  ads: AdsService;
}

/** Business code only sees these interfaces; the adapter of each service comes from settings. */
export function createServices(providers: ProviderSettings): Services {
  return {
    text: createTextService(providers.text),
    image: createImageService(providers.image),
    video: createVideoService(providers.video),
    voice: createVoiceService(providers.voice),
    ads: createAdsService(providers.ads),
  };
}

export { ServiceError } from "./types.ts";
