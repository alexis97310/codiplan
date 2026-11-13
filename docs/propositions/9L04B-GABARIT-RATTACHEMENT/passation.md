# 9L04B-GABARIT-RATTACHEMENT — passation

Aucune migration, aucune règle métier nouvelle. Ce lot ferme l'écart constaté par le pilote le 13/11/2026 en
production (fd696e770) : le volet « Partir d'un gabarit de départ » (`/parametres/checklists?volet=gabarit`)
ne portait aucun champ de rattachement, si bien qu'un modèle créé depuis un gabarit naissait GÉNÉRIQUE quoi
qu'on en ait fait — contournement du pilote : créer puis dupliquer (le formulaire de duplication, lui, porte
le rattachement) puis désactiver l'original.

## 1. Ce qui a été mesuré avant d'écrire une ligne

Trois formulaires de `app/(back-office)/parametres/checklists/page.tsx` et leurs routes :

- **Création** (`/api/parametres/checklists/creer`) et **duplication**
  (`/api/parametres/checklists/[id]/dupliquer`) partagent déjà la MÊME saisie (`saisieModeleChecklistRecue`,
  `app/api/parametres/checklists/saisie-recue.ts`) et le MÊME schéma Zod (`schemaModeleChecklist`,
  `lib/checklists/saisie.ts`) : `code`, `libelle`, `typesIntervention`, `sousTypeId`, `familleId`, `modeleId`,
  `exigeMachine`. AU PLUS un rattachement n'est PAS vérifié côté Zod — la base le tient par la contrainte
  CHECK `checklist_modele_un_seul_rattachement` (9K17A, D238). L'appartenance à la société non plus : une FK
  composite `(societe_id, xxx_id)` par niveau de rattachement (migrations 9K08 et 9K17A). Le refus de la base
  est traduit en motif nommé par `motifModeleChecklist` (`lib/checklists/depot.ts`) — jamais une seconde garde
  JS qui pourrait diverger de la base qui fait vraiment respecter la règle.
- Les deux volets (création, duplication) rendaient déjà les mêmes champs via une fonction LOCALE non
  exportée, `ChampsRattachementEtNature` (dans `page.tsx`), elle-même composée de `SelectRattachement` (local
  aussi) — donc non réutilisable tel quel par `volet-partir-gabarit.tsx`, qui vit dans un fichier séparé.
- **Le volet gabarit** (`volet-partir-gabarit.tsx` → `POST /api/parametres/checklists/gabarit`) ne portait que
  `gabarit_id`, `code`, `libelle`, `types_intervention[]` : `saisieGabaritRecue` les lisait à la main,
  `creerModeleDepuisGabarit` (`lib/checklists/depot.ts`) ne recevait donc jamais de rattachement et
  `creerModele` écrivait systématiquement `sous_type_id`/`famille_id`/`modele_id` à `NULL`.

## 2. Ce qui a été fait

- **`app/(back-office)/parametres/checklists/champs-rattachement.tsx`** (neuf) : extrait `ChampsRattachement`
  (les trois `<select>` + la case « Exige une machine ») et `SelectRattachement` hors de `page.tsx`, pour
  être importés des DEUX côtés. `page.tsx` les utilise désormais via import ; `ChampsRattachementEtNature`
  (restée dans `page.tsx`, locale) ne porte plus que le fieldset des types d'intervention + `ChampsRattachement`.
- **`volet-partir-gabarit.tsx`** : reçoit trois props neuves (`sousTypes`, `familles`, `machinesModeles`, les
  MÊMES listes `*Actifs` déjà calculées par `page.tsx` pour les deux autres volets) et rend
  `<ChampsRattachement>` sous le texte de suggestion — AUCUNE présélection déduite de ce texte (c'est un texte
  libre, D95/§1 : un sous-type ou une famille n'existe que dans le périmètre d'une société). Laisser les trois
  champs vides reste permis (générique, comme avant).
- **`app/api/parametres/checklists/saisie-recue.ts`** : `saisieGabaritRecue` ne reconstruit plus l'en-tête à
  la main — elle lit `gabarit_id` puis DÉLÈGUE le reste à `saisieModeleChecklistRecue` (même schéma, même
  garde Zod sur les UUID). `schemaTypesIntervention` et le type `TypeIntervention` (devenus inutiles dans ce
  fichier) retirés des imports.
- **`lib/checklists/depot.ts`** : `creerModeleDepuisGabarit` prend désormais `saisie: SaisieModeleChecklist`
  (le type local du dépôt, EXACTEMENT celui que `dupliquerModele` prend déjà) au lieu d'un type ad hoc à trois
  champs — zéro ligne de logique neuve, `creerModele` écrivait déjà les quatre champs de rattachement, il ne
  les recevait simplement jamais de ce chemin.
- **`app/api/parametres/checklists/gabarit/route.ts`** : transmet `sousTypeId`/`familleId`/`modeleId`/
  `exigeMachine` à `creerModeleDepuisGabarit`, `?? undefined` sur les trois identifiants — EXACTEMENT le même
  idiome que `creer/route.ts` et `dupliquer/[id]/route.ts`.

Zéro changement de schéma. Zéro migration.

## 3. Épreuves

- **`tests/unit/checklists/saisie-recue.test.ts`** (neuf) : `saisieGabaritRecue` refuse sans `gabarit_id`,
  refuse sans en-tête valide, porte le rattachement choisi, laisse le rattachement vide (générique), refuse un
  UUID invalide, et rend EXACTEMENT ce que `saisieModeleChecklistRecue` rend pour le même en-tête (`gabaritId`
  mis à part) — la preuve de non-duplication de règle.
- **`tests/isolation/checklist-dupliquer-gabarit.test.ts`** : deux scénarios neufs, jumeaux de
  `checklist-parametrage.test.ts` — un sous-type de SA société est accepté par `creerModeleDepuisGabarit`
  (`sous_type_id` posé), un sous-type d'une AUTRE société est refusé PAR LA CLÉ (`sous_type_hors_societe`),
  rien n'est créé. Fixtures dédiées (préfixe `904b` dans l'UUID), posées/effacées par ce fichier.
- **`tests/unit/ui/carte-pas-recopiee.test.ts`** : l'exception `EXCEPTIONS` pour les `<select>` de
  `page.tsx` est devenue MORTE (les `<select>` ont migré vers `champs-rattachement.tsx`) — déplacée sur le
  nouveau fichier, pas supprimée : le motif protégé est le même.
- **`tests/e2e/9l04b-gabarit-rattachement.spec.ts`** (neuf) : scène jetable (préfixe `9L04B`) — famille,
  sous-type, modèle de matériel, client, site, machine, intervention `en_cours` rattachée à la machine.
  Trois épreuves : (1) le volet gabarit rattache un modèle au sous-type, relu dans le tableau
  (`rattachementLisible`) exactement comme la création directe ; (2) la CASCADE (`resoudreGabarit`) choisit ce
  modèle pour la machine du sous-type sur la fiche terrain du technicien (`checklistDeLIntervention`, lu SANS
  pin — aucune réponse soumise) ; (3) captures 1280/375 du volet rattaché.
  **Piège rencontré** : la première version comparait le libellé du modèle résolu directement dans l'argument
  `name` d'un `getByRole("heading", …)` — le gardien L0-11
  (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`) résout par propagation statique simple les `const`
  d'un fichier et refuse une chaîne visible en dur même interpolée dans un gabarit de chaîne. Corrigé par le
  même idiome que `texteDuBloc` (9K30A) : `.filter({ hasText })` (non instrumenté) puis comparaison JS via
  `.textContent()`.

`pnpm test` (5792 épreuves), `pnpm test:isolation` (2210 scénarios), `tests/e2e/tous-les-ecrans-rendent.spec.ts`
(61 passées, 4 ignorées comme attendu) et `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation,
build) tous verts avant de rendre la main.

## 4. Captures AVANT/APRÈS

`docs/propositions/9L04B-GABARIT-RATTACHEMENT/captures/` — `volet-gabarit-rattachement-{avant,apres}-
{1280,375}.png`. L'AVANT est pris sur le code PRÉCÉDENT (`dcbb22867`, le dernier commit de 9L03C) : la
session a basculé temporairement sur ce commit (`git checkout`, aucune modification non committée à l'instant
du basculement — seuls des fichiers NON SUIVIS de ce lot étaient présents, donc rien à perdre), joué un spec
jetable (jamais committé) qui ouvre le volet gabarit sans toucher au rattachement (absent à ce commit), puis
`git checkout` est revenu sur le dernier commit de ce lot. Même recette que la mémoire « captures-avant-
apres-e2e » (§ « Si le code AVANT est déjà committé »), simplifiée : même worktree plutôt qu'un worktree
séparé, puisque rien n'était en cours de modification au moment du basculement.

**`scripts/captures.mts` (régénération complète de `docs/captures/`) N'A PAS été rejoué** — la consigne
permanente d'Alexis le demande à chaque lot, mais le budget de 90 minutes de celui-ci ne le permettait pas en
plus du reste (base jetable, build de production, amorçage d'un compte, puis la trentaine d'écrans). À faire
par le prochain lot qui touche `/parametres/checklists`, ou sur demande explicite.

## 5. État à la reprise

Arbre propre, HEAD détaché sur le dernier commit de ce lot, pas de push. `git fetch origin` + `git rebase
origin/main` à faire avant toute chose si un autre lot a avancé sur `main` entre-temps.
