import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { listerPlanning } from "@/lib/interventions/depot";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import {
  interventionsDuJour,
  prioritesPasDemarrees,
} from "@/app/(back-office)/tableau-de-bord/presentation";

import {
  clientApp,
  clientOwner,
  fermerClients,
  sousSocieteEtRole,
} from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * IN-46 — LE TABLEAU DE BORD NE COMPTE PLUS AUCUNE ANNULÉE (audit du
 * 28/09/2026, TP-A6-TRIS-MISE-EN-PAGE, 30/09/2026).
 *
 * ## Le constat que ce lot ferme
 *
 * `listerPlanning`, appelée SANS option par `app/(back-office)/
 * tableau-de-bord/page.tsx`, rendait `{}` pour `filtreStatutAnnulee`
 * (défaut `inclureAnnulees ?? true`) : une intervention ANNULÉE du jour
 * entrait dans « Interventions aujourd'hui » ET dans « Urgences » si sa
 * priorité était `p1`. La page appelle désormais `listerPlanning(..., {
 * inclureAnnulees: false })`, exactement comme `/planning` (PG-A8, voir
 * `tests/isolation/planning-annulees-masquees.test.ts`).
 *
 * Ce scénario éprouve la chaîne ENTIÈRE que le tableau de bord compose —
 * `listerPlanning` PUIS `interventionsDuJour` PUIS `prioritesPasDemarrees`
 * (`app/(back-office)/tableau-de-bord/presentation.ts`, remplace
 * `prioritesUrgentes` depuis 9EG-TP-UX6-TABLEAU-DE-BORD-1/D185) — plutôt que
 * la seule option de `listerPlanning`, déjà couverte ailleurs : ces deux
 * fonctions ne filtrent elles-mêmes AUCUN statut, et une régression qui
 * réintroduirait l'appel sans option se verrait ici, sur les mêmes tuiles
 * que l'écran affiche.
 *
 * Deux lignes forgées ici (préfixe `TPA6-` dans leur description, aucune
 * fixture `SCENE.*` partagée), supprimées en fin de scénario.
 */

const JOUR = new Date("2026-09-20T00:00:00.000Z");
const DEBUT_DU_JOUR = JOUR;
const FIN_DU_JOUR = new Date("2026-09-21T00:00:00.000Z");
const INSTANT_APRES_LE_CRENEAU = new Date("2026-09-20T05:00:00.000Z");

const PLANIFICATEUR = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const interventionsPosees: string[] = [];

function squelette(
  id: string,
  statut: "annulee" | "affectee",
): {
  id: string;
  societe_id: string;
  client_id: string;
  site_id: string;
  agence_id: string;
  type: "curatif";
  statut: "annulee" | "affectee";
  priorite: "p1";
  date_planifiee: Date;
  creneau_debut: Date;
  technicien_id: string | null;
  // OBLIGATOIRE dès `affectee` (`intervention_planifiee_a_sa_duree`,
  // PARCOURS-1) — absente, la ligne « active » de ce scénario serait
  // rejetée par la contrainte, pas par la règle que ce test éprouve.
  duree_estimee_min: number;
  description: string;
} {
  interventionsPosees.push(id);
  return {
    id,
    societe_id: SOCIETE_A,
    client_id: CLIENT_A1,
    site_id: SITE_A1_S1,
    agence_id: AGENCE_A,
    type: "curatif",
    statut,
    priorite: "p1",
    date_planifiee: JOUR,
    creneau_debut: DEBUT_DU_JOUR,
    technicien_id:
      statut === "affectee" ? UTILISATEUR_PAR_ROLE.technicien : null,
    duree_estimee_min: 60,
    description: "TPA6- épreuve d'isolation, supprimée en fin de scénario",
  };
}

afterEach(async () => {
  if (interventionsPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" IN (${interventionsPosees
        .map((id) => `'${id}'`)
        .join(",")})`,
    );
    interventionsPosees.length = 0;
  }
});

afterAll(fermerClients);

describe("IN-46 — le tableau de bord ne compte ni ne priorise une annulée du jour", () => {
  it("« Aujourd'hui » et « Pas démarrée » gardent la p1 affectée, écartent l'annulée", async () => {
    const active = uuidv7();
    const annulee = uuidv7();
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.create({ data: squelette(active, "affectee") }),
    );
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.create({ data: squelette(annulee, "annulee") }),
    );

    // LE MÊME APPEL QUE `app/(back-office)/tableau-de-bord/page.tsx`, DEPUIS
    // CE LOT : `inclureAnnulees: false`.
    const lignesPlanning = await listerPlanning(
      PLANIFICATEUR,
      DEBUT_DU_JOUR,
      FIN_DU_JOUR,
      clientApp(),
      { inclureAnnulees: false },
    );

    const lignesDuJour = interventionsDuJour(
      lignesPlanning,
      DEBUT_DU_JOUR,
      FIN_DU_JOUR,
    );
    const idsDuJour = lignesDuJour.map((ligne) => ligne.id);
    expect(idsDuJour).toContain(active);
    expect(idsDuJour).not.toContain(annulee);

    const urgences = prioritesPasDemarrees(
      lignesDuJour,
      INSTANT_APRES_LE_CRENEAU,
      referenceAffichee,
    );
    const hrefsUrgences = urgences.map((element) => element.href);
    expect(hrefsUrgences).toContain(
      `/interventions/${active}?depuis=tableau_de_bord`,
    );
    // INDÉPENDANT DE LA FORME EXACTE DE L'ADRESSE (9DW-SOLDE-9DR, R1) :
    // l'identifiant de l'annulée n'apparaît dans AUCUN href, quelle que soit
    // sa forme — plutôt qu'un contrôle calé sur le `?depuis=` d'aujourd'hui.
    expect(hrefsUrgences.some((href) => href.includes(annulee))).toBe(false);
  });
});
