import Link from "next/link";

/**
 * Le sélecteur de concurrent, en haut des écrans de résultat.
 *
 * Des liens, pas un menu déroulant : chaque concurrent a alors sa propre adresse
 * (`?concurrent=<id>`), donc un signet, un partage et le bouton retour du navigateur
 * fonctionnent. Un sélecteur qui ne change que l'état local rend ces trois gestes muets.
 *
 * Rien n'est rendu tant qu'un seul concurrent est suivi : un sélecteur à une entrée
 * n'offre aucun choix, il ne fait qu'annoncer une fonctionnalité que le palier n'ouvre pas.
 */
export function CompetitorSwitcher({
  competitors,
  selectedId,
  basePath,
}: {
  competitors: { id: string; label: string }[];
  selectedId: string;
  /** Chemin de l'écran courant — la sélection reste sur la page qu'on lit. */
  basePath: string;
}) {
  if (competitors.length < 2) return null;

  return (
    <nav aria-label="Concurrent affiché" className="mb-8 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">
        Face à
      </span>
      {competitors.map((competitor) => {
        const selected = competitor.id === selectedId;
        return (
          <Link
            key={competitor.id}
            href={`${basePath}?concurrent=${competitor.id}`}
            aria-current={selected ? "page" : undefined}
            className={`inline-flex max-w-[16rem] items-center rounded-full border px-3.5 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] transition-colors ${
              selected
                ? "border-signal-bright/45 bg-signal/15 text-paper"
                : "border-white/[0.14] text-mist hover:border-signal-bright/40 hover:text-paper"
            }`}
          >
            <span className="truncate">{competitor.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
