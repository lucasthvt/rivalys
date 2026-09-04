import { createClient } from "@/lib/supabase/server";

/**
 * Le compte opérateur — nous.
 *
 * Réutilise TEARDOWN_ADMIN_EMAIL plutôt que d'introduire une seconde variable : deux
 * variables pour un seul opérateur produisent tôt ou tard un écran ouvert et l'autre
 * fermé, sans que personne ne s'en aperçoive. Le nom garde une odeur de son premier usage
 * (/teardown) ; c'est le prix d'un seul point de vérité.
 *
 * Non définie = fermé, y compris pour nous. Un secret absent doit fermer la porte, jamais
 * l'ouvrir.
 */
export function operatorEmail(): string | null {
  return process.env.TEARDOWN_ADMIN_EMAIL?.trim().toLowerCase() || null;
}

/** L'email de la session courante, normalisé pour comparaison. */
export async function sessionEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user?.email?.trim().toLowerCase() ?? null;
}

export async function isOperatorSession(): Promise<boolean> {
  const allowed = operatorEmail();
  if (!allowed) return false;
  return (await sessionEmail()) === allowed;
}
