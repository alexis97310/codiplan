import {
  type Prisma,
  type PrismaClient,
  type StatutAppareilPret,
} from "@prisma/client";

import { peutPleinement } from "@/lib/auth/habilitations";
import {
  type ContexteSession,
  exigerContexteActif,
  exigerSocieteActive,
} from "@/lib/auth/contexte";
import { lireFuseau, maintenant } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";

import { creerBonPretDans } from "./bon";
import { pretEnRetard, type LignePretPourRetard } from "./retard";
import {
  type SaisieAppareilPret,
  type SaisieRetourPret,
  type SaisieSortiePret,
} from "./saisie";

/**
 * LE DÉPÔT DU PRÊT D'ÉQUIPEMENT (9L60-PRET-1-MODELE, D287).
 *
 * **Aucune comparaison de société n'est écrite ici** : toute lecture et toute
 * écriture passent par `avecContexteApplicatif`, donc sous le contexte
 * cloisonné — c'est la politique RLS qui prononce, jamais une clause recopiée
 * (`appareil_pret` de forme « société », `pret_equipement` de forme
 * « interne »).
 *
 * **La capacité `gerer_prets` est vérifiée ICI, pas seulement à la porte**
 * (même raisonnement que `lib/machines/garde-statut.ts`) : ce lot ne pose
 * aucune route — aucun `lib/auth/porte.ts` n'intercepte encore un appel vers
 * ce module — et une garde qui ne vivrait qu'à un étage qui n'existe pas
 * encore ne garde rien. Le dépôt reste la seule ligne de défense tant que les
 * lots 2 et 3 n'ont pas posé leurs routes ; elles appelleront
 * `exigerCapaciteComplete("gerer_prets")` EN PLUS, jamais à sa place.
 */

export class CapaciteGererPretsRequise extends Error {
  constructor() {
    super("capacite_gerer_prets_requise");
  }
}

export class AppareilIndisponible extends Error {
  constructor() {
    super("appareil_indisponible");
  }
}

export class InterventionIntrouvable extends Error {
  constructor() {
    super("intervention_introuvable");
  }
}

export class RetourAvantSortie extends Error {
  constructor() {
    super("retour_avant_sortie");
  }
}

export class PretIntrouvable extends Error {
  constructor() {
    super("pret_introuvable");
  }
}

export class PretDejaRetourne extends Error {
  constructor() {
    super("pret_deja_retourne");
  }
}

export class AppareilPretIntrouvable extends Error {
  constructor() {
    super("appareil_pret_introuvable");
  }
}

/** Un appareil PRÊTÉ ne bascule pas manuellement (disponible/en révision) — seul le retour le fait sortir de cet état. */
export class StatutAppareilVerrouille extends Error {
  constructor() {
    super("statut_appareil_verrouille");
  }
}

function exigerCapaciteDepot(contexte: ContexteSession): void {
  const { role } = exigerContexteActif(contexte);
  if (!peutPleinement(role, "gerer_prets")) {
    throw new CapaciteGererPretsRequise();
  }
}

export async function creerAppareilPretDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  id: string,
  saisie: SaisieAppareilPret,
): Promise<void> {
  await tx.appareilPret.create({
    data: {
      id,
      societe_id: societeId,
      designation: saisie.designation,
      marque: saisie.marque,
      modele: saisie.modele,
      numero_serie: saisie.numero_serie,
    },
    select: { id: true },
  });
}

export async function creerAppareilPret(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieAppareilPret,
  client?: PrismaClient,
): Promise<void> {
  exigerCapaciteDepot(contexte);
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      creerAppareilPretDans(tx, exigerSocieteActive(contexte), id, saisie),
    client,
  );
}

export type AppareilPretEnListe = {
  readonly id: string;
  readonly designation: string;
  readonly marque: string | null;
  readonly modele: string | null;
  readonly numeroSerie: string | null;
  readonly statut: StatutAppareilPret;
  readonly actif: boolean;
};

export async function listerAppareilsPret(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly AppareilPretEnListe[]> {
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.appareilPret.findMany({
        orderBy: { designation: "asc" },
      }),
    client,
  );
  return lignes.map((ligne) => ({
    id: ligne.id,
    designation: ligne.designation,
    marque: ligne.marque,
    modele: ligne.modele,
    numeroSerie: ligne.numero_serie,
    statut: ligne.statut,
    actif: ligne.actif,
  }));
}

export async function modifierAppareilPret(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieAppareilPret,
  client?: PrismaClient,
): Promise<void> {
  exigerCapaciteDepot(contexte);
  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const resultat = await tx.appareilPret.updateMany({
        where: { id },
        data: {
          designation: saisie.designation,
          marque: saisie.marque,
          modele: saisie.modele,
          numero_serie: saisie.numero_serie,
        },
      });
      if (resultat.count === 0) {
        throw new AppareilPretIntrouvable();
      }
    },
    client,
  );
}

/**
 * ACTIVER OU DÉSACTIVER UN APPAREIL DU PARC (le retirer du choix, jamais le
 * supprimer — même doctrine que le référentiel matériel). L'état visé est
 * ENVOYÉ, jamais déduit d'une bascule (même raison que `lib/materiel/depot.ts`).
 */
export async function basculerActiviteAppareilPret(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<void> {
  exigerCapaciteDepot(contexte);
  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const resultat = await tx.appareilPret.updateMany({
        where: { id },
        data: { actif },
      });
      if (resultat.count === 0) {
        throw new AppareilPretIntrouvable();
      }
    },
    client,
  );
}

/** Les deux seuls statuts qu'un geste MANUEL peut viser — `prete` ne se pose que par la sortie. */
export type StatutManuelAppareilPret = "disponible" | "en_revision";

/**
 * CHANGER MANUELLEMENT LE STATUT D'UN APPAREIL (disponible ↔ en révision).
 * Un appareil `prete` refuse : il est verrouillé par le prêt en cours, et
 * seul le retour (`enregistrerRetourPret`) le fait changer d'état.
 */
export async function changerStatutAppareilPret(
  contexte: ContexteSession,
  id: string,
  statutVise: StatutManuelAppareilPret,
  client?: PrismaClient,
): Promise<void> {
  exigerCapaciteDepot(contexte);
  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const appareil = await tx.appareilPret.findFirst({
        where: { id },
        select: { statut: true },
      });
      if (appareil === null) {
        throw new AppareilPretIntrouvable();
      }
      if (appareil.statut === "prete") {
        throw new StatutAppareilVerrouille();
      }
      await tx.appareilPret.update({
        where: { id },
        data: { statut: statutVise },
        select: { id: true },
      });
    },
    client,
  );
}

/**
 * LA SORTIE D'UN PRÊT. L'appareil doit être `disponible` — un appareil
 * `prete` ou `en_revision` est un refus nommé, jamais une file d'attente
 * silencieuse ; l'index unique partiel de la migration tient la même règle
 * en base pour toute écriture qui ne passerait pas par ici (une course entre
 * deux sorties concurrentes, par exemple).
 *
 * `client_id` et `site_id` sont RECOPIÉS depuis l'intervention désignée, à
 * la sortie, jamais redéduits ensuite (voir le commentaire du modèle
 * `PretEquipement`).
 */
export async function sortirPretDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  id: string,
  saisie: SaisieSortiePret,
  auteurId: string | null,
): Promise<void> {
  if (saisie.date_retour_prevue < saisie.date_sortie) {
    throw new RetourAvantSortie();
  }

  const appareil = await tx.appareilPret.findFirst({
    where: { id: saisie.appareil_id },
    select: { statut: true },
  });
  if (appareil === null || appareil.statut !== "disponible") {
    throw new AppareilIndisponible();
  }

  const intervention = await tx.intervention.findFirst({
    where: { id: saisie.intervention_id },
    select: { client_id: true, site_id: true },
  });
  if (intervention === null) {
    throw new InterventionIntrouvable();
  }

  await tx.pretEquipement.create({
    data: {
      id,
      societe_id: societeId,
      appareil_id: saisie.appareil_id,
      intervention_id: saisie.intervention_id,
      client_id: intervention.client_id,
      site_id: intervention.site_id,
      date_sortie: saisie.date_sortie,
      date_retour_prevue: saisie.date_retour_prevue,
      etat_depart: saisie.etat_depart,
      observations: saisie.observations,
      auteur_sortie_id: auteurId,
    },
    select: { id: true },
  });

  await tx.appareilPret.update({
    where: { id: saisie.appareil_id },
    data: { statut: "prete" },
    select: { id: true },
  });

  // LA REMISE AU CLIENT (9L62-PRET-3-BON-SIGNE) — DANS LA MÊME TRANSACTION
  // que la création ci-dessus : un prêt sans bon ne doit jamais s'observer
  // (I6). `schemaSortiePret` a déjà fermé l'alternative (signature OU
  // motif, jamais aucun, jamais les deux) avant que ce dépôt ne soit appelé.
  await creerBonPretDans(tx, societeId, id, {
    appareilId: saisie.appareil_id,
    interventionId: saisie.intervention_id,
    clientId: intervention.client_id,
    siteId: intervention.site_id,
    etatDepart: saisie.etat_depart,
    dateSortie: saisie.date_sortie,
    dateRetourPrevue: saisie.date_retour_prevue,
    observationsSortie: saisie.observations,
    signature:
      saisie.signature_donnees === null
        ? null
        : {
            nom: saisie.signataire_nom ?? "",
            qualite: saisie.signataire_qualite,
            donnees: saisie.signature_donnees,
          },
    motifAbsenceSignature: saisie.motif_absence_signature,
  });
}

export async function sortirPret(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieSortiePret,
  client?: PrismaClient,
): Promise<void> {
  exigerCapaciteDepot(contexte);
  const { utilisateurId } = exigerContexteActif(contexte);
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      sortirPretDans(
        tx,
        exigerSocieteActive(contexte),
        id,
        saisie,
        utilisateurId,
      ),
    client,
  );
}

/**
 * LE RETOUR D'UN PRÊT. Un prêt déjà retourné, ou introuvable (forgé, ou
 * d'une autre société — la politique RLS de `pret_equipement` le cache
 * déjà), est un refus nommé.
 */
export async function enregistrerRetourPretDans(
  tx: Prisma.TransactionClient,
  pretId: string,
  saisie: SaisieRetourPret,
  auteurId: string | null,
): Promise<void> {
  const pret = await tx.pretEquipement.findFirst({
    where: { id: pretId },
    select: { appareil_id: true, date_sortie: true, date_retour_reelle: true },
  });
  if (pret === null) {
    throw new PretIntrouvable();
  }
  if (pret.date_retour_reelle !== null) {
    throw new PretDejaRetourne();
  }
  if (saisie.date_retour_reelle < pret.date_sortie) {
    throw new RetourAvantSortie();
  }

  await tx.pretEquipement.update({
    where: { id: pretId },
    data: {
      date_retour_reelle: saisie.date_retour_reelle,
      etat_retour: saisie.etat_retour,
      observations: saisie.observations,
      auteur_retour_id: auteurId,
    },
    select: { id: true },
  });

  await tx.appareilPret.update({
    where: { id: pret.appareil_id },
    data: { statut: saisie.en_revision ? "en_revision" : "disponible" },
    select: { id: true },
  });
}

export async function enregistrerRetourPret(
  contexte: ContexteSession,
  pretId: string,
  saisie: SaisieRetourPret,
  client?: PrismaClient,
): Promise<void> {
  exigerCapaciteDepot(contexte);
  const { utilisateurId } = exigerContexteActif(contexte);
  await avecContexteApplicatif(
    contexte,
    (tx) => enregistrerRetourPretDans(tx, pretId, saisie, utilisateurId),
    client,
  );
}

export type PretEnListe = {
  readonly id: string;
  readonly appareilId: string;
  readonly interventionId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly dateSortie: Date;
  readonly dateRetourPrevue: Date;
  readonly dateRetourReelle: Date | null;
  readonly enRetard: boolean;
  /** `null` : le bon n'a pas encore été figé (prêt créé avant 9L62). */
  readonly bonDocumentId: string | null;
  /** Signé par le client, à la différence d'une remise sans signature (motif tracé). */
  readonly signe: boolean;
};

/**
 * Les prêts EN COURS (`date_retour_reelle` NULL), `enRetard` calculé au jour
 * civil de la SOCIÉTÉ active (I7) — jamais à l'horloge UTC du serveur (leçon
 * payée, voir `lib/prets/retard.ts`).
 */
export async function listerPretsEnCours(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly PretEnListe[]> {
  const societeId = exigerSocieteActive(contexte);

  const { lignes, aujourdhuiLocal } = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const societe = await tx.societe.findUniqueOrThrow({
        where: { id: societeId },
        select: { fuseau_horaire: true },
      });
      const lignes = await tx.pretEquipement.findMany({
        where: { date_retour_reelle: null },
        orderBy: { date_retour_prevue: "asc" },
      });
      return {
        lignes,
        aujourdhuiLocal: maintenant(lireFuseau(societe.fuseau_horaire)).local,
      };
    },
    client,
  );

  return lignes.map((ligne) => {
    const pourRetard: LignePretPourRetard = {
      dateRetourPrevue: ligne.date_retour_prevue,
      dateRetourReelle: ligne.date_retour_reelle,
    };
    return {
      id: ligne.id,
      appareilId: ligne.appareil_id,
      interventionId: ligne.intervention_id,
      clientId: ligne.client_id,
      siteId: ligne.site_id,
      dateSortie: ligne.date_sortie,
      dateRetourPrevue: ligne.date_retour_prevue,
      dateRetourReelle: ligne.date_retour_reelle,
      enRetard: pretEnRetard(pourRetard, aujourdhuiLocal),
      bonDocumentId: ligne.bon_document_id,
      signe: ligne.signature_objet_cle !== null,
    };
  });
}

/** Les prêts en cours dont le retour prévu est dépassé — même liste, filtrée. */
export async function listerPretsEnRetard(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly PretEnListe[]> {
  const lignes = await listerPretsEnCours(contexte, client);
  return lignes.filter((ligne) => ligne.enRetard);
}

export type PretDuClient = {
  readonly id: string;
  readonly appareilId: string;
  readonly interventionId: string;
  readonly dateSortie: Date;
  readonly dateRetourPrevue: Date;
  readonly dateRetourReelle: Date | null;
  readonly bonDocumentId: string | null;
};

/**
 * LES PRÊTS D'UN CLIENT (en cours ET passés, les vingt plus récents) — la
 * fiche client affiche les deux dans le même bloc, distingués par
 * `dateRetourReelle` (`null` = en cours).
 */
export async function listerPretsDuClient(
  contexte: ContexteSession,
  clientId: string,
  client?: PrismaClient,
): Promise<readonly PretDuClient[]> {
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.pretEquipement.findMany({
        where: { client_id: clientId },
        orderBy: { date_sortie: "desc" },
        take: 20,
      }),
    client,
  );
  return lignes.map((ligne) => ({
    id: ligne.id,
    appareilId: ligne.appareil_id,
    interventionId: ligne.intervention_id,
    dateSortie: ligne.date_sortie,
    dateRetourPrevue: ligne.date_retour_prevue,
    dateRetourReelle: ligne.date_retour_reelle,
    bonDocumentId: ligne.bon_document_id,
  }));
}

/**
 * LE DOCUMENT DU BON D'UN PRÊT, par l'identifiant DU PRÊT — `null` si le prêt
 * est hors périmètre (la politique « interne » le cache déjà à tout compte
 * portail) ou si son bon n'a pas encore été figé (prêt créé avant 9L62).
 * L'appelant lit ensuite les octets par `lireDocument`
 * (`lib/documents/depot.ts`), jamais une seconde requête ici — la LECTURE des
 * octets reste l'affaire de ce module, pas du nôtre.
 */
export async function bonDocumentIdDuPret(
  contexte: ContexteSession,
  pretId: string,
  client?: PrismaClient,
): Promise<string | null> {
  const pret = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.pretEquipement.findFirst({
        where: { id: pretId },
        select: { bon_document_id: true },
      }),
    client,
  );
  return pret?.bon_document_id ?? null;
}
