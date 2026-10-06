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
 * L'ACTION D'EN-TÊTE DE `absences()` — liste close, VIDE depuis le
 * 9EC-TP-UX3-E-ABSENCES (D175).
 *
 * `head()` de `absences()` (`codiplan-maquette-complete.html`) pose
 * `<button class="btn primary" data-action="fake-save">+ Déclarer une
 * absence</button>`. **C'est désormais un GAP COMBLÉ** — même geste que
 * « + Machine » (`lib/machines/ecarts-maquette.ts`) : `/absences` porte un
 * vrai bouton d'en-tête (`actions` de `Page`, « Déclarer une absence »,
 * `?declarer=1`) qui ouvre le volet (`components/ui/volet.tsx`) — le même
 * geste que le formulaire qu'il remplaçait, jamais une démonstration.
 */
export const ECARTS_MAQUETTE_ACTIONS_ABSENCES: readonly EcartMaquette[] = [];

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
      "elle n'a pas d'équivalent dans une maquette statique, et la carte " +
      "permanente « Rupture de service » (D175) en est une lecture " +
      "DIFFÉRENTE, voir app/(back-office)/absences/presentation.ts.",
  },
  {
    libelle: "Le volet « Déclarer une absence »",
    motif:
      "absences() ne dessine qu'un bouton de démonstration (voir " +
      "ECARTS_MAQUETTE_ACTIONS_ABSENCES) ; depuis le 9EC-TP-UX3-E-ABSENCES " +
      "(D175), le volet (components/ui/volet.tsx) est le geste réel.",
  },
  {
    libelle: "Le tableau des absences, avec « Écourter » et « Supprimer »",
    motif:
      "absences() ne dessine ni tableau ni action sur une absence " +
      "existante ; c'est la seule façon de la consulter, de l'écourter ou " +
      "de la supprimer (QT-15, D136).",
  },
];
