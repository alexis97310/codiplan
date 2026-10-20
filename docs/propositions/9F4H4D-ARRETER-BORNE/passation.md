# 9F4H4D-ARRETER-BORNE — passation

## Point 1 — « Arrêter » le compteur borne l'heure du téléphone, même en ligne

**Avant** (`lib/interventions/depot-compteur.ts:300-309`, mesuré sur `e71c8247`) —
`verifierInstantAppareil` n'était appliqué QUE si `depuisFile` :

```ts
const depuisFile = differe !== undefined && (differe.depuisFile ?? true);
if (differe !== undefined && depuisFile) {
  const bornes = verifierInstantAppareil(instant, differe.instantAppareil);
  if (bornes !== null) {
    return { accepte: false as const, cle: bornes };
  }
}
const effectif = differe?.instantAppareil ?? instant;
```

Un « Arrêter » **EN LIGNE** (`depuisFile` faux) avec un `instant_appareil` forgé (très
loin dans le futur) passait donc tout droit : `effectif` valait `differe.instantAppareil`
sans aucun contrôle, et le segment se fermait à cette heure non bornée, sans marquer
`saisi_hors_reseau`.

**Après** (`lib/interventions/depot-compteur.ts:315-330`) — les bornes s'appliquent QUEL
QUE SOIT `depuisFile` ; `effectif`, lui, est INCHANGÉ (toujours `differe.instantAppareil`
si `differe` est fourni) :

```ts
const depuisFile = differe !== undefined && (differe.depuisFile ?? true);
// 9F4H4D : BORNÉ QUEL QUE SOIT `depuisFile` (voir le docblock) — sans
// quoi un essai EN LIGNE fermerait à une heure de téléphone non
// bornée par D115-1.
if (differe !== undefined) {
  const bornes = verifierInstantAppareil(instant, differe.instantAppareil);
  if (bornes !== null) {
    return { accepte: false as const, cle: bornes };
  }
}
const effectif = differe?.instantAppareil ?? instant;
```

### Pourquoi (b) n'est PAS tenu pour ce geste (contrainte posée par le ticket)

`demarrerLeCompteur` et `terminerIntervention` PEUVENT faire fermer/ouvrir un essai EN
LIGNE à l'heure du SERVEUR quand le téléphone est en avance, sans casser leur rejeu —
leur rejeu se reconnaît par une COLONNE D'IDENTITÉ (`id` du segment, `terminer_
operation_id`), indifférente à la valeur réellement écrite.

`arreterLeCompteur` n'a AUCUNE colonne d'identité (choix du pilote, 9F4H2) : son seul
mécanisme de rejeu (`dejaFerme`, `lib/interventions/depot-compteur.ts:~340`) retrouve un
segment déjà fermé **à la valeur exacte de `fin`**. Si `effectif` variait pour utiliser
l'heure du serveur sur un essai en ligne, un RENVOI de ce même essai (même
`instant_appareil`, `instant` serveur différent à chaque appel) ne retrouverait plus le
`fin` déjà écrit, et fermerait — ou refuserait — à tort. Garder (a) et (c) exigeait donc
de renoncer à (b) pour ce geste précis : un `instant_appareil` hors bornes est REFUSÉ même
en ligne (`compteur.refus.instant_futur` / `compteur.refus.instant_trop_ancien`), jamais
silencieusement rabattu sur l'heure du serveur.

### Épreuves (isolation, base réelle)

`tests/isolation/9f4h4b-depuis-file.test.ts` — l'épreuve qui encodait l'écart (« même
heure future acceptée, pas de bornes ») a été rendue STRICTE : elle attend désormais un
refus nommé, segment resté ouvert. Deux cas ajoutés : +10 min (borne proche) et +2 jours
(borne large), tous deux refusés même en ligne. L'épreuve du rejeu EN LIGNE (même
`instant_appareil` des deux côtés, `effectif` inchangé) reste verte sans modification —
c'est exactement ce que ce correctif préserve.

Corrigés en cohérence : `docs/arbitrages.md` (D214, nouvelle Précision datée) et
`docs/propositions/9F4H4B-OUVERTURE-A-FROID/passation.md` (une ligne, « Corrigé par
9F4H4D »).

## Point 2 — la coquille sans session garde un refus d'authentification comme une coupure réseau

**Avant** (`components/terrain/compteur-terrain.tsx:148-155`, mesuré sur `e71c8247`) —
seule une exception `fetch` (`catch`) mettait le geste en file ; une réponse serveur
`{ ok: false, motif: "auth.refus" }` (cookie de session expiré/supprimé PENDANT que le
réseau fonctionne) était affichée comme un refus ordinaire, le geste n'était JAMAIS
gardé :

```ts
if (resultat.ok) {
  router.refresh();
  return;
}
setRefusServeur(resultat.motif);
```

Même défaut, même patron, dans `components/terrain/rapport-automatique.tsx` (fonction
`envoyerJson`, ~:110-139) et `components/interventions/photos-terrain.tsx` (~:142-151) —
alors que la coquille `/terrain-hors-reseau` (`consultation-hors-reseau.tsx:461-466`)
affiche en PERMANENCE « Vos saisies sont gardées… ».

**Après** — un prop `sansSession?: boolean` (défaut `false`), porté UNIQUEMENT par
`consultation-hors-reseau.tsx` (les trois usages de `BoutonCompteurTerrain`,
`RapportTerrainAutomatique`, `PhotosTerrain`) :

- `compteur-terrain.tsx:166-172` — si `sansSession && resultat.motif === "auth.refus"`,
  le geste part dans la MÊME file que l'échec réseau (`garderEnFile`, factorisée des deux
  côtés) ;
- `rapport-automatique.tsx` — `envoyerJson` (~:118-146) rend `null` (même convention que
  l'exception réseau) quand `sansSession` et `motif === "auth.refus"` ; les QUATRE
  appelants (rapport, prestations, signature, terminer) héritent du comportement sans
  être touchés individuellement, par le seul ajout du troisième argument ;
- `photos-terrain.tsx:183-189` — même branchement, `garderEnFile` factorisée en arrow
  function (nécessaire : une fonction DÉCLARÉE perdait le rétrécissement de type de
  `reduite`, `tsc` le refusait).

**Hors de la coquille** (`/terrain/[id]`, une session RÉELLE) : `sansSession` vaut
`false` par défaut, le même motif reste un refus affiché — une session qui expire en
cours de visite n'est pas une coupure réseau.

### Épreuves

- `tests/unit/terrain/compteur-terrain.test.tsx` — deux cas ajoutés : `sansSession=true`
  avec `auth.refus` → gardé (message hors réseau, une entrée en file) ; `sansSession`
  absent avec le MÊME motif → refus affiché, rien en file.
- `tests/e2e/offline/9f4h4d-coquille-sans-session.spec.ts` (NOUVEAU, sa propre scène
  `9F4H4D-`) — coquille ouverte EN LIGNE (`context.setOffline` jamais appelé),
  `context.clearCookies()` simule l'expiration/suppression du cookie, clic sur
  « Démarrer » → requête RÉELLE reçue par le serveur, `auth.refus`, geste en file
  (IndexedDB vérifiée), message « gardé » affiché, jamais le refus ; reconnexion du MÊME
  compte puis « Envoyer » → segment écrit en base (`fin` nul, `saisi_hors_reseau` vrai).

## Épreuves voisines jouées (en plus de la fin de lot ci-dessous)

- `tests/isolation/9f4h4b-depuis-file.test.ts` seul : 7/7 verts.
- `tests/unit/terrain/compteur-terrain.test.tsx`, `tests/unit/interventions`,
  `tests/unit/terrain/*` (82 fichiers / 882 tests) : verts.
- `tests/e2e/offline/*` (14 fichiers, dont le nouveau) : 14/14 verts.
- `tests/e2e/9de-terminer-signature.spec.ts`, `9f4-terrain-enregistrement-auto.spec.ts`,
  `rapport-terrain.spec.ts` : 15/15 verts.
- `pnpm test` (unité complet) : 459 fichiers / 4910 tests verts.
- `pnpm test:isolation` (complet) : 185 fichiers / 1638 tests verts.

## Fin de lot

`CI=1 pnpm verify:full` joué EN ENTIER, au premier plan, en un seul appel — sortie
complète : `docs/propositions/9F4H4D-ARRETER-BORNE/verify-final.txt`. Quinze dernières
lignes (`test:e2e`, dernière étape) :

```
················································································
··········MESURE ligne-sans-heure@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·MESURE ligne-sans-heure@1024 — textes<12px: 0, cibles<32px: 0, débordement: 0
·MESURE ligne-sans-heure@375 — textes<12px: 0, cibles<32px: 10, débordement: 0
  [...cibles tactiles, mesure existante hors territoire...]
·MESURE depot-fenetre-pose@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·MESURE depot-fenetre-pose@1024 — textes<12px: 0, cibles<32px: 0, débordement: 0
·MESURE depot-fenetre-pose@375 — textes<12px: 0, cibles<32px: 13, débordement: 0
  [...cibles tactiles, mesure existante hors territoire...]
·MESURE glisser-en-cours@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·············································°°·················
[...]
  48 skipped
  1421 passed (55.8m)
::notice title=🎭 Playwright Run Summary::  48 skipped%0A  1421 passed (55.8m)
```

Chaîne complète verte : `format:check`, `typecheck`, `lint`, `test` (4910), `test:isolation`
(1638), `build` (89 pages), `feries:horizon` (horizon ≥ 12 mois), `audit:partitions`
(13 partitions, horizon tient), `test:e2e` (1421 passés, 48 sautés — gardien existant hors
territoire, 0 échec).

Toutes les captures régénérées par effet de bord d'AUTRES lots (plus de 270, sur
l'exécution `test:e2e` complète ci-dessus et les exécutions ciblées précédentes) ont été
restaurées (`git checkout --`) ou supprimées (nouvellement créées) ; aucune n'entre dans
un commit de ce lot.

`git fetch origin` + `git rebase origin/main` — rejoué juste avant ce commit de
passation ; `CI=1 pnpm verify` rejoué après rebase — vert, arbre propre.

SHA avant ce commit de passation : `7586d458`.

## Points ouverts pour un lot futur

- (b) n'est pas tenu pour `arreterLeCompteur` — voir la section dédiée ci-dessus. Le
  rouvrir exigerait soit une colonne d'identité sur `segment_travail` (migration, hors
  territoire de ce ticket), soit un mécanisme de rejeu approché (fenêtre de tolérance sur
  `fin`) que le ticket a explicitement autorisé à ne pas construire.
- `L3-07` (parc complet d'un client à 7 jours, RG-DRO-02) reste BLOQUÉ, chaîne inchangée
  (hérité, non touché par ce lot).
