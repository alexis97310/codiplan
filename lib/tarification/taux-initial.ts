import type { PrismaClient } from "@prisma/client";

import {
  cleJour,
  jourDe,
  lireCleJour,
  lireFuseau,
  maintenant,
} from "@/lib/calendar/fuseau";
import { avecSociete } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { lireDevise, montant, type Devise, type Montant } from "@/lib/money";

/**
 * LE PREMIER TAUX HORAIRE D'UNE SOCIÉTÉ — geste d'exploitation séparé
 * (décision du 09/09/2026, registre de la journée §4 ; D68, RG-TAR-04).
 *
 * ## Pourquoi un geste À PART, et non une étape de l'amorçage
 *
 * L'exploitation avait proposé que le geste d'amorçage écrive la première
 * ligne de `taux_horaire` à sa propre date. Le SENS tenait — pour une société
 * vendue plus tard, « le jour où elle entre en service » est bien le jour de
 * son amorçage. Ce qui ne tenait pas était le COUPLAGE DES DÉFAILLANCES : un
 * problème de tarif aurait bloqué le seul chemin d'entrée dans le produit, ou
 * bien le geste aurait cessé d'être atomique. Et deux verrous sans rapport dans
 * un même geste finissent par être relus l'un pour l'autre. **Séparé**, a
 * tranché l'exploitation.
 *
 * ## Ce que ce geste écrit, et ce qu'il refuse
 *
 * UNE ligne de `taux_horaire` : le montant fourni, dans la devise de la société
 * — jamais une devise choisie —, à la date fournie ou, à défaut, au jour
 * courant **dans le fuseau de la société** (L0-08 : la date du jour ne se lit
 * jamais sans dire où). Il **refuse si la société porte déjà un taux**, quel
 * qu'il soit : c'est un geste de MISE EN SERVICE, pas un geste de tarification.
 * Une hausse, une correction, un second taux passent par le chemin ordinaire
 * (L1-07), qui porte l'historique.
 *
 * *Rejouable sans dégât* : le second appel refuse, lisiblement, et n'écrit rien.
 *
 * ## Ce qu'il n'invente PAS
 *
 * Ni le montant, ni la date. Le montant est une décision de rang 1 (D68 :
 * 7 000 XPF HT pour CODIMA NC), la date est celle de la mise en service —
 * toutes deux sont FOURNIES par l'exploitation au moment du geste. Un défaut
 * codé ici serait une valeur monétaire promue par un script (§8).
 *
 * Le montant est reçu dans l'UNITÉ LA PLUS FINE de la devise, comme la table
 * le porte (I3) : `7000` pour 7 000 XPF, `6500` pour 65,00 EUR. Le geste rend
 * le montant formaté dans sa devise pour qu'une erreur d'échelle se VOIE.
 */

/** Ce que le geste refuse, avec le motif. */
export class RefusTauxInitial extends Error {}

/** Ce que le geste rend, une fois la ligne écrite. */
export type TauxInitialPose = {
  readonly societe: string;
  /** Jour local `AAAA-MM-JJ`, dans le fuseau de la société. */
  readonly dateEffet: string;
  readonly taux: Montant;
  /** La devise, lue au référentiel : de quoi formater le montant (D19). */
  readonly devise: Devise;
};

/**
 * Pose le premier taux horaire d'une société.
 *
 * @param client client Prisma sous le rôle APPLICATIF ; la politique de
 *   `taux_horaire` est de forme « société », et le geste passe dessous.
 */
export async function poserTauxInitial(
  client: PrismaClient,
  demande: {
    readonly societeId: string;
    /** Entier, dans l'unité la plus fine de la devise de la société. */
    readonly montantMineur: bigint;
    /** Jour local `AAAA-MM-JJ` ; à défaut, le jour courant dans le fuseau de la société. */
    readonly dateEffet?: string;
  },
): Promise<TauxInitialPose> {
  if (demande.montantMineur <= BigInt(0)) {
    throw new RefusTauxInitial(
      `Un taux horaire de ${demande.montantMineur} est refusé : le montant ` +
        "doit être strictement positif. Un taux à zéro se lirait « gratuit », " +
        "et un taux manquant ne se lit jamais gratuit (L1-07).",
    );
  }

  return avecSociete(client, demande.societeId, async (tx) => {
    // `societe` est de forme « identité » (D42) : elle ne se lit qu'en étant
    // nommée, et c'est ce qui permet de refuser LISIBLEMENT une société
    // inconnue plutôt que de buter sur une politique.
    const societe = await tx.societe.findUnique({
      where: { id: demande.societeId },
      select: {
        raison_sociale: true,
        fuseau_horaire: true,
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    });
    if (societe === null) {
      throw new RefusTauxInitial(
        `Aucune société ne porte l'identifiant ${demande.societeId}. Le geste ` +
          "nomme la société : il ne la cherche pas, et ne la crée pas.",
      );
    }

    // LE CLIQUET : un seul taux initial, et c'est la table qui le dit. Lue sous
    // le contexte de la société, elle ne rend que les siens.
    const existants = await tx.tauxHoraire.count();
    if (existants > 0) {
      throw new RefusTauxInitial(
        `La société « ${societe.raison_sociale} » porte déjà un taux horaire : ` +
          "ce geste n'écrit que le PREMIER. Une hausse ou une correction passe " +
          "par le chemin ordinaire, qui porte l'historique (RG-TAR-04).",
      );
    }

    // LA DATE : fournie, ou le jour courant DANS LE FUSEAU DE LA SOCIÉTÉ. Un
    // taux est un jour, pas un instant ; et « aujourd'hui » à Nouméa n'est pas
    // « aujourd'hui » à Paris.
    const fuseau = lireFuseau(societe.fuseau_horaire);
    const jour =
      demande.dateEffet === undefined
        ? jourDe(maintenant(fuseau).local)
        : lireCleJour(demande.dateEffet);
    const dateEffet = cleJour(jour);

    const devise = lireDevise(societe.devise);
    await tx.tauxHoraire.create({
      data: {
        id: uuidv7(),
        societe_id: demande.societeId,
        date_effet: new Date(`${dateEffet}T00:00:00.000Z`),
        montant_mineur: demande.montantMineur,
        // La devise est celle de la SOCIÉTÉ, jamais un paramètre : le
        // déclencheur de la table refuserait une autre de toute façon (L1-07).
        devise_code: devise.code,
      },
    });

    return {
      societe: societe.raison_sociale,
      dateEffet,
      taux: montant(demande.montantMineur, devise.code),
      devise,
    };
  });
}
