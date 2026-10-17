# 9F4A-TERMINER-SANS-PERTE — passation

Revue de `9F4-TERRAIN-ENREGISTREMENT-AUTO` (publié `5546aed4`, mesurée sur `origin/main`) :
« Terminer » pouvait fermer l'intervention alors qu'un bloc (rapport, prestations,
signature) n'était jamais parti au serveur, et le message hors connexion promettait un
envoi automatique au retour du réseau que rien ne tenait. Les cinq points du ticket sont
livrés.

## Point 1 — Terminer n'appelle jamais `/terminer` tant qu'un bloc n'est pas accepté

`flushTout` (`components/terrain/rapport-automatique.tsx`) rendait `Promise<void>` ;
`envoyerRapport`, `envoyerPrestations` et `tenterEnvoiSignature` rendent désormais un
`VerdictBloc` nommé — `{ etat: "accepte" }`, `{ etat: "hors_ligne" }`, ou
`{ etat: "echec", motifCle }`. `flushTout` les agrège, et `onClickTerminer` n'appelle
`/terminer` que si les trois sont `accepte` ; sinon le brouillon local est GARDÉ (jamais
`effacerBrouillon`) et un message nommé s'affiche sous le bouton.

Unitaires ajoutés (`tests/unit/terrain/rapport-automatique.test.tsx`) : rapport refusé →
`/terminer` jamais appelé, brouillon intact ; rapport jamais parti faute de réseau → idem ;
tout accepté → `/terminer` appelé puis brouillon effacé.

**Effet de bord corrigé en chemin** : l'ancien test « Terminer, hors connexion »
restaurait `navigator.onLine` via un descripteur toujours `undefined` (la propriété vit
sur le PROTOTYPE dans jsdom, jamais sur l'instance) — `false` fuyait silencieusement vers
TOUS les tests suivants du même fichier. Les trois tests neufs échouaient en suite
complète, jamais seuls, tant que ce n'était pas corrigé (`delete` au lieu d'un
`defineProperty` conditionnel). Aucune épreuve n'a été affaiblie : la fuite masquait un
vrai bug de cleanup, pas un défaut du code neuf.

## Point 2 — message vrai

`terrain.terminer.hors_reseau` (« sera terminée dès son retour » — faux, rien ne relance
l'envoi) est retiré de `lib/i18n/fr.ts`, zéro référence restante. Trois clés neuves :
`terrain.terminer.sans_reseau` (le cas hors réseau, un seul bloc touché ou plusieurs,
même texte générique), `terrain.terminer.rapport_non_enregistre`,
`terrain.terminer.prestations_non_enregistrees`, `terrain.terminer.signature_non_enregistree`
(un refus serveur STRUCTURÉ, avec son motif concaténé — jamais une clé interpolée, `t()`
n'interpole pas). Aucun envoi automatique de « Terminer » n'a été ajouté — hors
territoire (lot 9F4H3).

## Point 3 — délai maximal

`envoyerJson` pose un `AbortController` à 15 s (`DELAI_MAXIMAL_ENVOI_MS`) ; l'abandon
tombe dans le même `catch` qu'une coupure réseau réelle → bloc `hors_ligne`, « Terminer »
se réactive. Unitaire avec `vi.useFakeTimers` + un `fetch` qui n'écoute que le signal
d'abandon.

## Point 4 — e2e

Deux scénarios ajoutés à `tests/e2e/9f4-terrain-enregistrement-auto.spec.ts` (3 nouvelles
interventions semées dans le même `beforeAll`/`afterAll`, préfixe `zz9F4`) :

- **route interceptée** (`page.route(...).abort("failed")` sur `/rapport`) : saisie →
  Terminer → en base `statut = "en_cours"`, le commentaire n'est PAS celui saisi ; message
  « Pas de réseau » affiché ; après `page.reload()` (sans toucher à l'interception), le
  champ reprend la valeur du brouillon ; interception levée → Terminer → Terminée, le
  commentaire est en base ;
- **segment ouvert, jamais mis en pause** : l'intervention est semée `en_cours` sans
  aucun segment, le compteur est démarré dans le scénario lui-même (bouton « Reprendre le
  compteur » — le libellé dépend du statut déjà `en_cours`, pas de « Démarrer
  l'intervention », D8/D160 ; le geste posé est le même), le début du segment est reculé
  de 70 min en base (comme `9DE-TP-CY1`), puis Terminer directement, SANS passer par
  « Mettre en pause » — Terminée, `temps_mesure_min > 0` en base. Couvre un cas que la
  fiche « incomplet » existante ne couvrait pas (elle n'a jamais aucun segment).

## Point 5 — captures

`docs/propositions/9F4A-TERMINER-SANS-PERTE/captures/`, EN VIEWPORT (jamais `fullPage`,
un nouveau `capturerViewport` distinct du `capturer` existant de 9F4) : le rapport refusé
avec son motif, et l'absence de réseau, chacun en 375 et 1280. Les deux scènes
descendent la page jusqu'en bas (`window.scrollTo(0, document.body.scrollHeight)`) avant
la prise — la barre basse du terrain est en POSITION FIXE (QE-11, D161) et recouvre
visuellement le message sans que Playwright compte ça comme un obstacle à
`scrollIntoViewIfNeeded` (tenté d'abord, insuffisant : l'élément reste « visible » au sens
de l'intersection avec le viewport même recouvert).

Relu les quatre PNG : le message attendu est lisible, entier, sous le bouton
« Terminer l'intervention », dans les deux largeurs.

## Points ouverts

- **Le brouillon reste prioritaire au montage même s'il est PÉRIMÉ** (plus vieux que la
  dernière valeur serveur, par exemple après qu'un AUTRE appareil ou un collègue en
  renfort a modifié le rapport entretemps) — comportement **mesuré inchangé**, hérité de
  9F4 (voir son en-tête de fichier), pas modifié ici : ce ticket ne touche qu'à ce qui se
  passe APRÈS la saisie (l'envoi et le verdict de Terminer), jamais à la résolution
  brouillon/serveur au montage. Signalé, pas changé — hors territoire de ce ticket
  (`components/terrain/rapport-automatique.tsx`, seule la section « flushTout » et
  `onClickTerminer » sont dans le périmètre explicite).
- Le message `terrain.terminer.sans_reseau` est le MÊME, que ce soit le rapport, les
  prestations ou la signature qui soit `hors_ligne` — jamais nommé par bloc. Choix
  délibéré (cohérent avec les deux exemples du ticket, qui n'en citent que deux, jamais
  trois par bloc) : une coupure réseau touche en pratique les trois en même temps, nommer
  le bloc ajouterait une précision que l'utilisateur ne peut de toute façon pas exploiter
  (il n'y a rien à faire d'autre que d'attendre le réseau).
- `pnpm chemins` n'a pas été rejoué isolément ; `pnpm verify`/`verify:full` le couvrent en
  fin de lot (voir ci-dessous) sans anomalie signalée sur ce territoire.

## Fin de lot

Voir `verify-final.txt` pour la sortie complète de `CI=1 pnpm verify:full`, lancée en un
seul appel, au premier plan, en fin de lot.
