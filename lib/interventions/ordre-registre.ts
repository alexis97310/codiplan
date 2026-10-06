import type { Prisma } from "@prisma/client";

import type { CleTraduction } from "@/lib/i18n/fr";

import type { VueRegistre } from "./saisie";

/**
 * L'ORDRE DU REGISTRE, PAR ONGLET (TP-UX3-1-REGISTRE-1, QE-8 ; §5.3 de la
 * spécification du 28/09/2026).
 *
 * ## Un ordre par onglet, jamais un seul tri pour tout le registre
 *
 * *Mesuré sur `main` avant ce ticket : un seul `orderBy` — `date_planifiee
 * desc nulls last, id desc` — servait les huit vues et « Toutes ».* Chaque
 * onglet répond à une question différente (« qu'ai-je laissé en souffrance
 * le plus longtemps ? », « qu'est-ce qui m'attend aujourd'hui, dans l'ordre
 * où ça arrive ? »), et un seul tri ne peut répondre qu'à une seule d'entre
 * elles.
 *
 * **`a_venir` et `historique` GARDENT l'ordre d'avant ce ticket** — ce lot ne
 * les pose plus dans la rangée d'onglets (ils restent atteignables par leur
 * adresse, en puce), et aucune mesure d'ergonomie ne demande d'y changer
 * quoi que ce soit.
 *
 * **`id` départage partout** — deux lignes qui partagent la même valeur de
 * tri (deux `a_planifier` de même priorité créées à la même seconde, par
 * exemple) doivent un ordre stable entre deux pages, sinon la pagination
 * répète ou saute une ligne.
 *
 * ## Le texte accompagne l'ordre, jamais une seconde lecture
 *
 * Chaque vue rend aussi la clé du dictionnaire qui DIT cet ordre — rendue par
 * `LigneResume` (`components/ui/ligne-resume.tsx`) dans « N interventions ·
 * tri : … ». Composer ce texte séparément de l'`orderBy` ferait deux
 * écritures d'un même critère, divergentes en silence le jour où l'une des
 * deux change (§9, 01/09) — cette fonction est donc la SEULE à décider des
 * deux à la fois.
 */
export type OrdreRegistre = {
  readonly orderBy: readonly Prisma.InterventionOrderByWithRelationInput[];
  readonly cleTri: CleTraduction;
};

const DEPARTAGE: Prisma.InterventionOrderByWithRelationInput = { id: "desc" };

/** L'ordre actuel, inchangé — partagé par « Toutes » (nulls en tête) n'y recourt PAS : voir `case null` plus bas. */
const ORDRE_ACTUEL_RECENTE_EN_TETE: readonly Prisma.InterventionOrderByWithRelationInput[] =
  [{ date_planifiee: { sort: "desc", nulls: "last" } }, DEPARTAGE];

export function ordreDuRegistre(vue: VueRegistre | null): OrdreRegistre {
  switch (vue) {
    case null:
      // « TOUTES » (TP-UX3-1-REGISTRE-1) — sans date EN TÊTE (la file
      // d'attente, qui n'a jamais de date), puis la plus récente : l'inverse
      // de `ORDRE_ACTUEL_RECENTE_EN_TETE`, dont les lignes sans date
      // tombaient en dernier.
      return {
        orderBy: [
          { date_planifiee: { sort: "desc", nulls: "first" } },
          DEPARTAGE,
        ],
        cleTri: "interventions.ordre.toutes",
      };
    case "a_planifier":
      // Priorité d'abord (p1 avant p4, l'ordre alphabétique de l'énumération
      // est aussi celui de l'urgence), puis la plus ANCIENNE création — ce
      // qui attend depuis le plus longtemps, à priorité égale.
      return {
        orderBy: [{ priorite: "asc" }, { cree_le: "asc" }, DEPARTAGE],
        cleTri: "interventions.ordre.a_planifier",
      };
    case "aujourdhui":
      return {
        orderBy: [{ creneau_debut: { sort: "asc", nulls: "last" } }, DEPARTAGE],
        cleTri: "interventions.ordre.aujourdhui",
      };
    case "en_retard":
      return {
        orderBy: [{ date_planifiee: "asc" }, DEPARTAGE],
        cleTri: "interventions.ordre.en_retard",
      };
    case "en_cours":
      return {
        orderBy: [{ creneau_debut: { sort: "asc", nulls: "last" } }, DEPARTAGE],
        cleTri: "interventions.ordre.en_cours",
      };
    case "bloquees":
      return {
        orderBy: [{ suspendue_le: { sort: "asc", nulls: "last" } }, DEPARTAGE],
        cleTri: "interventions.ordre.bloquees",
      };
    case "a_controler":
      return {
        orderBy: [{ date_planifiee: "asc" }, DEPARTAGE],
        cleTri: "interventions.ordre.a_controler",
      };
    case "a_venir":
    case "historique":
      return {
        orderBy: ORDRE_ACTUEL_RECENTE_EN_TETE,
        cleTri: "interventions.ordre.recente_en_tete",
      };
  }
}
