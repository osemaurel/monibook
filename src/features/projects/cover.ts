import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

const BUCKET = "assets";
const MAX_SIDE_PX = 1200;
const QUALITY = 0.8;
const SIGNED_URL_TTL_S = 3600;
export const MAX_COVER_INPUT_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_COVER_TYPES = "image/jpeg,image/png,image/webp";

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** Resizes to 1200 px max and re-encodes (WebP, JPEG where WebP encoding is unsupported). */
export async function compressCover(file: File): Promise<{ blob: Blob; extension: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await canvasToBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return { blob: webp, extension: "webp" };
  const jpeg = await canvasToBlob(canvas, "image/jpeg");
  if (!jpeg) throw new Error("Image illisible");
  return { blob: jpeg, extension: "jpg" };
}

export async function uploadCover(userId: string, projectId: string, file: File): Promise<string> {
  const { blob, extension } = await compressCover(file);
  const path = `${userId}/${projectId}/cover/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}

export async function removeCover(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

export function useCoverUrl(path: string | null) {
  return useQuery({
    queryKey: queryKeys.coverUrl(path ?? ""),
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_S - 600) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, SIGNED_URL_TTL_S);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
