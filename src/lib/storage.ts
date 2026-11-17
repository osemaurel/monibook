import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

const BUCKET = "assets";
const SIGNED_URL_TTL_S = 3600;

/** Short-lived link to a private file of the user; renewed before it expires. */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path ?? ""],
    enabled: !!path,
    staleTime: (SIGNED_URL_TTL_S - 600) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, SIGNED_URL_TTL_S);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Downloads the original file, full resolution, and saves it under a readable name. */
export async function downloadStoredFile(path: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Uploads a file the user chose (already compressed) and returns its storage path. */
export async function uploadUserFile(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
  });
  if (error) throw error;
  return path;
}
