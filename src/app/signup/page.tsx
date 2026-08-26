"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthMapPanel } from "../login/_components/AuthMapPanel";
import {
  AuthField,
  authErrorBox,
  authInfoBox,
  authPrimaryButton,
} from "../login/_components/AuthField";

function mapSignupError(message: string): string {
  if (message.includes("Password should be at least")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  if (message.includes("Unable to validate email")) {
    return "Cet email ne semble pas valide.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Un compte existe déjà avec cet email — connecte-toi plutôt.";
  }
  return "Impossible de créer ton compte pour le moment. Réessaie dans un instant.";
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(mapSignupError(signUpError.message));
      setLoading(false);
      return;
    }

    // Supabase returns a user with an empty identities array (no error) when
    // the email is already registered — a deliberate anti-enumeration
    // behavior, so we detect it explicitly here.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("Un compte existe déjà avec cet email — connecte-toi plutôt.");
      setLoading(false);
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
            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
              {error ? (
                <p className={authErrorBox} role="alert">
                  {error}
                </p>
              ) : null}

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

              <AuthField
                id="password"
                label="Mot de passe"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6 caractères minimum"
              />

              <button type="submit" className={`${authPrimaryButton} mt-2`} disabled={loading}>
                {loading ? "Création..." : "Créer mon compte"}
              </button>
            </form>
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
