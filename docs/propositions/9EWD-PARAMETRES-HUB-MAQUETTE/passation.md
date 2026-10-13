# 9EWD-PARAMETRES-HUB-MAQUETTE — passation

## Ce qui est livré

1. **Icônes** `briefcase` et `layers` (`components/ui/icone.tsx`), transcrites depuis `ICONS` de la maquette
   (:1693, :1687) — gardien `tests/unit/ui/icone.test.tsx` vert sans modification (il itère `NOMS_ICONES`).
2. **Portes** (`lib/navigation/portes-parametrage.ts`) : chaque porte porte désormais une `icone`, dans l'ordre
   et les sections de la maquette (M:4381-4395). **Prestations rejoint Planification** (amende D167). La
   doctrine « aucun décompte » de R3-05/D88 est levée pour ce hub (décision n° 97 d'Alexis) — voir D201,
   `docs/arbitrages.md`.
3. **Décomptes** (`lib/navigation/decomptes-parametrage.ts`, neuf) : une pastille par porte ouverte, lue
   séparément de la porte. Trois lectures extraites pour être PARTAGÉES :
   - `compterAgences` (`lib/agences/depot.ts`) ;
   - `compterHabilitationsExpirees` (`lib/tableau-de-bord/lectures.ts`) — remplace le calcul en ligne du
     tableau de bord (`app/(back-office)/tableau-de-bord/page.tsx`), qui l'appelle désormais lui aussi ;
   - `compterZonesSansForfaitDeDeplacement` (`lib/tarification/depot-forfaits.ts`), même logique que
     `phraseSansForfaitDeDeplacement`.
   `decalageUtc` (le « UTC+11 » de la carte Identité) rejoint `lib/calendar/fuseau.ts`, seul point de passage
   autorisé pour `Intl.DateTimeFormat`/`new Date()` — l'avoir d'abord posé dans `lib/societes/identite.ts` a
   fait rougir `tests/unit/calendar/sans-date-courante-implicite.test.ts` et `sans-fuseau-en-dur.test.ts` ;
   corrigé avant tout commit.
4. **Page** (`app/(back-office)/parametres/page.tsx`) : surtitre, sous-titre, carte « Identité de la société »
   (badge, sigle dérivé des initiales — `sigleDeLaRaisonSociale`, `lib/societes/identite.ts` —, phrase de
   réglage, devise en clair avec ses décimales, fuseau avec son décalage UTC, note), sections avec sous-titre
   en colonne-titre | grille, portes en carte à icône + pastille.
5. **Épreuves** : `9dq-tp-nav1-hub-agences.spec.ts` adapté (le badge devait rester DANS le `<h2>`, sinon son
   parent — lu par le test via `.locator("..")` — cesse de porter le reste de la carte ; la raison sociale
   apparaît maintenant deux fois, `.first()` plutôt qu'un `getByText` ambigu ; la devise se lit en libellé
   complet). `droits-rm-rs.spec.ts`, `taux-horaire-succession.spec.ts`, `retour-parametres.spec.ts`,
   `equipe.spec.ts`, `habilitations.spec.ts`, `tous-les-ecrans-rendent.spec.ts` rejoués SANS modification,
   tous verts. Scène neuve `tests/e2e/9ewd-parametres-hub-maquette.spec.ts` (4 scénarios) : un décompte
   orange (Imports) mène à la liste exacte qu'il compte sans dupliquer le `href` de sa porte ; une pastille
   neutre (Prestations) reste grise et hors lien ; une porte fermée (RM, Équipe) n'a ni carte ni pastille ;
   captures 1280/375 de l'admin et de RM (`docs/propositions/9EWD-PARAMETRES-HUB-MAQUETTE/captures/`).
6. **Doc** : D201 (`docs/arbitrages.md`), amendant D167 et marquant la levée de R3-05/D88 pour ce hub.

## Écarts gardés, nommés dans D201

- Deux portes « Taux horaire »/« Forfaits » plutôt qu'une page « Tarifs » fusionnée (lot 9EWD-2, questions
  encore ouvertes sur le gabarit).
- Aucune porte « Journal d'audit » — l'écran n'existe pas.
- Les décomptes de Forfaits et de Données à compléter portent un `href` différent de leur porte
  (`?vue=sans-forfait`, `?vue=a-reprendre`) pour que `a[href=…]` reste un décompte exact
  (`droits-rm-rs.spec.ts`) — ces paramètres sont ignorés sans dommage par les écrans visés.
- « Données à compléter » compte toujours QUATRE points (décision 44 d'Alexis, D189), pas les dix de la
  maquette.
- « Accès à ouvrir » lit la population technicien actuelle (`techniciensAccesAOuvrir`), pas une population
  technicien + bureau partagée (hors territoire de ce lot).

## Hors territoire (inchangé)

`app/(back-office)/parametres/taux-horaire|forfaits/`, `prisma/` (aucune migration), `lib/auth/habilitations.ts`,
`lib/tarification/` (aucun calcul de valorisation), `tests/e2e/setup/scene.ts`.

## Vérification finale

`CI=1 pnpm verify:full` lancé en entier après rebase sur `origin/main` — voir le dernier message de la session
pour les 15 dernières lignes et le `HEAD` exact.
