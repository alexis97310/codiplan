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
  piecesRemplacees,
  prestationsRealisees,
  type PieceRemplacee,
  type PrestationRealisee,
  type Signature,
} from "@/lib/interventions/depot-rapport-terrain";
import type { DatesMachine } from "@/lib/machines/depot";
import { montant, type Montant } from "@/lib/money";
import { empreinteDuLogo } from "@/lib/societes/logo";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";

import { mesurer, type Segment } from "./compteur";
import {
  CHAMPS_LIGNE,
  instantDeLAgence,
  lignesConditionsFacturation,
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
  /**
   * LE DÉTAIL DE CHAQUE MACHINE IDENTIFIÉE (9I8C) — même ordre, même
   * longueur que `machinesIdentifiees` ci-dessus (un libellé + ses dates), et
   * jamais une seconde requête : ce module lit déjà `numero_serie` et
   * `modele` dans la MÊME requête, par discipline propre (voir la note
   * ci-dessus et `lireBonIntervention`).
   */
  readonly machinesDetaillees: readonly {
    readonly libelle: string;
    readonly dates: DatesMachine;
  }[];
  readonly forfaitLibelle: string | null;
  readonly fuseau: Fuseau;
  /**
   * LE TECHNICIEN AFFECTÉ (9I7C) — lu même sans aucun segment de travail,
   * à la différence du tableau des segments qui n'existe que pour un temps
   * déjà mesuré. `null` quand aucun technicien n'est affecté : l'écran
   * n'affiche alors AUCUNE ligne, à la différence des autres champs de ce
   * type, qui affichent toujours leur absence (voir l'entête du module).
   */
  readonly technicienAffecte: string | null;
  /**
   * LA DATE DE CLÔTURE (9I7C) — `null` tant que l'intervention n'est pas
   * `cloturee` (une intervention `terminee` ne la porte pas encore). L'écran
   * compose l'en-tête avec elle quand elle existe, et retombe sur
   * `ligne.date_planifiee` sinon — jamais l'inverse : une date de clôture est
   * plus proche du travail réellement fait qu'une date planifiée qui a pu
   * glisser depuis (RÉSERVES-9I7C).
   */
  readonly clotureeLe: Date | null;
  /**
   * L'en-tête société — la RAISON SOCIALE, ses mentions légales, et depuis
   * 9EZ-LOGO-SOCIETE-1 (D87) l'EMPREINTE de son logo, jamais ses octets (même
   * doctrine que `ThemeSociete.logoEmpreinte`, `lib/theme/theme.ts`). Les
   * couleurs de charte, elles, n'y figurent toujours pas — hors périmètre.
   */
  readonly societe: {
    readonly raisonSociale: string;
    readonly mentionsLegales: string | null;
    readonly logoEmpreinte: string | null;
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
  /**
   * LES PIÈCES REMPLACÉES, SAISIE LIBRE (9I7B) — jamais `undefined`, une
   * liste vide se lit. À la différence des quatre blocs ci-dessus, une liste
   * vide N'AFFICHE AUCUNE TUILE (point 4 du ticket) : voir
   * `aSectionPiecesRemplacees`.
   */
  readonly piecesRemplacees: readonly PieceRemplacee[];
  /**
   * LES CONDITIONS DE FACTURATION, SANS AUCUN MONTANT (9I8B-CONDITIONS-DE-
   * FACTURATION-SANS-MONTANT, décisions d'Alexis du 29/10/2026) — COMMENT
   * l'intervention est facturée, jamais combien. Affichée sur LES DEUX
   * versions du bon : la règle initiale de ne montrer aucun montant sur le
   * bon reste entière, ces lignes n'en portent aucun.
   */
  readonly conditionsFacturation: readonly string[];
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
  return composerBon(contexte, id, restrictionParPersonne(contexte), connexion);
}

/**
 * LE BON D'UNE INTERVENTION DU PARC, SOUS LA SEULE POLITIQUE « PARC » (D84,
 * 9J08A-REPRISE-9J08) — pour le portail, qui n'a jamais eu de place dans
 * `restrictionParPersonne` (une fonction du périmètre PAR PERSONNE du
 * back-office et du terrain, étrangère au compte client).
 *
 * Même composition que {@link lireBonIntervention} — `composerBon`, ci-
 * dessous, jamais une seconde écriture — appelée sans restriction
 * supplémentaire : la politique RLS « parc » de `intervention` (D84) est la
 * SEULE porte, exactement comme `ficheInterventionDuParc`/`interventionsDuParc`
 * (`app/(portail)/portail/interventions/depot.ts`), qui ne filtrent jamais non
 * plus par personne.
 *
 * ## `segments` et `technicienAffecte`, DEPUIS 9J22 — ET REVUS PAR 9J22A
 *
 * `segment_travail` ferme sa lecture à `app.client_id IS NULL` (D94, forme
 * « interne ») — **pour tout contexte qui n'est pas celui du client DE
 * l'intervention**. Depuis 9J22 (décision d'Alexis du 06/11/2026), elle porte
 * une politique SUPPLÉMENTAIRE, forme « filiation », scopée à `app.client_id` :
 * un segment se lit QUAND l'intervention qui le porte est elle-même visible à
 * ce client (politique « parc », D84) — jamais autrement.
 *
 * `utilisateur`, elle, N'EST PLUS OUVERTE au portail depuis 9J22A-REPRISE-9J22
 * (décision d'Alexis du 07/11/2026) : la brèche que 9J22 y avait posée rendait
 * TOUTE la ligne d'un technicien (adresse électronique comprise) à son client,
 * et la discipline d'un seul appelant (`lib/auth/annuaire.ts`) n'était pas une
 * garantie de la base. `composerBon` ne l'appelle donc plus sous un contexte
 * client (`contexte.clientId !== null`) : le nom affiché vient de
 * `segment_travail.nom_technicien_affiche`, une recopie posée une seule fois à
 * la naissance du segment (`lib/interventions/depot-compteur.ts`). `segments`
 * se remplit donc normalement sous ce contexte ; `technicienAffecte`, lui, ne
 * se résout QUE si le technicien affecté a lui-même posé un segment de cette
 * intervention — `null` sinon, même pour une intervention par ailleurs visible.
 * Les deux restent `[]`/`null` pour toute intervention hors du périmètre du
 * client — exactement comme `lireBonIntervention` ci-dessus continue de les
 * voir toujours, par l'annuaire, pour le back-office.
 */
export async function lireBonDuParc(
  contexte: ContexteSession,
  id: string,
  connexion?: PrismaClient,
): Promise<BonIntervention | null> {
  return composerBon(contexte, id, {}, connexion);
}

/**
 * LA COMPOSITION DU BON, PARTAGÉE ENTRE LE BACK-OFFICE ET LE PORTAIL
 * (9J08A-REPRISE-9J08) — reçoit la restriction supplémentaire à appliquer sur
 * `intervention`, EN PLUS de l'identifiant : `restrictionParPersonne(contexte)`
 * pour le back-office (inchangé), `{}` pour le portail, qui s'appuie
 * uniquement sur la politique RLS « parc ». Tout ce qui suit le chargement de
 * `ligne` est IDENTIQUE quel que soit l'appelant — jamais une seconde écriture
 * de la mise en forme.
 */
async function composerBon(
  contexte: ContexteSession,
  id: string,
  restriction: Prisma.InterventionWhereInput | undefined,
  connexion?: PrismaClient,
): Promise<BonIntervention | null> {
  const base = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const ligne = await tx.intervention.findFirst({
        where: { id, ...restriction },
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
          cloturee_le: true,
          // LA DÉCOMPOSITION FIGÉE À LA CLÔTURE (9I8A1-REPRISE-9I8A), POUR LA
          // RÈGLE DES CONDITIONS DE FACTURATION (9I8B-CONDITIONS-DE-
          // FACTURATION-SANS-MONTANT) — voir `lignesConditionsFacturation`.
          valorisation_figee: true,
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
        cloturee_le,
        valorisation_figee,
        ...brute
      } = ligne;

      const [societe, logoEmpreinte] = await Promise.all([
        tx.societe.findFirst({
          where: { id: contexte.societeId ?? "" },
          select: {
            raison_sociale: true,
            mentions_legales: true,
            devise: { select: { code: true, decimales: true, symbole: true } },
          },
        }),
        empreinteDuLogo(tx, contexte.societeId ?? ""),
      ]);
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
        select: {
          id: true,
          utilisateur_id: true,
          debut: true,
          fin: true,
          nom_technicien_affiche: true,
        },
        orderBy: [{ debut: "asc" }, { id: "asc" }],
      });
      // SOUS UN CONTEXTE CLIENT, JAMAIS `lib/auth/annuaire.ts` (9J22A-REPRISE-
      // 9J22) — `utilisateur` lui est fermée (la brèche que 9J22 avait
      // ouverte est retirée) ; le nom affiché vient de la recopie que porte
      // CHAQUE segment (voir le docblock de la colonne). Un technicien affecté
      // sans aucun segment de SA main n'a donc, sous ce seul contexte, aucun
      // nom à afficher — `null`, comme toute affectation hors périmètre.
      const contexteClient = contexte.clientId !== null;
      const annuaire = contexteClient
        ? null
        : await annuaireDesPersonnes(tx, [
            ...segmentsBruts.map((s) => s.utilisateur_id),
            ...(brute.technicien_id === null ? [] : [brute.technicien_id]),
          ]);
      const technicienAffecte =
        brute.technicien_id === null
          ? null
          : contexteClient
            ? (segmentsBruts.find(
                (s) => s.utilisateur_id === brute.technicien_id,
              )?.nom_technicien_affiche ?? null)
            : nomDuSegment(brute.technicien_id, annuaire as Annuaire);
      const segments: readonly SegmentBonAffiche[] = segmentsBruts.map((s) => ({
        debut: s.debut,
        fin: s.fin,
        minutes:
          s.fin === null
            ? null
            : Math.floor((s.fin.getTime() - s.debut.getTime()) / 60_000),
        technicien: contexteClient
          ? s.nom_technicien_affiche
          : nomDuSegment(s.utilisateur_id, annuaire as Annuaire),
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
                // LES DATES ET L'ANNÉE DE FABRICATION (9I8C) — pour
                // `machinesDetaillees`, dans CETTE même requête (voir la
                // note de tête de `BonIntervention.machinesDetaillees`).
                annee_fabrication: true,
                date_vente: true,
                date_mise_en_service: true,
                garantie_fin: true,
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
      const datesIdentifiees = new Map(
        machinesBrutes.map((m) => [
          m.id,
          {
            anneeFabrication: m.annee_fabrication,
            dateVente: m.date_vente,
            dateMiseEnService: m.date_mise_en_service,
            garantieFin: m.garantie_fin,
          } satisfies DatesMachine,
        ]),
      );
      const machinesDetaillees = brute.machines
        .map((m) => {
          const libelle = libellesIdentifies.get(m.machine_id);
          const dates = datesIdentifiees.get(m.machine_id);
          return libelle === undefined || dates === undefined
            ? undefined
            : { libelle, dates };
        })
        .filter(
          (detail): detail is { libelle: string; dates: DatesMachine } =>
            detail !== undefined,
        );

      return {
        ligne: brute,
        client: client.raison_sociale,
        site: site.libelle,
        adresseSite: formatAdresseSite(site.adresse, site.commune),
        contact: contact?.nom ?? null,
        agence: agence.libelle,
        machinesIdentifiees,
        machinesDetaillees,
        forfaitLibelle: forfait?.libelle ?? null,
        fuseau,
        technicienAffecte,
        clotureeLe: cloturee_le,
        // INTERNE À CETTE FONCTION, STRIPPÉ AVANT LE RETOUR PUBLIC — sert
        // UNIQUEMENT à `lignesConditionsFacturation` ci-dessous, pour la
        // règle FIGÉE d'une intervention clôturée (9I8B-CONDITIONS-DE-
        // FACTURATION-SANS-MONTANT). `BonIntervention` ne la porte pas : rien
        // d'autre qu'une règle en texte n'en est jamais tiré.
        valorisationFigeeInterne: valorisation_figee,
        societe: {
          raisonSociale: societe.raison_sociale,
          mentionsLegales: societe.mentions_legales,
          logoEmpreinte,
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
  const { valorisationFigeeInterne, ...basePublique } = base;
  const [prestations, photos, signature, pieces, conditionsFacturation] =
    await Promise.all([
      prestationsRealisees(contexte, id, connexion),
      photosDeLIntervention(contexte, id, connexion),
      derniereSignature(contexte, id, connexion),
      piecesRemplacees(contexte, id, connexion),
      // LES CONDITIONS DE FACTURATION, SANS AUCUN MONTANT (9I8B-CONDITIONS-
      // DE-FACTURATION-SANS-MONTANT) — la RÈGLE lue telle qu'elle était à la
      // clôture si elle est figée, sinon celle de la société (voir le
      // docblock de `lignesConditionsFacturation`).
      lignesConditionsFacturation(
        contexte,
        base.ligne,
        base.forfaitLibelle,
        {
          cloturee: base.clotureeLe !== null,
          valorisationFigee: valorisationFigeeInterne,
        },
        connexion,
      ),
    ]);

  return {
    ...basePublique,
    prestationsRealisees: prestations ?? [],
    photos: photos ?? [],
    signature,
    piecesRemplacees: pieces ?? [],
    conditionsFacturation,
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

/**
 * « Désignation (référence) × quantité » (9I7B) — la référence est omise si
 * absente, la quantité si elle vaut 1. AUCUN PRIX : un relevé déclaratif,
 * jamais une ligne de facturation (voir le docblock de la table en migration).
 */
export function libellePieceRemplacee(piece: PieceRemplacee): string {
  const reference =
    piece.reference === null
      ? ""
      : t("ponctuation.parenthese_ouvrante") +
        piece.reference +
        t("ponctuation.parenthese_fermante");
  const quantite =
    piece.quantite === 1
      ? ""
      : t("ponctuation.multiplication") + piece.quantite;
  return `${piece.designation}${reference}${quantite}`;
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
