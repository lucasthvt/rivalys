import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TESTIMONIAL_LIMITS } from "@/lib/testimonials/limits";

/**
 * POST /api/testimonials — un utilisateur dépose ou met à jour son propre retour.
 *
 * Ce que la route ne fait PAS, et c'est l'essentiel : elle ne publie rien. Elle écrit une
 * ligne avec `published: false`. L'affichage sur la landing demande une seconde décision,
 * prise ailleurs et à la main. Une route publique qui pourrait publier serait une route
 * publique qui pourrait écrire sur la page d'accueil.
 *
 * Body : { quote: string, authorLabel: string, roleLabel?: string, consentPublic: boolean }
 */

export async function GET() {
  return new NextResponse(null, { status: 404 });
}

type Payload = {
  quote?: unknown;
  authorLabel?: unknown;
  roleLabel?: unknown;
  consentPublic?: unknown;
};

/**
 * Nettoyage minimal : on retire les espaces de bord et on refuse ce qui n'est pas une
 * chaîne. Pas d'échappement HTML ici — React échappe déjà à l'affichage, et « assainir »
 * en base abîmerait la phrase de quelqu'un (une apostrophe n'est pas une attaque).
 */
function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function inRange(value: string, { min, max }: { min: number; max: number }) {
  return value.length >= min && value.length <= max;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }

  const quote = readText(body.quote);
  const authorLabel = readText(body.authorLabel);
  const roleLabel = readText(body.roleLabel);

  if (!quote || !inRange(quote, TESTIMONIAL_LIMITS.quote)) {
    return NextResponse.json(
      {
        error: `Le retour doit faire entre ${TESTIMONIAL_LIMITS.quote.min} et ${TESTIMONIAL_LIMITS.quote.max} caractères.`,
      },
      { status: 422 },
    );
  }

  if (!authorLabel || !inRange(authorLabel, TESTIMONIAL_LIMITS.author)) {
    return NextResponse.json(
      {
        error: `Le nom affiché doit faire entre ${TESTIMONIAL_LIMITS.author.min} et ${TESTIMONIAL_LIMITS.author.max} caractères.`,
      },
      { status: 422 },
    );
  }

  if (roleLabel && !inRange(roleLabel, TESTIMONIAL_LIMITS.role)) {
    return NextResponse.json(
      {
        error: `Le contexte doit faire entre ${TESTIMONIAL_LIMITS.role.min} et ${TESTIMONIAL_LIMITS.role.max} caractères.`,
      },
      { status: 422 },
    );
  }

  // Le consentement est un booléen strict, pas une valeur « truthy » : une case cochée est
  // `true`, tout le reste vaut refus. C'est la seule donnée de cette route qu'on aura à
  // produire si quelqu'un demande sur quelle base l'avis a été publié.
  const consentPublic = body.consentPublic === true;

  const { error } = await supabase.from("testimonials").upsert(
    {
      user_id: user.id,
      quote,
      author_label: authorLabel,
      role_label: roleLabel,
      consent_public: consentPublic,
      // Jamais `true` ici. Voir l'en-tête du fichier.
      published: false,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json(
      { error: "Le retour n'a pas pu être enregistré." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, consentPublic });
}
