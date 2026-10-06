import type { PrismaClient } from "@prisma/client";

import type { ContexteSession } from "@/lib/auth/contexte";
import { demandesOuvertes } from "@/lib/demandes/depot";
import { compterParVue, listerInterventions } from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

/**
 * LES DÉCOMPTES DU MENU (QE-5, 9DU-TP-NAV3-RECHERCHE-RAIL, D171) — chaque
 * chiffre est celui de SA liste, jamais une sixième façon de compter :
 * « Demandes » réutilise `demandesOuvertes` (l'onglet « À traiter », 9DM),
 * « Interventions » réutilise `compterParVue` (le registre, champ
 * `a_planifier`) — les deux comptes DÉJÀ affichés ailleurs, jamais recalculés
 * ici d'une seconde manière qui pourrait diverger (§9, 01/09).
 *
 * **Aucun décompte VGP** — MO-3 (la liste des réserves VGP) n'existe pas
 * encore : compter une liste qui n'existe pas inventerait un chiffre (§8).
 */
export type DecompteMenu = {
  readonly total: number;
  readonly urgent: boolean;
};

export type DecomptesMenu = {
  readonly demandes: DecompteMenu;
  readonly interventions: DecompteMenu;
};

const CRITERES_REGISTRE_VIDE = schemaRechercheInterventions.parse({});
const CRITERES_A_PLANIFIER = schemaRechercheInterventions.parse({
  vue: "a_planifier",
});

async function decompteDemandes(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<DecompteMenu> {
  const demandes = await demandesOuvertes(contexte, client);
  return {
    total: demandes.length,
    urgent: demandes.some((demande) => demande.urgence === "p1"),
  };
}

/**
 * **L'ALERTE P1 REGARDE LA PREMIÈRE PAGE, PAS TOUTE LA LISTE** —
 * `listerInterventions` pagine à 50 (`LIMITE_RECHERCHE_PAR_DEFAUT`), et
 * `compterParVue` ne détaille pas par priorité. Au-delà de 50 interventions à
 * planifier, une P1 plus ancienne que les 50 premières ne rougirait pas le
 * décompte — un écart documenté plutôt qu'une requête ajoutée dans un dépôt
 * hors du territoire de ce lot (`lib/interventions/depot.ts`).
 */
async function decompteInterventionsAPlanifier(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<DecompteMenu> {
  const [comptes, premiers] = await Promise.all([
    compterParVue(contexte, CRITERES_REGISTRE_VIDE, client),
    listerInterventions(contexte, CRITERES_A_PLANIFIER, client),
  ]);
  return {
    total: comptes.a_planifier,
    urgent: premiers.some((intervention) => intervention.priorite === "p1"),
  };
}

/**
 * **NE LÈVE JAMAIS** — même contrat que `lib/navigation/chrome.ts` : un
 * décompte manquant n'est pas une raison de faire échouer tout le rendu du
 * chrome. `null` en entrée (personne de connecté) comme en sortie (l'une des
 * deux lectures a échoué) rendent simplement la colonne sans badge.
 */
export async function decomptesDuMenu(
  contexte: ContexteSession | null,
  client?: PrismaClient,
): Promise<DecomptesMenu | null> {
  if (contexte === null) {
    return null;
  }
  try {
    const [demandes, interventions] = await Promise.all([
      decompteDemandes(contexte, client),
      decompteInterventionsAPlanifier(contexte, client),
    ]);
    return { demandes, interventions };
  } catch {
    return null;
  }
}
