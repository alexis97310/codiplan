# 9L03A-RETIRER-ACCES-INTERNE — passation

Arrêt avant tout code, sur une contrainte de schéma mesurée — pas de commit de code pour ce lot.

## Ce qui a été fait avant l'arrêt

Reprise à partir d'`origin/main` (branche dédiée `9L03A-RETIRER-ACCES-INTERNE`, `HEAD` était détaché
au même commit). Lecture complète de `lib/auth/societe-active.ts`, `lib/auth/lien-d-acces.ts`
(`revoquerAccesPortailClient`, son analogue côté portail), des routes voisines
(`app/api/clients/[id]/revoquer-acces/route.ts`, `app/api/equipe/bureau/[id]/reinitialiser-second-
facteur/route.ts`), de l'écran `app/(back-office)/parametres/equipe/page.tsx` (emplacement du bouton,
`BoutonAvecConfirmation` déjà réutilisable), du schéma `UtilisateurSociete`/`Session`/`EvenementAcces`
et des deux migrations qui ajoutent déjà une valeur à cet enum (patron à reproduire : la valeur
`ALTER TYPE ... ADD VALUE` toujours en toute dernière ligne du fichier).

Aucun fichier de code n'a été créé ou modifié. Rien à committer sur ce plan.

## Le point de mesure qui arrête ce lot

Le brief demande, point 1 : « dans UNE transaction : suppression (ou désactivation, selon le schéma
— mesure ce que le journal d'audit attend) de la ligne `utilisateur_societe` ». C'est la suppression
qui a été mesurée.

`UtilisateurSociete` n'a pas de colonne `actif` (contrairement à `UtilisateurClient`, qui porte déjà
cette bascule pour le portail). La suppression de la ligne est donc la seule opération que le schéma
actuel permet d'écrire sans colonne neuve — mais elle se heurte à CINQ contraintes `FOREIGN KEY ...
ON DELETE RESTRICT` existantes, posées par des migrations déjà en production, qui référencent
`utilisateur_societe("utilisateur_id", "societe_id")` :

- `technicien_habilitation_technicien_fkey` (`prisma/migrations/20260908120000_habilitations_l1_04`)
- `absence_technicien_fkey` (`prisma/migrations/20260913180000_absence_l3_04`)
- `segment_travail_auteur_fkey` (`prisma/migrations/20260915010000_compteur_du_technicien_r5_02`)
- `intervention_pause_ouvert_par_fkey` et `intervention_pause_fermee_par_fkey`
  (`prisma/migrations/20260924180000_interventions_2`)

Le commentaire de la première migration le dit en toutes lettres : « `RESTRICT` des deux côtés, et le
côté suppression est une DÉCISION : retirer quelqu'un d'une société alors qu'il y porte des
habilitations est refusé. […] un `CASCADE` aurait effacé la trace de ses qualifications sans que
personne l'ait voulu ». C'est une décision déjà prise, pas un oubli — mais prise pour un autre geste,
sans anticiper celui-ci.

**Conséquence mesurée** : la suppression de `utilisateur_societe` échoue (erreur PostgreSQL
`23503`, contrainte violée) pour toute personne qui porte au moins une habilitation, une absence, un
segment de travail ou une pause d'intervention — c'est-à-dire tout technicien qui a réellement
travaillé. Le geste « Retirer l'accès » tel que demandé au point 3 (« un bouton […] sur chaque compte,
bureau et technicien ») échouerait donc systématiquement pour la cible la plus courante côté
technicien, pas seulement dans un cas rare.

Le brief anticipait un arrêt sur ce point précisément : « Toute AUTRE colonne ou contrainte manquante :
ARRÊTE-toi, écris-la et rends la main. » Ce n'est pas une colonne manquante mais une contrainte
EXISTANTE qui empêche l'opération demandée — la même famille d'arrêt, prise au sérieux.

## Deux options, avec leurs conséquences

**Option A — Suppression, bornée aux comptes sans trace opérationnelle.** Le geste tente la
suppression ; si PostgreSQL la refuse (contrainte violée), c'est un refus nommé de plus (par exemple
« la personne porte une activité enregistrée sur cette société »). Aucune migration de schéma au-delà
de celle déjà autorisée (la valeur d'énumération). Mais le bouton « Retirer l'accès » resterait sans
effet utile sur la plupart des techniciens actifs — exactement la cible que le point 3 nomme — ce qui
viderait une partie de la décision d'Alexis du 10/11 de son usage pratique.

**Option B — Une colonne `actif` sur `utilisateur_societe`, même patron que `utilisateur_client`.**
Le geste ne supprime jamais la ligne, il la désactive ; chaque lecture de rôle interne
(`lireRole`, `roleDansLaSocieteActive`, `habilitationsDuCompte`, `compteDeBureauMembre`, …) est amendée
pour ne retenir qu'une ligne `actif = true`, comme c'est déjà fait pour `utilisateur_client`. Les
contraintes `RESTRICT` ci-dessus ne sont alors jamais sollicitées : la ligne reste, les habilitations,
absences, segments et pauses continuent de la désigner valablement. C'est la solution qui tient la
promesse du point 3 pour un technicien avec de l'historique — mais elle exige une migration de schéma
(colonne, et très probablement une politique RLS d'`UPDATE` dédiée pour que seule cette colonne bouge,
sur le modèle des filets de colonnes déjà posés par 9IA) allant au-delà de la seule migration autorisée
par Alexis le 13/11 (~07:45), qui ne portait que sur l'ajout d'une valeur à `EvenementAcces`.

En attente de la décision d'Alexis avant d'écrire une ligne de code.

## Reprise 9L03C — « Désactiver » (décision d'Alexis du 13/11/2026 ~13:05)

Livré. `retirerAccesInterne` (`lib/auth/retrait-acces.ts`), route
`POST /api/equipe/<id>/retirer-acces` (partagée par les deux onglets d'Équipe,
`onglet` voyage dans le formulaire), bouton de confirmation sur chaque compte,
badge « Accès retiré » une fois le geste joué. Voir D251 (`docs/arbitrages.md`)
pour la décision et sa condition de réouverture, et le message du commit de
chaque point pour le détail.

**Mesuré, et documenté ici plutôt que changé** — « ré-accorder l'accès passe
par le chemin de création/modification du compte » (le brief le proposait) :
`creerCompteDeBureau` (`lib/auth/acces-bureau.ts`) et `habiliterEtRattacherDans`
(`lib/techniciens/depot.ts`) posent tous deux `utilisateurSociete.create`, qui
heurte la contrainte d'unicité `(utilisateur_id, societe_id)` dès qu'une ligne
— actif ou non — existe déjà, et rendent alors `deja_membre` **sans distinguer
une ligne inactive d'une ligne active**. Recréer un compte dont l'accès a été
retiré échoue donc aujourd'hui, au lieu de réactiver la ligne. Ce n'est pas
corrigé par ce lot : la correction toucherait deux chemins déjà éprouvés par
ailleurs (et, pour le technicien, devrait aussi décider si la fiche
`technicien` — jamais supprimée, elle, puisque `retirerAccesInterne` n'y
touche pas — doit être revue ou laissée telle quelle), et le brief ne l'exigeait
qu'à titre de mesure. Pour rouvrir un accès retiré aujourd'hui : poser
`actif = true` à la main sur la ligne `utilisateur_societe` (aucun écran ne
l'offre encore).

**Autres lecteurs de `utilisateur_societe` mesurés, laissés inchangés** —
listés ici pour que personne ne les redécouvre à neuf :
`lib/habilitations/depot.ts` (recherche d'un technicien pour une habilitation),
`lib/avertissements/signature-terrain.ts` (destinataires de repli bureau),
`lib/tableau-de-bord/lectures.ts` (comptage d'équipe de la tuile), `lib/
interventions/depot.ts` (désignation d'un technicien), `lib/auth/acces-
bureau.ts`/`acces-technicien.ts` (`administrateurs`, historique de qui a
envoyé le dernier lien — pas un calcul d'accès), `lib/auth/lien-d-acces.ts`
(`roleDansLaSocieteActive`, `identiteInterneAilleurs`), `lib/auth/amorcage.ts`
(société vierge, réémission du premier accès). Aucun n'ouvre un accès à une
ligne inactive ; certains (l'historique « qui a envoyé le dernier lien »)
continueraient de citer un administrateur depuis retiré, ce qui est
l'historique, pas un accès.

`pnpm verify` rejoué au complet et vert (format, typecheck, lint, test,
test:isolation — 2208 scénarios —, build) avant de rendre la main ;
`test:e2e` n'a pas été rejoué en entier (budget de temps), seul le spec neuf
(`tests/e2e/captures-9l03c-retirer-acces.spec.ts`, 4/4 verts) et
`tests/unit/gardiens/chemins-de-depot.test.ts` ont été ciblés en plus de la
suite unitaire complète.
