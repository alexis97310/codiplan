# 9EWE-PARAMETRES-TARIFS-PAGE-UNIQUE — passation

## Ce qui a été fait

1. **La page `/parametres/tarifs`** (`app/(back-office)/parametres/tarifs/page.tsx`, neuve) —
   mêmes gardes que les deux anciens écrans (`parametrer_societe` OU `voir_montants_vente`
   en lecture, `parametrer_societe` complet en écriture). Trois blocs :
   - **Taux horaire** — historique inchangé (`statutDuTaux`, `taux-horaire/presentation.ts`,
     ni touché ni retesté différemment), colonnes « À partir du / Montant HT de l'heure /
     État », statut désormais un `Badge` (vert « En vigueur », gris « Remplacé le… ») plutôt
     qu'un texte brut — disposition seulement, aucune lecture neuve. Formulaire de saisie +
     confirmation RELOCALISÉS tels quels (mêmes `data-bloc`, même route), pas transformés en
     dialogue modal : le ticket le laissait facultatif, et le temps gagné est allé à la
     couverture plutôt qu'à l'interaction.
   - **Forfaits** — une ligne PAR ZONE (les six de D23), le forfait de déplacement RETENU
     (`forfaitRetenu`, même fonction que la valorisation) ou « aucun forfait ». « Créer »
     préremplit la zone (`?zone_forfait=`) et renvoie à la section « Nouveau forfait ».
     « Modifier » mène à la fiche existante. `?vue=sans-forfait` filtre aux zones sans
     forfait retenu (puce + lien pour l'effacer).
   - **Autres forfaits** — mise en service, contrôle, prestation : Forfait / S'applique à /
     Montant HT / Désigné par / Modifier. Aucun rang, aucun verdict (le calcul ne les
     sélectionne pas, `verdict`/`forfaits/presentation.ts` inchangé).

2. **D128 levé pour le tableau du catalogue** (décision n° 98) — rang, code, catégorie,
   conditions et verdict n'existent plus sur `/parametres/tarifs`. Code, libellé et
   catégorie restent VISIBLES sur la fiche `/parametres/forfaits/[id]` (nouveau bloc
   `data-bloc="identite-forfait"`, trois marqueurs `colonne-code|libelle|categorie`) ; son
   fil d'Ariane pointe désormais vers `/parametres/tarifs`. `tests/unit/ui/lot-a5-a7.test.ts`
   confronte maintenant CETTE source à la maquette, en citant la décision.

3. **Redirections et repointages** — `next.config.ts` ajoute deux 308 permanentes
   (`/parametres/taux-horaire`, `/parametres/forfaits` → `/parametres/tarifs` ;
   `/parametres/forfaits/:id` n'est pas visée). Les quatre routes d'écriture
   (taux-horaire/creer, forfaits/creer, forfaits/[id]/modifier succès, forfaits/[id]/activite)
   redirigent directement vers `/parametres/tarifs` plutôt que vers les anciennes listes
   (évite un aller-retour par la redirection). Le hub ne porte plus qu'une porte « Tarifs »
   (`portes-parametrage.ts`), pastille fusionnée dans `decompteTarifs`
   (`decomptes-parametrage.ts`) qui priorise l'alerte des zones sans forfait sur le neutre
   taux-en-vigueur.

4. **Case « Cumulable » retirée** du formulaire (`components/forfaits/formulaire.tsx`) — la
   clé i18n `forfaits.champ.cumulable` est supprimée (plus aucun appelant). La colonne
   `cumulable_temps` reste en base, écrite à `false` (absence de case = absence dans le
   `FormData`, lu comme avant par `saisieForfaitRecue`). La plomberie de resoumission après
   refus (`versLeFormulaire`, `creer/route.ts`, le test qui l'éprouve) perd son champ
   `forfait_cumulable_temps`, devenu mort.

5. **Épreuves migrées** (chemin, href, `toHaveURL`) : `taux-horaire-succession.spec.ts`,
   `9ev-direction-tous-droits.spec.ts`, `9dg-tp-s1-lecture-technicien.spec.ts`,
   `droits-rm-rs.spec.ts` (les deux portes fusionnent en un seul appel `porteDuHub`),
   `ecrans-largeur-utile.spec.ts` (le compte de lignes vise désormais
   `ZONES_GEOGRAPHIQUES.length`, pas `FORFAITS_SCENE.length + FORFAITS_DEMONSTRATION.length`
   — le modèle d'affichage a changé, une ligne par zone et non par forfait),
   `focus-visible-et-plancher-typographique.spec.ts`, `captures-9br-tpa4b-messages.spec.ts`,
   `captures-9au-cg8-cases-44.spec.ts`, `tests/unit/navigation/entrees.test.ts`,
   `tests/unit/navigation/portes-textes-maquette.test.ts` (gagne un cas « Tarifs », perd son
   exemption devenue caduque), `tests/isolation/decomptes-parametrage-isolation.test.ts`
   (vérifié contre la base d'isolation réelle : ni A ni B n'y porte de taux horaire, le
   repli de `decompteTarifs` sur le neutre ne s'y déclenche donc jamais). L'audit visuel
   (`tests/audit-visuel/catalogue.ts`) porte désormais la route réelle au lieu de la noter
   absente. `tests/unit/tarification/forfaits-creer-retour-formulaire.test.ts` vise
   `/parametres/tarifs`.

   Épreuve neuve : `tests/e2e/9ewe-tarifs-page-unique.spec.ts` — un forfait posé DEPUIS le
   formulaire de `/parametres/tarifs` apparaît dans « Autres forfaits » (1280 et 375 px,
   capture sous `CAPTURES_9EWE`) ; `?vue=sans-forfait` rend zéro ligne (la scène partagée n'a
   aucune zone non couverte, voir l'en-tête du fichier). Le gardien L0-11
   (`sans-chaine-visible-en-dur.test.ts`) a refusé un premier jet qui passait le libellé du
   forfait en dur à `toContainText` — corrigé en lisant `.innerText()` d'abord (idiome
   `texteDuBloc`, comme `taux-horaire-succession.spec.ts`).

6. **Décision D203** dans `docs/arbitrages.md` — décisions n° 97 et n° 98 d'Alexis, amende
   D201 et D128 (marques « Amendé par D203 » posées sur les deux, gardien de câblage
   bidirectionnel tenu).

## Points ouverts, nommés plutôt que tranchés

- **Le badge « À partir du… » (futur, bleu) que la maquette dessine pour le taux horaire
  N'EST PAS implémenté.** `statutDuTaux` (TAUX-1/PA-11) rend `null` pour une ligne future, et
  son test unitaire l'exige explicitement — un choix de PORTÉE déjà arrêté par un ticket
  antérieur, pas un oubli de celui-ci. L'implémenter rouvrirait PA-11/PA-12 (date d'effet
  passée, encore non tranchée) ; **je ne l'ai pas tranché à sa place**. Condition de
  réouverture écrite dans D203.
- **Le dialogue modal que la maquette dessine pour « Poser un nouveau taux » et « Nouveau
  forfait » n'a pas été construit.** Les deux formulaires restent des sections de page
  toujours visibles (quand l'utilisateur peut écrire), exactement comme les deux anciens
  écrans — le ticket le laissait facultatif (« la confirmation en deux écrans PEUT devenir
  le dialogue »), et j'ai choisi de garder le flux existant, inchangé et déjà éprouvé, plutôt
  que de reconstruire une interaction modale dans le temps restant. Composant `Dialogue`
  disponible (`components/ui/dialogue.tsx`) pour un lot qui voudrait fermer cet écart.
- **Le filtre `?vue=sans-forfait` n'a pu être éprouvé qu'à ZÉRO zone affichée** — la scène e2e
  partagée ne porte aucun forfait de déplacement conditionné par zone (tous `zone_geo` NULL),
  donc aucune zone n'y est jamais « sans forfait ». Passer d'un état à l'autre demanderait une
  scène jetable dédiée (hors territoire de ce lot, `tests/e2e/setup/scene.ts` non touché).
- **Trois captures e2e, `CAPTURES_9EWE`** : `tarifs-avant-creation-1280`,
  `tarifs-apres-creation-1280`, `tarifs-apres-creation-375` — pas de capture AVANT/APRÈS au
  sens strict (page neuve, rien à comparer), juste avant/après la création d'un forfait.

## Vérification finale

Épreuves voisines rejouées contre un serveur réel AVANT le run complet, une à une, pendant le
développement (toutes vertes) : `taux-horaire-succession.spec.ts`, `droits-rm-rs.spec.ts`,
`9ev-direction-tous-droits.spec.ts`, `9dg-tp-s1-lecture-technicien.spec.ts`,
`ecrans-largeur-utile.spec.ts`, `focus-visible-et-plancher-typographique.spec.ts`,
`captures-9br-tpa4b-messages.spec.ts`, `captures-9au-cg8-cases-44.spec.ts`,
`tous-les-ecrans-rendent.spec.ts` (56 tests, 3 skip connus), `9ewe-tarifs-page-unique.spec.ts`.

`CI=1 pnpm verify:full` rejoué en entier, en un seul appel (`format:check`, `typecheck`, `lint`,
`test`, `test:isolation`, `build`, `feries:horizon`, `audit:partitions`, `test:e2e`). Dernières
lignes du run :

```
  48 skipped
  1321 passed (51.1m)
::notice title=🎭 Playwright Run Summary::  48 skipped%0A  1321 passed (51.1m)
```

Mêmes chiffres que la vérification finale de 9EWD2 (dernier lot livré avant celui-ci) : aucune
régression mesurée ailleurs dans le dépôt.

`git rev-parse --short HEAD` au moment de cette vérification : `8075f6e2` (commit « point 5
(suite) : passation », avant ce commit-ci).

Le run complet a régénéré, par effet de bord, des captures PNG et un PDF d'AUTRES épreuves (une
soixantaine de dossiers, dont `47-AVERTISSEMENTS-1`, `9D4-E2E-COMPTES-RM-RS`,
`9EV-DIRECTION-TOUS-DROITS`, `9EWD2-PARAMETRES-HUB-ISOLATION`) : toutes restaurées
(`git checkout --`) ou supprimées (les nouvelles, jamais commitées) avant ce commit — l'arbre est
propre, seules les captures du point 4 de CE lot restent dans son historique.

`git fetch origin` : `origin/main` n'a pas bougé depuis le départ (`1d0a3bfd`, le commit 9EWD2
cité en `ARRÊT IMMÉDIAT SI`). `git rebase origin/main` : rien à rejouer, déjà à jour.

`CI=1 pnpm verify` (sans le `:full`, donc sans l'e2e déjà rejoué ci-dessus) rejoué une dernière
fois après la restauration des captures étrangères, pour confirmer que celle-ci n'a rien cassé —
vert.
