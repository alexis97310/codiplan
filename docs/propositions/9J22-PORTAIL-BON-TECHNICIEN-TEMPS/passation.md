# 9J22-PORTAIL-BON-TECHNICIEN-TEMPS — passation

## La migration à jouer, nommément

```
20261107050000_portail_bon_technicien_temps_9j22
```

Deux politiques SELECT permissives AJOUTÉES, aucune politique existante touchée.

### Sur `segment_travail` (forme « interne », D94, inchangée par ailleurs)

```sql
CREATE POLICY "cloisonnement_filiation_lecture_portail" ON "segment_travail"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.client_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "segment_travail"."intervention_id"
    )
  );
```

### Sur `utilisateur` (formes « désignation »/« rattachement », L1-02c, inchangées)

```sql
CREATE POLICY "utilisateur_lecture_filiation_portail" ON "utilisateur"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.client_id', true), '') IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM "segment_travail" "st" WHERE "st"."utilisateur_id" = "utilisateur"."id")
      OR EXISTS (SELECT 1 FROM "intervention" "i" WHERE "i"."technicien_id" = "utilisateur"."id")
    )
  );
```

### Ce que ces deux politiques N'OUVRENT PAS

- Aucun segment ni aucune identité de technicien d'une intervention HORS du
  périmètre du client (autre site, autre client, autre société) : les deux
  `EXISTS` empruntent la politique « parc » (D84) d'`intervention`, qui reste
  la SEULE porte — rien n'est réécrit au-dessus.
- Aucun contexte interne ne gagne quoi que ce soit : les deux brèches lisent
  `app.client_id IS NOT NULL`, qui exclut structurellement tout rôle interne.
- Aucune colonne d'`utilisateur` autre que `nom` n'est destinée à franchir
  cette porte : la table ne porte de toute façon ni adresse, ni téléphone, ni
  habilitation, ni absence (ces colonnes vivent dans `utilisateur_societe` /
  `technicien` / `absence`, cloisonnées séparément, non touchées). La seule
  colonne supplémentaire que la ligne ouvre est `email` ("le compte") — ce
  n'est PAS une politique qui le retient, c'est la discipline de sélection du
  SEUL appelant sous ce contexte, `nomsDesPersonnes`/`annuaireDesPersonnes`
  (`lib/auth/annuaire.ts`, inchangé), qui ne lit jamais que `{id, nom}`. Voir
  « ce qui reste dû » ci-dessous si ce point vous inquiète.
- Aucun montant, aucun taux : `segment_travail` n'en porte aucun, et le
  gardien `tests/unit/portail/bon-sans-montant.test.ts` reste vert sans
  modification.

## 1. Mesure (demandée en tête du ticket)

- Les deux politiques qui excluaient tout contexte portant `app.client_id` :
  `segment_travail.cloisonnement_interne_lecture`
  (`prisma/migrations/20260915010000_compteur_du_technicien_r5_02/migration.sql:166-171`,
  forme « interne », D94) et `utilisateur.utilisateur_lecture`, branche
  « rattachement »
  (`prisma/migrations/20260907130000_identites_cloisonnees_l1_02c/migration.sql:121-144`,
  décision d'exploitation du 07/09/2026).
- Lecture du bon côté portail : `bonInterventionDuParc`
  (`app/(portail)/portail/interventions/depot.ts:160-173`) appelle
  `lireBonDuParc` (`lib/interventions/bon.ts:214-220`), qui appelle
  `composerBon` (`lib/interventions/bon.ts:231-483`) SANS restriction
  supplémentaire — la même fonction que le back-office. `composerBon` lisait
  déjà `tx.segmentTravail.findMany` (ligne ~305) et `annuaireDesPersonnes`
  (ligne ~310) : **aucun changement de code n'était nécessaire dans
  `composerBon`** une fois les deux politiques posées — c'est très exactement
  pour ça que le ticket demandait de mesurer d'abord.
- Patron réutilisé pour la nouvelle politique : forme « filiation » (D103),
  recopiée de `intervention_statut_historique`
  (`prisma/migrations/20261104100000_historique_des_etats_9j08a/migration.sql`),
  avec une garde `app.client_id IS NOT NULL` en plus — sans elle, la brèche
  aurait aussi ouvert le contexte interne, ce qui n'était pas demandé et
  aurait été redondant avec `utilisateur_lecture`'s branche « rattachement ».

## 2. Le gardien statique qu'il a fallu étendre

`scripts/lib/politiques-rls.ts` vérifie que CHAQUE politique d'une table
« interne » (ici `segment_travail`) respecte la forme « interne » pure —
sans exception, avant ce ticket. Une politique supplémentaire scopée au
portail n'est PAS la forme « interne » (elle ne s'ancre pas sur
`societe_id`, elle lit `app.client_id` PRÉSENT au lieu d'ABSENT) : le
gardien la refusait, à raison, tant qu'elle n'était pas déclarée.

Ajout : `BRECHES_FILIATION_DES_TABLES_INTERNES` (liste close, gardée côté
ADDITION — le retrait referme la table sur l'interne pur, jamais le geste
dangereux) et une branche dans `ecartsInterne` qui valide une brèche
déclarée contre SA PROPRE forme (client présent + `EXISTS` sur le parent)
plutôt que contre la forme interne. Une brèche non déclarée continue d'être
jugée — et refusée — comme n'importe quelle autre politique de la table.

`utilisateur` n'a pas eu besoin du même traitement : elle n'a pas de
`societe_id` (4ᵉ catégorie de I1) et n'entre donc jamais dans
`tablesPremiereCategorie` — ce gardien précis ne la regarde pas du tout. Pas
d'autre gardien trouvé qui vérifie la forme de ses politiques une par une.

## 3. Épreuves d'isolation

- `tests/isolation/9j22-portail-bon-technicien-temps.test.ts` (nouveau) :
  le client DE l'intervention lit le nom et les segments via
  `bonInterventionDuParc` ; un AUTRE client de la même société et une AUTRE
  société ne lisent ni l'un ni l'autre, par le bon ET par une lecture directe
  de `segment_travail`/`utilisateur` ; la clause RÉELLE des deux politiques
  est lue dans l'épreuve (`pg_policies.qual`), pas supposée.
- `tests/isolation/compteur-du-technicien.test.ts` : le scénario qui
  affirmait « un compte PORTAIL ne lit AUCUN segment » portait en fait le
  client A1, propriétaire de l'intervention fixture — devenu faux par
  construction. Changé pour CLIENT_A2 (un AUTRE client), qui reste fermé ;
  la preuve positive vit dans le fichier dédié ci-dessus.
- `tests/isolation/politiques-rls.test.ts`, `annuaire-des-personnes.test.ts`,
  `9j08a-portail-bon.test.ts` : rejoués sans régression (le second n'avait
  pas besoin de changer — la population de son scénario n'est pas liée aux
  interventions visibles au compte portail qu'il éprouve).

## 4. Le bon portail

`app/(portail)/portail/interventions/[id]/bon/page.tsx` affiche désormais la
ligne « Technicien » et le tableau des segments dans la tuile
« Intervention », structure et clés i18n identiques au back-office, mise en
forme réécrite dans `presentation.ts` du portail (§6, chaque écran porte la
sienne — jamais importée du back-office). Aucun montant, aucun taux :
`tests/unit/portail/bon-sans-montant.test.ts` reste vert sans modification.

## 5. Captures — APRÈS SEULEMENT

`tests/e2e/captures-9j22-portail-bon-technicien-temps.spec.ts`, trois
captures (`375px`, `1280px`, impression) dans
`docs/propositions/9J22-PORTAIL-BON-TECHNICIEN-TEMPS/captures/`. Vérifiées à
l'œil : le technicien (« D. Garnier ») et le segment (05/11/2026 19:00 →
20:00, 1 h 00) s'affichent, aucun montant nulle part.

**Sans AVANT** (même constat déjà posé par 9J21-PORTAIL-FINITIONS-INVITATION,
point 7) : un AVANT fidèle exige de rejouer le code d'avant ce ticket
(avant le commit du point 4 — `segments`/`technicienAffecte` y restent
vides côté portail, même intervention, même données) sous un serveur
`next build && next start` reconstruit, puis de revenir et reconstruire à
nouveau — deux compilations de production en plus du budget de 120 minutes.
Pour qui veut le compléter : `git log --oneline` pour trouver le commit
« point 3 » de ce ticket (juste avant « point 4 »), `git checkout <sha> --
"app/(portail)/portail/interventions/[id]/bon/page.tsx"
"app/(portail)/portail/interventions/[id]/bon/presentation.ts"`, rebuild,
capturer, puis `git checkout HEAD -- <mêmes fichiers>` pour revenir avant de
committer quoi que ce soit.

## Ce qui reste dû

- **La discipline de colonnes sur `utilisateur` repose sur le seul appelant**
  (`lib/auth/annuaire.ts`), pas sur une politique qui bornerait les colonnes
  — PostgreSQL ne sait pas border une politique RLS par colonne, et ce dépôt
  n'a qu'un seul rôle applicatif (`codiplan_app`) pour tous les contextes,
  interne comme portail : une politique-ligne ouvre TOUTES les colonnes de la
  ligne à TOUTE requête tenue sous ce contexte, pas seulement à celle qui l'a
  écrite. Si un jour un AUTRE appelant lit `utilisateur` sous un contexte
  portail sans se limiter à `{id, nom}`, il verrait aussi `email`
  ("le compte"). Le ticket l'interdit explicitement ; je ne l'ai pas fermé en
  base, parce que je n'ai trouvé aucun mécanisme du dépôt qui le permette
  sans l'un des deux gestes que l'INTERDITS du ticket m'enjoignait de ne PAS
  prendre sans m'arrêter d'abord (élargir une fonction partagée en
  `SECURITY DEFINER`, exclu par D50 ; ou un second rôle PostgreSQL, hors
  architecture actuelle). Si ce point doit être fermé plus fort qu'« un seul
  appelant discipliné », c'est un ticket à part, avec son propre arbitrage.
- Captures AVANT — voir §5.

## Vérification

`pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:isolation`
verts après chaque commit. `verify:full` laissé à la file.

## Fichiers touchés

- `prisma/migrations/20261107050000_portail_bon_technicien_temps_9j22/migration.sql` (nouveau)
- `scripts/lib/politiques-rls.ts` — `BRECHES_FILIATION_DES_TABLES_INTERNES`, `ecartsInterne`
- `lib/db/migrations-attendues.ts` — migration ajoutée
- `tests/isolation/compteur-du-technicien.test.ts` — scénario corrigé
- `tests/isolation/9j22-portail-bon-technicien-temps.test.ts` (nouveau)
- `lib/interventions/bon.ts` — docblock de `lireBonDuParc`
- `app/(portail)/portail/interventions/[id]/bon/page.tsx` — affiche technicien + segments
- `app/(portail)/portail/interventions/[id]/bon/presentation.ts` — trois fonctions ajoutées
- `tests/e2e/captures-9j22-portail-bon-technicien-temps.spec.ts` (nouveau)
- `docs/propositions/9J22-PORTAIL-BON-TECHNICIEN-TEMPS/captures/*.png` (nouveau)

---

## Reprise 9J22A-REPRISE-9J22 (07/11/2026 ~13:30–14:20)

### Décision qui déclenche la reprise

Décision d'Alexis (07/11/2026 ~12:15), sur CETTE passation elle-même, §« Ce
qui reste dû » ci-dessus : *« la restriction aux colonnes `{id, nom}`
d'`utilisateur` ne tient que par la discipline du seul appelant, pas par la
base »* — un contexte client pouvait lire en base TOUTE la ligne `utilisateur`
d'un technicien de ses interventions (`email` compris), ce que le contrat de
9J22 interdisait nommément. **Le geste choisi : recopier le nom affiché là où
le client lit déjà (`segment_travail`), et retirer la politique sur
`utilisateur` — jamais l'élargir ni la border par colonne (impossible en
PostgreSQL avec un seul rôle applicatif, voir la mesure ci-dessus).**

### La migration NEUVE, nommément

```
20261107060000_portail_nom_technicien_recopie_9j22a
```

1. `ALTER TABLE "segment_travail" ADD COLUMN "nom_technicien_affiche" TEXT` (nullable).
2. Backfill `UPDATE segment_travail SET nom_technicien_affiche = utilisateur.nom
   FROM utilisateur WHERE ...` — `NO FORCE ROW LEVEL SECURITY` posé sur LES DEUX
   tables (`segment_travail` ET `utilisateur`, les deux FORCE-RLS) pour la durée
   du backfill, la levée CONSTATÉE par un témoin `relforcerowsecurity` avant
   d'écrire quoi que ce soit (même discipline que L1-02), `FORCE` restauré
   ensuite sur les deux.
3. `ALTER COLUMN "nom_technicien_affiche" SET NOT NULL`.
4. `DROP POLICY "utilisateur_lecture_filiation_portail" ON "utilisateur"` —
   RETIRÉE, jamais rétrécie : les deux formes d'origine de `utilisateur`
   (« désignation », « rattachement », L1-02c) restent entières et inchangées.
   La politique `cloisonnement_filiation_lecture_portail` de `segment_travail`
   (posée par 9J22) n'est PAS touchée : la mesure du point 1 (ci-dessous)
   montre que la table ne porte aucune colonne de coût, de taux ni de montant.

### Mesure (point 1 du ticket 9J22A)

- **Colonnes de `segment_travail`** (`prisma/schema.prisma`) : `id`,
  `societe_id`, `intervention_id`, `utilisateur_id`, `debut`, `fin`,
  `saisi_hors_reseau`, `cree_le`, `modifie_le`. Aucune colonne de coût, de
  taux ou de montant — la question ne se posait déjà pas pour la brèche de
  9J22, et elle ne se pose pas davantage ici.
- **Où naît le segment** : UN SEUL chemin d'écriture dans tout le dépôt —
  `tx.segmentTravail.create` en `lib/interventions/depot-compteur.ts`
  (`demarrerLeCompteur`). Les segments ne changent JAMAIS d'auteur après coup
  (aucun `update` n'écrit `utilisateur_id` nulle part) : la colonne recopiée
  n'a donc besoin d'être écrite qu'UNE FOIS, à la création, jamais réécrite.
- **Où le bon lit le nom** : `composerBon` (`lib/interventions/bon.ts`), pour
  DEUX champs — `segments[].technicien` (depuis `segment_travail`) ET
  `technicienAffecte` (depuis `intervention.technicien_id`, un champ qui peut
  être renseigné SANS qu'aucun segment existe). Le ticket 9J22A ne demandait
  de recopier que sur `segment_travail` ; `technicienAffecte`, sous un
  contexte client, est donc résolu en cherchant, PARMI LES SEGMENTS DÉJÀ LUS,
  celui dont `utilisateur_id` égale `technicien_id` — `null` si aucun n'existe
  (un technicien affecté qui n'a encore posé aucun segment de SA main n'a,
  sous ce seul contexte, aucun nom à afficher). Le back-office, lui, continue
  de résoudre les deux par `lib/auth/annuaire.ts`, inchangé.
- **L'extension du gardien `scripts/lib/politiques-rls.ts`** : CONTRAIREMENT à
  ce que l'énoncé du ticket supposait, aucune exception nommée n'existait
  pour `utilisateur_lecture_filiation_portail` — `BRECHES_FILIATION_DES_TABLES_
  INTERNES` (ajoutée par 9J22) ne porte QUE l'entrée de `segment_travail`
  (`utilisateur` n'est pas une table de la forme « interne » de I1 ; son
  propre système de formes, « désignation »/« rattachement », n'a jamais reçu
  d'entrée pour cette troisième brèche). **Rien n'a donc été retiré de ce
  fichier** : le `DROP POLICY` de la migration est la SEULE fermeture
  nécessaire, et `9j22-portail-bon-technicien-temps.test.ts` porte désormais
  un test de CONSTAT (la politique n'existe plus) plutôt que de clause.

### Ce que le client peut encore lire, après cette reprise

- Le nom affiché d'un technicien **qui a posé au moins un segment** de SON
  intervention — par la recopie, jamais par une lecture de `utilisateur`.
- Rien d'autre d'`utilisateur` : AUCUNE ligne de cette table, pas même celle
  du technicien de sa PROPRE intervention (épreuve ajoutée, voir plus bas) —
  ni `email`, ni quoi que ce soit.
- Un technicien **affecté mais qui n'a posé aucun segment** de cette
  intervention n'est plus nommé sous le portail (`technicienAffecte: null`),
  à la différence du back-office qui continue de le nommer. C'est une
  conséquence MESURÉE du choix du ticket (recopier sur `segment_travail`
  seul), pas un oubli — si ce point doit être fermé plus fort, c'est un choix
  à soumettre : soit l'accepter (un technicien affecté sans travail déclaré
  n'a rien à montrer au client), soit recopier AUSSI sur `intervention` (une
  seconde colonne, hors scope de ce ticket).

### Épreuves d'isolation (point 6)

`tests/isolation/9j22-portail-bon-technicien-temps.test.ts` réécrit : le test
de clause sur `utilisateur_lecture_filiation_portail` devient un test de
CONSTAT (la politique a disparu) ; une épreuve neuve vérifie qu'un contexte
client ne lit AUCUNE ligne `utilisateur`, PAS MÊME celle du technicien de sa
PROPRE intervention — exactement le point que 9J22A ferme et que 9J22 avait
laissé ouvert. Les épreuves existantes (nom affiché, segments, exclusivité
inter-client et inter-société) restent vertes avec la nouvelle source.

**Effet de bord mesuré, et traité** : `segment_travail.nom_technicien_affiche`
étant `NOT NULL`, TOUTE fixture du dépôt qui pose un segment par SQL brut ou
par `segmentTravail.create` devait la renseigner — 10 fichiers
`tests/isolation/*.test.ts`, 1 fichier `tests/e2e/setup/scene.ts` partagé par
plusieurs scénarios, et 9 fichiers `tests/e2e/*.spec.ts` supplémentaires.
Corrigés tous ensemble (sous-requête sur `utilisateur.nom` quand le fichier
raw-SQL le permet, littéral `"Technicien de l'épreuve"` pour les créations
Prisma qui ne portent pas sur l'affichage du bon). Une fixture de « base âgée »
neuve (`tests/isolation/fixtures/base-agee/20261107060000_...j22a.sql`) pose
un segment réel AVANT la migration, pour que le backfill soit éprouvé contre
une ligne, pas contre une table vide (gardien `migrations-sur-base-agee.test.ts`).

### Captures (point 7)

AUCUN fichier neuf : le changement est invisible à l'écran (seule la
PROVENANCE du nom change, jamais ce qu'il affiche). Les trois captures
existantes de 9J22 (`bon-technicien-temps-apres-{375,1280,impression}.png`)
ont été RÉGÉNÉRÉES contre le code de cette reprise — `git status` les montre
byte-identiques aux précédentes, ce qui CONFIRME l'absence de régression
visuelle plutôt que de la supposer.

### Vérification jouée

`pnpm test` (5541 tests), `pnpm test:isolation` (1945 tests), la capture e2e
ciblée (3 tests), puis `CI=1 pnpm verify` — tous verts. `verify:full` laissé
à la file de nuit.

### Fichiers touchés par cette reprise

- `prisma/schema.prisma` — colonne `segment_travail.nom_technicien_affiche`
- `prisma/migrations/20261107060000_portail_nom_technicien_recopie_9j22a/migration.sql` (nouveau)
- `lib/db/migrations-attendues.ts` — migration ajoutée
- `lib/interventions/depot-compteur.ts` — recopie du nom à la création du segment
- `lib/interventions/bon.ts` — `composerBon` ne lit plus `utilisateur` sous un contexte client
- `tests/isolation/9j22-portail-bon-technicien-temps.test.ts` — réécrit
- `tests/isolation/fixtures/base-agee/20261107060000_...j22a.sql` (nouveau)
- 10 fichiers `tests/isolation/*.test.ts` — fixture `segment_travail` complétée
- `tests/e2e/setup/scene.ts` + 10 fichiers `tests/e2e/*.spec.ts` — idem
