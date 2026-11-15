import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

export const queryKeys = {
  profile: ["profile"] as const,
  balance: ["balance"] as const,
  creditCosts: ["credit-costs"] as const,
  creditHistory: ["credit-history"] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  projectsInProgressCount: ["projects", "in-progress-count"] as const,
  job: (id: string) => ["job", id] as const,
  jobs: ["jobs"] as const,
  projectJobs: (projectId: string) => ["jobs", "project", projectId] as const,
  activeJobs: ["jobs", "active"] as const,
  coverUrl: (path: string) => ["cover-url", path] as const,
};
