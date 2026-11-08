# 9K00-E2E-PLANNING5-FERIE — passation

## FAIT, commité (un commit sur la branche `9k00-e2e-planning5-ferie`, partie
d'`origin/main` — ce worktree avait `HEAD` détachée sur `origin/main`, `main`
étant extrait ailleurs)

## Ce que j'ai mesuré (point 1)

**Le défaut**, confirmé par calcul (`python3`, pas deviné) : le 08/11/2026 et
le 09/11/2026, `jourSuivant(aujourdhui, 140)` rend respectivement le dimanche
28/03/2027 et le lundi 29/03/2027. `planning-5.spec.ts` ne décalait QUE le cas
« dimanche » (`jourSemaineIso === 7`), d'un jour — exactement de dimanche
28/03 vers lundi 29/03, qui est le **Lundi de Pâques 2027**
(`FETES_LIEES_A_PAQUES`, `prisma/seed-data.ts` : `{ libelle: "Lundi de
Pâques", decalage: 1 }`), semé comme férié chômé. La vue jour affichait donc
« Aucune intervention posée ce jour-là » au lieu de « 1 visite à caler
(3 h 00) ».

**`scene.ts`** évite la même famille de défaut par `lundiSansJourFerie` +
`feriesDeLaSceneNc` — mais sur un LUNDI de semaine entière (pour trois rangs
fixes MARDI/MERCREDI/SAMEDI), et en lisant les fériés d'une fonction
**statique** du semis (`feriesDuTerritoire`, `prisma/seed-data.ts`), jamais de
la base. Le ticket demande explicitement de lire les fériés **en base**
(§ « en lisant les fériés en base ») : cette fonction ne convient donc pas
telle quelle à `planning-5.spec.ts`, qui avance un jour **unique**, pas une
semaine.

**L'assistant déjà partagé — pas une extraction neuve.** Six autres fichiers
(`pg-g14b-transmettre-groupe.spec.ts`, `captures-9cp-pg-g14b-transmettre-groupe.spec.ts`,
`planning-telephone-en-tete.spec.ts`, `9ewb1-feuille-basse-375-menu-plus.spec.ts`,
`captures-pg-a6-libelle-sans-duree.spec.ts`, `planning-filtres-aujourdhui.spec.ts`,
`planning-laissees-sous-la-grille.spec.ts`) posent déjà leur jour de travail
via **le même oracle** : `chargerCalendrierAgence` (`lib/calendar/agence.ts`,
lit `jour_ferie` EN BASE) composé avec `prochainJourOuvert`
(`lib/calendar/ouverture.ts`), tous deux déjà exportés par `@/lib/calendar` et
déjà unitairement éprouvés (`tests/unit/calendar/ouverture.test.ts`). C'est
CET assistant qui répond à la consigne « sinon extrais-la dans un assistant
partagé » : il existe déjà, il vit dans `lib/calendar` (du code applicatif,
pas un doublon de test), et une nouvelle enveloppe dans `tests/e2e/setup/`
n'aurait été qu'une indirection sans comportement nouveau. Je le signale
plutôt que de deviner que le ticket voulait une extraction dans
`tests/e2e/setup/` à tout prix.

## Inventaire des autres épreuves (point 1, suite)

`git grep -n "jourSuivant(aujourdhui"` sur `tests/e2e/*.spec.ts` rend 9 autres
fichiers en plus de `planning-5.spec.ts` et `planning-4.spec.ts`. Pour chacun,
vérifié si le jour calculé **pose du travail dont une assertion dépend de
l'ouverture du calendrier** :

| Fichier | Pose du travail sur le jour calculé ? | Risque dimanche/férié ? |
|---|---|---|
| `planning-4.spec.ts` | oui (`jourBloque`/`jourLibre`, absence technicien) | **non** — `data-agenda-bloque` ne lit que `lib/absences/periode`, jamais le calendrier d'ouverture (vérifié dans `disponibilite-technicien.tsx`) |
| `captures-9db-retouches-10.spec.ts` | oui | non — le jour réellement posé vient de `prochainJourOuvert`, le `jourSuivant(aujourdhui, …)` ne borne qu'une fenêtre |
| `planning-filtres-aujourdhui.spec.ts` | non | non — aucune intervention créée, la fenêtre sert à charger les calendriers pour l'oracle |
| `9ewb1-feuille-basse-375-menu-plus.spec.ts` | oui | non — géométrie de dialogue sans assertion liée au calendrier, pose planning via l'oracle |
| `captures-pg-a6-libelle-sans-duree.spec.ts` | oui | non — même patron oracle |
| `captures-9cp-pg-g14b-transmettre-groupe.spec.ts` | oui | non — même patron oracle, documenté dans le fichier |
| `planning-telephone-en-tete.spec.ts` | oui | non — même patron oracle |
| `captures-9ct-retouches-5.spec.ts` | oui (±5 jours bruts) | non — aucune assertion sur le CONTENU d'un jour précis, seulement visibilité de bouton/dialogue |
| `pg-g14b-transmettre-groupe.spec.ts` | oui | non — fichier source du patron oracle |
| `planning-laissees-sous-la-grille.spec.ts` | oui (jour visé via oracle ; `cleePassee` en J-5 brut) | non — « laissées » se calcule depuis l'horloge, jamais depuis le calendrier (déjà documenté 9DW-E2E-DIMANCHE) |

**Aucun des 9 n'a besoin de correction.** `planning-5.spec.ts` était le seul
fichier qui posait un jour de travail SUR un `jourSuivant(aujourdhui, N)` brut
avec une assertion dépendant de l'ouverture, sans passer par l'oracle.

## Le correctif (point 2)

`tests/e2e/planning-5.spec.ts` : remplacé le décalage « éviter seulement le
dimanche » par le même patron que les 6 fichiers ci-dessus —

```ts
const depuis = jourSuivant(aujourdhui, 140);
const calendrierDucos = await chargerCalendrierAgence(client, {
  societeId: societe.id,
  agenceId: ducos.id,
  fenetre: { du: depuis, au: jourSuivant(depuis, 14) },
});
jourVise = prochainJourOuvert([calendrierDucos], depuis);
```

(avec un refus explicite si `chargerCalendrierAgence` rend `null` — jamais un
jour inventé, I7). `jourSemaineIso` n'est plus importé : son seul usage a
disparu avec le correctif.

## Épreuve unitaire du cas du 29/03/2027 (point 2)

`tests/unit/calendar/ouverture.test.ts`, nouveau cas dans le `describe
("prochainJourOuvert")` existant : lit le Lundi de Pâques de l'**année
courante de l'horizon** (`premiereAnneeDeLHorizon("CODIMA-NC")`, jamais
`2027` en dur — l'horizon glissant fera courir ce cas sur une autre année une
fois 2027 passé), vérifie que le dimanche qui le précède ET le Lundi de
Pâques lui-même ferment Ducos, puis que `prochainJourOuvert` saute les DEUX,
jamais un seul.

## Ce que j'ai mesuré (vérification)

- `pnpm format`, `pnpm typecheck`, `pnpm lint` : verts.
- `pnpm test` : **504 fichiers, 5542 tests**, verts (dont le nouveau cas de
  `ouverture.test.ts`, vérifié isolément d'abord).
- `CI=1 pnpm exec playwright test tests/e2e/planning-5.spec.ts --workers=1` :
  **1 passed**.
- `CI=1 pnpm verify` (format:check, typecheck, lint, test, test:isolation,
  build) : **EXIT=0**.

## Ce que je n'ai PAS fait

- Les 9 autres fichiers inventoriés au point 1 : aucune correction, aucun
  commit — ils ne sont pas touchés par cette classe de défaut (voir tableau
  ci-dessus), et le ticket ne demande de corriger que ceux qui le sont.
- Aucune extraction dans `tests/e2e/setup/` : l'assistant demandé existe déjà
  dans `lib/calendar` et est déjà partagé par 6 fichiers — voir la mesure
  ci-dessus.
- `pnpm verify:full` n'a pas été joué (consigne du lot) — laissé à la file.
- Aucune migration, aucune donnée de production, aucune dépendance nouvelle,
  aucun fichier d'`app/**`, `lib/**`, `components/**` ou `prisma/**` modifié.

## Piège pour la session suivante

- `prochainJourOuvert` par défaut cherche sur 14 jours (`horizonJours`) : la
  `fenetre` passée à `chargerCalendrierAgence` doit couvrir au moins cette
  largeur à partir de `depuis`, sous peine que `chargerCalendrierAgence` ne
  charge pas les fériés du jour que `prochainJourOuvert` choisirait au-delà
  de la fenêtre — `estChome` traiterait alors ce jour comme ouvert par
  défaut, faute de donnée. Ce fichier passe `{ du: depuis, au:
  jourSuivant(depuis, 14) }`, exactement la largeur par défaut.
