import { Pencil } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatFcfa } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ModuleTab } from "./module-tab";
import { useAvailableModules, useLaunchRequirements } from "./modules";
import { LANGUAGE_LABELS, PROJECT_STATUS_LABELS } from "./project";
import { useCurrentProject } from "./project-context";
import { ProjectCover } from "./project-cover";
import { describeMissing, missingForLaunch } from "./readiness";

export function ProjectPage() {
  const project = useCurrentProject();
  const { modules, loading } = useAvailableModules();
  const missing = missingForLaunch(project, useLaunchRequirements());

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex gap-3">
          <ProjectCover path={project.cover_path} className="w-20 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{project.name}</h1>
              <Badge variant="outline">{PROJECT_STATUS_LABELS[project.status]}</Badge>
            </div>
            <p className={cn("text-sm", !project.promise && "text-muted-foreground italic")}>
              {project.promise ?? "Promesse à définir"}
            </p>
            <p className="text-sm text-muted-foreground">
              {project.planned_price_fcfa !== null ? formatFcfa(project.planned_price_fcfa) : "Prix à définir"}
              {" · "}
              {LANGUAGE_LABELS[project.language]}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn("text-sm", missing.length === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
            {describeMissing(missing)}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="modifier"><Pencil /> Modifier</Link>
          </Button>
        </div>
      </header>

      {loading && <Skeleton className="h-40 w-full" />}
      {!loading && modules.length > 0 && (
        <Tabs defaultValue={modules[0].id} className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            {modules.map((m) => <TabsTrigger key={m.id} value={m.id}>{m.tabLabel}</TabsTrigger>)}
          </TabsList>
          {modules.map((m) => (
            <TabsContent key={m.id} value={m.id}>
              <ModuleTab module={m} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
