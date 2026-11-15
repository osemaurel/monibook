import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoverUrl } from "./cover";

export function ProjectCover({ path, previewUrl, className }: {
  path: string | null;
  /** Local preview of a file not uploaded yet. */
  previewUrl?: string;
  className?: string;
}) {
  const signed = useCoverUrl(previewUrl ? null : path);
  const src = previewUrl ?? signed.data;

  return (
    <div className={cn("aspect-[3/4] overflow-hidden rounded-md bg-muted", className)}>
      {src
        ? <img src={src} alt="Couverture du projet" loading="lazy" decoding="async" className="size-full object-cover" />
        : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <BookOpen className="size-6" aria-hidden />
          </div>
        )}
    </div>
  );
}
