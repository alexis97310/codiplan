import { type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerContexteActif } from "@/lib/auth/contexte";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import {
  CHAMPS_LIGNE,
  jugerPose,
  type LigneIntervention,
  type Resultat,
} from "@/lib/interventions/depot";
import {
  anneeDeNumerotation,
  prochainNumero,
} from "@/lib/interventions/numerotation";
import { type Deplacement } from "@/lib/interventions/saisie";

import { cloturer } from "./depot";

/**
 * L'INTERVENTION DE REPRISE (9J18-SUITE-A-DONNER-ECRAN, FLX-6/7/11).
 *
 * **Fichier séparé de `lib/suite-a-donner/depot.ts`** — hors territoire de ce
 * ticket, et déjà figé à ses « quatre fonctions, pas plus » (9J17, D231).
 * Cette écriture-ci est NOUVELLE : elle n'existait pas avant ce ticket.
 *
 * ## LE NOM DU TYPE EST PROVISOIRE
 *
 * `TypeIntervention.reprise` existe déjà — la reprise DE MATÉRIEL (chapitre
 * 11.2), un sens différent du nôtre (une intervention de SUIVI, née d'une
 * suite à donner). Réutiliser cette valeur confondrait les deux dans tout
 * décompte par type. Ce dépôt écrit `curatif` à la place — le plus proche
 * des neuf valeurs existantes — **en attendant la décision d'Alexis au
 * ticket 9J12** (voir la passation de ce ticket).
 *
 * ## LES MÊMES REFUS QU'UNE POSE ORDINAIRE (RG-PLA-03/04/06/07, D106)
 *
 * `jugerPose` est appelée ICI, directement sur `tx`, exactement comme
 * `deplacerIntervention` l'appelle pour écrire et comme la route
 * `verdict-pose` l'appelle pour lire (PG-B1) — **jamais une recopie de ses
 * règles** (§9, 01/09). La ligne qu'elle juge est VIRTUELLE : l'intervention
 * n'existe pas encore, donc rien ne l'exclut par erreur du chevauchement
 * qu'elle calcule déjà correctement sur une ligne absente.
 *
 * ## POURQUOI LE LIEN SE POSE APRÈS LA CRÉATION, PAS AVANT (contrairement à D176)
 *
 * `creerIntervention` fait passer sa Demande « transformée » AVANT d'écrire
 * l'intervention (D176) — la garde porte sur une colonne DE LA MÊME TABLE.
 * Ici, `suite_a_donner.intervention_reprise_id` est une CLÉ ÉTRANGÈRE vers
 * la ligne qu'on s'apprête à créer : la poser avant que la ligne existe
 * violerait la contrainte. La garde contre un double envoi est donc le
 * `updateMany` APRÈS la création, sous condition de statut — s'il ne touche
 * aucune ligne, la fonction lève, et `$transaction` défait la création
 * orpheline (jamais de ligne « reprise » qu'aucune suite ne désigne).
 */

/** Ce que l'écran de replanification soumet — le créneau choisi, jamais l'identité de l'intervention qui naît : elle n'existe pas encore. */
export type SaisieReplanification = Omit<Deplacement, "intervention_id">;

class SuiteDejaReplanifieeError extends Error {}

export async function creerReprise(
  contexte: ContexteSession,
  suiteADonnerId: string,
  saisie: SaisieReplanification,
  client?: PrismaClient,
): Promise<Resultat<LigneIntervention>> {
  try {
    return await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const suite = await tx.suiteADonner.findFirst({
          where: { id: suiteADonnerId },
          select: {
            id: true,
            statut: true,
            intervention_reprise_id: true,
            intervention_origine: {
              select: {
                client_id: true,
                site_id: true,
                agence_id: true,
                priorite: true,
                duree_estimee_min: true,
                forfait_deplacement_id: true,
                suite_a_donner: true,
              },
            },
          },
        });
        if (suite === null) {
          return { accepte: false, cle: "suites_a_donner.refus.inconnue" };
        }
        if (
          suite.statut !== "a_replanifier" ||
          suite.intervention_reprise_id !== null
        ) {
          return {
            accepte: false,
            cle: "suites_a_donner.refus.statut_invalide",
          };
        }
        const origine = suite.intervention_origine;

        // ── LE JUGEMENT, PARTAGÉ AVEC LA POSE ORDINAIRE (PG-B1) ─────────────
        const nouvelId = uuidv7();
        const ligneAJuger = {
          id: nouvelId,
          statut: "a_planifier",
          agence_id: origine.agence_id,
          site_id: origine.site_id,
          duree_estimee_min: origine.duree_estimee_min,
        };
        const deplacement: Deplacement = {
          ...saisie,
          intervention_id: nouvelId,
        };
        const jugement = await jugerPose(
          tx,
          contexte,
          ligneAJuger,
          deplacement,
        );
        if (jugement.verdict.refuse) {
          return {
            accepte: false,
            cle: jugement.verdict.cle,
            confirmable: jugement.confirmable,
          };
        }
        if (jugement.demande === null || jugement.statutApres === null) {
          return { accepte: false, cle: "intervention.refus.inconnue" };
        }
        const demande = jugement.demande;

        const agence = await tx.agence.findFirst({
          where: { id: origine.agence_id },
          select: {
            fuseau_horaire: true,
            societe: { select: { fuseau_horaire: true } },
          },
        });
        if (agence === null) {
          return {
            accepte: false,
            cle: "intervention.refus.lieu_sans_rattachement",
          };
        }
        const societeId = exigerContexteActif(contexte).societeId;
        const annee = anneeDeNumerotation(fuseauDeLAgence(agence));
        const numero = await prochainNumero(tx, {
          societeId,
          nature: "intervention",
          annee,
        });

        const description = `Suite à donner — ${(origine.suite_a_donner ?? "").slice(0, 3900)}`;

        const ligne = await tx.intervention.create({
          data: {
            id: nouvelId,
            societe_id: societeId,
            annee,
            numero,
            client_id: origine.client_id,
            site_id: origine.site_id,
            agence_id: origine.agence_id,
            // VOIR LE DOCBLOCK DE CE FICHIER — `curatif`, jamais `reprise`
            // (déjà pris par la reprise de matériel, chapitre 11.2).
            type: "curatif",
            // FLX-9 : HÉRITÉE, jamais une valeur « urgente » inventée —
            // modifiable par un humain après coup, comme toute priorité.
            priorite: origine.priorite,
            statut: jugement.statutApres,
            description,
            demande_id: null,
            mode_valorisation: "temps_passe",
            forfait_deplacement_id: origine.forfait_deplacement_id,
            duree_estimee_min: saisie.duree_min,
            technicien_id: saisie.technicien_id,
            date_planifiee: saisie.date_planifiee,
            creneau_debut: demande.creneauDebut,
            creneau_fin: demande.creneauFin,
          },
          select: CHAMPS_LIGNE,
        });

        // LE LIEN, APRÈS LA CRÉATION — voir le docblock de ce fichier.
        const lien = await tx.suiteADonner.updateMany({
          where: {
            id: suiteADonnerId,
            statut: "a_replanifier",
            intervention_reprise_id: null,
          },
          data: { intervention_reprise_id: ligne.id },
        });
        if (lien.count === 0) {
          throw new SuiteDejaReplanifieeError();
        }

        return {
          accepte: true,
          fiche: ligne,
          avertissements: jugement.avertissements,
        };
      },
      client,
    );
  } catch (erreur) {
    if (erreur instanceof SuiteDejaReplanifieeError) {
      return { accepte: false, cle: "suites_a_donner.refus.deja_replanifiee" };
    }
    throw erreur;
  }
}

/**
 * LA CLÔTURE AUTOMATIQUE, AU RATTACHEMENT (chaîne FLX, I5) — un déclencheur
 * APPLICATIF, jamais PostgreSQL : c'est une RÈGLE MÉTIER (« une suite n'a
 * plus rien à donner une fois sa reprise terminée »), pas un fait d'audit.
 *
 * Appelée APRÈS qu'une intervention a été clôturée avec succès
 * (`app/api/interventions/[id]/cloturer/route.ts`) : si cette intervention
 * est la REPRISE d'une suite à donner encore ouverte, la suite se clôt à son
 * tour, dans un SECOND temps — deux transactions, jamais une seule, pour la
 * même raison que `cloturer` (`lib/suite-a-donner/depot.ts`) ne reçoit
 * jamais le `tx` d'un autre dépôt (voir son propre docblock).
 */
export async function cloturerSuiteSiReprise(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<void> {
  const suite = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.suiteADonner.findFirst({
        where: {
          intervention_reprise_id: interventionId,
          statut: { not: "cloturee" },
        },
        select: { id: true },
      }),
    client,
  );
  if (suite !== null) {
    await cloturer(contexte, suite.id, client);
  }
}
