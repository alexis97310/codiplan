# 9EU-SOLDE-FICHE-PLANNING — passation

Budget : T0 09:44, limite 180 min. Gel du code neuf respecté (T0+110 = 11:34) ; le temps restant a
servi à `CI=1 pnpm verify:full` (48,4 min, lancé ~10:45) puis à cette passation.

## Point par point

1. **D83 — phrase d'annulation.** Fait. Clé `intervention.annulation.consequence` (texte exact de la
   décision n° 83), posée sous le titre du dialogue, avant le motif. Assertion ajoutée dans
   `fiche-annuler.spec.ts`. Captures 375/1280.
2. **Solde 159 — refus « Annuler une terminée ».** `peutAnnuler` refusait déjà (9ES-1) mais rien ne le
   mesurait. Épreuve neuve `fiche-annuler-terminee.spec.ts` : menu ⋯ sans « Annuler », route refusée en
   303 (`intervention.refus.terminee_non_annulable`), tiroir du planning montre le refus plutôt que le
   formulaire.
3. **Solde 160 — D194 périmée.** D194 corrigée : les trois épreuves rouges et les captures manquantes
   qu'elle annonçait ont toutes été reprises par 9ES-1A/1B (shas cités). D193 complétée avec les deux
   unitaires ajustés par la partie A/C du lot lui-même (shas réels sur `main` : `5191a7ac`, `3636340c`
   — pas 9EH2B comme l'énoncé le supposait ; mesuré avant d'écrire).
4. **Solde 161 — code mort.** `BoutonAnnuler`, `BoutonCloturer` (+ leur test dédié), `blocCloturerReplie`
   retirés (zéro appelant hors d'eux-mêmes). `principaleRendue` simplifié (trois clauses sur quatre
   étaient inaccessibles sous sa seule garde `principale === "planifier"` — y compris la clause
   `transmettre`, non nommée par le ticket mais tout aussi morte, mesurée et retirée). Six clés i18n
   orphelines retirées avec eux.
5. **Solde 157/162 — captures écrasées.** Restaurées depuis `e0e6fbc3` (PLANNING-1, 375px Semaine/Jour +
   README) et `1073819f` (INTERVENTIONS-2, six captures fiche). Les captures obsolètes de 84-FICHE-ANNULER
   et 99T-G9-CLOTURER-REPLIE gardées, nommées obsolètes dans leur passation (ni l'une ni l'autre n'avait
   de README dédié — la note est allée dans `passation.md`, le document le plus proche de ce rôle pour
   ces deux tickets).
6. **Solde 156 — captures PLANNING-2 manquantes.** Aucune épreuve pérenne ne produisait Semaine/Jour à
   375 px pour ce lot (script jetable à l'origine, pas un spec réutilisable) — capturées par un script
   jetable identique à la recette déjà en place, regardées (pas de débordement), script supprimé après
   usage.
7. **Solde 164 — accessibilité Dialogue/MenuPlus.**
   - `Dialogue` : la docstring prétendait le clic-hors-dialogue natif (faux pour un `<dialog>` modal) —
     implémenté réellement plutôt que seulement corrigé en commentaire (`onClick`, cible = l'élément
     `<dialog>` lui-même).
   - `MenuPlus` : Échap rend le focus au bouton ⋯, y compris quand c'est un dialogue ouvert DEPUIS ce
     menu qui se ferme (le focus natif visait sinon un `menuitem` déjà démonté, et retombait sur
     `<body>`) — le renvoi est différé d'un tour de boucle (`setTimeout`), un appel synchrone perdant
     toujours contre la restauration native du `<dialog>`.
   - Épreuve neuve `fiche-dialogue-focus.spec.ts` (Suspendre en direct, Annuler via le menu).
   - Flèches clavier dans le menu : **non faites**, budget de temps épuisé avant ce point facultatif
     (explicitement laissé au jugement du budget par la consigne).
7b. **D84/D197 — gestes sur une suspendue.** « Déplacer » revient sur `suspendue` (absent avant) ;
    « Changer de technicien » quitte `en_cours` (présent par erreur depuis D195). Serveur inchangé
    (`peutDeplacer`/`peutAffecter` permettaient déjà ce statut — seul l'écran restreignait). D197 écrite,
    amende D195 (marques bidirectionnelles posées, `amendements-arbitrages.test.ts` mis à jour). D195 et
    la passation de 9ES-2 corrigées pour dire la même chose que le code. Épreuve neuve
    `fiche-suspendue-gestes.spec.ts` (suspendue : les deux gestes fonctionnent réellement — un
    déplacement DB vérifié, pas seulement visuel ; en_cours et terminee : aucun des deux). Captures
    375/1280.
7c. **Solde 165 — bouton primaire.** `TrouverCreneau` gagne une prop `primaire` (faux par défaut : les
    raccourcis posés dans un dialogue ou la bannière de création restent gris), activée au seul point
    d'appel de l'en-tête d'une `a_planifier`. Assertion `toHaveClass(/bg-primary/)` rétablie dans
    `fiche-actions.spec.ts`.
7d. **Solde 166 — preuve affaiblie.** `9eq-fiche-intervention.spec.ts` ne mesurait plus qu'un défilement
    de PAGE (plus faible que l'original, qui comparait les proportions du bouton à son en-tête).
    Rétabli : le bouton tient entier dans le viewport à 375 px (bornes x/largeur), ET garde sa largeur
    naturelle à 1280 px (moins de la moitié de l'en-tête) — au moins aussi fort que `git show
    068c67cc:tests/e2e/9eq-fiche-intervention.spec.ts`.
7e. **Solde 168 — liens morts.** `fiche-telephone.spec.ts:156,170` cherchaient un `link` « Affecter un
    technicien » qui n'existe plus nulle part (rôle ET libellé faux) — passaient à vide quel que soit le
    statut testé. Retargetées sur le `menuitem` « Changer de technicien » (même opérateur d'attente,
    `toHaveCount(0)`/`toBeHidden()` — les deux restent vrais menu fermé, ce qui est l'état par défaut au
    chargement ; voir note ci-dessous). `fiche-375.spec.ts:191` : titre renommé (les assertions
    elles-mêmes étaient déjà à jour, seul le titre citait encore la carte Actions disparue).
    `ecrans-largeur-utile.spec.ts` : assertion `main aside` → 0 ajoutée, annoncée par un commentaire
    depuis D195 mais jamais posée.
7f. **Solde 169-170.** Deux des quatre clés i18n candidates retirées (`intervention.action.affecter`,
    `.saisir_a_la_main` — zéro appelant, grep -rn vide). Les deux autres (`intervention.actions.titre`,
    `.action.planifier`) GARDENT un appelant (un test de composant générique réutilise la première comme
    simple chaîne d'exemple ; la seconde n'a plus QUE l'assertion vacante de `interventions-2.spec.ts:319`
    — `getByRole("heading", ...)` qui ne correspondra jamais à rien, aucun rôle "heading" ne portant plus
    ce texte depuis que la carte Actions a disparu — mais qui existe, donc la clé reste par la règle du
    ticket). **Captures des quatre dialogues (Planifier à la main, Transmettre, Déplacer, Changer de
    technicien avec un refus affiché) et du bandeau « figée » : NON FAITES**, faute de temps — le
    budget de code neuf (T0+110) a été atteint avant ce point, le plus coûteux en mise en scène (quatre
    statuts, un compte sans capacité pour forcer un refus affiché) et le moins porteur de risque
    (aucune épreuve automatisée n'en dépend).

## Ce qui reste à faire (prochaine reprise)

Dans l'ordre de coût croissant :
1. Les captures du point 7f (dialogues + bandeau figée), dans
   `docs/propositions/9ES-TP-UX4-3-FICHE-GESTES-2/captures/`.
2. Les flèches clavier dans `MenuPlus` (point 7, explicitement facultatif).
3. `interventions-2.spec.ts:319` mesure un refus avec un rôle `heading` qui n'existe plus nulle part
   (même défaut que 7e, hors territoire nommé par ce ticket) — à reprendre avec la même recette que 7e
   si une prochaine session touche ce fichier.

## Vérification jouée

`pnpm format` / `pnpm typecheck` / `pnpm lint` / `pnpm test` : verts après CHAQUE commit (12 commits).
Épreuves voisines rejouées explicitement avant `verify:full` : `fiche-annuler.spec.ts`,
`fiche-annuler-terminee.spec.ts`, `fiche-cloturer.spec.ts`, `fiche-cloturer-replie.spec.ts`,
`fiche-actions.spec.ts`, `interventions-2.spec.ts`, `fiche-dialogue-focus.spec.ts`,
`fiche-suspendue-gestes.spec.ts`, `9eq-fiche-intervention.spec.ts`, `fiche-telephone.spec.ts`,
`fiche-375.spec.ts`, `ecrans-largeur-utile.spec.ts`, `fiche-intervention.spec.ts`,
`fiche-entete-bandeau-frise.spec.ts`, `affichage-materiel.spec.ts`, `priorite-ton-partage.spec.ts`,
`ergo-carte-semaine.spec.ts` — toutes vertes. Captures régénérées par effet de bord (side-effect de ces
épreuves, ou de `verify:full` qui rejoue TOUTE la suite) jamais commitées : restaurées à chaque fois
(`git checkout --`), et `git clean -fd docs/propositions/` après `verify:full` pour les nouvelles.

`CI=1 pnpm verify:full` joué EN ENTIER (lancé ~10:45, 48,4 min), sur `4ab55e54` :

```
  48 skipped
  1248 passed (48.4m)
::notice title=🎭 Playwright Run Summary::  48 skipped
  1248 passed (48.4m)
```

0 échec. `format:check`, `typecheck`, `lint`, `test`, `test:isolation`, `build`, `feries:horizon`,
`audit:partitions` compris dans cette même exécution (tous verts, aucune ligne rouge dans le journal
complet).

## Branche

12 commits, en détaché sur `origin/main` (`0fb44566` au départ) :
1. D83 — phrase d'annulation
2. Solde 159 — preuve du refus « Annuler une terminée »
3. Solde 160 — D194 périmée, D193 complétée
4. Solde 161 — code mort retiré
5. Solde 157/162 — captures écrasées restaurées
6. Solde 156 — captures PLANNING-2 manquantes à 375 px
7. Solde 164 — accessibilité Dialogue/MenuPlus
8. D84/D197 — Déplacer et Changer de technicien sur une suspendue
9. Solde 165 — bouton primaire
10. Solde 166 — preuve du bouton primaire rétablie
11. Solde 168 — liens morts corrigés
12. Solde 169-170 (1/2) — clés i18n sans appelant retirées
