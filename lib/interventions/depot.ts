import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { type Devise, formatMoney, lireDevise, montant } from "@/lib/money";
import { forfaitApplicable } from "@/lib/tarification/forfaits";
import {
  type LigneTemps,
  type Valorisation,
  valoriser,
} from "@/lib/tarification/valorisation";

/**
 * LA FICHE D'INTERVENTION (ticket L2-14).
 *
 * **Aucun montant n'est calculé ici non plus** : ce module lit, rassemble, et
 * passe à `lib/tarification/valorisation.ts`, qui porte RG-TAR-05, D11, D57 et
 * D74. Il ne fait ensuite que FORMATER, par `formatMoney` — le seul point de
 * passage (I3).
 *
 * **Le taux appliqué est celui de la LIGNE**, jamais le taux courant
 * (RG-TAR-04). Il a été figé à la qualification ; le rappeler depuis
 * `taux_horaire` donnerait une facture qui change quand le tarif change.
 */

/** Une ligne de temps, telle que l'écran la lit. */
export type TempsAffiche = {
  readonly id: string;
  readonly type: "trajet" | "intervention" | "attente" | "pause";
  readonly technicien: string;
  readonly dureeMinutes: number;
  readonly facturable: boolean;
};

/** Une fiche complète, prête à rendre. */
export type FicheIntervention = {
  readonly id: string;
  readonly numero: string | null;
  readonly libelle: string;
  readonly client: string;
  readonly site: string;
  readonly statut: string;
  readonly modeValorisation: string;
  readonly temps: readonly TempsAffiche[];
  readonly valorisation: Valorisation;
  /** Les montants déjà formatés — la devise décide des décimales (I3). */
  readonly montants: {
    readonly mainDOeuvre: string;
    readonly forfaits: string;
    readonly totalHt: string;
    readonly tauxHoraire: string | null;
  };
};

function formater(valeur: bigint, devise: Devise): string {
  return formatMoney(montant(valeur, devise.code), devise);
}

/**
 * Une intervention, désignée par son identifiant.
 *
 * **Elle se NOMME**, elle ne se cherche pas : la politique de forme « parc »
 * décide seule si elle est lisible. Une intervention d'une autre société, d'un
 * autre client ou d'un site hors périmètre rend `null` — et rend LA MÊME chose
 * qu'un identifiant inconnu. Les distinguer ferait un oracle (D35, D50).
 */
export async function lireLaFiche(
  contexte: ContexteSession,
  interventionId: string,
): Promise<FicheIntervention | null> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const intervention = await tx.intervention.findFirst({
      where: { id: interventionId },
      select: {
        id: true,
        numero: true,
        libelle: true,
        statut: true,
        mode_valorisation: true,
        taux_horaire_applique: true,
        forfait_id: true,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true, zone_geo: true } },
        devise: {
          select: {
            code: true,
            libelle: true,
            decimales: true,
            symbole: true,
          },
        },
        forfait: {
          select: {
            code: true,
            libelle: true,
            montant_mineur: true,
            zone_geo: true,
            famille_id: true,
            type_intervention: true,
          },
        },
        temps: {
          select: {
            id: true,
            type: true,
            duree_min: true,
            facturable: true,
            technicien: {
              select: {
                id: true,
                membre: {
                  select: {
                    utilisateur: { select: { nom: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { debut: "asc" },
        },
      },
    });

    if (intervention === null) {
      return null;
    }

    const devise = lireDevise(intervention.devise);

    const lignes: LigneTemps[] = intervention.temps.map((ligne) => ({
      technicienId: ligne.technicien.id,
      type: ligne.type,
      dureeMinutes: ligne.duree_min,
      facturable: ligne.facturable,
    }));

    // Le forfait n'est retenu que si RG-TAR-06 le laisse passer, même quand il
    // est nommé sur la ligne : la condition a pu cesser d'être remplie — un
    // site qui change de zone, par exemple. La règle vit dans
    // `lib/tarification`, et ce module ne la recopie pas.
    const forfait = intervention.forfait;
    const forfaits =
      forfait !== null &&
      forfaitApplicable(
        {
          zone_geo: forfait.zone_geo.length === 0 ? null : forfait.zone_geo,
          famille_id: forfait.famille_id,
          type_intervention:
            forfait.type_intervention.length === 0
              ? null
              : forfait.type_intervention,
        },
        {
          zone: intervention.site.zone_geo,
          familleId: null,
          typeIntervention: null,
        },
      )
        ? [
            {
              code: forfait.code,
              libelle: forfait.libelle,
              montant: montant(forfait.montant_mineur, devise.code),
            },
          ]
        : [];

    const valorisation = valoriser(
      lignes,
      intervention.taux_horaire_applique,
      forfaits,
      devise.code,
    );

    return {
      id: intervention.id,
      numero: intervention.numero,
      libelle: intervention.libelle,
      client: intervention.client.raison_sociale,
      site: intervention.site.libelle,
      statut: intervention.statut,
      modeValorisation: intervention.mode_valorisation,
      temps: intervention.temps.map((ligne) => ({
        id: ligne.id,
        type: ligne.type,
        technicien:
          ligne.technicien.membre.utilisateur.nom ||
          ligne.technicien.membre.utilisateur.email,
        dureeMinutes: ligne.duree_min,
        facturable: ligne.facturable,
      })),
      valorisation,
      montants: {
        mainDOeuvre: formater(valorisation.totalMainDOeuvre.valeur, devise),
        forfaits: formater(valorisation.totalForfaits.valeur, devise),
        totalHt: formater(valorisation.totalHt.valeur, devise),
        tauxHoraire:
          intervention.taux_horaire_applique === null
            ? null
            : formater(intervention.taux_horaire_applique, devise),
      },
    };
  });
}

/** Les interventions du jour, pour offrir un point d'entrée à la fiche. */
export async function listerLesInterventions(
  contexte: ContexteSession,
): Promise<ReadonlyArray<{ id: string; libelle: string; client: string }>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const lignes = await tx.intervention.findMany({
      where: { statut: { not: "annulee" } },
      select: {
        id: true,
        libelle: true,
        client: { select: { raison_sociale: true } },
      },
      orderBy: { creneau_debut: "desc" },
      take: 50,
    });
    return lignes.map((ligne) => ({
      id: ligne.id,
      libelle: ligne.libelle,
      client: ligne.client.raison_sociale,
    }));
  });
}
