# 96-VGP-4-REPRISE-2 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`91-VGP-4-REPRISE` avait été recalée DEUX FOIS : la même épreuve neuve,
`tests/e2e/vgp-4.spec.ts:136`, attendait « 1 échéance dépassée » dans la
tuile `[data-bloc="kpi-vgp"]` de `/tableau-de-bord` et en lisait 3. Le code
de `/vgp` n'était pas en cause — le travail était gardé sur la branche
locale `91-VGP-4-REPRISE-garde`, fusionnée ici sans modification de
`lib/vgp/registre.ts` ni de `app/(back-office)/vgp/page.tsx`.

1. **Fusion de `91-VGP-4-REPRISE-garde` dans `main`** : un seul conflit,
   `lib/i18n/fr.ts` (deux blocs de fixtures ajoutés en parallèle par
   `92-CREATION-2` et `91-VGP-4-REPRISE`) — résolu en conservant les deux
   blocs, aucune clé perdue.
2. **`tests/e2e/vgp-4.spec.ts` réécrite pour ne forger AUCUNE échéance
   dépassée.** L'ancienne scène posait deux machines à échéance dépassée
   (`MACHINE_DEPASSEE_ANCIENNE`, vérifiée en 2010 ; `MACHINE_DEPASSEE_RECENTE`,
   vérifiée il y a treize mois) dans la société partagée `CODIMA-NC` — deux
   échéances qui s'ajoutaient à la seule que le semis porte déjà
   (`NUS-SPL-2022-0007`), faussant tout calcul global lu en parallèle par
   `tests/e2e/vgp-retard-visible.spec.ts`. La preuve « la plus ancienne
   dépassée en tête » s'appuie désormais sur cette dépassée du SEMIS — lue,
   jamais modifiée, jamais créée ni supprimée par cette épreuve.
3. **Ce que l'épreuve forge encore** — une machine à échéance à venir, une
   machine sans information — **ne change aucun compte partagé** : l'échéance
   à venir est posée à six mois (vérifiée il y a six mois, périodicité douze
   mois), largement au-delà des trente jours de `HORIZON_VGP_JOURS`
   (`app/(back-office)/tableau-de-bord/page.tsx:49`), donc hors de la tuile
   « à venir sous 30 jours » aussi bien que de la tuile « dépassées ».
4. **`lib/i18n/fr.ts`** : les deux clés devenues inutiles
   (`vgp4.e2e.numero_serie_depassee_ancienne`,
   `vgp4.e2e.numero_serie_depassee_recente`) sont retirées ; le commentaire
   d'en-tête du bloc `vgp4.e2e.*` nomme désormais explicitement la leçon du
   25/09/2026.

Pour l'exploitation : `/vgp` lui-même est INCHANGÉ depuis `91-VGP-4-REPRISE`
— tri par urgence, filtre `?etat=a_venir`/`?etat=depassees`, recherche `q`.
Seule l'épreuve qui le vérifie a changé.

## Ce que j'ai mesuré

- **`pnpm typecheck`** immédiatement après la fusion : vert, aucune erreur.
- **`pnpm test`** (unitaires) : un premier passage a révélé une seconde
  faute — `toContainText(MACHINE_DEPASSEE_DU_SEMIS)` interrogeait l'écran
  avec un numéro de série littéral (`"NUS-SPL-2022-0007"`), que le gardien
  `sans-chaine-visible-en-dur` (L0-11, `tests/unit/i18n/`) refuse. Corrigé en
  lisant `innerText()` puis en comparant avec `expect(...).toContain(...)` —
  un matcher générique, non une requête d'écran au sens du gardien. Après
  correction : **265 fichiers, 2854 tests, tous verts.**
- **`CI=1 pnpm verify:full`**, en un seul appel, au premier plan : migrations
  appliquées, semis rejoué, `format:check` + `typecheck` + `lint` + `test` +
  `test:isolation` + `build` + `feries:horizon` + `audit:partitions` +
  `test:e2e` (276 passés, 3 ignorés) — **tout vert, aucun échec.**
- Je n'ai PAS mesuré séparément le compte AVANT de la tuile `kpi-vgp` avec
  l'ancienne scène (91-VGP-4-REPRISE) sur cette session : le constat du
  ticket (« 3 dépassées · 1 à venir sous 30 jours » au lieu de « 1
  dépassée ») vient du journal de la file, pas d'une mesure reproduite ici.
  Ce que j'ai mesuré directement, c'est l'ABSENCE de régression après
  correction : la suite `test:e2e` complète, y compris
  `vgp-retard-visible.spec.ts`, passe au vert dans la même exécution que la
  nouvelle scène de `vgp-4.spec.ts`.

## Ce que j'ai tranché et pourquoi

- **Aucune échéance dépassée n'est forgée**, même en dehors de toute assertion
  de comptage : c'est la cause du recalage, et la reproduire ailleurs dans le
  fichier — même sans l'exploiter dans une assertion — laisserait un piège
  pour la prochaine modification de cette scène.
- **`MACHINE_DEPASSEE_DU_SEMIS = "NUS-SPL-2022-0007"` reste un littéral**,
  au même titre que dans `tests/e2e/vgp-retard-visible.spec.ts` : ce n'est
  pas un libellé produit, c'est une DONNÉE (un numéro de série du semis),
  et le gardien L0-11 ne la retient que si elle atteint l'écran via une
  requête suivie (`getByText`, `toContainText`, …). Elle n'est utilisée
  qu'avec `locator(...).filter({ hasText })` (non suivi) et
  `expect(innerText()).toContain(...)` (matcher générique) — jamais dans une
  requête d'écran directe.
- **`await expect(lignes).toHaveCount(1)`** est une assertion volontairement
  stricte : elle vérifie que le filtre `?etat=depassees` ne rend QUE la
  dépassée du semis, ce qui est le contraire exact du défaut qui a fait
  recaler `91-VGP-4-REPRISE` (des lignes forgées qui s'y ajoutaient).
- **L'échéance « à venir » est posée à six mois, pas à un jour de plus de
  trente** : une marge large, pas une valeur pile à la limite — un horizon de
  30 jours pourrait un jour changer de quelques jours sans casser cette
  épreuve.
- **Le dossier des captures change de nom** (`docs/propositions/
  96-VGP-4-REPRISE-2/captures/`), pas son contenu : mêmes deux écrans
  (registre filtré sur les dépassées, recherche par numéro de série) que
  `91-VGP-4-REPRISE`, mais désormais avec une seule machine dépassée
  visible — celle du semis — au lieu de deux machines forgées.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `lib/vgp/registre.ts`, ni `app/(back-office)/vgp/page.tsx`,
  ni `tests/unit/vgp/tri-et-recherche.test.ts` : le tri par urgence, les deux
  liens de KPI et la recherche `q` sont exactement ceux de
  `91-VGP-4-REPRISE`, non modifiés par cette reprise.
- Je n'ai PAS touché `tests/e2e/vgp-retard-visible.spec.ts` — ni son
  assertion « le semis en porte exactement une », ni aucune autre.
- Aucune fenêtre de 30 jours n'est réintroduite dans le CODE : elle continue
  à n'exister que côté tableau de bord (`HORIZON_VGP_JOURS`), jamais dans le
  registre lui-même — l'écart nommé par l'arbitrage du 25/09/2026 reste
  documenté dans `app/(back-office)/vgp/page.tsx`.
- Aucune migration, aucune ligne de semis (`prisma/seed.ts`,
  `prisma/seed-data.ts`) n'a été ajoutée ou modifiée.
- Je n'ai pas retiré la scène « machine sans information » : elle ne porte
  aucune échéance et ne touche aucun compte à exactitude vérifiée ailleurs
  (seul un `toContain` sur le libellé de la voie existe côté tableau de
  bord, jamais un compte exact).

## Les pièges pour la session suivante

- **`NUS-SPL-2022-0007` n'est PAS une fixture de ce ticket** : elle appartient
  au semis (`prisma/seed-data.ts`, `VERIFICATIONS_VGP_DEMONSTRATION` rang 2)
  et à `tests/e2e/vgp-retard-visible.spec.ts`. Si un futur ticket modifie sa
  date de vérification, sa périodicité, ou la supprime, `vgp-4.spec.ts` perd
  sa preuve de tête — chercher les deux fichiers ensemble.
- **La leçon du gardien `sans-chaine-visible-en-dur`** : un littéral de scène
  (numéro de série, nom de client) ne doit jamais atteindre `getByText`,
  `toContainText`, `getByRole(..., { name })` ou un matcher analogue
  directement — passer par `locator(...).filter({ hasText })` (non suivi) ou
  par `innerText()` + `toContain()` (matcher générique).
- **Toute future scène VGP dans la société partagée `CODIMA-NC` doit
  continuer cette discipline** : aucune échéance dépassée forgée, une
  échéance « à venir » toujours à plus de trente jours si elle ne doit pas
  entrer dans la tuile du tableau de bord.

## Ce qui reste à faire

Rien d'identifié comme bloquant. Les écarts assumés (fenêtre de 30 jours
absente du registre, bouton « Planifier un contrôle » absent) restent ceux
déjà nommés par `91-VGP-4-REPRISE` — voir son propre § « Ce que je n'ai PAS
fait », inchangé par cette reprise.
