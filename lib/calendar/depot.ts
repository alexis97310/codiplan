import type { Prisma } from "@prisma/client";

import { uuidv7 } from "@/lib/db/uuid";

import {
  plageLaPlusCourte,
  plageQuiChevauche,
  plageTientLePas,
  schemaPasCreneau,
  schemaPlage,
  type Plage,
} from "./parametrage";

/**
 * LE CHEMIN D'ÉCRITURE DES HORAIRES D'OUVERTURE (R3-13, I7).
 *
 * ## Pourquoi il existe
 *
 * `/parametres/agences` affichait les jours travaillés et les plages horaires
 * et ne laissait régler que le pas : **les plages ne se modifiaient nulle part
 * dans l'application** — le seul chemin était le semis ou une console. Or un
 * calendrier d'agence décide de quatre choses mesurables (refus à la pose,
 * départ du compteur d'accusé, dénominateur du taux, assiette de majoration),
 * et *une agence qui ouvre le samedi ne pouvait pas le déclarer*.
 *
 * ## Ce qu'il ne fait pas
 *
 * **Aucune comparaison de société n'est écrite ici.** `calendrier` et
 * `calendrier_plage` sont de forme « société » : on lit et on écrit SOUS le
 * contexte cloisonné, et la politique prononce. *Une comparaison écrite
 * au-dessus de la politique serait une seconde lecture du même critère* — celle
 * qui vieillit sans rougir. Un identifiant venu d'un formulaire forgé ne
 * désigne donc rien hors de la société active, et le refus est le même que pour
 * un identifiant inconnu : les distinguer ferait un oracle (D35, D50).
 *
 * **Il ne décide pas non plus tout seul.** Les deux règles de R3-13 —
 * chevauchement, pas qui tombe dans la plage — sont tenues EN BASE par trois
 * déclencheurs. Ce module les évalue AVANT d'écrire pour que le refus soit
 * lisible et nommé ; si les deux divergeaient, c'est la base qui gagnerait, et
 * l'erreur qu'elle lève est rattrapée et traduite plus bas. *La base garde, ce
 * module explique.*
 *
 * ## « Fermer un jour » n'est pas une case à cocher
 *
 * La migration du 21/08 l'a écrit à la naissance de la table : *« pas de
 * booléen `ouvert` : deux sources pour un même fait finissent par se
 * contredire, et c'est la plage qui fait foi puisque c'est elle qu'on lit. »*
 * Un jour sans plage EST un jour fermé. Fermer un jour, c'est donc retirer ses
 * plages ; l'ouvrir, c'est lui en donner une. Il n'y a pas de troisième verbe.
 */

/** Pourquoi un réglage a été refusé — une clé de dictionnaire, jamais un texte. */
export type MotifDeRefus =
  | "parametres.plage.refus_saisie"
  | "parametres.plage.refus_chevauchement"
  | "parametres.plage.refus_plage_courte"
  | "parametres.plage.refus_introuvable"
  | "parametres.refus_pas"
  | "parametres.pas.refus_plage_courte";

/**
 * Le verdict d'un réglage.
 *
 * Une SOMME et jamais un booléen : *« refusé » et « refusé parce que »* ne se
 * corrigent pas au même endroit, et un appelant ne peut pas ignorer la moitié
 * qui explique sans que le compilateur le dise.
 */
export type Reglage =
  { readonly ok: true } | { readonly ok: false; readonly motif: MotifDeRefus };

const ACCEPTE: Reglage = { ok: true };

const refus = (motif: MotifDeRefus): Reglage => ({ ok: false, motif });

/**
 * Le motif que la BASE a prononcé, quand elle a prononcé avant nous.
 *
 * Prisma n'expose pas le champ `constraint` d'une erreur levée par un
 * déclencheur — il ne rend que le SQLSTATE et le texte (mesuré à L1-01, redit à
 * D56). Le nom du verrou a donc été écrit DANS le message par la migration, et
 * c'est lui qu'on lit ici. **Une erreur non reconnue n'est pas traduite** : elle
 * repart, plutôt que d'être rangée sous un motif qui serait faux.
 */
function motifDeLaBase(erreur: unknown): MotifDeRefus | null {
  const texte = erreur instanceof Error ? erreur.message : String(erreur);
  if (texte.includes("calendrier_plage_sans_chevauchement")) {
    return "parametres.plage.refus_chevauchement";
  }
  if (texte.includes("calendrier_plage_tient_le_pas")) {
    return "parametres.plage.refus_plage_courte";
  }
  if (texte.includes("calendrier_pas_tient_dans_les_plages")) {
    return "parametres.pas.refus_plage_courte";
  }
  return null;
}

async function sousLeVerrouDeLaBase(
  ecrire: () => Promise<unknown>,
): Promise<Reglage> {
  try {
    await ecrire();
    return ACCEPTE;
  } catch (erreur) {
    const motif = motifDeLaBase(erreur);
    if (motif === null) {
      throw erreur;
    }
    return refus(motif);
  }
}

/** Les plages d'un calendrier, avec leur identifiant — ce qu'un écran modifie. */
export type PlageIdentifiee = Plage & { readonly id: string };

/** Ce qu'un formulaire propose : des minutes déjà converties, rien de plus. */
export type SaisiePlage = {
  readonly jourSemaine: number;
  readonly debutMinutes: number;
  readonly finMinutes: number;
};

async function contexteDuCalendrier(
  tx: Prisma.TransactionClient,
  calendrierId: string,
): Promise<{
  societeId: string;
  pas: number;
  plages: PlageIdentifiee[];
} | null> {
  const calendrier = await tx.calendrier.findFirst({
    where: { id: calendrierId },
    select: {
      pas_creneau_minutes: true,
      societe_id: true,
      plages: {
        select: {
          id: true,
          jour_semaine: true,
          debut_minutes: true,
          fin_minutes: true,
        },
      },
    },
  });
  if (calendrier === null) {
    return null;
  }
  return {
    societeId: calendrier.societe_id,
    pas: calendrier.pas_creneau_minutes,
    plages: calendrier.plages.map((p) => ({
      id: p.id,
      jourSemaine: p.jour_semaine,
      debutMinutes: p.debut_minutes,
      finMinutes: p.fin_minutes,
    })),
  };
}

/**
 * OUVRIR UN JOUR, OU LUI AJOUTER UNE SECONDE PLAGE.
 *
 * `societe_id` n'est pas saisi : il est RECOPIÉ du calendrier lu sous contexte.
 * Le recevoir d'un formulaire laisserait écrire une plage dans une autre
 * société — la politique l'aurait refusée, et c'est précisément ce qu'on ne veut
 * pas mesurer une seconde fois ici.
 */
export async function ajouterPlage(
  tx: Prisma.TransactionClient,
  calendrierId: string,
  saisie: SaisiePlage,
): Promise<Reglage> {
  const forme = schemaPlage.safeParse(saisie);
  if (!forme.success) {
    return refus("parametres.plage.refus_saisie");
  }
  const contexte = await contexteDuCalendrier(tx, calendrierId);
  if (contexte === null) {
    return refus("parametres.plage.refus_introuvable");
  }
  if (plageQuiChevauche(contexte.plages, forme.data) !== null) {
    return refus("parametres.plage.refus_chevauchement");
  }
  if (!plageTientLePas(forme.data, contexte.pas)) {
    return refus("parametres.plage.refus_plage_courte");
  }
  return sousLeVerrouDeLaBase(() =>
    tx.calendrierPlage.create({
      data: {
        id: uuidv7(),
        societe_id: contexte.societeId,
        calendrier_id: calendrierId,
        jour_semaine: forme.data.jourSemaine,
        debut_minutes: forme.data.debutMinutes,
        fin_minutes: forme.data.finMinutes,
      },
    }),
  );
}

/**
 * MODIFIER LES BORNES D'UNE PLAGE.
 *
 * Le jour ne se change pas : déplacer une plage d'un jour à l'autre, c'est
 * fermer l'un et ouvrir l'autre, et les deux gestes ont chacun leur conséquence
 * — un jour qu'on ferme perd tout. Les rendre distincts rend visible ce qu'on
 * fait ; les confondre sous « modifier » l'aurait caché.
 */
export async function modifierPlage(
  tx: Prisma.TransactionClient,
  plageId: string,
  bornes: { readonly debutMinutes: number; readonly finMinutes: number },
): Promise<Reglage> {
  const existante = await tx.calendrierPlage.findFirst({
    where: { id: plageId },
    select: { calendrier_id: true, jour_semaine: true },
  });
  if (existante === null) {
    return refus("parametres.plage.refus_introuvable");
  }
  const forme = schemaPlage.safeParse({
    jourSemaine: existante.jour_semaine,
    ...bornes,
  });
  if (!forme.success) {
    return refus("parametres.plage.refus_saisie");
  }
  const contexte = await contexteDuCalendrier(tx, existante.calendrier_id);
  if (contexte === null) {
    return refus("parametres.plage.refus_introuvable");
  }
  if (plageQuiChevauche(contexte.plages, forme.data, plageId) !== null) {
    return refus("parametres.plage.refus_chevauchement");
  }
  if (!plageTientLePas(forme.data, contexte.pas)) {
    return refus("parametres.plage.refus_plage_courte");
  }
  return sousLeVerrouDeLaBase(() =>
    tx.calendrierPlage.updateMany({
      where: { id: plageId },
      data: {
        debut_minutes: forme.data.debutMinutes,
        fin_minutes: forme.data.finMinutes,
      },
    }),
  );
}

/**
 * RETIRER UNE PLAGE — et retirer la dernière d'un jour, c'est FERMER ce jour.
 *
 * Aucun refus n'est opposé au dernier retrait : une agence a le droit de fermer
 * le samedi. Ce que l'écran doit dire, il le dit ; ce que la base garde, elle le
 * garde — et « ce jour n'a plus de plage » n'est pas un état interdit, c'est
 * l'état « fermé ».
 */
export async function retirerPlage(
  tx: Prisma.TransactionClient,
  plageId: string,
): Promise<Reglage> {
  const touchees = await tx.calendrierPlage.deleteMany({
    where: { id: plageId },
  });
  // Zéro ligne touchée n'est pas une erreur technique : c'est la politique qui a
  // refusé, et elle refuse en silence. Le message est le même que pour un
  // identifiant inconnu (D35, D50).
  return touchees.count === 0
    ? refus("parametres.plage.refus_introuvable")
    : ACCEPTE;
}

/**
 * RÉGLER LE PAS — et le refuser quand il déborderait la plus courte plage.
 *
 * Ce second sens est celui qu'on oublie : le pas se règle depuis la ligne du
 * tableau, la plage depuis l'écran de détail, et n'en garder qu'un laisserait
 * l'autre produire l'état interdit — *un jour affiché comme ouvert sur lequel le
 * planning ne propose rien.*
 */
export async function reglerLePas(
  tx: Prisma.TransactionClient,
  calendrierId: string,
  pasMinutes: number,
): Promise<Reglage> {
  const forme = schemaPasCreneau.safeParse(pasMinutes);
  if (!forme.success) {
    return refus("parametres.refus_pas");
  }
  const contexte = await contexteDuCalendrier(tx, calendrierId);
  if (contexte === null) {
    return refus("parametres.refus_pas");
  }
  const plusCourte = plageLaPlusCourte(contexte.plages);
  if (plusCourte !== null && forme.data > plusCourte) {
    return refus("parametres.pas.refus_plage_courte");
  }
  return sousLeVerrouDeLaBase(() =>
    tx.calendrier.updateMany({
      where: { id: calendrierId },
      data: { pas_creneau_minutes: forme.data },
    }),
  );
}
