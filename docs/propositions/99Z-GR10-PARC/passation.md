# 99Z-GR10-PARC — passation

## Ce que j'ai changé

Trois changements sur `/parc`, et lui seul — aucune migration, aucune ligne de semis, aucun prix.

1. **GR10** (audit GR du 26/09, constat G13) — les quatre filtres (statut, client, site, famille)
   portaient un `<label className="sr-only">` : un ADV qui n'avait pas encore choisi de valeur
   lisait quatre champs muets, devinables seulement par essai. Chaque libellé devient un texte
   visible (`text-[9px] leading-[8px]`, posé au-dessus du `<select>`), sans toucher aux `id`. Pour
   que la barre agrandie ne fasse pas passer la liste sous les 480 px visibles mesurés par 99C
   (constat 30), le `gap-2` vertical entre la barre et les trois KPI — la seule respiration
   documentée comme « sous le contrôle de cette page » — passe à zéro : les deux effets
   s'annulent presque exactement (voir mesures ci-dessous).
2. **PARC-A** (décision d'Alexis, 26/09/2026) — `rechercherLeParc` triait les fiches incomplètes
   EN TÊTE (`{ complet: "asc" }`) ; c'est désormais EN FIN (`{ complet: "desc" }`). L'exploitation
   voit d'abord ce qui est utilisable, l'exception attend en bas.
3. **PARC-B** (décision d'Alexis, 26/09/2026) — la liste maître affiche désormais un intertitre
   non cliquable (`<p role="presentation">`) à chaque changement de client, y compris en tête de
   page. Un client présent à la fois dans la partie complète et dans la partie incomplète (PARC-A)
   porte deux intertitres — conséquence naturelle du regroupement séquentiel, pas un cas
   particulier codé à part (vu sur la capture APRÈS : « Atelier Ducos » apparaît deux fois).

Pour l'exploitation : les filtres se comprennent sans essai-erreur, le parc s'ouvre sur ce qui est
exploitable plutôt que sur l'exception, et un ADV qui cherche « où commence tel client » n'a plus à
lire chaque ligne.

## Ce que j'ai mesuré

- **480 px de liste visible (constat 30, `parc-tri.spec.ts`)** — mesuré directement dans un
  navigateur réel (script de mesure temporaire, jamais commité) :
  - AVANT tout changement de ce lot (commit `f439204`) : **483,86 px** visibles, barre à 40 px.
  - Après GR10 seul, labels ajoutés SANS retirer le `gap-2` : **481,86 px** — passerait, mais avec
    une marge de 1,86 px jugée trop fragile (rendu de police, environnements différents).
  - État final (labels `text-[9px] leading-[8px]`, `gap-2` → `gap-0`) : **483,86 px** — IDENTIQUE
    à l'avant, barre à 48 px. L'épreuve officielle (`parc-tri.spec.ts`, seuil ≥ 480 px) est verte.
- **Ordre des fiches (scène `PARCA-`, `tests/e2e/parc-incompletes-fin.spec.ts`)** — une machine
  `complet: true` et une machine `complet: false`, même client, même désignation de modèle :
  la complète précède l'incomplète dans `[data-bloc="liste-machines"] a`. Vert.
  L'épreuve existante `PTRI-` (99C-PARC-TRI) reste verte : les deux machines de sa scène
  partagent le même `complet`, donc l'inversion ne change rien à son ordre attendu.
- **Regroupement par client** — gardien unitaire `parc-regroupement-client.test.ts` : parc vide →
  liste vide ; intertitre en tête ; aucun second intertitre entre deux lignes consécutives du même
  client ; un intertitre par changement de client_id ; un client réparti sur deux groupes séparés
  (complet, puis incomplet, avec un autre client entre les deux) porte deux intertitres.
- Suite complète : `pnpm format:check`, `pnpm typecheck`, `pnpm test` (271 fichiers, 2920 tests),
  `pnpm lint`, et les scénarios de bout en bout `parc.spec.ts`, `parc-tri.spec.ts`,
  `parc-incompletes-fin.spec.ts`, `listes-1.spec.ts`, `liens-3.spec.ts`, `parc-apercu-borne.spec.ts`,
  `ecrans-largeur-utile.spec.ts` (22 scénarios) — tous verts.

## Ce que j'ai tranché et pourquoi

- **Taille et interligne des labels** (`text-[9px] leading-[8px]`, sans marge) plutôt qu'un corps
  plus confortable (11-12px, comme `KvLigne`) : la contrainte des 480 px ne laissait que quelques
  pixels de marge (voir mesures). Un corps plus grand aurait exigé de retirer davantage de
  hauteur ailleurs dans la barre, ce que le ticket interdit de faire sur la ligne de résultat.
- **`gap-2` → `gap-0`** entre la barre de filtres et les trois KPI, plutôt qu'un autre endroit :
  c'est la seule respiration que le commentaire du code (99C) documentait déjà comme « sous le
  contrôle de cette page » — les paddings de `Kpi` et de `Page` sont mesurés sur la maquette et
  gardés par un gardien unitaire, donc hors de portée sans casser autre chose.
- **`items-end` plutôt que `items-center`** sur la barre : les filtres sont maintenant plus hauts
  que le champ de recherche et le bouton « Réinitialiser » (label + select contre 40 px et 32 px) ;
  aligner par le bas fait correspondre le bas des `<select>` avec le bas du champ de recherche,
  au lieu de centrer des blocs de hauteurs différentes.
- **`bg-app-surface-creuse`** pour le fond de l'intertitre : un jeton déjà déclaré dans
  `app/globals.css`, jamais une couleur inventée — aucun jeton dédié n'existe pour cet usage,
  qui n'a pas d'équivalent dans la maquette (voir écart nommé ci-dessous).
- **Intertitre déclaré dans `lib/machines/ecarts-maquette.ts`** (`ECARTS_MAQUETTE_AJOUTS_PARC`) :
  bien que ce fichier ne soit vérifié par aucun gardien automatique pour son exhaustivité (lu :
  `tests/unit/machines/ecarts-maquette.test.ts` ne le référence pas), la convention du dépôt est
  d'y nommer tout ce que l'écran ajoute au-delà de ce que `parc()` dessine (pagination, lien VGP) ;
  l'intertitre suit la même règle par cohérence.
- **`docs/arbitrages.md` non modifié** : les deux décisions (A et B) sont présentées par le ticket
  comme déjà arrêtées par Alexis le 26/09/2026, et le territoire du ticket ne liste pas ce fichier.
  Je documente donc la décision dans le code (docblock de `rechercherLeParc`,
  `regrouperLeParcParClient`) plutôt que d'ouvrir une nouvelle entrée hors territoire.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `depot/`, ni `11-FILE.sh`, ni aucune fixture `SCENE.*` partagée.
- Je n'ai pas ajouté d'entrée à `docs/arbitrages.md` (voir ci-dessus).
- Je n'ai pas changé la logique de recherche, de filtrage, ni la pagination.
- Je n'ai pas touché `components/mise-en-page/page.tsx` ni `components/ui/kpi.tsx` : la
  contrainte des 480 px a été tenue entièrement à l'intérieur du territoire du ticket.
- Je n'ai pas vérifié le rendu sur un lecteur d'écran réel (le passage de `sr-only` à un texte
  visible change l'expérience au clavier/lecteur d'écran de façon a priori neutre ou positive,
  mais je ne l'ai pas mesuré avec un lecteur d'écran — non vérifié, pas une mesure).

## Les pièges pour la session suivante

- La marge sur l'épreuve des 480 px est **mesurée, pas confortable** : 3,86 px au départ, retrouvés
  à l'identique après ce lot par un ajustement volontairement précis (taille de police au pixel,
  `gap-2` → `gap-0`). Toute future modification de la barre de filtres de `/parc` (un cinquième
  filtre, un libellé plus long qui force un retour à la ligne, un padding touché ailleurs) doit
  RE-MESURER cette épreuve avant de la croire verte — ne pas supposer que la marge est large.
- Le script de mesure temporaire (`tests/e2e/zz-tmp-mesure.spec.ts` et
  `zz-tmp-captures-gr10.spec.ts`, tous deux supprimés avant ces commits) est le moyen le plus sûr
  pour re-mesurer : un `page.evaluate` qui lit `getBoundingClientRect()` sur
  `[data-bloc="liste-machines"]`, jamais une estimation manuelle en pixels de police.
- `regrouperLeParcParClient` suppose `lignes` déjà groupée par client (c'est `rechercherLeParc`
  qui le garantit par son `orderBy`). Si un futur ticket change cet `orderBy` pour trier
  autrement à l'intérieur d'un groupe sans préserver le regroupement par `client_id` en premier
  niveau, les intertitres se multiplieront silencieusement (un intertitre par ligne) sans qu'aucun
  gardien actuel ne le voie — le gardien unitaire teste la fonction pure, jamais son entrée réelle
  depuis `rechercherLeParc`.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre du ticket. Les trois points (GR10, PARC-A, PARC-B) sont
  livrés, testés (unitaire + bout en bout) et capturés AVANT/APRÈS à 1280 et 375.
- Hors périmètre, pour une session future si jugé utile : consigner les décisions A et B dans
  `docs/arbitrages.md` si une prochaine session estime que leur seule trace en docblock est
  insuffisante pour la hiérarchie des sources du §1.
