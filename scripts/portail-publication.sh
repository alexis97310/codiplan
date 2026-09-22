#!/usr/bin/env bash
# LE PORTAIL DE PUBLICATION (RELEASE-1) — déclaré comme `ignoreCommand` dans
# `vercel.json`. Vercel exécute cette commande AVANT sa propre étape
# d'installation des dépendances (mesuré sur la documentation Vercel,
# non vérifié en conditions réelles faute d'accès à un compte Vercel depuis
# cette session — voir la passation). `pnpm exec tsx` n'existe donc pas
# encore à ce stade : ce script installe lui-même ce dont il a besoin avant
# de déléguer le calcul du verdict à `scripts/portail-publication.mts`.
#
# LE SENS DES CODES DE SORTIE EST CELUI DE VERCEL, PAS CELUI D'UNIX :
#   exit 0 → la construction est ANNULÉE (bloquer)
#   exit 1 → la construction CONTINUE (publier)
# Voir `scripts/lib/portail-publication.ts`, CODE_DE_SORTIE, pour la même
# règle écrite en dur et gardée par un test.
set -uo pipefail

if ! pnpm install --frozen-lockfile; then
  echo "PORTAIL DE PUBLICATION — bloqué : l'installation des dépendances a" \
    "échoué, impossible de vérifier l'état des migrations avant de publier." \
    "Publication refusée par prudence. Pour publier malgré tout :" \
    "FORCER_PUBLICATION_MALGRE_RETARD=oui sur ce déploiement."
  exit 0
fi

pnpm exec tsx scripts/portail-publication.mts
exit $?
