# 9IA-REINITIALISER-SECOND-FACTEUR — passation

*Décision d'Alexis, 28/10/2026 (question 3 de l'audit, réponse « A et B ») : A — `admin_plateforme`
réinitialise le second facteur de n'importe quel compte, sans exclusion de soi ; B — `admin_societe`
réinitialise celui des AUTRES membres de SA société, jamais le sien.*

`origin/main` était extrait dans un autre worktree (`/home/aplou/codiplan`) au début de cette
session : le travail a été fait sur une branche dédiée `9IA-REINITIALISER-SECOND-FACTEUR`, partant
d'`origin/main` (confirmé identique à `HEAD` au démarrage).

## LA MIGRATION — nom exact, à jouer en production et sur le site de test

```
20261102010000_reinitialisation_second_facteur_9ia
```

`prisma migrate deploy` (ou `pnpm db:deploy`) l'applique ; elle ajoute une valeur d'enum
(`EvenementAcces.reinitialisation_second_facteur`), deux fonctions, quatre politiques (deux
permissives + deux restrictives) et deux déclencheurs, sur `second_facteur` et `utilisateur`.
Aucune donnée existante n'est touchée.

## Ce que j'ai mesuré (point 1) — `mesure.md`

- `second_facteur` n'a toujours aucune politique de suppression (D59) : l'acte ne supprime rien, il
  écrit l'état qui force le ré-enrôlement.
- `enableTwoFactor` (Better Auth) réécrit secret et codes de secours DE LUI-MÊME au prochain
  enrôlement si `second_facteur.verifie` est déjà `false` — l'acte n'a donc jamais besoin de lire ni
  d'écrire le secret.
- Remettre `second_facteur.verifie` à `false` SANS remettre `utilisateur.mfa_actif` à `false`
  enfermerait le compte (cercle parfait déjà mesuré par L1-02f) : les deux écritures sont donc
  nécessaires, sur deux tables.
- **A (`admin_plateforme`) n'a aujourd'hui AUCUN chemin d'écran vers l'équipe d'une société
  cliente** : `obtenirSession()` lie `societeId` et `role` (l'un est `null` si l'autre l'est), et
  `admin_plateforme` n'a jamais de ligne dans `utilisateur_societe` — c'est structurel (§22.5), pas
  un oubli de ce lot. La console éditeur qui ouvrirait ce chemin est explicitement différée au
  lot 7. **Signalé, non réparé** : construire cette navigation est hors territoire et hors budget de
  ce lot.

## Ce que j'ai fait (points 2 à 4)

- **`lib/auth/reinitialisation.ts`** (`reinitialiserSecondFacteur`, `peutReinitialiserSecondFacteur`)
  — voisin direct de `lib/auth/deverrouillage.ts` (L7-04) : même désignation de sujet
  (`app.reinitialisation_sujet_id`), même `UPDATE` sans `WHERE` à `SET` constants (sur les DEUX
  tables), même refus dit dans le code et tenu en base, même trace dans `journal_acces`
  (`reinitialisation_second_facteur`).
- **La migration** : fonction dédiée `app_peut_reinitialiser_second_facteur()` (A sans exclusion de
  soi, B jamais lui-même — ni `direction` ni aucun autre rôle, à la différence de
  `app_peut_administrer_identites()`) ; sur `second_facteur` ET `utilisateur`, une politique
  permissive désignée, une RESTRICTIVE « exclusive » (même principe que D90) qui borne aussi les
  autres politiques permissives à la ligne désignée, et un déclencheur qui refuse toute colonne
  hors de celles prévues.
- **L'écran** : sur l'onglet « Comptes de bureau » d'Équipe, un bouton sous le badge « Actif »,
  visible uniquement quand `peutReinitialiserSecondFacteur(role, acteur, cible)` est vrai —
  **pratiquement B seul**, pour la raison ci-dessus (A n'atteint jamais cet écran). Confirmation par
  `BoutonAvecConfirmation`.
- **La route** : `app/api/equipe/bureau/[id]/reinitialiser-second-facteur/route.ts`, exemptée de
  `exigerCapacite` (D-12) — aucune capacité de la matrice commune ne porte exactement cette portée
  (`administrer_utilisateurs` inclurait la direction, que la décision exclut) ; exemption nommée
  dans `tests/unit/auth/porte.test.ts`.

## Deux écarts PRÉEXISTANTS, découverts par les épreuves et signalés plutôt que réparés

Hors territoire de ce ticket (« toute autre politique RLS ») — voir les commentaires de
`tests/isolation/reinitialisation-second-facteur.test.ts` :

1. **`utilisateur_modification`** (D37/D199) laisse déjà `admin_societe`/`direction` écrire
   `mfa_actif` de TOUTE identité de leur société — y compris la LEUR — par un simple `UPDATE` sans
   `WHERE`, sans qu'aucun déclencheur ne l'ait jamais borné. Rien dans ce lot n'exploite ce chemin
   (l'acte s'arrête avant, côté code), mais le JUMEAU de ma politique `utilisateur_reinitialisation`
   ne peut se jouer que sur A : retirer ma politique ne change rien pour B, déjà couvert ailleurs.
2. Le même mécanisme rend `identite` non nul dans deux scénarios de test (« direction », « sans
   sujet désigné ») alors que `second_facteur` reste correctement à zéro — documenté scénario par
   scénario plutôt que masqué par une assertion élargie.

Ni l'un ni l'autre n'est une régression de ce lot : ce sont des caractéristiques préexistantes de
`utilisateur_modification`, jamais exercées avant que ce ticket n'écrive le premier appelant qui
touche `mfa_actif`.

## Épreuves (point 5)

- `tests/isolation/reinitialisation-second-facteur.test.ts` — succès A et B, refus (rôle hors
  liste, soi-même pour B, autre société, sans sujet désigné), deux JUMEAUX (politique retirée),
  filet de colonnes sur les deux tables, lecture fermée, trace journalisée. A est éprouvé ICI
  (directement à la base), faute d'écran pour l'atteindre en e2e.
- `tests/e2e/9ia-reinitialiser-second-facteur.spec.ts` — B réussit sur un autre membre de sa
  société et la connexion du sujet mène ensuite à `/enrolement` ; B refusé sur lui-même et sur un
  compte d'une autre société par requête forgée (même refus opaque,
  `equipe.bureau.refus.introuvable`).
- `tests/e2e/captures-9ia-reinitialiser-second-facteur.spec.ts` — captures 375/1280 px, rejouées
  avec `CAPTURES_9IA=... pnpm test:e2e tests/e2e/captures-9ia-reinitialiser-second-facteur.spec.ts`.
- `tests/unit/auth/porte.test.ts` — exemption D-12 nommée pour la nouvelle route.
- `lib/db/migrations-attendues.ts` — migration ajoutée à la liste close.

## Ce que je n'ai PAS fait (hors territoire)

- Aucune navigation nouvelle pour `admin_plateforme` (console éditeur, lot 7).
- Aucune modification de `utilisateur_modification` ni d'aucune autre politique existante.
- Aucune dépendance nouvelle.

## Commandes jouées

- `pnpm format && pnpm typecheck && pnpm lint` verts après chaque point.
- `pnpm test` — 493 fichiers / 5437 tests, tous passés.
- `pnpm test:isolation` — 202 fichiers / 1791 tests, tous passés (suite complète, après le point 3).
- `tests/e2e/9ia-reinitialiser-second-facteur.spec.ts` rejoué seul : vert (3 tests, ~1,8 min).
- `tests/e2e/captures-9ia-reinitialiser-second-facteur.spec.ts` rejoué avec `CAPTURES_9IA` : vert,
  4 captures produites.
- `CI=1 pnpm verify:full` : voir `verify-final.txt`. `verify` (format/typecheck/lint/test/
  test:isolation/build), `feries:horizon` et `audit:partitions` tous verts. `test:e2e` — 1832
  épreuves, UN SEUL worker sous CI — n'a pas fini dans le budget de la session (interrompu après
  60 minutes, AUCUN échec constaté dans ce qui s'est joué). `pnpm verify` a ensuite été rejoué
  seul, en entier, et confirmé vert une seconde fois.
