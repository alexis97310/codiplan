# 9K08-CHECKLIST-SCHEMA — passation

## La migration

`prisma/migrations/20261109080000_checklists_socle_9k08` — UNE migration, neuve.
Alexis devra la jouer en production et sur le site de test (`pnpm db:deploy`).

Quatre tables nouvelles :

- `checklist_modele` — l'en-tête (société, code, libellé, rattachement à UN SEUL
  type d'intervention nullable, famille et/ou modèle de matériel nullables,
  `exige_machine`, `actif`).
- `checklist_version` — n°, date de publication. Naît déjà publiée, **jamais
  modifiée** ensuite (`UPDATE`/`DELETE` retirés au rôle applicatif, patron
  `intervention_signature`).
- `checklist_point` — section (texte libre, aucune table `checklist_section`),
  ordre, libellé, consigne, obligatoire, type de réponse (trois valeurs
  fermées : `conforme_non_conforme_sans_objet`, `valeur_mesuree`, `case_faite`),
  unité et tolérances min/max — réservées à `valeur_mesuree`, facultatives et
  VIDES par défaut. Immuable comme sa version.
- `checklist_reponse` — intervention, point, **RECOPIE** du libellé/section/
  unité/obligatoire du point au moment de la réponse (patron
  `segment_travail.nom_technicien_affiche`, 9J22A), valeur (exactement une des
  trois selon le type, `num_nonnulls`), auteur, horodatage. `DELETE` retiré
  (I6) : une correction passe par `UPDATE`.

Plus `Intervention.checklist_version_id` (nullable, FK composite, `RESTRICT`) —
le PIN, posé une seule fois à la première réponse (lot CK2, ultérieur), jamais
réévalué. **Aucune migration de données** sur les lignes existantes.
`Prestation.checklist_type` est déclarée INERTE en commentaire de colonne :
non supprimée, non écrite.

## Les formes RLS, et CE QUE LE CLIENT NE PEUT PAS LIRE (D235)

Décision verbatim d'Alexis du 09/11/2026 ~07h45, écrite en entier dans
`docs/arbitrages.md` (D235) :

- `checklist_modele` : forme **« interne »** (D94) — société ET absence de
  `app.client_id`. **Aucun compte portail ne lit ce catalogue**, quel que soit
  son client : c'est la façon de travailler de la société, pas le résultat
  d'une intervention.
- `checklist_version` et `checklist_point` : forme **« filiation »** (D103),
  CHAÎNÉE — `checklist_version` sur `checklist_modele`, `checklist_point` sur
  `checklist_version` — exactement comme `vgp_observation` se chaîne sur
  `vgp_verification` sur `machine`. Aucune clause de société propre à aucun
  des deux étages ; la fermeture de `checklist_modele` se propage sans être
  réécrite. **Donc aucun compte portail ne lit ni les versions ni les points,
  par transitivité.**
- `checklist_reponse` : forme **« filiation »** (D103) sur `intervention` —
  **la SEULE des quatre tables qu'un compte portail peut lire**, et seulement
  pour SES interventions. Elle porte sa propre copie du libellé/section/
  unité/obligatoire : la lecture portail n'ouvre donc **jamais**
  `checklist_point`.

En clair : **le client voit tous les points de SA checklist remplie
(conformes, non conformes, mesures) via les RÉPONSES, jamais via les
modèles.** Un client ne sait pas qu'un gabarit existe, combien de gabarits sa
société possède, ni ce qu'ils contiennent — seulement ce qu'une intervention
lui a répondu.

`scripts/lib/politiques-rls.ts` : `TABLES_INTERNES` gagne une septième entrée
(`checklist_modele`) ; `TABLES_FILIATION` en gagne trois
(`checklist_version` → `checklist_modele`, `checklist_point` →
`checklist_version`, `checklist_reponse` → `intervention`).

## Le dépôt minimal (`lib/checklists/depot.ts`)

Trois fonctions, rien d'autre (la cascade de résolution, la saisie terrain et
le blocage de « Terminer » sont CK2/CK5/CK7, hors territoire) :

- `creerModele(contexte, saisie, client?)` — l'en-tête seul, sans version.
- `publierVersion(contexte, checklistModeleId, points, client?)` — le numéro
  est calculé DANS LA MÊME TRANSACTION que l'insertion (`findFirst` puis
  `create`), pour qu'aucune course ne le réutilise. Les points sont créés en
  deux temps (`checklistVersion.create` puis `checklistPoint.createMany`) —
  Prisma refuse `societe_id` explicite dans un `create` nested sur une
  relation composite.
- `dernierVersionPubliee(contexte, checklistModeleId, client?)` — le plus
  grand numéro, avec ses points dans l'ordre.

Aucun écran n'appelle ces trois fonctions (CK3, ultérieur) : elles sont
nommées avec leur motif dans `FONCTIONS_SANS_CHEMIN`
(`scripts/lib/chemins-de-depot.ts`), et le module `lib/checklists` dans
`MODULES_SANS_CHEMIN`.

## Choix de conception notés en cours de route

1. **Un SEUL type d'intervention par modèle, jamais un tableau.** L'ancien
   brouillon (9J12, remplacé) envisageait `TypeIntervention[]` ; aucune colonne
   de ce dépôt ne porte un tableau d'énumération (mesuré). Un contrôle qui
   s'appliquerait à plusieurs types se pose comme PLUSIEURS modèles, un code
   chacun.
2. **Aucune table `checklist_section`** : la section est un simple libellé
   texte porté par chaque point — la structure la plus simple qui rende un
   gabarit en sections sans lui ajouter un niveau.
3. **`checklist_reponse` ne porte pas `checklist_version_id`** : le point
   suffit (`checklist_point.checklist_version_id` le porte déjà, et le point
   est immuable) — éviter une seconde lecture du même fait.
4. **Immutabilité par privilège retiré (`REVOKE UPDATE, DELETE`), jamais par
   déclencheur** : patron `intervention_signature`, le plus simple du dépôt.
   Noté en passant : le `GRANT` de `suite_a_donner` (9J17) omet `DELETE` sans
   le `REVOKE` explicite — `ALTER DEFAULT PRIVILEGES` (migration
   `20260820130000`) accorde pourtant les quatre verbes d'avance à
   `codiplan_app` sur toute table neuve. Ce ticket n'y touche pas (hors
   territoire), mais le motif de son commentaire (« l'absence de grant
   referme ce verbe ») mérite vérification par qui touchera `suite_a_donner`.

## Épreuves

- `tests/isolation/checklists.test.ts` : TÉMOIN (RLS en vigueur, FORCE, et
  MORD) sur les trois tables internes/filiation ; un compte portail ne lit
  AUCUNE ligne de `checklist_modele`/`checklist_version`/`checklist_point`,
  même de sa société ; le bureau lit les modèles de SA société, jamais d'une
  autre ; PREUVE des clauses lues dans `pg_policies` (aucune ne recopie une
  clause de société propre à l'étage fille) ; IMMUABLE — une version publiée
  et un point refusent `UPDATE`/`DELETE` EN BASE ; un compte portail lit les
  réponses de SON intervention, jamais celles d'un autre client (même
  société) ni d'une autre société ; RECOPIE éprouvée ; le chemin de
  production (`creerModele` → `publierVersion` → `dernierVersionPubliee`,
  y compris une seconde publication qui incrémente le numéro sans toucher la
  première).

## Gardiens mis à jour à leur source

- `lib/db/migrations-attendues.ts` — la migration neuve.
- `scripts/lib/politiques-rls.ts` — `TABLES_INTERNES`, `TABLES_FILIATION`,
  `INTERNES_ARBITREES`, `FILIATION_ARBITREE`.
- `scripts/lib/chemins-de-depot.ts` — `MODULES_SANS_CHEMIN`,
  `FONCTIONS_SANS_CHEMIN`.
- `docs/cahier-des-charges.md` (chapitre 11.2) — les quatre tables et le pin.
- `docs/constitution/organisation-du-code.md` (§6) — `lib/checklists/` ;
  sommaire régénéré (`pnpm sommaires:regenerer`).
- `docs/arbitrages.md` — D235.
- Listes closes : `tests/unit/db/formes-du-lot-8.test.ts` (treizième forme,
  sept tables désormais) ; `tests/unit/db/inventaire.test.ts` (quatre clés de
  décompte à zéro) ; `tests/unit/db/perimetre-audit.test.ts` (quarante-sept
  tables auditées, pas quarante-trois) ; `tests/unit/docs/
  constitution-indexee.test.ts` (deux lignes décalées par le sommaire
  régénéré).

## Ce qui reste dû (lots suivants, hors territoire ici)

CK2 (cascade de résolution modèle > famille > type seul > aucun, écriture des
réponses, upsert par point) ; CK3 (écran de paramétrage) ; CK4 (gabarits de
départ validés par Alexis à l'atelier) ; CK5/CK6 (saisie terrain et
hors-ligne) ; CK7 (blocage de « Terminer » sur un point obligatoire,
amendement effectif de RG-INT-02) ; CK8/CK9 (rendu sur le bon et la fiche
bureau).

## Vérification

`CI=1 pnpm verify` vert (format, typecheck, lint, test, test:isolation,
build). `pnpm test` : 5559 passés. `pnpm test:isolation` : 1988 passés.
`verify:full` est laissé à la file de nuit.
