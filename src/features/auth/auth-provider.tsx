import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { readLinkError } from "./auth-messages";

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** Set when the visitor arrived from an expired or already used e-mail link. */
  linkError: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Read once, before the redirect to the sign-in screen drops the address fragment.
  const [linkError] = useState(() => readLinkError(window.location.hash));
  const [state, setState] = useState<Omit<AuthState, "linkError">>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") queryClient.clear();
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ ...state, linkError }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return value;
}

/** Id of the signed-in user. Only valid below RequireAuth. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error("Aucune session active");
  return session.user.id;
}
