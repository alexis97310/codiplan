# 9J11A-REPRISE-9J11 — passation

Budget : T0 10:11 (Pacific/Noumea), limite 60 min.

## Point par point

1. **Vérification des conditions d'arrêt** : `git log origin/main --oneline` ne contient aucun commit
   `9J11-NOTIFICATIONS-PRODUCTEUR-SIGNATURE` ; la branche `9J11-NOTIFICATIONS-PRODUCTEUR-SIGNATURE-garde`
   existe (`merge-base` avec `origin/main` = `f34b423fa`, le point de départ attendu). Ni l'un ni l'autre
   n'arrête le lot. Branche `9J11A-REPRISE-9J11` créée depuis `origin/main`, les trois commits de la garde
   (`377788220`, `306a25c40`, `8037fe03d`) y rejoués par `git cherry-pick`, sans conflit.

2. **Cause mesurée, une seule, pour les 8 épreuves** : les quatre épreuves en échec FK
   (`9f4-terrain-enregistrement-auto.spec.ts`, `offline/9f4h3ac-correctifs-revue.spec.ts`,
   `offline/9f4h6-terminer-coquille-sans-session.spec.ts`, `offline/9f4h6d-prestations-sans-perte.spec.ts`)
   posent, via « Terminer » avec signature absente ou refusée, une `Notification` que 9J11 rattache à
   l'intervention (`ON DELETE RESTRICT`). Leur `afterAll` effaçait l'intervention sans avoir retiré la
   Notification d'abord → `23503` sur `notification_societe_id_intervention_id_fkey`, exactement ce que la
   mesure du 2e passage avait trouvé pour la première épreuve.

   **Les 4 autres (toBeVisible, strict-mode violation, survol) n'étaient pas un second bug : un effet de
   bord du même.** Chaque `afterAll` en échec FK interrompt le nettoyage avant les étapes suivantes
   (site/client/prestation), laissant des lignes ORPHELINES d'une exécution interrompue à l'autre — mesuré
   en base (`codiplan_test`) : 4 clients orphelins (`9F4H3AC client` ×2, `9F4H6 client`, `9F4H6D client`,
   `zz9F4 Client` ×2), leurs interventions, et 5 prestations orphelines (codes `9F4H6-PREST`, `9F4H6D-C`,
   `9F4H6D-C2`, `9F4H6D-PROPRE`, `9F4H6D-BUREAU`). C'est cette pollution croisée qui faisait échouer
   `captures-9j10-notifications.spec.ts` (notification orpheline visible sous `admin_societe`, qui tient
   `valider_rapport`), `offline/9f4h6b-file-ancien-format.spec.ts` (deux prestations au même libellé « Filtre
   à air », l'une orpheline), `rapport-terrain.spec.ts` (catalogue de prestations non vide par pollution) et
   vraisemblablement `planning-survol-cases.spec.ts` (données résiduelles décalant la mise en page). Aucune de
   ces 4 épreuves n'a été touchée : la correction porte uniquement sur le nettoyage des 4 premières.

   **Vérifié contre `origin/main`** : `git show origin/main:lib/avertissements/signature-terrain.ts` ne
   contient aucun appel à `poserNotification` — sans ce producteur, la contrainte ne peut jamais être
   atteinte, donc ces 8 épreuves sont nécessairement vertes sur `origin/main`. Pas besoin de les y rejouer
   une à une pour confirmer la cause.

   **Correction** : chaque `afterAll` des 4 fichiers reçoit, juste avant la suppression de l'intervention, un
   `DELETE FROM "notification" WHERE "intervention_id" = …` (directement ou via la sous-requête sur
   `client_id`, selon la forme déjà utilisée dans chaque fichier) — même geste que
   `tests/isolation/avertissements-logo-en-echec.test.ts` (posé par 9J11 lui-même).

   Les lignes orphelines mesurées ci-dessus ont été retirées à la main dans `codiplan_test` (ordre :
   `notification` → `intervention_signature` → `segment_travail` → `intervention` → `site` → `client` →
   `prestation`), pour ne pas laisser la pollution d'une exécution interrompue fausser la suivante.

3. **Rejeu des 8 épreuves** : les 8 fichiers (31 tests au total) rejoués ensemble, `CI=1 --workers=1`, sur la
   branche : **31 passed**, aucun échec, aucun test instable.

4. **Portes de sortie** : `pnpm test:isolation` → 219 fichiers, 1886 tests, vert. `CI=1 pnpm verify` → vert
   (format, typecheck, lint, test unitaire — 502 fichiers/5517 tests —, test:isolation, build).

## Arbre

`git fetch origin` + `git rebase origin/main` : rien à rejouer, la branche part déjà d'`origin/main` à jour.
Arbre propre après ce commit. Aucun push.
