import { createClient } from "@/lib/supabase/server";
import type { Testimonial } from "@/components/landing/testimonials";

/**
 * Les avis affichés sur la landing.
 *
 * La policy `testimonials_select_published` ne laisse sortir que les lignes doublement
 * validées (accord de la personne ET publication de notre côté) ; ce filtre explicite
 * dit la même chose côté application. Redondant à dessein : si la policy est un jour
 * relâchée par erreur, la requête ne se met pas à publier des brouillons en silence.
 */
export async function fetchPublishedTestimonials(): Promise<Testimonial[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("testimonials")
    .select("quote, author_label, role_label")
    .eq("published", true)
    .eq("consent_public", true)
    .order("created_at", { ascending: false })
    .limit(12);

  // Une bande d'avis n'est pas une fonction vitale de la page : si la lecture échoue, la
  // landing s'affiche sans elle. Faire tomber la page d'accueil pour ça serait un très
  // mauvais échange.
  if (error || !data) return [];

  return data.map((row) => ({
    quote: row.quote,
    author: row.author_label,
    role: row.role_label ?? undefined,
  }));
}

/** L'avis de l'utilisateur courant, s'il en a déjà écrit un. */
export async function fetchOwnTestimonial(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("testimonials")
    .select("quote, author_label, role_label, consent_public, published")
    .eq("user_id", userId)
    .maybeSingle();

  return data ?? null;
}
