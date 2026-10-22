# La numérotation annuelle — une colonne `annee`, pas un numéro qui l'encode

_Ticket 9H2-NUMEROTATION-INTERVENTIONS, 23 octobre 2026. Décision d'Alexis du
21/10/2026 (D135) : un vrai numéro, attribué par le serveur à la création,
avant l'usage réel. Audit du 21/10 (`docs/audits/9F6/`)._

## 1. Contexte

`intervention.numero` et `demande.numero` existaient déjà (`Int?`,
`@@unique([societe_id, numero])`), NULS, en attendant une attribution que
personne n'écrivait. D135 tranche : la numérotation **repart à 1 chaque année
civile**, ce que l'unicité existante ne permet pas — une société qui pose le
numéro 1 en 2026 ne peut plus poser le numéro 1 en 2027 tant que l'une des
deux lignes garde le même `numero`. Le ticket pose le choix et demande qu'il
soit écrit : encoder l'année DANS `numero`, ou lui donner sa propre colonne.

## 2. Options écartées

| Option | Pourquoi elle est écartée |
|---|---|
| **Encoder l'année dans `numero`** (ex. `20260452` pour INT-2026-0452, `@@unique([societe_id, numero])` inchangé) | Casse la recherche par le SEUL numéro. Le registre et la recherche globale (`numeroDeReference`, `lib/interventions/depot.ts`) comparent `numero` par ÉGALITÉ — jamais par `contains` — et le stack imposé interdit le SQL brut (donc le modulo) hors migrations et politiques RLS (CLAUDE.md §2). Une recherche sur « 452 » n'aurait alors trouvé AUCUNE ligne, alors que le ticket l'exige explicitement (« la recherche globale trouve INT-2026-0452 et 452 ») et que c'est la moitié que les utilisateurs tapent en premier (mesure du 18/09/2026, doc-tête de `schemaRechercheInterventions`). |
| **Une TABLE à part (`intervention_numerotation`), une ligne par (intervention, année, numéro)** | Une intervention n'a qu'UN numéro, jamais plusieurs au fil du temps — contrairement à `intervention_machine` (plusieurs machines par visite) ou `segment_travail` (plusieurs segments), aucune historisation n'est demandée ici. Une table à part porterait une relation 1-à-1 qu'une paire de colonnes nullables porte déjà, pour le prix d'une jointure à chaque lecture de la référence. |

## 3. Choix retenu

Une colonne `annee` (`Int?`), posée À CÔTÉ de `numero` sur `Intervention` et
sur `Demande` (voir `prisma/schema.prisma` et la migration
`20261023073000_numerotation_interventions_demandes_9h2`) :

- posée EN MÊME TEMPS que `numero`, jamais recalculée après coup — même
  famille que `depose_le`/`compteur_accuse_le` sur `Demande` (D85) ;
- l'année CIVILE retenue est celle de la création, au fuseau de Nouméa
  (jamais UTC, §1) — `lib/interventions/numerotation.ts`,
  `anneeDeNumerotation()` ;
- `@@unique([societe_id, numero])` devient `@@unique([societe_id, annee,
  numero])` sur les deux tables : c'est la paire qui distingue deux lignes
  d'années différentes portant le même `numero`, pas `numero` seul.

**Ce que cette forme préserve, et c'est le motif du choix** : `numero` reste
PETIT (une séquence par année, jamais un nombre à huit chiffres) et reste
cherchable SEUL par égalité, exactement comme avant ce lot — une recherche
sur « 452 » retrouve la ligne quelle que soit son année ; une recherche sur
la référence COMPLÈTE « INT-2026-0452 » borne les DEUX colonnes, pour qu'un
numéro de 2026 ne ramène jamais la ligne homonyme de 2027.

## 4. Le compteur

`compteur_numerotation` (une ligne par société, nature — `intervention` ou
`demande` —, année) porte `dernier_numero`, incrémenté ATOMIQUEMENT
(`UPDATE … SET dernier_numero = dernier_numero + 1`) dans la MÊME transaction
que la création qui consomme le numéro rendu
(`lib/interventions/numerotation.ts`, `prochainNumero`). Le premier appel de
l'année crée la ligne (`P2025` rattrapé par un `create`) ; une course sur ce
premier appel se résout par un `P2002` qui rejoue l'appel, qui retombe alors
sur le chemin `update` normal. Jamais de `MAX(numero) + 1` : deux lectures du
même maximum avant écriture poseraient le même numéro sous concurrence —
c'est précisément ce que ce ticket demande d'éprouver (20 créations
concurrentes → 20 numéros distincts consécutifs).

Forme de politique RLS GÉNÉRALE (D42, société seule) plutôt qu'« interne »
(D94) : un compte de portail qui dépose une demande (P5) doit pouvoir faire
avancer CE compteur dans la même transaction que son dépôt, alors même qu'il
porte `app.client_id` — la forme « interne » l'aurait exclu.

## 5. Le rattrapage

Les lignes déjà posées (toutes, aujourd'hui, `numero IS NULL`) sont
numérotées dans l'ORDRE DE CRÉATION (`cree_le`, puis `id` à égalité), PAR
SOCIÉTÉ ET PAR ANNÉE — l'année retenue est celle de `cree_le`, au fuseau de
Nouméa. Le compteur de chaque (société, nature, année) est ensuite semé au
rang maximal que ce rattrapage a posé, pour que la PROCHAINE création ne
rejoue jamais un numéro qu'il vient d'attribuer.
