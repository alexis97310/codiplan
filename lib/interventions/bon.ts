import type { PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { type Fuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { montant, type Montant } from "@/lib/money";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";

import { mesurer, type Segment } from "./compteur";
import {
  CHAMPS_LIGNE,
  instantDeLAgence,
  montantDuForfait,
  restrictionParPersonne,
  type LigneIntervention,
} from "./depot";

/**
 * LE BON D'INTERVENTION IMPRIMABLE (lot 16, BON-1) — CE QUE LA BASE PORTE DÉJÀ.
 *
 * ## Ce module ne calcule rien de nouveau
 *
 * L'heure d'arrivée et de départ NE SE SAISIT PAS : elle se LIT sur
 * `segment_travail`, par technicien. Le taux se lit À LA DATE DE
 * L'INTERVENTION, par `tauxEnVigueur` — jamais « le taux actuel » — pour
 * qu'un bon réimprimé dans six mois rende le même montant qu'au jour de la
 * visite. Le montant total est celui que la clôture a déjà figé
 * (`intervention.montant_ht`) : ce module ne recompose ni la main-d'œuvre, ni
 * la majoration, ni l'arrondi — `lib/tarification/valorisation.ts` les a déjà
 * faits une fois, et un bon qui referait ce calcul en serait une seconde
 * lecture (§9, 01/09).
 *
 * ## Le montant total dépend d'un taux encore lisible AUJOURD'HUI
 *
 * *Un bon réimprimé doit pouvoir se reproduire.* Si `tauxEnVigueur` ne trouve
 * plus, à la date de l'intervention, aucun taux en vigueur — un historique
 * modifié après coup, par exemple —, ce module ne peut plus garantir que le
 * montant figé reste justifiable : le total est alors tu, pas seulement le
 * taux, même si `montant_ht` porte encore une valeur en base. **Zéro n'est
 * jamais la réponse à une valorisation qu'on ne peut plus reconstituer** — le
 * `null` la remplace, et l'écran nomme l'absence plutôt que de l'omettre.
 *
 * ## Les droits sur les montants sont ceux de la fiche, jamais réécrits
 *
 * Ce module rend le taux et le montant SANS décider qui a le droit de les
 * voir : c'est `accesAuxMontants` (`lib/interventions/montants-visibles.ts`)
 * qui tranche, à l'écran, exactement comme sur la fiche — une règle du §5.2
 * ne se réécrit pas une seconde fois ici.
 */

/** Un segment de travail, prêt pour l'affichage — un technicien, un aller. */
export type SegmentBonAffiche = {
  readonly debut: Date;
  readonly fin: Date | null;
  /** `null` quand le segment tourne encore : rien à facturer n'est acquis. */
  readonly minutes: number | null;
  readonly technicien: string;
};

export type BonIntervention = {
  readonly ligne: LigneIntervention;
  readonly client: string | null;
  readonly site: string | null;
  readonly agence: string | null;
  readonly forfaitLibelle: string | null;
  readonly fuseau: Fuseau;
  /**
   * L'en-tête société — la RAISON SOCIALE et ses mentions légales.
   *
   * **Ni le logo ni les couleurs de charte n'y figurent** : `societe.logo_url`
   * est HORS PÉRIMÈTRE (registre des arbitrages, ticket L0-09) — l'afficher
   * suppose un stockage de fichiers, une décision d'architecture à part
   * entière, jamais tranchée. Rien n'est construit ici qui l'anticiperait.
   */
  readonly societe: {
    readonly raisonSociale: string;
    readonly mentionsLegales: string | null;
  };
  readonly devise: {
    readonly code: string;
    readonly decimales: number;
    readonly symbole: string | null;
  };
  readonly segments: readonly SegmentBonAffiche[];
  readonly minutesTotal: number;
  /** `null` : aucun taux horaire n'est en vigueur à la date de l'intervention. */
  readonly taux: Montant | null;
  readonly forfaitMontant: Montant | null;
  /**
   * Le total figé à la clôture — `null` quand il est inconnu OU quand `taux`
   * l'est : voir l'entête du module.
   */
  readonly montantTotal: Montant | null;
};

/**
 * LE BON D'UNE INTERVENTION, par son identifiant. `null` si hors périmètre ou
 * inexistante — les deux se traitent pareil (D35, D50).
 *
 * Le périmètre est celui du planning (`restrictionParPersonne`), le même que
 * `lireFicheIntervention` : un bon n'ouvre pas un accès que la fiche refuse.
 */
export async function lireBonIntervention(
  contexte: ContexteSession,
  id: string,
  connexion?: PrismaClient,
): Promise<BonIntervention | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id, ...restrictionParPersonne(contexte) },
        select: {
          ...CHAMPS_LIGNE,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true } },
          agence: {
            select: {
              libelle: true,
              fuseau_horaire: true,
              societe: { select: { fuseau_horaire: true } },
            },
          },
          forfait: { select: { libelle: true } },
        },
      });
      if (ligne === null) {
        return null;
      }
      const { client, site, agence, forfait, ...brute } = ligne;

      const societe = await tx.societe.findFirst({
        where: { id: contexte.societeId ?? "" },
        select: {
          raison_sociale: true,
          mentions_legales: true,
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      });
      if (societe === null) {
        // Impossible en pratique : la société active porte la politique sous
        // laquelle cette transaction s'exécute déjà (même raisonnement
        // qu'`instantDeLAgence`).
        throw new Error(
          `Société ${contexte.societeId ?? ""} illisible sous le contexte ` +
            "courant : le bon ne peut pas porter son en-tête sans elle.",
        );
      }

      const fuseau = fuseauDeLAgence(agence);
      const dateVisee =
        brute.date_planifiee ?? (await instantDeLAgence(tx, brute.agence_id));

      const segmentsBruts = await tx.segmentTravail.findMany({
        where: { intervention_id: id },
        select: { id: true, utilisateur_id: true, debut: true, fin: true },
        orderBy: [{ debut: "asc" }, { id: "asc" }],
      });
      const annuaire = await annuaireDesPersonnes(
        tx,
        segmentsBruts.map((s) => s.utilisateur_id),
      );
      const segments: readonly SegmentBonAffiche[] = segmentsBruts.map((s) => ({
        debut: s.debut,
        fin: s.fin,
        minutes:
          s.fin === null
            ? null
            : Math.floor((s.fin.getTime() - s.debut.getTime()) / 60_000),
        technicien: nomDuSegment(s.utilisateur_id, annuaire),
      }));
      const mesure = mesurer(
        segmentsBruts.map((s): Segment => ({
          id: s.id,
          debut: s.debut,
          fin: s.fin,
        })),
      );

      const taux = await tauxEnVigueur(tx, dateVisee);
      const forfaitMontant = await montantDuForfait(
        tx,
        brute.forfait_deplacement_id,
      );
      const montantStocke =
        brute.montant_ht === null || brute.devise_code === null
          ? null
          : montant(brute.montant_ht, brute.devise_code);

      return {
        ligne: brute,
        client: client.raison_sociale,
        site: site.libelle,
        agence: agence.libelle,
        forfaitLibelle: forfait?.libelle ?? null,
        fuseau,
        societe: {
          raisonSociale: societe.raison_sociale,
          mentionsLegales: societe.mentions_legales,
        },
        devise: societe.devise,
        segments,
        minutesTotal: mesure.minutes,
        taux: taux?.taux ?? null,
        forfaitMontant,
        // Voir l'entête du module : un taux qu'on ne peut plus reconstituer
        // efface le total, même s'il est encore écrit en base.
        montantTotal: taux === null ? null : montantStocke,
      };
    },
    connexion,
  );
}

/** Le nom d'un technicien sur un segment — le nom, jamais l'identifiant (I10). */
function nomDuSegment(utilisateurId: string, annuaire: Annuaire): string {
  const designation = annuaire(utilisateurId);
  return designation.etat === "nom" ? designation.nom : "—";
}
