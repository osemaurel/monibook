import { Loader2 } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./auth-provider";
import { useProfile } from "./use-profile";

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-label="Chargement">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Access is binary: has_access true or false. There is no plan level to check. */
export function RequireAccess() {
  const profile = useProfile();
  if (profile.isPending) return <FullScreenLoader />;
  if (profile.isError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p>Votre compte n'a pas pu être chargé. Vérifiez votre connexion.</p>
        <Button variant="outline" onClick={() => profile.refetch()}>Réessayer</Button>
      </div>
    );
  }
  if (!profile.data.has_access) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="max-w-sm">Votre accès à Monibook n'est pas actif.</p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>Se déconnecter</Button>
      </div>
    );
  }
  return <Outlet />;
}
