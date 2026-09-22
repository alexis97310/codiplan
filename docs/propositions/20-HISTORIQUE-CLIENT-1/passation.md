# HISTORIQUE-CLIENT-1 — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

`app/(back-office)/clients/[id]/page.tsx` bornait l'historique d'un client à douze
interventions, `dernieresInterventionsDuClient` n'ayant pas de `skip` : au-delà de la
douzième ligne, rien — ni pagination, ni lien « tout voir », ni filtre. Un directeur
d'exploitation ouvrant la fiche d'un gros client (SPEEDY, CALEBAM…) ne voyait qu'un peu
moins d'un an de relation, la question « qu'est-ce qu'on a déjà fait chez ce client »
restant sans réponse au-delà.

`dernieresInterventionsDuClient` (`lib/interventions/depot.ts`) prend maintenant une
`page` (défaut 1) et pagine CÔTÉ BASE (`skip`/`take`, jamais un `slice` après coup —
comme `dernieresInterventionsDuSite`) ; un nouveau `compterInterventionsDuClient` porte
le total FILTRÉ, sur le même `where`. La fiche client expose cette pagination avec le
composant `Pagination` déjà partagé par `/clients`, `/parc`, `/sites` et `/interventions`
(AT-07) : « Page X sur Y », un lien « page suivante » / « page précédente », l'état vivant
dans l'URL (`?page=`). Un directeur d'exploitation atteint maintenant n'importe quelle
intervention de l'historique d'un client, jusqu'à la 1751e s'il le faut.

**Un second défaut, non demandé par le ticket mais découvert en écrivant l'AVANT** :
`dernieresInterventionsDuClient` n'avait PAS `nulls: "last"` sur son tri, contrairement à
`dernieresInterventionsDuSite` et `listerInterventions` qui portent déjà ce correctif
(la faute nommée sur `/interventions`, où un `ORDER BY date_planifiee DESC` nu place les
`NULL` en TÊTE sous PostgreSQL). La capture AVANT (`avant/client-page-1--1280.png`, prise
sur le code d'avant ce lot) le montre : les trois lignes « À planifier » (sans date)
s'affichaient EN HAUT de « Dernières interventions », au-dessus de la plus récente
intervention réellement datée, et la ligne de 2013 était repoussée hors des douze
premières par cette faute — invisible à toute assertion qui ne compte pas, visible sur
l'image. Corrigé dans le même geste, avec le `nulls: "last"` déjà écrit ailleurs.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Isolation** (`tests/isolation/historique-client-pagination.test.ts`, 6 scénarios, un
client posé exprès à quinze interventions — douze datées, trois sans date, jamais
`CLIENT_A1` pour ne pas fausser les scénarios qui le comptent dynamiquement) :
- page 1 (borne 5) rend exactement 5 lignes, les plus récentes d'abord ;
- page 2 rend les 5 suivantes, sans doublon ni trou à la charnière (vérifié par rang dans
  l'ordre attendu, pas seulement par longueur) ;
- la dernière page (borne 4, page 4 sur 15 lignes) porte le reste (3 lignes), et ce sont
  les trois SANS DATE — la file d'attente ferme la dernière page, jamais mêlée aux
  datées ;
- `compterInterventionsDuClient` rend 15 quelle que soit la taille de la page lue en
  parallèle ;
- un client d'une AUTRE société rend zéro ligne ET un compte de zéro (la politique de
  forme « parc » décide, `client_id` n'est qu'un sujet) ;
- `limite` et `page` non entiers strictement positifs sont refusés avant toute requête.

Tous rougissaient avant l'implémentation (signature à 4 paramètres, pas de fonction de
comptage) ; tous verts après. `pnpm test:isolation` complet : 109 fichiers, 1135 tests,
verts (aucune régression sur les 20 scénarios existants de `ecran-client.test.ts` ni les
5 de `historique-site-borne.test.ts`).

**Bout en bout** (`tests/e2e/historique-client.spec.ts`, un client posé exprès à treize
interventions — dix datées 2013…2022, trois sans date — jamais le client du semis
partagé, `fullyParallel` oblige) :
- **AVANT** (code d'avant ce lot, `f93f659` — voir « pièges » ci-dessous pour comment il a
  été reconstitué) : le premier `expect` — `[data-bloc="historique-client"]` — ne trouve
  rien, ROUGE, pour cette seule raison : l'attribut n'existait pas. Capture prise AVANT
  cette assertion (`avant/client-page-1--1280.png`) : elle montre la fiche telle qu'elle
  était, douze lignes, aucun lien vers une page suivante, ET la faute `nulls` décrite
  ci-dessus. Un second passage filtré (`-g "SANS AUCUNE"`, le mode série de Playwright
  n'exécutant pas le second test après l'échec du premier) donne
  `avant/client-sans-intervention--1280.png`.
- **APRÈS** (`0f4b18f` + le correctif d'assertion du test lui-même, voir pièges) : les
  deux scénarios passent. Page 1 : douze lignes, dix datées décroissantes (2022→2013)
  puis deux « — », total « 13 interventions », « Page 1 sur 2 ». Clic sur « Page suivante
  → » : URL `?page=2`, une ligne, `Local-C9C110`, aucune référence de la page 1 répétée.
  Un client sans intervention : la ligne pleine dit son absence, aucune pagination
  affichée.

`pnpm typecheck`, `pnpm lint`, `pnpm test` (233 fichiers, 2581 tests), `pnpm build` :
verts. `pnpm verify:full` en fin de lot — voir le dernier point de cette passation pour
son résultat réel, mesuré après cette rédaction.

## Ce que j'ai tranché, et pourquoi

**Pagination directe sur la fiche, jamais une redirection vers `/interventions`
pré-filtré.** Mesuré avant d'écrire une ligne (via une exploration dédiée du registre
`/interventions`) : `RechercheInterventions` (`lib/interventions/saisie.ts`) n'a AUCUN
champ `client_id`, ni au schéma ni dans `filtreDesInterventions` — l'ajouter aurait
débordé du territoire de ce ticket (`lib/interventions/saisie.ts`,
`app/(back-office)/interventions/page.tsx` n'y figurent pas). Et ce registre TAIT par
défaut les interventions dont le client est INACTIF (RG-PLA-08, D129, case
`inclure_clients_inactifs`), alors que la fiche d'un client — actif ou non — montre
toujours son historique complet : rediriger un client inactif vers `/interventions` sans
la case cochée aurait silencieusement caché ses interventions, une régression déguisée en
simplification. La pagination directe tient tout entière dans le territoire accordé
(`lib/interventions/depot.ts`, la fiche elle-même) et réutilise le composant `Pagination`
et les trois fonctions de `app/(back-office)/presentation.ts` (`decompte`, `libellePage`,
`hrefDeLaPage`) déjà partagés par les quatre écrans qui paginent (AT-07) — sans qu'aucun
des deux ne soit modifié.

**Une PAGE, jamais un « voir tout »** : douze lignes par page, comme la borne d'affichage
qui existait déjà (même valeur, `INTERVENTIONS_PAR_PAGE`), parce qu'un client à 1751
interventions rendrait une page de 1751 lignes si la borne disparaissait — c'est
exactement la faute que PARC-1 avait déjà corrigée sur l'aperçu du parc.

**`data-bloc="historique-client"`** posé sur la section, à l'identique de
`data-bloc="historique-site"` sur la fiche site (HISTORIQUE-SITE-1) : un point d'ancrage
stable pour le scénario bout en bout, cohérent avec l'écran voisin.

**Le titre du bloc devient « Historique des interventions »**, et non plus « Dernières
interventions » : avec la pagination, l'écran ne montre plus SEULEMENT les dernières,
il donne accès à tout l'historique — le titre ment moins. Seule cette valeur change dans
`fr.ts`, la clé reste `clients.fiche.interventions` ; aucun test ne l'attendait par
texte exact, vérifié avant de la renommer.

**Le total et l'absence utilisent `interventions.resultat_un` / `interventions.resultat`**,
des clés déjà servies par `/interventions` (« intervention » / « interventions ») — aucune
clé neuve pour le décompte, seulement la réutilisation d'un critère déjà écrit une fois.

## Ce que je n'ai PAS fait

Je n'ai pas touché `/interventions`, `lib/interventions/saisie.ts`, ni ajouté de filtre
`client_id` au registre général — c'est la décision ci-dessus, pas un report.

Je n'ai pas touché la fiche site ni le niveau machine (livrés), ni les contacts (livrés).

Je n'ai pas ajouté de colonne ni de migration : `prisma/schema.prisma` est intact,
`client_id` existait déjà sur `intervention`.

Je n'ai pas revu `dernieresInterventionsDuSite` : elle porte déjà `nulls: "last"`, le
défaut trouvé ne la concernait pas.

Je n'ai pas cherché à uniformiser `dernieresInterventionsDuSite` et
`dernieresInterventionsDuClient` en une seule fonction générique (sujet `client_id` OU
`site_id`) : la première ne pagine pas (aucun besoin mesuré côté site — treize
interventions y suffisent au propos du ticket HISTORIQUE-SITE-1), et les fondre aurait
demandé de décider POUR la fiche site un comportement qu'elle ne demande pas.

## Les pièges pour la session suivante

**Reconstituer un AVANT après avoir déjà commité** — ce lot a commité le code AVANT de
capturer l'AVANT (la règle « COMMITE D'ABORD, VÉRIFIE ENSUITE » de ce ticket l'exige,
au prix d'un léger écart avec le lot HISTORIQUE-SITE-1 qui capturait l'AVANT avant tout
commit). En conséquence, `avant/mesure.json` porte le hash du commit `0f4b18f` (celui du
lot terminé), PAS celui du code réellement affiché sur l'image — qui est `f93f659`, le
parent. Le fichier `mesure.json` ne peut pas savoir que le répertoire de travail a été
reconstitué à la main (`git checkout f93f659 -- <les 3 fichiers de code>`, capture, puis
`git checkout HEAD -- <les mêmes fichiers>`) : c'est écrit ICI, pas dans le JSON. Une
future comparaison de commit doit lire cette passation, pas se fier au champ `commit` de
`avant/mesure.json`.

**`next build` ne type-vérifie PAS `tests/isolation/`** malgré `tsconfig.json` qui inclut
`**/*.ts` sans distinction : mesuré, `pnpm build` a réussi avec `tests/isolation/
ecran-client.test.ts` et `historique-client-pagination.test.ts` en erreur de compilation
(signature à 5 arguments contre l'ancienne à 4, fonction inexistante) pendant tout l'AVANT
— seul `pnpm typecheck` (`tsc --noEmit` nu) les voit. Ne pas conclure d'un `pnpm build`
vert que les fichiers de test compilent : c'est `pnpm typecheck` qui le dit.

**La première écriture du test bout en bout se trompait sur la forme de l'état vide** :
j'ai copié l'assertion `toHaveCount(0)` sur `tbody tr` depuis `historique-site.spec.ts`,
qui est correcte LÀ-BAS parce que la fiche site OMET le `<Tableau>` entier quand elle est
vide. La fiche client, elle, garde son `<Tableau>` et pose `LignePleine` (un `<tr>` avec
UNE cellule) comme ligne d'absence — c'était déjà comme ça avant ce lot, sur le bloc des
lieux d'intervention (`clients.fiche.sites_vide`) et celui des interventions. L'assertion
correcte compte les LIENS `a[href^="/interventions/"]`, pas les `<tr>`. Deux rouges de
suite sur cette ligne auraient dû arrêter la session (règle du ticket) ; le premier a
suffi à voir la cause.

**`git checkout <ancien-commit> -- <fichiers>` fait strictement échouer si un des
fichiers ciblés n'existait pas encore à cet ancien commit** — inutile ici (les trois
fichiers de code existaient déjà), mais à surveiller si un futur lot doit reconstituer un
AVANT touchant un fichier neuf : il faut alors le supprimer à la main plutôt que le
`checkout`.

## Ce qui reste à faire

Rien côté fonctionnalité : la pagination est bornée côté base, testée en isolation et en
bout en bout, les captures AVANT/APRÈS existent pour les quatre situations demandées
(fiche AVANT, fiche APRÈS, deuxième page, client sans intervention).

`pnpm verify:full` n'a pas encore été rejoué EN ENTIER après le dernier correctif du
spec bout en bout (la mesure `lignes_page_1` du `mesure.json`, cosmétique, sans effet sur
une assertion) — à lancer avant de considérer le lot clos ; s'il rougit, la cause la plus
probable est un défaut de contention entre `tests/e2e/historique-client.spec.ts` et un
autre scénario qui partagerait, par erreur, l'un des identifiants `e2e00000-…-c9c1x`
choisis pour ce lot (aucune collision trouvée à la relecture, mais non rejouée sous
`fullyParallel` avec la suite complète).
