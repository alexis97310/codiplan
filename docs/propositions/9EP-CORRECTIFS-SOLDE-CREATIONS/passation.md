# Passation — 9EP-CORRECTIFS-SOLDE-CREATIONS

Onze points du solde des formulaires de création (machine, client, site), mesurés sur
`origin/main` à `8e9b760a` (09/10/2026), issus des relectures de 9EB-2, 9EK-1/9EKA et 9EKB.

| Point | Commit |
|---|---|
| 29 | `863636b2` |
| 38 | `a68206b3` |
| 40 | `7b7d8509` |
| 41 | `025c9655` |
| 42 | `2fc79353` |
| 45 | `ad995ac5` |
| 46 | `02612d28` |
| 47 | `5829e81c` |
| 48 | `0ecb3665` |
| 49 | `48256e6f` |
| 50 | `ea901c97` |
| captures | `4d543996` |

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Point 45** — `machine.action.creer` redevient « Enregistrer » et `machine.nouvelle.sous_titre`
  est recréée telle qu'avant 9EKB (aucune clé i18n existante modifiée ni supprimée, conforme à la
  règle du lot). Le bouton de création lit la clé NEUVE `machine.action.creer_la_machine` —
  aucun changement visible à l'écran, seulement la cohérence du dictionnaire.
- **Point 46** — Le bouton « Enregistrer » du mode modification (`/parc/<id>/modifier`) avait
  perdu son apparence bleue d'action primaire (régression silencieuse de D184). Il la retrouve :
  un technicien qui corrige une fiche voit à nouveau le même bouton que partout ailleurs.
- **Point 47** — Un `eslint-disable` retiré sans changement de comportement (dépendance
  `props.mode` ajoutée, stable pour une instance donnée).
- **Point 48** — L'aide de la famille (« Pour raccourcir la liste des modèles ») sortait du
  `<label>` — comme les deux autres champs du formulaire l'avaient déjà fait. Un lecteur d'écran
  annonçait jusqu'ici le select « Famille Pour raccourcir la liste des modèles » : il annonce
  maintenant juste « Famille », l'aide restant atteignable par `aria-describedby`.
- **Point 49** — Le refus serveur des trois états fermés à la création (remplacée, ferraillée,
  fusionnée) existait déjà dans `app/api/machines/creer/route.ts` mais n'était couvert par aucun
  test — un changement futur aurait pu le casser en silence. Couvert maintenant (JSON,
  redirection, rendu sous le groupe d'état).
- **Point 50** — Le nettoyage e2e de `9ekm-creations-2.spec.ts` et
  `captures-9ekm-creations-2.spec.ts` reposait en partie sur un `numero_serie: { startsWith }` —
  un filtre textuel, pas un identifiant forgé. Retiré ; le nettoyage ne repose plus que sur des
  identifiants (`id in [...]` tracé par chaque scénario, `client_id` de la scène en secours).
- **Point 29** — Assertion resserrée (`toBe(2)` + ordre vérifié) et commentaire obsolète corrigé
  (`ResumeListe` a disparu depuis 591e912f).
- **Point 38** — CS41 (agence unique présélectionnée à `/sites/nouveau`) était câblé mais jamais
  éprouvé. Extrait dans un composant `ChampRattachement`, maintenant testé (une agence, deux
  agences, `agenceGardee`, zéro agence).
- **Point 40** — Q10 : le bouton « ? » de l'aide du code client entrait dans le nom accessible du
  champ (il était DANS le `<label>`) — sorti, relié par `htmlFor`/`id`. Q8 : l'alerte d'homonymie
  restait au singulier même avec plusieurs homonymes (« Un client du même nom existe déjà » pour
  deux clients ou plus) — deux clés neuves au pluriel la corrigent.
- **Point 41** — `GET /api/clients/homonymes` ne relisait que la première page triée (200
  candidats) avant d'appliquer l'égalité exacte : au-delà, un homonyme réel passait inaperçu.
  C'est un défaut réel d'exploitation — avec plus de 200 clients dont la raison sociale contient
  le texte tapé, l'alerte de doublon pouvait manquer un homonyme EXACT. Corrigé par une fonction
  dédiée qui applique l'égalité sur toute la population filtrée.
- **Point 42** — Le README des captures de 9EK-1 citait un commit inatteignable (`830dd761`) ;
  corrigé vers le commit réel (`b5d848b7`). Trois des quatre captures AVANT manquantes sont
  maintenant là ; la quatrième est un manque nommé (champs absents sur l'écran d'avant).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Point 29 : `totalFiltre,\n` apparaît exactement 2 fois dans `parc/page.tsx` (716 dans
  `CarteListe`, 857 dans `Pagination`) — confirmé par le test resserré.
- Point 41 : 201 clients décoys (contenant le texte cherché, triés avant l'homonyme par le
  collateur `fr` numérique) + 1 client exact → l'homonyme exact est rendu (3 cas isolation
  neufs, base réelle). Sans le correctif, il aurait été absent (seule la page 1 de 200 candidats
  triés était relue).
- Point 50 : deux exécutions consécutives de `9ekm-creations-2.spec.ts` et
  `captures-9ekm-creations-2.spec.ts` → 0 machine restante sous le `client_id` de la scène après
  chacune (vérifié par requête directe en base).
- `pnpm test` : 428 fichiers, 4543 tests, tous verts après le dernier commit.
- `pnpm test:isolation` : 171 fichiers, 1520 tests, tous verts.

## Ce que j'ai tranché et pourquoi

- **Point 45** — L'instruction demandait de restaurer `machine.nouvelle.sous_titre` à sa place
  d'origine MÊME SI elle reste inutilisée par l'écran (qui garde ses clés `_prefixe`/`_suffixe`
  composées par `sousTitreNouvelleMachine`) : exécuté à la lettre, la clé existe mais n'est lue
  par aucun écran — c'est délibéré (règle « aucune clé existante supprimée »), pas un oubli.
- **Point 46** — Pas de `disabled` sur `ActionPrimaire` (le composant n'en porte pas) : le
  double-envoi reste gardé par la `Ref` `enVol`, comme l'instruction le demandait explicitement.
- **Point 48** — Le `data-champ="famille"` a été déplacé du `<label>` vers le `<div>` englobant :
  le sélecteur `[data-champ="famille"] select` (lu par `tests/e2e/9ekm-creations-2.spec.ts` et
  `captures-9ekm-creations-2.spec.ts`) continue de désigner le même select, aucun de ces deux
  fichiers n'a eu besoin d'être touché.
- **Point 41** — Nouvelle fonction dédiée `clientsHomonymesExacts` plutôt qu'une modification de
  `rechercherClients` : cette dernière reste utilisée ailleurs (listes paginées) où la troncature
  à `limite` est le comportement voulu — seule la route d'homonymie a besoin de la population
  entière.
- **Point 42** — Le worktree jetable (`171a3cc8`) a révélé que le formulaire `/sites/nouveau`
  d'avant 9EK-1 n'a ni `adresse` ni `consignes_acces` : plutôt que de forcer une capture qui
  comparerait deux écrans différents en silence, le manque est nommé avec sa cause mesurée
  (`grep 'name="'` sur l'ancien fichier).
- **Captures du lot** — Une seule scène partagée (`tests/e2e/setup/scene-9ep.ts`, préfixe `9EP-`)
  pour les quatre écrans plutôt que quatre scènes séparées : aucun des quatre écrans ne modifie
  l'état d'un autre, le partage ne crée aucun couplage.

## Ce que je n'ai PAS fait

- **Point 38** — Aucune épreuve e2e à agence unique : la société de test (CODIMA-NC) porte
  plusieurs agences actives, et la consigne interdit de changer son état. La présélection CS41
  reste donc éprouvée uniquement en unitaire (`tests/unit/sites/champ-rattachement.test.tsx`).
  Les captures `sites-nouveau-{avant,apres}` sont donc identiques en apparence (aucune
  présélection dans les deux cas) — attendu, pas un oubli.
- **Point 49** — Aucune capture dédiée au refus serveur : les trois statuts refusés ne sont pas
  des options du formulaire de création (seuls en_service/en_panne/arretee le sont), le refus est
  une garde serveur inatteignable par un geste à l'écran. Couvert par un test unitaire de la
  route et un test de rendu, pas par une capture.
- Aucune décision `Dnnn` nouvelle écrite, comme demandé par le lot.
- Rien touché dans `interventions/[id]/**`, `interventions/presentation.ts`,
  `frise-etapes.tsx`, ni `docs/arbitrages.md` — territoire du lot jumeau 9EQ.
- Rien touché dans `app/(back-office)/tableau-de-bord/**`, `components/ui/kpi.tsx`,
  `components/ui/icone.tsx`, `components/ui/maitre-detail.tsx`, `components/ui/action-primaire.tsx`
  (lu, jamais modifié), le bon d'intervention, ni le bloc `tableau_de_bord.*` de `fr.ts`.

## Pièges pour la session suivante

- Le worktree jetable pour une capture AVANT a besoin d'un `node_modules` symlinké depuis le
  worktree principal (pas de `pnpm install` séparé) — fonctionne tant que `pnpm-lock.yaml` n'a
  pas changé entre les deux commits (vérifié par `git diff` avant de symlinker).
- `pnpm test:e2e` (et le `globalSetup` qu'il déclenche) DÉTRUIT et recrée la base `E2E_DATABASE_URL`/
  `TEST_DATABASE_URL` à CHAQUE exécution (« jetable veut dire jetée ») — comportement normal du
  harnais, partagé par toute session qui lance `pnpm test:e2e` sur ce poste en même temps.
- `screen.getByText(...)` avec une phrase composée contenant une espace insécable (` `,
  typographie française avant `:`) échoue en silence : son normalisateur réduit l'espace du nœud
  DOM mais pas celui du texte cherché. Comparer le `textContent` directement (voir
  `tests/unit/sites/champ-rattachement.test.tsx`, même piège déjà noté dans `lot-parc.test.ts`).
- `React.createElement` avec un composant dont les props exigent `children` (ex. `ActionPrimaire`)
  ne peut pas recevoir cet enfant en argument supplémentaire sans un réassouplissement de type
  local — et le passer en prop `children` est refusé par `eslint-plugin-react`
  (`react/no-children-prop`). Voir `tests/unit/ui/lot-parc.test.ts`, point 46.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce lot. Le lot jumeau 9EQ-CORRECTIFS-SOLDE (2/2) traite
  la fiche intervention, hors de ce territoire.
