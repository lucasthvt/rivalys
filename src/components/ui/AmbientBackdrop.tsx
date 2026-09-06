/**
 * Le fond ambiant du site — landing et écrans connectés.
 *
 * Partagé plutôt que dupliqué : c'est ce qui fait que passer de la page
 * d'accueil au tableau de bord ne ressemble pas à changer de produit. Il a
 * remplacé `.app-ambient`, un halo `absolute` posé par chaque conteneur de
 * page : deux atmosphères différentes de part et d'autre de la connexion, et
 * un halo qui repartait du haut à chaque écran au lieu de tenir la fenêtre.
 *
 * Trois halos très flous qui dérivent, une grille qui glisse, une vignette qui
 * referme les bords. `fixed` et non `absolute` : le fond ne défile pas avec le
 * contenu, donc les sections passent devant une lumière stable au lieu de
 * traverser une succession de décors — c'est ce qui fait tenir une page longue
 * comme une seule surface.
 *
 * `z-index: -1` le place sous tout le contenu sans le sortir du flux visuel du
 * noir de `body`. Corollaire : aucun ancêtre de cette page ne doit poser un fond
 * opaque, sinon il recouvre le halo (voir le conteneur de page.tsx, laissé
 * transparent pour cette raison).
 *
 * Les animations sont définies dans globals.css et ne démarrent que si le
 * système ne réclame pas moins de mouvement.
 */
export function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void"
    >
      {/*
        Des dégradés radiaux, pas des disques floutés. Un `filter: blur(80px)` sur
        un élément de 70 vw en position fixe force le navigateur à repeindre une
        très grande surface à chaque image de défilement — mesuré ici : la couche
        fixe ne se repeignait plus du tout passé le premier écran. Un dégradé est
        déjà flou par construction et ne coûte rien à composer.
      */}
      <div className="ambient-a absolute -left-[16%] -top-[34%] h-[86vw] w-[86vw] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-signal)_42%,transparent)_0%,color-mix(in_srgb,var(--color-signal)_16%,transparent)_38%,transparent_70%)]" />
      <div className="ambient-b absolute -bottom-[38%] -right-[18%] h-[80vw] w-[80vw] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-signal)_32%,transparent)_0%,color-mix(in_srgb,var(--color-signal)_12%,transparent)_38%,transparent_70%)]" />
      <div className="ambient-c absolute left-[28%] top-[26%] h-[58vw] w-[58vw] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-signal-bright)_18%,transparent)_0%,transparent_66%)]" />

      <div className="ambient-grid absolute -inset-[10%] opacity-50" />

      {/*
        La vignette n'est pas un effet de style : sans elle, les halos gardent la
        même intensité jusqu'au bord de la fenêtre et le texte des sections
        basses perd du contraste là où on le lit le plus longtemps.
      */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_85%_at_50%_45%,transparent_18%,var(--color-void)_100%)]" />
    </div>
  );
}
