# 9EXA-EQUIPE-TECHNICIENS-MAQUETTE — passation

## RELANCE DU 15/10, 22:50 — CE QUI A ÉTÉ FAIT

Le premier passage (9EX, 22:30) s'était arrêté à tort (fenêtre de 80 commits trop courte, voir
l'ancienne note ci-dessous, conservée pour mémoire dans l'historique git). Ce passage (9EXA) a repris
le lot en entier, prérequis confirmé (`79b59e9c`, 9ET-COMPTES-BUREAU-2, bien ancêtre d'`origin/main`).

### POINTS LIVRÉS (6 commits `9EXA-EQUIPE-TECHNICIENS-MAQUETTE`)

0. **Solde de la revue 9ET-2** (182, 183, 184, 185, 188, 190) — tous couverts par une épreuve unitaire
   ou d'isolation neuve :
   - 182 : `cibleAccesConnue` (`presentation.ts`) reconnaît un compte de bureau (`?compte=`) en plus
     d'un technicien (`?technicien=`) pour le bandeau « Lien envoyé à »/« non parti ».
   - 183 : un envoi accepté mais NON PARTI, déclenché par l'interrupteur « envoyer le lien en
     l'ajoutant » du volet de création, redirige vers le motif « non parti » (+ destinataire + raison)
     plutôt que de se taire — dans `techniciens/creer` ET `equipe/bureau/creer`.
   - 184 : un rattachement à une identité qui a déjà choisi son mot de passe rend
     `equipe.info.rattache`, jamais `equipe.refus.envoi_echoue`.
   - 185 : `hrefOnglet`/`hrefOuvrirVolet`/`hrefChoisirType`/`hrefFermerVolet` gardent désormais
     `etat`/`acces`/`echeance` (type `FiltresEquipe`).
   - 188 : placeholder du choix de rôle → clé `equipe.volet.role_choisir` dédiée.
   - 190 : le compteur de l'onglet « Techniciens » affiche `affiches.length` (ce que l'onglet montre
     réellement), jamais `techniciens.length` (le total brut, inactifs compris à l'insu du filtre).

1. **« Lien expiré » pour les techniciens (D80).** `etatsAccesDesTechniciens`
   (`lib/auth/acces-technicien.ts`) porte désormais la même 4ᵉ valeur `lien_expire` que
   `etatsAccesDesComptes`, calculée identiquement (`DUREE_LIEN_PREMIER_ACCES_SECONDES`) et agrégée sur
   l'historique de TOUS les administrateurs de la société (pas seulement l'admin courant — même
   correctif que le solde 175). Les appelants existants gardent leur sens sans y toucher :
   `lib/tableau-de-bord/lectures.ts` traitait déjà tout état hors `"actif"` comme « à ouvrir » ;
   `libelleEtatAccesTuile`/`detailAccesAOuvrir` (tableau de bord) ont été étendus pour traiter
   `lien_expire` comme `lien_envoye`. `BlocAcces` (le `<details>` de la fiche) n'a pas eu besoin de
   changer : son ternaire existant couvrait déjà le cas.

2. **Tableau de l'onglet Techniciens à la maquette.** Colonnes Technicien | Habilitations | À venir
   (150px) | Accès (240px) | gestes (190px) — agence retirée de la colonne (reste dans la fiche),
   statut en texte (plus de badge `BadgeStatutRessource`, supprimée), tags d'habilitation
   `<CODE> · <état>` triés par code (jamais le libellé complet, réservé au `<details>`), « À venir »
   coloré selon l'état d'accès. `BadgeAccesBureau` (déjà existant) est réutilisé tel quel pour la
   colonne Accès du technicien — les deux types `EtatAcces`/`EtatAccesBureau` sont structurellement
   identiques depuis le point 1, TypeScript l'accepte sans aucun cast.
   **Solde 189** (mesuré en écrivant le point 2, pas dans la liste du pilote) : « Triés par nom de
   famille. » triait en réalité par nom COMPLET. `dernierMot`
   (`lib/tri/collation.ts`) prend le dernier mot du nom (aucun champ dédié n'existe,
   `git grep nomFamille` est resté muet) ; appliqué à `trierLesTechniciens`
   (`lib/techniciens/depot.ts`) ET au tri des comptes de bureau (`page.tsx`). Le test unitaire
   `tri.test.ts` existant a été ADAPTÉ (ses trois noms étaient construits pour qu'un tri par nom
   complet et par nom de famille divergent, exprès) — son second cas (« Technicien 2 » avant
   « Technicien 10 ») n'a pas bougé, le dernier mot y étant déjà le nombre.

3. **Menu « … » et nouveau lien (D86, décision n° 86 d'Alexis).** `lib/auth/lien-d-acces.ts` porte
   `OptionsEnvoiLien.nouveauLien`, qui saute le refus `deja_un_mot_de_passe` SEULEMENT sur demande
   explicite. `envoyerNouveauLienDAcces`/`envoyerNouveauLienDAccesBureau` (même garde de membre que le
   premier envoi), deux routes neuves (`/api/equipe/[id]/nouveau-lien`,
   `/api/equipe/bureau/[id]/nouveau-lien`, enregistrées dans `ROUTE_CAPACITE`). Écran :
   `menu-nouveau-lien.tsx` (MenuPlus + Dialogue, patron de `DialogueAnnuler`), câblé dans
   `GesteAccesTechnicien` ET `GesteAccesBureau` (un compte ACTIF porte désormais le menu plutôt
   qu'aucun bouton). **Écart nommé** : `MenuPlus` (composant partagé, hors territoire) pose un
   aria-label fixe, jamais personnalisé « Autres gestes pour <nom> » comme la maquette — voir D204.

4. **Cartes sous 900 px.** `<Tableau>` masqué (`max-[900px]:hidden` sur la section), `<ListeCartes>`
   après lui dans le DOM, une `CarteTechnicien` NON-LIEN (`<li><article>`, pas `Carte` — son pied porte
   un formulaire/le menu « … », et `Carte` est un lien plein qui ne peut pas les contenir). Réutilise
   `CelluleHabilitationsTableau` et `GesteAccesTechnicien`. Un message `equipe.aucun` visible sous
   900 px (`min-[901px]:hidden`) quand la liste filtrée est vide.
   **Piège rencontré et noté pour la suite** : passer `etat.etat === "actif"` comme ARGUMENT d'un
   appel de fonction DANS un enfant JSX se fait lire par `tests/unit/i18n/sans-chaine-visible-en-dur.
   test.ts` (gardien L0-11, AST réel) comme un texte visible littéral — il ne suit que les branches
   d'un TERNAIRE (jamais sa condition, ni celles d'un appel). Résolu en gardant la comparaison dans la
   CONDITION d'un ternaire, jamais dans l'argument d'un appel. Si ce piège se reproduit ailleurs,
   c'est la même parade.

6. **Doc.** D204 dans `docs/arbitrages.md` (décision n° 86, les points 1 à 4 ci-dessus), amendement de
   D65 (le cliquet reste la règle générale, D204 lui ouvre une exception nommée). `docs/backlog.md`
   non touché (hors territoire explicite de ce point).

### CE QUI N'A PAS ÉTÉ FAIT — POUR LE LOT 3/3 (9EY)

Le budget de temps (gabarit v2, gel du code neuf à T0+80 min) a été atteint avant le point 5. **Rien
de ce qui est livré ci-dessus n'est incomplet** : chaque point a été vérifié contre `pnpm typecheck`,
`pnpm lint`, `pnpm test`, `pnpm test:isolation` (les fichiers isolation touchés, pas la suite entière —
voir ci-dessous) et contre TOUTES les épreuves e2e existantes qui lisent cet écran, toutes vertes :
`equipe.spec.ts`, `equipe-1.spec.ts`, `pg-g16-statut-ressource.spec.ts` (dont son test à 375 px),
`equipe-agence-inactive.spec.ts`, `habilitations.spec.ts`, `acces-technicien.spec.ts`,
`captures-9dja-acces-technicien.spec.ts`, `volet-equipe.spec.ts`, `acces-bureau.spec.ts`,
`droits-rm-rs.spec.ts`, `9eg2-tableau-de-bord-direction-admin.spec.ts` (dont ses captures à 375 px).

Ce qui reste pour 9EY :

- **Point 5 — les épreuves e2e NEUVES** du ticket : (a) un technicien avec une habilitation expirée,
  une à < 60 j, une lointaine → les 3 tags et leur ordre ; (b) « À venir » : 0 → « aucune », N avec
  accès non actif → texte orange + « sans accès à l'application » ; (c) les 4 états d'accès dont
  « Lien expiré » (journal antidaté, par fixture) ; (d) le menu « … » (ouvrir, envoyer un nouveau
  lien, bandeau « Lien envoyé à ») — à la fois pour un technicien ET pour un compte de bureau ; (e) à
  375 px : cartes visibles, tableau caché, aucun débordement. Fixtures `zz9EX-` (ou `zz9EXA-`),
  nettoyage `afterAll`, jamais `SCENE.*`.
- **Captures** 375 et 1280 de l'onglet Techniciens rempli, du menu ouvert, du dialogue « nouveau
  lien », des cartes — aucune n'a été prise (aucune épreuve de capture neuve n'a été écrite).
- **Lot 3/3 du ticket d'origine** (toujours hors territoire de 9EXA, déjà annoncé par D198/D204) :
  l'alerte « N personnes ne peuvent pas encore se connecter » + « Tout envoyer », le lien
  « Renouveler <code> » sur une habilitation expirée, le bouton « Renouveler » du tableau/des cartes.
- **`pnpm test:isolation` EN ENTIER** n'a pas été rejoué (seuls `acces-technicien.test.ts`,
  `acces-bureau.test.ts` et `techniciens-statut-ressource.test.ts`, les fichiers touchés ou
  susceptibles de l'être, ont tourné — tous verts). À rejouer en entier avant la fin du lot si un
  doute subsiste.
- **`pnpm verify:full` EN ENTIER** n'a pas tourné dans cette session (budget de temps) — seuls
  `pnpm verify` (format, typecheck, lint, test, test:isolation ciblé, pas de build) et les épreuves
  e2e listées ci-dessus ont tourné. À faire avant tout lot suivant.

### UN FICHIER AJOUTÉ HORS DE LA LISTE INITIALE DU TERRITOIRE

`app/(back-office)/tableau-de-bord/page.tsx` et `.../presentation.ts` ont été touchés (point 1) :
`etatsAccesDesTechniciens` rend désormais 4 états au lieu de 3, et `libelleEtatAccesTuile`/
`detailAccesAOuvrir` du tableau de bord, qui consomment ce type, en avaient besoin pour compiler et
pour rester fidèles (un lien expiré doit s'y lire comme « lien envoyé », pas comme « aucun lien »).
Changement minimal, couvert par les épreuves 9eg2 existantes (toutes vertes).

## ANCIENNE NOTE (premier passage, 9EX, 15/10 22:30) — gardée pour mémoire

Le ticket imposait : « ARRÊT IMMÉDIAT SI `git log origin/main --oneline -80` ne contient PAS de
commit `9ET-COMPTES-BUREAU-2` ». Mesuré tel quel : absent des 80 derniers commits d'`origin/main`
(tête `40bd7000`). En creusant au-delà de la fenêtre de 80 : le commit final du lot, `79b59e9c`, EST
ancêtre d'`origin/main`, à 87 commits en arrière — le lot était bien intégré, seule la fenêtre de 80
choisie par le pilote ne l'atteignait plus. Relancé tel quel par la suite (ce fichier).
