import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { resendErrorMessage } from "./auth-messages";

const COOLDOWN_SECONDS = 60;

/** Where the confirmation link brings the user back: the app's home, signed in. */
export function confirmationRedirect(): string {
  return `${window.location.origin}/`;
}

/** Sends the confirmation link again, at most once a minute. */
export function ResendConfirmation({ email, startWithCooldown = false }: { email: string; startWithCooldown?: boolean }) {
  const [wait, setWait] = useState(startWithCooldown ? COOLDOWN_SECONDS : 0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    setPending(true);
    setFeedback(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmationRedirect() },
    });
    setPending(false);
    if (error) return setFeedback({ ok: false, text: resendErrorMessage(error.code) });
    setFeedback({ ok: true, text: "Un nouveau lien vient de vous être envoyé." });
    setWait(COOLDOWN_SECONDS);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" disabled={pending || wait > 0} onClick={resend}>
        {pending ? "Envoi…" : wait > 0 ? `Renvoyer l'e-mail (dans ${wait} s)` : "Renvoyer l'e-mail"}
      </Button>
      {feedback && (
        <p className={feedback.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"} role="status">
          {feedback.text}
        </p>
      )}
    </div>
  );
}
