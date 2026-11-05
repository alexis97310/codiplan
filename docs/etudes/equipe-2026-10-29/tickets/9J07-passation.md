# 9J07-PORTAIL-INTERVENTION-ETAT — passation

Budget : T0 07:21 (Pacific/Noumea), limite 130 min.

## Point 1 — inventaire

`git log origin/main --oneline` contenait déjà `9J05-PORTAIL-COMMENTAIRES-GARDE` et `9J06-PORTAIL-FICHE-
MACHINE` (confirmé par leurs commits visibles directement dans l'historique courant, HEAD détaché sur
`origin/main`) — pas d'arrêt immédiat.

`commentairesVisiblesClient(contexte: ContexteSession, interventionId: string, client?: PrismaClient):
Promise<CommentairesClient | null>` (`lib/portail/interventions.ts`) rend `{ id, statut, commentaireTechnicien,
suiteADonner }` — JAMAIS `note_interne`. Même politique « parc » (D84) que `parcDuClient`/`ficheMachineDuParc`
(`lib/portail/depot.ts`) : aucun filtre société/client/site écrit dans le module, la RLS décide sous le
contexte. `null` confond « inexistante » et « hors périmètre ».

## Point 2 — l'écran

Territoire strictement tenu à `app/(portail)/portail/interventions/**` : `lib/portail/interventions.ts` et
`lib/portail/depot.ts` ne sont PAS modifiés (hors territoire explicite du ticket). La lecture de la LISTE
(et de l'état de la FICHE, hors commentaires) vit donc dans un module NEUF, `./depot.ts`, à l'intérieur du
territoire :

- `SELECTION_INTERVENTION_PORTAIL` — liste close : `id`, `numero`, `annee`, `statut`, `type`,
  `date_planifiee`, `site_id`, `cree_le`. Ni `note_interne`, ni `commentaire_technicien`/`suite_a_donner`
  (réservés à `commentairesVisiblesClient`), ni `montant_ht`/`valorisation_figee`/`temps_valide_min`, ni
  `technicien_id`/`agence_id`/`client_id`/`contact_id`.
- `interventionsDuParc(contexte, client?)` — la liste, forme « parc », triée par `cree_le` desc (« la plus
  récemment créée d'abord » — même raison que `/portail/demandes` : un client qui relit SES interventions
  n'a pas la question d'une file de travail interne).
- `ficheInterventionDuParc(contexte, interventionId, client?)` — une lecture par id, même politique, `null`
  confond « inexistante » et « hors périmètre » (même discipline que `ficheMachineDuParc`).

`app/(portail)/portail/interventions/[id]/page.tsx` appelle LES DEUX lectures (`ficheInterventionDuParc` +
`commentairesVisiblesClient`) — jamais un second `select` sur les commentaires. CLI-2.4 (durée par état) non
touché : aucune lecture d'`intervention_statut_historique` nulle part dans ce ticket.

`app/(portail)/portail/page.tsx` (racine) n'est PAS modifié : sa carte « Vos interventions » dit toujours
« Sans information... » (clé `portail.interventions.a_venir_avant/apres`), devenue STALE au sens strict —
même gap que `portail.demande.a_venir_*` resté inchangé après 9J04-PORTAIL-DEMANDES. **Aucune entrée de menu
n'est ajoutée** (`ENTREES_PORTAIL` hors territoire) : `/portail/interventions` n'est atteignable que par son
URL directe — gap nommé, pas une omission silencieuse.

## Point 3 — épreuves d'isolation, NOUVELLES

`tests/isolation/9j07-portail-intervention-etat.test.ts`, sous la vraie base, PAR LISTE et PAR ID DIRECT :
- `interventionsDuParc` : le compte portail lit SON intervention dans SON périmètre, jamais celle d'un autre
  site du même client (`INTERVENTION_A2`, hors périmètre), jamais celle d'une autre société ; un compte
  portail d'un AUTRE client de la même société ne voit aucune des deux ;
- `ficheInterventionDuParc` : témoin positif, puis `null` sur `INTERVENTION_A2` (témoin : la ligne existe),
  `null` sur un autre client de la même société, `null` sur une autre société (témoin : la ligne existe),
  lève sur une désignation de client refusée (D70).

7 épreuves, toutes vertes sous `pnpm vitest run --project isolation`. `tests/unit/portail/intervention-
colonnes-fermees.test.ts` tient la liste close dans les deux sens (même patron que `machine-colonnes-
fermees.test.ts`), 3 épreuves.

## Point 4 — épreuve de non-fuite, RÉPÉTÉE À L'ÉCRAN

`tests/e2e/captures-9j07-portail-intervention-etat.spec.ts` pose une intervention DÉDIÉE (même patron que
`INTERVENTION_COMMENTAIRES` de 9J05) portant trois valeurs distinctes, ouvre la fiche sous une vraie session
portail, et mesure `page.content()` : `note_interne` n'apparaît NULLE PART dans le HTML rendu, alors que les
deux commentaires destinés au client, eux, y sont (témoin de non-vacuité). Vert.

## Point 5 — captures

**AVANT non capturé** — même motif que 9J04 (voir sa passation) : ni `/portail/interventions` ni
`/portail/interventions/[id]` n'existaient avant ce ticket, il n'y a pas d'écran antérieur à rejouer, et
contrairement à 9J06 (une liste existante qui gagne des liens), il n'y a rien de significatif à montrer en
« avant » — seulement une absence. Seul l'APRÈS est versé, dans `docs/etudes/equipe-2026-10-29/tickets/
9J07-captures/apres/` (quatre fichiers : liste, fiche avec commentaires, 375 et 1280 px).

## État des portes

`pnpm format` / `pnpm typecheck` / `pnpm lint` : verts à chaque point. `pnpm test` : 502 fichiers, 5517 tests,
vert. `pnpm test:isolation` : 218 fichiers, 1884 tests, vert (dont les 7 nouveaux). `tests/e2e/captures-9j07-
portail-intervention-etat.spec.ts` : 5/5 vert, exécuté isolément. Sortie complète de `CI=1 pnpm verify:full` :
voir `9J07-verify-final.txt`, dans ce même dossier.

## Hors territoire, rappelé

`lib/portail/interventions.ts` : appel seul (`commentairesVisiblesClient`), aucune modification de sa
sélection. `lib/portail/depot.ts` : non touché — `interventionsDuParc`/`ficheInterventionDuParc` vivent dans
`app/(portail)/portail/interventions/depot.ts`, à l'intérieur du territoire déclaré. `prisma/` : aucune
migration. CLI-2.4 (durée par état, repoussé) : non construit. `app/(back-office)/template.tsx`, `CLAUDE.md` :
inchangés.
