// Kept apart from auth-messages so the validation library only loads with the signup screen.
import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

export const SignupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Indiquez votre nom (2 caractères minimum).")
    .max(100, "Votre nom ne peut pas dépasser 100 caractères."),
  email: z.string().trim().toLowerCase().pipe(z.email("Cette adresse e-mail n'est pas valide.")),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Choisissez un mot de passe d'au moins ${PASSWORD_MIN_LENGTH} caractères.`)
    .max(72, "Votre mot de passe ne peut pas dépasser 72 caractères."),
});

export type SignupInput = z.input<typeof SignupSchema>;
export type SignupValues = z.output<typeof SignupSchema>;
