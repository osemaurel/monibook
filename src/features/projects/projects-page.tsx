import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "./project-card";
import { useProjects } from "./use-projects";

export function ProjectsPage() {
  const projects = useProjects();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Mes projets</h1>
        {projects.data && projects.data.length > 0 && (
          <Button asChild>
            <Link to="/projets/nouveau"><Plus /> Nouveau projet</Link>
          </Button>
        )}
      </div>

      {projects.isPending && <Skeleton className="h-24 w-full" />}
      {projects.isError && <p className="text-sm text-destructive">Vos projets n'ont pas pu être chargés.</p>}
      {projects.data?.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-5">
          <p>Vous n'avez pas encore de projet. Un projet réunit votre ebook, vos visuels, vos vidéos et vos textes de vente.</p>
          <Button asChild>
            <Link to="/projets/nouveau">Créer mon premier projet</Link>
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {projects.data?.map((project) => <ProjectCard key={project.id} project={project} />)}
      </div>
    </div>
  );
}
