import { t } from "@/lib/i18n/fr";
import { mot } from "@/lib/i18n/vocabulaire";

/**
 * L'ÉCRAN « PARC » DIT CE QUE LA MAQUETTE DIT, moins les écarts nommés
 * (AT-04).
 *
 * ## Ce que ce fichier corrige
 *
 * *« Il lui manque trois colonnes : compteur, contrat, statut »*, disait le
 * ticket — et c'était vrai à moitié. **Mesuré plutôt que présumé** : `statut`
 * est une vraie colonne de `machine` (`StatutMachine`), déjà lue par cet
 * écran depuis R2-21 ; elle reste. `numero_serie` porte le compte du
 * compteur d'ancienneté d'une machine, pas ses relevés d'usage — et
 * `lib/compteurs/regression.ts` le confirme : il opère sur des `Releve[]`
 * reçus en mémoire, sans aucun dépôt qui les persiste (lot 3). Aucune table
 * `contrat` n'existe davantage (lot 4). *Ajouter ces deux colonnes afficherait
 * une case vide ou un zéro — exactement la faute que le directeur
 * d'exploitation reprochait au numéro de série fabriqué affiché comme une
 * valeur : une absence doit se LIRE comme une absence* (doctrine §3).
 *
 * ## Pourquoi une liste À PART de `ECARTS_MAQUETTE` (navigation)
 *
 * `lib/navigation/entrees.ts` porte déjà un écart nommé — « Fiche machine » —
 * et le même mécanisme (une liste close, un libellé adossé à la maquette, un
 * motif). **Ce fichier ne l'étend pas, il lui pose une sœur**, et la raison
 * est la POPULATION, pas la commodité : un écart de navigation désigne un
 * `<button>` de `.nav`, un écart de colonne désigne un `<th>` du tableau du
 * parc, un écart de KPI un `<div class="l">` de son bandeau — trois formes de
 * DOM que rien ne relie. Mélanger les trois dans une même liste laisserait un
 * libellé de bouton excuser une colonne homonyme, ou l'inverse : le jour où
 * la barre gagnerait un bouton « Contrat », il se ferait passer pour couvert
 * par l'écart de colonne du même nom. *Trois populations, trois listes*, et
 * chacune s'adosse à la portion de la maquette qui est la sienne.
 *
 * ## L'ÉCART SE DÉSIGNE PAR SON LIBELLÉ, exactement comme D98 l'a décidé
 *
 * Un libellé plutôt qu'une clé : la clé disparaît avec l'entrée, le libellé
 * reste dans le document — c'est ce qui rend l'écart ADOSSÉ, vérifié par
 * `tests/unit/machines/ecarts-maquette.test.ts` de la même façon que
 * `tests/unit/navigation/entrees.test.ts` le fait pour la barre.
 */

export type EcartMaquette = {
  readonly libelle: string;
  readonly motif: string;
};

/**
 * LES DEUX COLONNES ABSENTES DU TABLEAU DU PARC — liste close.
 */
export const ECARTS_MAQUETTE_COLONNES_PARC: readonly EcartMaquette[] = [
  {
    libelle: "Compteur",
    motif:
      "lot 3 — aucun relevé de compteur n'est persisté (lib/compteurs/regression.ts " +
      "n'opère que sur des relevés reçus en mémoire, sans dépôt qui les écrive)",
  },
  {
    libelle: "Contrat",
    motif: "lot 4 — aucune table de contrat de maintenance n'existe encore",
  },
];

/**
 * LES SIX COLONNES RÉELLES, dans l'ordre de la maquette moins les écarts —
 * qui se trouve être l'ordre déjà en place : les deux colonnes absentes
 * occupaient les positions 6 et 7 sur huit, immédiatement avant « Statut ».
 *
 * `id` sert de clé React et n'est PAS un fait de la maquette ; `largeur` non
 * plus — elle ne fixe aucune largeur de colonne — mais une mesure d'écran
 * déjà en place, reprise sans y toucher.
 *
 * **`libelle` est une FONCTION, jamais une clé nue**, à cause de la quatrième
 * colonne : la maquette l'écrit « Client / Site », et « Site » est un mot
 * IMPOSÉ (D5, D47) qui ne s'écrit dans AUCUNE entrée du dictionnaire hors de
 * `vocabulaire.*` — `tests/unit/i18n/vocabulaire-impose.test.ts` le refuse. Il
 * se compose donc ici, depuis `mot("site")`, à l'endroit unique que la page et
 * le gardien lisent tous deux.
 */
export const COLONNES_PARC: ReadonlyArray<{
  readonly id: string;
  readonly libelle: () => string;
  readonly largeur?: string;
}> = [
  {
    id: "reference",
    libelle: () => t("parc.colonne_reference"),
    largeur: "150px",
  },
  { id: "modele", libelle: () => t("parc.colonne_modele") },
  {
    id: "serie",
    libelle: () => t("parc.colonne_serie"),
    largeur: "180px",
  },
  {
    id: "lieu",
    libelle: () => `${t("parc.colonne_lieu_prefixe")} / ${mot("site")}`,
  },
  {
    id: "mise_en_service",
    libelle: () => t("parc.colonne_mise_en_service"),
    largeur: "140px",
  },
  {
    id: "statut",
    libelle: () => t("parc.colonne_statut"),
    largeur: "140px",
  },
];

/**
 * LE KPI ABSENT DU BANDEAU DU PARC — liste close, une entrée.
 *
 * *Trois des quatre KPI de la maquette sont réels* : « Machines actives » et
 * « En panne / arrêtées » se lisent sur `machine.statut`, « Garantie expirant
 * à moins de 90 jours » sur `machine.garantie_fin` — une vraie colonne, sans
 * rapport avec la table `contrat` qui n'existe pas. Seul « Sous contrat »
 * dépend de cette table absente.
 */
export const ECARTS_MAQUETTE_KPI_PARC: readonly EcartMaquette[] = [
  {
    libelle: "Sous contrat",
    motif:
      "lot 4 — même cause que la colonne « Contrat » : aucune table de contrat " +
      "de maintenance n'existe encore",
  },
];

/**
 * Les trois clés de KPI réelles — un type À PART de `CleTraduction`, pour que
 * `valeurDuKpi` (`app/(back-office)/parc/page.tsx`) puisse être jugé EXHAUSTIF
 * par le compilateur : sur `CleTraduction` seul, un `switch` à trois branches
 * ne prouverait rien, la clé pouvant en théorie être n'importe laquelle des
 * centaines du dictionnaire.
 */
export type CleKpiParc =
  "parc.kpi_actives" | "parc.kpi_garantie" | "parc.kpi_en_panne";

/**
 * LES TROIS KPI RÉELS, dans l'ordre de la maquette moins l'écart — « Sous
 * contrat » occupait la deuxième des quatre positions.
 *
 * `ton` suit exactement la variante de `.kpi` que la maquette pose à cette
 * position — `.kpi` nu vaut bleu, `.kpi.o` orange, `.kpi.r` rouge — jamais une
 * préférence : la position de « Sous contrat » disparaît avec lui, et
 * « Garantie… » hérite de la variante `.o` qui lui était déjà propre à la
 * troisième place.
 */
export const KPI_PARC: ReadonlyArray<{
  readonly cle: CleKpiParc;
  readonly ton?: "orange" | "rouge";
}> = [
  { cle: "parc.kpi_actives" },
  { cle: "parc.kpi_garantie", ton: "orange" },
  { cle: "parc.kpi_en_panne", ton: "rouge" },
];
