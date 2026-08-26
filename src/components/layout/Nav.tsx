import { createClient } from "@/lib/supabase/server";
import { NavBar } from "./NavBar";

/**
 * Common top navigation, mounted once in the root layout so it appears on
 * every route without other agents needing to import it.
 *
 * Server Component: reads the Supabase session so NavBar can swap the
 * signed-out CTAs (Connexion/Commencer) for a "Tableau de bord" link when
 * the visitor is already authenticated — e.g. returning to "/" after
 * logging in shouldn't prompt them to log in again. Route-based hiding
 * (see NavBar's HIDE_NAV_PREFIXES) needs `usePathname`, so that part stays
 * in the client child.
 */
export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <NavBar isAuthenticated={Boolean(user)} />;
}
