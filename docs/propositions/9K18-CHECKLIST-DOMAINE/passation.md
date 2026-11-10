# 9K18-CHECKLIST-DOMAINE — passation

Le moteur des checklists : résolution du gabarit (la cascade), complétude, validation des
cinq types de réponse, et les deux fonctions de dépôt qui exposent tout cela au terrain.
**Aucun écran dans ce ticket** — CK3 (paramétrage), CK5 (saisie), CK7 (blocage de
« Terminer ») et CK9 restent dus. Ce document est leur **contrat d'entrée**.

## La migration — JOUÉE PAR ALEXIS

`prisma/migrations/20261110140000_checklist_cinq_types_reponse_9k18` — UNE migration,
neuve. **MIGRATION À JOUER par Alexis : staging puis `pnpm db:deploy`, puis Vercel.**
Décision d'Alexis du 10/11/2026 ~13h10 : « Oui, les 5 types ». Le socle 9K08 (D235) n'en
posait que trois.

- `TypeReponseChecklist` gagne `choix_dans_une_liste` et `texte_libre`.
- `checklist_point.choix` (`text[]`, vide par défaut) — non vide et sans doublon exigé
  pour `choix_dans_une_liste`, vide exigé pour les quatre autres types.
- `checklist_reponse.valeur_choix` / `valeur_texte` — l'exclusivité
  (`checklist_reponse_valeur_unique`, `num_nonnulls`) est **reposée sur les cinq
  colonnes**.

**Deux restrictions PostgreSQL mesurées en l'écrivant, contre une base réelle** (voir
l'en-tête du fichier SQL pour le détail et les commandes qui les ont révélées) :

1. une valeur ajoutée par `ALTER TYPE ... ADD VALUE` ne peut pas être UTILISÉE dans la
   transaction qui l'ajoute — les CHECK comparent donc `"type_reponse"::text` à la
   chaîne, jamais la valeur typée ;
2. une contrainte CHECK ne peut pas contenir de sous-requête — le test de doublon sur
   `choix` passe par une fonction SQL IMMUTABLE neuve, `checklist_choix_sans_doublon`,
   appelée depuis le CHECK.

Les deux tables resserrées (`checklist_point`, `checklist_reponse`) sont déclarées dans
`TABLES_VIDES_AU_RESSERREMENT` (`scripts/lib/resserrements-migration.ts`), avec leur
mesure : leurs seuls écrivains (`publierVersion`, `enregistrerReponses`) naissent sans
appelant ou dans ce même ticket — aucun déploiement antérieur n'a pu y écrire une ligne.

## Les fonctions pures (`lib/checklists/`)

### `resoudreGabarit` — `lib/checklists/cascade.ts`

```ts
function resoudreGabarit(
  contexte: ContexteResolutionGabarit,
  candidats: readonly CandidatGabarit[],
): GabaritResolu | null

type ContexteResolutionGabarit = {
  readonly typeIntervention: TypeIntervention;
  readonly machinePortee: boolean;
  readonly modeleId: string | null;    // le modèle de LA MACHINE portée
  readonly sousTypeId: string | null;  // le sous-type DE CE MODÈLE
  readonly familleId: string | null;   // la famille DE CE MODÈLE
};

type CandidatGabarit = {
  readonly checklistModeleId: string;
  readonly code: string;               // le départage à égalité (D239)
  readonly typeIntervention: TypeIntervention | null;
  readonly modeleId: string | null;
  readonly sousTypeId: string | null;
  readonly familleId: string | null;
  readonly exigeMachine: boolean;
};

type GabaritResolu = {
  readonly checklistModeleId: string;
  readonly provenance: "modele" | "sous_type" | "famille" | "type_seul" | "generique";
};
```

**Fonction pure.** L'appelant (le dépôt) fournit les candidats **déjà filtrés `actif:
true`** de la société — `resoudreGabarit` ne touche aucune base. Cascade : nature
d'intervention (filtre, candidat sans nature = universel) → modèle exact (exception) →
sous-type (règle) → famille → nature seule → générique. `exige_machine` exclut un
candidat avant le classement si `machinePortee` est faux. À égalité de niveau, le `code`
alphabétiquement premier gagne (D239) — jamais l'ordre rendu par la base.

### `etatDeCompletude` — `lib/checklists/completude.ts`

```ts
function etatDeCompletude(
  points: readonly PointPourCompletude[],
  reponses: readonly ReponsePourCompletude[],
): EtatCompletude

type PointPourCompletude = { readonly id: string; readonly libelle: string; readonly obligatoire: boolean };
type ReponsePourCompletude = { readonly checklistPointId: string; readonly nonConforme: boolean };
type EtatCompletude = {
  readonly totalPoints: number;
  readonly pointsRepondus: number;
  readonly nonConformes: number;
  readonly obligatoiresManquants: readonly { readonly id: string; readonly libelle: string }[];
};
```

`nonConforme` est **précalculé par l'appelant** (`valeur_conforme === "non_conforme"`) —
cette fonction ignore les cinq types de réponse. Un NON CONFORME ne bloque JAMAIS
« Terminer » (décision d'Alexis du 29/10/2026 ; D235) : compté, jamais jugé. **CK7**
lira `obligatoiresManquants` pour décider du blocage.

### `validerReponsePoint` — `lib/checklists/validation-reponse.ts`

```ts
function validerReponsePoint(
  point: PointPourValidation,
  valeurBrute: unknown,
): ResultatValidationReponse

type PointPourValidation = { readonly typeReponse: TypeReponseChecklist; readonly choix: readonly string[] };
type ResultatValidationReponse =
  | { readonly valide: true; readonly saisie: SaisieReponsePoint }
  | { readonly valide: false; readonly cle: string };
```

Le **type du point** fait foi — jamais un type auto-déclaré par la valeur brute reçue.
Refus nommés : `checklist.refus.valeur_invalide` (type ou borne), `checklist.refus.
choix_inconnu` (un choix hors de `point.choix`). Les tolérances ne refusent rien (D235,
vides tant que l'atelier ne les fournit pas).

## Le dépôt (`lib/checklists/depot.ts`)

### `checklistDeLIntervention` — une LECTURE, qui ne pin JAMAIS

```ts
function checklistDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<ChecklistDeLIntervention | null>

type ChecklistDeLIntervention =
  | {
      readonly disponible: true;
      readonly checklistVersionId: string;
      readonly points: readonly PointDeChecklist[];
      readonly reponses: readonly ReponseDeChecklist[];
      readonly completude: EtatCompletude;
    }
  | { readonly disponible: false };  // aucun gabarit résolu pour cette intervention
```

`null` = intervention non visible (D35, D50). La version FIGÉE
(`intervention.checklist_version_id`) prime si elle existe ; sinon la cascade résout, et
la DERNIÈRE version publiée du modèle résolu est lue — **sans jamais la poser**. Aucun
contrôle d'affectation ici (même régime que `lireRapportTexte`) : la lecture suit la
visibilité RLS, pas le périmètre par personne.

### `enregistrerReponses` — écrit une DIFFÉRENCE, jamais l'ensemble

```ts
function enregistrerReponses(
  contexte: ContexteSession,
  interventionId: string,
  difference: readonly SaisieDifferenceReponse[],
  client?: PrismaClient,
): Promise<EcritureReponses | null>

type SaisieDifferenceReponse = { readonly checklistPointId: string; readonly valeur: unknown };
type EcritureReponses =
  | { readonly id: string }
  | { readonly refuse: true; readonly cle: string };
```

`null` = intervention non visible OU technicien non affecté (même refus, D35/D50).
Refus nommés : `intervention.refus.annulee_figee` / `cloturee_figee` (estFige, même
borne que le rapport terrain) ; `checklist.refus.aucun_gabarit` (rien ne se résout) ;
`checklist.refus.point_hors_version` (un point de `difference` n'appartient pas à la
version EN VIGUEUR) ; ou le `cle` rendu par `validerReponsePoint`.

**TOUT ou RIEN** (I6) : chaque entrée de `difference` est validée contre la version en
vigueur AVANT qu'aucune ligne ne soit écrite.

**LE PIN (D235)** — si `checklist_version_id` est `null`, la cascade résout et la
version qui en résulte est posée, **conditionnée** sur `checklist_version_id IS NULL`
(même patron que la transition `terminerIntervention`) : deux téléphones qui résolvent
en même temps ne pinnent qu'une fois, le PREMIER gagne, le second relit ce qui vient
d'être posé et valide CONTRE CETTE version.

**Une réponse écrite remet `rapport_valide_par`/`rapport_valide_le` à `NULL`** (RG-INT-
03, D135) — même règle que `enregistrerRapportTexte`. `repondu_le` n'est **jamais**
réécrite par ce dépôt (aucune lecture de l'heure système hors `lib/calendar`, L0-08) :
une correction reste tracée par le déclencheur `journal_audit_tracer` (I8), pas par une
colonne applicative.

## La route — `app/api/terrain/[id]/checklist/route.ts`

`POST` seul. Même porte que `rapport`/`signature` (`saisir_rapport`, périmètre
restreint). Corps : `FormData`, champ `reponses` = JSON `Array<{ checklist_point_id:
uuid, valeur: unknown }>` (max 200), même patron que `pieces_remplacees` sur la route
`rapport`. Réponse : `303` vers `/terrain/{id}` (formulaire natif) ou `{ ok, motif }` en
JSON (en-tête `Accept: application/json`) — jamais un autre code HTTP, succès ou refus
confondus au niveau transport.

`porte.test.ts` : 108 routes (`saisir_rapport`). `chemins-de-depot.ts` :
`checklistDeLIntervention` est dans `FONCTIONS_SANS_CHEMIN` (aucun écran de lecture dans
ce ticket) ; `lib/checklists` est sorti de `MODULES_SANS_CHEMIN` (`enregistrerReponses`
a désormais un chemin).

## Arbitrage — D239

`docs/arbitrages.md` — à égalité de niveau dans la cascade, le code du modèle de
checklist tranche, par ordre alphabétique. Portée : `lib/checklists/cascade.ts`.

## Épreuves

- **Unitaires** (`tests/unit/checklists/`) : cascade (les cinq niveaux, le filtre par
  nature indépendant du niveau matériel, un candidat universel, `exige_machine`,
  l'égalité par le code — rejouée à l'ordre inverse) ; complétude ; validation des cinq
  types (le type du point fait foi, `choix_inconnu`, les bornes).
- **Isolation, schéma** (`tests/isolation/checklists.test.ts`) : le point
  `choix_dans_une_liste` sans choix refusé, avec doublon refusé, un autre type avec des
  choix refusé — chacune avec son JUMEAU ; l'exclusivité à cinq colonnes (deux valeurs,
  zéro valeur, une seule) et la borne de `valeur_texte`, chacune avec son jumeau.
- **Isolation, dépôt** (`tests/isolation/checklist-domaine.test.ts`, sur le chemin de
  production réel, chaque scène sur sa PROPRE intervention jetable) : société B ne lit
  ni n'écrit les réponses de A ; le pin à la première réponse acceptée, jamais avant ;
  `point_hors_version` et rien n'est écrit sur un refus ; la remise à zéro de la
  validation ; un technicien non affecté refusé ; une intervention figée refuse
  nommément ; la cascade de bout en bout au niveau famille.
  **Non dupliqué** : « un compte portail ne lit aucun gabarit mais lit les réponses de
  SON intervention » est déjà prouvé à la racine (RLS) par
  `tests/isolation/checklists.test.ts` (socle 9K08) — mes deux fonctions de dépôt tournent
  sous la MÊME politique, donc la même preuve s'applique sans qu'il soit utile de la
  rejouer une seconde fois au travers du dépôt.
- **Rejeu sur base âgée** (`tests/isolation/migrations-sur-base-agee.test.ts`) :
  `checklist_point` et `checklist_reponse` déclarées dans
  `TABLES_VIDES_AU_RESSERREMENT`, avec leur mesure.
- **Aucune e2e** : aucun écran dans ce ticket.

## Ce qui reste dû

CK3 (paramétrage des modèles de checklist, écran back-office) ; CK5 (l'écran terrain —
lira `checklistDeLIntervention`, écrira par `POST /api/terrain/[id]/checklist`) ; CK7
(le blocage de « Terminer » sur un point obligatoire manquant — lira
`EtatCompletude.obligatoiresManquants`, amendera `peutTerminer`,
`lib/interventions/cycle-de-vie.ts`, hors territoire ici) ; CK9. Aucun gabarit n'est
semé, en production ni en démonstration — le contenu réel attend l'atelier (décision
d'Alexis du 10/11/2026, point 5).

## Vérification

`CI=1 pnpm verify` : format, typecheck, lint, test (5639 passés), test:isolation (2123
passés), build. `verify:full` est laissé à la file de nuit.
