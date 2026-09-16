import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession, exigerSocieteActive } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

import { type SaisieAssujettissementFamille } from "@/lib/vgp/assujettissement";

import type { SaisieFamilleMateriel, SaisieModeleMateriel } from "./saisie";

/**
 * LE CHEMIN D'ÉCRITURE DU RÉFÉRENTIEL MATÉRIEL (L1-05b).
 *
 * ## Ce qu'il répare, et l'enchaînement qui le rend urgent
 *
 * *Mesuré le 14/09/2026 puis le 15/09/2026 : `ls lib/materiel/` rendait un seul
 * fichier, `saisie.ts`.* L1-05 a posé les deux tables et leur validation Zod ;
 * **entre les deux il n'y avait rien** — ni dépôt, ni route, ni écran.
 *
 * **Et l'import ne sauvait pas ce module**, ce qui n'est pas la même faute et se
 * mesurait à part : une recherche des fonctions d'application dans `lib/imports/`
 * rendait **une** ligne, et c'était `appliquerLeLotDeClients`. *Le gabarit des
 * modèles savait produire un rapport et ne savait pas l'appliquer* (R6-01), et
 * **il n'existait aucun gabarit de FAMILLE** (R6-03). Le raisonnement
 * « l'import donnera un appelant à tout le monde » était vrai des clients et
 * faux d'ici.
 *
 * > **LES DEUX SONT LEVÉS** — R6-01 le 16/09/2026, R6-03 le même jour : le
 * > gabarit des familles existe, il s'applique, et il écrit par
 * > `creerFamilleDans` / `modifierFamilleDans`, extraites plus bas. *Les
 * > paragraphes ci-dessus restent au passé plutôt qu'effacés : ce qui a été
 * > mesuré un jour se relit* — mais au passé, sans quoi ils enseigneraient un
 * > manque qui n'existe plus.
 *
 * **Ce que cela coûtait, et c'est un enchaînement plutôt qu'un manque :** une
 * machine exige un modèle (D6, quatre champs obligatoires), un modèle exige une
 * famille, et **aucun des deux ne pouvait naître.** *Le parc ne se remplissait
 * donc que par le semis.*
 *
 * > **La commande exacte n'est PAS citée ici, et c'est mesuré plutôt que
 * > stylistique.** `scripts/lib/chemins-de-depot.ts` cherche les exports d'un
 * > module de dépôt avec un motif **sans ancre de début de ligne**, si bien
 * > qu'une commande `grep` citée dans un commentaire est lue comme une fonction
 * > exportée — ce fichier a fait rougir le gardien sur une fonction `appliquer`
 * > qu'il ne déclare pas. *C'est la forme 2 du §9 (26/08) prise à l'envers : là,
 * > un gardien oubliait de lire les chaînes ; ici, il lit la documentation comme
 * > de l'exécution, alors que la seule coupure légitime est justement
 * > « documentation contre exécution ».* La reformulation ci-dessus est un
 * > contournement assumé ; **la réparation est portée à la file (R6-04)**, parce
 * > qu'elle change la population d'un gardien qui garde `pnpm verify`.
 *
 * ## Aucune comparaison de société n'est écrite ici
 *
 * Tout passe par `avecContexteApplicatif`, donc sous les politiques :
 * `famille_materiel` et `modele_materiel` sont des tables métier ordinaires, de
 * forme « ascendance » depuis D93 — société pour un rôle interne, et pour un
 * compte de portail SEUL l'existence d'un enfant visible. *Une comparaison
 * écrite au-dessus de la politique serait une seconde lecture d'un même
 * critère*, et c'est celle qui vieillit sans rougir. Une famille d'une autre
 * société et une famille inexistante rendent donc **le même refus** — les
 * distinguer ferait un oracle (D35, D50).
 *
 * ## AUCUNE COLONNE DE VGP N'EST ÉCRITE ICI, et ce n'est pas un oubli
 *
 * Les deux tables portent `vgp_periodicite_mois` et `vgp_reference_texte`, et
 * la famille porte en plus `assujettissement_vgp`. **Elles appartiennent au lot
 * 9** : L9-03 veut que l'assujettissement se déclare à la famille avec ses
 * TROIS valeurs, L9-04 qu'un « soumis » rende obligatoires la périodicité ET le
 * texte qui la fonde, L9-06 que le modèle PRÉCISE sans jamais faire exception.
 * *Les écrire depuis un formulaire de référentiel serait une seconde entrée sur
 * la même règle*, et la seconde ne connaîtrait pas la première.
 *
 * Une famille créée ici naît donc `a_determiner`, qui est le défaut de la
 * colonne — **l'état « personne n'a encore examiné »**, que L9-03 a choisi
 * précisément pour qu'il ne se confonde pas avec « non soumise ». Elle apparaît
 * le jour même dans `/vgp/a-determiner`.
 *
 * ## Aucune SUPPRESSION, et c'est le raisonnement des prestations
 *
 * Une famille est désignée par des modèles, des forfaits, des prestations et des
 * campagnes ; un modèle est désigné par des machines et des documents. Toutes
 * ces clés étrangères sont en `onDelete: Restrict` : *supprimer échouerait huit
 * fois sur dix, et proposer un bouton qui échoue huit fois sur dix est pire que
 * de ne pas le proposer.* La bascule d'activité retire du CHOIX sans toucher au
 * passé.
 */

/** Les codes Prisma que ce module sait traduire. */
const VIOLATION_UNICITE = "P2002";
const VIOLATION_CLE_ETRANGERE = "P2003";
const ENREGISTREMENT_ABSENT = "P2025";
const CONTRAINTE_BASE = "P2010";

/** Ce qu'un refus dit d'une famille, et il n'en dit jamais plus. */
export type MotifRefusFamille =
  /** `(societe_id, code)` — le code est la clé naturelle d'une famille. */
  | "code_pris"
  /** Hors périmètre — il n'est JAMAIS dit si elle existe ailleurs (D50). */
  | "introuvable";

/** Ce qu'un refus dit d'un modèle. */
export type MotifRefusModele =
  /** `(societe_id, marque, reference)` — la clé naturelle d'un modèle. */
  | "marque_reference_prise"
  /** La famille n'appartient pas à la société active, ou n'existe pas. */
  | "famille_hors_societe"
  | "introuvable";

export type ResultatFamille =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusFamille };

export type ResultatModele =
  | { readonly accepte: true; readonly id: string }
  | { readonly accepte: false; readonly motif: MotifRefusModele };

/**
 * Traduit un refus de la base en motif, pour une FAMILLE.
 *
 * **Une seule unicité sur cette table** — `(societe_id, code)` —, si bien que
 * `P2002` ne peut désigner qu'elle. *C'est ce qui dispense ce module de la
 * lecture d'attribution que `depot-forfaits.ts` a dû écrire*, où `meta.target`
 * vaut `null` dans le harnais et ne dit pas laquelle des deux unicités a mordu.
 */
function motifFamille(erreur: unknown): MotifRefusFamille | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (erreur.code === VIOLATION_UNICITE) return "code_pris";
  if (erreur.code === ENREGISTREMENT_ABSENT) return "introuvable";
  return null;
}

/** Traduit un refus de la base en motif, pour un MODÈLE. */
function motifModele(erreur: unknown): MotifRefusModele | null {
  if (!(erreur instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (erreur.code === VIOLATION_UNICITE) return "marque_reference_prise";
  if (
    erreur.code === VIOLATION_CLE_ETRANGERE ||
    erreur.code === CONTRAINTE_BASE
  ) {
    // La famille est chaînée sur le COUPLE (société, famille) : une famille
    // d'une autre société est refusée PAR LA CLÉ, jamais par une comparaison
    // écrite au-dessus de la politique. *Sans la société dans la clé, le verrou
    // serait muet là où le cloisonnement doit mordre.*
    return "famille_hors_societe";
  }
  if (erreur.code === ENREGISTREMENT_ABSENT) return "introuvable";
  return null;
}

/** Une famille telle qu'un écran la lit. */
export type LigneFamille = {
  readonly id: string;
  readonly code: string;
  readonly libelle: string;
  readonly actif: boolean;
};

const CHAMPS_FAMILLE: { readonly [K in keyof LigneFamille]: true } = {
  id: true,
  code: true,
  libelle: true,
  actif: true,
};

/** Un modèle tel qu'un écran le lit. */
export type LigneModele = {
  readonly id: string;
  readonly famille_id: string;
  readonly marque: string;
  readonly reference: string;
  readonly periodicite_jours: number | null;
  readonly periodicite_compteur: number | null;
  readonly actif: boolean;
};

const CHAMPS_MODELE: { readonly [K in keyof LigneModele]: true } = {
  id: true,
  famille_id: true,
  marque: true,
  reference: true,
  periodicite_jours: true,
  periodicite_compteur: true,
  actif: true,
};

/**
 * LES FAMILLES, sous le contexte cloisonné.
 *
 * **Les colonnes de VGP ne sont PAS lues**, et c'est le pendant de ce que ce
 * module n'écrit pas : `/vgp` et `/vgp/a-determiner` les rendent, avec la règle
 * qui les gouverne. *Les afficher ici, dans un tableau qui ne sait pas les
 * écrire, montrerait une donnée sans dire où on la corrige.*
 */
export async function listerLesFamilles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneFamille[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.familleMateriel.findMany({
        select: CHAMPS_FAMILLE,
        // L'ordre est TOTAL : sans le dernier rang, deux familles de même code
        // — impossible aujourd'hui, mais l'ordre ne doit pas en dépendre — se
        // rangeraient par la place physique des lignes (leçon de L3-03).
        orderBy: [{ code: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Les modèles, sous le contexte cloisonné. */
export async function listerLesModeles(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneModele[]> {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.modeleMateriel.findMany({
        select: CHAMPS_MODELE,
        orderBy: [{ marque: "asc" }, { reference: "asc" }, { id: "asc" }],
      }),
    client,
  );
}

/** Crée une famille dans la société active. */
export async function creerFamille(
  contexte: ContexteSession,
  saisie: SaisieFamilleMateriel,
  client?: PrismaClient,
): Promise<ResultatFamille> {
  const id = uuidv7();
  try {
    await avecContexteApplicatif(
      contexte,
      // **AUCUN ASSUJETTISSEMENT N'EST PASSÉ ICI**, et c'est la décision de
      // L1-05b, inchangée : la famille naît `a_determiner` — l'état « personne
      // n'a encore examiné », que L9-03 a choisi pour qu'il ne se confonde pas
      // avec « non soumise ». *Une case décochée est indiscernable d'une
      // famille jamais examinée*, et y répondre depuis un formulaire de
      // référentiel répondrait à une question qu'on n'a pas posée.
      (tx) => creerFamilleDans(tx, exigerSocieteActive(contexte), id, saisie),
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifFamille(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }
}

/**
 * Modifie une famille.
 *
 * `updateMany` plutôt que `update` : *zéro ligne touchée n'est pas une erreur
 * technique, c'est la politique qui a refusé*, et elle refuse en silence. Le
 * refus rendu est le même que pour un identifiant inconnu.
 */
export async function modifierFamille(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieFamilleMateriel,
  client?: PrismaClient,
): Promise<ResultatFamille> {
  try {
    const touchees = await avecContexteApplicatif(
      contexte,
      (tx) => modifierFamilleDans(tx, id, saisie),
      client,
    );
    return touchees === 0
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifFamille(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }
}

/**
 * BASCULE L'ACTIVITÉ D'UNE FAMILLE — la seule façon de la retirer du choix.
 *
 * Elle ne touche pas au passé : les modèles qui la désignent continuent de la
 * nommer, et les machines de ces modèles restent au parc. *Supprimer aurait
 * échoué sur quatre clés étrangères en `Restrict`, et aurait rendu illisible
 * l'historique d'une machine dont la famille aurait disparu.*
 */
export async function basculerActiviteFamille(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatFamille> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) => tx.familleMateriel.updateMany({ where: { id }, data: { actif } }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, id };
}

/** Crée un modèle dans la société active. */
export async function creerModele(
  contexte: ContexteSession,
  saisie: SaisieModeleMateriel,
  client?: PrismaClient,
): Promise<ResultatModele> {
  const id = uuidv7();
  try {
    await avecContexteApplicatif(
      contexte,
      (tx) => creerModeleDans(tx, exigerSocieteActive(contexte), id, saisie),
      client,
    );
    return { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifModele(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }
}

/** Modifie un modèle. La famille peut changer ; la société, jamais. */
export async function modifierModele(
  contexte: ContexteSession,
  id: string,
  saisie: SaisieModeleMateriel,
  client?: PrismaClient,
): Promise<ResultatModele> {
  try {
    const touchees = await avecContexteApplicatif(
      contexte,
      (tx) => modifierModeleDans(tx, id, saisie),
      client,
    );
    return touchees === 0
      ? { accepte: false, motif: "introuvable" }
      : { accepte: true, id };
  } catch (erreur: unknown) {
    const motif = motifModele(erreur);
    if (motif === null) throw erreur;
    return { accepte: false, motif };
  }
}

/**
 * L'ÉCRITURE ELLE-MÊME, DANS UNE TRANSACTION QUE L'APPELANT TIENT (R6-01).
 *
 * `creerModele` l'appelle, et `appliquerLeLotDeModeles` aussi — *un lot
 * s'applique dans UNE transaction*, et `creerModele` ouvrirait la sienne par
 * ligne (L1-08i). **Extraite plutôt que recopiée** : la seconde implémentation
 * d'un critère n'est jamais gratuite (§9, 01/09).
 *
 * **L'identifiant est un PARAMÈTRE et non un tirage local.** `creerModele` le
 * tire avant d'ouvrir sa transaction, pour le rendre même quand l'écriture
 * passe par `updateMany` ; le tirer ici aussi ferait deux lectures d'un même
 * fait, et l'appelant rendrait un identifiant qui n'est pas celui de la ligne.
 *
 * `caracteristiques` reste OMISE : le chapitre 11 la nomme et ne fixe pas son
 * contenu. *L'inventer au premier écran qui l'écrit figerait sa forme pour
 * toutes les sociétés* — le défaut que L1-09a a nommé sur
 * `adresse_facturation`, et que R3-15 a refait valoir sur `checklist_type`.
 */
export async function creerModeleDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  id: string,
  saisie: SaisieModeleMateriel,
): Promise<void> {
  await tx.modeleMateriel.create({
    data: {
      id,
      societe_id: societeId,
      famille_id: saisie.famille_id,
      marque: saisie.marque,
      reference: saisie.reference,
      periodicite_jours: saisie.periodicite_jours,
      periodicite_compteur: saisie.periodicite_compteur,
      actif: saisie.actif,
    },
    select: { id: true },
  });
}

/**
 * La MODIFICATION dans une transaction que l'appelant tient — le jumeau de
 * `creerModeleDans`.
 *
 * **`updateMany` et non `update`**, et ce n'est pas une préférence : *zéro
 * ligne touchée n'est pas une erreur technique, c'est la politique qui a
 * refusé*, et elle refuse en silence. Le décompte rendu est ce qui permet à
 * l'appelant de distinguer « écrit » de « refusé » sans interroger la base une
 * seconde fois.
 */
export async function modifierModeleDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: SaisieModeleMateriel,
): Promise<number> {
  const touchees = await tx.modeleMateriel.updateMany({
    where: { id },
    data: {
      famille_id: saisie.famille_id,
      marque: saisie.marque,
      reference: saisie.reference,
      periodicite_jours: saisie.periodicite_jours,
      periodicite_compteur: saisie.periodicite_compteur,
      actif: saisie.actif,
    },
  });
  return touchees.count;
}

/** Bascule l'activité d'un modèle. Les machines qui le désignent ne bougent pas. */
export async function basculerActiviteModele(
  contexte: ContexteSession,
  id: string,
  actif: boolean,
  client?: PrismaClient,
): Promise<ResultatModele> {
  const touchees = await avecContexteApplicatif(
    contexte,
    (tx) => tx.modeleMateriel.updateMany({ where: { id }, data: { actif } }),
    client,
  );
  return touchees.count === 0
    ? { accepte: false, motif: "introuvable" }
    : { accepte: true, id };
}

/* ────────────────────────────────────────────────────────────────────────
 * LES FAMILLES, DANS UNE TRANSACTION QUE L'APPELANT TIENT (R6-03)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * L'ÉCRITURE D'UNE FAMILLE — les jumelles de `creerModeleDans` (R6-03).
 *
 * *Un lot s'applique dans UNE transaction*, et `creerFamille` ouvrirait la
 * sienne par ligne (L1-08i). **Extraites plutôt que recopiées** : `creerFamille`
 * et `modifierFamille` les appellent désormais, si bien que l'écran de L1-05b et
 * l'import écrivent par le MÊME chemin. *La seconde implémentation d'un critère
 * n'est jamais gratuite* (§9, 01/09).
 *
 * ## L'ASSUJETTISSEMENT EST UN PARAMÈTRE FACULTATIF, et c'est tout le ticket
 *
 * L1-05b n'écrivait **aucune** colonne de VGP depuis son formulaire, et le motif
 * tenait : *« une seconde entrée sur la même règle ne connaîtrait pas la
 * première. »* **L'import n'est pas cette seconde entrée**, et la différence est
 * vérifiable : il ne REDIT pas la règle, il APPELLE
 * `schemaAssujettissementFamille` — le seul endroit où L9-04 est écrite. Ce
 * paramètre ne porte donc rien que ce schéma n'ait déjà jugé.
 *
 * **Absent, il n'écrit rien** : la colonne garde son défaut `a_determiner`, et
 * c'est l'état HONNÊTE — *« on n'a pas regardé » n'est pas « non soumise »*
 * (L9-03). La valeur n'est pas recopiée ici : elle est le `@default` de la
 * colonne, et l'omission est ce qui l'invoque.
 */
export async function creerFamilleDans(
  tx: Prisma.TransactionClient,
  societeId: string,
  id: string,
  saisie: SaisieFamilleMateriel,
  vgp?: SaisieAssujettissementFamille,
): Promise<void> {
  await tx.familleMateriel.create({
    data: {
      id,
      societe_id: societeId,
      code: saisie.code,
      libelle: saisie.libelle,
      actif: saisie.actif,
      ...colonnesVgp(vgp),
    },
    select: { id: true },
  });
}

/**
 * La MODIFICATION — `updateMany` et non `update`.
 *
 * *Zéro ligne touchée n'est pas une erreur technique, c'est la politique qui a
 * refusé*, et elle refuse en silence.
 */
export async function modifierFamilleDans(
  tx: Prisma.TransactionClient,
  id: string,
  saisie: SaisieFamilleMateriel,
  vgp?: SaisieAssujettissementFamille,
): Promise<number> {
  const touchees = await tx.familleMateriel.updateMany({
    where: { id },
    data: {
      code: saisie.code,
      libelle: saisie.libelle,
      actif: saisie.actif,
      ...colonnesVgp(vgp),
    },
  });
  return touchees.count;
}

/**
 * LES TROIS COLONNES DE VGP, OU AUCUNE — jamais une partie.
 *
 * **Elles voyagent ensemble parce que la base les lie** : une contrainte rend la
 * périodicité et la référence obligatoires dès que l'assujettissement vaut
 * `soumis` (L9-04). *Écrire l'une sans les autres laisserait la ligne dans un
 * état que la contrainte refuse — et le refus emporterait la transaction, donc
 * le lot entier.* C'est le raisonnement de D56 sur `agence_id` et
 * `temps_trajet_min`, appliqué à un triplet plutôt qu'à un couple.
 *
 * `undefined` rend un objet VIDE, et non trois `undefined` : *un `undefined`
 * explicite et une clé absente ne disent pas la même chose à Prisma sur une
 * mise à jour*, et seule l'absence laisse la colonne intacte.
 */
function colonnesVgp(vgp: SaisieAssujettissementFamille | undefined):
  | Record<string, never>
  | {
      assujettissement_vgp: SaisieAssujettissementFamille["assujettissement"];
      vgp_periodicite_mois: number | null;
      vgp_reference_texte: string | null;
    } {
  if (vgp === undefined) return {};
  return {
    assujettissement_vgp: vgp.assujettissement,
    vgp_periodicite_mois: vgp.periodiciteMois,
    vgp_reference_texte: vgp.referenceTexte,
  };
}
