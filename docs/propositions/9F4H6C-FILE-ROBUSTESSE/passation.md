# 9F4H6C-FILE-ROBUSTESSE — passation

Branche dédiée `9F4H6C-FILE-ROBUSTESSE`, partant d'`origin/main` (780ecfd0) : `main` était extrait ailleurs
(`/home/aplou/codiplan`, worktree séparé), conformément à la consigne du ticket.

## Point 1 — prestation décochée après un envoi de la file (`f0c2a984`)

**Avant** : `dernierePrestationsEnvoyeesRef` (`rapport-automatique.tsx`) n'était mise à jour qu'au succès d'un
envoi EN LIGNE tenté par ce composant. Un envoi réussi via la file (bouton « Envoyer », ou un autre onglet) ne
la mettait jamais à jour → décocher ensuite une prestation retrouvait la base PÉRIMÉE et rendait « accepté »
sans rien envoyer : la prestation restait facturable côté serveur.

**Après** : deux canaux tiennent la base à jour — un événement (`EVENEMENT_PRESTATIONS_ENVOYEES`, posé par
`envoyerFile` à l'acceptation d'une entrée « prestations ») et un effet qui resynchronise depuis
`prestationsInitiales` à chaque rendu avec des props serveur neuves (`router.refresh()`). Par prudence
supplémentaire, un ajout resté en file n'est plus jamais jeté en silence au retour à la base connue : il est
remplacé par sa DIFFÉRENCE INVERSE (un échec réseau et une réponse perdue après succès serveur étant
indistinguables pour ce composant).

**Conséquence mesurée** : l'ancien test unitaire et l'ancienne épreuve e2e de 9F4H6B (« cocher puis décocher
hors réseau ») attendaient le SILENCE après décocher — exactement le comportement visé par cette revue comme
risqué. Les deux ont été mis à jour pour attendre l'inverse gardé, jamais la rejoue de l'ajout. Vérifié par
reversion manuelle du correctif : les 3 tests unitaires neufs et l'épreuve e2e échouent sans lui.

Tests : `tests/unit/terrain/rapport-automatique.test.tsx` (3 tests neufs, 1 test existant mis à jour).

## Point 2 — tri de la file sans NaN (`d7f37a34`)

`ORDRE_PIPELINE[type]` sur un type absent du dictionnaire rendait `undefined`, et `undefined - nombre` vaut
`NaN` — le comparateur de `trieeParPipeline` (`lib/terrain/envoi-file.ts`) n'était plus cohérent dès qu'une
entrée de forme inconnue voisinait des saisies reconnues. `rangDansPipeline` donne maintenant un rang défini
(après tous les types connus) à tout type absent.

Test : `tests/unit/terrain/envoi-file.test.ts`, les 720 permutations de `rapport, photo, signature, mystere,
compteur, terminer` donnent le même ordre de sortie. Vérifié rouge sans le correctif (33/120 mal triés, mesure
reproduite par la revue).

## Point 3 — geste absent ou nul (`a920e64e`)

`toutesLesEntrees` gardait `brute.geste` TEL QUEL quand `gesteReconnu` rendait `null`, y compris quand
`brute.geste` lui-même était `null`/absent (pas seulement une forme inconnue mais PRÉSENTE). Chaque lecteur de
`.geste.type` (tri, envoi, recherche de coalescence d'`ajouterSaisie`, relecteur « Terminer déjà en file » de
la fiche) levait alors sur `null.type`.

Un geste absent/nul est remplacé par `{type: TYPE_GESTE_ABSENT}` avant de quitter `toutesLesEntrees` — un objet
de forme inconnue mais PRÉSENT (ex. l'ancien format) continue de traverser tel quel. La recherche de
coalescence d'`ajouterSaisie`, qui lit IndexedDB brut sans passer par cette normalisation, est protégée
séparément (`e.geste?.type`).

Helper de test neuf : `ecrireEntreeBrute` (`tests/unit/terrain/aide-indexeddb-factice.ts`) — écrit directement
dans le double IndexedDB, hors `ajouterSaisie` (qui lève elle-même sur un geste nul en paramètre, puisqu'elle en
lit `.type` pour savoir s'il coalesce).

Tests : `envoi-file.test.ts`, `file-saisies.test.ts` (3 tests), `rapport-automatique.test.tsx` (1 test). Vérifié
rouge sans le correctif (TypeError observée, exactement celle décrite par la revue).

## Point 4 — retirer une saisie refusée, D142 (`fccd1688`)

Bouton « Retirer cette saisie » posé à côté du motif, dans `BoutonEnvoyer` (`components/terrain/
bouton-envoyer.tsx`) — avec confirmation inline (« Retirer cette saisie ? Elle ne sera pas envoyée. »,
boutons « Revenir »/« Retirer »). Une saisie seulement en attente (`motifRefus === null`) n'a pas ce bouton.
Clés neuves dans `lib/i18n/fr.ts` (`terrain.file.retirer_*`).

Gardien `composants-base.test.tsx`/`retouches-2a.test.ts` (compte fixe de `<Button>` au terrain) mis à jour de
11 à 14.

Test : `tests/unit/terrain/bouton-envoyer.test.tsx`, 3 tests neufs (bouton visible seulement sur une saisie
refusée ; « Revenir » ne retire rien ; « Retirer » confirmé retire réellement). Vérifié rouge sans le correctif.

**Point ouvert** : aucune épreuve e2e dédiée à ce scénario (saisie refusée → retrait → signature/Terminer
partent) n'a été écrite — budget de temps épuisé avant de pouvoir la construire de façon fiable (scène DB,
connexion, refus réel, deux viewports). La couverture unitaire ci-dessus exerce tout le comportement du
composant ; seul le parcours de bout en bout, à travers la vraie route et les vraies saisies suivantes
(photo/signature/Terminer), reste à mesurer.

## Point 5 — identifiant mal formé ou d'une autre société, chemin en ligne (`a686955a`)

`prestation_id`/`ajouter_id`/`retirer_id` atteignaient `prestation.findMany`/`interventionPrestation.
deleteMany`/`createMany` sans validation de forme — `prestation_id` est `@db.Uuid`, et une valeur mal formée
levait à la base (P2023), une erreur Prisma NON rattrapée jusqu'à la route. Le chemin EN LIGNE
(`definirPrestationsRealisees`) n'avait en outre jamais le contrôle de société que le chemin de file avait
reçu en 9F4H6B (P2003 sur la FK composite pour un identifiant d'une AUTRE société).

Les deux chemins valident maintenant la forme UUID (`estUuid`, `lib/identifiant.ts`) puis l'appartenance au
catalogue de la société, AVANT d'écrire quoi que ce soit — refus nommé, jamais une 500.

Tests : `tests/isolation/rapport-terrain.test.ts`, 5 tests neufs. Vérifié rouge sans le correctif : les 5
échouent avec exactement les erreurs Prisma P2003/P2023 décrites par la revue. `pnpm test:isolation` complet :
1649/1649 verts.

## FIN

- `docs/arbitrages.md` : précision sous D216 pour D142 ajoutée (`342b5411`).
- `tests/e2e/offline/9f4h6b-file-ancien-format.spec.ts` : « point 3 » mis à jour pour l'inverse gardé (point 1
  de ce lot change délibérément ce comportement) — voir `5a31d8ab`. Le reste du dossier `tests/e2e/offline/`
  a été rejoué entièrement sous `CI=1` (workers=1, obligatoire : sous parallélisme par défaut, plusieurs
  fixtures « Filtre à air » coexistent entre spécifications et cassent `getByRole` en mode strict — faux rouge
  déjà connu, pas une régression) : **tout vert** après la mise à jour ci-dessus.
- `CI=1 pnpm verify:full` a été lancé EN ENTIER, au premier plan, en un seul appel, borné à 45 minutes :
  `format:check`, `typecheck`, `lint`, `test` (5011/5011), `test:isolation` (1649/1649), `build`,
  `feries:horizon`, `audit:partitions` sont tous passés PLEINEMENT VERTS avant que `test:e2e` ne démarre.
  `test:e2e` (341 fichiers) n'a pas pu finir dans ce budget — **même limite assumée que 9F4H6B** (voir son
  propre commit de passation) : aucune épreuve n'a échoué dans la portion jouée (zéro `✘`, un seul
  `ECONNRESET` de WebServer sans rapport), seulement le volume qui excède le temps restant. Sortie complète
  dans `verify-final.txt` de ce dossier (coupée par le timeout, pas par un échec).
- Captures NON prises (point ouvert, même raison de budget que l'épreuve e2e du point 4).
- Toute capture d'UN AUTRE lot régénérée par effet de bord des runs e2e ci-dessus a été écartée (`git
  checkout --`/`git clean`), jamais commitée.
- `git fetch origin` + `git rebase origin/main` : branche déjà à jour sur `origin/main` (780ecfd0), rebase sans
  conflit.
- `CI=1 pnpm verify` (gate rapide, sans e2e) : vert — voir ci-dessus, dans le même `verify-final.txt`.

## Points ouverts (dans l'ordre de priorité pour la suite)

1. Épreuve e2e du point 4 (D142) : saisie refusée → retrait → signature/Terminer partent au prochain
   « Envoyer ».
2. Captures 375/1280 : saisie refusée + sa conduite D142, liste des prestations après décocher.
3. `pnpm test:e2e` complet (341 fichiers) jamais rejoué en entier dans cette session — la portion jouée est
   verte, le reste n'a jamais démarré.
