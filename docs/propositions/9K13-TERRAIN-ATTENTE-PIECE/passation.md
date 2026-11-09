# 9K13-TERRAIN-ATTENTE-PIECE — passation

## 1. Mesure

Le domaine existait déjà, ENTIÈREMENT, avant ce ticket :

- `suspendre_reprendre_intervention` — capacité restreinte au technicien
  affecté, posée par D131 (23/09/2026), `lib/auth/habilitations.ts:167-170`.
- `peutSuspendre` (`lib/interventions/cycle-de-vie.ts:274-297`) — exige
  `statut === "en_cours"` et un motif non vide ; refuse sinon
  (`annulee_figee`, `cloturee_figee`, `deja_suspendue`,
  `suspension_sans_demarrage`, `motif_manquant`).
- `schemaSuspension` (`lib/interventions/saisie.ts:420-445`) — `motif`
  (≥ 3 car.), `piece_attendue_ref` et `date_dispo_prevue` NULLABLES mais
  TOUJOURS ENSEMBLE (`.refine`, RG-INT-06) : une référence sans date (ou
  l'inverse) est refusée.
- `suspendreIntervention` (`lib/interventions/depot.ts:3900-3965`) — pose
  le statut `suspendue`, les quatre colonnes, ET ouvre une ligne
  `intervention_pause` dans la MÊME transaction (50-INTERVENTIONS-2).
  Revérifie `accesSurCetteIntervention(contexte,
  "suspendre_reprendre_intervention", technicien_id)` — même périmètre que
  « clôturer ».
- `app/api/interventions/[id]/suspendre/route.ts` — la route du BUREAU,
  déjà ouverte au technicien par la capacité ci-dessus, mais atteignable
  seulement depuis `DialogueSuspendre`
  (`components/interventions/dialogue-suspendre.tsx`), monté sur
  `app/(back-office)/interventions/[id]/page.tsx` — jamais depuis
  `/terrain/[id]`.
- Le bureau voit déjà la pièce : `Pauses`
  (`app/(back-office)/interventions/[id]/page.tsx:2529-2560`), onglet
  `?onglet=temps` de la fiche, lit `pause.pieceAttendueRef` /
  `.dateDispoPrevue` — AUCUN écran neuf côté bureau n'était nécessaire.

**Ce qui manquait réellement : un CHEMIN terrain.** Aucun bouton sur
`/terrain/[id]`, aucune route sous `app/api/terrain/`, aucun geste dans
l'union `Geste` de la file hors réseau (`lib/terrain/file-saisies.ts`), et
les trois colonnes absentes de l'instantané hors réseau
(`app/api/terrain/instantane/route.ts`).

### Écart trouvé entre le ticket et RG-INT-06 — voir D236

Le point 2 du ticket demandait « référence obligatoire, date prévue
**facultative** » ; la décision rapportée d'Alexis, juste au-dessus, dit
« référence + date prévue » sans réserve ; et RG-INT-06 (chapitre 10,
rang 2) comme `schemaSuspension` (déjà en place, inchangé) exigent les
DEUX ensemble ou aucune. Résolu par la hiérarchie des sources (§1 du
`CLAUDE.md`) : chapitre 10 au-dessus du texte du ticket. **Les deux champs
restent obligatoires ensemble pour ce geste** — trace écrite en D236,
`docs/arbitrages.md`.

### Le motif, jamais saisi

RG-INT-06 exige un motif pour TOUTE suspension, y compris une attente de
pièce. La décision d'Alexis ne nomme que « référence + date prévue » —
aucun troisième champ. Résolu en posant un texte FIXE
(`terrain.suspendre.motif_auto`, "Attente de pièce signalée depuis le
terrain.") plutôt qu'en ouvrant un champ libre que la décision ne demande
pas : documenté en D236, à confirmer par Alexis si un motif libre était
en réalité voulu.

## 2. Domaine + route (points 2-4)

Rien n'a changé dans `lib/interventions/depot.ts`, `saisie.ts`,
`cycle-de-vie.ts` : la route terrain neuve
(`app/api/terrain/[id]/suspendre/route.ts`) appelle `suspendreIntervention`
tel quel, sous la MÊME porte que ses voisines (`compteur`, `rapport`,
`terminer`) — `saisir_rapport` + périmètre restreint (preuve que c'est un
compte terrain), puis `suspendreIntervention` revérifie
`suspendre_reprendre_intervention` SUR CETTE intervention. « Avec filet » :
un identifiant mal formé ou une exception imprévue retombe sur
`intervention.refus.erreur_serveur`, jamais un 500.

## 3. Écran terrain (point 3)

`components/terrain/suspendre-terrain.tsx` (`BoutonSuspendreTerrain`) —
trois états, jamais deux :

- `statut === "suspendue"` : bandeau en lecture (référence, date via
  `dateCivile`) — jamais le bouton.
- `statut !== "en_cours"` (et pas suspendue) : rien — comme `peutSuspendre`
  côté serveur.
- `statut === "en_cours"` : le bouton ouvre un `Dialogue` (référence,
  date — tous deux obligatoires au bouton « Enregistrer », pas seulement
  au serveur) ; si une entrée « suspendre » est déjà en file,
  « En attente d'envoi » remplace le bouton.

Posé juste après la section Compteur sur `/terrain/[id]`
(`app/(mobile)/terrain/[id]/page.tsx`) et dans la coquille
`components/terrain/consultation-hors-reseau.tsx` (`sansSession`), au même
endroit.

## 4. Hors réseau (point 4)

- `lib/terrain/file-saisies.ts` : `GesteSuspendre` (`motif`,
  `pieceAttendueRef`, `dateDispoPrevue`, tous `string`, jamais `null` —
  voir le point 1) ajouté à l'union `Geste`, à `gesteReconnu` et à
  `TYPES_COALESCABLES` (une seule attente active a du sens : la seconde
  déclaration remplace la première).
- `lib/terrain/envoi-file.ts` : `ORDRE_PIPELINE` renuméroté — `suspendre`
  au rang 3, APRÈS `rapport`/`prestations`, AVANT `photo`/`signature`/
  `terminer` (qu'une suspension rend impossible : le statut n'est plus
  `en_cours`).
- `app/api/terrain/instantane/route.ts` : `FicheJSON` gagne
  `motifSuspension`, `pieceAttendueRef`, `dateDispoPrevue` — déjà portés
  par `CHAMPS_LIGNE` (`lib/interventions/depot.ts`), aucune requête neuve.

## 5. Épreuves (point 5)

- Unitaires : route (`tests/unit/interventions/terrain-route-suspendre.test.ts`
  — succès, référence sans date, date sans référence, motif absent, refus
  du dépôt propagé, 303 sans l'en-tête JSON), file (coalescence,
  `tests/unit/terrain/file-saisies.test.ts`), pipeline et corps
  (`tests/unit/terrain/envoi-file.test.ts`), composant (trois états,
  succès en ligne, refus serveur affiché sans mise en file, panne réseau
  gardée, coquille sans session —
  `tests/unit/terrain/suspendre-terrain.test.tsx`).
- **Isolation NON rejouée pour la route** : `suspendreIntervention` et son
  `accesSurCetteIntervention` sont inchangés, déjà couverts par
  `tests/isolation/droits-cycle-de-vie.test.ts` (« SUSPENDRE / REPRENDRE —
  même périmètre scopé que « clôturer » »). Aucune route terrain voisine
  (`compteur`, `terminer`, …) n'a sa propre épreuve d'isolation — toutes
  reposent sur celle, déjà existante, de la fonction de dépôt qu'elles
  appellent.
- e2e (`tests/e2e/9k13-terrain-attente-piece.spec.ts`, 375 px, sa propre
  scène jetable comme `9k11-itineraire-terrain.spec.ts`) : en ligne
  (déclaration, DB vérifiée, le bureau la voit dans un second contexte
  navigateur) et mode avion (`context.setOffline`, geste gardé en file,
  « Envoyer » le transmet au retour). Les deux verts.
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` rejoué : 60 passés, 3 ignorés
  (comme avant ce ticket).

## 6. Captures (point 6)

`docs/propositions/9K13-TERRAIN-ATTENTE-PIECE/captures/` : fiche terrain
AVANT le geste, formulaire rempli, fiche APRÈS (bandeau de la pièce
attendue), et la même pièce côté bureau (onglet Temps, bloc Pauses,
inchangé). Prises par l'épreuve e2e elle-même (375 px), pas une paire
git-diff AVANT/APRÈS — pas de changement visuel sur un écran EXISTANT ici,
seulement un bouton et un bandeau neufs.

## 7. État à la fin de la session

- Branche dédiée `9K13-TERRAIN-ATTENTE-PIECE`, partant d'`origin/main` à
  jour (HEAD était détaché sur `origin/main` au début de la session, `main`
  extraite ailleurs dans `/home/aplou/codiplan`).
- Six commits, un par point (mesure incluse dans le premier commit de
  code ; D236 séparé).
- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (5581/5581),
  `pnpm test:isolation` : voir ci-dessous.
- `verify:full` laissé à la file, non joué ici.

### Trois épreuves d'isolation en échec, SANS RAPPORT avec ce ticket

`tests/isolation/transmission-groupee.test.ts` — 3 tests en échec
(`transmettreEnGroupe`/`transmettreIntervention`, `lib/interventions/
depot.ts`, fichier jamais touché par ce ticket). **Vérifié reproduit à
l'identique sur `HEAD~3` (avant le premier commit de ce ticket)** — bascule
temporaire sur ce commit, même commande, même échec. Pré-existant, pas
causé ni aggravé ici. Pas de tentative de correction : hors territoire de
9K13, et `lib/interventions/depot.ts` n'est de toute façon pas à toucher
sans un motif propre à ce fichier.

À signaler à Alexis / au pilote : cette suite bloque `pnpm test:isolation`
(exit code 1) pour QUICONQUE joue la suite complète en ce moment, pas
seulement cette session.
