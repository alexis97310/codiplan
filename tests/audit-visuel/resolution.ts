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
      select: { id: true, code: true, calendrier_id: true },
    });
    notes.agence = `Agence ${agence.code}`;

    // ACTIFS SEULEMENT (point 4 du ticket 9G7-AUDIT-COMPLEMENT) — sans ce
    // filtre, l'ordre alphabétique retombe sur « Ancien client » / « Ancien
    // chantier » (`prisma/seed-data.ts` ~:798-821, `actif: false`), posés
    // exprès pour nourrir le filtre « actifs seulement » de la recherche :
    // les fiches de l'audit doivent montrer un dossier ACTIF, pas celui-là.
    const client_ = await client.client.findFirst({
      where: { societe_id: societeId, actif: true },
      orderBy: { raison_sociale: "asc" },
      select: { id: true, raison_sociale: true },
    });
    if (client_) notes.client = `Client « ${client_.raison_sociale} »`;

    const site = await client.site.findFirst({
      where: {
        societe_id: societeId,
        actif: true,
        ...(client_ ? { client_id: client_.id } : {}),
      },
      orderBy: { libelle: "asc" },
      select: { id: true, libelle: true },
    });
    if (site) notes.site = `Site « ${site.libelle} »`;

    const siteAutre = await client.site.findFirst({
      where: {
        societe_id: societeId,
        actif: true,
        id: { not: site?.id ?? "" },
      },
      orderBy: { libelle: "asc" },
      select: { id: true },
    });

    // SOUMISE À VGP (point 4) — l'assujettissement se résout comme
    // `lib/vgp/assujettissement.ts` (`resoudreAssujettissement`) : l'exception
    // de la machine PUIS, à défaut, celui de sa famille. Une machine prise au
    // hasard tombe le plus souvent sur une famille `a_determiner`, qui ne
    // prouve rien sur l'écran VGP.
    const machineCandidates = await client.machine.findMany({
      where: { societe_id: societeId },
      orderBy: { numero_serie: "asc" },
      select: {
        id: true,
        numero_serie: true,
        vgp_exception: true,
        modele: {
          select: { famille: { select: { assujettissement_vgp: true } } },
        },
      },
    });
    const machineSoumise = machineCandidates.find(
      (m) =>
        (m.vgp_exception ?? m.modele.famille.assujettissement_vgp) === "soumis",
    );
    const machine = machineSoumise ?? machineCandidates[0] ?? null;
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

    // LE TECHNICIEN DE LA SCÈNE, RÉSOLU AVANT « en_cours » — la fiche
    // `/terrain/:id` refuse une intervention qui n'appartient pas au
    // technicien connecté (`COMPTE_TECHNICIEN_EPREUVE`, "garnier@codima.test").
    // Une intervention `en_cours` prise au hasard pouvait appartenir à un
    // AUTRE technicien ; la capture terrain échouait alors en silence sur un
    // refus d'accès — *mesuré en corrigeant cet outil* (point 1.c du ticket).
    const technicienDucos = await client.utilisateur.findFirst({
      where: { email: "garnier@codima.test" },
      select: { id: true },
    });

    const aPlanifier = await premiereIntervention("a_planifier");
    const enCours = technicienDucos
      ? await premiereIntervention("en_cours", {
          technicien_id: technicienDucos.id,
        })
      : await premiereIntervention("en_cours");
    const terminee = await premiereIntervention("terminee");
    const cloturee = await premiereIntervention("cloturee");
    const suspendue = await premiereIntervention("suspendue");
    const annulee = await premiereIntervention("annulee");
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
    notes.interventionAnnulee = annulee
      ? `Intervention ${annulee.id} (annulee)`
      : "Aucune trouvée";

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
      calendrierId: agence.calendrier_id,
      machineId: machine?.id ?? null,
      demandeId: demande?.id ?? null,
      interventionAPlanifier: aPlanifier?.id ?? null,
      interventionEnCours: enCours?.id ?? null,
      interventionTerminee: terminee?.id ?? null,
      interventionCloturee: cloturee?.id ?? null,
      interventionSuspendue: suspendue?.id ?? null,
      interventionAnnulee: annulee?.id ?? null,
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
