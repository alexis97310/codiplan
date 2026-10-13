import { PrismaClient } from "@prisma/client";

import { urlAdministration } from "../e2e/setup/base";
import type { Repere } from "./catalogue";

/**
 * RÉSOUT LES REPÈRES DONT LE CATALOGUE A BESOIN, EN LISANT LA BASE DE
 * L'ÉPREUVE — jamais en écrivant une ligne de plus que celles déjà posées par
 * `tests/e2e/setup/scene.ts` (hors territoire, non modifié, seulement lu).
 *
 * Chaque champ est le PREMIER enregistrement trouvé qui convient — « premier
 * pertinent », comme demandé par le ticket — et `resoudreLesReperes` consigne
 * dans `notes` CE QU'ELLE A CHOISI, pour que le rapport puisse le citer.
 */
export type ResolutionRepere = {
  readonly repere: Repere;
  readonly notes: Record<string, string>;
};

export async function resoudreLesReperes(): Promise<ResolutionRepere> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  const notes: Record<string, string> = {};
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const societeId = societe.id;

    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId },
      orderBy: { code: "asc" },
      select: { id: true, code: true },
    });
    notes.agence = `Agence ${agence.code}`;

    const client_ = await client.client.findFirst({
      where: { societe_id: societeId },
      orderBy: { raison_sociale: "asc" },
      select: { id: true, raison_sociale: true },
    });
    if (client_) notes.client = `Client « ${client_.raison_sociale} »`;

    const site = await client.site.findFirst({
      where: {
        societe_id: societeId,
        ...(client_ ? { client_id: client_.id } : {}),
      },
      orderBy: { libelle: "asc" },
      select: { id: true, libelle: true },
    });
    if (site) notes.site = `Site « ${site.libelle} »`;

    const siteAutre = await client.site.findFirst({
      where: { societe_id: societeId, id: { not: site?.id ?? "" } },
      orderBy: { libelle: "asc" },
      select: { id: true },
    });

    const machine = await client.machine.findFirst({
      where: { societe_id: societeId },
      orderBy: { numero_serie: "asc" },
      select: { id: true, numero_serie: true },
    });
    if (machine) notes.machine = `Machine n° série « ${machine.numero_serie} »`;

    const demande = await client.demande.findFirst({
      where: { societe_id: societeId },
      select: { id: true },
    });
    notes.demande = demande
      ? "Demande trouvée"
      : "Aucune demande en base (le semis n'en pose pas)";

    async function premiereIntervention(
      statut:
        | "a_planifier"
        | "planifiee"
        | "affectee"
        | "en_cours"
        | "suspendue"
        | "terminee"
        | "cloturee"
        | "annulee",
      filtreSuppl?: Record<string, unknown>,
    ): Promise<{ id: string } | null> {
      return client.intervention.findFirst({
        where: { societe_id: societeId, statut, ...filtreSuppl },
        select: { id: true },
      });
    }

    const aPlanifier = await premiereIntervention("a_planifier");
    const enCours = await premiereIntervention("en_cours");
    const terminee = await premiereIntervention("terminee");
    const cloturee = await premiereIntervention("cloturee");
    const suspendue = await premiereIntervention("suspendue");
    const avecBon = cloturee ?? terminee;
    notes.interventionAPlanifier = aPlanifier
      ? `Intervention ${aPlanifier.id} (a_planifier)`
      : "Aucune trouvée";
    notes.interventionEnCours = enCours
      ? `Intervention ${enCours.id} (en_cours)`
      : "Aucune trouvée";
    notes.interventionTerminee = terminee
      ? `Intervention ${terminee.id} (terminee)`
      : "Aucune trouvée";
    notes.interventionCloturee = cloturee
      ? `Intervention ${cloturee.id} (cloturee)`
      : "Aucune trouvée";
    notes.interventionSuspendue = suspendue
      ? `Intervention ${suspendue.id} (suspendue)`
      : "Aucune trouvée";

    const technicienDucos = await client.utilisateur.findFirst({
      where: { email: "garnier@codima.test" },
      select: { id: true },
    });
    const terrainADemarrer = technicienDucos
      ? await client.intervention.findFirst({
          where: {
            societe_id: societeId,
            statut: "affectee",
            technicien_id: technicienDucos.id,
          },
          select: { id: true },
        })
      : null;
    notes.interventionTerrainADemarrer = terrainADemarrer
      ? `Intervention ${terrainADemarrer.id} (affectee, technicien de la scène)`
      : "Aucune trouvée pour le technicien de la scène";

    const importControle = await client.importLot.findFirst({
      where: { societe_id: societeId, statut: "controle" },
      select: { id: true },
    });
    const importApplique = await client.importLot.findFirst({
      where: { societe_id: societeId, statut: "applique" },
      select: { id: true },
    });
    notes.importControle = importControle
      ? `Import ${importControle.id} (controle)`
      : "Aucun trouvé";
    notes.importApplique = importApplique
      ? `Import ${importApplique.id} (applique)`
      : "Aucun trouvé (le semis n'en pose peut-être aucun)";

    const forfait = await client.forfait.findFirst({
      where: { societe_id: societeId },
      select: { id: true },
    });

    const repere: Repere = {
      clientId: client_?.id ?? null,
      siteId: site?.id ?? null,
      siteIdAutre: siteAutre?.id ?? null,
      agenceId: agence.id,
      machineId: machine?.id ?? null,
      demandeId: demande?.id ?? null,
      interventionAPlanifier: aPlanifier?.id ?? null,
      interventionEnCours: enCours?.id ?? null,
      interventionTerminee: terminee?.id ?? null,
      interventionCloturee: cloturee?.id ?? null,
      interventionSuspendue: suspendue?.id ?? null,
      interventionAnnulee: null,
      interventionAvecBon: avecBon?.id ?? null,
      interventionTerrainADemarrer: terrainADemarrer?.id ?? null,
      importControle: importControle?.id ?? null,
      importApplique: importApplique?.id ?? null,
      forfaitId: forfait?.id ?? null,
    };
    return { repere, notes };
  } finally {
    await client.$disconnect();
  }
}
