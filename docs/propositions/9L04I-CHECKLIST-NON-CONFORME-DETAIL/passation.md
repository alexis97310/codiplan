# 9L04I-CHECKLIST-NON-CONFORME-DETAIL — passation

Décisions d'Alexis du 13/11/2026 : un point de checklist non conforme porte désormais sa suite à
donner, son commentaire et ses photos — mesuré par le pilote le 13/11 : « le moteur ne porte pas
ce détail, migration à part ».

## MIGRATION À JOUER PAR ALEXIS

`20261115010000_checklist_non_conforme_detail_9l04i` — une seule, neuve, appliquée par `pnpm
db:deploy` (staging, puis la cible visée). Elle ajoute `checklist_reponse.non_conformite_suite`
(enum `ChecklistNonConformiteSuite`, trois valeurs) et `non_conformite_commentaire` (texte, borné
à 500 caractères par contrainte CHECK), toutes les deux NULLABLES et sans reprise de données
existantes. Aucun `GRANT` nouveau : le rôle applicatif a déjà `SELECT, INSERT, UPDATE` sur toute
la table (9K08), par colonne jamais par ligne.

## Ce qui a été fait

1. **Migration et schéma.** `checklist_reponse_detail_non_conforme` (CHECK) borne les deux
   colonnes à `valeur_conforme = 'non_conforme'` ; `checklist_reponse_commentaire_non_conforme_borne`
   borne le commentaire comme `valeur_texte` (non vide, ≤ 500). `checklist_reponse_valeur_unique`
   (six colonnes) n'est PAS touchée — ce ne sont pas des valeurs alternatives (voir D254).
2. **`lib/checklists/non-conformite.ts` (créé)** — les fonctions pures partagées entre validation
   serveur, lecture bureau/portail et saisie terrain : `valeurConformeDe`, `detailNonConformeDe`,
   `detailNonConformeVide`, `libelleSuiteNonConformite`.
3. **`lib/checklists/validation-reponse.ts`** — `conforme_non_conforme_sans_objet` accepte
   désormais soit la simple chaîne (comme avant), soit `{ conforme, suite?, commentaire? }` ;
   refuse `checklist.refus.detail_hors_non_conforme` si `suite`/`commentaire` sont posés sur une
   réponse autre que `non_conforme`.
4. **`lib/checklists/depot.ts`** — `enregistrerReponsePhoto` accepte un point
   `conforme_non_conforme_sans_objet` en plus de `photo` : elle pose elle-même `valeur_conforme =
   "non_conforme"` (jamais `valeur_photo`), pour ne jamais dépendre de l'ordre d'arrivée entre la
   pastille (file hors réseau) et la photo (sa propre route) — voir D254, point 3. `non_conformite_
   suite`/`_commentaire` ne sont JAMAIS écrits par cette fonction.
5. **La saisie terrain** (`components/terrain/checklist-terrain.tsx`) — `ChampNonConformite`
   remplace `PastillesConformite` seule pour ce type de point : choisir « non conforme » ouvre la
   suite (trois segments), le commentaire (facultatif, 500 caractères) et « Ajouter une photo »
   (même composant `PhotosTerrain` que 9K28). La saisie se replie en une ligne rouge
   (`text-app-rouge-encre`, 14 px — hors échelle du point 11 de D143, aucune exemption requise) dès
   qu'elle porte déjà une valeur ; toucher la ligne la rouvre. Changer la réponse vers conforme,
   sans objet, ou la retirer, EFFACE le détail — avec confirmation (`window.confirm`, voir « Point
   ouvert » plus bas) si l'un des deux n'est pas vide.
6. **Bons et fiche bureau** — `DetailNonConformeBon` (créé, `components/interventions/
   bon-tuiles.tsx`), partagée par `TuileChecklist` (bon) et `TuileChecklistFiche` (fiche bureau,
   `app/(back-office)/interventions/[id]/page.tsx`).
7. **Hors réseau** — `lib/terrain/copie-validee.ts` (`checklistDeLaFiche`) et `app/api/terrain/
   instantane/route.ts` (`FicheJSON`) acceptent désormais le détail dans l'instantané emporté ;
   `components/terrain/consultation-hors-reseau.tsx` n'a RIEN eu à changer, elle réutilise
   `ChecklistTerrain` tel quel.

## Points ouverts, pour Alexis

- **Suite et commentaire : facultatifs par défaut.** Le ticket ne tranche pas s'ils doivent être
  obligatoires une fois un point marqué non conforme. Aucune contrainte ni validation ne les
  exige aujourd'hui (D254, point 2). Si Alexis veut les rendre obligatoires, c'est un changement
  de règle métier (§1 de CLAUDE.md : une règle absente du chapitre 10 et non tranchée est non
  normative) — je ne l'ai pas inventée.
- **La confirmation d'effacement passe par `window.confirm` natif, pas par un composant du
  dépôt.** `components/ui/dialogue.tsx` et `components/ui/bouton-confirmation.tsx` existent déjà
  pour des confirmations stylées (bureau) ; je n'ai pas branché l'un ou l'autre sur la fiche
  terrain « épurée » (D252 : aucun cadre ni carte, un système visuel distinct) par manque de
  budget pour vérifier qu'ils s'y comportent bien. `window.confirm` fonctionne, mais rend un texte
  non stylé que D124/D252 ne couvrent pas. Si Alexis veut un style cohérent, c'est un lot de
  reprise ciblé sur ce seul point.
- **9L04H (récapitulatif) et 9L04F (reprendre la non-conformité) n'existent pas encore** —
  confirmé par une recherche exhaustive du dépôt avant d'écrire ce lot. Le point 4 du ticket
  (« apparaissent avec le point ») est donc satisfait seulement pour les bons et la fiche bureau,
  qui existent ; les deux lots à venir hériteront de `RenduReponseChecklistBon`/
  `DetailNonConformeBon` plutôt que de recomposer une seconde lecture.

## Captures

`docs/propositions/9L04I-CHECKLIST-NON-CONFORME-DETAIL/captures/` (375 px, sauf les bons) : point
avant réponse, point ouvert avec suite + commentaire + photo rempli, point replié (ligne rouge
résumée), bon client et bon interne (1280 px) montrant la suite et le commentaire sous le point.

**`docs/captures/` (la galerie repo-wide) n'a PAS été rafraîchie** — même motif que les passations
de 9K27, 9L04D et 9L04G : la procédure de `docs/captures/README.md` (base jetable, build de
production, amorçage d'un compte neuf par lien de premier accès, identités portail/multi-société)
exige des secrets choisis en direct que cette session ne détient pas, et n'entre pas dans le
budget de ce lot.

## Épreuves

`tests/unit/checklists/non-conformite.test.ts` (créé), `tests/unit/checklists/validation-reponse.
test.ts` (étendu), `tests/unit/terrain/checklist-terrain.test.tsx` (étendu — ouverture, suite,
commentaire, repli/réouverture, confirmation acceptée/refusée), `tests/unit/terrain/
copie-validee.test.ts` (étendu — `checklistDeLaFiche` n'avait AUCUN test avant ce lot, relevé en
l'étendant). `tests/isolation/checklists.test.ts` (les deux contraintes CHECK neuves, avec leurs
jumeaux) et `tests/isolation/9k28-checklist-reponse-photo.test.ts` (la photo sur un point non
conforme, y compris l'isolation société). `tests/e2e/9l04i-checklist-non-conforme-detail.spec.ts`
(créé) : en ligne (ouverture, suite, commentaire, photo, envoi, rechargement, repli/réouverture,
retour à conforme avec confirmation), hors réseau (non conforme + suite partent dans la file,
envoyées sans perte), et les bons (client/interne) qui montrent le détail.

`pnpm test`, `pnpm test:isolation`, `pnpm exec playwright test tests/e2e/9l04i-checklist-non-
conforme-detail.spec.ts` : tous verts. `CI=1 pnpm verify` restant à rejouer après ce commit (voir
suite).

## Ce qui n'est pas touché

`checklist_reponse_valeur_unique` (six colonnes) inchangée. Aucun GRANT nouveau. Le périmètre
portail n'a pas changé : le client voit déjà TOUTES les réponses de SA checklist (D235), donc le
détail d'une non-conformité lui est visible sur son bon exactement comme les cinq autres colonnes.
Le terrain ne compte pas les photos de non-conformité (`N photo(s) ajoutée(s)`, comme pour le type
`photo`) — non demandé par le ticket, et le composant `PhotosTerrain` n'expose pas ce compte pour
ce chemin ; une reprise future pourrait l'ajouter si Alexis le demande.

## Branche

Ce worktree était détaché sur `origin/main` au début de la session (`HEAD detached from
origin/main`) — jamais `main` lui-même. J'ai créé la branche `9L04I-CHECKLIST-NON-CONFORME-DETAIL`
à partir de ce point et j'y ai posé les commits de ce lot (aucun `push`).
