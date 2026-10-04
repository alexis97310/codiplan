import type { Prisma, PrismaClient } from "@prisma/client";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { avecContexteApplicatif } from "@/lib/db/client";
import { envoyerCourriel } from "@/lib/courriel";
import type { CleTraduction } from "@/lib/i18n/fr";
import type { EtatAvantPlanification } from "@/lib/interventions/saisie";

import {
  creneauLisible,
  destinataireClient,
  lignesCommunes,
  natureLisible,
  type CreneauLisible,
  type DetailPourCourriel,
  type EtatEnvoiAvertissement,
} from "./planification";

/**
 * LE COURRIEL D'ANNULATION (9DF-TP-CY2-MATRICE-D8, décisions d'Alexis du
 * 03/10/2026 points 11 et 12).
 *
 * **Au CLIENT toujours** — même destinataire que les autres avertissements
 * (`destinataireClient`, `lib/avertissements/planification.ts`) : une
 * intervention annulée est une intervention qui n'aura pas lieu, et le client
 * doit le savoir aussi sûrement qu'il apprend qu'elle est planifiée.
 *
 * **Au TECHNICIEN seulement si l'intervention lui avait été TRANSMISE**
 * (statut `affectee` AVANT l'annulation, point 12) — une `a_planifier`, une
 * `planifiee` jamais transmise, une `suspendue` qui n'a jamais vu le terrain,
 * ou un `en_cours`/`terminee` où le technicien a DÉJÀ travaillé reçoivent un
 * traitement différent : seul `affectee` dit « le technicien sait déjà qu'il
 * doit y aller ». *(`en_cours` et `terminee` ne sont PAS couverts ici : un
 * technicien qui a déjà commencé — ou fini — le travail l'apprend par un
 * autre canal que ce courriel, hors du périmètre mesuré par ce lot.)*
 *
 * Même modèle que `lib/avertissements/planification.ts` et
 * `lib/avertissements/signature-terrain.ts` : lecture et composition SOUS le
 * contexte cloisonné, envoi HORS de toute transaction — un courriel ne doit
 * ni retarder ni annuler l'écriture qu'il annonce.
 *
 * **Comptes rendus HONNÊTES** (même règle que 9DB) : `sans_destinataire`
 * voyage jusqu'à l'écran plutôt que de laisser croire qu'un courriel est
 * parti.
 */

export type CompteRenduAnnulation = {
  readonly client: EtatEnvoiAvertissement;
  /** `null` : l'intervention n'avait pas été transmise, rien à dire au technicien. */
  readonly technicien: EtatEnvoiAvertissement | null;
};

type PlanEnvoiAnnulation =
  | { readonly type: "sans_destinataire" }
  | {
      readonly type: "a_envoyer";
      readonly destinataire: string;
      readonly sujet: string;
      readonly texte: string;
    };

type PlanAnnulation = {
  readonly client: PlanEnvoiAnnulation;
  readonly technicien: PlanEnvoiAnnulation | null;
};

function sujetAnnulationClient(): string {
  return "CODIPLAN — Votre intervention est annulée";
}

function corpsAnnulationClient(
  detail: DetailPourCourriel,
  creneau: CreneauLisible | null,
  motif: string,
): string {
  const lignes = [
    "Votre intervention est annulée.",
    "",
    ...(creneau === null ? [] : lignesCommunes(detail, creneau)),
    "",
    `Motif : ${motif}`,
  ];
  return lignes.join("\n");
}

function sujetAnnulationTechnicien(): string {
  return "CODIPLAN — Intervention annulée";
}

function corpsAnnulationTechnicien(
  detail: DetailPourCourriel,
  creneau: CreneauLisible | null,
  motif: string,
): string {
  const lignes = [
    "Cette intervention est annulée, ne vous déplacez pas.",
    "",
    ...(creneau === null ? [] : lignesCommunes(detail, creneau)),
    "",
    `Motif : ${motif}`,
  ];
  return lignes.join("\n");
}

async function planerEnvoiClientAnnulation(
  tx: Prisma.TransactionClient,
  societeId: string,
  clientId: string,
  siteId: string,
  detail: DetailPourCourriel,
  creneau: CreneauLisible | null,
  motif: string,
): Promise<PlanEnvoiAnnulation> {
  const contacts = await tx.contact.findMany({
    where: {
      societe_id: societeId,
      client_id: clientId,
      OR: [{ site_id: siteId }, { site_id: null }],
    },
    select: {
      id: true,
      nom: true,
      email: true,
      actif: true,
      roles: true,
      site_id: true,
    },
  });
  const destinataire = destinataireClient(contacts, siteId);
  if (destinataire === null || destinataire.email === null) {
    return { type: "sans_destinataire" };
  }
  return {
    type: "a_envoyer",
    destinataire: destinataire.email,
    sujet: sujetAnnulationClient(),
    texte: corpsAnnulationClient(detail, creneau, motif),
  };
}

async function planerEnvoiTechnicienAnnulation(
  tx: Prisma.TransactionClient,
  societeId: string,
  technicienId: string,
  detail: DetailPourCourriel,
  creneau: CreneauLisible | null,
  motif: string,
): Promise<PlanEnvoiAnnulation> {
  const technicien = await tx.utilisateur.findFirst({
    where: { id: technicienId, societes: { some: { societe_id: societeId } } },
    select: { email: true },
  });
  if (technicien === null) {
    return { type: "sans_destinataire" };
  }
  return {
    type: "a_envoyer",
    destinataire: technicien.email,
    sujet: sujetAnnulationTechnicien(),
    texte: corpsAnnulationTechnicien(detail, creneau, motif),
  };
}

async function envoyerPlanAnnulation(
  plan: PlanEnvoiAnnulation,
  environnement: Record<string, string | undefined>,
): Promise<EtatEnvoiAvertissement> {
  if (plan.type === "sans_destinataire") {
    return { type: "sans_destinataire" };
  }
  const envoi = await envoyerCourriel(
    { destinataire: plan.destinataire, sujet: plan.sujet, texte: plan.texte },
    environnement,
  );
  return envoi.parti
    ? { type: "parti" }
    : { type: "non_parti", motif: envoi.motif };
}

/**
 * LE DÉCLENCHEUR — appelé APRÈS qu'`annulerIntervention` a accepté,
 * JAMAIS dans la même transaction que l'écriture.
 *
 * `avant` est l'état lu juste avant l'écriture par `annulerIntervention`
 * (`lib/interventions/depot.ts`) : c'est son `statut` qui décide si le
 * technicien est prévenu, jamais le statut `annulee` relu après coup.
 */
export async function avertirApresAnnulation(
  contexte: ContexteSession,
  interventionId: string,
  avant: EtatAvantPlanification,
  motif: string,
  connexion?: PrismaClient,
  environnement: Record<string, string | undefined> = process.env,
): Promise<CompteRenduAnnulation | null> {
  const societeId = exigerSocieteActive(contexte);
  const plan = await avecContexteApplicatif(
    contexte,
    async (tx): Promise<PlanAnnulation | null> => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId, societe_id: societeId },
        select: {
          client_id: true,
          site_id: true,
          duree_estimee_min: true,
          type: true,
          reference_client: true,
          agence: {
            select: {
              fuseau_horaire: true,
              societe: { select: { fuseau_horaire: true } },
            },
          },
          site: { select: { libelle: true, commune: true } },
          machines: {
            select: {
              machine: {
                select: {
                  numero_serie: true,
                  modele: {
                    select: {
                      marque: true,
                      reference: true,
                      famille: { select: { libelle: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (intervention === null) {
        return null;
      }

      const fuseau = fuseauDeLAgence(intervention.agence);
      const machineLigne = intervention.machines[0]?.machine ?? null;
      const detail: DetailPourCourriel = {
        site: intervention.site,
        nature: natureLisible(intervention.type),
        referenceClient: intervention.reference_client,
        dureeMin: intervention.duree_estimee_min,
        machine:
          machineLigne === null
            ? null
            : {
                famille: machineLigne.modele.famille.libelle,
                marque: machineLigne.modele.marque,
                reference: machineLigne.modele.reference,
                numeroSerie: machineLigne.numero_serie,
              },
      };
      const creneau = creneauLisible(
        avant.datePlanifiee,
        avant.creneauDebut,
        fuseau,
      );

      const client = await planerEnvoiClientAnnulation(
        tx,
        societeId,
        intervention.client_id,
        intervention.site_id,
        detail,
        creneau,
        motif,
      );

      // AU TECHNICIEN SEULEMENT SI TRANSMISE (point 12, 03/10/2026) : seul
      // `affectee` AVANT l'annulation dit qu'il savait déjà qu'il devait s'y
      // rendre.
      const technicien =
        avant.statut === "affectee" && avant.technicienId !== null
          ? await planerEnvoiTechnicienAnnulation(
              tx,
              societeId,
              avant.technicienId,
              detail,
              creneau,
              motif,
            )
          : null;

      return { client, technicien };
    },
    connexion,
  );

  if (plan === null) {
    return null;
  }
  const client = await envoyerPlanAnnulation(plan.client, environnement);
  const technicien =
    plan.technicien === null
      ? null
      : await envoyerPlanAnnulation(plan.technicien, environnement);
  return { client, technicien };
}

// ── LE COMPTE-RENDU, RENDU À L'ÉCRAN — DES CLÉS, JAMAIS DU TEXTE ───────────

/**
 * Closed set, comme `clesAvertissementCourriel` (`planification.ts`) et pour
 * la même raison : ce canal traverse une redirection HTTP, donc une URL, donc
 * un lien qui peut être forgé (L1-02f, D50).
 */
export function clesAvertissementAnnulation(
  compteRendu: CompteRenduAnnulation,
): readonly CleTraduction[] {
  const cles: CleTraduction[] = [
    compteRendu.client.type === "parti"
      ? "intervention.avertissement.courriel_client_annulation_parti"
      : compteRendu.client.type === "sans_destinataire"
        ? "intervention.avertissement.courriel_client_annulation_sans_destinataire"
        : "intervention.avertissement.courriel_client_annulation_non_parti",
  ];
  if (compteRendu.technicien !== null) {
    cles.push(
      compteRendu.technicien.type === "parti"
        ? "intervention.avertissement.courriel_technicien_annulation_parti"
        : "intervention.avertissement.courriel_technicien_annulation_non_parti",
    );
  }
  return cles;
}
