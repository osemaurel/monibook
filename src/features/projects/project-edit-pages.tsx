import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentProject } from "./project-context";
import { ProjectForm } from "./project-form";
import { type SaveProjectResult, useDeleteProject } from "./use-projects";

const COVER_FAILED = "Le projet est enregistré, mais la couverture n'a pas pu être envoyée. Réessayez depuis « Modifier ».";

export function NewProjectPage() {
  const navigate = useNavigate();

  function saved({ projectId, coverFailed }: SaveProjectResult) {
    if (coverFailed) toast.warning(COVER_FAILED);
    else toast.success("Projet créé.");
    navigate(`/projets/${projectId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/projets" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Mes projets
      </Link>
      <h1 className="text-xl font-semibold">Nouveau projet</h1>
      <ProjectForm submitLabel="Créer le projet" onSaved={saved} />
    </div>
  );
}

export function EditProjectPage() {
  const project = useCurrentProject();
  const navigate = useNavigate();
  const remove = useDeleteProject();

  function saved({ coverFailed }: SaveProjectResult) {
    if (coverFailed) toast.warning(COVER_FAILED);
    else toast.success("Modifications enregistrées.");
    navigate(`/projets/${project.id}`);
  }

  function confirmDelete() {
    remove.mutate(project.id, {
      onSuccess: () => {
        toast.success("Projet supprimé.");
        navigate("/projets");
      },
      onError: () => toast.error("Le projet n'a pas pu être supprimé. Veuillez réessayer."),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/projets/${project.id}`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {project.name}
      </Link>
      <h1 className="text-xl font-semibold">Modifier le projet</h1>
      {/* key: a fresh form when the context delivers a newer version of the project */}
      <ProjectForm key={project.updated_at} project={project} submitLabel="Enregistrer" onSaved={saved} />

      <section className="mt-6 flex flex-col gap-2 rounded-xl border border-destructive/30 p-4">
        <h2 className="font-medium">Supprimer le projet</h2>
        {project.active_jobs > 0
          ? <p className="text-sm text-muted-foreground">Une génération est en cours sur ce projet : attendez qu'elle se termine pour le supprimer.</p>
          : <p className="text-sm text-muted-foreground">Le projet disparaîtra de vos listes. L'historique de vos crédits est conservé.</p>}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={project.active_jobs > 0 || remove.isPending}>
              Supprimer le projet
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer « {project.name} » ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
