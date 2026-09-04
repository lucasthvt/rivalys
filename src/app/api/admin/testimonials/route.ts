import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isOperatorSession } from "@/lib/admin/operator";

/**
 * PATCH /api/admin/testimonials — publie ou dépublie un avis.
 *
 * Passe par le client de service, et c'est obligatoire : la RLS ne laisse un utilisateur
 * toucher que sa propre ligne, et le trigger `testimonials_guard_publication` refuse de
 * toute façon qu'il allume `published` lui-même. Publier est une action d'opérateur, pas
 * d'utilisateur — le schéma est construit pour que ce soit vrai même si cette route
 * disparaissait.
 *
 * Body : { id: string, published: boolean }
 */

export async function GET() {
  return new NextResponse(null, { status: 404 });
}

export async function PATCH(request: Request) {
  // 404 et non 403 : un 403 confirmerait que la route existe. Même choix que
  // /api/teardown — une surface d'administration doit être indiscernable du néant.
  if (!(await isOperatorSession())) {
    return new NextResponse(null, { status: 404 });
  }

  let body: { id?: unknown; published?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "Identifiant manquant." }, { status: 422 });
  }

  // Booléen strict : « publier » et « dépublier » sont deux gestes distincts, et une
  // valeur ambiguë ne doit pas décider à notre place laquelle des deux on voulait.
  if (typeof body.published !== "boolean") {
    return NextResponse.json(
      { error: "Le champ `published` doit valoir true ou false." },
      { status: 422 },
    );
  }
  const published = body.published;

  const service = createServiceClient();

  // On relit la ligne avant d'écrire, pour une raison de fond : publier un avis dont
  // l'accord a été retiré serait une publication sans consentement. La policy de lecture
  // publique le masquerait de toute façon, mais on refuse ici plutôt que de compter sur
  // le filet en aval — et le message dit pourquoi, ce qu'un masquage silencieux ne fait pas.
  const { data: existing, error: readError } = await service
    .from("testimonials")
    .select("consent_public")
    .eq("id", id)
    .maybeSingle();

  if (readError || !existing) {
    return NextResponse.json({ error: "Avis introuvable." }, { status: 404 });
  }

  if (published && !existing.consent_public) {
    return NextResponse.json(
      { error: "Cet avis n'a pas d'accord de publication. Il ne peut pas être affiché." },
      { status: 409 },
    );
  }

  const { error } = await service
    .from("testimonials")
    .update({ published })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "La mise à jour a échoué." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, published });
}
