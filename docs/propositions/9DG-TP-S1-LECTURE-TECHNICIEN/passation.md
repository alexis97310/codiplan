# 9DG-TP-S1-LECTURE-TECHNICIEN — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

QT-2 (28/09/2026) : un technicien ne lisait en réalité presque rien de moins qu'un
compte du bureau. Ce lot ferme l'écart, mesuré à l'audit du 28/09 (constats IN-06,
PV-10, CS5, PA-01, TR-4), en douze points numérotés comme le document du pilote
(`docs/arbitrages.md`, D152) :

- **Un périmètre neuf** (`perimetreParcDuTechnicien`, `lib/interventions/
  perimetre-technicien.ts`) : les machines de TOUTES ses interventions non
  annulées, et celles des clients qu'une intervention lui affecte, non annulée,
  non clôturée, datée dans `[aujourd'hui, aujourd'hui+7[` (jours civils du fuseau
  de la société). Ce périmètre gouverne désormais les sept lecteurs du parc et du
  registre VGP (`lib/machines/depot.ts`, `lib/vgp/registre.ts`).
- **L'historique d'une machine** (choix 10) ne montre que SES interventions à lui.
- **Créer/modifier une machine** (choix 2) refuse un client hors périmètre, même
  motif que `SiteHorsClient`.
- **Le registre `/interventions` et le tableau de bord** (choix 3, 9) sont
  FERMÉS — niveau « complet » exigé sur `consulter_planning`, au lieu du simple
  `peut()` — avec un refus nommé (`RefusAcces`, nouveau composant partagé) plutôt
  qu'un renvoi muet. Par sécurité, les fonctions de dépôt du registre composent
  aussi `restrictionParPersonne`.
- **Les absences** (choix D) : un technicien restreint ne lit que la sienne, et
  les formulaires « Déclarer »/« Lever » disparaissent pour lui.
- **Les tarifs** (choix 6) restent ouverts à ADMS, DIR, RM, RS, ADV ; les autres
  pages `/parametres/*`, `/imports`, `/demandes` ferment spécifiquement le
  technicien.
- **Clients et sites** (choix 1) : six pages ferment le technicien ; il lit
  client et site depuis la fiche de SES interventions.
- **Les documents** (choix 12) : un document d'intervention suit le même
  périmètre que la fiche.
- **`/api/recherche/clients`, `/sites`, `/site/[id]`** (fin du choix 1) suivent
  désormais le même périmètre, pour que `/parc/nouvelle` (que le technicien garde)
  ne lui propose pas de clients hors de son périmètre.

Pour l'exploitation : un technicien de terrain voit désormais une application
nettement plus étroite — son planning, ses absences, le parc et le registre VGP
RESTREINTS à ce qu'il visite sous sept jours, et plus rien du pilotage de
l'agence. **Ce périmètre n'a pas encore été validé par Alexis** (voir D152) :
les choix d'application sont ceux du pilote, à confirmer.

## Ce que j'ai mesuré

- **Unitaire** (`pnpm test`, 372 fichiers / 3905 tests, vert) : bornes exactes du
  périmètre parc (J, J+6 inclus, J+7 exclu, annulée exclue — `tests/unit/
  interventions/parc-du-technicien.test.ts`), niveau exigé de la barre (`tests/
  unit/navigation/barre-par-role.test.tsx`), exemptions `/api/recherche/*`
  réexpliquées (`tests/unit/auth/porte.test.ts`).
- **Isolation, contre la vraie base** (`pnpm test:isolation`, 148 fichiers /
  1348 tests, vert) : les deux branches du périmètre parc (ses propres
  interventions sans borne de date, clients visités sous sept jours avec les
  bornes J/J+6/J+8, intervention d'un collègue exclue, annulée exclue) sur
  `rechercherLeParc` ET `listerLeRegistre` (`tests/isolation/
  parc-perimetre-technicien.test.ts`) ; `lireLesAbsences` restreinte à SA propre
  absence (`tests/isolation/absences-perimetre-technicien.test.ts`).
- **Bout en bout, contre un serveur réel** (`pnpm test:e2e` sur le fichier du
  lot) : le menu du compte technicien du semis ne porte plus Tableau de bord,
  Interventions, Clients, Sites, Sociétés & tarifs, Imports Excel — garde
  Planning, Absences, Parc machines, VGP, App technicien ; cinq URL directes
  rendent le refus nommé (`tests/e2e/9dg-tp-s1-lecture-technicien.spec.ts`, 2/2
  vert).
- **Captures AVANT/APRÈS**, 375 et 1280 px, compte technicien du semis
  (`garnier@codima.test`) : menu, tableau de bord, interventions, parc, VGP,
  absences, taux horaire, clients — AVANT (commit ca348d2, tout visible) et
  APRÈS (menu réduit, refus nommé ou contenu filtré) ; une capture ADV de
  `/parc`, identique des deux côtés, pour montrer que le bureau n'est pas
  concerné (`docs/propositions/9DG-TP-S1-LECTURE-TECHNICIEN/captures/`).
- `pnpm build` : vert. `pnpm feries:horizon` et `pnpm audit:partitions` : verts
  contre la base locale. `CI=1 pnpm verify:full` lancé une première fois en UN
  appel, au premier plan : il a dépassé le plafond d'un seul appel outil de cet
  environnement (30 minutes) avant de conclure — `pnpm verify` (format,
  typecheck, lint, test, test:isolation, build) et les deux contrôles nocturnes
  (`feries:horizon`, `audit:partitions`) ont donc été rejoués SÉPARÉMENT,
  tous verts. `pnpm test:e2e` SEUL (812 épreuves, un seul worker, suite
  préexistante qui dépasse largement ce lot) a été relancé à part : il
  régénère au passage des captures AVANT/APRÈS d'AUTRES tickets
  (`docs/propositions/*/captures/*.png`, horodatage/police différents de
  l'environnement où elles ont été prises) — un effet de bord déjà présent
  avant ce lot, jamais commité ici. La suite complète n'a PAS été menée à son
  terme dans cette session (le temps dépassait très largement ce qu'un seul
  lot peut raisonnablement consommer) ; seule l'épreuve propre à ce ticket
  (`9dg-tp-s1-lecture-technicien.spec.ts`) a été confirmée, isolément, 2/2
  verte, à deux reprises.

## Ce que j'ai tranché, et pourquoi

- **`perimetreParcDuTechnicien` est dupliquée, pas importée, pour sa lecture du
  fuseau** : `lib/interventions/perimetre-technicien.ts` est déjà importé PAR
  `lib/interventions/depot.ts` (pour `perimetreDuPlanning`) ; importer
  `debutDuJourSociete` en retour fermerait un cycle. Même geste, même raison que
  la duplication déjà faite par `lib/techniciens/depot.ts`.
- **Le registre et le tableau de bord ferment sur le NIVEAU, pas sur le rôle** :
  `peutPleinement(role, "consulter_planning")` plutôt que `role ===
  Role.technicien`, parce que c'est équivalent pour tout rôle qui atteint
  réellement ces pages (seul le technicien est `○` sur cette capacité parmi les
  rôles internes), et parce que ça reste vrai si un second rôle reçoit un jour
  ce `○` — exactement le principe que `lib/interventions/perimetre-technicien.ts`
  défend déjà pour le planning.
- **Clients, sites, et les « autres » pages de paramètres/imports/demandes
  ferment sur le RÔLE, pas sur une capacité** : contrairement au registre,
  réutiliser `gerer_client_site` (ou une capacité analogue) aurait AUSSI exclu
  RM et RS, qui n'ont pas cette capacité mais que le ticket n'habilite pas à
  toucher (« Aucune logique changée » hors technicien). Garde surgicale
  (`role === Role.technicien`), documentée comme un choix explicite plutôt que
  comme une recopie de ligne de matrice.
- **Taux horaire et forfaits ferment sur une UNION de deux capacités**
  (`parametrer_societe` OU `voir_montants_vente`) — c'est le seul calcul qui
  retombe exactement sur l'ensemble que le ticket nomme (ADMS, DIR, RM, RS,
  ADV), sans toucher à aucun de ces cinq rôles.
- **`lib/clients/depot.ts` et `lib/sites/depot.ts` sont entrés dans le
  territoire du lot**, non nommés dans le ticket : `/api/recherche/clients` et
  `/api/recherche/sites` ne peuvent pas appliquer le périmètre sans que leur
  dépôt accepte un fragment de restriction — exactement le même geste que
  `filtreDuParc` dans `lib/machines/depot.ts`, qui lui ÉTAIT nommé.
- **`/api/recherche/modeles` n'est pas concerné** : un modèle de matériel
  n'appartient à aucun client ni site, rien à restreindre.
- **Le refus se nomme toujours `RefusAcces`**, un composant neuf
  (`components/ui/refus-acces.tsx`) : aucun composant de refus partagé
  n'existait (mesuré), et le ticket en demandait un.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix (interdit du ticket).
- Aucune écriture de paramètres n'a changé de comportement (lot S3).
- La capture de « une fiche machine » (demandée dans la liste des captures)
  n'a pas été prise : elle exigeait de choisir dynamiquement une machine HORS
  périmètre dans le jeu de démonstration pour être significative, ce que le
  script de capture ne fait pas aujourd'hui. Le même périmètre est déjà prouvé,
  pour `lireMachine`, par construction (même fragment que `rechercherLeParc`,
  éprouvé en isolation) — mais pas par une capture.
- Aucune épreuve d'isolation ou unitaire dédiée pour : la fiche machine
  (`lireMachine`) elle-même, `informationDeLaMachine`, le refus de
  `creerMachine`/`modifierMachine` sur un client hors périmètre (choix 2),
  l'historique restreint (choix 10), le document d'un collègue (choix 12), et
  les gardes des pages « autres paramètres/imports/demandes » et « tarifs ».
  Toutes sont vérifiées par construction (même fonction de périmètre, même
  garde que des chemins déjà éprouvés) et par `pnpm build` + `pnpm typecheck`,
  mais aucune épreuve ne les confronte à la vraie base ou à un écran réel.
- Je n'ai pas demandé à Alexis de valider D152 — la décision l'attend encore.

## Les pièges pour la session suivante

- **`listerLeRegistre` et `compterAPrevoir` (`lib/vgp/registre.ts`) n'acceptent
  aucun `client?: PrismaClient`** : toute épreuve qui les appelle doit poser
  `process.env.DATABASE_URL` AVANT de les importer (dynamiquement, après avoir
  posé la variable — un `import` statique est hissé avant toute autre ligne du
  fichier et construirait le client partagé sans `DATABASE_URL`). Voir
  `tests/isolation/parc-perimetre-technicien.test.ts` et le fichier existant
  `tests/isolation/vgp-compte-tuile-registre.test.ts` pour le geste exact.
- **La table `technicien` n'est PAS peuplée par le harnais global d'isolation**
  (`tests/isolation/setup/global.ts`) : toute épreuve qui lit `declarables`
  (absences) doit poser sa propre ligne jetable, comme
  `tests/isolation/absence.test.ts` (« l'alerte de rupture de service ») et le
  fichier neuf de ce lot le font.
- **`gerer_client_site` exclut aussi RM et RS**, pas seulement le technicien —
  ne PAS le réutiliser comme garde de page pour `/clients` ou `/sites` sans
  relire ce piège, sous peine de changer leur accès en passant.
- **Le compte E2E_DATABASE_URL/TEST_DATABASE_URL local sert aussi au semis de
  démonstration** : lancer `pnpm test:e2e` réinitialise la base (migrate deploy
  + seed) — la rejouer après `pnpm test:isolation` (qui fait un `migrate
  reset`) est sans risque, l'inverse laisse la base dans l'état du semis plutôt
  que des fixtures d'isolation.
- **`pnpm test:e2e` SEUL (hors `verify`) prend ~1-2 h et plus de 800 épreuves**
  dans ce dépôt : il dépasse le plafond d'un seul appel outil de cet
  environnement. Il régénère aussi, en cours de route, des PNG de captures
  AVANT/APRÈS d'autres tickets déjà committées (légères différences de rendu
  entre environnements) — `git status` après coup peut montrer des dizaines
  de fichiers modifiés qui n'appartiennent à AUCUN lot en cours ; ne jamais
  les committer, un `git checkout -- <fichier>` les restaure sans risque.
- **Les captures AVANT ont été prises en checkout détaché sur `ca348d2`**, puis
  le HEAD est revenu sur la tête du lot — aucun commit n'a été perdu (git ne
  supprime jamais un commit atteignable), mais une session qui reprendrait ce
  lot doit vérifier `git log --oneline -3` avant toute chose pour confirmer
  qu'elle est bien sur la tête du lot et non sur l'ancien commit.

## Ce qui reste à faire

- Faire valider D152 par Alexis (ou trancher les points où le choix du pilote
  serait contesté).
- Compléter la couverture d'épreuves listée dans « ce que je n'ai pas fait » —
  en particulier `lireMachine`/`informationDeLaMachine` et le refus de
  `creerMachine`/`modifierMachine` sur un client hors périmètre, qui n'ont
  aujourd'hui qu'une preuve par construction.
- La capture « fiche machine » avant/après, si elle est jugée nécessaire —
  choisir une machine hors périmètre du technicien de démonstration pour
  qu'elle soit significative.
- Le lot TP-S3 (écritures de paramètres, hors périmètre de ce lot).
- Le lot TP-ABS (un technicien pose SA PROPRE absence), explicitement exclu du
  choix D de ce lot.
