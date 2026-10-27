# 9G8G-DECLARATION-SANS-LIEN-BUREAU — passation (reprise 9G4E)

## Point de départ

9G8G est parti de `f24b8e66a` le 26/10 à 11:10, et avait été recalé deux fois — uniquement
sur le dialogue de confirmation « Lever » de `/absences` (`components/ui/bouton-confirmation.tsx`),
sans rapport avec le territoire propre de ce lot. Ce défaut a été mesuré par 9G4C et corrigé
par 9G4D, publié sur `origin/main` avant cette reprise (`a1993d2ae`).

`main` étant extrait dans un autre worktree, ce lot a travaillé sur une branche dédiée,
`9G4E-REPRISE-9G8G`, partant d'`origin/main` (donc du correctif 9G4D déjà en place).

## Ce qui a été reporté

Les trois commits de la garde (`9G8G-DECLARATION-SANS-LIEN-BUREAU-garde`) ont été comparés
à `origin/main` : **aucun conflit** — 9G4D n'a touché que `app/(mobile)/terrain/**`,
`components/terrain/**`, `components/ui/bouton-confirmation.tsx`, `lib/i18n/fr.ts` et des
tests ; 9G8G ne touche que `app/(back-office)/absences/page.tsx`,
`components/navigation/bandeau-bureau.tsx` et `tests/e2e/`. Les deux commits de code/mesure
ont été reportés tels quels (`git cherry-pick`, zéro modification) :

- `l'aperçu du technicien pointe vers /terrain, pas /interventions`
- `captures du volet technicien avec aperçu (375 et 1280 px)`

Le troisième commit de la garde (`verify-final.txt (partiel, test:e2e tronqué par le délai
d'une heure)`) n'a pas été reporté : il est remplacé par le `verify-final.txt` de ce lot,
produit dans les mêmes conditions (voir plus bas).

## Comparaison au contrat

1. **Mesure rouge** : `tests/e2e/9g8g-declaration-sans-lien-bureau.spec.ts` pose sa propre
   intervention affectée sur une période sans collision avec 9G8F, et mesure APRÈS l'aperçu
   (comme demandé). Fait par la garde, inchangé ici.
2. **Correction** : `ListeLiensInterventions` reçoit `hrefIntervention`, calculé via
   `lireIntervention` (même vérification d'affectation que `template.tsx`) — lien
   `/terrain/<id>` si affecté, texte simple sinon ; rendu bureau inchangé (paramètre par
   défaut `hrefInterventionBureau`). `BandeauBureau` ne monte plus `<RechercheGlobale>` du
   tout pour `Role.technicien` (raccourcis clavier compris), rôles bureau inchangés. Fait par
   la garde, inchangé ici.
3. **Épreuves vertes, bureau inchangé, captures** : déjà livré par la garde. Revérifié dans
   cette reprise :
   - `tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts` et
     `tests/e2e/absences-levee-confirmation.spec.ts` (les deux épreuves citées par le pilote
     comme recalées) : **100/100 vertes** en `--workers=1 --repeat-each=5`.
   - `9g8g-declaration-sans-lien-bureau.spec.ts`, `9g8f-declaration-absence-formulaire-seul.spec.ts`,
     `absences-2.spec.ts`, `absences-3.spec.ts`, `absences-ecourter-etat.spec.ts`,
     `9du-recherche-rail.spec.ts` : **22/22 vertes**.
   - Les captures régénérées par ces deux passages pour d'AUTRES épreuves (effet de bord
     connu du semis partagé) ont été restaurées (`git checkout --`) ; celles de 9G8G
     elles-mêmes aussi, le rendu étant identique à celui déjà commité par la garde.
4. **Fin** : voir ci-dessous.

Rien à finir : le contrat était déjà entièrement couvert par la garde, hors l'étape 4.

## `pnpm verify:full`

`CI=1 pnpm verify:full` a tourné en premier plan, un seul appel, `tee` vers
`verify-final.txt`. **Même mesure que la garde** : `format:check`, `typecheck`, `lint`,
`test` (5144 passés), `test:isolation` (1679 passés), `build`, `feries:horizon`,
`audit:partitions` — tous verts. `test:e2e` (1671 épreuves) a démarré et tourné une heure
pleine sans conclure avant la coupure de l'outil (même limite que pour la garde) : la sortie
capturée ne porte **aucun `×`**, seulement des points et des lignes `MESURE`/`WARN`
informatives, jusqu'à l'avant-dernière ligne du fichier.

Les épreuves directement concernées par ce lot (point 3 ci-dessus) ont été rejouées à part,
en dehors de `verify:full`, et sont toutes vertes.

## Points ouverts

- `test:e2e` complet (1671 épreuves) n'a pas conclu dans l'heure, ni dans la garde ni dans
  cette reprise — au-delà du périmètre de ce ticket, et déjà signalé par 9G4D/9G8G comme une
  limite de l'outil, pas du code.
