import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "./auth-layout";
import { signInErrorMessage } from "./auth-messages";
import { useAuth } from "./auth-provider";
import { PasswordInput } from "./password-input";
import { ResendConfirmation } from "./resend-confirmation";

export function LoginPage() {
  const { session, linkError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ code?: string; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to={from} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setPending(false);
    if (!error) return navigate(from, { replace: true });
    setError({ code: error.code, text: signInErrorMessage(error.code) });
  }

  return (
    <AuthLayout
      description="Connectez-vous pour retrouver vos projets."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link to="/inscription" className="font-medium text-foreground underline underline-offset-4">Créer un compte</Link>
        </>
      }
    >
      {linkError && !error && (
        <p className="rounded-lg bg-muted p-3 text-sm" role="status">
          Ce lien n'est plus valable : il a expiré ou a déjà servi. Connectez-vous ; si votre adresse n'est pas encore
          confirmée, vous pourrez demander un nouveau lien.
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </FieldGroup>
        {error && <p className="text-sm text-destructive" role="alert">{error.text}</p>}
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</Button>
      </form>
      {error?.code === "email_not_confirmed" && <ResendConfirmation email={email.trim().toLowerCase()} />}
    </AuthLayout>
  );
}
