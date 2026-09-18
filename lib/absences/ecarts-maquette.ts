/**
 * LES ÉCARTS NOMMÉS DE `/absences` FACE À `absences()` (D125, D128, lot A4).
 *
 * Même geste que `lib/machines/ecarts-maquette.ts` pour `/parc` (N-10) :
 * chaque entrée est un bloc que `absences()` dessine et que ce dépôt ne
 * construit pas à l'identique, avec le fait mesuré qui l'explique — jamais un
 * bloc oublié en silence.
 */

export type EcartMaquette = {
  readonly libelle: string;
  readonly motif: string;
};

/**
 * L'ACTION D'EN-TÊTE QUE `/absences` NE REND PAS — liste close, une entrée.
 *
 * `head()` de `absences()` pose `<button class="btn primary" data-action=
 * "fake-save">+ Déclarer une absence</button>` — un geste de CRÉATION, qui
 * n'entre jamais dans les actions de `Page` (§2 de `ActionPrimaire`,
 * `components/mise-en-page/page.tsx`). Le vrai geste existe : le formulaire
 * de déclaration déjà présent plus bas sur cette même page, sous
 * `absences.declarer`.
 */
export const ECARTS_MAQUETTE_ACTIONS_ABSENCES: readonly EcartMaquette[] = [
  {
    libelle: "+ Déclarer une absence",
    motif:
      "un bouton de création n'entre jamais dans les actions de Page (§2 " +
      "de ActionPrimaire) ; le formulaire de déclaration, déjà sur cette " +
      "page, reste le seul geste réel.",
  },
];

/**
 * CE QUE `/absences` AJOUTE ET QUE `absences()` NE DESSINE PAS — dans
 * L'AUTRE SENS (le même principe que `ECARTS_MAQUETTE_AJOUTS_PARC`).
 *
 * D128 (18/09/2026) le tranche en toutes lettres : *« jamais au prix de
 * supprimer une information réelle que la maquette ignore »*. Les quatre
 * blocs ci-dessous sont les REMPLACEMENTS FONCTIONNELS ASSUMÉS de R3-14 — la
 * seule façon, dans ce dépôt, de poser ou lever un blocage d'agenda.
 */
export const ECARTS_MAQUETTE_AJOUTS_ABSENCES: readonly EcartMaquette[] = [
  {
    libelle: "Interventions rendues à la file à planifier",
    motif:
      "absences() ne montre aucun résultat de pose ; ce bandeau est la " +
      "seule trace, pour l'exploitant, de ce qu'une déclaration vient de " +
      "déplanifier (R3-14).",
  },
  {
    libelle: "Rupture de service (bandeau au moment de la pose)",
    motif:
      "l'alerte de rupturesDeService (D106, L3-04a) juge un ÉVÉNEMENT — " +
      "elle n'a pas d'équivalent dans une maquette statique, et le KPI " +
      "« Rupture de service » de absences() en est une lecture DIFFÉRENTE, " +
      "voir app/(back-office)/absences/presentation.ts.",
  },
  {
    libelle: "Le formulaire « Bloquer un agenda »",
    motif:
      "absences() ne dessine qu'un bouton de démonstration (voir " +
      "ECARTS_MAQUETTE_ACTIONS_ABSENCES) ; ce formulaire est le geste réel.",
  },
  {
    libelle: "Le tableau des blocages, avec « Lever »",
    motif:
      "absences() ne dessine ni tableau ni action de levée ; c'est la " +
      "seule façon de consulter et de lever un blocage existant.",
  },
];
