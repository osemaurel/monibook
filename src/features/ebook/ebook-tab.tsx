import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProject } from "@/features/projects/project-context";
import type { ProjectModule } from "@/features/projects/modules";
import { formatInteger } from "@/lib/format";
import { useChapters, useEbook } from "./api";
import { CoverArt } from "./components";
import { STEPS } from "./config";

/** Content of the project's Ebook tab: entry point to the 9-step flow. */
export function EbookTab({ module }: { module: ProjectModule }) {
  const project = useCurrentProject();
  const ebook = useEbook(project.id);
  const chapters = useChapters(ebook.data?.id);

  if (ebook.isPending) return <Skeleton className="h-32 w-full" />;
  const data = ebook.data;
  const words = (chapters.data ?? []).reduce((sum, c) => sum + c.word_count, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg bg-muted/60 p-3 text-sm">
        <p className="font-medium">{data?.written_at ? "Ce module produit :" : "Ce module produira :"}</p>
        <p className="text-muted-foreground">{module.produces}</p>
      </div>

      {!data
        ? (
          <Button size="lg" asChild>
            <Link to="ebook">Commencer l'ebook</Link>
          </Button>
        )
        : (
          <div className="flex gap-3 rounded-lg border p-3">
            {data.cover_path && (
              <CoverArt
                path={data.cover_path}
                title={data.title ?? ""}
                author={data.author_name}
                className="w-20 shrink-0 text-[7px]"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">{data.title ?? data.subject}</p>
              <p className="text-sm text-muted-foreground">Étape {data.step} sur 9 : {STEPS[data.step - 1]}</p>
              {data.written_at && (
                <p className="text-sm text-muted-foreground">
                  {chapters.data?.length ?? 0} chapitres · {formatInteger(words)} mots
                </p>
              )}
              <Button size="sm" className="mt-1 self-start" asChild>
                <Link to={`ebook?etape=${data.step}`}>Continuer l'ebook</Link>
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
