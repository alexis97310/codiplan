# 9F4-TERRAIN-ENREGISTREMENT-AUTO — passation

Mesuré sur `origin/main` b28e38ba au départ (décision n° 95 d'Alexis, 13/10/2026, D212 ;
prérequis 9EWB-PHOTOS-EN-BASE confirmé présent sur `origin/main` avant de commencer).
Six commits livrés : routes en arrière-plan + dé-duplication de signature, composant
unique + bouton Terminer, épreuves unitaires, épreuves e2e neuves, captures, décision
D212 + passation.

## Ce que j'ai changé

- **Quatre routes en mode « arrière-plan »** (`app/api/terrain/[id]/{rapport,prestations,
  signature,terminer}/route.ts`) : répondent en JSON `{ok, motif}` quand la requête porte
  `Accept: application/json` (le composant client), gardent leur redirection 303
  inchangée sinon (formulaire natif sans JavaScript, et les épreuves unitaires
  existantes qui n'envoient pas cet en-tête).
- **`enregistrerSignature` (`lib/interventions/depot-rapport-terrain.ts`) ne crée plus
  de ligne pour une saisie IDENTIQUE à la dernière** (même issue, nom, qualité, motif,
  image) — rend l'existante. Nécessaire dès que l'envoi devient automatique et peut se
  répéter (réouverture d'onglet, retry réseau) sans faire grossir l'historique, resté
  APPEND-ONLY (D173).
- **`components/terrain/rapport-automatique.tsx` (neuf) remplace `signature-terrain.tsx`
  (supprimé) et les sections de formulaire « rapport », « prestations », « signature »,
  « terminer » de `app/(mobile)/terrain/[id]/page.tsx`.** Un seul composant client parce
  que le bouton Terminer doit pouvoir envoyer tout ce qui est encore en attente avant son
  propre POST — une coordination entre composants frères via un contexte aurait compliqué
  sans rien gagner. Les photos restent indépendantes (`PhotosTerrain`, 9EWB) : la page les
  passe en prop `sectionPhotos` pour garder l'ordre visuel d'origine.
  - Texte (commentaire, suite) : débounce 1,5 s après la dernière frappe, et envoi
    immédiat au `blur`.
  - Prestations et signature : envoi immédiat à chaque changement complet.
  - Brouillon local (`localStorage`, clé par intervention) : écrit à CHAQUE saisie,
    AVANT toute tentative réseau ; repris au montage (préféré aux valeurs serveur, puisqu'il
    n'existe que si une saisie locale a eu lieu depuis le dernier envoi réussi) ; effacé
    seulement après un Terminer accepté.
  - Échec réseau : indicateur « hors connexion », brouillon gardé, retenté
    automatiquement au retour du réseau (écoute `online`).
  - Indicateur par bloc (`role="status"`, texte, pas de bouton) : « Enregistrement… »,
    « <Bloc> enregistré. », « Hors connexion : gardé sur le téléphone, envoyé au retour
    du réseau. »
- **Le bouton Terminer est désormais TOUJOURS affiché quand `ligne.statut === "en_cours"`**,
  au lieu d'être remplacé par un refus précalculé côté page. **Le piège mesuré** : la page
  jugeait le temps avec `mesureDeLIntervention`, qui ne compte que les segments FERMÉS —
  un compteur démarré puis jamais mis en pause masquait le bouton, alors que la route
  `terminerIntervention` ferme elle-même le segment ouvert avant de recompter (déjà
  correcte côté dépôt, `tests/isolation/terminer-intervention.test.ts:154`). Le correctif
  n'ajoute AUCUNE projection côté client : il arrête simplement de pré-juger pour ce
  statut, et laisse le serveur trancher au clic — un refus s'affiche sous le bouton, les
  statuts figés (annulée/clôturée/pas en cours) gardent leur ancien refus statique
  pré-rendu, inchangé.
- **i18n** (`lib/i18n/fr.ts`) : `terrain.auto.enregistrement`, `terrain.auto.hors_ligne`,
  `terrain.terminer.hors_reseau`, `terrain.e2e.prestation_libelle` ajoutées ;
  `terrain.rapport.enregistrer`, `terrain.prestations.enregistrer`,
  `terrain.signature.enregistrer` retirées (orphelines — plus aucun bouton ne les
  affiche).
- **Doc** : `docs/arbitrages.md` D212 (nouvelle décision, amende D161 sur les BOUTONS
  seulement — « un seul écran » reste la règle) ; câblage bidirectionnel D161 ↔ D212 tenu
  par `tests/unit/docs/amendements-arbitrages.test.ts`.

## Ce que j'ai mesuré

- **Unitaire** :
  - `tests/unit/interventions/terrain-routes-json.test.ts` (neuf) — les quatre routes
    répondent `{ok, motif}` en JSON sur succès et sur refus nommé, et gardent leur 303
    sans l'en-tête `Accept`.
  - `tests/unit/terrain/rapport-automatique.test.tsx` (neuf, `@testing-library/react`) —
    brouillon local prioritaire au montage, débounce (rien avant 1,5 s, tout au `blur`),
    envoi immédiat des prestations et de la signature « client absent »/« refus », bouton
    Terminer qui refuse hors connexion SANS joindre la route. Le tracé du canevas n'est
    pas éprouvé ici (jsdom ne pose aucun contexte 2D) — c'est le rôle des e2e.
  - Deux gardiens de décompte de boutons mis à jour sur la population réelle, 7
    (`tests/unit/ui/composants-base.test.tsx`, `tests/unit/ui/retouches-2a.test.ts`) —
    la signature perd son propre « Enregistrer » en migrant vers le fichier neuf.
  - `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` — piège trouvé et évité : un
    `const texte = <ternaire avec t("...") nichés>` rendu en JSX fait lire la CLÉ comme
    une chaîne en dur par le gardien (`constantesLitterales` résout un `const` avec un
    contexte VIDE, où `t` n'est plus reconnu) ; corrigé en remplaçant le `const` par une
    fonction (jamais signalée par ce gardien, qui ne scanne que les `VariableDeclaration`).
- **Isolation** : `tests/isolation/rapport-terrain.test.ts` — deux scénarios neufs (une
  saisie identique à la dernière n'ajoute pas de ligne et rend l'existante ; une saisie
  qui diffère, même sur un seul champ, ajoute bien une ligne).
- **Bout en bout**, fichier neuf `tests/e2e/9f4-terrain-enregistrement-auto.spec.ts` (sa
  propre scène, préfixée `9F4-`) :
  - Deux envois JSON identiques à la route signature ne créent qu'UNE ligne (compté
    directement en base).
  - Mode avion (`context.setOffline`) : saisie du commentaire PAGE OUVERTE hors
    connexion → indicateur « hors connexion » → retour du réseau → envoi automatique →
    Terminer réussit. Le compteur (démarrer/pause) reste hors territoire de ce ticket :
    temps mesuré et signature sont pré-semés directement en base pour isoler ce qui est
    réellement neuf. **Aucune prestation créée dans ce scénario** : le catalogue de
    CODIMA-NC est partagé par tous les fichiers e2e sous `fullyParallel`, et
    `rapport-terrain.spec.ts` mesure justement qu'il reste vide pour cette société —
    l'envoi immédiat des prestations est déjà éprouvé à l'unité.
  - Le bouton Terminer reste affiché sur une intervention sans aucun temps mesuré ni
    signature (preuve par l'écran du correctif du piège) ; le motif du serveur
    (`intervention.refus.temps_manquant`) s'affiche sous le bouton.
  - Captures 375/1280 : `terrain-fiche-en-saisie`, `terrain-hors-connexion`,
    `terrain-terminer-incomplet`.
  - Rejoué avec les quatre épreuves adaptées (`rapport-terrain.spec.ts`, `bon-4.spec.ts`,
    `9di-tp-ter1-journee-fiche.spec.ts`, `9de-terminer-signature.spec.ts`) — 11 scénarios,
    tous verts ensemble. Deux captures d'AUTRES lots (76-BON-4, 9DE-TP-CY1-TERMINER-
    SIGNATURE) régénérées par effet de bord de ce run — **restaurées** avant de commiter.
- **Épreuves existantes adaptées** (le geste manuel « Enregistrer » devient : saisir →
  attendre l'indicateur « Enregistré » → (`localStorage.clear()` +) recharger → la
  valeur relue vient du serveur) : `rapport-terrain.spec.ts` (commentaire/suite,
  signature), `bon-4.spec.ts` (signature), `9de-terminer-signature.spec.ts` (signature),
  `9di-tp-ter1-journee-fiche.spec.ts` (bandeau vert → indicateur « Enregistré », même
  ton).

<!-- La section ci-dessous est complétée après le run `CI=1 pnpm verify:full`. -->

## Ce qui reste ouvert

- **Les photos n'entrent pas dans la file d'attente hors connexion** (pas d'IndexedDB) —
  explicitement hors territoire et reporté par D212 : le composant actuel échoue
  proprement hors connexion (indicateur « Échec »), sans perte silencieuse, mais ne
  retente pas automatiquement au retour du réseau comme le rapport/prestations/
  signature. Un ticket séparé devra l'ajouter s'il est jugé nécessaire.
- **Le tracé de la signature n'est pas redessiné visuellement après un rechargement** —
  seule l'image déjà capturée (le PNG) est conservée dans le brouillon et renvoyée ;
  l'aperçu visuel du trait se perd, la donnée non. Limite assumée, nommée dans D212.
- **Le compteur (démarrer/pause, D120) reste un `<form>` serveur ordinaire** — hors
  territoire explicite de ce ticket, jamais touché.
- **Pas de sous-épreuve dédiée « saisie hors connexion → retour du réseau AVANT envoi →
  rechargement → brouillon local repris »** (citée au ticket comme variante fine du mode
  avion) : la fusion brouillon/serveur au montage est éprouvée à l'unité
  (`rapport-automatique.test.tsx`), et le scénario e2e principal couvre déjà offline →
  retour réseau → envoi → Terminer. La variante de timing exacte (reload pendant la
  fenêtre d'envoi) n'a pas été ajoutée séparément, par manque de budget — scope réduit
  assumé plutôt que caché.

## Fin de lot

`git grep -l "/terrain" tests/e2e` donne ~30 fichiers ; ceux qui ouvrent réellement
`/terrain/[id]` et pourraient toucher au rapport/signature ont été identifiés par
`git grep -lE "goto\(.*\$\{.*\}/terrain/"` et `git grep -lE "terrain\.(rapport|
prestations|signature)\.enregistrer|signature-terrain"` — seul `bon-4.spec.ts`
référençait un bouton retiré, adapté (voir ci-dessus). `pnpm format` + `pnpm typecheck` +
`pnpm lint` + `pnpm test` + `pnpm test:isolation` verts avant chaque commit.

`CI=1 pnpm verify:full` lancé en entier, en UN appel, sur HEAD `f32c2158` (point 5a) —
**vert en entier** : `format:check`, `typecheck`, `lint`, `test` (449 fichiers, 4825 tests),
`test:isolation` (181 fichiers, 1607 tests), `build`, `feries:horizon`, `audit:partitions`
(13 partitions couvertes, jusqu'à 2027-10), puis `test:e2e` complet (`workers: 1`) :

```
  48 skipped
  1399 passed (54.8m)
```

Aucun échec. **Rejouer la suite e2e complète régénère, par effet de bord, les captures
PNG/PDF de nombreux autres lots** (chaque fichier `captures-*.spec.ts` écrit directement
dans son propre `docs/propositions/.../captures/`) — 239 entrées mesurées par
`git status --porcelain` après coup (fichiers suivis modifiés + six captures neuves de
`9DF-TP-CY2-MATRICE-D8` et `47-AVERTISSEMENTS-1`), toutes **restaurées** à leur état
commité (`git checkout --` sur les suivies, suppression des neuves) ; seuls les fichiers
de `docs/propositions/9F4-TERRAIN-ENREGISTREMENT-AUTO/` et ce fichier de passation
restent. Arbre propre avant ce commit.
