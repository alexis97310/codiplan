# 9L10-CREER-INTERVENTION-QUALIFIER — passation

Décision d'Alexis du 10/11/2026 (« OK »). Écrite en `docs/arbitrages.md` sous **D267**.

## Mesure préalable (point 1 du ticket)

Aucun écran terrain ou portail légitime n'appelle `POST /api/interventions/creer` :

- le technicien est déjà fermé de bout en bout du segment back-office par le garde-fou de D221
  (`app/(back-office)/template.tsx`), qui le redirige vers `/terrain` quelle que soit la page visée ;
- « + Créer ici » (PG-D5-CREER-ICI), le seul lien qui mène à cette route depuis `/planning`, n'est
  proposé qu'aux rôles qui tiennent DÉJÀ `modifier_planning` en accès complet
  (`app/(back-office)/planning/page.tsx`, `peutCreerIci`) — un ensemble qui ne recoupe ni le
  technicien (○ seulement sur `modifier_planning`) ni le client (aucun accès) ;
- le portail client dépose par sa PROPRE route, `app/api/portail/demandes/creer/route.ts`, gardée par
  `contextePortailDemande` et jamais par la matrice commune.

Aucune exception n'a donc été ouverte : la capacité se change sans garde supplémentaire.

## Ce qui a été livré

1. **`app/api/interventions/creer/route.ts`** — la porte exige désormais `qualifier_affecter` au lieu
   de `creer_demande` (mesure du ticket sur `81894e0`, point 2). Docblock complété pour nommer la
   décision et distinguer cette route de `/api/demandes/creer` (inchangée).

2. **`app/(back-office)/planning/page.tsx`** (`peutCreerIci`) — relit désormais `qualifier_affecter`
   au lieu de `creer_demande`, pour que la condition désigne la MÊME capacité que la route qu'elle mène
   à appeler. L'ensemble de rôles qu'elle ouvre ne change pas : il était déjà croisé avec
   `modifier_planning` en accès complet, qui ne rend les deux capacités observables ici
   équivalentes qu'à l'intersection — ADMS, DIR, RM, RS, ADV, ni plus ni moins qu'avant.

3. **`tests/unit/auth/porte.test.ts`** (`ROUTE_CAPACITE`) — l'entrée de
   `app/api/interventions/creer/route.ts` passe de `creer_demande` à `qualifier_affecter` ; le
   commentaire voisin de `app/api/demandes/creer/route.ts` ne renvoie plus à elle (« même capacité »
   n'est plus vrai depuis ce ticket).

## Ce qui n'a pas changé

`/api/demandes/creer` (le volet « + Demande » de `/demandes`) et `/api/portail/demandes/creer` (le
dépôt du portail client) restent sur `creer_demande`, inchangée. Aucune migration.

## Épreuves

- **`tests/unit/auth/porte.test.ts`** — le gardien statique rougit si la route s'écarte de
  `qualifier_affecter` (éprouvé en revenant momentanément sur `creer_demande` pendant ce lot : les deux
  assertions concernées échouent pour la bonne raison, puis le code a été restauré).
- **`tests/isolation/9l10-creer-intervention-qualifier.test.ts`** (nouveau) — même patron que
  `tests/isolation/droits-ecrans-tp-s3.test.ts` (la porte est fabriquée en rejouant le verdict réel de
  `peut` pour un rôle donné, la base et la politique RLS restent le chemin de production) :
  - le client est refusé, rien n'est écrit ;
  - le technicien est refusé, rien n'est écrit ;
  - l'ADV reste acceptée, la ligne existe ;
  - le responsable SAV reste accepté, la ligne existe.
- **E2E ciblés, rejoués en avant-plan** : `formulaires-1.spec.ts`, `creation-2.spec.ts`,
  `demandes-2.spec.ts`, `planning-creer-ici.spec.ts`, `planning-technicien-actions-refusees.spec.ts` —
  13 scénarios, tous verts (le dernier prouve déjà, à l'écran, que le technicien ne voit jamais
  « + Créer ici » et que l'ADV le voit toujours).

Aucun écran n'a visiblement changé pour un rôle qui le voyait déjà : aucune capture n'a donc été prise.

`pnpm typecheck`, `pnpm lint`, `pnpm test` (5950 tests) et `pnpm test:isolation` (2285 tests) passent,
rejoués en avant-plan pendant ce lot. `pnpm test:e2e` en entier n'a pas été rejoué (budget du lot) ; la
file de nuit joue `verify:full` après ce lot.
