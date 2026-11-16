import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "./auth-layout";
import { signUpErrorMessage } from "./auth-messages";
import { useAuth } from "./auth-provider";
import { PasswordInput } from "./password-input";
import { confirmationRedirect, ResendConfirmation } from "./resend-confirmation";
import { PASSWORD_MIN_LENGTH, type SignupInput, SignupSchema, type SignupValues } from "./signup-schema";

const linkClass = "font-medium text-foreground underline underline-offset-4";

export function SignupPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SignupInput, unknown, SignupValues>({
    resolver: zodResolver(SignupSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  if (session) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async ({ displayName, email, password }) => {
    setServerError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName }, emailRedirectTo: confirmationRedirect() },
    });
    if (error) return setServerError(signUpErrorMessage(error.code));
    // With confirmation turned off the account is usable at once; otherwise a link was e-mailed.
    if (data.session) return navigate("/", { replace: true });
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <AuthLayout
        title="Confirmez votre e-mail"
        description="Une dernière étape pour activer votre compte."
        footer={<Link to="/connexion" className={linkClass}>Retour à la connexion</Link>}
      >
        <div className="flex gap-3">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm">
            Nous avons envoyé un lien de confirmation à <strong className="[overflow-wrap:anywhere]">{sentTo}</strong>. Ouvrez-le
            pour activer votre compte. Pensez à regarder dans vos courriers indésirables.
          </p>
        </div>
        <ResendConfirmation email={sentTo} startWithCooldown />
        <Button type="button" variant="ghost" onClick={() => setSentTo(null)}>Modifier l'adresse e-mail</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Créer un compte"
      description="Créez votre compte Monibook pour lancer vos projets."
      footer={<>Vous avez déjà un compte ? <Link to="/connexion" className={linkClass}>Se connecter</Link></>}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FieldGroup>
          <Field data-invalid={!!errors.displayName}>
            <FieldLabel htmlFor="displayName">Votre nom</FieldLabel>
            <Input
              id="displayName"
              autoComplete="name"
              aria-invalid={!!errors.displayName}
              {...form.register("displayName")}
            />
            <FieldDescription>Il apparaîtra comme nom d'auteur sur vos ebooks. Vous pourrez le changer.</FieldDescription>
            <FieldError errors={[errors.displayName]} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Adresse e-mail</FieldLabel>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...form.register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
            <FieldDescription>{PASSWORD_MIN_LENGTH} caractères minimum.</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
        </FieldGroup>
        {serverError && <p className="text-sm text-destructive" role="alert">{serverError}</p>}
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Création du compte…" : "Créer mon compte"}
        </Button>
      </form>
    </AuthLayout>
  );
}
