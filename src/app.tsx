import { createBrowserRouter, Link } from "react-router";
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

// Screens are downloaded on demand to keep the first load light on slow connections.
export const router = createBrowserRouter([
  { path: "/connexion", element: <LoginPage /> },
  {
    element: <RequireAuth />,
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
