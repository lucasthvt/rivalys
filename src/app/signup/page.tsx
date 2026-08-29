"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthMapPanel } from "../login/_components/AuthMapPanel";
import {
  AuthField,
  authErrorBox,
  authInfoBox,
  authPrimaryButton,
} from "../login/_components/AuthField";
import { AuthDivider, OAuthButtons } from "../login/_components/OAuthButtons";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  isPasswordAcceptable,
} from "@/lib/auth/password";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";
import { isTurnstileEnabled } from "@/lib/auth/turnstile";

function mapSignupError(message: string): string {
  if (message.includes("Password should be at least") || message.includes("weak")) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, avec majuscule, minuscule, chiffre et caractère spécial.`;
  }
  if (message.includes("Unable to validate email")) {
    return "Cet email ne semble pas valide.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email — connecte-toi plutôt.";
  }
  return "Impossible de créer ton compte pour le moment. Réessaie dans un instant.";
}

const TERMS_REQUIRED = "Accepte les CGU et la politique de confidentialité pour continuer.";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<TurnstileHandle | null>(null);
  const captchaRequired = isTurnstileEnabled();
  const handleCaptchaRef = useCallback((handle: TurnstileHandle | null) => setCaptcha(handle), []);

  const passwordOk = isPasswordAcceptable(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    // Les deux conditions sont revérifiées ici et pas seulement sur le bouton : un
    // `disabled` se retire dans l'inspecteur, une soumission au clavier peut devancer un
    // rendu. Le serveur applique de toute façon sa propre politique de mot de passe.
    if (!termsAccepted) {
      setError(TERMS_REQUIRED);
      return;
    }
    if (!passwordOk) {
      setError(
        `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères, avec majuscule, minuscule, chiffre et caractère spécial.`,
      );
      return;
    }

    if (captchaRequired && !captchaToken) {
      setError("Patiente une seconde, la vérification anti-robot est en cours.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(captchaToken ? { captchaToken } : {}),
        // Trace déclarative de l'acceptation. Ce n'est PAS une preuve opposable — ces
        // métadonnées sont modifiables par l'utilisateur lui-même. La preuve horodatée
        // côté serveur est écrite dans profiles.terms_accepted_at à la fin de
        // l'onboarding, hors de portée du navigateur.
        data: { terms_accepted: true },
      },
    });

    if (signUpError) {
      setError(mapSignupError(signUpError.message));
      setLoading(false);
      // Jeton à usage unique : il faut en redemander un avant la tentative suivante.
      captcha?.reset();
      return;
    }

    // Supabase returns a user with an empty identities array (no error) when
    // the email is already registered — a deliberate anti-enumeration
    // behavior, so we detect it explicitly here.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("Un compte existe déjà avec cet email — connecte-toi plutôt.");
      setLoading(false);
      captcha?.reset();
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }

    // Email confirmation is required before a session exists.
    setInfo("Vérifie ta boîte mail pour confirmer ton compte, puis connecte-toi.");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background lg:grid lg:grid-cols-[0.85fr_1fr]">
      <AuthMapPanel />

      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-signal-bright">
            Créer un compte
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground">
            Commençons.
          </h1>

          {info ? (
            <p className={`${authInfoBox} mt-6`} role="status">
              {info}
            </p>
          ) : (
            <>
              {error ? (
                <p className={`${authErrorBox} mt-8`} role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-8">
                <OAuthButtons
                  onError={setError}
                  disabled={!termsAccepted}
                  disabledReason={TERMS_REQUIRED}
                />
              </div>

              <div className="mt-6">
                <AuthDivider />
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5" noValidate>
                <AuthField
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="toi@exemple.com"
                />

                <div>
                  <AuthField
                    id="password"
                    label="Mot de passe"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={`${PASSWORD_MIN_LENGTH} caractères minimum`}
                    aria-describedby="password-rules"
                  />
                  <PasswordChecklist value={password} />
                </div>

                <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />

                <Turnstile
                  onToken={setCaptchaToken}
                  onError={setError}
                  handleRef={handleCaptchaRef}
                />

                <button
                  type="submit"
                  className={`${authPrimaryButton} mt-2 disabled:cursor-not-allowed disabled:opacity-50`}
                  disabled={
                    loading || !termsAccepted || !passwordOk || (captchaRequired && !captchaToken)
                  }
                >
                  {loading ? "Création..." : "Créer mon compte"}
                </button>
              </form>
            </>
          )}

          <p className="mt-8 text-sm text-foreground-muted">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Ce qui manque au mot de passe, pendant la frappe.
 *
 * Annoncé plutôt que deviné : renvoyer « mot de passe trop faible » après l'envoi, sans
 * dire ce qui manque, pousse les gens à essayer trois variantes du même mot puis à
 * abandonner. La liste reste affichée en entier, les règles satisfaites simplement
 * marquées, pour que l'exigence soit lisible avant la première frappe.
 */
function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul id="password-rules" className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-1 text-[11px] ${
              passed ? "text-signal-bright" : "text-foreground-muted"
            }`}
          >
            <span aria-hidden="true">{passed ? "✓" : "·"}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

function TermsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-foreground-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-signal)]"
        required
      />
      <span>
        J&rsquo;accepte les{" "}
        <Link
          href="/cgu"
          target="_blank"
          className="font-medium text-foreground underline underline-offset-4"
        >
          conditions générales d&rsquo;utilisation
        </Link>{" "}
        et j&rsquo;ai lu la{" "}
        <Link
          href="/confidentialite"
          target="_blank"
          className="font-medium text-foreground underline underline-offset-4"
        >
          politique de confidentialité
        </Link>
        .
      </span>
    </label>
  );
}
