import { randomUUID } from "node:crypto";

import { type Prisma, type PrismaClient } from "@prisma/client";

import { type Capacite } from "@/lib/auth/habilitations";
import { type ContexteSession, exigerContexteActif } from "@/lib/auth/contexte";
import {
  comparerJours,
  jourDe,
  jourSuivant,
  lireFuseau,
  maintenant,
  versLocal,
} from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { poserNotification } from "@/lib/notifications/depot";

/**
 * LA SUITE À DONNER (9J17-SUITE-A-DONNER-SCHEMA, D231 ;
 * 9J19-SUITE-A-DONNER-NOTIFICATIONS ; 9K05-SUITES-A-DONNER-DEBLOQUEES).
 *
 * Forme « filiation » (D103) : aucune comparaison de société n'est écrite
 * ici. L'écriture et la lecture passent par `avecContexteApplicatif`, donc
 * sous le contexte cloisonné, et c'est la politique de `suite_a_donner` qui
 * prononce — visible si `intervention_origine_id` l'est.
 *
 * **« Quatre fonctions, pas plus » (9J17) a vécu** : 9J19 en ajoute deux
 * (`devisEnRetard`, `accordAttenduEnRetard`, FLX-2/FLX-3) ; 9K05 ajoute
 * `marquerDevisEnvoye` et BRANCHE les deux restées sans appelant depuis 9J17
 * (`enregistrerAccord`, `marquerPieceRecue`) sur un écran réel — voir leurs
 * docblocks pour la DÉCISION D'ALEXIS du 08/11/2026 : l'ADV mène le dossier
 * de bout en bout, et un accord sans pièce saute directement à
 * `a_replanifier`. **Chaque transition refuse désormais tout statut de
 * départ qui n'est pas le sien** (ÉPREUVE) — elles ne rendent donc plus
 * `void`, mais `ResultatTransitionSuite`.
 *

 * ## LES RELANCES SONT DES LECTURES, JAMAIS UNE TÂCHE PLANIFIÉE
 *
 * `devisEnRetard`/`accordAttenduEnRetard` suivent le même patron que
 * `enRetard` (`lib/interventions/retard.ts`) : calculées À LA VISITE d'un
 * écran, jamais par une file de jobs. Elles POSENT en plus, par effet de
 * bord, une notification interne pour chaque dossier détecté — au plus une
 * par dossier et par événement, un second appel ne la répète pas. Ce n'est
 * PAS la même transaction que la lecture (contrairement à `marquerPieceRecue`
 * ci-dessous) : une relance en double, sur une course très rapide entre deux
 * visites d'écran, est un risque nommé plutôt que caché — rien n'en souffre,
 * aucune donnée métier n'est en jeu, seule une notification interne de plus.
 */

/**
 * LA CAPACITÉ QUI GOUVERNE LES TROIS NOTIFICATIONS DE CE TICKET — ADV et
 * responsable_materiel au ●, même ligne de la matrice que `enregistrerAccord`
 * et `marquerPieceRecue` servent déjà (`lib/auth/habilitations.ts`,
 * `consulter_parc_complet`). Une seule constante : les trois producteurs
 * (FLX-2/3/8) s'alignent automatiquement si la capacité change un jour.
 */
const CAPACITE_RELANCE: Capacite = "consulter_parc_complet";

/** L'instant, daté dans le fuseau de la SOCIÉTÉ active (L0-08). */
async function instantDate(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<Date> {
  const societe = await tx.societe.findUniqueOrThrow({
    where: { id: societeId },
    select: { fuseau_horaire: true },
  });
  return maintenant(lireFuseau(societe.fuseau_horaire)).instant;
}

/**
 * Qualifie la suite à donner d'une intervention : crée la ligne et la fait
 * passer dans le même geste à `qualifiee` (devis en cours, cible de FLX-2).
 * **Aucune autre fonction de ce dépôt ne crée de ligne** — `a_qualifier`
 * reste l'état de naissance porté par le schéma, pour toute ligne qu'un
 * chemin futur insérerait autrement.
 */
export async function qualifierSuite(
  contexte: ContexteSession,
  interventionOrigineId: string,
  client?: PrismaClient,
): Promise<string> {
  const { societeId, utilisateurId } = exigerContexteActif(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const qualifieeLe = await instantDate(tx, societeId);
      await tx.suiteADonner.create({
        data: {
          id,
          societe_id: societeId,
          intervention_origine_id: interventionOrigineId,
          statut: "qualifiee",
          qualifiee_par: utilisateurId,
          qualifiee_le: qualifieeLe,
        },
      });
    },
    client,
  );

  return id;
}

/**
 * LE RÉSULTAT D'UNE TRANSITION DE SUITE À DONNER — jamais de `fiche` : les
 * quatre fonctions ci-dessous ne CRÉENT rien, elles font avancer une ligne
 * déjà posée par `qualifierSuite`. Même forme que `ResultatModificationTechnicien`
 * (`lib/techniciens/depot.ts`).
 */
export type ResultatTransitionSuite =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly cle: string };

/**
 * DEVIS ENVOYÉ (9K05-SUITES-A-DONNER-DEBLOQUEES) : `qualifiee` → `accord_attendu`
 * — le dossier attend désormais la réponse du client. Refuse tout autre
 * statut de départ (ÉPREUVE).
 */
export async function marquerDevisEnvoye(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<ResultatTransitionSuite> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const suite = await tx.suiteADonner.findFirst({
        where: { id },
        select: { statut: true },
      });
      if (suite === null) {
        return { accepte: false, cle: "suites_a_donner.refus.inconnue" };
      }
      if (suite.statut !== "qualifiee") {
        return { accepte: false, cle: "suites_a_donner.refus.pas_qualifiee" };
      }
      await tx.suiteADonner.update({
        where: { id },
        data: { statut: "accord_attendu" },
      });
      return { accepte: true };
    },
    client,
  );
}

/** La réponse du client, à l'issue de l'attente d'accord (cible de FLX-3). */
export type ReponseAccord =
  | {
      readonly reponse: "accord_recu";
      readonly pieceAttendueRef?: string;
      readonly dateDispoPrevue?: Date;
    }
  | { readonly reponse: "sans_suite"; readonly motifSansSuite: string };

/**
 * Enregistre la réponse à l'accord attendu — `accord_attendu` est le SEUL
 * statut de départ légal (ÉPREUVE) :
 *
 *   - `accord_recu` AVEC pièce attendue (RG-INT-06, D117, D231) — reste à
 *     `accord_recu`, en attendant `marquerPieceRecue` ;
 *   - `accord_recu` SANS pièce attendue — DÉCISION D'ALEXIS (08/11/2026) :
 *     passe DIRECTEMENT à `a_replanifier`, l'état qui ouvre la
 *     replanification, sans transiter par `accord_recu` (qui n'aurait alors
 *     plus rien à attendre, et n'ouvrirait jamais la notification
 *     « piece_recue ») ;
 *   - `sans_suite`, avec son motif en texte libre.
 */
export async function enregistrerAccord(
  contexte: ContexteSession,
  id: string,
  reponse: ReponseAccord,
  client?: PrismaClient,
): Promise<ResultatTransitionSuite> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const suite = await tx.suiteADonner.findFirst({
        where: { id },
        select: { statut: true },
      });
      if (suite === null) {
        return { accepte: false, cle: "suites_a_donner.refus.inconnue" };
      }
      if (suite.statut !== "accord_attendu") {
        return {
          accepte: false,
          cle: "suites_a_donner.refus.pas_accord_attendu",
        };
      }
      if (reponse.reponse === "accord_recu") {
        const statutApres =
          reponse.pieceAttendueRef === undefined
            ? "a_replanifier"
            : "accord_recu";
        await tx.suiteADonner.update({
          where: { id },
          data: {
            statut: statutApres,
            motif_sans_suite: null,
            piece_attendue_ref: reponse.pieceAttendueRef ?? null,
            date_dispo_prevue: reponse.dateDispoPrevue ?? null,
          },
        });
      } else {
        await tx.suiteADonner.update({
          where: { id },
          data: {
            statut: "sans_suite",
            motif_sans_suite: reponse.motifSansSuite,
            piece_attendue_ref: null,
            date_dispo_prevue: null,
          },
        });
      }
      return { accepte: true };
    },
    client,
  );
}

/**
 * La pièce attendue arrive (FLX-8, 9J19) : nulle les deux colonnes de
 * l'attente et fait passer le statut à `a_replanifier`, **et pose la
 * notification `piece_recue`, dans la MÊME transaction** — jamais un état
 * fermé de plus pour le dire (D231), et jamais une notification qui
 * survivrait à une transition défaite par une erreur plus bas dans le même
 * appel. Écrite directement sur `tx` (pas `poserNotification`, qui ouvre SA
 * PROPRE transaction) — exactement le choix que `creerReprise`
 * (`lib/suite-a-donner/reprise.ts`) documente pour la même raison.
 *
 * `accord_recu` est le SEUL statut de départ légal (ÉPREUVE, 9K05) — depuis
 * la décision du 08/11/2026, un dossier n'atteint `accord_recu` que s'il
 * porte une attente de pièce (voir `enregistrerAccord`) : cette garde n'est
 * donc jamais contournable par un accord sans pièce qui aurait déjà sauté
 * l'étape.
 */
export async function marquerPieceRecue(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<ResultatTransitionSuite> {
  const { societeId } = exigerContexteActif(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const suite = await tx.suiteADonner.findFirst({
        where: { id },
        select: { statut: true },
      });
      if (suite === null) {
        return { accepte: false, cle: "suites_a_donner.refus.inconnue" };
      }
      if (suite.statut !== "accord_recu") {
        return {
          accepte: false,
          cle: "suites_a_donner.refus.pas_accord_recu",
        };
      }
      await tx.suiteADonner.update({
        where: { id },
        data: {
          statut: "a_replanifier",
          piece_attendue_ref: null,
          date_dispo_prevue: null,
        },
      });
      await tx.notification.create({
        data: {
          id: randomUUID(),
          societe_id: societeId,
          suite_a_donner_id: id,
          evenement: "piece_recue",
          capacite_requise: CAPACITE_RELANCE,
          destinataire_id: null,
        },
      });
      return { accepte: true };
    },
    client,
  );
}

/** Clôture une suite à donner — depuis `a_replanifier` ou `sans_suite`. */
export async function cloturer(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<void> {
  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.suiteADonner.update({
        where: { id },
        data: { statut: "cloturee" },
      }),
    client,
  );
}

type EvenementRelance = "devis_en_retard" | "accord_attendu_en_retard";

type DetectionRetard = {
  readonly statut: "qualifiee" | "accord_attendu";
  readonly evenement: EvenementRelance;
  readonly dateReference: (ligne: {
    readonly qualifiee_le: Date | null;
    readonly modifie_le: Date;
  }) => Date | null;
};

/**
 * Pose la notification d'un dossier en retard, SI ELLE N'EXISTE PAS DÉJÀ —
 * au plus une par (suite à donner, événement), jamais une seconde à chaque
 * revisite de l'écran. Lecture puis écriture en deux temps (pas une seule
 * transaction) : voir le docblock de ce fichier pour le risque nommé.
 */
async function poserNotificationSiAbsente(
  contexte: ContexteSession,
  suiteADonnerId: string,
  evenement: EvenementRelance,
  client?: PrismaClient,
): Promise<void> {
  const existe = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.notification.findFirst({
        where: { suite_a_donner_id: suiteADonnerId, evenement },
        select: { id: true },
      }),
    client,
  );
  if (existe !== null) {
    return;
  }
  await poserNotification(
    contexte,
    evenement,
    { cible: "suite_a_donner", suite_a_donner_id: suiteADonnerId },
    CAPACITE_RELANCE,
    undefined,
    client,
  );
}

/**
 * LE MÉCANISME COMMUN À FLX-2 ET FLX-3 — voir le docblock de ce fichier.
 *
 * Si `delai_relance_suite_jours` est NUL, rend une liste vide SANS RIEN
 * POSER : une absence de réglage n'est pas un réglage à zéro jour. Compare
 * en JOUR CIVIL, dans le fuseau de la société (L0-08) — jamais en instant,
 * même discipline que `jourCivilDeDatePlanifiee`
 * (`lib/interventions/retard.ts`).
 */
async function relancesEnRetard(
  contexte: ContexteSession,
  detection: DetectionRetard,
  client?: PrismaClient,
): Promise<readonly string[]> {
  const { societeId } = exigerContexteActif(contexte);

  const lecture = await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const societe = await tx.societe.findUniqueOrThrow({
        where: { id: societeId },
        select: { fuseau_horaire: true, delai_relance_suite_jours: true },
      });
      if (societe.delai_relance_suite_jours === null) {
        return null;
      }
      const lignes = await tx.suiteADonner.findMany({
        where: { statut: detection.statut },
        select: { id: true, qualifiee_le: true, modifie_le: true },
      });
      return {
        delaiJours: societe.delai_relance_suite_jours,
        fuseau: lireFuseau(societe.fuseau_horaire),
        lignes,
      };
    },
    client,
  );

  if (lecture === null) {
    return [];
  }
  const { delaiJours, fuseau, lignes } = lecture;
  const aujourdhui = jourDe(maintenant(fuseau).local);

  const enRetard = lignes.filter((ligne) => {
    const reference = detection.dateReference(ligne);
    if (reference === null) {
      return false;
    }
    const jourLimite = jourSuivant(
      jourDe(versLocal(reference, fuseau)),
      delaiJours,
    );
    return comparerJours(jourLimite, aujourdhui) < 0;
  });

  for (const ligne of enRetard) {
    await poserNotificationSiAbsente(
      contexte,
      ligne.id,
      detection.evenement,
      client,
    );
  }

  return enRetard.map((ligne) => ligne.id);
}

/**
 * FLX-2 : les dossiers `qualifiee` (devis en cours) sans réponse depuis plus
 * de `delai_relance_suite_jours` jours, comptés depuis `qualifiee_le`.
 */
export async function devisEnRetard(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly string[]> {
  return relancesEnRetard(
    contexte,
    {
      statut: "qualifiee",
      evenement: "devis_en_retard",
      dateReference: (ligne) => ligne.qualifiee_le,
    },
    client,
  );
}

/**
 * FLX-3 : les dossiers `accord_attendu` sans réponse depuis plus de
 * `delai_relance_suite_jours` jours.
 *
 * **Compté depuis `modifie_le`, faute de colonne dédiée** : `suite_a_donner`
 * ne porte aucune date d'entrée dans `accord_attendu` — seule `qualifiee_le`
 * existe, et ce ticket n'en ajoute pas (la transition `qualifiee` →
 * `accord_attendu` reste hors territoire, voir le docblock de ce fichier).
 * `modifie_le` (`@updatedAt`) porte l'instant du dernier changement de la
 * ligne ; tant qu'aucune autre écriture n'intervient avant la réponse,
 * c'est exactement l'instant de l'entrée dans l'état.
 */
export async function accordAttenduEnRetard(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly string[]> {
  return relancesEnRetard(
    contexte,
    {
      statut: "accord_attendu",
      evenement: "accord_attendu_en_retard",
      dateReference: (ligne) => ligne.modifie_le,
    },
    client,
  );
}
