# 9EC-TP-UX3-E-ABSENCES — passation

Mesuré sur main `7a98824e`, relu au départ (9DW et toutes les dépendances — 9DK, 9DR, 9DU, 9DV — déjà sur main).
9EA-1 (`Avatar`/`Onglets`) n'était pas sur main : `Onglets` existait déjà (9CB), `Avatar` n'existait pas et a été créé ici.
5 commits : addendum arbitrages (D171/D172), parties A+B+C, épreuves unitaires, décision D175, épreuve bout en bout + captures.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **En-tête** : un vrai bouton « + Déclarer une absence » (`actions` de `Page`) ouvre un **volet** latéral (`components/ui/volet.tsx`, composant serveur, piloté par `?declarer=1`/`?apercu=1`) — l'écart nommé de `lib/absences/ecarts-maquette.ts` est comblé, même geste que « + Machine ». Le formulaire n'est plus dans le corps de la page.
- **Décomptes** en lecture (`components/ui/decompte-lecture.tsx`) — ni lien ni chevron, à la différence de `Kpi` (D140 borné, QE-13b).
- **La semaine affichée** se lit en **lignes par technicien** (`Avatar` + nom, sept colonnes de jour), plutôt qu'en pastilles empilées par jour.
- **Deux cartes permanentes** à droite de la semaine : « Interventions rendues à la file à planifier » (lue sur `listerPlanning` + `mentionDeplanifiee`, sans requête ni critère neufs) et « Rupture de service » (lue sur `agencesSansTechnicienDisponible`, qui héberge aussi le bandeau événementiel de la pose).
- **Les 4 prochaines semaines en bandes** (`bandesDesQuatreSemaines`), **avant** le tableau, depuis la semaine AFFICHÉE elle-même (pas la semaine suivante — voir « Ce que j'ai tranché »).
- **Le tableau** porte des **onglets à compteur** (`Onglets`, « À venir et en cours » / « Aujourd'hui » / « Terminées »), une colonne **Durée** (`dureeEnJours`) et une colonne **Rendues à la planification** (`renduesParAbsence`).
- **L'avatar** (`components/ui/avatar.tsx`, neuf) calcule une teinte par personne, déterministe, parmi une liste fermée (bleu/vert/orange/violet — décision 28 du pilote). Distinct de `Avatar`/`AvatarClaire` locaux à `components/navigation/barre.tsx`, non touchés.
- Pour l'exploitant : le geste de déclaration ne change pas de fond (même route POST, même règle R3-14), seulement sa présentation ; les deux nouvelles cartes rendent visible, en permanence, ce qui était auparavant invisible hors d'une pose fraîche.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm test` (unitaire) : 391 → **393 fichiers** (+2 neufs), 4168 tests au total, tous verts — `tests/unit/absences/gabarit-maquette-d175.test.ts` (14 tests) et `tests/unit/ui/volet-avatar-decompte.test.tsx` (10 tests) sont neufs ; `tests/unit/ui/lot-a1-a4.test.ts` passe de 6 à 7 tests (le gardien de l'écart comblé).
- `pnpm test:isolation` : 163 fichiers, 1470 tests, verts, inchangé.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` : verts.
- E2E rejoués : `absences-2`, `absences-3`, `deplanifiee-1`, `absences-ecourter-etat`, `captures-9cc-deplanifiee`, `captures-tpa6`, `absences-levee-confirmation`, `tableau-de-bord-liens-tuiles`, `captures-9al-gr16-textes`, `captures-9bv-dates-reprise`, `captures-tpi9-noms-fictifs` — tous verts après la seule retouche d'ouverture (`?declarer=1`). `tests/e2e/9ec-absences-gabarit.spec.ts` (neuf, 5 tests, scène propre `9EC-`) — vert.
- Deux corrections mesurées en cours de route : le `href` littéral `?declarer=1` manquait du source (le gardien `lot-a1-a4.test.ts` l'exigeait textuellement) ; la taille 24 px de l'`Avatar` descendait à `text-[11px]`, sous le plancher de 12 px (D138) — rougi par `plancher-typographique.test.ts` et `retouches-2a.test.ts`, corrigé en `text-12`.

## Ce que j'ai tranché et pourquoi

- **Les bandes partent de la semaine AFFICHÉE**, pas de la semaine suivante — ça revient sur la précision du pilote de D136 (restée « à valider »), parce que c'est ce que la maquette du 28/09 dessine réellement (`bandes`, :3523, démarre à `mon`, le lundi de la semaine courante). Nommé dans D175, réouvrable.
- **« En cours » n'est pas un sixième ton de `Badge`** : une pastille locale aux jetons violets, pour ne pas étendre une liste fermée de cinq tons déjà gardée par un test (`composants-maquette.test.ts:328`).
- **`listerPlanning` est appelée HORS de la transaction principale**, comme `apercuAbsence` — même principe déjà en place, pas une nouveauté de ce lot.
- **Le fallback `nomSeul(...) ?? "—"`** pour le nom de la personne absente dans la carte « rendues » : même précédent que `planning/page.tsx` (une absence très ancienne peut être sortie de la fenêtre de 30 jours de `vue.annuaire`).
- **`absences.personne` change de valeur** (« Personne » → « Technicien ») au lieu d'ajouter une clé : le ticket le demandait explicitement, et la clé est partagée par le libellé de colonne, le `<select>` et le champ du volet — aucun des trois n'a de raison de diverger.
- **Le bouton « + » de la maquette pour l'en-tête n'a pas d'icône séparée** : comme `parc.action.nouvelle` (« + Machine »), le « + » est écrit DANS la valeur du dictionnaire (`absences.declarer_entete`), pas composé avec `Icone`.

## Ce que je n'ai PAS fait

- **Aucune règle de gestion changée** — une absence reste une personne, un début, une fin (R3-14).
- **« Modifier » n'est pas construit** (décision 16 d'Alexis du 05/10/2026) : le créer ouvrirait une règle de gestion (que rend-on à la file si on allonge une absence ?) hors périmètre de ce ticket.
- **Ni demi-journée ni plage horaire** (QG-8, migration PG-G15, hors périmètre).
- **La variante mobile « liste par semaine » du bandeau des 4 prochaines semaines n'est pas construite** : le tableau défile horizontalement à la place (`overflow-x-auto`). Named dans D175.
- **Le texte « plus qu'un seul technicien disponible sur la période » de la carte « Rupture de service » de la maquette n'est pas repris** : c'est un critère différent de `agencesSansTechnicienDisponible`, jamais mesuré ni implémenté par ce lot ni les précédents.
- **`captures-tpa6.spec.ts`** n'a pas été retouché : son `if (await selectPersonne.isVisible())` protège déjà le cas où le sélecteur n'est pas visible (volet fermé par défaut) ; la capture obtenue est désormais celle de `/absences` fermé plutôt que du `<select>` focusé — moins informative, mais le test reste vert et son assertion n'a pas été affaiblie.

## Les pièges pour la session suivante

- **`lignesRendues` (la carte permanente) et `vue.interventionsRendues` (le bandeau éphémère `?rendues=`) sont DEUX choses différentes** — la première lit tout l'état courant (`listerPlanning` + `mentionDeplanifiee`), la seconde ne lit que ce qu'une pose vient de rendre, nommé par ses identifiants dans l'URL. Ne pas les fusionner : elles répondent à deux questions différentes (« qu'est-ce qui est dans ce cas aujourd'hui » contre « qu'est-ce que je viens de faire »).
- **`Onglets` (`components/ui/onglets.tsx`) existait déjà** (créé par 9CB, pas par 9EA-1 comme le ticket le supposait) — si une session future retrouve ce composant « manquant » dans son constat, c'est que main a encore bougé depuis `7a98824e` ; vérifier avant de le recréer.
- **La liste fermée de teintes de l'`Avatar`** (bleu/vert/orange/violet) vit dans `components/ui/avatar.tsx` — un futur appelant qui voudrait une cinquième teinte doit l'ajouter LÀ, avec son jeton `app/globals.css`, jamais le recalculer ailleurs.
- **`JOURS_DES_QUATRE_SEMAINES` (28) est une constante LOCALE à `presentation.ts`**, pas une règle métier — comme `JOURS_DE_PASSE` dans `page.tsx`.

## Ce qui reste à faire

- La variante mobile « liste par semaine » du bandeau des 4 prochaines semaines (voir « Ce que je n'ai PAS fait »).
- Le texte-critère alternatif de « Rupture de service » de la maquette, si Alexis le juge nécessaire.
- 9EG-1 et 9EH-2 (qui passent après ce ticket) réutiliseront `Avatar` : vérifier, à ce moment, qu'aucune de leurs populations ne retombe sur la teinte « personne inconnue » (`identifiant: null`) sans raison.
