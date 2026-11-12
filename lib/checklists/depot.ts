import { randomUUID } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
  type ReponseConformite,
  type TypeReponseChecklist,
} from "@prisma/client";

import { annuaireDesPersonnes, type Annuaire } from "@/lib/auth/annuaire";
import {
  exigerContexteActif,
  exigerSocieteActive,
  type ContexteSession,
} from "@/lib/auth/contexte";
import { gabaritDeDepart } from "@/lib/checklists/gabarits-de-depart";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import {
  resoudreGabarit,
  type CandidatGabarit,
  type ContexteResolutionGabarit,
  type GabaritResolu,
} from "@/lib/checklists/cascade";
import {
  etatDeCompletude,
  type EtatCompletude,
  type PointObligatoireManquant,
} from "@/lib/checklists/completude";
import {
  validerReponsePoint,
  type SaisieReponsePoint,
} from "@/lib/checklists/validation-reponse";
import { estFige } from "@/lib/interventions/cycle-de-vie";
import { accesSurCetteIntervention } from "@/lib/interventions/perimetre-technicien";
import type {
  StatutIntervention,
  TypeIntervention as TypeInterventionSaisie,
} from "@/lib/interventions/saisie";

/**
 * LE SOCLE DES CHECKLISTS (9K08-CHECKLIST-SCHEMA, D235) — dépôt MINIMAL :
 * créer un modèle, publier une version, lire la dernière version publiée.
 * Rien d'autre : la cascade de résolution, la saisie terrain et le blocage de
 * « Terminer » sont des lots suivants (CK2, CK5, CK7 — hors territoire ici).
 *
 * `checklist_modele` est de forme « interne » (D94) : aucun compte portail ne
 * lit ce dépôt, et les trois fonctions ci-dessous ne sont donc jamais
 * appelées sous un contexte de portail (`exigerContexteActif` le refuserait
 * de toute façon si `societeId`/`role` manquaient, mais rien n'empêche ICI un
 * contexte portail bien formé — c'est la politique RLS, pas ce module, qui
 * ferme la lecture : un appel sous ce contexte rendrait simplement zéro ligne
 * et zéro écriture acceptée).
 */

/**
 * Un point à poser sur une version, selon son type de réponse.
 *
 * **`choix_dans_une_liste` et `texte_libre` AJOUTÉS par 9K19-CHECKLIST-
 * PARAMETRAGE** (CK3) — le schéma et la migration des cinq types datent de
 * 9K18, mais aucun écran n'appelait encore `publierVersion` pour un point de
 * l'un de ces deux types : l'union n'avait que les trois premiers.
 */
export type SaisiePointChecklist = {
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne?: string;
  readonly obligatoire?: boolean;
} & (
  | { readonly typeReponse: "conforme_non_conforme_sans_objet" }
  | { readonly typeReponse: "case_faite" }
  | {
      readonly typeReponse: "valeur_mesuree";
      readonly unite?: string;
      readonly toleranceMin?: number;
      readonly toleranceMax?: number;
    }
  | {
      readonly typeReponse: "choix_dans_une_liste";
      readonly choix: readonly string[];
    }
  | { readonly typeReponse: "texte_libre" }
  | { readonly typeReponse: "photo" }
);

/**
 * L'en-tête d'un modèle de checklist — rattachements tous FACULTATIFS.
 *
 * `sousTypeId` AJOUTÉ par 9K19-CHECKLIST-PARAMETRAGE : la colonne existe
 * depuis 9K17A (D238), mais `creerModele` ne l'écrivait encore jamais, faute
 * d'écran qui la propose.
 */
export type SaisieModeleChecklist = {
  readonly code: string;
  readonly libelle: string;
  /** VIDE = proposé pour TOUS les types (9K30A, D235 amendée). */
  readonly typesIntervention?: readonly TypeInterventionSaisie[];
  readonly sousTypeId?: string;
  readonly familleId?: string;
  readonly modeleId?: string;
  readonly exigeMachine?: boolean;
};

/** Ce qu'un refus de la base dit d'un modèle de checklist (9K19-CHECKLIST-PARAMETRAGE). */
export type MotifRefusModeleChecklist =
  /** `(societe_id, code)` — le code est la clé naturelle d'un modèle. */
  | "code_pris"
  | "sous_type_hors_societe"
  | "famille_hors_societe"
  | "modele_hors_societe"
  /** `checklist_modele_un_seul_rattachement` (D238) — DEUX niveaux à la fois. */
  | "plus_dun_rattachement"
  | "introuvable";

const VIOLATION_UNICITE = "P2002";
const VIOLATION_CLE_ETRANGERE = "P2003";
const ENREGISTREMENT_ABSENT = "P2025";
const CONTRAINTE_BASE = "P2010";

/**
 * Traduit un refus de la base en motif, pour un MODÈLE DE CHECKLIST — même
 * technique que `motifModele` (`lib/materiel/depot.ts`) : `erreur.message`
 * NOMME la contrainte qui a mordu, et c'est une donnée de Prisma plutôt
 * qu'un texte destiné à un humain.
 */
export function motifModeleChecklist(
  erreur: unknown,
): MotifRefusModeleChecklist | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (erreur.code === VIOLATION_UNICITE) return "code_pris";
  if (
    erreur.code === VIOLATION_CLE_ETRANGERE ||
    erreur.code === CONTRAINTE_BASE
  ) {
    if (/un_seul_rattachement/.test(erreur.message)) {
      return "plus_dun_rattachement";
    }
    if (/sous_type_id_fkey/.test(erreur.message)) {
      return "sous_type_hors_societe";
    }
    if (/famille_id_fkey/.test(erreur.message)) {
      return "famille_hors_societe";
    }
    if (/modele_id_fkey/.test(erreur.message)) {
      return "modele_hors_societe";
    }
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) return "introuvable";
  return null;
}

/** Un point tel qu'il se lit sur une version déjà publiée. */
export type PointPublie = {
  readonly id: string;
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne: string | null;
  readonly obligatoire: boolean;
  readonly typeReponse: string;
  readonly unite: string | null;
  readonly toleranceMin: Prisma.Decimal | null;
  readonly toleranceMax: Prisma.Decimal | null;
  readonly choix: readonly string[];
};

/** Une version publiée, avec ses points dans l'ordre. */
export type VersionPubliee = {
  readonly id: string;
  readonly numero: number;
  readonly publieeLe: Date;
  readonly points: readonly PointPublie[];
};

/** Crée l'en-tête d'un modèle de checklist — NAÎT sans aucune version. */
export async function creerModele(
  contexte: ContexteSession,
  saisie: SaisieModeleChecklist,
  client?: PrismaClient,
): Promise<string> {
  const { societeId } = exigerContexteActif(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistModele.create({
        data: {
          id,
          societe_id: societeId,
          code: saisie.code,
          libelle: saisie.libelle,
          sous_type_id: saisie.sousTypeId ?? null,
          famille_id: saisie.familleId ?? null,
          modele_id: saisie.modeleId ?? null,
          exige_machine: saisie.exigeMachine ?? false,
          types: {
            create: (saisie.typesIntervention ?? []).map((type) => ({
              id: uuidv7(),
              societe_id: societeId,
              type_intervention: type,
            })),
          },
        },
      }),
    client,
  );

  return id;
}

/**
 * Publie une NOUVELLE version — jamais une modification (D235) : le numéro
 * est UN DE PLUS que le dernier déjà publié pour ce modèle, calculé dans la
 * MÊME transaction que l'insertion pour qu'aucune course ne le réutilise.
 */
export async function publierVersion(
  contexte: ContexteSession,
  checklistModeleId: string,
  points: readonly SaisiePointChecklist[],
  client?: PrismaClient,
): Promise<string> {
  const { societeId } = exigerContexteActif(contexte);
  const id = randomUUID();

  await avecContexteApplicatif(
    contexte,
    async (tx) => {
      const derniere = await tx.checklistVersion.findFirst({
        where: { checklist_modele_id: checklistModeleId },
        orderBy: { numero: "desc" },
        select: { numero: true },
      });

      await tx.checklistVersion.create({
        data: {
          id,
          societe_id: societeId,
          checklist_modele_id: checklistModeleId,
          numero: (derniere?.numero ?? 0) + 1,
        },
      });

      await tx.checklistPoint.createMany({
        data: points.map((point) => ({
          id: randomUUID(),
          societe_id: societeId,
          checklist_version_id: id,
          section: point.section,
          ordre: point.ordre,
          libelle: point.libelle,
          consigne: point.consigne ?? null,
          obligatoire: point.obligatoire ?? false,
          type_reponse: point.typeReponse,
          unite:
            point.typeReponse === "valeur_mesuree"
              ? (point.unite ?? null)
              : null,
          tolerance_min:
            point.typeReponse === "valeur_mesuree"
              ? (point.toleranceMin ?? null)
              : null,
          tolerance_max:
            point.typeReponse === "valeur_mesuree"
              ? (point.toleranceMax ?? null)
              : null,
          choix:
            point.typeReponse === "choix_dans_une_liste"
              ? [...point.choix]
              : [],
        })),
      });
    },
    client,
  );

  return id;
}

/** La dernière version publiée d'un modèle (le plus grand numéro), avec ses points. */
export async function dernierVersionPubliee(
  contexte: ContexteSession,
  checklistModeleId: string,
  client?: PrismaClient,
): Promise<VersionPubliee | null> {
  const version = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistVersion.findFirst({
        where: { checklist_modele_id: checklistModeleId },
        orderBy: { numero: "desc" },
        include: { points: { orderBy: { ordre: "asc" } } },
      }),
    client,
  );

  if (version === null) {
    return null;
  }

  return {
    id: version.id,
    numero: version.numero,
    publieeLe: version.publiee_le,
    points: version.points.map((point) => ({
      id: point.id,
      section: point.section,
      ordre: point.ordre,
      libelle: point.libelle,
      consigne: point.consigne,
      obligatoire: point.obligatoire,
      typeReponse: point.type_reponse,
      unite: point.unite,
      toleranceMin: point.tolerance_min,
      toleranceMax: point.tolerance_max,
      choix: point.choix,
    })),
  };
}

/** L'en-tête d'un modèle, pour l'écran qui publie sa version — jamais ses points. */
export type EnTeteModeleChecklist = {
  readonly id: string;
  readonly code: string;
  readonly libelle: string;
};

/** Lit l'en-tête d'un modèle — `null` hors du périmètre (D35, D50). */
export async function obtenirModeleChecklist(
  contexte: ContexteSession,
  checklistModeleId: string,
  client?: PrismaClient,
): Promise<EnTeteModeleChecklist | null> {
  const modele = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistModele.findFirst({
        where: { id: checklistModeleId },
        select: { id: true, code: true, libelle: true },
      }),
    client,
  );
  return modele;
}

/** Toutes les versions d'un modèle, la plus récente d'abord — aperçu en lecture (CK3). */
export async function listerLesVersionsChecklist(
  contexte: ContexteSession,
  checklistModeleId: string,
  client?: PrismaClient,
): Promise<readonly VersionPubliee[]> {
  const versions = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistVersion.findMany({
        where: { checklist_modele_id: checklistModeleId },
        orderBy: { numero: "desc" },
        include: { points: { orderBy: { ordre: "asc" } } },
      }),
    client,
  );

  return versions.map((version) => ({
    id: version.id,
    numero: version.numero,
    publieeLe: version.publiee_le,
    points: version.points.map((point) => ({
      id: point.id,
      section: point.section,
      ordre: point.ordre,
      libelle: point.libelle,
      consigne: point.consigne,
      obligatoire: point.obligatoire,
      typeReponse: point.type_reponse,
      unite: point.unite,
      toleranceMin: point.tolerance_min,
      toleranceMax: point.tolerance_max,
      choix: point.choix,
    })),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PARAMÉTRAGE (9K19-CHECKLIST-PARAMETRAGE, CK3) — la liste des modèles et
// la bascule d'activité. `creerModele`, `publierVersion` et
// `dernierVersionPubliee` ci-dessus sont les trois fonctions que cet écran
// ouvre enfin.
// ═══════════════════════════════════════════════════════════════════════════

/** Le niveau de rattachement d'un modèle — AU PLUS UN (D238), jamais deux. */
export type RattachementChecklist =
  | { readonly niveau: "sous_type"; readonly id: string }
  | { readonly niveau: "famille"; readonly id: string }
  | { readonly niveau: "modele"; readonly id: string }
  | { readonly niveau: "aucun" };

/** Un modèle de checklist tel que l'écran de paramétrage le lit. */
export type LigneModeleChecklist = {
  readonly id: string;
  readonly code: string;
  readonly libelle: string;
  /** VIDE = proposé pour TOUS les types (9K30A, D235 amendée). */
  readonly typesIntervention: readonly TypeInterventionSaisie[];
  readonly rattachement: RattachementChecklist;
  readonly exigeMachine: boolean;
  readonly actif: boolean;
  readonly derniereVersion: {
    readonly numero: number;
    readonly publieeLe: Date;
  } | null;
};

function rattachementDe(modele: {
  readonly sous_type_id: string | null;
  readonly famille_id: string | null;
  readonly modele_id: string | null;
}): RattachementChecklist {
  if (modele.sous_type_id !== null) {
    return { niveau: "sous_type", id: modele.sous_type_id };
  }
  if (modele.famille_id !== null) {
    return { niveau: "famille", id: modele.famille_id };
  }
  if (modele.modele_id !== null) {
    return { niveau: "modele", id: modele.modele_id };
  }
  return { niveau: "aucun" };
}

/** LES MODÈLES, sous le contexte cloisonné — avec la dernière version publiée de chacun. */
export async function listerLesModelesChecklist(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneModeleChecklist[]> {
  const modeles = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistModele.findMany({
        select: {
          id: true,
          code: true,
          libelle: true,
          types: { select: { type_intervention: true } },
          sous_type_id: true,
          famille_id: true,
          modele_id: true,
          exige_machine: true,
          actif: true,
          versions: {
            orderBy: { numero: "desc" },
            take: 1,
            select: { numero: true, publiee_le: true },
          },
        },
        // L'ordre est TOTAL (leçon de L3-03) : sans le dernier rang, deux
        // modèles de même code — impossible aujourd'hui — se rangeraient par
        // la place physique des lignes.
        orderBy: [{ code: "asc" }, { id: "asc" }],
      }),
    client,
  );

  return modeles.map((modele) => ({
    id: modele.id,
    code: modele.code,
    libelle: modele.libelle,
    typesIntervention: modele.types.map(
      (type) => type.type_intervention as TypeInterventionSaisie,
    ),
    rattachement: rattachementDe(modele),
    exigeMachine: modele.exige_machine,
    actif: modele.actif,
    derniereVersion:
      modele.versions[0] === undefined
        ? null
        : {
            numero: modele.versions[0].numero,
            publieeLe: modele.versions[0].publiee_le,
          },
  }));
}

export type ResultatActiviteChecklist =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly motif: "introuvable" };

/**
 * BASCULE L'ACTIVITÉ D'UN MODÈLE — la seule façon de le retirer de la
 * cascade (`resoudreGabarit` ne lit que les modèles `actif: true`). Jamais
 * de suppression : une intervention qui l'a déjà résolu garde sa version
 * figée (`intervention.checklist_version_id`).
 */
export async function basculerActiviteChecklist(
  contexte: ContexteSession,
  checklistModeleId: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatActiviteChecklist> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.checklistModele.updateMany({
        where: { id: checklistModeleId },
        data: { actif },
      }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DUPLIQUER UN MODÈLE, PARTIR D'UN GABARIT DE DÉPART (9K20-CHECKLIST-
// DUPLIQUER-DEPART) — les deux raccourcis de création : recopier la dernière
// version publiée d'un modèle existant, ou partir d'un contenu posé en code
// (`lib/checklists/gabarits-de-depart.ts`). Ni l'un ni l'autre n'écrit les
// points directement : les deux passent par `publierVersion`, qui seule sait
// calculer le numéro de version (D235).
// ═══════════════════════════════════════════════════════════════════════════

/** Convertit un point déjà publié en saisie pour `publierVersion` — la forme
 * que rend la base (`Prisma.Decimal`, `type_reponse` en base) devient celle
 * qu'elle attend en entrée. `typeReponse` est un des six membres de l'enum
 * de base (`TypeReponseChecklist`) : jamais autre chose, la colonne le garde.
 */
function pointPublieEnSaisie(point: PointPublie): SaisiePointChecklist {
  const entete = {
    section: point.section,
    ordre: point.ordre,
    libelle: point.libelle,
    consigne: point.consigne ?? undefined,
    obligatoire: point.obligatoire,
  };
  const typeReponse = point.typeReponse as TypeReponseChecklist;
  switch (typeReponse) {
    case "conforme_non_conforme_sans_objet":
      return { ...entete, typeReponse };
    case "case_faite":
      return { ...entete, typeReponse };
    case "valeur_mesuree":
      return {
        ...entete,
        typeReponse,
        unite: point.unite ?? undefined,
        toleranceMin: point.toleranceMin?.toNumber(),
        toleranceMax: point.toleranceMax?.toNumber(),
      };
    case "choix_dans_une_liste":
      return { ...entete, typeReponse, choix: point.choix };
    case "texte_libre":
      return { ...entete, typeReponse };
    case "photo":
      return { ...entete, typeReponse };
  }
}

export type ResultatDuplicationModele =
  | { readonly accepte: true; readonly checklistModeleId: string }
  | {
      readonly accepte: false;
      readonly motif: MotifRefusModeleChecklist | "aucune_version_source";
    };

/**
 * DUPLIQUE UN MODÈLE — en-tête neuf (`saisie`, un code OBLIGATOIREMENT
 * différent), dont la version 1 recopie les points de la DERNIÈRE version
 * publiée du modèle source. Refuse nommément si la source n'est pas visible
 * (`introuvable`) ou n'a encore aucune version publiée
 * (`aucune_version_source`) — rien n'est créé dans ces deux cas.
 */
export async function dupliquerModele(
  contexte: ContexteSession,
  modeleSourceId: string,
  saisie: SaisieModeleChecklist,
  client?: PrismaClient,
): Promise<ResultatDuplicationModele> {
  const source = await obtenirModeleChecklist(contexte, modeleSourceId, client);
  if (source === null) {
    return { accepte: false, motif: "introuvable" };
  }
  const derniere = await dernierVersionPubliee(
    contexte,
    modeleSourceId,
    client,
  );
  if (derniere === null) {
    return { accepte: false, motif: "aucune_version_source" };
  }

  let checklistModeleId: string;
  try {
    checklistModeleId = await creerModele(contexte, saisie, client);
  } catch (erreur: unknown) {
    const motif = motifModeleChecklist(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }

  await publierVersion(
    contexte,
    checklistModeleId,
    derniere.points.map(pointPublieEnSaisie),
    client,
  );

  return { accepte: true, checklistModeleId };
}

export type ResultatCreationDepuisGabarit =
  | { readonly accepte: true; readonly checklistModeleId: string }
  | {
      readonly accepte: false;
      readonly motif: MotifRefusModeleChecklist | "gabarit_inconnu";
    };

/**
 * CRÉE UN MODÈLE DEPUIS UN GABARIT DE DÉPART — en-tête neuf (code, libellé),
 * version 1 posée depuis les points du gabarit nommé, publiée par
 * `publierVersion`. Le gabarit ne fixe ni nature ni rattachement matériel
 * (voir `lib/checklists/gabarits-de-depart.ts`) : `saisie` n'en porte pas non
 * plus ici.
 */
export async function creerModeleDepuisGabarit(
  contexte: ContexteSession,
  gabaritId: string,
  saisie: {
    readonly code: string;
    readonly libelle: string;
    readonly typesIntervention?: readonly TypeInterventionSaisie[];
  },
  client?: PrismaClient,
): Promise<ResultatCreationDepuisGabarit> {
  const gabarit = gabaritDeDepart(gabaritId);
  if (gabarit === undefined) {
    return { accepte: false, motif: "gabarit_inconnu" };
  }

  let checklistModeleId: string;
  try {
    checklistModeleId = await creerModele(contexte, saisie, client);
  } catch (erreur: unknown) {
    const motif = motifModeleChecklist(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }

  await publierVersion(contexte, checklistModeleId, gabarit.points, client);

  return { accepte: true, checklistModeleId };
}

// ═══════════════════════════════════════════════════════════════════════════
// LA SAISIE TERRAIN (9K18-CHECKLIST-DOMAINE) — résolution du gabarit,
// lecture, et écriture par DIFFÉRENCE
// ═══════════════════════════════════════════════════════════════════════════

/** Les candidats ACTIFS de la société — RLS scope déjà, aucune clause ici. */
async function candidatsActifs(
  tx: Prisma.TransactionClient,
): Promise<CandidatGabarit[]> {
  const modeles = await tx.checklistModele.findMany({
    where: { actif: true },
    select: {
      id: true,
      code: true,
      types: { select: { type_intervention: true } },
      modele_id: true,
      sous_type_id: true,
      famille_id: true,
      exige_machine: true,
    },
  });
  return modeles.map((modele) => ({
    checklistModeleId: modele.id,
    code: modele.code,
    typesIntervention: modele.types.map(
      (type) => type.type_intervention as TypeInterventionSaisie,
    ),
    modeleId: modele.modele_id,
    sousTypeId: modele.sous_type_id,
    familleId: modele.famille_id,
    exigeMachine: modele.exige_machine,
  }));
}

/**
 * Le contexte que la MACHINE PORTÉE (s'il y en a une) donne à la cascade —
 * une intervention ne porte AU PLUS une machine (PARCOURS-1, `@@unique
 * ([intervention_id])` sur `intervention_machine`).
 */
async function contexteDeResolution(
  tx: Prisma.TransactionClient,
  interventionId: string,
  typeIntervention: TypeInterventionSaisie,
): Promise<ContexteResolutionGabarit> {
  const rattachement = await tx.interventionMachine.findFirst({
    where: { intervention_id: interventionId },
    select: { machine_id: true },
  });
  if (rattachement === null) {
    return {
      typeIntervention,
      machinePortee: false,
      modeleId: null,
      sousTypeId: null,
      familleId: null,
    };
  }
  const machine = await tx.machine.findFirst({
    where: { id: rattachement.machine_id },
    select: {
      modele: { select: { id: true, famille_id: true, sous_type_id: true } },
    },
  });
  return {
    typeIntervention,
    machinePortee: true,
    modeleId: machine?.modele.id ?? null,
    sousTypeId: machine?.modele.sous_type_id ?? null,
    familleId: machine?.modele.famille_id ?? null,
  };
}

async function resoudreGabaritPourIntervention(
  tx: Prisma.TransactionClient,
  interventionId: string,
  typeIntervention: TypeInterventionSaisie,
): Promise<GabaritResolu | null> {
  const [contexte, candidats] = await Promise.all([
    contexteDeResolution(tx, interventionId, typeIntervention),
    candidatsActifs(tx),
  ]);
  return resoudreGabarit(contexte, candidats);
}

/** `checklist_reponse.id -> les document_id de ses photos liées` (9K28-CHECKLIST-REPONSE-PHOTO). */
async function photosParReponse(
  tx: Prisma.TransactionClient,
  checklistReponseIds: readonly string[],
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (checklistReponseIds.length === 0) {
    return new Map();
  }
  const liens = await tx.checklistReponsePhoto.findMany({
    where: { checklist_reponse_id: { in: [...checklistReponseIds] } },
    orderBy: { cree_le: "asc" },
    select: { checklist_reponse_id: true, document_id: true },
  });
  const parReponse = new Map<string, string[]>();
  for (const lien of liens) {
    const liste = parReponse.get(lien.checklist_reponse_id) ?? [];
    liste.push(lien.document_id);
    parReponse.set(lien.checklist_reponse_id, liste);
  }
  return parReponse;
}

/**
 * LA VERSION FIGÉE — RÉSOUT ET PIN SI ELLE NE L'EST PAS ENCORE (D235), même
 * logique de course que `enregistrerReponses` : deux appareils qui résolvent
 * chacun un gabarit au même instant ne pinnent qu'une fois, LE PREMIER
 * GAGNE. Extrait pour être partagée avec `enregistrerReponsePhoto` — une
 * photo de point `photo` peut être la TOUTE PREMIÈRE réponse d'une
 * intervention, et doit alors pinner exactement comme n'importe quelle
 * autre réponse.
 */
async function resoudreOuPinnerVersionChecklist(
  tx: Prisma.TransactionClient,
  interventionId: string,
  typeIntervention: TypeInterventionSaisie,
  checklistVersionIdActuel: string | null,
): Promise<string | null> {
  if (checklistVersionIdActuel !== null) {
    return checklistVersionIdActuel;
  }
  const resolu = await resoudreGabaritPourIntervention(
    tx,
    interventionId,
    typeIntervention,
  );
  if (resolu === null) {
    return null;
  }
  const derniere = await tx.checklistVersion.findFirst({
    where: { checklist_modele_id: resolu.checklistModeleId },
    orderBy: { numero: "desc" },
    select: { id: true },
  });
  if (derniere === null) {
    return null;
  }
  const pin = await tx.intervention.updateMany({
    where: { id: interventionId, checklist_version_id: null },
    data: { checklist_version_id: derniere.id },
  });
  if (pin.count === 1) {
    return derniere.id;
  }
  // Course perdue : un AUTRE appel vient de poser le pin à l'instant même.
  const relue = await tx.intervention.findFirst({
    where: { id: interventionId },
    select: { checklist_version_id: true },
  });
  return relue?.checklist_version_id ?? derniere.id;
}

/**
 * LES POINTS OBLIGATOIRES SANS RÉPONSE, POUR LE BLOCAGE DE « TERMINER »
 * (9K23-CHECKLIST-BLOCAGE-TERMINER, CK7 ; décision « A » du 29/10/2026,
 * D240 ; RG-INT-02 amendée). Même résolution que `checklistDeLIntervention`
 * (la cascade si aucune version n'est encore figée), mais **sans jamais
 * PINNER** : un « Terminer » refusé ne doit pas figer un gabarit que
 * personne n'a encore répondu — seule `enregistrerReponses` pose le pin
 * (D235).
 *
 * Prend `tx: Prisma.TransactionClient` DIRECTEMENT, comme
 * `resoudreGabaritPourIntervention` ci-dessus : appelée DANS la transaction
 * déjà cloisonnée de `terminerIntervention` (`depot-rapport-terrain.ts`),
 * jamais par une route directement — `avecContexteRls` n'accepte qu'un
 * `PrismaClient` de premier niveau, pas une transaction déjà ouverte.
 */
export async function obligatoiresManquantsPourTerminer(
  tx: Prisma.TransactionClient,
  interventionId: string,
  typeIntervention: TypeInterventionSaisie,
  checklistVersionIdDejaFige: string | null,
): Promise<readonly PointObligatoireManquant[]> {
  let versionId = checklistVersionIdDejaFige;
  if (versionId === null) {
    const resolu = await resoudreGabaritPourIntervention(
      tx,
      interventionId,
      typeIntervention,
    );
    if (resolu === null) {
      return [];
    }
    const derniere = await tx.checklistVersion.findFirst({
      where: { checklist_modele_id: resolu.checklistModeleId },
      orderBy: { numero: "desc" },
      select: { id: true },
    });
    if (derniere === null) {
      return [];
    }
    versionId = derniere.id;
  }

  const [points, reponses] = await Promise.all([
    tx.checklistPoint.findMany({
      where: { checklist_version_id: versionId },
      select: { id: true, section: true, libelle: true, obligatoire: true },
    }),
    tx.checklistReponse.findMany({
      where: { intervention_id: interventionId },
      select: { checklist_point_id: true, valeur_conforme: true },
    }),
  ]);

  return etatDeCompletude(
    points,
    reponses.map((reponse) => ({
      checklistPointId: reponse.checklist_point_id,
      nonConforme: reponse.valeur_conforme === "non_conforme",
    })),
  ).obligatoiresManquants;
}

export type PointDeChecklist = {
  readonly id: string;
  readonly section: string;
  readonly ordre: number;
  readonly libelle: string;
  readonly consigne: string | null;
  readonly obligatoire: boolean;
  readonly typeReponse: string;
  readonly unite: string | null;
  readonly toleranceMin: Prisma.Decimal | null;
  readonly toleranceMax: Prisma.Decimal | null;
  readonly choix: readonly string[];
};

export type ReponseDeChecklist = {
  readonly checklistPointId: string;
  readonly valeurConforme: ReponseConformite | null;
  readonly valeurMesuree: Prisma.Decimal | null;
  readonly valeurFait: boolean | null;
  readonly valeurChoix: string | null;
  readonly valeurTexte: string | null;
  /** Le nombre de photos déjà liées (9K28-CHECKLIST-REPONSE-PHOTO) — 0 si `valeurPhoto` est `null`. */
  readonly nombrePhotos: number;
  readonly auteurId: string;
  readonly reponduLe: Date;
};

/**
 * `disponible: false` — aucun gabarit n'est résolu pour cette intervention
 * (nature non couverte, et aucun modèle générique). `null` — l'intervention
 * n'est pas visible (D35, D50).
 */
export type ChecklistDeLIntervention =
  | {
      readonly disponible: true;
      readonly checklistVersionId: string;
      /**
       * LE LIBELLÉ DU MODÈLE RÉSOLU (9K21-CHECKLIST-TERRAIN-SAISIE, CK5) —
       * pour que la tuile terrain affiche sa provenance (« Checklist :
       * <libellé> ») sans jamais relire la cascade elle-même : la version
       * est déjà figée, le libellé qui l'accompagne vient donc du MODÈLE
       * qu'elle porte, jamais d'une seconde résolution qui pourrait diverger
       * de la version réellement lue.
       */
      readonly checklistModeleLibelle: string;
      readonly points: readonly PointDeChecklist[];
      readonly reponses: readonly ReponseDeChecklist[];
      readonly completude: EtatCompletude;
    }
  | { readonly disponible: false };

/**
 * LA CHECKLIST D'UNE INTERVENTION — la version FIGÉE
 * (`intervention.checklist_version_id`) si elle existe, sinon le gabarit
 * RÉSOLU par la cascade (`lib/checklists/cascade.ts`). Une LECTURE ne PIN
 * JAMAIS : seule `enregistrerReponses` pose le pin, à la première réponse
 * acceptée (D235).
 */
export async function checklistDeLIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<ChecklistDeLIntervention | null> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: { id: true, type: true, checklist_version_id: true },
      });
      if (intervention === null) {
        return null;
      }

      let versionId = intervention.checklist_version_id;
      if (versionId === null) {
        const resolu = await resoudreGabaritPourIntervention(
          tx,
          interventionId,
          intervention.type as TypeInterventionSaisie,
        );
        if (resolu === null) {
          return { disponible: false };
        }
        const derniere = await tx.checklistVersion.findFirst({
          where: { checklist_modele_id: resolu.checklistModeleId },
          orderBy: { numero: "desc" },
          select: { id: true },
        });
        if (derniere === null) {
          return { disponible: false };
        }
        versionId = derniere.id;
      }

      const [points, reponses, version] = await Promise.all([
        tx.checklistPoint.findMany({
          where: { checklist_version_id: versionId },
          orderBy: { ordre: "asc" },
        }),
        tx.checklistReponse.findMany({
          where: { intervention_id: interventionId },
        }),
        tx.checklistVersion.findFirst({
          where: { id: versionId },
          select: { modele: { select: { libelle: true } } },
        }),
      ]);

      const photosParReponseId = await photosParReponse(
        tx,
        reponses.map((reponse) => reponse.id),
      );

      return {
        disponible: true,
        checklistVersionId: versionId,
        // JAMAIS `null` ICI — la version vient d'être lue ou vient d'être
        // posée à l'instant même ; son modèle ne se supprime jamais
        // (`onDelete: Restrict`).
        checklistModeleLibelle: version!.modele.libelle,
        points: points.map((point) => ({
          id: point.id,
          section: point.section,
          ordre: point.ordre,
          libelle: point.libelle,
          consigne: point.consigne,
          obligatoire: point.obligatoire,
          typeReponse: point.type_reponse,
          unite: point.unite,
          toleranceMin: point.tolerance_min,
          toleranceMax: point.tolerance_max,
          choix: point.choix,
        })),
        reponses: reponses.map((reponse) => ({
          checklistPointId: reponse.checklist_point_id,
          valeurConforme: reponse.valeur_conforme,
          valeurMesuree: reponse.valeur_mesuree,
          valeurFait: reponse.valeur_fait,
          valeurChoix: reponse.valeur_choix,
          valeurTexte: reponse.valeur_texte,
          nombrePhotos: photosParReponseId.get(reponse.id)?.length ?? 0,
          auteurId: reponse.auteur_id,
          reponduLe: reponse.repondu_le,
        })),
        completude: etatDeCompletude(
          points.map((point) => ({
            id: point.id,
            section: point.section,
            libelle: point.libelle,
            obligatoire: point.obligatoire,
          })),
          reponses.map((reponse) => ({
            checklistPointId: reponse.checklist_point_id,
            nonConforme: reponse.valeur_conforme === "non_conforme",
          })),
        ),
      };
    },
    client,
  );
}

/** Une entrée de la DIFFÉRENCE envoyée par le terrain — jamais la liste entière. */
export type SaisieDifferenceReponse = {
  readonly checklistPointId: string;
  readonly valeur: unknown;
};

export type EcritureReponses =
  { readonly id: string } | { readonly refuse: true; readonly cle: string };

function valeursDeLaSaisie(saisie: SaisieReponsePoint): {
  readonly valeur_conforme: ReponseConformite | null;
  readonly valeur_mesuree: number | null;
  readonly valeur_fait: boolean | null;
  readonly valeur_choix: string | null;
  readonly valeur_texte: string | null;
} {
  switch (saisie.typeReponse) {
    case "conforme_non_conforme_sans_objet":
      return {
        valeur_conforme: saisie.valeurConforme,
        valeur_mesuree: null,
        valeur_fait: null,
        valeur_choix: null,
        valeur_texte: null,
      };
    case "valeur_mesuree":
      return {
        valeur_conforme: null,
        valeur_mesuree: saisie.valeurMesuree,
        valeur_fait: null,
        valeur_choix: null,
        valeur_texte: null,
      };
    case "case_faite":
      return {
        valeur_conforme: null,
        valeur_mesuree: null,
        valeur_fait: true,
        valeur_choix: null,
        valeur_texte: null,
      };
    case "choix_dans_une_liste":
      return {
        valeur_conforme: null,
        valeur_mesuree: null,
        valeur_fait: null,
        valeur_choix: saisie.valeurChoix,
        valeur_texte: null,
      };
    case "texte_libre":
      return {
        valeur_conforme: null,
        valeur_mesuree: null,
        valeur_fait: null,
        valeur_choix: null,
        valeur_texte: saisie.valeurTexte,
      };
  }
}

/**
 * ENREGISTRE une DIFFÉRENCE de réponses — jamais l'ensemble entier, même
 * discipline que `definirPrestationsRealiseesDepuisFile` : l'appareil ne
 * connaît que ce que SA saisie a changé.
 *
 * **TOUT ou RIEN** (I6) : chaque entrée de `difference` est validée contre la
 * version EN VIGUEUR avant qu'aucune ligne ne soit écrite — un point hors de
 * cette version, ou une valeur qui ne correspond pas au type du point,
 * REFUSE la différence ENTIÈRE, nommément, sans rien enregistrer.
 *
 * **LE PIN** (D235) — si `intervention.checklist_version_id` est encore
 * `null`, la cascade résout un gabarit et la version qui en résulte est
 * POSÉE, conditionnée sur `checklist_version_id IS NULL` (même patron que la
 * transition `terminerIntervention`) : deux téléphones qui résolvent chacun
 * un gabarit au même instant ne pinnent qu'une fois — LE PREMIER GAGNE, le
 * second relit ce qui vient d'être posé et valide CONTRE CETTE version. Un
 * point qui n'existe pas dans la version déjà figée (par un autre appareil,
 * sur une AUTRE version) est refusé — `checklist.refus.point_hors_version`.
 *
 * `null` si l'intervention n'est pas visible OU que ce technicien n'y est pas
 * affecté (D35, D50, même refus que `enregistrerRapportTexte`).
 */
export async function enregistrerReponses(
  contexte: ContexteSession,
  interventionId: string,
  difference: readonly SaisieDifferenceReponse[],
  client?: PrismaClient,
): Promise<EcritureReponses | null> {
  const societeId = exigerSocieteActive(contexte);
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const intervention = await tx.intervention.findFirst({
        where: { id: interventionId },
        select: {
          id: true,
          technicien_id: true,
          statut: true,
          type: true,
          checklist_version_id: true,
        },
      });
      if (
        intervention === null ||
        !accesSurCetteIntervention(
          exigerContexteActif(contexte),
          "saisir_rapport",
          intervention.technicien_id,
        )
      ) {
        return null;
      }
      if (estFige(intervention.statut as StatutIntervention)) {
        return {
          refuse: true,
          cle:
            intervention.statut === "annulee"
              ? "intervention.refus.annulee_figee"
              : "intervention.refus.cloturee_figee",
        };
      }

      const versionId = await resoudreOuPinnerVersionChecklist(
        tx,
        interventionId,
        intervention.type as TypeInterventionSaisie,
        intervention.checklist_version_id,
      );
      if (versionId === null) {
        return { refuse: true, cle: "checklist.refus.aucun_gabarit" };
      }

      const points = await tx.checklistPoint.findMany({
        where: { checklist_version_id: versionId },
      });
      const pointsParId = new Map(points.map((point) => [point.id, point]));

      const validees: {
        readonly point: (typeof points)[number];
        readonly saisie: SaisieReponsePoint;
      }[] = [];
      for (const entree of difference) {
        const point = pointsParId.get(entree.checklistPointId);
        if (point === undefined) {
          return { refuse: true, cle: "checklist.refus.point_hors_version" };
        }
        const verdict = validerReponsePoint(
          { typeReponse: point.type_reponse, choix: point.choix },
          entree.valeur,
        );
        if (!verdict.valide) {
          return { refuse: true, cle: verdict.cle };
        }
        validees.push({ point, saisie: verdict.saisie });
      }

      for (const { point, saisie } of validees) {
        await tx.checklistReponse.upsert({
          where: {
            societe_id_intervention_id_checklist_point_id: {
              societe_id: societeId,
              intervention_id: interventionId,
              checklist_point_id: point.id,
            },
          },
          create: {
            id: uuidv7(),
            societe_id: societeId,
            intervention_id: interventionId,
            checklist_point_id: point.id,
            libelle: point.libelle,
            section: point.section,
            unite: point.unite,
            obligatoire: point.obligatoire,
            auteur_id: contexte.utilisateurId,
            ...valeursDeLaSaisie(saisie),
          },
          update: {
            libelle: point.libelle,
            section: point.section,
            unite: point.unite,
            obligatoire: point.obligatoire,
            auteur_id: contexte.utilisateurId,
            // `repondu_le` N'EST PAS RÉÉCRITE — aucune lecture de l'heure du
            // système dans ce dépôt (L0-08, gardien `tests/unit/calendar/
            // sans-date-courante-implicite.test.ts`). Une correction reste
            // tracée : le déclencheur `journal_audit_tracer` (I8) porte déjà
            // l'avant/après et son propre horodatage sur cet UPDATE.
            ...valeursDeLaSaisie(saisie),
          },
        });
      }

      // UNE RÉPONSE MODIFIÉE ANNULE SA VALIDATION (RG-INT-03, D135) — même
      // motif que `enregistrerRapportTexte` : la réponse fait partie de ce
      // qu'un responsable juge en validant le rapport.
      if (validees.length > 0) {
        await tx.intervention.updateMany({
          where: { id: interventionId },
          data: { rapport_valide_par: null, rapport_valide_le: null },
        });
      }

      return { id: interventionId };
    },
    client,
  );
}

export type EcritureReponsePhoto =
  { readonly id: string } | { readonly refuse: true; readonly cle: string };

/**
 * LIE UNE PHOTO DÉJÀ DÉPOSÉE À UN POINT `photo` (9K28-CHECKLIST-REPONSE-
 * PHOTO) — appelée DANS la transaction déjà cloisonnée de
 * `deposerPhotoIntervention` (`lib/documents/depot.ts`), comme
 * `obligatoiresManquantsPourTerminer`/`checklistDuBon` ci-dessus : jamais une
 * seconde chaîne de dépôt, le document existe déjà quand cette fonction est
 * appelée.
 *
 * **MÊME PIN QUE `enregistrerReponses`** (D235) : une photo de point `photo`
 * peut être la TOUTE PREMIÈRE réponse d'une intervention et doit alors
 * résoudre et pinner un gabarit exactement comme n'importe quelle autre
 * réponse — `resoudreOuPinnerVersionChecklist` est PARTAGÉE, jamais une
 * seconde implémentation du même critère (§9, 01/09).
 *
 * **UNE RÉPONSE `photo` N'EXISTE JAMAIS SANS AU MOINS UNE PHOTO** : cette
 * fonction pose `checklist_reponse.valeur_photo = true` ET la ligne de
 * `checklist_reponse_photo` DANS LA MÊME TRANSACTION — jamais l'une sans
 * l'autre. `document_id` est le document QUE L'APPELANT VIENT DE CRÉER OU DE
 * RETROUVER (déduplication/rejeu, `deposerPhotoIntervention`) : cette
 * fonction ne vérifie pas son existence une seconde fois, la clé étrangère de
 * base le ferait de toute façon échouer sinon.
 *
 * `checklist.refus.point_hors_version` si le point n'existe pas dans la
 * version (figée ou résolue), OU si ce point n'est pas du type `photo` — un
 * point d'un AUTRE type ne se répond jamais par cette voie.
 */
export async function enregistrerReponsePhoto(
  tx: Prisma.TransactionClient,
  params: {
    readonly societeId: string;
    readonly interventionId: string;
    readonly typeIntervention: TypeInterventionSaisie;
    readonly checklistVersionIdActuel: string | null;
    readonly checklistPointId: string;
    readonly documentId: string;
    readonly auteurId: string;
  },
): Promise<EcritureReponsePhoto> {
  const versionId = await resoudreOuPinnerVersionChecklist(
    tx,
    params.interventionId,
    params.typeIntervention,
    params.checklistVersionIdActuel,
  );
  if (versionId === null) {
    return { refuse: true, cle: "checklist.refus.aucun_gabarit" };
  }

  const point = await tx.checklistPoint.findFirst({
    where: { id: params.checklistPointId, checklist_version_id: versionId },
    select: {
      id: true,
      libelle: true,
      section: true,
      unite: true,
      obligatoire: true,
      type_reponse: true,
    },
  });
  if (point === null || point.type_reponse !== "photo") {
    return { refuse: true, cle: "checklist.refus.point_hors_version" };
  }

  // LA PHOTO EST DE CETTE INTERVENTION, JAMAIS D'UNE AUTRE — vérifié ICI,
  // en plus de la clé étrangère composite qui ferme déjà l'autre SOCIÉTÉ
  // (`checklist_reponse_photo_societe_id_document_id_fkey`) : rien dans le
  // schéma n'empêche par ailleurs un document de la MÊME société mais d'une
  // AUTRE intervention. `deposerPhotoIntervention` ne passe toujours que le
  // document qu'il vient lui-même de résoudre POUR cette intervention, mais
  // cette fonction est appelable directement (même patron que
  // `checklistDuBon`) : le refus se tient ici, pas seulement chez son seul
  // appelant actuel.
  const document = await tx.document.findFirst({
    where: { id: params.documentId },
    select: { intervention_id: true },
  });
  if (document === null || document.intervention_id !== params.interventionId) {
    return { refuse: true, cle: "checklist.refus.point_hors_version" };
  }

  const reponse = await tx.checklistReponse.upsert({
    where: {
      societe_id_intervention_id_checklist_point_id: {
        societe_id: params.societeId,
        intervention_id: params.interventionId,
        checklist_point_id: point.id,
      },
    },
    create: {
      id: uuidv7(),
      societe_id: params.societeId,
      intervention_id: params.interventionId,
      checklist_point_id: point.id,
      libelle: point.libelle,
      section: point.section,
      unite: point.unite,
      obligatoire: point.obligatoire,
      auteur_id: params.auteurId,
      valeur_photo: true,
    },
    update: {
      libelle: point.libelle,
      section: point.section,
      unite: point.unite,
      obligatoire: point.obligatoire,
      auteur_id: params.auteurId,
      valeur_photo: true,
    },
    select: { id: true },
  });

  await tx.checklistReponsePhoto.upsert({
    where: {
      societe_id_checklist_reponse_id_document_id: {
        societe_id: params.societeId,
        checklist_reponse_id: reponse.id,
        document_id: params.documentId,
      },
    },
    create: {
      id: uuidv7(),
      societe_id: params.societeId,
      checklist_reponse_id: reponse.id,
      document_id: params.documentId,
    },
    update: {},
  });

  // UNE RÉPONSE MODIFIÉE ANNULE SA VALIDATION (RG-INT-03, D135) — même motif
  // que `enregistrerReponses` : une photo ajoutée fait partie de ce qu'un
  // responsable juge en validant le rapport.
  await tx.intervention.updateMany({
    where: { id: params.interventionId },
    data: { rapport_valide_par: null, rapport_valide_le: null },
  });

  return { id: reponse.id };
}

// ═══════════════════════════════════════════════════════════════════════════
// LA TUILE DU BON (9K24-CHECKLIST-BONS, CK8) — LA VERSION FIGÉE SEULEMENT.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ce qu'une réponse rend sur le bon — déduit des SIX colonnes de
 * `checklist_reponse` elles-mêmes (une seule non nulle, gardée en base),
 * JAMAIS du type de point lu sur `checklist_point` : D235 l'écrit pour le
 * portail (« via les RÉPONSES, jamais via les modèles »), et rien ne
 * distingue ici le bureau du portail sur ce point.
 *
 * `photo` (9K28-CHECKLIST-REPONSE-PHOTO) porte les `documentId` liés —
 * TOUJOURS au moins un, `enregistrerReponsePhoto` le garantit — pour que
 * `bon-tuiles.tsx` rende leur vignette sous le point, exactement comme la
 * section « Photos » de la fiche terrain (`/api/documents/{id}/octets`).
 */
export type RenduReponseChecklistBon =
  | { readonly nature: "conforme"; readonly valeur: ReponseConformite }
  | {
      readonly nature: "mesure";
      readonly valeur: number;
      readonly unite: string | null;
    }
  | { readonly nature: "case" }
  | { readonly nature: "choix"; readonly valeur: string }
  | { readonly nature: "texte"; readonly valeur: string }
  | { readonly nature: "photo"; readonly documentIds: readonly string[] };

export type PointReponduBon = {
  readonly id: string;
  readonly libelle: string;
  readonly rendu: RenduReponseChecklistBon;
};

export type ResumeChecklistBon = {
  readonly conformes: number;
  readonly nonConformes: number;
  readonly sansObjet: number;
};

export type SectionChecklistBon = {
  readonly section: string;
  readonly points: readonly PointReponduBon[];
};

export type ChecklistBon = {
  /** `null` : aucune réponse de type « conforme/non conforme/sans objet ». */
  readonly resume: ResumeChecklistBon | null;
  readonly sections: readonly SectionChecklistBon[];
};

/**
 * EXACTEMENT UNE DES SIX COLONNES EST NON NULLE (contrainte `num_nonnulls`
 * en base) — une réponse qui n'en porterait aucune serait un défaut
 * d'écriture, jamais un état qu'un bon doit savoir afficher.
 *
 * `documentIdsParReponse` (9K28-CHECKLIST-REPONSE-PHOTO) — les photos liées
 * à CETTE réponse, déjà lues par l'appelant (`checklistDuBon`/
 * `checklistDeLaFiche`) : jamais une seconde lecture de
 * `checklist_reponse_photo` par point, qui ferait N requêtes là où une seule
 * suffit.
 */
function renduDeLaReponseBon(
  reponse: {
    readonly id: string;
    readonly valeur_conforme: ReponseConformite | null;
    readonly valeur_mesuree: Prisma.Decimal | null;
    readonly valeur_fait: boolean | null;
    readonly valeur_choix: string | null;
    readonly valeur_texte: string | null;
    readonly valeur_photo: boolean | null;
    readonly unite: string | null;
  },
  documentIdsParReponse: ReadonlyMap<string, readonly string[]>,
): RenduReponseChecklistBon {
  if (reponse.valeur_conforme !== null) {
    return { nature: "conforme", valeur: reponse.valeur_conforme };
  }
  if (reponse.valeur_mesuree !== null) {
    return {
      nature: "mesure",
      valeur: reponse.valeur_mesuree.toNumber(),
      unite: reponse.unite,
    };
  }
  if (reponse.valeur_fait !== null) {
    return { nature: "case" };
  }
  if (reponse.valeur_choix !== null) {
    return { nature: "choix", valeur: reponse.valeur_choix };
  }
  if (reponse.valeur_texte !== null) {
    return { nature: "texte", valeur: reponse.valeur_texte };
  }
  if (reponse.valeur_photo !== null) {
    return {
      nature: "photo",
      documentIds: documentIdsParReponse.get(reponse.id) ?? [],
    };
  }
  throw new Error(
    `checklist_reponse ${JSON.stringify(reponse)} ne porte aucune des six colonnes — num_nonnulls aurait dû refuser son écriture.`,
  );
}

/**
 * LA CHECKLIST D'UN BON — la version FIGÉE SEULEMENT (`checklistVersionId`,
 * `intervention.checklist_version_id`) : `null` quand elle l'est encore,
 * c'est-à-dire AUCUNE tuile, jamais la cascade résolue à la volée (une
 * lecture ne pinne jamais, et un bon n'a pas à en décider une pour le faire).
 *
 * Prend `tx: Prisma.TransactionClient` directement, comme
 * `obligatoiresManquantsPourTerminer` ci-dessus : appelée DANS la transaction
 * déjà cloisonnée de `composerBon` (`lib/interventions/bon.ts`), partagée
 * entre le bureau et le portail — ni l'un ni l'autre ne filtre la liste des
 * points rendus (D235 : le client voit TOUS les points de SA checklist
 * remplie).
 *
 * Les points NON répondus n'y figurent pas : un bon ne se génère qu'après
 * « Terminer » (`peutGenererLeBon`), qui a déjà bloqué sur tout obligatoire
 * manquant (CK7) — ce que ce module rend ici n'est jamais un formulaire.
 */
export async function checklistDuBon(
  tx: Prisma.TransactionClient,
  interventionId: string,
  checklistVersionId: string | null,
): Promise<ChecklistBon | null> {
  if (checklistVersionId === null) {
    return null;
  }

  // JAMAIS DE FILTRE NI DE TRI PAR `checklist_point` — même sous le
  // bureau, qui pourrait le lire : un `WHERE`/`ORDER BY` sur une relation
  // Prisma s'y JOINT, et `checklist_point` est de forme « interne » (D94),
  // fermée au portail. Un tel JOIN y renverrait silencieusement ZÉRO ligne,
  // même pour le client DE l'intervention — exactement ce que D235 interdit
  // (« jamais besoin d'ouvrir checklist_point »). `intervention_id` SEUL
  // suffit : chaque réponse d'une intervention appartient à l'UNIQUE version
  // qu'elle a pinnée (`enregistrerReponses`) ; l'ordre se fait sur
  // `repondu_le`, la seule colonne de tri que `checklist_reponse` porte
  // elle-même.
  const reponses = await tx.checklistReponse.findMany({
    where: { intervention_id: interventionId },
    orderBy: [{ repondu_le: "asc" }, { id: "asc" }],
  });

  const photosParReponseId = await photosParReponse(
    tx,
    reponses.map((reponse) => reponse.id),
  );

  const sections: { readonly section: string; points: PointReponduBon[] }[] =
    [];
  const indexParSection = new Map<string, number>();
  let conformes = 0;
  let nonConformes = 0;
  let sansObjet = 0;

  for (const reponse of reponses) {
    const rendu = renduDeLaReponseBon(reponse, photosParReponseId);
    if (rendu.nature === "conforme") {
      if (rendu.valeur === "conforme") conformes++;
      else if (rendu.valeur === "non_conforme") nonConformes++;
      else sansObjet++;
    }

    let index = indexParSection.get(reponse.section);
    if (index === undefined) {
      index = sections.length;
      indexParSection.set(reponse.section, index);
      sections.push({ section: reponse.section, points: [] });
    }
    sections[index]!.points.push({
      id: reponse.checklist_point_id,
      libelle: reponse.libelle,
      rendu,
    });
  }

  const totalConformite = conformes + nonConformes + sansObjet;
  return {
    resume:
      totalConformite === 0 ? null : { conformes, nonConformes, sansObjet },
    sections,
  };
}

export type PointReponduFiche = PointReponduBon & {
  /** Qui a répondu — « — » quand le compte est hors périmètre (I10). */
  readonly auteur: string;
  readonly reponduLe: Date;
};

export type SectionChecklistFiche = {
  readonly section: string;
  readonly points: readonly PointReponduFiche[];
};

export type ChecklistFiche = {
  readonly checklistModeleLibelle: string;
  readonly resume: ResumeChecklistBon | null;
  readonly sections: readonly SectionChecklistFiche[];
};

function nomDeLAuteur(auteurId: string, annuaire: Annuaire): string {
  const designation = annuaire(auteurId);
  return designation.etat === "nom" ? designation.nom : "—";
}

/**
 * LA CHECKLIST D'UNE FICHE BUREAU (9K25-CHECKLIST-FICHE-BUREAU, CK9) — même
 * garde que `checklistDuBon` (`null` tant qu'aucune version n'est FIGÉE,
 * `intervention_id` SEUL comme filtre, jamais de JOIN implicite vers
 * `checklist_point`), mais pour un public DIFFÉRENT : le bureau, pas un
 * document remis au client. Deux informations que le bon ne porte jamais y
 * sont ajoutées — la PROVENANCE (le libellé du modèle, « Checklist : <X> »,
 * même préfixe que la tuile terrain) et QUI a répondu CHAQUE point, et
 * QUAND — d'où la fonction séparée plutôt qu'un paramètre optionnel sur
 * `checklistDuBon`, dont la forme reste celle du bon.
 */
export async function checklistDeLaFiche(
  tx: Prisma.TransactionClient,
  interventionId: string,
  checklistVersionId: string | null,
): Promise<ChecklistFiche | null> {
  if (checklistVersionId === null) {
    return null;
  }

  const [reponses, version] = await Promise.all([
    tx.checklistReponse.findMany({
      where: { intervention_id: interventionId },
      orderBy: [{ repondu_le: "asc" }, { id: "asc" }],
    }),
    tx.checklistVersion.findFirst({
      where: { id: checklistVersionId },
      select: { modele: { select: { libelle: true } } },
    }),
  ]);

  const [annuaire, photosParReponseId] = await Promise.all([
    annuaireDesPersonnes(
      tx,
      reponses.map((reponse) => reponse.auteur_id),
    ),
    photosParReponse(
      tx,
      reponses.map((reponse) => reponse.id),
    ),
  ]);

  const sections: { readonly section: string; points: PointReponduFiche[] }[] =
    [];
  const indexParSection = new Map<string, number>();
  let conformes = 0;
  let nonConformes = 0;
  let sansObjet = 0;

  for (const reponse of reponses) {
    const rendu = renduDeLaReponseBon(reponse, photosParReponseId);
    if (rendu.nature === "conforme") {
      if (rendu.valeur === "conforme") conformes++;
      else if (rendu.valeur === "non_conforme") nonConformes++;
      else sansObjet++;
    }

    let index = indexParSection.get(reponse.section);
    if (index === undefined) {
      index = sections.length;
      indexParSection.set(reponse.section, index);
      sections.push({ section: reponse.section, points: [] });
    }
    sections[index]!.points.push({
      id: reponse.checklist_point_id,
      libelle: reponse.libelle,
      rendu,
      auteur: nomDeLAuteur(reponse.auteur_id, annuaire),
      reponduLe: reponse.repondu_le,
    });
  }

  const totalConformite = conformes + nonConformes + sansObjet;
  return {
    // JAMAIS `null` ICI — `checklistVersionId` non nul garantit une version
    // déjà publiée, et son modèle ne se supprime jamais (`onDelete: Restrict`).
    checklistModeleLibelle: version!.modele.libelle,
    resume:
      totalConformite === 0 ? null : { conformes, nonConformes, sansObjet },
    sections,
  };
}
