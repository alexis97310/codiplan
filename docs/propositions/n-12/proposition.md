# N-12 — Le parc sous D126, la barre d'outils à l'identique, et la carte Documents

Branche `claude/relaxed-fermat-qek71s`, depuis `origin/main` à `3548e81` (qui
vient de recevoir N-11, #231).

## À lire avant tout le reste

1. **`date_vente` reste vide sur tout le jeu de démonstration** (mesuré déjà
   par N-11, confirmé ici pour les huit machines du parc) : la sous-ligne du
   parc affiche donc le signe d'absence (`—`) pour l'année, jamais un zéro ni
   la mise en service à sa place. Visible sur `parc-apres.png` — toutes les
   lignes sauf le dernier segment portent `—`.
2. **Aucun déploiement de prévisualisation n'existe depuis #229** : les
   captures locales de ce dossier tiennent lieu de preuve visuelle.
3. **Une contradiction mesurée dans le message du ticket, et corrigée ici** :
   « La barre est partagée par `/parc`, `/clients`, `/sites` et
   `/interventions` » — faux. `grep BarreDeFiltres` ne trouve que deux
   appelants : `app/(back-office)/parc/page.tsx` et
   `app/(back-office)/clients/page.tsx`. `/sites` et `/interventions` portent
   chacun leur propre formulaire de recherche, écrit à la main, avec des
   classes différentes des trois. Le dépôt gagne, comme demandé : cette
   proposition ne touche que les deux écrans qui rendent réellement ce
   composant, et le dit ici plutôt que de le laisser deviner.

## 1. Le parc sous D126 — la ligne

**Proposition mesurée avant d'être appliquée**, comme demandé : titre =
`<marque> <référence du modèle>` (deux mots réels, jamais un seul) ; sous-ligne
= `<famille> · <n° de série ou —> · <année de vente ou —>`, trois segments,
jamais quatre. Capturée sur `parc-apres.png`, par exemple :

- « Atlas Copco GA-11 » / « Compresseurs d'air · AC-GA11-2018-1177 · — »
- « Tractel X-200 » / « Accessoires de levage · TRA-X200-0455 · — »
- « Ravaglioli KPX-337 » (fiche incomplète) / « Ponts élévateurs · — · — »

Les trois segments tiennent lisiblement sur une seule ligne pour les huit
machines du jeu de démonstration — aucun écart à la forme de la maquette
(`.machine-row` reste un `<h3>`, un `<p>`, une pastille) n'a été nécessaire.

Le **client quitte la ligne** et reste en tête du `dl.kv` de l'aperçu, où la
maquette le place déjà (`Client`, premier champ) — ce bloc n'est pas retouché,
et `tests/unit/machines/ecarts-maquette.test.ts` (six champs du `dl.kv`,
inchangé) le confirme toujours vert.

`CHAMPS_PARC` (`lib/machines/depot.ts`) gagne `modele.marque` (déjà présent
dans `CHAMPS_FICHE`, absent ici) et `date_vente` (jusqu'ici réservé à la
fiche) ; `CHAMPS_FICHE` hérite désormais des deux par le simple spread plutôt
que de les redemander — une seconde écriture de moins.

### La recherche suit

`filtreDuParc` cherchait sur le n° de série, le client, le lieu (site,
commune) et la référence du modèle — pas sur la marque ni la famille, deux
colonnes que la ligne montre désormais. Deux clauses `OR` de plus
(`modele.marque`, `modele.famille.libelle`), même forme que les autres.

## 2. La barre de filtres à l'identique de la maquette

Mesuré le 18/09/2026 : `components/ui/barre-de-filtres.tsx` rendait un champ
à largeur fixe (`min-w-64`), sans loupe, en 12,5 px, à rayon 6 px
(`rounded-md`) — quatre valeurs qui ne venaient d'aucune lecture de
`codiplan-maquette-complete.html`. La maquette pose, dans `parc()` et
`clients()` : `.toolbar > .search > input.field`, avec une loupe `⌕` en
`::before` (13 px, corps 20 px), `.search{flex:1;min-width:220px}`,
`.search .field{padding-left:38px}`, et `.field,.select{height:40px;
border-radius:9px;padding:0 12px}` — police héritée du corps (14px, comme
`app/globals.css` le pose déjà).

Corrigé : le champ grandit avec la barre (`flex-1 min-w-[220px]`), porte la
loupe (glyphe rendu par un `<span aria-hidden>`, jamais un `::before` — React
n'a pas de prise dessus), `pl-[38px]`, `h-[40px] rounded-[9px] pr-3`, et
aucune classe de taille de police (héritée). Les deux `<select>` compagnons
(filtre de statut sur `/parc`, filtre d'état sur `/clients`) reçoivent la
même hauteur et le même rayon, pour rester visuellement de la même famille
que le champ.

Le glyphe de la loupe passe par le dictionnaire (`recherche.loupe`, L0-11) :
décoratif, mais un caractère rendu à l'écran reste un texte pour le gardien
des chaînes visibles, qui ne sait pas distinguer un glyphe d'un mot.

**Avant/après visibles sur `parc-avant.png`/`parc-apres.png` et
`clients-avant.png`/`clients-apres.png`.**

## 3. La carte « Documents » de la fiche machine

Mesuré sur `fiche-avant.png` (recapturé ici, l'ancienne capture de N-11
montrait déjà le défaut) : son titre et son sous-titre flottaient directement
sur le fond gris, puis le tableau était encadré seul — pendant que
« Identité et rattachement » et « Historique des interventions » sont de
vraies cartes avec leur `card-head`. Corrigé : la carte passe par le même
composant `CarteEnTete` que ses deux voisines (`bloc="carte-documents"`),
qui gagne un prop `sousTitre` optionnel pour porter la phrase d'explication
sous le titre — les deux autres cartes n'en ont pas et ne changent pas.
Visible sur `fiche-apres.png`.

## 4. Les trois gardiens — le compte avant/après

Chaque défaut a été mis en échec **avant** d'être corrigé — le code de
correction a été mis de côté (`git stash`), le gardien rejoué, puis le code
restauré. Les trois comptes :

| Gardien | Population | Avant | Après |
|---|---|---|---|
| `tests/unit/ui/composants-maquette.test.ts`, describe « BarreDeFiltres — .search et .field,.select de la maquette (N-12) » | 5 tests | 0/5 | 5/5 |
| `tests/unit/machines/composition-fiche.test.ts`, describe « la carte « Documents », un AJOUT structuré comme ses deux voisines (N-12) » | 2 tests | 0/2 | 2/2 |
| `tests/e2e/parc.spec.ts`, les deux scénarios D126/recherche | 2 scénarios | 1er scénario rouge (titre à un seul mot), le second ne joue pas en mode `serial` | 2/2 |

**`tests/unit/machines/composition-parc.test.ts` (les treize blocs de N-10)
ne change PAS de population, et c'est un choix mesuré plutôt qu'un oubli.**
Sa méthode exige une preuve textuelle littérale dans `parc()` de la maquette
pour chaque bloc ; `machineRow()` y est écrite avec des champs génériques
(`m.name`, `m.id`, `m.client`) qui ne portent aucune trace de « marque »,
« famille » ou « année de vente » — D126 est une règle de GESTION (comme
D126 le dit elle-même pour la fiche), jamais une disposition que la maquette
dessinerait littéralement. Un bloc ajouté à cette liste sans preuve
possible dans le texte de la maquette aurait menti sur ce qu'il mesure —
la même faute que §9 (01/09) nomme. Le gardien du CONTENU de la ligne est
donc le scénario de bout en bout (ligne 1 du tableau ci-dessus), qui rend
une vraie page et lit le DOM, plutôt qu'un texte statique.

Les treize blocs de composition (structure DOM, inchangée) restent
13/13 verts, comme avant ce ticket — confirmé par `pnpm test`.

## 5. `pnpm verify:full` — vert

Harnais monté localement (PostgreSQL 16, migrations par le chemin de
production `prisma migrate deploy`, semis de démonstration) faute de base
hébergée accessible ici :

- `pnpm format:check` — vert (un fichier reformaté avant commit).
- `pnpm typecheck` — vert, zéro erreur.
- `pnpm lint` — vert, zéro avertissement.
- `pnpm test` — **199 fichiers, 2180 tests, tous verts.**
- `pnpm test:isolation` — **93 fichiers, 1030 tests, tous verts.**
- `pnpm build` — vert.
- `pnpm feries:horizon` — vert (2 territoires, horizon ≥ 12 mois).
- `pnpm audit:partitions` — vert (préventif et détectif).
- `pnpm test:e2e` — **50 scénarios, tous verts**, dont les deux nouveaux de
  `tests/e2e/parc.spec.ts` et les trois scénarios de `fiche-machine.spec.ts`
  (carte Documents comprise).

## 6. Captures — `docs/propositions/n-12/`

| Écran | Avant | Après |
|---|---|---|
| `/parc` (ligne D126, barre de filtres) | `parc-avant.png` | `parc-apres.png` |
| `/clients` (barre de filtres) | `clients-avant.png` | `clients-apres.png` |
| `/parc/[id]` (carte Documents) | `fiche-avant.png` | `fiche-apres.png` |

Toutes prises à 1280 px de large, session authentifiée (`adv@codima.test`),
aucune version téléphone construite — Alexis a tranché : on finit le web.
