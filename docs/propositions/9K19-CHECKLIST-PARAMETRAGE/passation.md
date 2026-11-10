# 9K19-CHECKLIST-PARAMETRAGE — passation

CK3 : l'écran de paramétrage des checklists au bureau. Les trois fonctions du dépôt
minimal posées par 9K08 (`creerModele`, `publierVersion`, `dernierVersionPubliee`
exceptée — voir plus bas) ont enfin un appelant depuis `app/`.

## Les écrans

- **`/parametres/checklists`** — liste des modèles (code, libellé, rattachement
  lisible, « exige une machine », actif/inactif, dernière version publiée) ; un
  volet (`?volet=creer`) pour créer un modèle (code, libellé, nature d'intervention
  facultative, AU PLUS UN rattachement — sous-type en premier/la règle, famille,
  modèle de machine/l'exception — et « exige une machine ») ; un bouton Activer/
  Désactiver par ligne. Même patron que `/parametres/materiel` : volet piloté par
  l'URL, formulaires serveur natifs, aucun JavaScript client pour cette partie.
- **`/parametres/checklists/[id]/version`** — écran PLEIN (pas un volet : l'éditeur
  de points a besoin de place), client component `EditeurVersion` : ajoute/retire
  des lignes de point (section, ordre, libellé, consigne, obligatoire, un des CINQ
  types de réponse, avec les champs qui vont avec chacun — unité/tolérances pour
  une mesure, les choix un par ligne pour `choix_dans_une_liste`). Un seul bouton,
  « Publier » : « Publier une version » (aucune version encore) et « Modifier »
  (l'éditeur prérempli de la dernière version) soumettent le MÊME formulaire vers
  la MÊME route — `publierVersion` crée TOUJOURS la version N+1, jamais une
  réécriture (D235). L'aperçu des versions précédentes est une liste de `<details>`
  natifs, en lecture seule, SANS JavaScript.

Capacité : `parametrer_societe` (ADMS/DIR seuls) — aucune capacité neuve, même
matrice que le reste du paramétrage de société.

## Ce que 9K19 ouvre dans `lib/checklists/depot.ts` (9K08, 9K17A, 9K18)

- **`SaisieModeleChecklist` gagne `sousTypeId`** — la colonne existe depuis 9K17A
  (D238) mais `creerModele` ne l'écrivait jamais, faute d'écran qui la propose.
- **`SaisiePointChecklist` gagne `choix_dans_une_liste` et `texte_libre`** — les
  deux types existent depuis 9K18 (migration et validation terrain), mais l'union
  de `publierVersion` n'avait que les trois premiers : aucun appelant n'avait
  encore besoin des deux autres. `choix` est désormais écrit par `publierVersion`
  (vide pour les quatre autres types, comme avant par le défaut de colonne).
- **`motifModeleChecklist`** (neuf) — traduit un refus de `creerModele` en motif
  nommé (`code_pris`, `sous_type_hors_societe`, `famille_hors_societe`,
  `modele_hors_societe`, `plus_dun_rattachement`, `introuvable`), par le message
  Prisma qui NOMME la contrainte — même technique que `motifModele`/`motifSousType`
  (`lib/materiel/depot.ts`). `creerModele` elle-même n'a pas changé de comportement
  sur refus (elle laisse toujours l'erreur se propager) : c'est la ROUTE qui
  l'attrape et appelle cette fonction — choix délibéré pour ne RIEN changer au
  contrat de `creerModele` que `tests/isolation/checklists.test.ts` (9K08) éprouve
  déjà sur son chemin heureux.
- **`listerLesModelesChecklist`**, **`obtenirModeleChecklist`**,
  **`listerLesVersionsChecklist`**, **`basculerActiviteChecklist`** (neufs) — les
  lectures et l'activation que l'écran avait besoin, absentes jusqu'ici.
- **`dernierVersionPubliee` RESTE exemptée** (`scripts/lib/chemins-de-depot.ts`) :
  l'écran lit `listerLesVersionsChecklist` (toutes les versions, pour l'aperçu ET
  le préremplissage à la fois) plutôt que cette fonction, qui ne rend que la
  dernière.

## Les routes — `app/api/parametres/checklists/**`

- `POST creer` — `creerModele`.
- `POST [id]/publier` — `publierVersion` ; refus traduit en `introuvable` sur
  toute erreur Prisma connue (un identifiant d'une autre société échoue PAR LA
  CLÉ, `checklist_version_societe_id_checklist_modele_id_fkey`).
- `POST [id]/activite` — `basculerActiviteChecklist`, état ENVOYÉ jamais déduit.

Porte `parametrer_societe` d'abord (`exigerCapaciteComplete`), Zod ensuite
(`lib/checklists/saisie.ts` — `schemaModeleChecklist`, `schemaPointChecklist` en
union discriminée sur `typeReponse`, `schemaVersionChecklist` : au moins un point,
au plus deux cents). Les deux schémas rendent EXACTEMENT la forme camelCase des
types du dépôt : aucune traduction de casse entre la route et `lib/checklists/`.
Refus traduits dans l'espace `checklist.parametrage.refus.*` de `lib/i18n/fr.ts`.

**L'exclusivité des trois rattachements n'est vérifiée NI PAR ZOD NI PAR LE
DÉPÔT** — la base la tient par la contrainte CHECK posée VALIDÉE en 9K17A
(`checklist_modele_un_seul_rattachement`) ; la répéter ailleurs l'aurait exposée à
diverger de la base qui la fait vraiment respecter.

## Menu et i18n

Porte `/parametres/checklists` ajoutée à `lib/navigation/portes-parametrage.ts`,
section « Référentiels », capacité `parametrer_societe` (à la différence de
« matériel », dont la LECTURE reste ouverte). Espace `checklist.parametrage.*`
neuf dans `lib/i18n/fr.ts`. Deux reformulations pour tenir le gardien du
vocabulaire fermé (D5/D47, synonyme « matériel ») : « matériel » devient
« machine » dans les trois chaînes qui le nommaient hors du préfixe `materiel.*`
et hors de la liste d'exemptions nommées.

## Épreuves

- **Unitaires** (`tests/unit/checklists/`) : `saisie.test.ts` — les deux schémas
  Zod (bornes, les cinq types de réponse, `choix_dans_une_liste` sans doublon,
  la version d'au moins un point et d'au plus deux cents) ; `motif-modele.test.ts`
  — `motifModeleChecklist` sur les six motifs et les cas non reconnus.
- **Isolation** (`tests/isolation/checklist-parametrage.test.ts`, chemin de
  production réel) : `creerModele` écrit bien `sous_type_id` ; un sous-type d'une
  autre société est refusé par la clé ; `basculerActiviteChecklist` ne touche
  jamais le modèle d'une autre société (zéro ligne) ; `publierVersion` incrémente
  le numéro sans réécrire, les choix d'un point `choix_dans_une_liste` font
  l'aller-retour, une autre société ne peut pas publier sur un modèle qui n'est
  pas le sien ; `listerLesModelesChecklist`/`obtenirModeleChecklist` cloisonnent
  la lecture.
  **Non dupliqué** : l'exclusivité des trois rattachements et le chaînage
  composite sous-type/famille sont déjà éprouvés au niveau SQL par
  `tests/isolation/sous-type-materiel.test.ts` (9K17A) — ce fichier n'éprouve que
  la TRADUCTION de ces refus en motif. Le refus par rôle (ADV/technicien/client
  sans `parametrer_societe`) n'est pas rejoué ici non plus : la matrice de
  `parametrer_societe` est déjà éprouvée génériquement par
  `tests/unit/auth/habilitations.test.ts`, et `tests/unit/auth/porte.test.ts`
  prouve que les trois routes neuves appellent bien `exigerCapaciteComplete`
  avec cette capacité — la combinaison des deux couvre le refus sans le rejouer
  une troisième fois.
- **Bout en bout** (`tests/e2e/9k19-checklist-parametrage.spec.ts`, scène
  préfixée `9K19-`, nettoyée en `afterAll`) : créer un modèle rattaché à une
  famille, publier v1, modifier (publie v2, v1 reste lisible dans l'aperçu),
  désactiver puis réactiver. Captures 1280/375 de la liste et de l'éditeur de
  version, dans `docs/propositions/9K19-CHECKLIST-PARAMETRAGE/captures/`.
- **Gardiens mis à jour** : `scripts/lib/chemins-de-depot.ts` (les exemptions de
  `creerModele`/`publierVersion` se retirent) ; `tests/unit/auth/porte.test.ts`
  (trois routes neuves, compte 108→111) ; `tests/unit/ui/carte-pas-recopiee.test.ts`
  (deux fichiers neufs, catégorie « champ », pour les `<select>`/`<input>`/
  `<textarea>` qui recopient légitimement l'apparence des champs) ;
  `tests/e2e/tous-les-ecrans-rendent.spec.ts` (`/parametres/checklists/[id]/version`
  dans `RESOLVEURS`, `test.skip` — aucun gabarit n'est semé, voir plus bas).

## Ce qui reste dû

CK5 (l'écran terrain — lira `checklistDeLIntervention`, écrira par
`POST /api/terrain/[id]/checklist`, tous deux déjà livrés par 9K18) ; CK7 (le
blocage de « Terminer » sur un point obligatoire manquant — lira
`EtatCompletude.obligatoiresManquants`) ; CK9. **CK4 (le contenu réel des
checklists) reste hors territoire** : décision d'Alexis du 10/11/2026, point 5 —
« le contenu des points attend l'atelier ». Aucun gabarit n'est semé, ni en
démonstration ni en production.

**Aucune migration dans ce ticket** (interdit explicite) : le schéma utilisé
(`checklist_modele.sous_type_id`, `checklist_point.choix`,
`TypeReponseChecklist`) est entièrement posé par 9K17A et 9K18.

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, test, test:isolation, build — tous
verts (voir la session). `verify:full` est laissé à la file de nuit.

## Reprise 9K18B (11/11/2026)

Ce lot avait été recalé (garde `9K19-CHECKLIST-PARAMETRAGE-garde`) pour une cause SANS RAPPORT
avec son propre contenu : `tests/e2e/planning-filtres-aujourdhui.spec.ts:149` attendait
`jour=2026-11-12` et recevait `jour=2026-11-11`, jour du recalage et jour férié (Armistice
1918). Voir `docs/propositions/9K18B-REPRISE-AUJOURDHUI-FERIE/passation.md` pour la cause et le
correctif (`app/(back-office)/planning/page.tsx`). Les quatre commits de ce lot ont été
reportés par `git cherry-pick`, sans modification, sur la branche
`9K18B-REPRISE-AUJOURDHUI-FERIE` ; ce contenu-ci n'a pas changé.
