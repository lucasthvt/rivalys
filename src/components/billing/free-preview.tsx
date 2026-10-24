import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { CATEGORY_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from "@/components/tasks/priority";
import type { FreePreview } from "@/lib/billing/free-preview";

/**
 * L'aperçu gratuit du relevé, sur le tableau de bord d'un compte au palier gratuit.
 *
 * Remplace le mur complet qu'était LockedResults ici. Le raisonnement est celui que la page
 * d'accueil appliquait à son analyse sans compte : un score et un décompte, seuls, se lisent
 * comme des chiffres inventés, et la personne part. Un écart EN CLAIR est la preuve que le
 * relevé porte vraiment sur son site — et c'est précisément ce qui rend crédible l'idée
 * qu'il en reste d'autres.
 *
 * Ce qui reste derrière le mur n'est pas flouté : il n'est PAS ENVOYÉ. Le gabarit ci-dessous
 * ne contient aucune donnée — ni titre, ni description, ni longueur réelle. Seul le nombre
 * de lignes est vrai, et il est déjà annoncé en toutes lettres au-dessus. C'est la règle de
 * LockedResults, et elle tient pour la même raison : un flou CSS reste lisible dans le HTML.
 */
export function FreePreviewPanel({
  preview,
  score,
  competitorLabel,
}: {
  preview: FreePreview;
  /** Dernier score enregistré pour ce face-à-face, ou null si rien n'a encore été analysé. */
  score: number | null;
  competitorLabel: string;
}) {
  return (
    <div className="panel-focal p-6 sm:p-8">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
        Ton relevé · aperçu gratuit
      </p>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-8">
        <p className="flex items-baseline gap-2">
          <span className="font-brand text-[3.5rem] font-bold leading-none tabular-nums text-paper sm:text-[4.5rem]">
            {score ?? "—"}
          </span>
          <span className="font-mono text-base text-mist/60">/100</span>
        </p>

        <dl className="flex gap-7">
          {(["high", "medium", "low"] as const).map((priority) => (
            <div key={priority}>
              <dt className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-1 shrink-0"
                  style={{ backgroundColor: PRIORITY_COLOR[priority] }}
                />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist">
                  {PRIORITY_LABEL[priority]}
                </span>
              </dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-paper">
                {preview.counts[priority]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {preview.featuredGap ? (
        <>
          {/*
            L'intitulé nomme exactement lequel des écarts est montré, et il doit suivre le
            tri de buildFreePreview. Le jour où ce tri change, cette phrase devient un
            mensonge silencieux sur l'écran d'un produit qui vend la justesse d'un relevé.
          */}
          <p className="mt-10 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
            Ton écart le plus prioritaire
          </p>
          <div className="panel mt-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 border border-white/[0.12] px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist">
                <span
                  aria-hidden
                  className="h-2.5 w-1 shrink-0"
                  style={{ backgroundColor: PRIORITY_COLOR[preview.featuredGap.priority] }}
                />
                {PRIORITY_LABEL[preview.featuredGap.priority]}
              </span>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/70">
                {CATEGORY_LABEL[preview.featuredGap.category]}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-medium leading-snug text-paper">
              {preview.featuredGap.title}
            </h3>
            <p className="mt-2 leading-relaxed text-mist">{preview.featuredGap.description}</p>
          </div>
        </>
      ) : (
        <p className="mt-8 max-w-xl leading-relaxed text-mist">
          Aucune règle ne s&apos;est déclenchée face à {competitorLabel} : sur ce
          qu&apos;on sait mesurer, vous êtes alignés.
        </p>
      )}

      {preview.hiddenCount > 0 && <Locked preview={preview} />}
    </div>
  );
}

function Locked({ preview }: { preview: FreePreview }) {
  const count = preview.hiddenCount;
  const categories = preview.hiddenCategories
    .map((category) => CATEGORY_LABEL[category])
    .filter(Boolean);
  const hiddenHigh = preview.hiddenCounts.high;

  return (
    <div className="mt-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
        {count} autre{count > 1 ? "s" : ""} écart{count > 1 ? "s" : ""} relevé
        {count > 1 ? "s" : ""}
      </p>

      <div className="relative mt-4">
        <div
          className="pointer-events-none min-h-[15rem] select-none blur-[6px] saturate-50"
          aria-hidden="true"
        >
          <div className="grid gap-3">
            {Array.from({ length: Math.min(count, 4) }).map((_, index) => (
              <div key={index} className="panel p-5">
                <div className="h-2.5 w-24 rounded-full bg-white/[0.09]" />
                <div className="mt-4 h-3.5 w-3/4 rounded-full bg-white/[0.07]" />
                <div className="mt-2.5 h-3 w-full rounded-full bg-white/[0.05]" />
                <div className="mt-2 h-3 w-2/3 rounded-full bg-white/[0.05]" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="panel max-w-md px-6 py-7 text-center backdrop-blur-sm">
            {/*
              Le décompte vient de hiddenCounts, calculé sur les écarts réellement masqués :
              c'est la seule information du bloc qui pousse à payer, elle doit donc être
              exacte. Un « 2 écarts prioritaires » affiché alors qu'il n'y en a qu'un
              transformerait le levier en approximation vendeuse.

              « Autre » et non « le plus prioritaire » : celui-là est déjà affiché en clair
              juste au-dessus. Les écarts cachés peuvent être de priorité haute eux aussi,
              mais aucun n'est LE plus grave — le dire contredirait l'intitulé de la carte
              précédente à trois centimètres d'écart.
            */}
            <h3 className="font-brand text-xl text-paper">
              {hiddenHigh === 0
                ? "Le reste de ton relevé t'attend"
                : hiddenHigh === 1
                  ? "Un autre écart prioritaire est ici"
                  : `${hiddenHigh} autres écarts prioritaires sont ici`}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              {categories.length > 0 &&
                (count > 1
                  ? `Ils touchent ${categories.join(", ").toLowerCase()}. `
                  : `Il touche ${categories[0].toLowerCase()}. `)}
              Ouvre une offre payante pour {count > 1 ? "les" : "le"} lire,{" "}
              {count > 1 ? "les" : "le"} cocher au fur et à mesure, et voir ton score
              remonter.
            </p>
            <Link
              href="/tarifs"
              className={`${buttonVariants({ variant: "primary", size: "md" })} mt-6`}
            >
              Voir tout mon relevé
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
