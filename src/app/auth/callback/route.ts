import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Only follow `next` when it's an internal relative path — basic
 * anti-open-redirect, mirroring the same guard on /login.
 */
function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * Google OAuth return URL. Supabase sends the browser back here with a
 * one-time `code`, which we exchange for a session cookie before routing
 * the founder to onboarding or the dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const nextPath = sanitizeNextPath(searchParams.get("next"));

  // Behind Vercel's proxy `request.nextUrl.origin` is the internal host, so
  // build redirects from the forwarded host when there is one.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin =
    forwardedHost && process.env.NODE_ENV !== "development"
      ? `https://${forwardedHost}`
      : request.nextUrl.origin;

  const failure = new URL("/login", origin);
  failure.searchParams.set("error", "oauth");
  if (nextPath) failure.searchParams.set("next", nextPath);

  // The provider itself refused (user cancelled, app misconfigured, ...).
  if (searchParams.get("error") || !code) {
    return NextResponse.redirect(failure);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(failure);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", data.user.id)
    .maybeSingle();

  // Same rule as password login: onboarding first, `next` only once done.
  // A brand-new OAuth account has no profile row at all, so it lands on
  // /onboarding — which is what creates it.
  const destination = profile?.onboarding_completed ? (nextPath ?? "/dashboard") : "/onboarding";

  return NextResponse.redirect(new URL(destination, origin));
}
