# 9DU-TP-NAV3-RECHERCHE-RAIL — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**Un bandeau neuf au bureau**, `components/navigation/bandeau-bureau.tsx`, rendu dès 901 px dans `app/(back-office)/layout.tsx` — le symétrique de `BandeauMobile` (masqué sous 901 px), jamais le même composant. Il porte :

- **La recherche globale** (QE-3) — `Ctrl K`/`Cmd K` partout, `/` hors d'un champ de saisie, un dialogue (`components/navigation/recherche-globale.tsx`) qui interroge `GET /api/recherche?q=` (`app/api/recherche/route.ts`, neuve). Quatre groupes — clients, sites, machines, interventions —, 5 résultats chacun, le périmètre du technicien (9DG) appliqué à chacun, la recherche sans accent de CS2 réutilisée pour les machines (seul groupe qui n'avait encore aucune recherche serveur). Toute la logique vit dans `lib/navigation/recherche-globale.ts`. Aucun montant.
- **Le menu « Créer »** (QE-3) — `components/navigation/menu-creer.tsx` — ne propose que les créations permises par les capacités de la session (intervention, absence, machine, client, site), jamais une capacité recopiée pour ce seul menu.
- **Aucun bouton d'aide** : aucun texte n'a été décidé pour lui (D171 le dit explicitement) — ce point reste entièrement ouvert.

**La colonne se replie en rail** (QE-4) — `components/navigation/barre.tsx` : 76 px entre 900 et 1199 px par défaut (icônes seules, infobulle `title`, nom accessible intact via `sr-only`), déployée par défaut au-delà de 1199 px (coque-375 continue de mesurer 272 px à 1280 px, inchangé). Un bouton « Réduire le menu »/« Déplier le menu » (icône `sidebar`) existe à toute largeur de bureau (≥ 901 px) et bascule une préférence explicite gardée dans `localStorage` (`codiplan.colonne.repliee`), protégée par `try/catch` — une préférence illisible ou non écrite rend simplement la colonne sans mémoire, jamais une page qui refuse de se rendre.

**Deux décomptes au menu** (QE-5) — `lib/navigation/decomptes.ts`, lu par `lib/navigation/chrome.ts` (`chromeDeLaRequete`, champ `decomptes`, jamais lève). « Demandes » et « Interventions » portent chacune une pastille dont le total réutilise EXACTEMENT la fonction qui alimente déjà l'écran correspondant (`demandesOuvertes` pour l'onglet « À traiter » ; `compterParVue(...).a_planifier` pour le registre) — jamais un troisième calcul. Rouge si une P1 attend dans cette liste, gris sinon. **Aucun décompte VGP** : MO-3 (la liste des réserves) n'existe pas encore.

**QT-24** — `/terrain` ouvert par un rôle à accès complet affiche désormais « Réservé aux techniciens » (texte, lien de retour) au lieu d'un renvoi silencieux vers `/planning`. Ce changement était déjà commité par la première session (partie D, avant le plantage) ; je l'ai repris tel quel depuis `9DU-reste-plantage-1006` et re-vérifié sur `main`.

**ADDENDUM 1 (G1)** — `estUuid` (`lib/identifiant.ts`) posée devant les quatre routes restantes qui lisaient encore la base avec un identifiant d'adresse non vérifié : `/interventions/[id]/bon`, `/parc/[id]/modifier`, `/parametres/agences/calendrier/[id]` et `/terrain/[id]` (page et `generateMetadata`). Les trois premières rejoignent la boucle `ROUTES_AVEC_GARDE_IDENTIFIANT` de `tests/e2e/tous-les-ecrans-rendent.spec.ts` ; `/terrain/[id]` a son propre scénario, avec le compte TECHNICIEN de la scène — le compte admin de la boucle est redirigé vers `/planning` avant même la lecture de l'identifiant, et ne pourrait jamais atteindre la garde.

**ADDENDUM 2 (I1, I2)** — `tests/e2e/indicateurs-donnees.spec.ts` cherchait le client « sans code externe » de l'épreuve sans filtre de texte, dépendant de son rang parmi TOUS les clients sans code de la société (fragile sous `fullyParallel`) : un filtre propre à l'épreuve (sa raison sociale) le rend indépendant, sans changer l'attente sur l'URL du lien du KPI. `bornesDuMois` comparait `date_planifiee` (`@db.Date`) à de vrais instants locaux — faux d'un jour pour un fuseau EN RETARD sur UTC, où le 1er du mois à minuit local tombe après minuit UTC du même jour et exclurait son propre premier jour ; Pacific/Noumea (en avance sur UTC) n'était jamais touché, ce qui donnait l'illusion que la borne était juste, et un commentaire affirmait même l'inverse. `bornesCalendairesDuMois` (`lib/calendar/fuseau.ts`) compare désormais le jour calendaire pour `date_planifiee` ; `cree_le`/`cloturee_le` restent sur les vrais instants, inchangés.

**D171** (`docs/arbitrages.md`) consigne cette décision.

Pour l'exploitation : un utilisateur du bureau peut désormais atteindre n'importe quelle fiche (client, site, machine, intervention) en deux touches sans passer par le menu, créer les entités courantes depuis n'importe quel écran, voir d'un coup d'œil si des demandes ou des interventions à planifier attendent (et si l'une d'elles est urgente), et réduire la colonne de navigation sur un écran d'ordinateur portable pour gagner de la place. Un rôle de bureau qui ouvre `/terrain` par curiosité comprend enfin pourquoi il y est refusé.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- Bandeau du bureau : **absent → présent dès 901 px**, avec recherche et « Créer » (capture `bandeau-bureau-avant/apres-1280.png`).
- Colonne à 1000 px : **272 px fixes → 76 px (rail) par défaut**, bouton de bascule présent, préférence conservée après rechargement (capture `rail-avant/apres-1000.png`, épreuve e2e `tests/e2e/9du-recherche-rail.spec.ts`).
- Colonne à 1280 px, sans préférence posée : **272 px, inchangé** (cohérent avec `tests/e2e/coque-375.spec.ts`, non modifié).
- Décomptes du menu : **aucun → deux**, chacun testé par mapping pur (`tests/unit/navigation/decomptes.test.ts`, 6 scénarios : total = longueur/`a_planifier`, urgent = présence d'une P1, `null` sans contexte, `null` si une lecture échoue) — voir « ce que je n'ai pas fait » pour ce que ce choix de test NE couvre PAS.
- `pnpm test` **4119/4119** verts (dont les 6 scénarios de `decomptes.test.ts` et les 5 nouveaux de `bornesCalendairesDuMois`, addendum 2), `pnpm test:isolation` **1468/1468** verts, `pnpm typecheck`/`pnpm lint`/`pnpm format:check`/`pnpm build` verts, `CI=1 pnpm verify` **vert de bout en bout** (code de sortie 0, rejoué après les deux addenda).
- Addendum 1 : les 53 scénarios (3 ignorés pour une raison préexistante) de `tests/e2e/tous-les-ecrans-rendent.spec.ts` verts, dont les 4 routes neuves et `/terrain/[id]` (compte technicien).
- Addendum 2 : les 7 scénarios de `tests/e2e/indicateurs-donnees.spec.ts` verts, dont celui qui exerce directement `bornesCalendairesDuMois` (la tuile « Expertise » planifiée).
- e2e ciblés rejoués verts : `tests/e2e/coque-375.spec.ts` (16 scénarios dont le mien), `tests/e2e/navigation-app-technicien.spec.ts` (QT-24), `tests/e2e/9dr-fil-d-ariane.spec.ts` (non touché par ce lot, rejoué par prudence car il partage `components/navigation/barre.tsx`), et le nouveau `tests/e2e/9du-recherche-rail.spec.ts` (4 scénarios) — tous verts. `pnpm test:e2e` complet NON rejoué en entier (voir ci-dessous).
- Captures AVANT/APRÈS : six paires, voir `docs/propositions/9DU-TP-NAV3-RECHERCHE-RAIL/captures/` (bandeau à 1280 et 375 px, dialogue de recherche avec résultats, rail à 1000 px avec décomptes rouges visibles, menu déployé avec décomptes, « Réservé aux techniciens »). Prises par `tests/e2e/captures-9du-nav3.spec.ts`, joué une fois sur le commit d'avant ce lot (`git worktree`, recette du poste) et une fois après.

## Ce que j'ai tranché et pourquoi

- **La préférence de rail (`localStorage`) s'applique à TOUTE largeur de bureau (≥ 901 px), pas seulement dans la bande 900–1199 px.** « Gardée sur l'appareil » (QE-4) n'a de sens que si elle survit au changement de fenêtre — sinon le bouton ne ferait que remettre la valeur par défaut à chaque redimensionnement.
- **Le pied de colonne (charte de société, déconnexion, avatar) n'est pas adapté visuellement au rail** : à 76 px, il garde sa forme déployée (débordement visible sur la capture `rail-apres-1000.png`) plutôt qu'une réécriture non mesurée par un choix du pilote. Écrit explicitement dans D171 plutôt que laissé en silence.
- **L'alerte P1 des interventions regarde la première page seulement** (`listerInterventions`, 50 lignes), pas la totalité de `a_planifier` : `compterParVue` ne détaille pas par priorité, et ajouter cette requête aurait exigé de toucher `lib/interventions/depot.ts`, hors territoire de ce lot. Documenté dans `lib/navigation/decomptes.ts`. Le TOTAL affiché, lui, reste exact (c'est `compterParVue(...).a_planifier`, un vrai `groupBy`).
- **Le décompte est testé par mapping pur (mocks), pas par une épreuve d'isolation bout en bout** : `urgent` agrège toutes les demandes/interventions ouvertes d'une société partagée entre fichiers de test (`fullyParallel`) — une épreuve réelle n'aurait pas pu prouver l'absence de P1 avant son propre geste ni l'exclusivité de sa cause après (le piège nommé par le ticket). La fonction testée ne fait elle-même aucune requête, donc rien n'est perdu à la simuler.
- **Le menu « Créer » est cherché par `href` dans l'épreuve e2e, jamais par le nom accessible** : l'aide de l'option « Machine » (« Dans le parc d'un client ») contient le mot « client », qui aurait confondu une recherche par nom avec l'option « Client ».

## Ce que je n'ai PAS fait

- **Aucun bouton d'aide** dans le bandeau — QE-3(a) le mentionne, mais aucun texte n'a été décidé pour lui ; D171 l'écrit noir sur blanc plutôt que d'improviser un contenu.
- **Aucun décompte VGP** (le troisième candidat de QE-5) — MO-3 (la liste des réserves) n'existe pas ; inventer une liste pour pouvoir la compter aurait été une règle non spécifiée (§8).
- **`pnpm test:e2e` n'a pas été rejoué dans son intégralité** — seuls les fichiers de navigation directement concernés ou partageant `components/navigation/barre.tsx` l'ont été (liste ci-dessus). Le reste de la suite e2e (plusieurs dizaines de fichiers) n'a pas été rejoué faute de temps dans cette session ; `11-FILE.sh` la rejouera via `verify:full` avant publication.
- **Le pied de colonne en rail** (voir « ce que j'ai tranché »).
- **Aucune adaptation du bandeau pour le téléphone** — hors territoire du ticket (QE-3/QE-4/QE-5 visent le bureau ; `BandeauMobile`, inchangé, continue de porter le tiroir et le titre).

## Les pièges pour la session suivante

- **Le menu-creer.tsx et le recherche-globale.tsx hérités de la première session (avant le plantage) contenaient deux défauts mineurs que j'ai corrigés dans cette session** : une graisse `font-semibold` (600) sous le plancher de 12 px/700 de D143 (corrigée en `font-bold`), et une tentative de `title` concaténant deux clés i18n sur `Marque` qui aurait fait rougir `sans-chaine-visible-en-dur.test.ts` (retirée, pas de tooltip sur le logo). Si une prochaine session reprend du code d'une session plantée, relire CES DEUX gardiens en particulier avant de committer.
- **`decomptesDuMenu` est appelée à CHAQUE rendu du layout du bureau** (donc sur chaque page) — deux requêtes supplémentaires par navigation (`demandesOuvertes` + `compterParVue` + `listerInterventions`). Acceptable à l'échelle de CODIPLAN (mesuré dans `lib/navigation/chrome.ts`, même contrat « ne lève jamais » que le thème), mais à surveiller si une session future constate une lenteur du bureau.
- **`getByRole(..., { name })` de Playwright fait une correspondance par SOUS-CHAÎNE par défaut** — deux pièges rencontrés et corrigés dans ce lot : le nom d'un client est aussi le DÉBUT du libellé du site qu'il porte dans les résultats de recherche (`exact: true` nécessaire), et le mot « client » apparaît dans l'aide de l'option « Machine » du menu « Créer » (chercher par `href` plutôt que par nom dans ce cas précis).
- **Les fixtures i18n de ce lot** (`9du.e2e.client`, `9du.e2e.site`) suivent la convention déjà posée par `9dr.e2e.*` — toute épreuve qui crée sa propre scène visible à l'écran doit lire son libellé dans `lib/i18n/fr.ts`, jamais l'écrire en dur dans le fichier de test (le gardien `sans-chaine-visible-en-dur` s'applique aussi aux specs e2e qui interrogent l'écran).

## Ce qui reste à faire

- Le bouton d'aide du bandeau (texte à décider par Alexis).
- Le décompte VGP, une fois MO-3 posé.
- L'adaptation visuelle du pied de colonne au rail (76 px).
- Rejouer `pnpm test:e2e` en entier avant la prochaine publication si un doute subsiste sur une interaction avec un autre lot touchant `components/navigation/barre.tsx` ou `app/(back-office)/layout.tsx`.
- D171 reste à valider par Alexis, comme les décisions D165 à D170 qui la précèdent.

## Reprise 9DUA

**Cause du rouge trouvée en une phrase** : `tests/e2e/planning-survol-cases.spec.ts` a sa PROPRE copie de la géométrie de survol (`survolerSansDeposer`, distincte de `setup/glisser.ts`) et ne savait rien du bandeau fixe de 64 px que ce lot ajoute au bureau — le point visé tombait sous le bandeau, la souris survolait le bandeau plutôt que la case, et `data-survol` restait vide.

### Ce que j'ai changé, et ce que ça change pour l'exploitation

- Récupéré le reste non commité de la 1re session (branche `voie1-reste-1006-2139`, commit `7a8d7f7a`, lui-même construit sur `9DU-TP-NAV3-RECHERCHE-RAIL-garde` + un commit en plus) : 24 fichiers de test (`tests/e2e/*.spec.ts` + `tests/e2e/setup/glisser.ts`) qui scopent `getByRole("button", { name: "Créer" })` sur `#contenu`, là où le nouveau menu « Créer » du `BandeauBureau` rendait l'ancienne requête ambiguë (deux boutons nommés « Créer »), et un ajustement de viewport dans `parc-tri.spec.ts` (+64 px) pour que le constat « 480 px visibles » continue de mesurer la liste, pas le bandeau. **Les captures PNG étrangères au lot** que ce même commit avait aussi accumulées (47-AVERTISSEMENTS-1, 50-INTERVENTIONS-2, 55/56-FORMULAIRES, 9BV-TP-A5b-DATES-REPRISE, 9DF-TP-CY2-MATRICE-D8) ont été écartées : ce sont des régénérations incidentes de `verify:full`, pas du travail du lot 9DU.
- Corrigé `tests/e2e/planning-survol-cases.spec.ts`, rougi par `verify:full` (ci-dessous) : exporté `pointVisible`/`hauteurChromeFixe` de `setup/glisser.ts` et réutilisés dans `survolerSansDeposer` pour viser la partie visible SOUS le bandeau, au lieu du centre brut de la boîte.
- Pour l'exploitation : rien de neuf côté écran — uniquement le filet de tests qui suit désormais le bandeau du bureau plutôt que de le découvrir en rouge.

### Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm typecheck` / `pnpm lint` / `pnpm format:check` : verts après chaque étape de cette reprise.
- Le spec corrigé seul, 3 répétitions sans retry (`--repeat-each=3 --retries=0 --workers=1`) : **3/3 vertes** (2,1 s chacune), contre 2 échecs identiques (run + retry 1) avant la correction.
- `CI=1 pnpm verify:full`, rejoué en entier une 2e fois après la correction (1er passage, avant correction : rouge sur `planning-survol-cases.spec.ts` seul, le reste vert) : **tout vert** — `pnpm test` 4119/4119, `pnpm test:isolation` 1468/1468, `build` réussi, `feries:horizon` et `audit:partitions` verts, `test:e2e` **993 passés, 7 ignorés (préexistant), 0 échec** (39,4 min). Rejoué à 2026-10-06 23:44 heure de Nouméa (12:44 UTC).
- Les deux passages de `verify:full` ont chacun régénéré ~135-147 captures PNG/PDF étrangères au lot (d'autres tickets, `test:e2e` rejoue leurs specs de capture) : écartées (`git checkout --`/suppression) à chaque fois, jamais commitées.

### Ce que j'ai tranché et pourquoi

- **Export minimal plutôt que duplication** : `pointVisible` et `hauteurChromeFixe` existaient déjà dans `setup/glisser.ts` (posés par la 1re session pour `glisser()` lui-même) ; les exporter et les réutiliser dans `planning-survol-cases.spec.ts` évite une seconde copie de la même géométrie qu'un futur bandeau referait diverger.
- **Pas de reprise de la fonction `agrandirPourContenirLesDeux`** (élargissement de fenêtre) dans `survolerSansDeposer` : le clamp `pointVisible` seul a suffi à faire passer les 3 répétitions ; ajouter l'élargissement sans rouge à corriger aurait été une extension non demandée.
- **Toutes les captures PNG régénérées par les deux passages de `verify:full` écartées**, y compris les 5 propres au lot 9DU (`bandeau-bureau-apres-*`, `menu-decomptes-apres-1280`, `rail-apres-1000`, `recherche-dialogue-apres-1280`) : aucun écran n'a changé dans cette reprise (seule la géométrie d'une épreuve a bougé), donc les captures déjà commitées par la session précédente restent les bonnes (règle du ticket : regénérer l'APRÈS seulement si l'écran a bougé).

### Ce que je n'ai PAS fait

- Rien d'autre du lot 9DU n'était à faire : la relecture du ticket (sections REPRISE, ADDENDA G1, I1/I2) contre la passation déjà commitée par la garde montre les parties A à E, QT-24, D171 et les deux addenda tous faits et mesurés par la session précédente (voir tableau ci-dessous) — le seul travail restant était le reste non commité et le rouge de `verify:full`.
- Je n'ai pas cherché le fichier `tickets/recales/9DU-TP-NAV3-RECHERCHE-RAIL.md` au-delà de la recherche initiale : ce chemin n'existe pas dans ce dépôt (aucun répertoire `tickets/` ici) ; la relecture s'est donc appuyée sur les messages de commit de la garde et sur ce fichier de passation lui-même, qui couvre déjà chaque partie en détail.

### Tableau des parties (relecture du ticket 9DU)

| Partie | Fait par la garde (avant ce rouge) |
|---|---|
| A — recherche globale (QE-3) | Fait — `components/navigation/recherche-globale.tsx`, `app/api/recherche/route.ts`, `lib/navigation/recherche-globale.ts` |
| B — menu « Créer » (QE-3) | Fait — `components/navigation/menu-creer.tsx` |
| C — rail et décomptes du menu (QE-4, QE-5) | Fait — `components/navigation/barre.tsx`, `lib/navigation/decomptes.ts` |
| D — QT-24 (`/terrain` refusé par un message nommé) | Fait, repris tel quel depuis `9DU-reste-plantage-1006` |
| E — décision D171 (bandeau/rail/décomptes/QT-24) | Fait — `docs/arbitrages.md` |
| Addendum 1 (G1) — garde d'identifiant sur 4 routes restantes | Fait |
| Addendum 2 (I1, I2) — scène indépendante du rang, bornes calendaires de `date_planifiee` | Fait |
| Captures AVANT/APRÈS, passation | Fait |
| Reste non commité (fixes `#contenu`, viewport `parc-tri`, `glisser.ts`) | Fait par la garde, **récupéré par cette reprise** (sans les captures étrangères) |
| Rouge de `verify:full` (`planning-survol-cases.spec.ts`) | **Corrigé par cette reprise** |

### Les pièges pour la session suivante

- `tests/e2e/planning-survol-cases.spec.ts` et `tests/e2e/setup/glisser.ts` ne partagent PAS une seule géométrie de survol/glissé — seulement celle-ci a été corrigée parce qu'elle a rougi. Si un futur bandeau change encore de hauteur, chercher d'AUTRES copies locales de ce même calcul (grep `scrollIntoViewIfNeeded` + `boundingBox` dans `tests/e2e/`) plutôt que de supposer que `setup/glisser.ts` seul en dépend.
- Les captures PNG d'AUTRES tickets se régénèrent à CHAQUE `pnpm test:e2e` complet (leurs specs de capture tournent dans la même suite) — ce n'est pas spécifique à ce lot. Toujours vérifier `git status --porcelain` après un `verify:full` et écarter ce qui n'est pas le lot avant de commiter.
- `tickets/recales/` n'existe pas dans ce dépôt : la relecture du ticket 9DU s'est faite depuis les commits de la garde et `docs/propositions/9DU-TP-NAV3-RECHERCHE-RAIL/passation.md` ; une session future qui chercherait ce chemin perdra du temps à le chercher avant de s'en apercevoir.

### Ce qui reste à faire

Identique à la section « Ce qui reste à faire » ci-dessus (aide du bandeau, décompte VGP, pied de colonne en rail, D171 à valider) — rien de nouveau ouvert par cette reprise.
