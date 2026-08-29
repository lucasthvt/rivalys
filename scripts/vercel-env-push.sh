#!/usr/bin/env bash
# Reporte les variables de .env.local vers un environnement Vercel.
#
#   ./scripts/vercel-env-push.sh production
#   ./scripts/vercel-env-push.sh preview
#
# POURQUOI
# --------
# Recopier une quinzaine de variables à la main dans une interface web, c'est une occasion
# de se tromper par variable. Et l'erreur ne se voit pas : le déploiement réussit, et c'est
# une fonctionnalité qui casse plus tard — un paiement qui n'aboutit pas, une analyse qui
# ne part jamais.
#
# Le script n'affiche JAMAIS la valeur d'une variable, seulement son nom. Les valeurs
# passent par l'entrée standard de `vercel env add`, jamais par la ligne de commande (un
# argument serait visible dans l'historique du shell et dans la liste des processus).
#
# Relançable : une variable déjà présente chez Vercel est signalée et laissée telle quelle.
# Pour en remplacer une, la retirer d'abord :  vercel env rm NOM production

set -euo pipefail

TARGET="${1:-production}"
ENV_FILE=".env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier $ENV_FILE introuvable. Lance ce script depuis la racine du projet." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "CLI Vercel absente :  npm i -g vercel" >&2
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "Session Vercel expirée ou absente :  vercel login" >&2
  exit 1
fi

echo "Cible : $TARGET"
echo

added=0
skipped=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Commentaires, lignes vides, et le préfixe `export` toléré dans certains .env
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  line="${line#export }"

  key="${line%%=*}"
  val="${line#*=}"
  key="$(printf '%s' "$key" | tr -d '[:space:]')"

  [[ -z "$key" || "$key" == "$line" ]] && continue

  # Retire une éventuelle paire de guillemets englobants : Vercel stocke la valeur telle
  # quelle, et des guillemets conservés feraient partie du secret.
  if [[ "$val" == \"*\" || "$val" == \'*\' ]]; then
    val="${val:1:${#val}-2}"
  fi

  if printf '%s' "$val" | vercel env add "$key" "$TARGET" >/dev/null 2>&1; then
    echo "  ajoutée   $key"
    added=$((added + 1))
  else
    # Cas normal d'une relance : la variable existe déjà côté Vercel.
    echo "  ignorée   $key (déjà définie, ou refusée par Vercel)"
    skipped=$((skipped + 1))
  fi
done < "$ENV_FILE"

echo
echo "$added ajoutée(s), $skipped ignorée(s)."
echo "Vérifier :  vercel env ls $TARGET"
