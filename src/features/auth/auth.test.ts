import { describe, expect, it } from "vitest";
import { readLinkError, signInErrorMessage, signUpErrorMessage } from "./auth-messages";
import { SignupSchema } from "./signup-schema";

describe("signup form", () => {
  it("cleans the name and the e-mail address", () => {
    const parsed = SignupSchema.parse({ displayName: "  Awa Diallo ", email: " Awa@Exemple.SN ", password: "motdepasse" });
    expect(parsed).toEqual({ displayName: "Awa Diallo", email: "awa@exemple.sn", password: "motdepasse" });
  });

  it("explains each invalid field in French", () => {
    const result = SignupSchema.safeParse({ displayName: " A ", email: "awa@", password: "court" });
    expect(result.success).toBe(false);
    const messages = Object.fromEntries(result.error!.issues.map((issue) => [issue.path[0], issue.message]));
    expect(messages).toEqual({
      displayName: "Indiquez votre nom (2 caractères minimum).",
      email: "Cette adresse e-mail n'est pas valide.",
      password: "Choisissez un mot de passe d'au moins 8 caractères.",
    });
  });

  it("keeps the password exactly as typed", () => {
    const parsed = SignupSchema.parse({ displayName: "Awa", email: "a@b.sn", password: " espace inclus " });
    expect(parsed.password).toBe(" espace inclus ");
  });
});

describe("authentication messages", () => {
  it("translates the known refusals", () => {
    expect(signUpErrorMessage("user_already_exists")).toBe("Un compte existe déjà avec cette adresse. Connectez-vous.");
    expect(signUpErrorMessage("weak_password")).toContain("trop faible");
    expect(signUpErrorMessage("over_email_send_rate_limit")).toContain("Patientez");
    expect(signInErrorMessage("invalid_credentials")).toBe("Adresse e-mail ou mot de passe incorrect.");
    expect(signInErrorMessage("email_not_confirmed")).toContain("pas encore confirmée");
  });

  it("falls back to a French message for anything else", () => {
    expect(signUpErrorMessage(undefined)).toBe("L'inscription n'a pas abouti. Vérifiez votre connexion, puis réessayez.");
    expect(signInErrorMessage("unexpected_failure")).toContain("Connexion impossible");
  });

  it("reads an expired link from the address fragment", () => {
    expect(readLinkError("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")).toBe(
      "otp_expired",
    );
    expect(readLinkError("#access_token=abc&type=signup")).toBeNull();
    expect(readLinkError("")).toBeNull();
  });
});
