# 9K27-TERRAIN-TERMINER-CE-QUI-MANQUE — passation

Décision verbatim d'Alexis du 10/11/2026 ~23:58, « Inactif + commentaire exigé » (D242, amende
D212 et D219) : un commentaire non vide devient une condition de « Terminer » ; le bouton de
confirmation reste inactif tant qu'il manque quelque chose (commentaire, signature, point
obligatoire de checklist), chacun nommé et cliquable ; la feuille de confirmation devient plein
écran, et le temps affiché fait défiler le segment encore ouvert (M3).

## `peutTerminer` reçoit un troisième paramètre

`lib/interventions/cycle-de-vie.ts` — `commentaireTechnicien: string | null`, inséré entre le
temps mesuré et la checklist (ordre des gardes : statut, temps, **commentaire**, checklist,
signature). `null` ou un texte fait seulement d'espaces refuse avec
`intervention.refus.commentaire_absent`. Les TROIS appelants serveur sont mis à jour :
`terminerIntervention` (lit `commentaire_technicien` ajouté au `select` de sa propre requête),
`/api/terrain/instantane` et `/terrain/[id]` (les deux lisent `rapportTexte?.commentaire_
technicien`, déjà chargé pour d'autres besoins) — et le verdict LOCAL hors réseau de
`RapportTerrainAutomatique`, qui lit `commentaireRef.current`.

## `manquesPourTerminer` — une fonction NEUVE, distincte de `peutTerminer`

`peutTerminer` s'arrête au PREMIER refus, comme tous les verdicts de ce module — c'est ce qu'il
faut au serveur et au repli affiché quand aucune saisie locale ne l'a corrigé. La feuille de
confirmation, elle, doit nommer TOUS les manques À LA FOIS, jamais seulement le premier :
`manquesPourTerminer(commentaireTechnicien, issueSignature, obligatoiresManquants)` rend
`{commentaireManquant, signatureManquante, pointsManquants}` — même doctrine que
`motifsNonTransmissible` applique déjà au tri « pretes / laissées ».

**Le temps mesuré n'y figure pas, à dessein.** La décision d'Alexis ne nomme que trois manques
pour « Confirmer la fin » ; le temps reste un refus SERVEUR ordinaire après le clic (D212
inchangée sur ce point précis) — aucun lien sensé ne mène, depuis cette feuille, à « démarrer le
compteur ». Condition de réouverture écrite dans D242 si ça devait changer un jour.

## D212 amendée : le bouton ouvre toujours, le second geste décide

Avant ce lot : « Terminer l'intervention » ouvrait un résumé (D219), et « Oui, terminer »
envoyait TOUJOURS — un refus se découvrait APRÈS le clic, sous forme d'un message générique.
Depuis ce lot : le bouton ouvre toujours la feuille (inchangé) ; c'est « Confirmer la fin »
(renommé depuis « Oui, terminer », même clé `terrain.terminer.confirmation.oui`) qui reste
INACTIF (`disabled`) tant que `manquesPourTerminer` rend un manque, avec un texte
`aria-describedby` lisible par un lecteur d'écran (`terrain.terminer.confirmation.indisponible`).

## Chaque manque, nommé et cliquable

Dans la feuille, un bloc orange liste les manques : « Aller au commentaire » (referme la feuille,
`.focus()` + `.scrollIntoView()` sur le `<textarea>` du rapport, nouveau
`commentaireTextareaRef`), « Aller à la signature » (referme la feuille, `.scrollIntoView()` sur
la `<section>` signature, nouveau `signatureSectionRef`), et un bouton par point de checklist
manquant — MÊME patron que CK7/9K23 (`libelleDuPoint`, `signalerChecklistSauterAuPoint`),
simplement déplacé dans la feuille plutôt que sous le bouton.

## Les manques se recalculent en continu, pas seulement après un refus

Avant ce lot, `pointsManquantsTerminer` (checklist) n'était posé QU'APRÈS une tentative refusée.
Pour que la feuille les nomme AVANT le clic, deux nouveaux états suivent la file en continu
(`pointsManquantsAffiches`, recalculé dans le même `relire()` qui suit déjà `EVENEMENT_FILE_
MODIFIEE` pour `termineLocalement`/`enCoursLocalement`) : `obligatoiresManquantsDepuisFile`,
extraite de l'intérieur d'`onClickTerminer` pour être rejouée par les deux. `manquesTerminer`
(calculé à chaque rendu, pas dans un effet) combine ce résultat avec l'état `commentaire` et
`issueSignatureLocaleComplete()`, déjà existante.

## M3 — la feuille devient plein écran, le temps défile

`confirmationTerminerOuverte` ne rend plus une carte inline sous le bouton : un `<div
role="dialog">` `fixed inset-0 z-[60]`, AU-DESSUS de la barre basse (`barre-basse.tsx`, `z-50`).
Le « Temps mesuré » utilise `CompteurVivant` (`components/terrain/compteur-vivant.tsx`, déjà
existant, lu non modifié) quand un segment est encore ouvert — deux nouveaux états
(`minutesFermeesAffichees`, `debutSegmentOuvertAffiche`), tenus par la MÊME extension de
`mesureCompteurDeLaFile` (qui rend désormais aussi `debutSegmentOuvert`, le début du segment
encore ouvert — champ ajouté, logique inchangée).

## Documentation

`docs/arbitrages.md` — **D242**, qui amende D212 et D219 (marque `**Amendé par D242.**` posée
sur les deux). **Piège rencontré, même famille que celui documenté par la passation de 9K23** :
une première rédaction de D242 utilisait des sous-titres `###` — le gardien `cablage-
arbitrages.ts` efface `courante` sur TOUT titre, y compris un sous-titre, et ne le réarme qu'au
PROCHAIN `## Dxx` ; tout ce qui suit un premier `###`, y compris la ligne `**Règles amendées
:**`, n'est alors jamais lu. Réécrit avec des paragraphes en gras (même convention que D240).
`docs/cahier-des-charges.md` (RG-INT-02, un second amendement après D240) ; `docs/backlog.md`
(L2-07, qui cite RG-INT-02) relu, rien n'a cessé d'être vrai (condition d'entrée, pas une
transition), empreinte remplacée. `tests/unit/docs/amendements-arbitrages.test.ts` et
`cablage-arbitrages.test.ts` : les deux nouvelles paires ajoutées à leurs listes attendues.

## i18n

`intervention.refus.commentaire_absent` (espace `intervention.refus.*`, même famille que
`signature_manquante`/`temps_manquant`). `terrain.terminer.confirmation.oui` RENOMMÉ en valeur
(« Confirmer la fin », au lieu de « Oui, terminer ») — la CLÉ ne change pas, `cliquerTerminer`
(`tests/e2e/setup/terrain-gestes.ts`) continue de fonctionner sans modification. Six clés
neuves : `manques_titre`, `manque_commentaire`, `aller_commentaire`, `manque_signature`,
`aller_signature`, `indisponible`.

## Épreuves

- **Unitaires** (`tests/unit/interventions/cycle-de-vie.test.ts`) : `peutTerminer` sans
  commentaire, un commentaire fait seulement d'espaces, l'ordre des gardes complet (figée,
  statut, temps, **commentaire**, checklist, signature) ; `manquesPourTerminer` — rien ne
  manque, les trois manques à la fois (jamais seulement le premier), un commentaire fait
  d'espaces manque. (`tests/unit/terrain/rapport-automatique.test.tsx`) : le bâtisseur de scène
  pose un commentaire non vide par défaut (14 épreuves existantes corrigées pour poser
  `dejaSignee: true` ou un commentaire explicite là où elles éprouvaient autre chose que ce
  manque) ; une épreuve réécrite pour affirmer le NOUVEAU comportement — le manque se nomme DANS
  la feuille, « Confirmer la fin » reste inactif — plutôt que l'ancien (un clic qui aboutissait à
  un refus affiché après coup).
- **Isolation** (`tests/isolation/terminer-intervention.test.ts`) : refuse sans commentaire même
  avec temps mesuré et signature ; refuse un commentaire fait seulement d'espaces ; les scènes
  existantes (chemin accepté, checklist, course entre deux appels simultanés) posent désormais un
  commentaire via `enregistrerRapportTexte` avant d'appeler `terminerIntervention`, pour isoler
  ce que chacune éprouve réellement. Même correction sur `9f4h2-hors-reseau-heure-et-rejeu.test.ts`
  et `9f4h4b-depuis-file.test.ts`.
- **Bout en bout** (`tests/e2e/9k27-terrain-terminer-ce-qui-manque.spec.ts`) : deux scènes (en
  ligne 375/1280, mode avion 375), checklist pinnée directement (même raison que 9K23). Les
  trois manques nommés et cliquables, « Confirmer la fin » inactif puis actif à mesure qu'ils se
  résolvent un par un (commentaire → signature → checklist), temps qui défile en `HH:MM:SS` hors
  réseau sur un segment encore ouvert. Sept scènes existantes dont la fiche terminait SANS
  commentaire mises à jour en SAISISSANT un commentaire (même preuve, règle nouvelle) :
  `9de-terminer-signature`, `9f4-terrain-enregistrement-auto`, `captures-9f4h2a-fin-avant-debut`,
  `offline/9f4h3ac-correctifs-revue`, `offline/9f4h6-terminer-coquille-sans-session`,
  `offline/9f4h6d-prestations-sans-perte`, `offline/9f4h6f-prestations-ancien-client` (+ une
  signature posée, pour isoler le refus SERVEUR des prestations qu'elle éprouve, du manque de
  signature que ce lot introduit). `tests/e2e/9k23-checklist-blocage-terminer.spec.ts` : les deux
  scènes posent désormais un commentaire ; le refus checklist se nomme dans la feuille (`toBe
  Disabled()`) avant le clic, jamais après — le texte `intervention.refus.checklist_obligatoire_
  manquante` n'apparaît plus dans ce parcours écran (il reste le repli serveur, inchangé,
  éprouvé par les unitaires et l'isolation).

## Ce qui reste dû

**Le temps mesuré pourrait un jour bloquer « Confirmer la fin » lui aussi** — condition de
réouverture écrite dans D242, volontairement non anticipée. **La fiche en étapes** (lot M2 de
l'audit du 10/11, pas encore décidé) et **le destinataire de l'alerte de fin** (D241, 9K26) sont
hors de ce lot. Rien n'est dû à `lib/checklists/`, `lib/terrain/file-saisies.ts` (hors lecture),
`depot/` ni aux scripts de file.

**`docs/captures/` (la galerie repo-wide) n'a PAS été rafraîchie** — la procédure de
`docs/captures/README.md` (base locale jetable, build de production, amorçage d'un compte neuf,
puis `scripts/captures.mts`) n'a pas pu tenir dans le budget de ce lot. Les captures AVANT/APRÈS
des écrans RÉELLEMENT touchés par ce lot, elles, sont à jour sous `docs/propositions/` (ce
dossier et les sept dossiers des scènes e2e corrigées) : elles viennent des MÊMES specs
Playwright, rejouées contre le serveur de développement, pas de la procédure `docs/captures/`.

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint (5727 tests unitaires, 2154 tests d'isolation),
build — vert. `pnpm test:e2e tests/e2e/9k27-terrain-terminer-ce-qui-manque.spec.ts` : 2 passés.
Les huit scènes existantes modifiées rejouées individuellement (en isolation d'un seul worker) :
toutes vertes — deux échecs observés en les jouant TOUTES ENSEMBLE à 9 workers parallèles sont
des artefacts de partage de compte technicien entre fichiers (un compteur démarré par un autre
fichier bloque le bouton « Démarrer » d'un second), reproduits et confirmés sans lien avec ce
lot en rejouant chaque fichier seul. `verify:full` (dont `test:e2e` en entier) est laissé à la
file de nuit.
