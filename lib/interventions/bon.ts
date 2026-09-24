import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { type Fuseau } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  photosDeLIntervention,
  type PhotoIntervention,
} from "@/lib/documents/depot";
import { t } from "@/lib/i18n/fr";
import {
  derniereSignature,
  prestationsRealisees,
  type PrestationRealisee,
  type Signature,
} from "@/lib/interventions/depot-rapport-terrain";
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
  /** L'adresse du site, mise en une ligne — `null` : ni adresse ni commune. */
  readonly adresseSite: string | null;
  /** Le contact sur place (PARCOURS-1) — `null` : aucun n'est désigné. */
  readonly contact: string | null;
  readonly agence: string | null;
  /**
   * LES MACHINES IDENTIFIÉES DU BON (BON-3) — `marque référence — N° série
   * XXX`, à la différence de `libellesDesMachines` (`lib/machines/depot.ts`),
   * qui ne rend jamais le numéro de série (plusieurs exemplaires du même
   * modèle y resteraient indiscernables). *Un bon remis au client identifie
   * la machine précise sur laquelle le technicien est intervenu* — c'est
   * l'objet même de ce lot, et une seconde lecture de « quelles machines »
   * qui omettrait le numéro de série y manquerait.
   */
  readonly machinesIdentifiees: readonly string[];
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

  // ── LES CINQ BLOCS DE BON-2 — jamais `undefined`, une liste vide se lit ──
  readonly prestationsRealisees: readonly PrestationRealisee[];
  readonly commentaireTechnicien: string | null;
  readonly suiteADonner: string | null;
  readonly photos: readonly PhotoIntervention[];
  readonly signature: Signature | null;
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
  const base = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id, ...restrictionParPersonne(contexte) },
        select: {
          ...CHAMPS_LIGNE,
          commentaire_technicien: true,
          suite_a_donner: true,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true, adresse: true, commune: true } },
          agence: {
            select: {
              libelle: true,
              fuseau_horaire: true,
              societe: { select: { fuseau_horaire: true } },
            },
          },
          forfait: { select: { libelle: true } },
          contact: { select: { nom: true } },
        },
      });
      if (ligne === null) {
        return null;
      }
      const {
        client,
        site,
        agence,
        forfait,
        contact,
        commentaire_technicien,
        suite_a_donner,
        ...brute
      } = ligne;

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

      // ── LES MACHINES IDENTIFIÉES (BON-3) — lues dans CETTE requête, jamais
      // par `libellesDesMachines` (`lib/machines/depot.ts`), qui répond à une
      // autre question et n'a pas à changer pour celle-ci.
      const machineIds = [...new Set(brute.machines.map((m) => m.machine_id))];
      const machinesBrutes =
        machineIds.length === 0
          ? []
          : await tx.machine.findMany({
              where: { id: { in: machineIds } },
              select: {
                id: true,
                numero_serie: true,
                modele: { select: { marque: true, reference: true } },
              },
            });
      const libellesIdentifies = new Map(
        machinesBrutes.map((m) => [
          m.id,
          `${m.modele.marque} ${m.modele.reference} — ${t("intervention.bon.numero_serie")} ${m.numero_serie}`,
        ]),
      );
      const machinesIdentifiees = brute.machines
        .map((m) => libellesIdentifies.get(m.machine_id))
        .filter((libelle): libelle is string => libelle !== undefined);

      return {
        ligne: brute,
        client: client.raison_sociale,
        site: site.libelle,
        adresseSite: formatAdresseSite(site.adresse, site.commune),
        contact: contact?.nom ?? null,
        agence: agence.libelle,
        machinesIdentifiees,
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
        commentaireTechnicien: commentaire_technicien,
        suiteADonner: suite_a_donner,
      };
    },
    connexion,
  );
  if (base === null) {
    return null;
  }

  // ── LES TROIS BLOCS RESTANTS DE BON-2, HORS DE LA TRANSACTION CI-DESSUS ──
  //
  // `prestationsRealisees`, `photosDeLIntervention` et `derniereSignature`
  // ouvrent chacun LEUR PROPRE contexte applicatif (`avecContexteApplicatif`
  // attend un `PrismaClient`, jamais le `Prisma.TransactionClient` déjà
  // ouvert ci-dessus — les imbriquer romprait sur `tx.$transaction`, qui
  // n'existe pas sur un client de transaction). Le coût est trois
  // allers-retours de plus sur une page qui n'en fait qu'une poignée ; le
  // réécrire en une seule transaction dupliquerait la lecture de
  // l'intervention que chacune fait déjà pour son propre cloisonnement.
  const [prestations, photos, signature] = await Promise.all([
    prestationsRealisees(contexte, id, connexion),
    photosDeLIntervention(contexte, id, connexion),
    derniereSignature(contexte, id, connexion),
  ]);

  return {
    ...base,
    prestationsRealisees: prestations ?? [],
    photos: photos ?? [],
    signature,
  };
}

/** Le nom d'un technicien sur un segment — le nom, jamais l'identifiant (I10). */
function nomDuSegment(utilisateurId: string, annuaire: Annuaire): string {
  const designation = annuaire(utilisateurId);
  return designation.etat === "nom" ? designation.nom : "—";
}

/**
 * L'ADRESSE D'UN SITE, MISE EN UNE LIGNE (BON-3).
 *
 * La rue vient de `site.adresse` — même convention que `agence.adresse` et
 * `client.adresse_facturation` (une clé `rue`, libre pour le reste : le
 * chapitre 11.2 ne fixe aucune forme à une adresse calédonienne). La commune
 * vient de la colonne dédiée, `site.commune`, jamais du JSON : c'est elle que
 * le chapitre 11.2 nomme séparément.
 *
 * `null` seulement quand NI l'une NI l'autre n'est renseignée — jamais une
 * ligne vide sur un bon remis au client, et jamais `undefined`.
 */
export function formatAdresseSite(
  adresse: Prisma.JsonValue | null,
  commune: string | null,
): string | null {
  const rue = ruePlate(adresse);
  const partieCommune =
    commune !== null && commune.trim().length > 0 ? commune.trim() : null;
  if (rue === null) {
    return partieCommune;
  }
  return partieCommune === null ? rue : `${rue}, ${partieCommune}`;
}

function ruePlate(adresse: Prisma.JsonValue | null): string | null {
  if (
    adresse === null ||
    typeof adresse !== "object" ||
    Array.isArray(adresse)
  ) {
    return null;
  }
  const rue = (adresse as Record<string, Prisma.JsonValue>).rue;
  return typeof rue === "string" && rue.trim().length > 0 ? rue.trim() : null;
}
