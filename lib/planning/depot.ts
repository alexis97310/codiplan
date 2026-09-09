import { type Prisma } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import {
  type Calendrier,
  type JourLocal,
  chargerCalendrierAgence,
  cleJour,
  jourSuivant,
} from "@/lib/calendar";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  type MotifManquant,
  verdictAffectation,
} from "@/lib/habilitations/affectation";

/**
 * LES DONNÉES DU PLANNING — lues en base, sous le contexte cloisonné
 * (ticket L2-11).
 *
 * **Aucun filtre de société n'est écrit ici**, et c'est le point : tout passe
 * par `avecContexteApplicatif`, qui ouvre la transaction sous le rôle
 * applicatif non propriétaire. `intervention` est de forme « parc » (D82) et
 * `technicien` de forme « société » ; un `findMany` sans `where` ne rend donc
 * que ce que la session a le droit de voir.
 *
 * **Le refus d'affectation est CALCULÉ ici, pas stocké** (D81, D73). L'horloge
 * n'entre pas dans le cloisonnement : une habilitation expirée refuse
 * l'affectation, elle ne masque aucune ligne. Le verdict voyage donc avec son
 * MOTIF jusqu'à l'écran, qui l'affiche à sa place, en oxyde — une affectation
 * refusée ne disparaît jamais en silence.
 */

/** Ce qu'une colonne du planning porte : un technicien et sa grille. */
export type ColonneTechnicien = {
  readonly id: string;
  readonly nom: string;
  readonly agenceLibelle: string;
  /**
   * Le calendrier qui décide de SES heures — celui de son agence, ou le sien
   * si l'exception par technicien est renseignée (D72, `technicien.calendrier_id`).
   */
  readonly calendrier: Calendrier | null;
  /** Vrai quand ce technicien porte une exception : l'écran le signale. */
  readonly calendrierPropre: boolean;
};

/** La nature d'un bloc — c'est elle qui décide de sa FORME (charte, règle 2). */
export type NatureBloc = "facture" | "forfait" | "trajet" | "interne" | "refus";

/**
 * Une exigence non satisfaite, NOMMÉE.
 *
 * Le domaine (`lib/habilitations/affectation.ts`) raisonne en
 * `habilitation_id` — c'est juste : une règle de gestion ne dépend pas d'un
 * libellé. Mais l'écran doit écrire « habilitation BR absente » (charte,
 * règle 8), et un identifiant technique n'est pas un remède. La traduction se
 * fait ICI, une fois, sur la table déjà lue — jamais dans le composant, qui ne
 * doit pas interroger la base.
 */
export type RefusNomme = {
  readonly code: string;
  readonly libelle: string;
  readonly motif: MotifManquant;
};

/** Un bloc posé sur la grille. */
export type BlocPlanning = {
  readonly id: string;
  readonly techncienId: string;
  readonly nature: NatureBloc;
  readonly titre: string;
  readonly client: string;
  readonly site: string;
  readonly debut: Date;
  readonly fin: Date;
  /**
   * Les exigences bloquantes non satisfaites, NOMMÉES. Vide quand l'affectation
   * passe ; jamais vide quand la nature est « refus », les deux étant produits
   * par le même verdict.
   */
  readonly refus: readonly RefusNomme[];
  /** Les exigences NON bloquantes non satisfaites : un avertissement, pas un refus. */
  readonly avertissements: readonly RefusNomme[];
};

/** Ce que le planning d'une journée rend. */
export type PlanningDuJour = {
  readonly jour: JourLocal;
  readonly colonnes: readonly ColonneTechnicien[];
  readonly blocs: readonly BlocPlanning[];
};

/**
 * Le calendrier d'un technicien : celui de son agence, ou le sien.
 *
 * **L'exception ne remplace que les PLAGES.** Le fuseau et le territoire
 * restent ceux de l'agence — ce sont des faits de lieu, pas d'horaire (D46) —,
 * et les écarts locaux de l'agence continuent de s'appliquer : un technicien
 * qui travaille le samedi ne décrète pas pour autant qu'un férié est ouvré.
 */
async function calendrierDuTechnicien(
  tx: Prisma.TransactionClient,
  parametres: {
    societeId: string;
    agenceId: string;
    calendrierPropreId: string | null;
    jour: JourLocal;
  },
): Promise<Calendrier | null> {
  const base = await chargerCalendrierAgence(tx, {
    societeId: parametres.societeId,
    agenceId: parametres.agenceId,
    fenetre: { du: parametres.jour, au: jourSuivant(parametres.jour) },
  });

  if (base === null || parametres.calendrierPropreId === null) {
    return base;
  }

  const propre = await tx.calendrier.findFirst({
    where: { id: parametres.calendrierPropreId },
    select: {
      code: true,
      plages: {
        select: {
          jour_semaine: true,
          debut_minutes: true,
          fin_minutes: true,
        },
      },
    },
  });

  if (propre === null) {
    return base;
  }

  return { ...base, code: propre.code, plages: propre.plages };
}

/**
 * La nature d'un bloc, déduite de l'intervention et de son verdict.
 *
 * L'ordre des tests est une décision : **le refus l'emporte sur tout le
 * reste.** Une intervention refusée qui serait peinte en « facturé » parce
 * qu'elle est facturable dirait au planificateur qu'elle tient — c'est
 * exactement ce que D73 veut empêcher.
 */
function nature(
  intervention: { mode_valorisation: string; statut_facturation: string },
  bloquee: boolean,
): NatureBloc {
  if (bloquee) {
    return "refus";
  }
  if (intervention.statut_facturation === "non_facturable") {
    return "interne";
  }
  if (intervention.mode_valorisation === "forfait") {
    return "forfait";
  }
  return "facture";
}

/**
 * Le planning d'une journée, pour la société active.
 *
 * `jour` est une date LOCALE : le planning est une journée telle qu'on la vit à
 * l'agence, jamais une fenêtre UTC. Sous UTC+11, les deux ne se recouvrent pas,
 * et prendre l'une pour l'autre décale toute la grille d'un cran (L0-08).
 */
export async function planningDuJour(
  contexte: ContexteSession,
  jour: JourLocal,
): Promise<PlanningDuJour> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const techniciens = await tx.technicien.findMany({
      where: { actif: true },
      select: {
        id: true,
        agence_id: true,
        calendrier_id: true,
        agence: { select: { libelle: true } },
        membre: {
          select: { utilisateur: { select: { nom: true, email: true } } },
        },
      },
      orderBy: { id: "asc" },
    });

    const societeId = contexte.societeId ?? "";

    const colonnes: ColonneTechnicien[] = [];
    for (const technicien of techniciens) {
      colonnes.push({
        id: technicien.id,
        nom:
          technicien.membre.utilisateur.nom ||
          technicien.membre.utilisateur.email,
        agenceLibelle: technicien.agence.libelle,
        calendrier: await calendrierDuTechnicien(tx, {
          societeId,
          agenceId: technicien.agence_id,
          calendrierPropreId: technicien.calendrier_id,
          jour,
        }),
        calendrierPropre: technicien.calendrier_id !== null,
      });
    }

    // La fenêtre est large d'un jour ET DEMI de part et d'autre : une
    // intervention qui commence la veille au soir déborde sur la grille du
    // jour, et l'exclure ici la ferait disparaître de l'écran sans que rien ne
    // le dise. `positionner` rend `null` pour ce qui ne rencontre pas la
    // grille — le tri se fait là, sur la géométrie, pas sur une approximation
    // de date.
    const borne = new Date(`${cleJour(jour)}T00:00:00.000Z`);
    const du = new Date(borne.getTime() - 36 * 3_600_000);
    const au = new Date(borne.getTime() + 60 * 3_600_000);

    const interventions = await tx.intervention.findMany({
      where: {
        creneau_debut: { not: null, gte: du, lte: au },
        technicien_referent_id: { not: null },
        statut: { not: "annulee" },
      },
      select: {
        id: true,
        libelle: true,
        creneau_debut: true,
        creneau_fin: true,
        technicien_referent_id: true,
        mode_valorisation: true,
        statut_facturation: true,
        client: { select: { raison_sociale: true } },
        site: {
          select: {
            libelle: true,
            temps_trajet_min: true,
            habilitations_requises: {
              select: {
                bloquant: true,
                habilitation_id: true,
                habilitation: { select: { code: true, libelle: true } },
              },
            },
          },
        },
        technicien: {
          select: {
            id: true,
            membre: {
              select: {
                habilitations: {
                  select: {
                    habilitation_id: true,
                    date_expiration: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { creneau_debut: "asc" },
    });

    const blocs: BlocPlanning[] = [];
    for (const intervention of interventions) {
      const debut = intervention.creneau_debut;
      const fin = intervention.creneau_fin;
      const technicienId = intervention.technicien_referent_id;
      if (debut === null || fin === null || technicienId === null) {
        continue;
      }

      // RG-PLA-04, évaluée À LA DATE DE L'INTERVENTION et non à celle du jour :
      // une habilitation qui expire demain autorise l'intervention d'hier.
      const requises = intervention.site.habilitations_requises;
      const verdict = verdictAffectation(
        requises.map((ligne) => ({
          habilitation_id: ligne.habilitation_id,
          bloquant: ligne.bloquant,
        })),
        (intervention.technicien?.membre.habilitations ?? []).map((ligne) => ({
          habilitation_id: ligne.habilitation_id,
          date_expiration: ligne.date_expiration,
        })),
        debut,
      );

      // La traduction identifiant → code, sur la table déjà lue.
      const nommer = (
        manquantes: readonly {
          habilitation_id: string;
          motif: MotifManquant;
        }[],
      ): RefusNomme[] =>
        manquantes.map((manquante) => {
          const exigence = requises.find(
            (ligne) => ligne.habilitation_id === manquante.habilitation_id,
          );
          return {
            code: exigence?.habilitation.code ?? "",
            libelle: exigence?.habilitation.libelle ?? "",
            motif: manquante.motif,
          };
        });

      // LE TRAJET EST VISIBLE (D74, charte règle 2). Il est posé AVANT
      // l'intervention, sur la durée que le site déclare, et il porte sa propre
      // nature : hachuré, gris, jamais facturé. Un temps qu'on ne montre pas
      // est un temps qu'on croit gratuit.
      const trajet = intervention.site.temps_trajet_min;
      if (trajet !== null && trajet > 0) {
        blocs.push({
          id: `${intervention.id}-trajet`,
          techncienId: technicienId,
          nature: "trajet",
          titre: intervention.site.libelle,
          client: intervention.client.raison_sociale,
          site: intervention.site.libelle,
          debut: new Date(debut.getTime() - trajet * 60_000),
          fin: debut,
          refus: [],
          avertissements: [],
        });
      }

      blocs.push({
        id: intervention.id,
        techncienId: technicienId,
        nature: nature(intervention, verdict.bloquee),
        titre: intervention.libelle,
        client: intervention.client.raison_sociale,
        site: intervention.site.libelle,
        debut,
        fin,
        refus: nommer(verdict.bloquantes),
        avertissements: nommer(verdict.avertissements),
      });
    }

    return { jour, colonnes, blocs };
  });
}

/**
 * Le fuseau de la société active — la seule chose qui dise QUEL JOUR il est ici.
 *
 * Il est lu en base sous le contexte, jamais déduit du serveur : un serveur en
 * UTC et une agence en UTC+11 ne sont pas le même jour pendant onze heures sur
 * vingt-quatre, et c'est exactement l'erreur que L0-08 a fermée.
 */
export async function fuseauDeLaSocieteActive(
  contexte: ContexteSession,
): Promise<string | null> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      select: { fuseau_horaire: true },
    });
    return societe?.fuseau_horaire ?? null;
  });
}
