import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import type {
  AttributionHabilitation,
  CreationHabilitation,
  ExigenceSite,
  ModificationHabilitation,
} from "./saisie";

/**
 * LE CHEMIN D'ÉCRITURE DES HABILITATIONS (ÉQUIPE-2 ; D9, D60).
 *
 * ## Ce qu'il répare
 *
 * `lib/habilitations/affectation.ts` applique RG-PLA-04 depuis L1-04, et
 * `lib/interventions/depot.ts` l'appelle réellement à l'affectation comme au
 * déplacement — **mesuré, ce chemin lit `technicienHabilitation` et
 * `siteHabilitationRequise` par de vraies requêtes Prisma.** Mais rien
 * n'écrivait ces deux tables hors du seed : aucun référentiel, aucune
 * attribution, aucune exigence. Le verrou mordait sur des données qu'on ne
 * pouvait alimenter qu'à la main, en base. Ce module ouvre les trois écritures
 * — le référentiel, l'attribution datée, l'exigence d'un site.
 *
 * ## `lib/habilitations/affectation.ts` N'EST PAS TOUCHÉ
 *
 * Ce lot alimente le verrou, il ne le modifie pas : aucune ligne de ce fichier
 * n'y touche, et `lib/interventions/**` reste hors périmètre.
 *
 * ## Le précontrôle plutôt que la course à l'erreur
 *
 * `TechnicienHabilitation` et `SiteHabilitationRequise` portent chacune DEUX
 * clés étrangères au-delà de la société — le rattachement (technicien ou
 * site) et l'habilitation. Un `P2003` ne dit pas laquelle des deux a mordu
 * (voir `lib/tarification/depot-forfaits.ts`, qui documente la même limite
 * pour `P2002`). Plutôt que deviner après coup, ce module VÉRIFIE les deux
 * parents avant d'écrire, sous le même contexte cloisonné que l'écriture —
 * *une lecture qui ne voit rien dit « hors société » aussi sûrement qu'une
 * lecture qui ne trouve rien dit « introuvable »* (D35, D50). Seule
 * l'unicité `(societe_id, utilisateur_id, habilitation_id)` —
 * respectivement `(societe_id, site_id, habilitation_id)` — reste confiée à
 * la base, parce qu'aucune lecture préalable ne peut la remplacer sans race.
 */

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";
const ENREGISTREMENT_ABSENT = "P2025";

// ─────────────────────────────────────────────────────────────────────────
// LE RÉFÉRENTIEL
// ─────────────────────────────────────────────────────────────────────────

/** Ce qu'un refus dit sur le référentiel, et il n'en dit jamais plus. */
export type MotifRefusHabilitation =
  /** `(societe_id, code)` — le code est la clé naturelle du référentiel. */
  | "code_pris"
  /** Hors périmètre — il n'est JAMAIS dit si elle existe ailleurs (D50). */
  | "introuvable";

export type ResultatHabilitation =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusHabilitation };

function motifReferentielDeLErreur(
  erreur: unknown,
): MotifRefusHabilitation | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  if (erreur.code === VIOLATION_UNICITE) {
    return "code_pris";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) {
    return "introuvable";
  }
  return null;
}

/** Une habilitation telle qu'un écran la lit. */
export type LigneHabilitation = {
  readonly id: string;
  readonly code: string;
  readonly libelle: string;
  readonly duree_validite_mois: number | null;
  readonly actif: boolean;
};

const CHAMPS_HABILITATION: { readonly [K in keyof LigneHabilitation]: true } = {
  id: true,
  code: true,
  libelle: true,
  duree_validite_mois: true,
  actif: true,
};

/** LE RÉFÉRENTIEL, sous le contexte cloisonné. */
export async function listerHabilitations(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneHabilitation[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.habilitation.findMany({
        select: CHAMPS_HABILITATION,
        // L'ordre est TOTAL, comme au catalogue des prestations : sans le
        // dernier rang, deux habilitations de même code — impossible
        // aujourd'hui — se rangeraient par la place physique des lignes.
        orderBy: [{ code: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Crée une habilitation dans la société active. */
export async function creerHabilitation(
  contexte: ContexteSession,
  saisie: CreationHabilitation,
  client?: PrismaClient,
): Promise<ResultatHabilitation> {
  const id = uuidv7();
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.habilitation.create({
          data: {
            id,
            societe_id: exigerSocieteActive(contexte),
            code: saisie.code,
            libelle: saisie.libelle,
            duree_validite_mois: saisie.duree_validite_mois,
          },
          select: { id: true },
        }),
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifReferentielDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * Modifie une habilitation.
 *
 * `updateMany` plutôt que `update` : zéro ligne touchée n'est pas une erreur
 * technique, c'est la politique qui a refusé — un identifiant hors société et
 * un identifiant inconnu rendent le MÊME refus (D35, D50).
 */
export async function modifierHabilitation(
  contexte: ContexteSession,
  id: string,
  saisie: ModificationHabilitation,
  client?: PrismaClient,
): Promise<ResultatHabilitation> {
  try {
    const touchees = await avecContexteApplicatif(
      contexte,
      (tx) =>
        tx.habilitation.updateMany({
          where: { id },
          data: {
            code: saisie.code,
            libelle: saisie.libelle,
            duree_validite_mois: saisie.duree_validite_mois,
            actif: saisie.actif,
          },
        }),
      client,
    );
    return touchees.count === 0
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifReferentielDeLErreur(erreur);
    if (motif === null) {
      throw erreur;
    }
    return { accepte: false, motif };
  }
}

/**
 * BASCULE L'ACTIVITÉ — la seule façon de retirer une habilitation du choix.
 *
 * Comme le catalogue des prestations : une attribution ou une exigence
 * existante continue de la désigner (`onDelete: Restrict` en base l'interdit
 * de toute façon), et il n'y a pas de suppression.
 */
export async function basculerActiviteHabilitation(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatHabilitation> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) => tx.habilitation.updateMany({ where: { id }, data: { actif } }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, id };
}

// ─────────────────────────────────────────────────────────────────────────
// LES ATTRIBUTIONS — L'HABILITATION D'UN TECHNICIEN
// ─────────────────────────────────────────────────────────────────────────

export type MotifRefusAttribution =
  /** Cette personne n'appartient pas à la société active. */
  | "technicien_hors_societe"
  /** L'habilitation n'appartient pas à la société active, ou n'existe pas. */
  | "habilitation_hors_societe"
  /** `(societe_id, utilisateur_id, habilitation_id)` — déjà attribuée. */
  | "deja_attribuee"
  /** Hors périmètre — jamais dit si l'attribution existe ailleurs (D50). */
  | "introuvable";

export type ResultatAttribution =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusAttribution };

/** Une habilitation détenue par un technicien, telle qu'un écran la lit. */
export type LigneAttribution = {
  readonly id: string;
  readonly habilitation_id: string;
  readonly code: string;
  readonly libelle: string;
  readonly date_obtention: Date;
  /** `null` = n'expire pas — voir `lib/habilitations/saisie.ts`. */
  readonly date_expiration: Date | null;
};

/**
 * LES HABILITATIONS DE PLUSIEURS TECHNICIENS EN UNE LECTURE — expirées
 * COMPRISES, regroupées par technicien.
 *
 * *Une habilitation expirée reste visible et se voit comme expirée, elle ne
 * disparaît pas* (ÉQUIPE-2) — c'est l'écran qui juge l'expiration contre
 * aujourd'hui, cette lecture ne filtre rien.
 *
 * **Une seule requête pour tout l'écran d'équipe**, jamais une par ligne du
 * tableau : le lot PERF a mesuré ce que coûte une lecture répétée dans une
 * boucle, et la leçon vaut ici comme là-bas.
 */
export async function habilitationsDesTechniciens(
  contexte: ContexteSession,
  utilisateurIds: readonly string[],
  client?: PrismaClient,
): Promise<ReadonlyMap<string, readonly LigneAttribution[]>> {
  if (utilisateurIds.length === 0) {
    return new Map();
  }
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.technicienHabilitation.findMany({
        where: { utilisateur_id: { in: [...utilisateurIds] } },
        select: {
          id: true,
          utilisateur_id: true,
          habilitation_id: true,
          date_obtention: true,
          date_expiration: true,
          habilitation: { select: { code: true, libelle: true } },
        },
        orderBy: [{ habilitation_id: "asc" }, { id: "asc" }],
      }),
    client,
  );
  const parTechnicien = new Map<string, LigneAttribution[]>();
  for (const ligne of lignes) {
    const liste = parTechnicien.get(ligne.utilisateur_id) ?? [];
    liste.push({
      id: ligne.id,
      habilitation_id: ligne.habilitation_id,
      code: ligne.habilitation.code,
      libelle: ligne.habilitation.libelle,
      date_obtention: ligne.date_obtention,
      date_expiration: ligne.date_expiration,
    });
    parTechnicien.set(ligne.utilisateur_id, liste);
  }
  return parTechnicien;
}

/**
 * ATTRIBUE une habilitation à un technicien, datée.
 *
 * Les deux parents sont vérifiés AVANT l'écriture — voir l'en-tête du module.
 */
export async function attribuerHabilitation(
  contexte: ContexteSession,
  saisie: AttributionHabilitation,
  client?: PrismaClient,
): Promise<ResultatAttribution> {
  const societeId = exigerSocieteActive(contexte);
  try {
    const id = await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const habilitation = await tx.habilitation.findFirst({
          where: { id: saisie.habilitation_id },
          select: { id: true },
        });
        if (habilitation === null) {
          throw new RefusPrecontrole("habilitation_hors_societe");
        }
        const technicien = await tx.utilisateurSociete.findFirst({
          where: {
            utilisateur_id: saisie.utilisateur_id,
            societe_id: societeId,
          },
          select: { id: true },
        });
        if (technicien === null) {
          throw new RefusPrecontrole("technicien_hors_societe");
        }
        const nouveauId = uuidv7();
        await tx.technicienHabilitation.create({
          data: {
            id: nouveauId,
            societe_id: societeId,
            utilisateur_id: saisie.utilisateur_id,
            habilitation_id: saisie.habilitation_id,
            date_obtention: saisie.date_obtention,
            date_expiration: saisie.date_expiration,
          },
          select: { id: true },
        });
        return nouveauId;
      },
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    if (erreur instanceof RefusPrecontrole) {
      return {
        accepte: false,
        motif: erreur.motif as MotifRefusAttribution,
      };
    }
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === VIOLATION_UNICITE
    ) {
      return { accepte: false, motif: "deja_attribuee" };
    }
    throw erreur;
  }
}

/**
 * RETIRE une attribution — la seule façon de défaire une attribution posée
 * par erreur. Contrairement à la bascule d'activité du référentiel, il n'y a
 * ici aucun passé à préserver : l'attribution elle-même n'est jamais désignée
 * par une autre table (`onDelete: Restrict` protège ses PARENTS, pas elle).
 */
export async function retirerAttribution(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<ResultatAttribution> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) => tx.technicienHabilitation.deleteMany({ where: { id } }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, id };
}

// ─────────────────────────────────────────────────────────────────────────
// LES EXIGENCES — CE QU'UN SITE EXIGE
// ─────────────────────────────────────────────────────────────────────────

export type MotifRefusExigence =
  /** Le site n'appartient pas à la société active, ou n'existe pas. */
  | "site_hors_societe"
  /** L'habilitation n'appartient pas à la société active, ou n'existe pas. */
  | "habilitation_hors_societe"
  /** `(societe_id, site_id, habilitation_id)` — déjà exigée. */
  | "deja_exigee"
  /** Hors périmètre — jamais dit si l'exigence existe ailleurs (D50). */
  | "introuvable";

export type ResultatExigence =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusExigence };

/** Une exigence portée par un site, telle qu'un écran la lit. */
export type LigneExigence = {
  readonly id: string;
  readonly habilitation_id: string;
  readonly code: string;
  readonly libelle: string;
  readonly bloquant: boolean;
};

/** LES EXIGENCES D'UN SITE. */
export async function exigencesDuSite(
  contexte: ContexteSession,
  siteId: string,
  client?: PrismaClient,
): Promise<readonly LigneExigence[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.siteHabilitationRequise.findMany({
        where: { site_id: siteId },
        select: {
          id: true,
          habilitation_id: true,
          bloquant: true,
          habilitation: { select: { code: true, libelle: true } },
        },
        orderBy: [{ habilitation_id: "asc" }, { id: "asc" }],
      }),
    client,
  ).then((lignes) =>
    lignes.map((ligne) => ({
      id: ligne.id,
      habilitation_id: ligne.habilitation_id,
      code: ligne.habilitation.code,
      libelle: ligne.habilitation.libelle,
      bloquant: ligne.bloquant,
    })),
  );
}

/**
 * DÉCLARE une exigence sur un site.
 *
 * Les deux parents sont vérifiés AVANT l'écriture — voir l'en-tête du module.
 * **Une exigence de site ne peut pas désigner l'habilitation d'une autre
 * société** : la lecture du parent se fait sous le MÊME contexte cloisonné
 * que l'écriture, donc dans le même périmètre — une habilitation d'une autre
 * société n'y est simplement pas visible.
 */
export async function creerExigence(
  contexte: ContexteSession,
  saisie: ExigenceSite,
  client?: PrismaClient,
): Promise<ResultatExigence> {
  const societeId = exigerSocieteActive(contexte);
  try {
    const id = await avecContexteApplicatif(
      contexte,
      async (tx) => {
        const habilitation = await tx.habilitation.findFirst({
          where: { id: saisie.habilitation_id },
          select: { id: true },
        });
        if (habilitation === null) {
          throw new RefusPrecontrole("habilitation_hors_societe");
        }
        const site = await tx.site.findFirst({
          where: { id: saisie.site_id },
          select: { id: true },
        });
        if (site === null) {
          throw new RefusPrecontrole("site_hors_societe");
        }
        const nouveauId = uuidv7();
        await tx.siteHabilitationRequise.create({
          data: {
            id: nouveauId,
            societe_id: societeId,
            site_id: saisie.site_id,
            habilitation_id: saisie.habilitation_id,
            bloquant: saisie.bloquant,
          },
          select: { id: true },
        });
        return nouveauId;
      },
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    if (erreur instanceof RefusPrecontrole) {
      return {
        accepte: false,
        motif: erreur.motif as MotifRefusExigence,
      };
    }
    if (
      erreur instanceof Prisma.PrismaClientKnownRequestError &&
      erreur.code === VIOLATION_UNICITE
    ) {
      return { accepte: false, motif: "deja_exigee" };
    }
    throw erreur;
  }
}

/** RETIRE une exigence de site — même raisonnement que `retirerAttribution`. */
export async function retirerExigence(
  contexte: ContexteSession,
  id: string,
  client?: PrismaClient,
): Promise<ResultatExigence> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) => tx.siteHabilitationRequise.deleteMany({ where: { id } }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, id };
}

/**
 * Le refus d'un précontrôle, porté hors de la transaction par une exception
 * — la seule façon de faire annuler l'écriture en cours par `$transaction`
 * sans confondre ce refus avec une vraie erreur Prisma imprévue.
 *
 * `motif` reste un `string` plutôt que l'union exacte de l'appelant :
 * `attribuerHabilitation` et `creerExigence` ne lèvent chacun que LEURS
 * propres motifs, et le typage du retour se fait au point de capture.
 */
class RefusPrecontrole extends Error {
  constructor(public readonly motif: string) {
    super(motif);
  }
}
