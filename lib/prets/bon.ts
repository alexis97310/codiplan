import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { t } from "@/lib/i18n/fr";
import { lireLogoEtRaisonSociale } from "@/lib/societes/logo";

import { genererBonPretPDF, type DonneesBonPretPdf } from "./bon-pdf";

/**
 * LE BON DE PRÊT FIGÉ (9L62-PRET-3-BON-SIGNE) — écrit les CINQ colonnes
 * réservées par 9L60 (`signataire_nom`, `signataire_qualite`,
 * `signature_objet_cle`, `bon_document_id`, `date_signature`), AUCUNE
 * migration (elles existent déjà, voir `docs/arbitrages.md`).
 *
 * ## `signature_objet_cle` PORTE L'IMAGE ELLE-MÊME, PAS UNE CLÉ DE
 * `lib/documents/stockage.ts`
 *
 * Ce module N'APPELLE PAS `enregistrerObjet` : son docblock le dit lui-même,
 * mesuré en production (D96) — `RACINE` n'est pas inscriptible sur
 * l'hébergeur, et une photo s'y perdait avant que D96 ne la fasse vivre EN
 * BASE. Reprendre ce chemin pour la signature referait exactement l'erreur
 * que D96 a corrigée. Le tracé d'un canevas pèse quelques kilo-octets — la
 * même mesure qui a gardé `InterventionSignature.image_base64` INLINE plutôt
 * que de la faire porter par `Document` (« un module de fichiers une donnée
 * qui n'en est pas un ») s'applique ici À L'IDENTIQUE : `signature_objet_cle`
 * porte donc le `data:image/png;base64,...` complet, en texte, malgré son nom
 * posé par 9L60 — écrit ici plutôt que deviné, voir la passation du lot.
 *
 * ## `bon_document_id` EST UN VRAI `Document`, LUI
 *
 * Le bon lui-même — le PDF figé — a une taille qui justifie la table
 * `document` (jusqu'à 1 Mo, D96) : il devient une ligne `document`, cible
 * `intervention_id` (la seule cible que `document_cible_unique` ouvre à ce
 * module), classe `interne` — JAMAIS `client` : `pret_equipement` est de
 * forme « interne » (D287) précisément pour qu'aucun compte portail
 * n'apprenne qu'un prêt existe, et un `Document` `client` attaché à LA MÊME
 * intervention serait lu par le bon du portail (`bonInterventionDuParc`,
 * `photosDeLIntervention`) — la fuite que D287 ferme d'un côté se rouvrirait
 * de l'autre.
 */

export type ContexteRemisePret = {
  readonly appareilId: string;
  readonly interventionId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly etatDepart: string;
  readonly dateSortie: Date;
  readonly dateRetourPrevue: Date;
  readonly observationsSortie: string | null;
  readonly signature: {
    readonly nom: string;
    readonly qualite: string | null;
    readonly donnees: string;
  } | null;
  readonly motifAbsenceSignature: string | null;
};

/** « PRET-XXXXXX » — même convention que `Local-…` (`referenceAffichee`) pour une ligne sans séquence propre : aucun numéro n'a été arbitré pour le prêt (voir la passation). */
function numeroBonAffiche(pretId: string): string {
  return `PRET-${pretId.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

function referenceInterventionAffichee(intervention: {
  readonly id: string;
  readonly numero: number | null;
  readonly annee: number | null;
}): string {
  if (intervention.numero !== null && intervention.annee !== null) {
    return `INT-${intervention.annee}-${String(intervention.numero).padStart(4, "0")}`;
  }
  return `Local-${intervention.id.replaceAll("-", "").slice(-6).toUpperCase()}`;
}

/**
 * CRÉE LE BON FIGÉ ET ÉCRIT LES CINQ COLONNES — appelé UNE SEULE FOIS, par
 * `sortirPretDans`, DANS LA MÊME TRANSACTION que la création du prêt : un
 * prêt sans bon, ou un bon sans prêt, ne doit jamais s'observer (I6).
 */
export async function creerBonPretDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  pretId: string,
  remise: ContexteRemisePret,
): Promise<void> {
  const [appareil, intervention, client, site, societe, fuseauSociete] =
    await Promise.all([
      tx.appareilPret.findFirstOrThrow({
        where: { id: remise.appareilId },
        select: {
          designation: true,
          marque: true,
          modele: true,
          numero_serie: true,
        },
      }),
      tx.intervention.findFirstOrThrow({
        where: { id: remise.interventionId },
        select: { id: true, numero: true, annee: true },
      }),
      tx.client.findFirstOrThrow({
        where: { id: remise.clientId },
        select: { raison_sociale: true },
      }),
      tx.site.findFirstOrThrow({
        where: { id: remise.siteId },
        select: { libelle: true },
      }),
      lireLogoEtRaisonSociale(tx, societeId),
      tx.societe.findFirstOrThrow({
        where: { id: societeId },
        select: { fuseau_horaire: true },
      }),
    ]);
  if (societe === null) {
    // Impossible en pratique : la société active porte la politique sous
    // laquelle cette transaction s'exécute déjà (même raisonnement
    // qu'`instantDeLAgence`, `lib/interventions/bon.ts`).
    throw new Error(
      `Société ${societeId} illisible sous le contexte courant : le bon de prêt ne peut pas porter son en-tête sans elle.`,
    );
  }

  const numeroBon = numeroBonAffiche(pretId);
  const donnees: DonneesBonPretPdf = {
    numeroBon,
    societe: {
      raisonSociale: societe.raisonSociale,
      logo:
        societe.logo === null
          ? null
          : { octets: societe.logo.octets, type: societe.logo.type },
    },
    client: client.raison_sociale,
    site: site.libelle,
    interventionReference: referenceInterventionAffichee(intervention),
    appareil: {
      designation: appareil.designation,
      marque: appareil.marque,
      modele: appareil.modele,
      numeroSerie: appareil.numero_serie,
    },
    etatDepart: remise.etatDepart,
    dateSortie: remise.dateSortie,
    dateRetourPrevue: remise.dateRetourPrevue,
    signature:
      remise.signature === null
        ? { motifAbsence: remise.motifAbsenceSignature ?? "" }
        : {
            imageDonnees: remise.signature.donnees,
            nom: remise.signature.nom,
            qualite: remise.signature.qualite,
          },
  };

  const octets = await genererBonPretPDF(donnees);
  const empreinte = createHash("sha256").update(octets).digest("hex");

  const document = await tx.document.create({
    data: {
      id: uuidv7(),
      societe_id: societeId,
      intervention_id: remise.interventionId,
      classe: "interne",
      libelle: `${t("intervention.pret.bon.titre")} ${numeroBon}`,
      nom_fichier: `bon-pret-${numeroBon}.pdf`,
      type_mime: "application/pdf",
      taille_octets: BigInt(octets.byteLength),
      empreinte,
      objet_cle: `bd:${empreinte}`,
      octets: new Uint8Array(octets),
    },
    select: { id: true },
  });

  const observations =
    remise.signature !== null || remise.motifAbsenceSignature === null
      ? remise.observationsSortie
      : remise.observationsSortie === null
        ? `${t("intervention.pret.bon.motif_remise_prefixe")}${t("ponctuation.deux_points")}${remise.motifAbsenceSignature}`
        : `${remise.observationsSortie}\n\n${t("intervention.pret.bon.motif_remise_prefixe")}${t("ponctuation.deux_points")}${remise.motifAbsenceSignature}`;

  await tx.pretEquipement.update({
    where: { id: pretId },
    data: {
      signataire_nom: remise.signature?.nom ?? null,
      signataire_qualite: remise.signature?.qualite ?? null,
      signature_objet_cle: remise.signature?.donnees ?? null,
      bon_document_id: document.id,
      date_signature: maintenant(lireFuseau(fuseauSociete.fuseau_horaire))
        .instant,
      observations,
    },
    select: { id: true },
  });
}
