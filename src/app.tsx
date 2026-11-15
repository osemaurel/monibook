import { createBrowserRouter, Link } from "react-router";
import { AppShell } from "@/components/app-shell";
import { RequireAccess, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/login-page";
import { CreditHistoryPage } from "@/features/credits/credit-history-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { JobPage } from "@/features/jobs/job-page";
import { ProjectProvider } from "@/features/projects/project-context";
import { EditProjectPage, NewProjectPage } from "@/features/projects/project-edit-pages";
import { ProjectPage } from "@/features/projects/project-page";
import { ProjectsPage } from "@/features/projects/projects-page";

function NotFound() {
  return (
    <div className="flex flex-col gap-2">
      <p>Cette page n'existe pas.</p>
      <Link to="/" className="text-sm underline underline-offset-4">Retour au tableau de bord</Link>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [{
      element: <RequireAccess />,
      children: [{
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "projets", element: <ProjectsPage /> },
          { path: "projets/nouveau", element: <NewProjectPage /> },
          {
            path: "projets/:projectId",
            element: <ProjectProvider />,
            children: [
              { index: true, element: <ProjectPage /> },
              { path: "modifier", element: <EditProjectPage /> },
              { path: "generations/:jobId", element: <JobPage /> },
            ],
          },
          { path: "credits", element: <CreditHistoryPage /> },
          { path: "*", element: <NotFound /> },
        ],
      }],
    }],
  },
]);
