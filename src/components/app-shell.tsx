import { Coins, FolderOpen, LayoutDashboard, LogOut } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useBalance } from "@/features/credits/use-credits";
import { useJobsFeed } from "@/features/jobs/use-jobs";
import { formatCredits } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/projets", label: "Projets", icon: FolderOpen, end: false },
  { to: "/credits", label: "Crédits", icon: Coins, end: false },
];

export function AppShell() {
  useJobsFeed();
  const balance = useBalance();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link to="/" className="font-semibold tracking-tight">Monibook</Link>
          <nav className="ml-4 hidden gap-1 md:flex" aria-label="Navigation principale">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn("rounded-md px-3 py-1.5 text-sm", isActive ? "bg-muted font-medium" : "text-muted-foreground")}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <Link to="/credits" className="ml-auto rounded-full border px-3 py-1 text-sm tabular-nums">
            {balance.data ? formatCredits(balance.data.available) : "…"}
          </Link>
          <Button variant="ghost" size="icon" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()}>
            <LogOut />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4 pb-24 md:pb-10">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navigation principale"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-0.5 py-2 text-xs", isActive ? "font-medium text-foreground" : "text-muted-foreground")}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <Toaster position="top-center" />
    </div>
  );
}
