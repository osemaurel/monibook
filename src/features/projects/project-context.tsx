import { createContext, useContext } from "react";
import { Link, Outlet, useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "./project";
import { useProject } from "./use-projects";

const ProjectContext = createContext<Project | null>(null);

/**
 * Loads the project of the URL and shares it with every module below, so their forms start
 * pre-filled. Data flows through this context only, never through browser storage.
 */
export function ProjectProvider() {
  const { projectId } = useParams();
  const project = useProject(projectId!);

  if (project.isPending) return <Skeleton className="h-48 w-full" />;
  if (project.isError) return <p className="text-sm text-destructive">Ce projet n'a pas pu être chargé.</p>;
  if (!project.data) {
    return (
      <div className="flex flex-col gap-2">
        <p>Ce projet est introuvable.</p>
        <Link to="/projets" className="text-sm underline underline-offset-4">Retour à mes projets</Link>
      </div>
    );
  }

  return (
    <ProjectContext.Provider value={project.data}>
      <Outlet />
    </ProjectContext.Provider>
  );
}

export function useCurrentProject(): Project {
  const project = useContext(ProjectContext);
  if (!project) throw new Error("useCurrentProject doit être utilisé sous ProjectProvider");
  return project;
}
