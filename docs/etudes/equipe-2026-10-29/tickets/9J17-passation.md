# 9J17-SUITE-A-DONNER-SCHEMA — passation

Budget : T0 12:26 (Pacific/Noumea), limite 150 min. Terminé sans dépasser T0+90 pour le code neuf.

## Migration

`prisma/migrations/20261106010000_suite_a_donner_9j17/migration.sql`.

## Point par point

1. **Décision D231** ajoutée en fin de `docs/arbitrages.md` (après D230) : FLX-1 proposait huit états ;
   réduits à SEPT — juste ce dont FLX-2/FLX-3/FLX-8 (les seules relances qui restent au périmètre V1) ont
   besoin. `piece_attendue` n'est pas un huitième état : deux colonnes nullables, même patron que
   `Intervention.piece_attendue_ref`/`date_dispo_prevue` (RG-INT-06, D117). La table prend la forme
   « filiation » (D103, septième entrée), pas « parc » : sa visibilité se déduit entièrement de
   l'intervention d'origine.
2. **Migration** `suite_a_donner` : `id`, `societe_id NOT NULL`, `intervention_origine_id NOT NULL` (le
   PARENT au sens RLS, `ON DELETE CASCADE`), `intervention_reprise_id` (nullable, `ON DELETE RESTRICT`,
   ne décide jamais de la visibilité), `statut` (énumération fermée, les sept valeurs), `motif_sans_suite`,
   `piece_attendue_ref`/`date_dispo_prevue`, `qualifiee_par`/`qualifiee_le`, `cree_le`, `modifie_le`. Forme
   « filiation » posée dans la même migration : `ENABLE`/`FORCE ROW LEVEL SECURITY`, policy
   `cloisonnement_filiation` (EXISTS sur `intervention`, aucune clause de société), `GRANT SELECT, INSERT,
   UPDATE` seulement (aucun `DELETE` — rien ne supprime une ligne), déclencheur `journal_audit` (I8).
   **Corrigée sur place après l'épreuve d'isolation** (voir point 4b) : l'équivalence stricte entre
   `motif_sans_suite` et le statut COURANT refusait la clôture d'un dossier `sans_suite` ; remplacée par
   deux CHECK qui laissent le motif lisible après `cloturee` sans jamais le permettre ailleurs — la
   migration n'avait touché que la base jetable de test, donc corrigée en place plutôt qu'ajoutée en
   seconde migration (§7).
3. **`lib/suite-a-donner/depot.ts`** : `qualifierSuite` (crée et qualifie dans le même geste — aucune autre
   fonction de ce dépôt ne crée de ligne), `enregistrerAccord` (union discriminée `accord_recu`/
   `sans_suite`, la première portant en option l'attente de pièce), `marquerPieceRecue` (nulle les deux
   colonnes de l'horizon et fait passer à `a_replanifier`, une transaction), `cloturer`. Les transitions
   `qualifiee → accord_attendu` (FLX-3) et la relance de pièce elle-même (FLX-8) restent hors territoire :
   aucun écran de ce ticket n'a besoin de les traverser.
4. **Épreuves d'isolation** (`tests/isolation/suite-a-donner.test.ts`) : le bloc filiation LIT la clause
   (témoin RLS, société A/B, filtre de périmètre qui se propage sans être écrit dans la politique fille,
   preuve que la politique ne nomme ni `client_id` ni `perimetre_sites`, autre client ne voit rien) — même
   discipline que `tests/isolation/intervention-machines.test.ts` (D103). Puis le chemin de production
   traversé par les quatre fonctions, et trois épreuves directes des CHECK en base (`sans_suite` sans
   motif, pièce sans date, pièce hors `accord_recu`).
5. **Câblage des gardiens fermés** — non prévu par le ticket, découvert en jouant `pnpm test` dès l'écriture
   du schéma, même scénario que 9J09 :
   - `scripts/lib/politiques-rls.ts` (`TABLES_FILIATION`/`FILIATION_ARBITREE`) — septième entrée, parent
     `intervention`, clé `intervention_origine_id`.
   - `lib/db/migrations-attendues.ts` — migration ajoutée.
   - `scripts/lib/chemins-de-depot.ts` (`MODULES_SANS_CHEMIN`/`FONCTIONS_SANS_CHEMIN`) — le module et ses
     quatre fonctions n'ont aucun appelant (écran 9J18, relances FLX-2/FLX-3/FLX-8), nommés avec leur motif.
   - `tests/unit/db/inventaire.test.ts` — `suite_a_donner: 0` ajouté aux trois décomptes fixtures.
   - `tests/unit/db/perimetre-audit.test.ts` — quarante-TROIS tables auditées (le titre du scénario a
     changé avec le compte), `suite_a_donner` ajoutée à sa place alphabétique avec son motif.
   - `docs/cahier-des-charges.md` chapitre 11.2 — `suite_a_donner` ajoutée (rang 3, le modèle de données
     omettait la table).
   - `docs/constitution/organisation-du-code.md` §6 — `lib/suite-a-donner/` ajouté au sommaire et à
     l'arborescence détaillée, `pnpm sommaires:regenerer` joué ; les deux mutations figées de
     `tests/unit/docs/constitution-indexee.test.ts` (numéros de ligne 77/123 de CE fichier précis, déjà
     décalés une fois par 9J09) remises à jour (78/124) après le décalage que l'ajout d'une ligne au
     sommaire a introduit.

## Ce qui reste à faire (prochains tickets, déjà nommés par le territoire)

1. **9J18** — les écrans qui qualifient, enregistrent l'accord et clôturent, et qui appellent les quatre
   fonctions de ce dépôt.
2. **FLX-2 / FLX-3 / FLX-8** — les relances futures qui produisent `qualifiee`, `accord_attendu` et
   déclenchent `marquerPieceRecue` à la réception réelle d'une pièce.
3. **9J19** — la notification de suite à donner, qui ajoutera `suite_a_donner_id` à la cible disjointe de
   `Notification` (déjà annoncé dans son commentaire de schéma depuis 9J09).
4. Les deux exemptions de gardiens ci-dessus (point 5, chemins) se retirent au fil de 9J18 et des FLX,
   chacune avec son motif déjà écrit.

## Vérification jouée

`CI=1 pnpm verify:full` lancé en un seul appel, sortie dans
`docs/etudes/equipe-2026-10-29/tickets/9J17-verify-final.txt`.
