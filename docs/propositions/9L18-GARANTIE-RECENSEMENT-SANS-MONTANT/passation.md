# 9L18-GARANTIE-RECENSEMENT-SANS-MONTANT — passation

Démarré le 18/11/2026 à 23:27 (Nouméa), budget 90 min.

## La règle tenue

Chapitre 10 du cahier des charges :

- **RG-INT-09** — une intervention de type `garantie` ne génère aucun
  montant CLIENT (elle reste valorisée AU COÛT pour le suivi de
  rentabilité — voir « ce qui n'a pas été construit » plus bas) ;
- **RG-INT-11** — une intervention de type `recensement` ne génère ni
  montant ni engagement de délai, mais produit une fiche de restitution
  client.

Les deux se traitent IDENTIQUEMENT pour ce ticket, comme le déclencheur
D8 (`intervention_facturation_a_la_cloture`) les traite déjà
identiquement pour `statut_facturation` (`non_facturable` pour les deux,
sans distinction).

## Ce qui a été mesuré

Sur `81894e0`, une intervention de type `garantie` ou `recensement` se
clôturait exactement comme n'importe quel autre type : `cloturerIntervention`
(`lib/interventions/depot.ts`) écrivait `montant_ht`/`devise_code` depuis
`valorisation.totalHT`, la fiche (onglet Valorisation) affichait ce total
à qui a le droit de voir les montants, et le bon — client comme interne —
composait ses « Conditions de facturation » depuis le `mode_valorisation`
de la ligne (`lignesConditionsFacturation`), rendant par exemple
« Main-d'œuvre facturée au temps passé. » — la phrase que ce ticket cite.

## Ce qui est livré

### Point 1 — plus aucun montant client, une mention à la place

- `lib/tarification/conditions.ts` — deux fonctions neuves,
  `estSansMontantClient(type)` (vrai pour `garantie` et `recensement`,
  et eux seuls) et `mentionNonFacturee(type)` (la phrase exacte du bon,
  par type). `conditionsDeFacturation` elle-même n'est pas touchée — la
  mention la REMPLACE, elle ne s'y ajoute jamais.
- `lib/interventions/depot.ts` :
  - `cloturerIntervention` sélectionne désormais `type` et force
    `montant_ht`/`devise_code` à `NULL` pour ces deux types, quel que
    soit `valorisation.totalHT` calculé par ailleurs.
  - `lignesConditionsFacturation` prend `type` dans son paramètre `ligne`
    et rend `[mentionNonFacturee(type)]`, AVANT même de regarder si une
    décomposition est figée — ces deux types n'en ont jamais eu besoin
    pour le dire. Seul appel existant touché : `tests/isolation/
    bon-intervention.test.ts` (ajout de `type: "curatif"` au décor).
- `lib/interventions/bon.ts`, `composerBon` : `taux`, `forfaitMontant` et
  `montantTotal` sont remis à `null` pour ces deux types, PAR-DESSUS les
  trois issues existantes (figée / ancienne / calculée en direct).
- Affichage : la tuile « Valorisation » de la fiche
  (`app/(back-office)/interventions/[id]/page.tsx`) et la tuile interne du
  bon (`app/(back-office)/interventions/[id]/bon/page.tsx`) rendent la
  mention à la place du bloc habituel — avant même le droit aux montants,
  qui ne tranche pas cette question : la mention ne révèle aucun montant.
  La version CLIENT du bon n'avait de toute façon jamais de montant à
  masquer (9I8B) ; seules ses « Conditions de facturation » changent, via
  `lignesConditionsFacturation` ci-dessus.
- Deux clés neuves dans `lib/i18n/fr.ts` :
  `tarification.conditions.non_facturable.garantie` et `.recensement`.

### Point 2 — épreuves

- `tests/unit/tarification/conditions.test.ts` : `estSansMontantClient`
  sur les neuf types (vrai pour les deux, faux pour les sept autres) et
  `mentionNonFacturee` (phrase exacte, aucun chiffre ni symbole de devise).
- `tests/isolation/valorisation-intervention.test.ts` : une clôture
  `garantie` et une `recensement`, même décor qu'un témoin `curatif`
  (taux et forfait posés, créneau dans l'ouverture) — `montant_ht` et
  `devise_code` valent `NULL` à l'écriture ET à la relecture par la
  fiche ; le témoin `curatif`, lui, écrit bien un montant non nul.
- `tests/isolation/bon-intervention.test.ts` : même décor, le bon rend
  `taux`/`forfaitMontant`/`montantTotal` à `null` et
  `conditionsFacturation` à la seule mention, pour les deux types.
- `pnpm test` (5984 tests) et `pnpm test:isolation` (2311 tests) passent.
  `pnpm typecheck`, `pnpm lint`, `pnpm format:check` sans erreur ni
  avertissement.

### Point 3 — épreuve de bout en bout et captures

`tests/e2e/captures-9l18-garantie-recensement-sans-montant.spec.ts` — sa
propre scène (une intervention `garantie` close, un compte portail
invité), vérifie la mention sur la fiche, le bon interne (deux fois : la
tuile Valorisation ET les Conditions de facturation) et le bon du
portail, puis capture les trois à 375 et 1280 px dans
`docs/propositions/9L18-GARANTIE-RECENSEMENT-SANS-MONTANT/captures/`.

**AVANT non capturé, et ce n'est pas un oubli** : le correctif écarte ces
deux types PAR LE TYPE, avant même de regarder ce que la base porte —
aucune donnée insérée sous l'arbre CORRIGÉ ne peut donc reproduire l'état
d'avant (un total affiché, la phrase « facturée au temps passé »). Seul
l'APRÈS est versé.

Deux e2e déjà existants rejoués pour écarter une régression :
`tests/e2e/9i8b-conditions-de-facturation-sans-montant.spec.ts` et
`tests/e2e/bon-intervention.spec.ts` — tous deux verts (ils ne portent
que des types facturables, inchangés par ce ticket).

## Ce qui n'a pas été construit, et pourquoi

**La seconde moitié de RG-INT-09** — *« mais est valorisée au coût pour
le suivi de rentabilité »* — n'est PAS construite ici. Ce ticket écarte
le montant CLIENT (`montant_ht`/`devise_code`, et tout ce qui en dérive à
l'écran) ; il ne construit aucune mesure de COÛT distincte, parce
qu'aucune colonne ni aucun écran ne la consomme aujourd'hui — en bâtir
une sans consommateur serait une fonctionnalité devinée, pas demandée.
`valorisation_figee` continue d'être écrite normalement pour CES DEUX
TYPES AUSSI (la décomposition que `cloturerIntervention` calcule de
toute façon) : elle reste disponible, intacte, le jour où un « suivi de
rentabilité » voudra la lire — rien de ce ticket ne la lui retire. Ce
qui reste utile en interne AUJOURD'HUI est le temps validé
(`temps_valide_min`/`temps_mesure_min`), inchangé par ce ticket et déjà
affiché sur la fiche (onglet Temps).

**Aucune migration** — rien ne manquait au schéma : `montant_ht` et
`devise_code` étaient déjà nullables (L2-09a), et le déclencheur D8
traitait déjà ces deux types à part pour `statut_facturation`.

**Aucun arbitrage neuf dans `docs/arbitrages.md`** — RG-INT-09 et
RG-INT-11 disent déjà la règle, mot pour mot, au chapitre 10 depuis
l'origine. Ce ticket corrige un défaut du code face à une règle déjà
tranchée ; il ne tranche rien de nouveau.
