import { type OrigineInformationVgp, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  exigerContexteActif,
  exigerSocieteActive,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { perimetreParPersonne } from "@/lib/interventions/perimetre-technicien";

/**
 * CE QU'ON NOUS A DIT D'UNE VÉRIFICATION PÉRIODIQUE (L9-09 ; D88, D114).
 *
 * ## LA PHRASE QUI GOUVERNE CE FICHIER
 *
 * *Les VGP sont commandées par les CLIENTS, pas par CODIMA.* Ce module
 * **enregistre**, il ne conclut pas : **aucune fonction ici ne rend un verdict
 * de conformité**, et le seul calcul du registre est une date (L9-01).
 *
 * ## L'ORIGINE EST OBLIGATOIRE, ET SANS DÉFAUT
 *
 * *Un rapport reçu de l'organisme, une vignette photographiée par un technicien
 * et une parole du client au téléphone n'ont pas la même valeur le jour d'un
 * contrôle* (D114). **Une origine par défaut serait une valeur probante
 * inventée** — et elle serait inventée sur la ligne même qu'on produirait le
 * jour d'un contrôle.
 *
 * ## AUCUNE COMPARAISON DE SOCIÉTÉ N'EST ÉCRITE ICI
 *
 * La politique de `vgp_verification` est de forme « filiation », parent
 * `machine` : *une fille est visible si son parent l'est*, et les trois filtres
 * du parc se propagent par cette seule clause. Une comparaison écrite au-dessus
 * serait une seconde lecture d'un même critère (§9, 01/09).
 */

const texteNonVide = z.string().trim().min(1);

export const ORIGINES_VGP = [
  "rapport_organisme",
  "rapport_transmis_client",
  "vignette_constatee",
  "declaration_client",
] as const;

export const schemaVerificationVgp = z.object({
  machine_id: z.uuid(),
  date_verification: z.date(),
  organisme: texteNonVide,
  /** NULLE quand l'information ne vient pas d'un rapport : une vignette n'en porte pas. */
  reference_rapport: texteNonVide.nullable().default(null),
  /**
   * SANS DÉFAUT, et c'est tout D114 : l'appelant DIT d'où vient l'information,
   * ou la saisie est refusée. *Une origine par défaut serait une valeur probante
   * inventée.*
   */
  origine: z.enum(ORIGINES_VGP),
  /** Le document qui porte les octets, quand on les a (D88 §9, classe `client`). */
  document_id: z.uuid().nullable().default(null),
  /**
   * CE QUE L'ORGANISME A OBSERVÉ, mot pour mot — une entrée par observation.
   *
   * **Vide n'est pas `null`** : *une vérification sans observation est un fait,
   * et c'est même le cas qu'on espère.* Les confondre ferait de « rien à
   * signaler » une donnée manquante.
   */
  observations: z.array(texteNonVide).default([]),
});

export type SaisieVerificationVgp = z.infer<typeof schemaVerificationVgp>;

/** Une vérification telle qu'elle est rendue, avec ce qu'elle a observé. */
export type FicheVerification = {
  readonly id: string;
  readonly machine_id: string;
  readonly date_verification: Date;
  readonly organisme: string;
  readonly reference_rapport: string | null;
  readonly origine: OrigineInformationVgp;
  readonly document_id: string | null;
  readonly observations: readonly {
    readonly id: string;
    readonly libelle: string;
    readonly intervention_id: string | null;
  }[];
};

const CHAMPS_VERIFICATION = {
  id: true,
  machine_id: true,
  date_verification: true,
  organisme: true,
  reference_rapport: true,
  origine: true,
  document_id: true,
  observations: {
    select: { id: true, libelle: true, intervention_id: true },
    orderBy: { id: "asc" },
  },
} as const;

/**
 * ENREGISTRE CE QU'ON NOUS A DIT, avec ses observations, en UNE transaction.
 *
 * **Les observations ne se posent pas après coup**, et c'est une décision : une
 * vérification écrite sans elles, suivie d'un incident, laisserait un rapport
 * *avec* observations enregistré comme un rapport *sans* — et c'est exactement
 * l'état que D88 §10 veut faire remonter au planning. *Ce qui doit être vrai
 * ensemble s'écrit ensemble.*
 */
export async function enregistrerVerification(
  contexte: ContexteSession,
  saisie: SaisieVerificationVgp,
  client?: PrismaClient,
): Promise<FicheVerification> {
  const societeId = exigerSocieteActive(contexte);
  const id = uuidv7();
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      // D131 (23/09/2026, DROITS-1) : un technicien restreint (○) n'enregistre
      // une VGP que sur une machine portée par une de SES interventions NON
      // ANNULÉES. *Absente du §5.2* — arbitrée avec « clôturer ». La même
      // exception que « machine hors société » (voir le `catch` de la route)
      // fait le refus : distinguer les deux renseignerait un technicien sur
      // l'existence d'une machine hors de son périmètre (D50).
      const perimetre = perimetreParPersonne(
        exigerContexteActif(contexte),
        "enregistrer_vgp",
      );
      if (perimetre.acces === "restreint") {
        const rattachee = await tx.interventionMachine.findFirst({
          where: {
            machine_id: saisie.machine_id,
            intervention: {
              technicien_id: perimetre.technicienId,
              statut: { not: "annulee" },
            },
          },
          select: { id: true },
        });
        if (rattachee === null) {
          throw new Error(
            "Machine hors du périmètre du technicien : aucune intervention " +
              "non annulée ne la lui rattache.",
          );
        }
      }
      await tx.vgpVerification.create({
        data: {
          id,
          societe_id: societeId,
          machine_id: saisie.machine_id,
          date_verification: saisie.date_verification,
          organisme: saisie.organisme,
          reference_rapport: saisie.reference_rapport,
          origine: saisie.origine,
          document_id: saisie.document_id,
        },
      });
      if (saisie.observations.length > 0) {
        await tx.vgpObservation.createMany({
          data: saisie.observations.map((libelle) => ({
            id: uuidv7(),
            societe_id: societeId,
            verification_id: id,
            libelle,
          })),
        });
      }
      return tx.vgpVerification.findUniqueOrThrow({
        where: { id },
        select: CHAMPS_VERIFICATION,
      });
    },
    client,
  );
}

/**
 * LA DERNIÈRE INFORMATION REÇUE PAR MACHINE — ce que le registre attendait.
 *
 * **C'est la date de VÉRIFICATION qui compte, jamais celle de la saisie.** Une
 * vignette relevée aujourd'hui peut porter une vérification d'il y a onze mois,
 * et c'est elle qui décide de la prochaine échéance. *Trier sur `cree_le`
 * rendrait le registre dépendant de l'ordre où on l'a rempli.*
 */
export async function dernieresInformations(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ReadonlyMap<string, Date>> {
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpVerification.groupBy({
        by: ["machine_id"],
        _max: { date_verification: true },
      }),
    client,
  );
  const parMachine = new Map<string, Date>();
  for (const ligne of lignes) {
    const date = ligne._max.date_verification;
    if (date !== null) {
      parMachine.set(ligne.machine_id, date);
    }
  }
  return parMachine;
}

/**
 * LE REGISTRE A-T-IL DÉJÀ REÇU NE SERAIT-CE QU'UNE VÉRIFICATION (lot AV-14,
 * 19/09/2026) ?
 *
 * **Pourquoi cette question, distincte de `dernieresInformations`** :
 * `compterAPrevoir` (`lib/vgp/registre.ts`) rend 0 aussi bien quand rien n'est
 * dû dans l'horizon que quand AUCUNE machine n'a jamais été contrôlée — deux
 * situations que rien ne distingue dans le seul chiffre. La première est une
 * bonne nouvelle mesurée ; la seconde dit que le registre n'a encore rien à
 * mesurer, ce qui n'est pas la même chose (doctrine §3, « nommer les refus » —
 * même famille que `taux_occupation_non_calcule`). Une existence, jamais un
 * compte : la question n'a besoin que d'une ligne.
 */
export async function auMoinsUneVerificationEnregistree(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<boolean> {
  const ligne = await avecContexteApplicatif(
    contexte,
    (tx) => tx.vgpVerification.findFirst({ select: { id: true } }),
    client,
  );
  return ligne !== null;
}

/**
 * LES RAPPORTS D'UNE MACHINE — le fil de ce qu'on nous a dit (L9-09).
 *
 * *Un compte portail retrouve les rapports de SES machines, et rien d'autre* :
 * la forme « filiation » le tient, et aucune clause n'est écrite ici.
 */
export async function verificationsDeLaMachine(
  contexte: ContexteSession,
  machineId: string,
  client?: PrismaClient,
): Promise<readonly FicheVerification[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.vgpVerification.findMany({
        where: { machine_id: machineId },
        select: CHAMPS_VERIFICATION,
        // LA PLUS RÉCENTE D'ABORD : c'est celle qu'on cherche, et l'ordre est
        // celui de la VÉRIFICATION, jamais de la saisie.
        orderBy: [{ date_verification: "desc" }, { id: "desc" }],
      }),
    client,
  );
}
