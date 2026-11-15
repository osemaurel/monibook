import { assert, assertEquals, assertRejects } from "@std/assert";
import { createServices, ServiceError } from "../_shared/services/index.ts";

const simulated = createServices({
  text: "simulation",
  image: "simulation",
  video: "simulation",
  voice: "simulation",
  ads: "simulation",
});

Deno.test("each service answers through the adapter chosen in settings", async () => {
  const text = await simulated.text.generate({ prompt: "Bonjour" });
  assert(text.text.length > 0);

  const image = await simulated.image.generate({ prompt: "Une couverture", count: 2 });
  assertEquals(image.images.length, 2);
  assertEquals(image.images[0].mimeType, "image/svg+xml");

  const { taskId } = await simulated.video.submit({ prompt: "Une vidéo" });
  assertEquals((await simulated.video.poll(taskId)).state, "done");

  const voice = await simulated.voice.synthesize({ text: "Bonjour" });
  assertEquals(voice.audio.mimeType, "audio/wav");

  const ads = await simulated.ads.search({ query: "cuisine", country: "CI" });
  assert(ads.ads.length > 0);
});

Deno.test("a service without configured adapter is unavailable, not retryable", async () => {
  for (const providers of [{}, { text: "does-not-exist" }]) {
    const error = await assertRejects(
      () => createServices(providers).text.generate({ prompt: "x" }),
      ServiceError,
    );
    assertEquals(error.code, "service_unavailable");
    assertEquals(error.retryable, false);
  }
});

Deno.test("requests are validated before reaching an adapter", async () => {
  const error = await assertRejects(() => simulated.text.generate({ prompt: "" }), ServiceError);
  assertEquals(error.code, "invalid_request");
  const adsError = await assertRejects(
    () => simulated.ads.search({ query: "x", country: "civ" }),
    ServiceError,
  );
  assertEquals(adsError.code, "invalid_request");
});
