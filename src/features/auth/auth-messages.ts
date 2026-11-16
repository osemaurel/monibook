const RATE_LIMITED = "Trop de demandes en peu de temps. Patientez quelques minutes, puis réessayez.";

/** French message for a signup refused by the authentication service, from its error code. */
export function signUpErrorMessage(code: string | undefined): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cette adresse. Connectez-vous.";
    case "weak_password":
      return "Ce mot de passe est trop faible ou trop courant. Choisissez-en un autre.";
    case "email_address_invalid":
    case "validation_failed":
      return "Cette adresse e-mail n'est pas acceptée. Vérifiez-la ou utilisez-en une autre.";
    case "email_address_not_authorized":
      return "L'e-mail de confirmation n'a pas pu être envoyé à cette adresse. Réessayez plus tard.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return RATE_LIMITED;
    case "signup_disabled":
      return "Les inscriptions sont fermées pour le moment.";
    default:
      return "L'inscription n'a pas abouti. Vérifiez votre connexion, puis réessayez.";
  }
}

/** French message for a refused sign-in. `email_not_confirmed` is handled apart: it offers a new link. */
export function signInErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Adresse e-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail, ou demandez-en un nouveau.";
    case "over_request_rate_limit":
      return RATE_LIMITED;
    default:
      return "Connexion impossible pour le moment. Vérifiez votre connexion, puis réessayez.";
  }
}

export function resendErrorMessage(code: string | undefined): string {
  return code === "over_email_send_rate_limit" || code === "over_request_rate_limit"
    ? RATE_LIMITED
    : "L'e-mail n'a pas pu être renvoyé. Réessayez dans quelques minutes.";
}

/**
 * When a confirmation link has expired or was already used, the authentication service sends
 * the visitor back with the error in the address fragment (#error=…&error_code=…).
 */
export function readLinkError(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("error_code") ?? params.get("error");
}
