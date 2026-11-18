# 9L16A-MEMOIRE-BUILD-MARGE — passation

Démarré le 18/11/2026 à 11:25 (Nouméa), budget 120 min. Aucune migration, aucun écran touché,
aucune capture (dit par le mandat — rien à faire ici). Ce lot modifie uniquement
`prisma/schema.prisma` (annotations `@ignore`, zéro effet en base, vérifié par `prisma migrate
diff` — script vide), `tests/unit/gardiens/relations-societe-mortes.test.ts` (créé), et
`docs/arbitrages.md`.

## CE QUI ÉTAIT MESURÉ

9L13A (18/11/2026, même journée) avait mesuré que `pnpm build` déborde du plafond de 6144 Mo
(`--max-old-space-size`) sur `origin/main` SEUL (`6edb6dd52`), de façon reproductible : pic RSS
6 473 516 / 6 481 556 Ko, marge nulle à négative. Six lots avaient touché `prisma/schema.prisma`
depuis le correctif de 9L04A-MEMOIRE-BUILD-CAUSE (13/11, D246, 34 `@ignore` posés) sans qu'aucun
ne dépasse individuellement le seuil visible — l'érosion par accumulation que 9L04A nommait déjà
comme risque ouvert.

## MÉTHODE (identique à 9L04A)

1. Un script recense tout champ de relation Prisma à plusieurs (`champ Modele[]`) non marqué
   `@ignore` dans `prisma/schema.prisma` (136 au départ, hors scalaires `String[]` etc.).
2. Pour chaque candidat : grep du nom du champ hors de `schema.prisma`. **Piège rencontré, absent
   de la méthode initiale** : un champ de relation sur `Societe` (ou tout modèle) peut porter le
   MÊME nom littéral que l'accesseur de premier niveau du client Prisma pour le modèle cible
   (`tx.demandeStatutHistorique.findMany(...)` et la réciproque `Societe.demandeStatutHistorique`
   s'écrivent pareil). Un grep naïf classe alors ce champ « vivant » à tort. Correctif : vérifier
   si les occurrences trouvées matchent le motif `tx.<nomDuChamp>.<methode>(` (accesseur, pas
   navigation) ou `<nomDuChamp>: {` imbriqué dans un `select`/`where` d'UNE AUTRE requête (vraie
   navigation).
3. **Avant tout `@ignore`, vérifier le PARTENAIRE de la relation** — la leçon de 9L04A
   (`Prestation.realisations` / `InterventionPrestation.prestation`) s'est reproduite deux fois
   ici : `Utilisateur.acces_journalise` casse `JournalAcces.utilisateur` (réellement lu par deux
   scènes e2e, `where: { utilisateur: { email: ... } }`) ; `Habilitation.sites` reste vivante
   (`SiteHabilitationRequise.habilitation` réellement sélectionné, `lib/habilitations/depot.ts`),
   `Agence.sites` reste vivante (`Site.agence` réellement sélectionné, `lib/demandes/depot.ts`),
   `Client.sites` reste vivante (`Site.client`, `lib/sites/depot.ts`) — alors que `Societe.sites`,
   elle, est morte. Trois réciproques du même nom littéral (« sites »), trois verdicts différents :
   la vérification se fait RELATION PAR RELATION, jamais par nom de champ.
4. Compilation réelle (`pnpm typecheck`) après chaque lot de candidats — jamais seulement le grep,
   pour les mêmes raisons que 9L04A.

## CE QUI A ÉTÉ TROUVÉ (36 réciproques, en sept lots successifs, chacun mesuré et commité)

1. `Societe.interventionPauses`, `Societe.interventionStatutHistorique`,
   `Societe.demandeStatutHistorique`, `Societe.suitesADonner`, `Utilisateur.seconds_facteurs`,
   `Demande.statut_historique`, `Intervention.statut_historique`, `FamilleMateriel.prestations`
   (8). `Utilisateur.acces_journalise` écartée (piège, voir ci-dessus), documentée « PAS
   `@ignore` » dans le schéma.
2. `FamilleMateriel.sous_types`, `Devise.parites`, `Document.recus`,
   `Societe.intervention_machines`, `Societe.verifications_vgp`, `Document.verifications_vgp` (6).
3. Les QUATRE réciproques de `Notification` — `Societe`, `Intervention`, `Demande`,
   `SuiteADonner` — mortes DANS LEUR ENSEMBLE : `tx.notification.*` toujours à l'accesseur de
   premier niveau, filtré sur les colonnes scalaires (4).
4. Les TROIS réciproques de `Forfait` — `Devise`, `Societe`, `FamilleMateriel` — mortes dans leur
   ensemble, même motif (3).
5. Les TROIS réciproques de `Contact` — `Societe`, `Client`, `Site` — mortes dans leur ensemble
   (3).
6. Les SIX réciproques de `Demande` — `Societe`, `Agence`, `Client`, `Site`, `Contact`, `Machine`
   — mortes dans leur ensemble ; plus `Societe.techniciens` (PAS `Agence.techniciens`, vivante via
   `agence: { select: { libelle: true } }` dans `lib/techniciens/depot.ts`), `Societe.absences` et
   `UtilisateurSociete.absences`, `Societe.habilitations` (10).
7. `Societe.clients`, `Societe.sites` (2, après avoir écarté `Client.sites`/`Agence.sites`/
   `Habilitation.sites`, voir piège du point 3 de la méthode).

Chaque lot a été mesuré par `pnpm typecheck` puis `pnpm build` (cache `.next` vidé) avant d'être
commité — jamais de lot appliqué à l'aveugle.

## MESURES (pic RSS, `/usr/bin/time -v`, cache vidé avant chaque mesure)

| Étape | `pnpm build` | Résultat |
|---|---|---|
| `origin/main` seul (`6edb6dd52`), reproduit | 6 478 184 Ko | **ROUGE (OOM)** |
| + lot 1 (8 `@ignore`) | 6 400 860 Ko | vert |
| + lot 2 (6 `@ignore`) | 6 289 336 Ko | vert |
| + lot 3, Notification (4 `@ignore`) | 6 287 956 Ko | vert |
| + lot 4, Forfait (3 `@ignore`) | 6 240 632 Ko | vert |
| + lot 5, Contact (3 `@ignore`) | 6 187 032 Ko | vert |
| + lot 6, Demande + techniciens/absences/habilitations (10 `@ignore`) | 6 136 668 Ko | vert |
| + lot 7, clients/sites (2 `@ignore`) — **essai 1** | 5 987 380 Ko | vert |
| même état — **essai 2** | 5 977 352 Ko | vert |
| même état — **essai 3** | 5 991 996 Ko | vert |

Plafond nominal : 6144 Mo = 6 291 456 Ko. Marge au pic sur les trois essais finaux : 304 076 /
314 104 / 299 460 Ko — **~293 à 307 Mo, essentiellement l'objectif de 300 Mo** (l'écart entre
essais, de l'ordre de 10 à 20 Mo, est la marge de bruit déjà observée par 9L04A/9L13A : RSS inclut
plus que le tas V8 old-space que borne `--max-old-space-size`, et le moment des passes de
ramasse-miettes varie d'une exécution à l'autre). Gain cumulé depuis `origin/main` seul :
~490 Mo. **Le plafond `--max-old-space-size=6144` n'a pas été touché.**

`pnpm typecheck` suit la même tendance, toujours vert, dernier pic mesuré : 5 874 704 Ko.

## PIÈGE RENCONTRÉ, À RETENIR POUR LA PROCHAINE REPRISE

Un script de recensement NAÏF (grep du nom de champ comme simple mot) sous-estime le nombre de
réciproques mortes dès que le schéma a des champs dont le nom littéral coïncide avec l'accesseur
de premier niveau du client Prisma pour un AUTRE modèle (`demandeStatutHistorique`,
`interventionStatutHistorique` en sont deux exemples trouvés ici). Et SYMÉTRIQUEMENT, un champ
trouvé « jamais navigué » par ce même grep peut être la réciproque d'une relation dont le
PARTENAIRE, lui, est réellement lu (`acces_journalise` / `JournalAcces.utilisateur`,
`Habilitation.sites` / `SiteHabilitationRequise.habilitation`) — `@ignore` sur un sens retire le
partenaire du client généré. **Les deux sens de l'erreur se corrigent par la MÊME discipline** :
ne jamais conclure sur le seul texte du grep, toujours relire le code qui requête CE modèle
précis, et recompiler (`pnpm typecheck`) après chaque lot avant de committer.

## GARDIEN AJOUTÉ (point 6 du mandat)

`tests/unit/gardiens/relations-societe-mortes.test.ts` — aucun gardien de ce type n'existait
(vérifié : aucun test ne croisait `@ignore` et usage réel avant ce lot). Il échoue si une relation
à plusieurs non `@ignore` sur `Societe` n'a plus AUCUNE occurrence de son nom hors de
`prisma/schema.prisma` (app/, lib/, components/, scripts/, tests/) — le cas le plus net, celui que
9L04A et 9L16A ont trouvé à chaque fois. Il ne tranche pas lui-même les deux pièges ci-dessus
(l'accesseur de premier niveau homonyme, et le partenaire vivant) : une occurrence positive ne
prouve rien par elle-même, mais ZÉRO occurrence est un signal fiable, documenté dans le
commentaire du gardien. Deux tests : un témoin (population non vide) et le gardien lui-même.
Vérifié vert, et qu'il porte sur une population plausible (>40 champs sur `Societe`).

## CE QUI N'A PAS ÉTÉ FAIT

- Le plafond mémoire n'a pas été touché (interdit par le mandat), et aucun comportement
  applicatif n'a changé (vérifié par `prisma migrate diff`, script vide, et par `CI=1 pnpm verify`
  complet, vert).
- Aucune réduction au-delà des `@ignore` (pas de scission du client Prisma, pas de narrowing de
  `select`/`include` — l'audit a montré que ce dépôt n'utilise `include:` qu'à TROIS endroits dans
  tout `lib/`+`app/`+`scripts/` : la discipline « select minimal » est déjà appliquée partout
  ailleurs, rien à gagner de ce côté).
- `tsc --generateTrace` a confirmé que le coût dominant du `type-checking` est la comparaison du
  type générique `PrismaClient<ClientOptions, U, ExtArgs>` à chaque site d'appel qui passe un
  littéral objet non typé à une méthode Prisma (`Subset<T, XArgs>` / `ReverseMappedType`) — un coût
  STRUCTUREL, proportionnel au nombre de sites d'appel ET à la taille du client généré, pas
  réductible par un `@ignore` supplémentaire une fois les réciproques mortes épuisées. Les
  réciproques mortes trouvées ici ont toutes été épuisées par la méthode (un dernier passage du
  script affiné ne trouve plus de candidat à zéro occurrence hors des trois pièges déjà
  documentés).

## CE QUE LA PROCHAINE REPRISE DEVRAIT SAVOIR

Si la marge se referme encore (un septième lot qui touche `prisma/schema.prisma` sans vérifier
chaque réciproque nouvelle), la condition de réouverture de 9K28B/9K30A/9L04A reste la bonne
question à se poser — elle n'est PAS refermée par ce lot, elle est simplement vraie une fois de
plus. Les trois pistes déjà nommées par 9L13A restent chiffrées et non appliquées : relever le
plafond (écarté), sortir le type-checking de `next build` (changerait la chaîne de vérification,
point d'arrêt §8), scinder le client Prisma (changement de stack, point d'arrêt §8).

## VÉRIFICATION

`pnpm test` (5970 tests, verts), `pnpm test:isolation` (2294 tests, verts), `CI=1 pnpm verify`
complet (format, typecheck, lint, test, test:isolation, build) — vert de bout en bout.
