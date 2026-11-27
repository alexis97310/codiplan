# 9L60-PRET-1-MODELE — passation

## Ce qui a été fait

Lot 1/3 du module de prêt d'équipement (décision d'Alexis du 27/11/2026 ~09h30 NC,
D287) : le socle — modèle de données, parc de prêt, règles en base, dépôt, capacité.
**Aucun écran** : explicitement hors périmètre de ce lot (« sans écran neuf sauf le
strict nécessaire »). Pas de capture, donc.

### Point 1 — mesure et arbitrage (D287)

`Machine` exige quatre colonnes obligatoires NOT NULL (D6), dont `client_id` et
`site_id` : les rendre nullables pour accueillir un appareil sans client aurait
affaibli un invariant déjà posé pour tout le parc existant. **Table séparée** :
`appareil_pret`, propre à la société, aucune colonne `client_id`. Décision écrite dans
`docs/arbitrages.md` (D287), avec sa condition de réouverture.

Deuxième question : la forme RLS de `pret_equipement`. Elle porte `client_id`/`site_id`
(recopiés de l'intervention à la sortie), donc elle est fille de trois tables « parc »
(`client`, `site`, `intervention`) — la forme « filiation » la réclamerait par défaut,
mais rendrait les lignes visibles à un compte portail restreint à son périmètre, qui
apprendrait qu'un appareil de remplacement lui a été prêté (une donnée sur le
fonctionnement du bureau, pas sur son parc). **Forme « interne »** retenue (D287), même
régime que `notification`/D229 et `document_recu`/D94 : décision 1 du cadrage — le
bureau seul gère les prêts, jamais le portail.

### Point 2 — la migration (une seule pour les trois lots)

`prisma/migrations/20261128060000_pret_equipement_9l60/migration.sql` :

- `appareil_pret` (forme « société ») : désignation, marque, modèle, numéro de série,
  statut (`disponible`/`prete`/`en_revision`), actif.
- `pret_equipement` (forme « interne ») : appareil, intervention (obligatoire), client
  et site (recopiés), date de sortie, date de retour prévue, date de retour réelle
  (nulle tant qu'en cours), état au départ, état au retour, observations, auteurs de
  la sortie et du retour ; **réservées au lot 3**, posées mais non écrites par ce lot :
  `signataire_nom`, `signataire_qualite`, `signature_objet_cle`, `bon_document_id`
  (FK composite vers `document`, sans relation Prisma — même choix que
  `notification.destinataire_id`, D39), `date_signature`.
- Gardes en base : index unique PARTIEL `(societe_id, appareil_id) WHERE
  date_retour_reelle IS NULL` (au plus un prêt en cours par appareil — pas une
  contrainte d'exclusion, inutile ici, aucune plage de temps à comparer) ; deux `CHECK`
  (retour prévu et retour réel jamais avant la sortie).
- RLS : `cloisonnement_societe` sur `appareil_pret`, `cloisonnement_interne` sur
  `pret_equipement`, plus le verrou portail d'écriture (9K16, D237) sur les DEUX —
  nécessaire même sur la forme « interne », déjà fermée en lecture ET écriture par sa
  propre clause : c'est une seconde ligne de défense NOMMÉE, mesurée dans
  `pg_policies`, comme sur `notification`/`document_recu`.
- `journal_audit` sur les deux (I8, périmètre inversé — auditées à la naissance).

`prisma/schema.prisma` : les deux modèles, `enum StatutAppareilPret`. Inverses
`@ignore`'ées sur `Societe`, `Client`, `Site`, `Intervention`, `AppareilPret` (mémoire
du plafond de build 9L04A) : aucun chemin de ce lot ne les navigue.

### Point 3 — le dépôt (`lib/prets/`)

`saisie.ts` (Zod), `depot.ts` (créer un appareil, sortir un prêt, enregistrer un
retour, lister les prêts en cours/en retard), `retard.ts` (« en retard » est une
LECTURE, jamais un statut stocké, même patron que `lib/interventions/retard.ts`).

La capacité `gerer_prets` (ADMS/DIR/RM/RS/ADV au complet, jamais TEC ni CLI) est
vérifiée **dans le dépôt lui-même** (`exigerCapaciteDepot`), pas seulement à une porte
de route — ce lot ne pose aucune route pour l'intercepter. Les lots 2 et 3 appelleront
`exigerCapaciteComplete("gerer_prets")` EN PLUS, jamais à sa place (même principe que
`lib/machines/garde-statut.ts`). Refus nommés : `CapaciteGererPretsRequise`,
`AppareilIndisponible`, `InterventionIntrouvable`, `RetourAvantSortie`,
`PretIntrouvable`, `PretDejaRetourne`. `id` toujours en paramètre (généré par
l'appelant, `uuidv7()`) ; aucune comparaison de société écrite dans le dépôt — tout
passe par `avecContexteApplicatif`.

### Point 4 — gardiens dérivés du schéma, remis en phase

Une table neuve touche beaucoup de listes closes ou dérivées ; toutes mesurées puis
corrigées, aucune assouplie :

- `lib/auth/habilitations.ts` : capacité `gerer_prets`. `lib/i18n/fr.ts` :
  `capacite.gerer_prets` — **« Gérer les prêts d'appareils »**, pas « … d'équipement » :
  « équipement » est un synonyme fermé de `Machine` (`tests/unit/i18n/
  vocabulaire-impose.test.ts`), sans exemption.
- `scripts/lib/politiques-rls.ts` : `pret_equipement` ajoutée à `TABLES_INTERNES`
  (`INTERNES_ARBITREES`, avec son motif). `appareil_pret` retombe sur la forme
  « société » par défaut (aucune liste à toucher).
- `lib/db/migrations-attendues.ts` : nouvelle migration ajoutée.
- `docs/cahier-des-charges.md` (chapitre 11.2) et `docs/constitution/
  organisation-du-code.md` (§6, `lib/prets/`) : les deux tables et le module décrits.
  Sommaires régénérés par `pnpm sommaires:regenerer` — **deux passes nécessaires** :
  la première ajoute la ligne `lib/prets/` au sommaire, ce qui décale TOUT ce qui suit
  dans le fichier (y compris les cibles déjà correctes plus haut, qui se retrouvent
  décalées À LEUR TOUR par l'ajout) ; la seconde pass stabilise. `tests/unit/docs/
  constitution-indexee.test.ts` portait aussi deux fixtures à numéro de ligne codé en
  dur (`lib/db/` ligne 79→80, `lib/auth/` ligne 125→126) — corrigées.
- `tests/unit/db/inventaire.test.ts`, `tests/unit/db/perimetre-audit.test.ts`
  (50→52 tables auditées, titre du test renommé en conséquence) : les deux tables
  ajoutées aux objets de fixture, dérivés du schéma réel.
- `scripts/lib/chemins-de-depot.ts` : `lib/prets` ajouté à `MODULES_SANS_CHEMIN`, et
  les NEUF fonctions exportées de `depot.ts` nommées individuellement dans
  `FONCTIONS_SANS_CHEMIN` (motif : lot 2, écrans du parc/sortie/retour).
- `tests/isolation/portail-matrice.test.ts` : `appareil_pret` → `"societe"`,
  `pret_equipement` → `"fermee"`.
- `lib/feuille-de-route/contenu.ts` : l'entrée quitte « À écrire après la démo »
  (le cadrage n'est plus à faire) et rejoint « Décisions prises » au statut
  `en_cours`.

### Point 5 — épreuves

`tests/unit/prets/retard.test.ts` (pure, fuseau UTC+11 compris, même piège documenté
que `tests/unit/interventions/retard.test.ts`). `tests/unit/auth/habilitations.test.ts`
(nouveau bloc D287). `tests/isolation/prets.test.ts` : témoin RLS (société A/B,
`appareil_pret` et `pret_equipement`), fermeture au portail (RLS directe ET via
`listerPretsEnCours`), capacité `gerer_prets` refusée au technicien sur les trois
écritures (rien n'est écrit), une autre société ne lit ni n'écrit, **gardes posées EN
BASE** (deux prêts en cours sur le même appareil, retour réel et retour prévu avant la
sortie — par écriture DIRECTE hors dépôt, sous le rôle applicatif, pour prouver que la
base refuse et pas seulement le JS), cycle complet sortie→retour via le dépôt de
production, intervention d'une autre société refusée.

## `docs/arbitrages.md`

D287 ajoutée : table séparée de `machine`, forme « interne » sur le prêt, capacité
`gerer_prets`, aucune colonne de montant. Condition de réouverture écrite : si le
portail doit un jour lire `pret_equipement`, la forme « interne » SE RETIRE (elle ne
s'assouplit pas) et la table rejoint la forme « filiation ».

## MIGRATION À JOUER par Alexis

`20261128060000_pret_equipement_9l60` — **DB migrate production, puis Vercel.**
Requête de contrôle en lecture seule, une fois jouée :

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('appareil_pret', 'pret_equipement');
```
(doit rendre les deux lignes).

## Vérification

`pnpm test` : 544 fichiers, 6120 tests, vert. `pnpm test:isolation` : 270 fichiers,
2603 tests, vert. `CI=1 pnpm verify` (format + typecheck + lint + test + test:isolation
+ build) : vert — une première passe a rougi sur `format:check` pour deux fichiers
(`lib/prets/depot.ts`, `tests/isolation/prets.test.ts`) ; corrigé par
`prettier --write`, `verify` rejoué intégralement vert.

## Rien d'ouvert pour ce lot

Pas d'écran, donc pas de capture (consigne du 13/11 : rien à photographier, rien n'a
été omis). Les lots 2 (parc de prêt, sortie/retour, alerte de retard au tableau de
bord, prêt visible sur la fiche intervention et la fiche client) et 3 (bon de prêt
signé, signature, document figé) restent entièrement à écrire — c'est volontaire, pas
un report caché : le socle seul était le périmètre de ce ticket.
