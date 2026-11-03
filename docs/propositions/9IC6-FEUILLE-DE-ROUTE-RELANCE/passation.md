# 9IC6-FEUILLE-DE-ROUTE-RELANCE — passation

## Mesure de départ (point 1)

```
$ git log origin/main --oneline | grep -E "^[0-9a-f]+ (9I00|9IA1)-"
ad65dcd60 9IA1-REPRISE-9IA — point 6 : passation
df2fb07e0 9IA1-REPRISE-9IA — point 5 : D226 complétée pour la réinitialisation du second facteur
6d569714c 9IA1-REPRISE-9IA — point 4 : captures de l'exclusivité D226
b94958fbe 9IA1-REPRISE-9IA — point 3 : épreuves de l'exclusivité D226
7b1467cae 9IA1-REPRISE-9IA — point 2 : bouton masqué pour un compte partagé
f04fa54ad 9IA1-REPRISE-9IA — point 1 : exclusivité D226 sur la réinitialisation du second facteur
24f9482f9 9I00-INSTALLATION-APPLICATION — verify:full : journal (interrompu par le budget de temps)
3422234e6 9I00-INSTALLATION-APPLICATION — point 6 : passation
b73aa3aab 9I00-INSTALLATION-APPLICATION — point 6 (partiel) : épreuves bout en bout
6f3b497da 9I00-INSTALLATION-APPLICATION — point 4 (affiche) : poster QR imprimable
a52340559 9I00-INSTALLATION-APPLICATION — point 4 (page) : /installer, sans session
afa6d00af 9I00-INSTALLATION-APPLICATION — point 3 : étape après le premier accès
0bb352acf 9I00-INSTALLATION-APPLICATION — point 2 : bouton « Installer CODIPLAN »
26b2dd327 9I00-INSTALLATION-APPLICATION — point 1 : détection de l'état d'installation
```

**9I00 et 9IA1 sont tous les deux publiés** sur `origin/main` (confondu avec
`HEAD` de ce worktree au démarrage, `bb7f155eb`). Branche : `main` était
extrait dans un autre worktree (`/home/aplou/codiplan`), donc ce lot a
tourné sur une branche dédiée `9IC6-feuille-de-route-relance`, créée depuis
`origin/main` (= `HEAD`, identiques).

Conséquence sur le point 2c de la consigne : 9I00 et 9IA1 vont dans
« Livré depuis le 31/10 », pas en tête de « Déjà écrits, en attente ».

## `lib/feuille-de-route/contenu.ts` (point 2)

- `DATE_ETAT_FEUILLE_DE_ROUTE` → `"03/11/2026"`.
- Sections supprimées : « En cours » (9IC livré) et « À la relance de
  mardi (après la démo), en premier » (9I00 et 9IA1 publiés).
- « Livré depuis le 31/10 » : quatre éléments `livre` ajoutés à la suite
  des huit déjà présents — « Installer l'application sur le téléphone. »,
  « Réinitialisation du second facteur interdite sur une personne qui a
  aussi accès à une autre société. », puis les deux éléments demandés au
  point 2d (correctifs courts issus des revues ; page « Feuille de route »
  réservée aux administrateurs).
- « À écrire après la démo » : un élément `a_ecrire` ajouté en dernier —
  « Équipement de prêt » (demande verbatim d'Alexis du 03/11 ~10:00 ;
  rangé en Version 2 au cahier des charges §3.2).
- Rien d'autre changé : textes existants, types, en-tête du fichier, page,
  menu, `lib/i18n/fr.ts` intacts.

### Index après édition et épreuve `[1]`

Après suppression des deux premières sections, l'ordre devient :
`[0] Déjà écrits, en attente` · `[1] À écrire après la démo` ·
`[2] Réserves des revues, à regrouper` · `[3] Décisions en attente` ·
`[4] Bloquants extérieurs` · `[5] Livré depuis le 31/10`.

`tests/e2e/9ic5-feuille-de-route.spec.ts:41` lit `[1].titre` comme titre de
section rendu — devenu « À écrire après la démo ». Aucun badge de statut
affiché sur la page ne porte ce texte exact (le badge de ses propres
éléments affiche « À écrire », pas « À écrire après la démo ») : pas de
coïncidence, l'épreuve reste verte sans y toucher.

## Épreuves rejouées (point 3)

- `CI=1 pnpm exec playwright test tests/e2e/9ic5-feuille-de-route.spec.ts --workers=1`
  → 3 passed.
- `CI=1 pnpm exec playwright test tests/e2e/tous-les-ecrans-rendent.spec.ts --workers=1 -g "/feuille-de-route rend 200"`
  → 1 passed.
- `CI=1 pnpm verify` (format:check + typecheck + lint + test + test:isolation + build)
  → vert, exit 0. `pnpm test` : 498 fichiers, 5478 tests, tous passés.
  `verify:full` n'a PAS été joué (consigne du lot : la file le joue après).

## Captures (point 4)

Prises via un spec Playwright **temporaire**, créé puis supprimé avant de
rendre la main (`tests/e2e/_tmp-captures-9ic6.spec.ts`, jamais commité,
jamais laissé sur le disque) — le territoire exclut `tests/**` sans aucune
ligne, et le spec existant `captures-9ic5-feuille-de-route.spec.ts` a un
dossier de sortie figé en dur sur l'autre ticket. `git status --porcelain`
confirmé vide sur `tests/` après coup.

- `docs/propositions/9IC6-FEUILLE-DE-ROUTE-RELANCE/captures/page-1280.png` — 133 443 octets.
- `docs/propositions/9IC6-FEUILLE-DE-ROUTE-RELANCE/captures/page-375.png` — 50 119 octets.

## Territoire respecté

Seuls modifiés : `lib/feuille-de-route/contenu.ts` et
`docs/propositions/9IC6-FEUILLE-DE-ROUTE-RELANCE/`. Aucune ligne dans
`tests/**`, `lib/feuille-de-route/acces.ts`, `lib/navigation/**`,
`lib/auth/**`, `lib/i18n/fr.ts`, aucune migration, `CLAUDE.md` non touché.
Aucun montant, prix, donnée de production ni dépendance nouvelle.
