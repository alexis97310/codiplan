# 9F4H3A-FILE-SANS-PERTE — passation

T0 = 14:34 (Pacific/Noumea). `9F4H3-HORS-RESEAU-ENVOYER` et `9F4H2A-REJEU-SANS-DOUBLON` sont bien présents sur
`origin/main` au démarrage (mesuré, `git log origin/main --oneline`).

## Ce qui a été livré, point par point

1. **C1 — la dernière valeur gagne vraiment** (`lib/terrain/file-saisies.ts`). La coalescence (rapport,
   prestations, signature, terminer) écrit désormais dans UNE SEULE transaction IndexedDB (lecture, suppression
   de l'entrée précédente, écriture de la nouvelle) — avant ce lot, c'était un `retirerSaisie` dans une
   transaction séparée puis un `put` dans une autre, avec une fenêtre où aucune des deux n'existait. Surtout :
   `retirerSaisieCoalescable`, appelée après un envoi EN LIGNE accepté du rapport, des prestations ou de la
   signature (`components/terrain/rapport-automatique.tsx`), retire de la file l'entrée du même type restée
   depuis une coupure antérieure — SANS ce retrait, « Envoyer » renvoyait une saisie périmée par-dessus une
   valeur plus récente déjà enregistrée. `ajouterSaisie` accepte désormais `id`/`instantAppareil` en override
   (posé pour le point 3).

2. **C2 — jamais « gardé » sans preuve** (`lib/terrain/file-saisies.ts`, et les trois appelants). `ajouterSaisie`
   rend `{gardee:true,id}` ou `{gardee:false}` plutôt qu'un `id` toujours rendu même quand IndexedDB échoue
   réellement (mode privé, quota, base bloquée). Sur `gardee:false`, aucun appelant n'affiche « gardé » ni ne
   vide l'écran : la photo reste dans l'aperçu, le formulaire n'est pas réinitialisé, le brouillon reste intact,
   et une clé neuve (`terrain.file.echec_gardee`) invite à réessayer sans fermer la page.

3. **C7 — un identifiant dès le premier essai** (`lib/terrain/file-saisies.ts#nouvelleOperation`, compteur,
   signature, terminer). Le compteur, la signature et « Terminer » fabriquent leur `operation_id` et l'heure de
   l'appareil AVANT leur premier envoi EN LIGNE et les envoient dès ce premier essai (routes de 9F4H2,
   inchangées) ; en cas d'échec, la file reprend le MÊME identifiant. Avant ce lot, le premier essai en ligne du
   compteur ne portait AUCUN `operation_id` : en « lie-fi » (réponse perdue après traitement serveur), le renvoi
   par la file partait avec un second identifiant et se faisait refuser (`deja_en_cours`/`aucun_en_cours`), sans
   jamais pouvoir repartir.
   - **Point ouvert, à mesurer par le pilote** : `saisi_hors_reseau` (colonne `segment_travail`) devient vrai
     pour TOUTE action de compteur, qu'elle réussisse en ligne du premier coup ou non — la route
     (`app/api/terrain/[id]/compteur/route.ts`, HORS TERRITOIRE de ce lot) la pose dès qu'un `instant_appareil`
     est fourni, et C7 en fournit désormais un systématiquement. Avant ce lot, un démarrage réussi en ligne du
     premier coup portait `saisi_hors_reseau: false` ; depuis, il porte `true`. La colonne ne distingue donc
     plus « vraiment saisi hors réseau » de « envoyé en ligne, protégé contre un rejeu » — un back-office qui
     l'affiche verrait désormais TOUJOURS le badge « hors réseau ». Je n'ai pas trouvé de façon d'obtenir la
     protection anti-doublon du point 3 SANS cet effet de bord (le serveur ne peut reconnaître un rejeu que si
     le premier essai portait déjà le même `operation_id`), et la route est hors territoire de ce lot — à
     trancher par le pilote : soit la colonne change de sens (documentation seule), soit un lot séparé
     distingue les deux faits autrement (ex. une colonne booléenne distincte pour « ce segment a reçu un
     `operation_id` », différente de « ce segment a réellement été démarré/arrêté hors réseau »).

4. **C5 — verdict « Terminer » local** (`components/terrain/rapport-automatique.tsx`,
   `app/(mobile)/terrain/[id]/page.tsx`). Hors réseau, « Terminer » est jugé par `peutTerminer`
   (`lib/interventions/cycle-de-vie.ts`, importé tel quel — mesuré : il n'importe que des types, aucun Prisma ni
   accès serveur n'entre dans le paquet client) sur l'état LOCAL : statut effectif (`en_cours` si un « démarrer »
   est déjà en file), temps mesuré (minutes connues du serveur au rendu + segments compteur FERMÉS restés en
   file, appariés chronologiquement par `minutesDeLaFile`), signature localement complète (`dejaSignee`, ou un
   brouillon de signature/motif rempli). Un refus se nomme comme en ligne (même clé que `peutTerminer`
   poserait) et ne met rien en file. Une ligne de précision a été ajoutée sous D215
   (`docs/arbitrages.md`) : son texte disait « `peutTerminer` n'est jamais rejugé côté client », ce qui n'est
   plus vrai.
   - **Piège rencontré en écrivant les unitaires** : deux appels `ajouterSaisie` sans `id` explicite, dans la
     même milliseconde de test, peuvent se trier dans le DÉSORDRE (le tri lexicographique d'un UUID v7 ne
     départage que par les octets aléatoires à égalité de milliseconde) — `minutesDeLaFile` pariait alors sur
     un « arrêter » avant un « démarrer » et rendait 0 minute. Sans conséquence en usage réel (un humain ne
     clique pas démarrer/arrêter dans la même milliseconde), mais les tests qui simulent deux appels rapprochés
     doivent fixer des `id` explicitement ordonnés (voir `tests/unit/terrain/rapport-automatique.test.tsx`,
     describe C5).

5. **C6 + C3 — écran à jour** (`components/terrain/compteur-terrain.tsx`, `components/terrain/bouton-envoyer.tsx`).
   - `compteur-terrain` écoute désormais `EVENEMENT_FILE_MODIFIEE` (relu au montage ET à chaque modification de
     la file, comme la section Terminer et `BoutonEnvoyer` le faisaient déjà) — avant ce lot, une file vidée
     par « Envoyer » ne le faisait pas redescendre vers l'état serveur sans rechargement complet.
   - Un refus serveur EN LIGNE (ex. compteur déjà ouvert ailleurs, détecté entre le rendu et le clic) affiche
     désormais son motif ; avant ce lot, rien ne s'affichait, le bouton se réactivait juste.
   - `BoutonEnvoyer` affiche « En attente d'envoi (n) » dès la coupure, sans attendre le retour du réseau —
     avant ce lot, hors ligne, rien ne montrait la file (sauf un refus déjà posé).
   - `BoutonEnvoyer` affiche « Des saisies d'un autre compte sont gardées sur ce téléphone… »
     (`terrain.file.autre_identite`, clé posée par 9F4H3 mais jamais référencée nulle part avant ce lot) quand
     `contientSaisiesDuneAutreIdentite` est vrai.

6. **Épreuve e2e** `tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts` — scène dédiée (préfixe `9F4H3A-`), trois
   scénarios, TOUS PASSENT (mesuré, `pnpm exec playwright test tests/e2e/offline/9f4h3a-file-sans-perte.spec.ts`,
   3 passed) :
   - (a)+(b)+(c) : un rapport « A » saisi hors réseau, puis réédité en « AB » une fois le réseau revenu et
     envoyé directement en ligne — c'est « AB » qui reste en base après « Envoyer », jamais « A » (C1). Un
     rejeu du même envoi (même `operation_id`, même `instant_appareil` que ce que « Envoyer » avait réellement
     transmis) ne double ni le segment ni le rapport (b). Le segment compteur antidaté de 42 minutes en file
     porte bien cette durée, ±1 minute, une fois envoyé (c).
   - (d) : une intervention annulée au bureau pendant la coupure garde sa saisie en file, motif affiché,
     « Envoyer (1) » toujours visible — jamais « Tout est envoyé ».
   - Captures (point 7) : les quatre écrans demandés, décrits ci-dessous.
   - **Piège rencontré, deux fois** : `antidaterLeDemarrage` (manipulation directe d'IndexedDB) doit attendre
     que le geste « démarrer » soit RÉELLEMENT écrit par le composant (attendre le bandeau « Démarré hors
     réseau depuis… ») avant de modifier l'entrée — sans cette attente, la manipulation tombe sur une file
     encore vide et ne fait rien, silencieusement (l'entrée réelle, non antidatée, écrase ensuite). Et : des
     process `next start` laissés tournants entre deux invocations de `pnpm exec playwright test` tiennent des
     connexions ouvertes sur `codiplan_test`, empêchant le `globalSetup` de la DROP/CREATE à l'exécution
     suivante (`ps aux | grep next-server`, `kill`).

7. **Captures** (`docs/propositions/9F4H3A-FILE-SANS-PERTE/captures/`, 375 et 1280 px, en viewport sans
   `fullPage`) :
   - `confirmation-deconnexion-file-non-vide` : le bandeau `role="alertdialog"` déjà livré par 9F4H3
     (`components/terrain/effacement-copie-locale.tsx`, NON MODIFIÉ par ce lot) — « 1 saisie n'est pas
     envoyée. Elle sera perdue si vous vous déconnectez. », « Le réseau est nécessaire pour envoyer avant de
     vous déconnecter. », bouton « Se déconnecter quand même ».
   - `echec-de-garde` : le message rouge du point 2 (C2) sous le rapport — « Ce téléphone n'a pas pu garder la
     saisie : gardez cette page ouverte et réessayez quand le réseau revient. » — obtenu en cassant
     `window.indexedDB` (`addInitScript`) puis en saisissant hors réseau ; le bouton « Terminer l'intervention »
     reste visible juste au-dessus (rien n'a changé d'état, la saisie précédente n'a pas été acceptée à tort).
   - `autre-identite` : le bandeau orange du point 5 (C3) — « Des saisies d'un autre compte sont gardées sur ce
     téléphone : reconnectez-vous avec ce compte pour les envoyer. »
   - `en-attente-hors-ligne` : « En attente d'envoi » sur la fiche, hors réseau, sans attendre le retour du
     réseau (point 5, C6).

## Points ouverts

- **Ouvrir l'application DÉJÀ hors réseau** mène à la coquille de consultation servie par le service worker
  (`public/sw.js`, `REPLI_TERRAIN`), où l'on ne peut PAS saisir — c'est une limite PRODUIT que ce lot ne traite
  pas (le territoire exclut `public/sw.js`) : un technicien qui rouvre son téléphone en mode avion, sur une
  fiche jamais ouverte en ligne depuis la dernière synchronisation, voit la coquille en lecture seule plutôt
  que le formulaire de saisie. Seule une page déjà chargée EN LIGNE puis coupée (le scénario que toutes les
  épreuves e2e de 9F4H3/9F4H3A mesurent) permet de saisir hors réseau.
- **Une saisie refusée par `ajouterSaisie` (C2) bloque la suite de cette intervention, sans geste pour en
  sortir.** Le technicien voit le message « gardez cette page ouverte et réessayez quand le réseau revient »,
  mais rien ne lui propose de continuer SANS que cette saisie-là soit gardée (ex. abandonner le rapport et
  passer à la signature) ni de réessayer explicitement par un bouton dédié — seul un nouveau `blur`/changement
  du même champ retente l'écriture. Si IndexedDB reste indisponible (navigation privée, par exemple), rien ne
  permet au technicien de terminer son intervention depuis ce téléphone tant qu'il n'a pas retrouvé le réseau
  OU changé de navigateur. Comportement JUGÉ ACCEPTABLE pour ce lot (cas rare — IndexedDB cassé est déjà une
  panne de l'appareil, pas du produit) mais à nommer si un futur lot y revient.
- **Le piège d'ordre des UUID v7 à la même milliseconde** (voir point 4 ci-dessus) touche aussi
  `lib/terrain/file-saisies.ts#listerFile`/`listerFilePourIntervention` en général (documenté dans l'en-tête du
  fichier comme garantie de tri, mais la garantie n'est qu'APPROXIMATIVE à cette granularité). Sans conséquence
  pratique mesurée (un humain ne saisit pas deux gestes dans la même milliseconde), signalé pour mémoire.
- **`saisi_hors_reseau` devenu toujours vrai pour le compteur** — voir point 3 ci-dessus, la question la plus
  concrète de cette passation.

## Vérification finale

`pnpm verify:full` n'a pas pu être lancé en une seule commande dans le temps imparti (`pnpm test:e2e` seul
dépasse 50 minutes sans finir — même limite déjà signalée par 9F4H3). À la place, EXÉCUTÉ SÉPARÉMENT, EN UN
APPEL CHACUN : `CI=1 pnpm verify` (format:check+typecheck+lint+test+test:isolation+build, **vert**),
`pnpm feries:horizon` (**vert**), `pnpm audit:partitions` (**vert**), ma propre épreuve e2e (3/3) et quatre
fichiers e2e voisins (`9f4h3-mode-avion`, `9f4h1-consultation`, `terrain`, `rapport-terrain` — tous verts en
isolation ; un échec en exécution groupée de `rapport-terrain` est une contamination de scène partagée sous
`fullyParallel` par `9f4h3-mode-avion`, mesurée étrangère). Détail complet dans `verify-final.txt`, ce même
dossier.

```
├ ƒ /terrain-hors-reseau                             2.59 kB         178 kB
├ ƒ /terrain/[id]                                    5.92 kB         194 kB
├ ƒ /terrain/profil                                    385 B         103 kB
├ ƒ /vgp                                             1.17 kB         165 kB
├ ƒ /vgp/a-determiner                                  853 B         118 kB
└ ƒ /vgp/enregistrer/[id]                              211 B         106 kB
+ First Load JS shared by all                         102 kB
  ├ chunks/0c86f1d0-e396209ab64996d1.js              54.2 kB
  ├ chunks/8817-050d255d41a76bbe.js                    46 kB
  └ other shared chunks (total)                      1.93 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

EXIT=0
```

Commit final : `5c7045cf`.
