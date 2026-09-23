# LISTES-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **`/sites` et `/clients` affichent désormais le nombre d'équipements
  enregistrés**, et masquent par défaut une fiche qui n'en porte aucun — la
  demande exacte d'Alexis (« si le site n'a pas d'équipement enregistré, il
  faut le filtrer et ne pas l'afficher »). Une case « Afficher aussi les
  lieux/clients sans équipement » lève le masquage ; son état vit dans l'URL
  (`?sans_equipement=1`), jamais dans un état de composant. *Pour
  l'exploitation* : les fiches de démonstration ou créées « pour mémoire »
  sans jamais avoir reçu de matériel n'encombrent plus la liste, et restent
  d'un clic.
- **`/sites` retrouve la recherche par le nom du CLIENT**, pas seulement par
  son propre libellé ou sa commune — le cas nommé par Alexis (« Atelier »,
  « Entrepôt »…, des libellés qui ne disent rien seuls).
- **Le trajet affiché sur `/sites` n'est plus la seule valeur saisie.**
  Quand elle manque, l'écran retombe sur l'estimation par zone
  (`lib/sites/trajet-zone.ts`, déjà écrite mais jamais branchée à cet
  écran) — et l'ÉTIQUETTE change (« Trajet estimé (min) ») pour qu'une
  estimation ne se lise jamais comme une mesure.
- **`/parc` gagne trois filtres combinables** — client, site, famille, aux
  côtés du statut déjà câblé — chacun dans l'URL, avec des options bornées à
  ce qui a AU MOINS une machine (jamais le référentiel entier : un filtre
  qui proposerait un client sans aucun exemplaire rendrait zéro résultat de
  façon certaine).
- **Le classement de `/sites`, `/clients` et des menus déroulants est
  désormais alphanumérique, insensible à la casse et aux accents**, calculé
  en JavaScript (`lib/tri/collation.ts`, `Intl.Collator`) plutôt que délégué
  à `ORDER BY` — voir « ce que j'ai tranché et pourquoi » pour la mesure qui
  justifie ce choix. La liste déroulante des lieux de
  `/interventions/nouvelle` est triée et groupée par client.
- **La famille du matériel figure déjà dans l'en-tête de la fiche machine**
  (`Badge` bleu à côté du statut, `machine.modele.famille.libelle`) — mesuré
  AVANT ce lot, `D126`/N-12 l'y avait déjà posée. Le constat de la demande
  décrivait apparemment une version antérieure à ce qui est déployé
  aujourd'hui sur `main` ; aucune ligne n'a été touchée ici pour ce point.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **La collation de la base.** `psql` contre `codiplan_test` (`en_US.utf8`) :
  elle ordonne déjà « Anse Vata » avant « AVIS SLAP LOCATOIN » — la panne
  décrite en production (majuscules d'abord) n'est donc PAS reproduite ici,
  et j'en déduis que la base hébergée tourne sous une collation différente
  (`C`, probablement — non vérifié, je n'ai pas d'accès à cette base). C'est
  la mesure qui a tranché en faveur d'un tri en JavaScript plutôt que d'un
  `COLLATE` en base : `fr-FR-x-icu` existe bien dans `pg_collation` de la
  base locale sans qu'aucune migration ne l'ait posée, mais s'y fier
  supposerait que la base hébergée porte la même extension ICU, ce que je
  n'ai aucun moyen de vérifier à distance — et `CLAUDE.md §2` interdit de
  toute façon le SQL brut hors migration pour l'écrire dans une clause
  `ORDER BY`.
- **Captures AVANT/APRÈS**, dans ce dossier — `/sites`, `/clients`, `/parc`
  (filtre client actif), une fiche machine, à 1280 et 390 px — prises par un
  spec e2e temporaire (non conservé) : AVANT sur `65138af` (état de `main`
  avant ce lot), APRÈS sur le dernier commit de ce lot. La capture
  `sites-1280-apres.png` montre très concrètement l'effet du masquage :
  AVANT, 4 sites dont « Ancien chantier (démonstration, inactif) » sans
  équipement ; APRÈS, 3 — celui-ci a disparu par défaut, et le trajet du
  « Dépôt de brousse » porte désormais l'étiquette « Trajet estimé (min) »
  au lieu d'un nombre nu.
- **`pnpm verify:full` presque intégralement vert** sur le dernier commit :
  `format:check`, `typecheck`, `lint`, 2664 tests unitaires (247 fichiers),
  1175 tests d'isolation (114 fichiers), `build` (compilé), `feries:horizon`
  (vert), `audit:partitions` (13 partitions, 0 ligne dans la partition par
  défaut), et 176 scénarios de bout en bout PASSÉS sur 180 (3 sautés, 1
  rouge — voir « le conflit non résolu » ci-dessous, non lié à ce lot).
- **Un vrai défaut trouvé par l'épreuve de bout en bout ajoutée**, avant
  tout commit qui l'aurait figé : choisir un filtre (client/site/famille)
  sur `/parc` rendait ZÉRO machine, même pour un client qui en a. Les
  `<select>` soumettent leur option « Tous les … » comme une chaîne VIDE, et
  `z.uuid()` la refusait — `safeParse` échouait en silence dès le premier
  filtre posé. Corrigé dans `app/(back-office)/parc/page.tsx` : une chaîne
  vide vaut désormais absence, comme pour tout autre paramètre optionnel de
  ce dépôt.

## Ce que j'ai tranché et pourquoi

1. **L'ordre du parc n'est PAS devenu alphanumérique, et c'est une décision
   à confirmer.** L'arbitrage écrit en tête du ticket range « parc » parmi
   les listes de référentiel à trier alphanumériquement — mais le tri actuel
   de `rechercherLeParc` (`complet` puis `numero` puis `numero_serie`) est un
   choix DÉLIBÉRÉ et documenté ailleurs (R2-21 : « les fiches incomplètes
   d'abord, ce sont celles qui demandent un geste »), qui n'a rien à voir
   avec une NOMINATION alphabétique — le parc est une liste d'action, pas un
   répertoire de noms. Rien dans la demande d'Alexis ne mentionne l'ordre du
   parc (ses seules remarques sur `/parc` portent sur les filtres et la
   famille manquante). J'ai donc laissé cet ordre intact et appliqué le tri
   alphanumérique uniquement aux TROIS listes déroulantes de filtre
   (client/site/famille) qu'il alimente. **C'est une lecture, pas un fait
   vérifié auprès d'Alexis** — si le tri du parc lui-même doit changer,
   c'est un second lot, avec la question du sort de R2-21 tranchée
   explicitement.
2. **Le compte d'équipements est TOTAL, pas seulement « actif ».** `machine`
   n'a pas de colonne `actif` (seulement un `statut` à six valeurs, dont
   trois terminales — remplacée, ferraillée, fusionnée). « Aucun équipement
   enregistré » se lit littéralement : zéro ligne dans `machine`, quel que
   soit son statut. Une machine ferraillée compte donc encore dans ce total
   — c'est cohérent avec le filtre, qui porte sur `machines: { some: {} } }`
   sans condition de statut.
3. **Les options des filtres du parc (client/site/famille) sont bornées à ce
   qui a au moins une machine**, jamais le référentiel entier (619 clients,
   200+ sites) : un filtre qui proposerait un client sans exemplaire rendrait
   zéro résultat de façon certaine, ce qui n'aide personne. Ce choix diffère
   de celui des sélecteurs de `/parc/nouvelle` et `/sites/nouveau`, qui EUX
   doivent montrer le référentiel entier (on y crée potentiellement le
   PREMIER exemplaire d'un client) — d'où le nouveau champ
   `inclure_sans_equipement`, dont le défaut (`true`, aucun filtre) protège
   ces deux écrans sans qu'ils aient eu besoin d'un geste explicite.
4. **La liste déroulante des sites de `/interventions/nouvelle` est triée et
   groupée par le TRI seul, jamais par `<optgroup>`** — le ticket l'autorise
   explicitement (« sinon tri seul »), et aucun composant de recherche
   filtrante n'existe dans ce dépôt (mesuré : aucune trace de combobox,
   `cmdk`, `datalist` dans `components/` ni `lib/`). Le libellé
   « CLIENT — site » porte déjà le nom du client, ce qui rend le
   regroupement lisible même sans `<optgroup>` puisque les sites d'un même
   client se retrouvent maintenant CONSÉCUTIFS.
5. **La pagination de `/sites` et `/clients` reste CORRECTE malgré le tri en
   JavaScript.** `rechercherSites`/`rechercherClients` font désormais DEUX
   requêtes : une lecture étroite (`id` + libellé seul) sur TOUTE la
   recherche filtrée pour fixer l'ordre, puis une seconde bornée aux
   identifiants de la seule page demandée. C'est plus coûteux qu'un simple
   `ORDER BY` + `skip`/`take`, mais proportionné : quelques centaines de
   lignes `id`+`libellé` par requête, jamais le référentiel avec toutes ses
   colonnes.

## Ce que je n'ai PAS fait

- **Je n'ai pas mesuré la collation réelle de la base de production** — je
  n'y ai aucun accès. La solution retenue (tri en JavaScript) est robuste
  quelle que soit cette collation, ce qui rend la question moins urgente,
  mais la note reste : « la base trie les majuscules d'abord » est une
  hypothèse plausible, pas un fait établi à distance.
- **Je n'ai pas ajouté de composant de recherche filtrante (combobox)** pour
  la liste déroulante des sites de `/interventions/nouvelle` — aucun
  n'existe dans ce dépôt, et en écrire un pour ce seul écran aurait dépassé
  le territoire de ce ticket (un `utilitaire de tri NEUF`, pas un composant
  d'interaction neuf).
- **Je n'ai pas revu l'ordre du PARC lui-même** (voir point 1 ci-dessus) —
  seulement ses filtres.
- **Je n'ai pas corrigé un défaut latent semblable, hors périmètre.**
  `schemaRechercheSite.client_id` (`lib/sites/saisie.ts`) souffre du même
  bug que celui trouvé sur `/parc` (`typeof params.client === "string"`
  laisserait passer une chaîne vide) — mais AUCUN `<select name="client">`
  n'existe sur `/sites` aujourd'hui, donc ce chemin n'est jamais emprunté
  par un navigateur réel. Je ne l'ai pas retouché pour ne pas élargir le
  territoire du ticket sur un code mort ; si un futur lot câble un filtre
  client sur `/sites`, ce point mérite d'être revérifié en premier.

## Les pièges pour la session suivante

- **Le masquage par défaut casse tout scénario qui vérifie qu'une fiche
  FRAÎCHEMENT créée (sans machine) apparaît dans `/sites` ou `/clients`.**
  `tests/e2e/imports.spec.ts` en portait un ; il est corrigé
  (`?sans_equipement=1`). Un futur ticket qui ajoute un autre chemin de
  création (portail, recensement…) et vérifie la fiche depuis la liste
  devra faire pareil.
- **`Intl.Collator` avec `numeric: true` traite les SÉPARATEURS comme des
  caractères ordinaires** — deux clés concaténées avec un séparateur pour
  servir de départage (`libelle + "\u0000" + id`, tenté puis abandonné au
  profit d'un comparateur à deux étages explicite dans
  `app/(back-office)/interventions/nouvelle/page.tsx`) peuvent donner des
  résultats surprenants si le séparateur est un chiffre ou touche à un run
  numérique. Préférer toujours un comparateur à DEUX clés distinctes plutôt
  qu'une concaténation, comme le fait déjà
  `trierAlphanumeriquement(items, cle, departager)`.
- **`z.uuid().nullable().default(null)` refuse une chaîne VIDE**, pas
  seulement `undefined` — tout `<select>` dont l'option « Tous » porte
  `value=""` doit être lu côté page avec un test de LONGUEUR
  (`params.x.length > 0`), jamais un simple `typeof === "string"`. C'est le
  défaut que l'épreuve de bout en bout a trouvé sur `/parc` ; il est corrigé
  là, mais le même risque existe partout où un futur filtre ajoute un
  `<select>` sur un champ `z.uuid()`.
- `pnpm test:e2e` complet, en parallèle, fait parfois rougir
  `planning-largeur-et-carte.spec.ts` (« dans la grille (lg+)… ») sur une
  carte qui affiche `1 h 30` au lieu de `1 h 00` attendu — confirmé SANS
  rapport avec ce lot (isolé deux fois de suite, vert à chaque fois ; hors
  territoire — `lib/calendar/**` est explicitement interdit à ce ticket).
  Vraisemblablement une scène partagée mutée par un autre spec qui glisse
  ou redimensionne une intervention en parallèle (voir la mémoire
  `e2e-semis-partage-parallele`).

## Ce qui reste à faire

- **Confirmer ou infirmer la décision du point 1** (« ce que j'ai tranché »)
  auprès d'Alexis : le classement du PARC lui-même (aujourd'hui « incomplet
  d'abord ») doit-il devenir alphanumérique, au prix de perdre la mise en
  avant des fiches à compléter (R2-21) — ou les deux doivent-ils coexister
  (un second critère de tri, ou un bouton pour basculer) ?
- **Mesurer la collation de la base hébergée** le jour où quelqu'un y a
  accès — `SELECT datcollate FROM pg_database WHERE datname = current_database();`
  — pour confirmer l'hypothèse « collation `C` » plutôt que la supposer.
- **`planning-largeur-et-carte.spec.ts`** — la flakiness en exécution
  parallèle mérite un ticket dédié (hors territoire de celui-ci).
