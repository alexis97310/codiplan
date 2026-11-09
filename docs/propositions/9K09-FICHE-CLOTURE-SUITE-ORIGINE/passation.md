# 9K09-FICHE-CLOTURE-SUITE-ORIGINE — passation

## Ce qui était mesuré au départ (étude du 08/11/2026, I4 et I5)

- **I4** : sur une `terminee`, `app/(back-office)/interventions/[id]/page.tsx` rendait
  le bloc « Clôturer » (`:1113`, `DialogueCloturer`) AVANT le bloc « Valider le rapport »
  (`:1133`) — le dialogue de clôture s'ouvrait pour n'afficher qu'un refus
  (`intervention.refus.rapport_non_valide`), alors que RG-INT-03 (D135) exige la
  validation d'abord. `lib/interventions/action-principale.ts` donnait `"cloturer"`
  comme action principale d'une `terminee`, sans lire `rapportValidePar` — un second
  signal, indépendant de l'ordre JSX, pointait dans la même direction fausse.
- **I5** : la tuile « Suite à donner » (`page.tsx:1725-1735` avant ce ticket) affichait
  `fiche.suiteADonner` en texte seul — ni le statut du dossier (`SuiteADonner.statut`),
  ni de lien vers le registre, ni de bouton « Qualifier ». Aucune lecture de
  `SuiteADonner` par `intervention_reprise_id` n'existait nulle part : la fiche d'une
  reprise ne disait pas d'où elle venait.

## Ce qui a été fait

### I4 — l'ordre des gestes, et « Valider et clôturer » en un geste

1. **`lib/interventions/action-principale.ts`** : `actionPrincipale` prend désormais un
   second paramètre `rapportValide: boolean`. Pour `terminee` : `"valider_rapport"` tant
   qu'il est faux, `"cloturer"` ensuite (seul appelant : `page.tsx`, qui lit
   `fiche.rapportValidePar` au même endroit que `principale`, une seule fois — §9,
   01/09).
2. **`page.tsx`** : le bloc « Valider le rapport » (formulaire simple) est maintenant
   rendu AVANT le bloc `DialogueCloturer` dans le JSX — l'ordre visuel suit l'ordre du
   document, aucun CSS d'ordre inventé.
3. **« Valider et clôturer » en un geste** — offert uniquement quand
   `peutValiderCeRapport && !rapportValide` (`offrirValiderEtCloturer`, calculé dans
   `page.tsx`, transmis à `DialogueCloturer`). Le dialogue affiche alors une case
   (`CaseACocher`, réutilisée telle quelle) ; cochée, elle active le bouton « Clôturer »
   malgré le refus affiché (état local React `validerEtCloturer` — nécessaire pour
   activer/désactiver le bouton sans aller-retour serveur). La route
   `app/api/interventions/[id]/cloturer/route.ts` lit `valider_puis_cloturer` et, si
   présent, appelle `validerRapport(contexte, id)` AVANT `cloturerIntervention` — dans
   la MÊME requête, jamais une seconde transaction maquillée en capacité neuve :
   `validerRapport` rejuge lui-même `accesSurCetteIntervention(..., "valider_rapport", ...)`
   avec le contexte déjà authentifié par `cloturer_intervention` ; un rôle qui n'a pas
   la capacité reçoit exactement le refus qu'il recevrait en appelant
   `/valider-rapport` directement. **Aucune capacité ne change de rôle** : l'ADV, qui
   n'a jamais eu `valider_rapport`, ne voit jamais la case (question « l'ADV peut-il
   valider ? » du pilote non tranchée, et pas nécessaire à ce ticket).
4. **`fr.ts`** : une clé neuve, `intervention.cloture.valider_et_cloturer`, dans le bloc
   `intervention.cloture.*` existant.

### I5 — la fiche connaît sa suite et son origine

1. **`lib/suite-a-donner/lecture.ts`** : fonction neuve `suiteADonnerPourIntervention`
   (fichier déjà dédié aux LECTURES de 9J18, jamais `depot.ts` qui reste figé à ses
   quatre fonctions, D231) — rend `{commeOrigine, commeReprise}` dans la MÊME
   transaction cloisonnée (`avecContexteApplicatif`) :
   - `commeOrigine` : la ligne `SuiteADonner` dont `intervention_origine_id` est CETTE
     intervention (`orderBy cree_le asc` — le double clic nommé par 9J18 peut en
     théorie poser deux lignes ; la première créée est la ligne canonique montrée ici).
   - `commeReprise` : l'intervention d'origine, lue via la ligne `SuiteADonner` dont
     `intervention_reprise_id` est CETTE intervention.
   - Le cloisonnement n'est PAS réécrit ici : la politique RLS de forme « filiation »
     posée par 9J17 (et déjà éprouvée par `tests/isolation/suite-a-donner.test.ts`)
     décide seule.
2. **`page.tsx`** : lecture ajoutée au palier `Promise.all` déjà gardé par
   `ongletResume` (9ID-PERFORMANCES) — aucune lecture neuve hors de l'onglet Résumé.
   La tuile « Suite à donner » montre, sous le texte libre :
   - si `commeOrigine` existe : le statut (`suites_a_donner.statut.*`, clés DÉJÀ
     posées par 9K05 — jamais réécrites) et un lien « Voir dans le registre » vers
     `/interventions/suites-a-donner` (pas de fiche détail par dossier dans ce dépôt :
     le registre est la seule destination qui existe) ;
   - sinon, si un texte de suite existe, que l'intervention est `cloturee` et que
     l'utilisateur détient `modifier_planning` (COMPLET — `peutModifierLePlanning`,
     déjà calculé plus haut dans le fichier, MÊME porte que la route
     `/api/interventions/suites-a-donner/qualifier`) : le bouton « Qualifier »
     (`suites_a_donner.action.qualifier`, réutilisé), posté vers la route EXISTANTE
     — aucune route neuve, I5 ne touche pas I1 ;
   - si `commeReprise` existe : un lien « Reprise de l'intervention <référence> » vers
     la fiche d'origine (`referenceAffichee`, réutilisée).
3. **`fr.ts`** : deux clés neuves, `intervention.suite_a_donner.lien_registre` et
   `intervention.suite_a_donner.reprise_prefixe`, dans le bloc
   `intervention.realisation.*`.

## Décision prise en cours de route (à signaler, pas un point d'arrêt du §8)

Le bouton « Qualifier » de la tuile n'apparaît que sur une intervention `cloturee` —
ajouté au-delà du texte littéral du ticket (« quand le dossier n'existe pas encore et
que l'utilisateur en a la capacité »), parce que `fiche.suiteADonner` peut être non nul
AVANT la clôture (le technicien l'écrit au moment du rapport terrain, pas à la
clôture) alors que la route de qualification exige `statut === "cloturee"` (même garde
que 9K05). Montrer le bouton plus tôt l'aurait affiché pour aboutir systématiquement à
un refus — contraire à la consigne « jamais un bouton pour un refus de statut »
(docblock de `page.tsx`, R2-08).

## Épreuves

- **`tests/unit/interventions/action-principale.test.ts`** : nouveau cas
  `"terminée, rapport NON validé → valider_rapport"` ; les cas existants adaptés au
  second paramètre (aucune assertion retirée ni affaiblie).
- **`tests/isolation/suite-a-donner-pour-intervention.test.ts`** (neuf) :
  `commeOrigine` retrouvé avec son statut, `null` en l'absence de dossier,
  **cloisonnement** — une autre société ne voit pas le dossier ; `commeReprise`
  retrouve l'intervention d'origine.
- **`tests/e2e/9k09-fiche-cloture-suite-origine.spec.ts`** (quatre scénarios, à 1280 et
  375 px) :
  1. ADV — aucun bouton « Valider le rapport » (jamais l'ADV, inchangé), et le
     dialogue de clôture n'offre aucune case combinée, bouton désactivé (refus
     inchangé).
  2. RM (détient les deux capacités) — « Valider le rapport » rendu AVANT
     « Clôturer » dans le document ; la case « Valider et clôturer » active le bouton
     désactivé ; après soumission, l'intervention est `cloturee`,
     `rapport_valide_par` non nul, `temps_valide_min` correct — UNE seule requête.
  3. La tuile « Suite à donner » propose « Qualifier » avant le dossier ; après
     qualification (redirection vers le registre, comportement inchangé de 9K05), la
     tuile montre le statut « Qualifiée » et le lien « Voir dans le registre ».
  4. La fiche d'une reprise (liée par `suite_a_donner.intervention_reprise_id`,
     posé directement en base — `creerReprise` est déjà éprouvé par
     `tests/isolation/suite-a-donner-reprise.test.ts`) affiche le lien vers son
     origine.
- `pnpm test` (5561 tests), `pnpm test:isolation` (1992 tests), `pnpm typecheck`,
  `pnpm lint`, `pnpm format` : verts.

## Captures

`docs/propositions/9K09-FICHE-CLOTURE-SUITE-ORIGINE/captures/`, à 1280 et 375 px sauf
mention : `adv-sans-valider-rapport`, `rm-ordre-valider-avant-cloturer`,
`rm-valider-et-cloturer` (1280 seul — la case cochée, avant soumission),
`tuile-suite-avant-qualification`, `tuile-suite-apres-qualification`,
`fiche-reprise-origine`.

## Ce qui reste (hors périmètre de ce ticket)

- Pas de page de détail par dossier « suite à donner » dans ce dépôt : le lien I5 mène
  au registre entier, pas à la ligne précise. Un ticket futur pourrait y ajouter une
  ancre ou une page dédiée si Alexis le juge utile.
- La question « l'ADV peut-il valider un rapport ? » (Q6 de l'étude) reste ouverte,
  comme demandé.
- U1 à U11 et les autres indispensables (I1, I2, I3, I6) de l'étude restent hors
  périmètre, déjà couverts ou à traiter par d'autres tickets (9K05, 9K07).

## Vérification avant de rendre la main

`git fetch origin`, `git rebase origin/main` (aucun commit nouveau sur `main` entre
temps), arbre propre après les trois commits de ce ticket. `verify:full` est laissé à
la file de nuit, non joué ici.
