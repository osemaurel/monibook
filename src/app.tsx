import { createBrowserRouter, isRouteErrorResponse, Link, useRouteError } from "react-router";
import { AppShell } from "@/components/app-shell";
import { RequireAccess, RequireAuth } from "@/features/auth/guards";
import { LoginPage } from "@/features/auth/login-page";
import { ProjectProvider } from "@/features/projects/project-context";

function NotFound() {
  return (
    <div className="flex flex-col gap-2">
      <p>Cette page n'existe pas.</p>
      <Link to="/" className="text-sm underline underline-offset-4">Retour au tableau de bord</Link>
    </div>
  );
}

/** Shown when a screen fails to load (connection lost, or a new version was deployed meanwhile). */
function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="max-w-sm">
        {notFound ? "Cette page n'existe pas." : "Cette page n'a pas pu être chargée. Vérifiez votre connexion puis rechargez la page."}
      </p>
      <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => window.location.reload()}>
        Recharger la page
      </button>
    </div>
  );
}

// Screens are downloaded on demand to keep the first load light on slow connections.
export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteError />,
    children: [{
      element: <RequireAccess />,
      children: [{
        element: <AppShell />,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import("@/features/dashboard/dashboard-page")).DashboardPage }),
          },
          {
            path: "projets",
            lazy: async () => ({ Component: (await import("@/features/projects/projects-page")).ProjectsPage }),
          },
          {
            path: "projets/nouveau",
            lazy: async () => ({ Component: (await import("@/features/projects/project-edit-pages")).NewProjectPage }),
          },
          {
            path: "projets/:projectId",
            element: <ProjectProvider />,
            children: [
              {
                index: true,
                lazy: async () => ({ Component: (await import("@/features/projects/project-page")).ProjectPage }),
              },
              {
                path: "modifier",
                lazy: async () => ({
                  Component: (await import("@/features/projects/project-edit-pages")).EditProjectPage,
                }),
              },
              {
                path: "ebook",
                lazy: async () => ({ Component: (await import("@/features/ebook/ebook-page")).EbookPage }),
              },
              {
                path: "generations/:jobId",
                lazy: async () => ({ Component: (await import("@/features/jobs/job-page")).JobPage }),
              },
            ],
          },
          {
            path: "credits",
            lazy: async () => ({ Component: (await import("@/features/credits/credit-history-page")).CreditHistoryPage }),
          },
          { path: "*", element: <NotFound /> },
        ],
      }],
    }],
  },
]);
