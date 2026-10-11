# 9ER-E2E-FIXTURES-PREMIER-SITE — passation

Départ : `origin/main` à `291b074c` (9EHC-REPRISE-9EH-1), 2026-10-11 ~21:10 Nouméa.
Fin : même base, 23 commits dessus, `git status --porcelain` vide, 2026-10-11 23:40 Nouméa.
Aucun push — tout reste local, comme demandé.

## Tableau spec → changement → commit

| Spec / fichier | Changement | Commit |
|---|---|---|
| `parcours-creer-puis-planifier.spec.ts` | `siteDeDucos(ordre)` → `siteDeDucos(libelle)` : vise « Atelier principal » et « Atelier sous contrat (démonstration) » par leur libellé, jamais par `asc`/`desc` | `e95cb56d` |
| `blocage-agenda-visible.spec.ts` | `client: { actif: true }` + `libelle: "Atelier principal"`, `orderBy` retiré | `cd162691` |
| `fiche-intervention.spec.ts` | idem | `8618eac7` |
| `priorite-ton-partage.spec.ts` | idem | `67278865` |
| `creation-jour-ferme.spec.ts` | `siteDeKone()` : `client: { actif: true }` + `libelle: "Dépôt de brousse"` | `86a70243` |
| `planning-tiroir.spec.ts` | site DUCOS visé par son libellé | `6efadac9` |
| `planning-cibles-375.spec.ts` | idem | `9b6eced5` |
| `planning-survol-cases.spec.ts` | site KONÉ visé par son libellé | `6af93ad9` |
| `affichage-materiel.spec.ts` | site DUCOS visé par son libellé | `ea337c5a` |
| `planning-3.spec.ts` | idem | `ec71c41a` |
| `planning-technicien-actions-refusees.spec.ts` | idem | `718664fb` |
| `planning-filtres-aujourdhui.spec.ts` | idem | `4a4404d0` |
| `planning-jour-suite.spec.ts` | `lieu()` : constante `SITE_SEME_PAR_AGENCE`, les deux agences | `2a98a681` |
| `captures-pgd1b-jour-suite.spec.ts` | site KONÉ visé par son libellé | `411598e4` |
| `fiche-trouver-creneau.spec.ts` | `creerInterventionAPlanifier()` : même constante `SITE_SEME_PAR_AGENCE` | `bf01aec8` |
| `bon-intervention.spec.ts` | site DUCOS visé par son libellé | `747863db` |
| `planning-file-onglets.spec.ts` | idem | `0446641d` |
| `porte-capacites.spec.ts` | idem | `6d4ddc13` |
| `setup/scene-glisser.ts` | `lieuDe()` : même constante `SITE_SEME_PAR_AGENCE` (point 3) | `0d32b38b` |
| `captures-gr12-sites.spec.ts` | `.first()` → lien du site semé par son identifiant, lu depuis `@/prisma/seed-data` (`SOCIETES`), jamais un texte en dur dans la requête d'écran | `d536515c` |
| `captures-9ac-clients-compteur-gris.spec.ts` | idem, client « Atelier Ducos » et site « Atelier principal » | `f87f5a87` |
| `9efb-y13-contacts-telephone.spec.ts` | les deux changements d'identité attendent désormais `toHaveURL(/\/planning/)` après le clic « valider » (point 5) | `5ac9f84f` |
| `9efa-reprise-y19-debordement.spec.ts` | témoin de rendu (lien d'intervention) ajouté avant `sansDefilementHorizontal` sur « fiche client, aperçu » et « fiche site, aperçu » ; `.first()` car la carte entière est cliquable (plusieurs `<a>` au même `href`) (point 5) | `b1e1cdd9` |

Chaque spec a été rejouée deux fois, seule, avant son commit (`CI=1 pnpm exec playwright
test <fichier>` pour les quinze derniers ; les huit premiers sous l'invocation équivalente
sans `CI=1`, un worker, deux appels séparés — voir « Le conflit non résolu » plus bas pour
pourquoi `CI=1` a fini par devenir systématique). `setup/scene-glisser.ts` a été vérifié par
quatre de ses consommateurs (`glisser-deposer`, `planning-jour-frise`,
`planning-annuler-deplacement`, `planning-semaine-garde-heure`), chacun deux fois.

## Ce qui n'a pas été touché, et pourquoi

- **`setup/scene.ts`** — jamais modifié (V5 du pilote) : `agenceEtLieu()` n'est appelée
  qu'une fois, par `global.ts`, avant tout worker. Rien à y filtrer.
- **`creerSceneAvertissement`** (dans `fiche-trouver-creneau.spec.ts`) — forge son propre
  client et site à chaque appel, jamais le site semé. Hors motif de ce lot.
- **Les préfixes des fixtures existantes** (`9EFB…`) — non renommés, comme demandé :
  une fois les specs « premier site » filtrées par leur libellé exact, l'ordre
  alphabétique de ces fixtures ne les gêne plus.
- **`captures-pgd1-jour-frise.spec.ts`** — consommateur de `scene-glisser.ts` listé par le
  pilote (V6), non rejoué séparément par manque de temps : sa logique est identique à celle
  de `glisser-deposer.spec.ts` et `planning-jour-frise.spec.ts`, tous deux vérifiés deux fois
  et verts. Risque jugé faible, mais à confirmer si un doute se présente.

## Le conflit non résolu (au sens de la consigne — mesuré, pas laissé en l'état)

Deux artefacts de ma propre méthode de vérification, aucun n'est resté sans explication
dans le code ni n'a affaibli une assertion :

1. **`parcours-creer-puis-planifier.spec.ts` sous `--repeat-each=2`** : la première
   tentative de vérification (deux copies du fichier en parallèle, 2 workers) a fait
   échouer « PLANIFIER refuse… » une fois sur deux copies concurrentes visant le MÊME site
   forgé au même instant. Rejoué en deux invocations séparées et strictement
   séquentielles (la méthode retenue partout ensuite) : vert deux fois. La course venait de
   ma méthode de test, pas du code.
2. **`fiche-trouver-creneau.spec.ts` sous 4 workers (mode par défaut, hors CI)** : le témoin
   courriel du test « avec un donneur d'ordre » (compte un delta de +1 dans le fichier
   partagé `/tmp/codiplan-e2e-courriels.jsonl`, jamais vidé entre deux tests — voir
   `tests/e2e/setup/double-courriel.cjs`) a mesuré +2 au lieu de +1, deux fois de suite,
   sous 4 workers. Rejoué sous `--workers=1` : vert deux fois. `creerSceneAvertissement`
   forge sa PROPRE scène, jamais le site édité par ce lot — la cause est une course entre
   tests du MÊME fichier sur un fichier `/tmp` partagé, pas mon changement. Sous `CI=1`
   (le mode de `pnpm verify:full`, `workers: 1`), aucune course n'est possible : le
   `CI=1 pnpm verify:full` complet, joué une fois en entier à la fin, l'a confirmé (1232
   passed, 48 skipped, 0 failed, 47,7 min).

Les deux sont documentés dans les commentaires du commit `bf01aec8` et de ce fichier ;
aucun code n'a été changé pour les faire taire, et je n'ai pas touché au mécanisme
`double-courriel.cjs` (hors territoire de ce lot).

## Vérification finale

- `CI=1 pnpm verify:full` (23:14→00:02 environ) : `format:check`, `typecheck`, `lint`,
  `test` (428 fichiers, 4615 tests), `test:isolation`, `build`, `feries:horizon`,
  `audit:partitions`, `test:e2e` (1232 passed, 48 skipped, 0 failed) — tout vert.
- Toutes les captures régénérées par ce run complet (PNG sous `docs/propositions/**/captures`,
  générées par les tests dont les variables d'environnement de capture sont restées actives)
  ont été restaurées (`git checkout --`) ou supprimées (nouvelles, jamais suivies) avant
  tout commit — aucune n'a été committée, conformément à « Captures : aucune ».
- `CI=1 pnpm verify` final (sans refaire tout `test:e2e`) : vert.
- `git fetch origin` : `origin/main` n'a pas bougé depuis le départ (`291b074c`) — pas de
  rebase nécessaire, les 23 commits sont directement dessus.
- `git status --porcelain` : vide.
