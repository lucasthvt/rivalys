"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthMapPanel } from "./_components/AuthMapPanel";
import { AuthField, authErrorBox, authPrimaryButton } from "./_components/AuthField";

function mapLoginError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (message.includes("Email not confirmed")) {
    return "Confirme ton email avant de te connecter — regarde ta boîte de réception.";
  }
  return "Impossible de te connecter pour le moment. Réessaie dans un instant.";
}

/**
 * Only follow `next` when it's an internal relative path — basic
 * anti-open-redirect. Anything else (absolute URL, protocol-relative
 * `//host/...`, missing) falls back to the caller's own default.
 */
function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(mapLoginError(signInError.message));
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("Impossible de te connecter pour le moment. Réessaie dans un instant.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    // Onboarding always takes priority: never send an unfinished founder to
    // `next` before they've completed it. Once onboarding is done, honor
    // `next` (e.g. set by the middleware redirect from a protected route)
    // when it's present and safe, otherwise fall back to the dashboard.
    if (!profile?.onboarding_completed) {
      router.push("/onboarding");
    } else {
      const nextPath = sanitizeNextPath(searchParams.get("next"));
      router.push(nextPath ?? "/dashboard");
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background lg:grid lg:grid-cols-[0.85fr_1fr]">
      <AuthMapPanel />

      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-signal-bright">
            Connexion
          </p>
          <h1 className="mt-2 font-display text-3xl text-foreground">
            Content de te revoir.
          </h1>

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
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />

            <button type="submit" className={`${authPrimaryButton} mt-2`} disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="mt-8 text-sm text-foreground-muted">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary — see
  // https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout.
  // No visible fallback needed: the form itself is tiny and this only
  // matters for the brief static-shell prerender pass, not real navigation.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
