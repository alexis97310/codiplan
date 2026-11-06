# 9J20-PORTAIL-GRILLE-TARIFAIRE — passation

Budget : T0 06:27 (Pacific/Noumea), limite 150 min. Terminé à T0+45, sans code neuf après.

## Prérequis vérifiés

`git log origin/main` contenait bien `9J02-PORTAIL-INVITATION-LIEN` (sous
`9J02A-REPRISE-9J02`) et `prisma/schema.prisma` portait déjà, sur `Societe`,
les trois réglages `facturation_plancher_min`/`facturation_palier_min`/
`facturation_seuil_palier_min` (9I8A1).

## Point par point

1. **La route isolée** — `app/api/portail/tarifs/{contexte,lecture,route}.ts`.
   `lecture.ts` ouvre `avecSociete(prisma, societeId, …)` : UNE transaction qui
   ne pose que `app.societe_id`, jamais `app.client_id` ni
   `app.perimetre_sites`. La porte (`contexte.ts`) ne résout aucun
   rattachement — elle n'a besoin que de la société active et du rôle du
   portail, à la différence de `contextePortailContact`/`contextePortailDemande`.
   Gardien nommé : `tests/isolation/9j20-portail-tarifs.test.ts`, sur le
   modèle de `contexte-arme.test.ts` — une mesure STATIQUE (aucune référence à
   `client_id`/`perimetre_sites`/aux tables « parc » dans le code source) et
   une mesure VIVANTE (`lireBaremePortail` ne compose que la société passée en
   paramètre, prouvé par cloisonnement A/B).
2. **Registre** — `docs/arbitrages.md`, D232 : amendement BORNÉ de
   l'arbitrage 3.8 et de D186, avec les mots d'Alexis. Condition de
   réouverture : une demande d'Alexis.
3. **Un seul appel serveur** — `lireBaremePortail` lit la société d'abord (son
   fuseau décide ce qu'« aujourd'hui » veut dire, L0-08), puis `tauxEnVigueur`
   et le catalogue de forfaits (`findMany`, une jointure, jamais une boucle
   par forfait) EN PARALLÈLE dans la même transaction.
4. **Ce qui reste masqué** — `accesAuxMontants`, `lib/interventions/
   montants-visibles.ts`, `lib/interventions/version-bon.ts` : zéro ligne de
   diff. Le réglage « Afficher les montants » (9I8) ne gouverne pas cette
   route, dit explicitement dans D232 et dans les deux en-têtes.
5. **Captures** — `docs/etudes/equipe-2026-10-29/tickets/9J20-captures/`,
   375 et 1280 px. AVANT = `/portail` avec la nouvelle carte « Nos tarifs ».
   APRÈS = `/portail/tarifs`. Prises contre un serveur réel (`CI=1`, spec
   `tests/e2e/captures-9j20-portail-tarifs.spec.ts`), sans fixture de taux ou
   de forfait inventée.

## Écart signalé plutôt que suivi aveuglément

Le ticket demandait de lire `forfaitsActifs` et composait l'exemple avec
`lib/tarification/forfaits.ts` « (lecture, correction du risque de boucle si
mesuré présent) ». **Mesuré : aucune boucle de résolution par forfait n'existe
dans ce module** — `forfaits.ts` est pur (aucun accès base), et cette route ne
résout jamais de nom de famille (elle ne montre que `famille_id !== null`,
jamais la famille elle-même). Rien n'a donc été modifié dans ce fichier.

Pendant la capture APRÈS, deux forfaits `Déplacement — épreuve A` et
`Déplacement — épreuve B` sont apparus dans le catalogue de démonstration —
résidus d'une scène e2e antérieure, non effacés par leur propre ticket. Ils ne
viennent d'aucun code touché ici (vérifié : aucune épreuve de ce ticket ne les
pose, et `9J20-DEP-A`/`9J20-ROUTE-A`, les seuls codes que ce ticket écrit,
sont nettoyés par leurs propres tests). Signalé plutôt que nettoyé en chemin —
ce n'est pas le territoire de ce ticket, et les supprimer sans savoir quelle
épreuve les attend risquerait de rendre un AUTRE ticket rouge.

## Gardiens touchés en chemin

- `tests/unit/auth/porte.test.ts` — `app/api/portail/tarifs/route.ts` entre
  dans `EXEMPTIONS` (D-12), gardée par `contextePortailTarifs` plutôt que par
  `exigerCapacite`, même motif que les routes sœurs du portail.
- Le refus de droit (`refus-de-droit.test.ts`) a forcé à sortir les motifs
  `"auth.refus"`/`"auth.refus_droit"` de `route.ts` vers `contexte.ts` (qui
  rend directement `{ motif, status }`) — ce gardien ne scrute que les
  fichiers `route.ts`, et une comparaison de chaîne y suffisait à le faire
  rougir.
- `tests/unit/money/sans-decimales-en-dur.test.ts` (I3) a refusé un
  `.toFixed(2)` sur la majoration (un pourcentage, pas un montant, mais le
  gardien ne distingue pas) : `Societe.majoration_hors_ouverture_pct` voyage
  donc en texte (`Decimal.toString()`, qui rend déjà `"50"` plutôt que
  `"50.00"`), jamais reformaté en nombre.
- `tests/unit/calendar/sans-date-courante-implicite.test.ts` (L0-08) a refusé
  `new Date()` : la date de `tauxEnVigueur` vient maintenant du fuseau de la
  société, même lecture que `app/(back-office)/parametres/tarifs/page.tsx`.
- `tests/unit/docs/citations-decisions-code.test.ts` — réglé en écrivant D232
  avant de committer les clés `fr.ts` qui le citent.

## Non touché, par choix de territoire

`lib/tarification/forfaits.ts` (voir l'écart ci-dessus), `lib/interventions/
montants-visibles.ts`, `lib/interventions/version-bon.ts`,
`app/(back-office)/template.tsx`. Aucune migration.

## Vérification jouée

`CI=1 pnpm verify` vert (format:check, typecheck, lint, test — 5536 —,
test:isolation — 1938 —, build). `pnpm test:isolation` et `pnpm test` rejoués
en entier pendant le ticket. E2E ciblés joués au premier plan puisque
`/portail` gagne une carte et `/portail/tarifs` est un écran neuf :
`captures-9j20-portail-tarifs.spec.ts` (4/4), `coque-375.spec.ts -g portail`
(3/3), `captures-9j06-portail-fiche-machine.spec.ts` (4/4, pour vérifier que
la carte neuve ne gêne aucun sélecteur de texte existant sur `/portail`).
`tests/e2e/tous-les-ecrans-rendent.spec.ts` ne couvre que
`app/(back-office)/` (vérifié dans son propre code) : non rejoué, hors
périmètre. `verify:full` laissé à la file, comme demandé. `git fetch origin` /
`git rebase origin/main` : `HEAD is up to date` (origin/main n'a pas bougé).
Jamais de push.
