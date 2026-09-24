import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import {
  chargerCalendrierAgence,
  fuseauDeLAgence,
} from "@/lib/calendar/agence";
import { maintenant, versLocal } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import { departDuCompteur } from "./accuse";
import {
  peutAccuser,
  peutCloreSansSuite,
  peutQualifier,
  peutTransformer,
  type Verdict,
} from "./cycle-de-vie";
import type { Cloture, Depot } from "./saisie";

/**
 * LE DÉPÔT DES DEMANDES (lot 2, L2-06, D102).
 *
 * Toute lecture et toute écriture passent par `avecContexteApplicatif`, donc
 * sous le contexte cloisonné : la politique de forme « parc » décide, et rien
 * n'est recomparé au-dessus d'elle. *Une comparaison de société ou de client
 * écrite ici serait une seconde lecture d'un même critère, qui diverge en
 * silence* (§9, 01/09) — et c'est ce qui fait que le même appel sert l'écran
 * interne et le portail, comme pour le parc (R2-21).
 *
 * Ce module ne DÉCIDE pas des règles : le cycle de vie est dans
 * `cycle-de-vie.ts`, la mesure de l'accusé dans `accuse.ts`.
 */

/**
 * La fenêtre de jours particuliers chargée pour dater le départ du compteur.
 *
 * Quatorze jours : le départ est l'ouverture SUIVANTE, et le pire cas
 * raisonnable est une fermeture annuelle courte encadrée de week-ends. **Ce
 * n'est pas un délai métier** — aucune règle ne s'appuie dessus ; c'est une
 * borne de LECTURE, et si elle ne suffisait pas, `departDuCompteur` rendrait un
 * départ trop précoce plutôt qu'une erreur. *La borne est donc écrite ici, avec
 * son sens de défaillance, plutôt que laissée à deviner.*
 */
const JOURS_DE_FENETRE = 14;
const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Ce qu'une ligne de la file de qualification porte, une fois lue. */
export const CHAMPS_DEMANDE = {
  id: true,
  numero: true,
  statut: true,
  source: true,
  urgence: true,
  machine_arretee: true,
  description: true,
  date_souhaitee: true,
  client_id: true,
  site_id: true,
  machine_id: true,
  agence_id: true,
  contact_id: true,
  depose_le: true,
  compteur_accuse_le: true,
  accuse_le: true,
  motif_cloture: true,
  close_le: true,
} as const;

export type LigneDemande = Prisma.DemandeGetPayload<{
  select: typeof CHAMPS_DEMANDE;
}>;

/** Un refus rendu à l'appelant, avec la clé qui l'explique à l'écran. */
export type Resultat<T> =
  | { readonly accepte: true; readonly fiche: T }
  | { readonly accepte: false; readonly cle: string };

function refus<T>(verdict: Verdict): Resultat<T> | null {
  return verdict.refuse ? { accepte: false, cle: verdict.cle } : null;
}

/**
 * L'INSTANT COURANT, LU DANS LE FUSEAU DE L'AGENCE — jamais celui de la machine
 * qui exécute (L0-08). C'est le fuseau de l'agence de la demande, parce que
 * c'est lui qui décide de son calendrier de référence (I7, D13).
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
    throw new Error(
      `Agence ${agenceId} illisible sous le contexte courant : l'instant ne ` +
        "peut pas être daté sans son fuseau.",
    );
  }
  return maintenant(fuseauDeLAgence(agence)).instant;
}

/**
 * DÉPOSER une demande.
 *
 * Deux choses sont DÉDUITES et jamais saisies : **l'agence**, qui vient du site
 * (D56), et **le départ du compteur d'accusé**, qui vient du calendrier de
 * cette agence (D13). La seconde dépend de la première, et c'est la raison pour
 * laquelle une demande porte une agence alors que le chapitre 11 ne la nomme
 * pas : *sans elle, « en heures ouvrées de l'agence » n'a pas de sujet.*
 *
 * **Une agence sans calendrier REFUSE**, et ne se rabat pas sur l'instant du
 * dépôt. « Inconnu » n'est pas « ouvert » (I7) : faire partir le compteur tout
 * de suite promettrait une réponse sous 30 minutes un dimanche à 22 h, ce que
 * D13 écarte explicitement. C'est la même décision que celle de la pose
 * (RG-PLA-07), prise pour la même raison.
 */
export async function deposerDemande(
  contexte: ContexteSession,
  saisie: Depot,
  client?: PrismaClient,
): Promise<Resultat<LigneDemande>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      // Le site est lu SOUS le contexte : hors périmètre, la politique rend zéro
      // et l'on refuse ici plutôt que de buter plus bas sur une clé étrangère.
      const site = await tx.site.findFirst({
        where: { id: saisie.site_id, client_id: saisie.client_id },
        select: { id: true, agence_id: true },
      });
      if (site === null) {
        return { accepte: false, cle: "demande.refus.lieu_inconnu" };
      }
      if (site.agence_id === null) {
        return { accepte: false, cle: "demande.refus.lieu_sans_rattachement" };
      }

      const depose = await instantDeLAgence(tx, site.agence_id);
      const calendrier = await chargerCalendrierAgence(tx, {
        societeId: contexte.societeId ?? "",
        agenceId: site.agence_id,
        // La fenêtre part du jour du dépôt et couvre les suivants : le départ du
        // compteur est l'ouverture SUIVANTE, qui peut tomber après un week-end,
        // un férié et un pont. `JOURS_DE_FENETRE` borne la lecture des jours
        // particuliers — la table en couvre plusieurs années et plusieurs
        // territoires, et un départ de compteur n'a que faire de 2028.
        fenetre: {
          du: versLocal(depose, "UTC"),
          au: versLocal(
            new Date(
              depose.getTime() + JOURS_DE_FENETRE * MILLISECONDES_PAR_JOUR,
            ),
            "UTC",
          ),
        },
      });
      if (calendrier === null) {
        return { accepte: false, cle: "demande.refus.agence_sans_calendrier" };
      }

      const fiche = await tx.demande.create({
        data: {
          id: saisie.id.length > 0 ? saisie.id : uuidv7(),
          societe_id: contexte.societeId ?? "",
          source: saisie.source,
          client_id: saisie.client_id,
          site_id: saisie.site_id,
          machine_id: saisie.machine_id,
          contact_id: saisie.contact_id,
          agence_id: site.agence_id,
          description: saisie.description,
          urgence: saisie.urgence,
          machine_arretee: saisie.machine_arretee,
          date_souhaitee: saisie.date_souhaitee,
          depose_le: depose,
          compteur_accuse_le: departDuCompteur(calendrier, depose),
        },
        select: CHAMPS_DEMANDE,
      });
      return { accepte: true, fiche };
    },
    client,
  );
}

/** La demande telle que les contrôles la lisent, ou `null` hors périmètre. */
async function lirePourAction(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<{
  readonly statut: LigneDemande["statut"];
  readonly accuse_le: Date | null;
  readonly agence_id: string;
} | null> {
  return tx.demande.findFirst({
    where: { id },
    select: { statut: true, accuse_le: true, agence_id: true },
  });
}

/**
 * ACCUSER RÉCEPTION — l'horodatage que D13 mesure en heures ouvrées.
 *
 * L'instant est daté dans le fuseau de l'agence, jamais dans celui du serveur.
 * Il n'est écrit qu'une fois : *une mesure qu'on peut repousser ne mesure plus
 * rien* (voir `peutAccuser`).
 */
export async function accuserReception(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<Resultat<LigneDemande>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const demande = await lirePourAction(tx, id);
      if (demande === null) {
        return { accepte: false, cle: "demande.refus.introuvable" };
      }
      const bloque = refus<LigneDemande>(
        peutAccuser(demande.statut, demande.accuse_le),
      );
      if (bloque !== null) {
        return bloque;
      }
      const fiche = await tx.demande.update({
        where: { id },
        data: { accuse_le: await instantDeLAgence(tx, demande.agence_id) },
        select: CHAMPS_DEMANDE,
      });
      return { accepte: true, fiche };
    },
    client,
  );
}

/** QUALIFIER — la demande passe dans la file de transformation. */
export async function qualifierDemande(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<Resultat<LigneDemande>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const demande = await lirePourAction(tx, id);
      if (demande === null) {
        return { accepte: false, cle: "demande.refus.introuvable" };
      }
      const bloque = refus<LigneDemande>(peutQualifier(demande.statut));
      if (bloque !== null) {
        return bloque;
      }
      const fiche = await tx.demande.update({
        where: { id },
        data: { statut: "qualifiee" },
        select: CHAMPS_DEMANDE,
      });
      return { accepte: true, fiche };
    },
    client,
  );
}

/**
 * MARQUER TRANSFORMÉE.
 *
 * Ce module **ne crée pas l'intervention** : le lien vit sur
 * `intervention.demande_id` (chapitre 11), la colonne n'existe pas encore, et
 * fabriquer ici une intervention sans ce lien poserait une transformation que
 * rien ne pourrait relire. *Ce qui est livré est le statut et son verrou ; ce
 * qui manque est nommé plutôt que simulé.*
 */
export async function marquerTransformee(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<Resultat<LigneDemande>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const demande = await lirePourAction(tx, id);
      if (demande === null) {
        return { accepte: false, cle: "demande.refus.introuvable" };
      }
      const bloque = refus<LigneDemande>(peutTransformer(demande.statut));
      if (bloque !== null) {
        return bloque;
      }
      const fiche = await tx.demande.update({
        where: { id },
        data: { statut: "transformee" },
        select: CHAMPS_DEMANDE,
      });
      return { accepte: true, fiche };
    },
    client,
  );
}

/**
 * CLORE SANS SUITE, avec son motif.
 *
 * *Cette information est conservée : elle mesure le service rendu à distance*
 * (chapitre 7/M3). Le motif est exigé par le type, puis par la base — deux
 * verrous qui ne se recouvrent pas.
 */
export async function cloreSansSuite(
  contexte: ContexteSession,
  saisie: Cloture,
  client?: PrismaClient,
): Promise<Resultat<LigneDemande>> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const demande = await lirePourAction(tx, saisie.id);
      if (demande === null) {
        return { accepte: false, cle: "demande.refus.introuvable" };
      }
      const bloque = refus<LigneDemande>(peutCloreSansSuite(demande.statut));
      if (bloque !== null) {
        return bloque;
      }
      const fiche = await tx.demande.update({
        where: { id: saisie.id },
        data: {
          statut: "close_sans_suite",
          motif_cloture: saisie.motif,
          close_le: await instantDeLAgence(tx, demande.agence_id),
        },
        select: CHAMPS_DEMANDE,
      });
      return { accepte: true, fiche };
    },
    client,
  );
}

/**
 * LA FILE DE QUALIFICATION — les demandes qui attendent une décision.
 *
 * Aucun filtre de société ni de client n'est écrit ici : on lit SOUS le
 * contexte, la forme « parc » décide, et c'est ce qui fait que le même appel
 * sert l'ADV et le portail.
 */
export async function demandesOuvertes(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneDemande[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) =>
      tx.demande.findMany({
        where: { statut: { in: ["nouvelle", "qualifiee"] } },
        orderBy: [{ urgence: "asc" }, { depose_le: "asc" }],
        select: CHAMPS_DEMANDE,
      }),
    client,
  );
}

/** Ce qu'`/interventions/nouvelle` lit pour préremplir depuis une demande (68-DEMANDES-2). */
export const CHAMPS_DEMANDE_POUR_CREATION = {
  id: true,
  client_id: true,
  site_id: true,
  machine_id: true,
  contact_id: true,
  description: true,
  urgence: true,
} as const;

export type DemandePourCreation = Prisma.DemandeGetPayload<{
  select: typeof CHAMPS_DEMANDE_POUR_CREATION;
}>;

/**
 * LIRE UNE DEMANDE POUR PRÉREMPLIR UNE CRÉATION D'INTERVENTION (68-DEMANDES-2).
 *
 * Lue SOUS le contexte cloisonné, comme toute lecture de ce module : hors
 * périmètre ou inexistante rendent la MÊME chose, `null` — les distinguer
 * ferait un oracle (D35, D50). C'est ce `null` que l'écran traite comme un
 * paramètre ignoré en silence (LIENS-1), jamais comme une erreur.
 */
export async function lireDemandePourCreation(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<DemandePourCreation | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) =>
      tx.demande.findFirst({
        where: { id },
        select: CHAMPS_DEMANDE_POUR_CREATION,
      }),
    client,
  );
}
