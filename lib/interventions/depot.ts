import { Prisma } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { fuseauDeLAgence } from "@/lib/calendar/agence";
import { maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { verdictAffectation } from "@/lib/habilitations/affectation";
import { montant, type Montant } from "@/lib/money";
import { forfaitApplicable } from "@/lib/tarification/forfaits";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";
import { valoriserTempsPasse } from "@/lib/tarification/valorisation";

import {
  peutAffecter,
  peutAnnuler,
  peutCloturer,
  peutDeplacer,
  statutALaCreation,
  type Verdict,
} from "./cycle-de-vie";
import type {
  Annulation,
  Cloture,
  Creation,
  Deplacement,
  StatutIntervention,
} from "./saisie";

/**
 * LE DÉPÔT DES INTERVENTIONS (lot 2, D84).
 *
 * Toute lecture et toute écriture passent par `avecContexteApplicatif`, donc
 * sous le contexte cloisonné : la politique de forme « parc » décide, et rien
 * n'est recomparé au-dessus d'elle. *Une comparaison de société écrite ici
 * serait une seconde lecture d'un même critère, qui diverge en silence.*
 *
 * Ce module ne DÉCIDE pas des règles — il les applique. Le cycle de vie est
 * dans `cycle-de-vie.ts`, l'habilitation dans `lib/habilitations`, l'arrondi et
 * le plancher dans `lib/tarification/valorisation.ts`.
 */

/** Ce qu'une ligne de planning porte, une fois lue. */
export const CHAMPS_LIGNE = {
  id: true,
  numero: true,
  statut: true,
  type: true,
  priorite: true,
  date_planifiee: true,
  creneau_debut: true,
  creneau_fin: true,
  duree_estimee_min: true,
  technicien_id: true,
  client_id: true,
  site_id: true,
  machine_id: true,
  agence_id: true,
  mode_valorisation: true,
  forfait_deplacement_id: true,
  temps_reel_min: true,
  montant_ht: true,
  devise_code: true,
  motif_annulation: true,
} as const;

export type LigneIntervention = Prisma.InterventionGetPayload<{
  select: typeof CHAMPS_LIGNE;
}>;

/** Un refus rendu à l'appelant, avec la clé qui l'explique à l'écran. */
export type Resultat<T> =
  | { readonly accepte: true; readonly fiche: T }
  | {
      readonly accepte: false;
      readonly cle: string;
      readonly details?: string;
    };

function refus<T>(verdict: Verdict): Resultat<T> | null {
  return verdict.refuse ? { accepte: false, cle: verdict.cle } : null;
}

/**
 * L'INSTANT COURANT, LU DANS LE FUSEAU DE L'AGENCE — jamais celui de la machine
 * qui exécute (L0-08).
 *
 * L'appel direct au constructeur de date lirait l'heure de l'APPAREIL. Le
 * serveur est à Sydney, l'agence est à Nouméa, et un technicien en déplacement
 * est ailleurs encore : « la date du jour » n'a de sens qu'accompagnée du
 * fuseau où on la lit. C'est le fuseau de l'agence de l'intervention, parce que
 * c'est lui qui décide de son calendrier de référence (I7).
 */
async function instantDeLAgence(
  tx: Prisma.TransactionClient,
  agenceId: string,
): Promise<Date> {
  const agence = await tx.agence.findFirst({
    where: { id: agenceId },
    select: {
      fuseau_horaire: true,
      societe: { select: { fuseau_horaire: true } },
    },
  });
  if (agence === null) {
    // La politique a refusé l'agence : impossible en pratique, la clé étrangère
    // la garantit dans la même société. On ne fabrique pas d'heure pour autant.
    throw new Error(
      `Agence ${agenceId} illisible sous le contexte courant : l'instant ne ` +
        "peut pas être daté sans son fuseau.",
    );
  }
  return maintenant(fuseauDeLAgence(agence)).instant;
}

/**
 * CRÉER une intervention depuis le planning.
 *
 * Trois choses sont DÉDUITES et jamais saisies : l'agence (du site), le forfait
 * de déplacement (de la zone du site), et le statut (du créneau).
 */
export async function creerIntervention(
  contexte: ContexteSession,
  saisie: Creation,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    // Le site est lu SOUS le contexte : s'il n'appartient pas au périmètre, la
    // politique rend zéro et l'on refuse ici plutôt que de buter plus bas.
    const site = await tx.site.findFirst({
      where: { id: saisie.site_id, client_id: saisie.client_id },
      select: { id: true, agence_id: true, zone_geo: true },
    });
    if (site === null) {
      return { accepte: false, cle: "intervention.refus.lieu_inconnu" };
    }
    if (site.agence_id === null) {
      return {
        accepte: false,
        cle: "intervention.refus.lieu_sans_rattachement",
      };
    }

    const forfaitId = await forfaitDeDeplacement(
      tx,
      site.zone_geo,
      saisie.type,
    );

    const ligne = await tx.intervention.create({
      data: {
        id: saisie.id.length > 0 ? saisie.id : uuidv7(),
        societe_id: contexte.societeId ?? "",
        client_id: saisie.client_id,
        site_id: saisie.site_id,
        machine_id: saisie.machine_id,
        agence_id: site.agence_id,
        type: saisie.type,
        priorite: saisie.priorite,
        statut: statutALaCreation(saisie.creneau_debut),
        date_planifiee: saisie.date_planifiee,
        creneau_debut: saisie.creneau_debut,
        creneau_fin: saisie.creneau_fin,
        duree_estimee_min: saisie.duree_estimee_min,
        technicien_id: saisie.technicien_id,
        mode_valorisation: saisie.mode_valorisation,
        forfait_deplacement_id: forfaitId,
      },
      select: CHAMPS_LIGNE,
    });
    return { accepte: true, fiche: ligne };
  });
}

/**
 * Le forfait de déplacement applicable, DÉDUIT de la zone du site.
 *
 * La liste des forfaits est lue sous le contexte, puis filtrée par la règle
 * déjà écrite et déjà éprouvée de RG-TAR-06. **Le premier applicable l'emporte**
 * — le catalogue naît vide, et le jour où deux forfaits de déplacement se
 * disputeront la même zone, ce sera un arbitrage, pas un `orderBy` choisi ici.
 */
async function forfaitDeDeplacement(
  tx: Prisma.TransactionClient,
  zone: string | null,
  typeIntervention: string,
): Promise<string | null> {
  const candidats = await tx.forfait.findMany({
    where: { type: "deplacement", actif: true },
    select: {
      id: true,
      zone_geo: true,
      famille_id: true,
      type_intervention: true,
    },
    orderBy: { code: "asc" },
  });
  const retenu = candidats.find((f) =>
    forfaitApplicable(f, {
      zone,
      familleId: null,
      typeIntervention,
    }),
  );
  return retenu?.id ?? null;
}

/**
 * AFFECTER un technicien, sous RG-PLA-04 : l'affectation est **bloquée**, pas
 * signalée.
 *
 * Le refus porte la liste des habilitations manquantes, pour que l'écran
 * l'affiche À LA PLACE de l'action, avec sa raison — jamais dans une bannière
 * qu'on ferme.
 */
export async function affecterTechnicien(
  contexte: ContexteSession,
  interventionId: string,
  technicienId: string,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id: interventionId },
      select: {
        id: true,
        statut: true,
        site_id: true,
        agence_id: true,
        date_planifiee: true,
      },
    });
    if (ligne === null) {
      return { accepte: false, cle: "intervention.refus.inconnue" };
    }
    const barriere = refus<LigneIntervention>(
      peutAffecter(ligne.statut as StatutIntervention),
    );
    if (barriere !== null) {
      return barriere;
    }

    const exigences = await tx.siteHabilitationRequise.findMany({
      where: { site_id: ligne.site_id },
      select: { habilitation_id: true, bloquant: true },
    });
    const detenues = await tx.technicienHabilitation.findMany({
      where: { utilisateur_id: technicienId },
      select: { habilitation_id: true, date_expiration: true },
    });
    const verdict = verdictAffectation(
      exigences,
      detenues,
      ligne.date_planifiee ?? (await instantDeLAgence(tx, ligne.agence_id)),
    );
    if (verdict.bloquee) {
      return {
        accepte: false,
        cle: "intervention.refus.habilitation",
        details: verdict.bloquantes
          .map((b) => `${b.habilitation_id} (${b.motif})`)
          .join(", "),
      };
    }

    const misAJour = await tx.intervention.update({
      where: { id: interventionId },
      data: { technicien_id: technicienId },
      select: CHAMPS_LIGNE,
    });
    return { accepte: true, fiche: misAJour };
  });
}

/**
 * DÉPLACER — changer de créneau, changer de technicien, ou les deux.
 *
 * Le journal du déplacement — qui, quand, d'où vers où — n'est pas écrit ici :
 * c'est `journal_audit` qui le porte, par déclencheur, avec les valeurs avant
 * et après (I8, D55). *Un journal écrit par la couche applicative se contourne
 * par une requête ; celui-là non.*
 */
export async function deplacerIntervention(
  contexte: ContexteSession,
  saisie: Deplacement,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id: saisie.intervention_id },
      select: { id: true, statut: true },
    });
    if (ligne === null) {
      return { accepte: false, cle: "intervention.refus.inconnue" };
    }
    const barriere = refus<LigneIntervention>(
      peutDeplacer(ligne.statut as StatutIntervention),
    );
    if (barriere !== null) {
      return barriere;
    }

    const misAJour = await tx.intervention.update({
      where: { id: saisie.intervention_id },
      data: {
        date_planifiee: saisie.date_planifiee,
        creneau_debut: saisie.creneau_debut,
        creneau_fin: saisie.creneau_fin,
        technicien_id: saisie.technicien_id,
        statut:
          saisie.creneau_debut === null
            ? "a_planifier"
            : ligne.statut === "a_planifier"
              ? "planifiee"
              : (ligne.statut as StatutIntervention),
      },
      select: CHAMPS_LIGNE,
    });
    return { accepte: true, fiche: misAJour };
  });
}

/** Ce que la clôture calcule et rend à l'écran, décomposé. */
export type ResultatCloture = {
  readonly ligne: LigneIntervention;
  readonly minutesReelles: number;
  readonly minutesArrondies: number;
  readonly minutesFacturees: number;
  readonly plancherApplique: boolean;
  readonly tauxHoraire: Montant;
  readonly totalHT: Montant;
};

/**
 * CLÔTURER — saisir le temps réel, appliquer D83, figer le total hors taxes.
 *
 * Le taux retenu est celui **en vigueur à la date de l'intervention**, jamais
 * le taux du jour (RG-TAR-04) : une facture qui change quand le tarif change
 * est une facture fausse.
 *
 * Le mode `forfait` n'est pas valorisé ici : son prix ne dépend pas de la
 * durée, et la composition d'un forfait et d'un taux n'est pas tranchée
 * (registre). La clôture reste possible, le total n'est simplement pas calculé.
 */
export async function cloturerIntervention(
  contexte: ContexteSession,
  saisie: Cloture,
): Promise<Resultat<ResultatCloture>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id: saisie.intervention_id },
      select: {
        id: true,
        statut: true,
        agence_id: true,
        date_planifiee: true,
        mode_valorisation: true,
      },
    });
    if (ligne === null) {
      return { accepte: false, cle: "intervention.refus.inconnue" };
    }
    const barriere = refus<ResultatCloture>(
      peutCloturer(ligne.statut as StatutIntervention, saisie.temps_reel_min),
    );
    if (barriere !== null) {
      return barriere;
    }

    const instant = await instantDeLAgence(tx, ligne.agence_id);
    const taux = await tauxEnVigueur(tx, ligne.date_planifiee ?? instant);
    if (taux === null) {
      return { accepte: false, cle: "intervention.refus.taux_absent" };
    }

    const valorisation = valoriserTempsPasse(saisie.temps_reel_min, taux.taux);
    const auTemps = ligne.mode_valorisation !== "forfait";

    const misAJour = await tx.intervention.update({
      where: { id: saisie.intervention_id },
      data: {
        statut: "cloturee",
        temps_reel_min: saisie.temps_reel_min,
        cloturee_le: instant,
        montant_ht: auTemps ? valorisation.mainDoeuvre.valeur : null,
        devise_code: auTemps ? valorisation.mainDoeuvre.devise : null,
      },
      select: CHAMPS_LIGNE,
    });

    return {
      accepte: true,
      fiche: {
        ligne: misAJour,
        minutesReelles: valorisation.minutesReelles,
        minutesArrondies: valorisation.minutesArrondies,
        minutesFacturees: valorisation.minutesFacturees,
        plancherApplique: valorisation.plancherApplique,
        tauxHoraire: taux.taux,
        totalHT: auTemps
          ? valorisation.mainDoeuvre
          : montant(0, taux.taux.devise),
      },
    };
  });
}

/**
 * ANNULER — avec un motif obligatoire. **Une annulation n'efface rien** : la
 * ligne reste, son statut change, le motif est écrit, et le journal d'audit
 * garde la valeur d'avant.
 */
export async function annulerIntervention(
  contexte: ContexteSession,
  saisie: Annulation,
): Promise<Resultat<LigneIntervention>> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id: saisie.intervention_id },
      select: { id: true, statut: true, agence_id: true },
    });
    if (ligne === null) {
      return { accepte: false, cle: "intervention.refus.inconnue" };
    }
    const barriere = refus<LigneIntervention>(
      peutAnnuler(ligne.statut as StatutIntervention),
    );
    if (barriere !== null) {
      return barriere;
    }

    const misAJour = await tx.intervention.update({
      where: { id: saisie.intervention_id },
      data: {
        statut: "annulee",
        motif_annulation: saisie.motif,
        annulee_le: await instantDeLAgence(tx, ligne.agence_id),
      },
      select: CHAMPS_LIGNE,
    });
    return { accepte: true, fiche: misAJour };
  });
}

/** Une ligne de planning, avec ce qu'il faut pour la lire sans l'ouvrir. */
export type LignePlanning = LigneIntervention & {
  readonly client: { raison_sociale: string };
  readonly site: { libelle: string };
};

/**
 * Le planning d'une période — tout ce qui est visible dans le périmètre.
 *
 * Les libellés voyagent avec les lignes : une liste d'UUID n'est pas un
 * planning, et les faire chercher un par un par l'écran ferait autant de
 * requêtes que de lignes.
 */
export async function listerPlanning(
  contexte: ContexteSession,
  du: Date,
  au: Date,
): Promise<readonly LignePlanning[]> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.intervention.findMany({
      where: {
        OR: [
          { date_planifiee: { gte: du, lte: au } },
          // La file d'attente n'a pas de date : elle est du planning quand
          // même, et c'est la ligne « À planifier / File d'attente » de
          // l'annexe D.
          { date_planifiee: null },
        ],
      },
      orderBy: [{ date_planifiee: "asc" }, { creneau_debut: "asc" }],
      select: {
        ...CHAMPS_LIGNE,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true } },
      },
    }),
  );
}

/**
 * LA FICHE COMPLÈTE — libellés lus, et décomposition de D83 sous les yeux.
 *
 * Deux choses que la ligne brute ne porte pas, et que l'écran ne doit pas
 * fabriquer :
 *
 * **Les LIBELLÉS.** Une fiche qui affiche des UUID n'est pas une fiche. Ils
 * sont lus par jointure SOUS le contexte : un identifiant hors périmètre ne
 * rend pas de libellé, et l'écran affiche alors le tiret plutôt qu'un nom
 * qu'il n'a pas le droit de connaître.
 *
 * **La DÉCOMPOSITION de RG-TAR-05 amendée par D83** — temps réel, arrondi au
 * quart d'heure supérieur, plancher d'une heure, temps facturé, taux, total.
 * *C'est la demande explicite de l'exploitation : voir l'arrondi et le plancher
 * s'appliquer sous les yeux.* Elle est calculée par la MÊME fonction que la
 * clôture, jamais recalculée à l'écran — deux lectures d'un même critère
 * divergent en silence (§9, 01/09).
 */
export async function lireFicheIntervention(
  contexte: ContexteSession,
  id: string,
): Promise<{
  readonly ligne: LigneIntervention;
  readonly client: string | null;
  readonly lieu: string | null;
  readonly rattachement: string | null;
  readonly forfait: string | null;
  readonly devise: {
    code: string;
    decimales: number;
    symbole: string | null;
  } | null;
  readonly valorisation: ValorisationAffichee | null;
} | null> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const ligne = await tx.intervention.findFirst({
      where: { id },
      select: {
        ...CHAMPS_LIGNE,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true } },
        agence: { select: { libelle: true } },
        forfait: { select: { libelle: true } },
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    });
    if (ligne === null) {
      return null;
    }
    const { client, site, agence, forfait, devise, ...brute } = ligne;

    let valorisation: ValorisationAffichee | null = null;
    if (brute.temps_reel_min !== null && brute.temps_reel_min > 0) {
      const instant = await instantDeLAgence(tx, brute.agence_id);
      const taux = await tauxEnVigueur(tx, brute.date_planifiee ?? instant);
      if (taux !== null) {
        const v = valoriserTempsPasse(brute.temps_reel_min, taux.taux);
        valorisation = {
          minutesReelles: v.minutesReelles,
          minutesArrondies: v.minutesArrondies,
          minutesFacturees: v.minutesFacturees,
          plancherApplique: v.plancherApplique,
          tauxHoraire: v.tauxHoraire,
          mainDoeuvre: v.mainDoeuvre,
        };
      }
    }

    return {
      ligne: brute,
      client: client.raison_sociale,
      lieu: site.libelle,
      rattachement: agence.libelle,
      forfait: forfait?.libelle ?? null,
      devise,
      valorisation,
    };
  });
}

/** Ce que l'écran affiche du calcul de D83, sans le refaire. */
export type ValorisationAffichee = {
  readonly minutesReelles: number;
  readonly minutesArrondies: number;
  readonly minutesFacturees: number;
  readonly plancherApplique: boolean;
  readonly tauxHoraire: Montant;
  readonly mainDoeuvre: Montant;
};

/**
 * Une intervention, par son identifiant, AVEC SA DEVISE. `null` si hors
 * périmètre.
 *
 * La devise voyage avec le montant, toujours (I2) — et c'est elle qui porte le
 * nombre de décimales (I3). *L'écran ne doit jamais avoir à savoir que le XPF
 * n'en a pas* : le lui faire décider serait un `toFixed(2)` déguisé, écrit une
 * fois ici et faux ailleurs.
 */
export async function lireIntervention(
  contexte: ContexteSession,
  id: string,
): Promise<
  | (LigneIntervention & {
      readonly devise: {
        code: string;
        decimales: number;
        symbole: string | null;
      } | null;
    })
  | null
> {
  return avecContexteApplicatif(contexte, (tx) =>
    tx.intervention.findFirst({
      where: { id },
      select: {
        ...CHAMPS_LIGNE,
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    }),
  );
}
