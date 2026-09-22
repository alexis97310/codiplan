import { type Prisma } from "@prisma/client";

import { type LigneObservationVgp, type LignePv } from "@/lib/imports/vgp";

/**
 * L'ÉCRITURE EN LOT DES VÉRIFICATIONS ET DES OBSERVATIONS IMPORTÉES (VGP-IMPORT).
 *
 * ## Pourquoi ce n'est pas `enregistrerVerification`
 *
 * `enregistrerVerification` (`lib/vgp/verification.ts`) écrit UNE vérification
 * et ses observations en une transaction qu'elle ouvre elle-même — c'est le
 * formulaire, et il ne connaît pas l'identifiant à l'avance. L'application
 * d'un lot écrit dans UNE transaction qu'elle tient déjà, avec des
 * identifiants connus (I10), et le minimum d'allers-retours que Prisma
 * permette : un `createMany` par lot, jamais une requête par ligne (la
 * mesure du 16/09/2026, 615 lignes sans réponse après quatre minutes).
 *
 * ## Ce que ces deux fonctions ÉCRIVENT, et rien d'autre
 *
 * Une vérification : sa machine, sa date, son organisme, sa référence, son
 * origine — **celle du fichier** (D114) —, sans document. Une observation :
 * son libellé, son parent, et `intervention_id` NUL — *une observation
 * importée ne crée AUCUNE demande SAV* (arbitrage 1 du 22/09/2026). Tout ce
 * que l'archive porte de plus est dans la ligne du lot, pas ici.
 *
 * **Aucune comparaison de société n'est écrite** : les deux tables sont sous
 * la forme « filiation », parent `machine`, et `societe_id` voyage avec la
 * clé composite que le schéma exige.
 */
export async function creerVerificationsVgpEnLot(
  tx: Prisma.TransactionClient,
  societeId: string,
  lignes: readonly { readonly id: string; readonly saisie: LignePv }[],
): Promise<void> {
  if (lignes.length === 0) return;
  await tx.vgpVerification.createMany({
    data: lignes.map(({ id, saisie }) => ({
      id,
      societe_id: societeId,
      machine_id: saisie.machine_id,
      date_verification: saisie.date_verification,
      organisme: saisie.organisme,
      reference_rapport: saisie.reference_rapport,
      origine: saisie.origine,
    })),
  });
}

export async function creerObservationsVgpEnLot(
  tx: Prisma.TransactionClient,
  societeId: string,
  lignes: readonly {
    readonly id: string;
    readonly saisie: LigneObservationVgp;
  }[],
): Promise<void> {
  if (lignes.length === 0) return;
  await tx.vgpObservation.createMany({
    data: lignes.map(({ id, saisie }) => ({
      id,
      societe_id: societeId,
      verification_id: saisie.verification_id,
      libelle: saisie.libelle,
    })),
  });
}
