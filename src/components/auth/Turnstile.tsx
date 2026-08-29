"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TURNSTILE_SCRIPT_URL, turnstileSiteKey } from "@/lib/auth/turnstile";

/**
 * Widget Turnstile, rendu explicitement.
 *
 * Le script est injecté depuis un effet React, pas par une balise `<script src>` dans le
 * JSX. Ce n'est pas un détail de style : la politique de sécurité du contenu du site
 * utilise `strict-dynamic`, qui ignore les listes blanches de domaines et n'autorise que
 * les scripts chargés PAR un script déjà de confiance. Un `document.createElement("script")`
 * exécuté depuis notre bundle (qui porte le nonce) est de confiance ; une balise écrite
 * dans le HTML ne le serait pas et serait bloquée.
 *
 * `render=explicit` plutôt que le rendu automatique : en rendu automatique, Turnstile
 * cherche ses conteneurs au chargement du script, ce qui rate systématiquement un composant
 * monté après coup par React.
 */

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      /** Turnstile passe son code d'erreur en premier argument (ex. "400020"). */
      "error-callback": (errorCode: string) => void;
      theme?: "auto" | "light" | "dark";
      language?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * Charge le script une seule fois par page, même si /login et /signup montent le composant
 * l'un après l'autre lors d'une navigation client.
 */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Une prochaine tentative doit pouvoir recharger le script : sans ça, une coupure
      // réseau passagère condamnerait le formulaire jusqu'au rechargement de la page.
      scriptPromise = null;
      reject(new Error("Chargement du captcha impossible."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Ce que veut dire un code d'erreur Turnstile, en clair.
 *
 * Sans cette table, l'écran affichait « un bloqueur de contenu peut en être la cause » quelle
 * que soit la panne. C'était faux dans le cas le plus fréquent — une clé mal recopiée — et ça
 * envoie chercher le problème là où il n'est pas. Un message d'erreur qui accuse au hasard
 * coûte plus de temps qu'un message générique.
 *
 * Codes : developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
 */
function explainTurnstileError(code: string): string {
  if (code === "400020" || code.startsWith("1101")) {
    return "Clé de site du captcha invalide. Vérifie NEXT_PUBLIC_TURNSTILE_SITE_KEY : c'est la clé « Site Key » de Cloudflare, pas la clé secrète — les deux commencent par 0x4AAAAA.";
  }
  if (code.startsWith("1102")) {
    return "Ce domaine n'est pas autorisé pour ce widget Turnstile. Ajoute-le dans Cloudflare, Turnstile → le widget → Hostname Management.";
  }
  if (code.startsWith("1105")) {
    return "Ce navigateur n'est pas pris en charge par le captcha.";
  }
  if (code.startsWith("1106") || code.startsWith("300") || code.startsWith("600")) {
    return "La vérification anti-robot a échoué. Recharge la page pour réessayer.";
  }
  return `La vérification anti-robot n'a pas abouti (code ${code}).`;
}

export type TurnstileHandle = {
  /** Redemande un jeton neuf. Un jeton Turnstile est à usage unique : après un échec de
   *  connexion, le rejouer serait refusé par Supabase. */
  reset: () => void;
};

export function Turnstile({
  onToken,
  onError,
  handleRef,
}: {
  onToken: (token: string | null) => void;
  onError?: (message: string) => void;
  /** Permet au formulaire parent de réinitialiser le widget après un échec. */
  handleRef?: (handle: TurnstileHandle | null) => void;
}) {
  const siteKey = turnstileSiteKey();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Gardés dans des refs pour que l'effet de montage ne dépende pas de leur identité :
  // sinon chaque rendu du parent démonterait et remonterait le widget, et la personne
  // verrait le captcha se relancer à chaque frappe dans le champ email.
  //
  // Mis à jour dans un effet, jamais pendant le rendu : écrire dans une ref pendant le
  // rendu casse le rendu concurrent de React (le rendu peut être abandonné et rejoué, la
  // ref garderait la valeur d'une passe jetée). Cet effet est déclaré AVANT celui du
  // montage, donc il s'exécute avant lui.
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  });

  const reset = useCallback(() => {
    onTokenRef.current(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (handleRef) handleRef({ reset });
    return () => {
      if (handleRef) handleRef(null);
    };
  }, [handleRef, reset]);

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          language: "fr",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": (errorCode: string) => {
            onTokenRef.current(null);
            setFailure(explainTurnstileError(String(errorCode)));
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        // Ici, et ici seulement, le blocage réseau est une explication plausible : le script
        // lui-même n'est pas arrivé.
        setFailure(
          "Le script du captcha n'a pas pu être chargé. Vérifie ta connexion ou ton bloqueur de contenu.",
        );
        onErrorRef.current?.(
          "Le captcha n'a pas pu se charger. Vérifie ta connexion ou ton bloqueur de contenu.",
        );
      });

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      if (id && window.turnstile) {
        window.turnstile.remove(id);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  // Captcha non configuré (développement local) : rien à afficher, et le formulaire ne doit
  // pas être bloqué pour autant.
  if (!siteKey) return null;

  return (
    <div>
      <div ref={containerRef} />
      {failure ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-flare">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
