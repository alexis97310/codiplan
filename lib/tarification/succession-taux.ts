import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { exigerSocieteActive, type ContexteSession } from "@/lib/auth/contexte";
import { cleJour, lireCleJour } from "@/lib/calendar/fuseau";
import { avecContexteApplicatif } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";
import { lireDevise, montant, type Devise, type Montant } from "@/lib/money";

/**
 * LA SUCCESSION D'UN TAUX HORAIRE — le chemin ORDINAIRE (ticket TAUX-1,
 * RG-TAR-04).
 *
 * ## Ce qu'il répare
 *
 * `taux_horaire` n'avait qu'UN seul chemin d'écriture dans tout le dépôt :
 * `poserTauxInitial`, atteint uniquement par le geste d'amorçage. Un taux posé
 * à la mise en service ne pouvait plus jamais évoluer — aucune route, aucun
 * écran, et le script refuse dès qu'une ligne existe. Un tarif qui change
 * (hausse au 1er janvier, correction d'échelle) n'avait nulle part où aller,
 * alors que la table est HISTORISÉE par date d'effet depuis le 09/09/2026
 * précisément pour porter ce changement (RG-TAR-04).
 *
 * ## Ce que « succéder » veut dire, et ce que ça n'est PAS
 *
 * **Un taux ne se modifie jamais, il se succède.** Cette fonction pose une
 * NOUVELLE ligne, à sa propre date d'effet ; elle ne réécrit et ne supprime
 * AUCUNE ligne passée. `tauxEnVigueur` (`./taux-horaire.ts`) continue de
 * choisir, à la LECTURE, la ligne dont la date d'effet est la plus récente
 * parmi celles qui ne dépassent pas la date demandée — une intervention datée
 * avant la nouvelle ligne continue donc de lire l'ancien taux, sans qu'aucun
 * code n'ait à le savoir.
 *
 * **Elle ne porte AUCUN cliquet de premier taux** — ce cliquet est celui de
 * `poserTauxInitial`, qui reste le seul geste de MISE EN SERVICE et n'est pas
 * touché ici. Poser une succession alors qu'aucun taux n'existe encore est
 * accepté : la table ne distingue pas « premier taux » de « taux suivant »,
 * seule la date d'effet compte, et rien n'empêche par ailleurs qu'un taux
 * existe sans être passé par l'amorçage (une base restaurée, une correction).
 *
 * ## Ce qu'elle ne lit PAS
 *
 * Aucune fonction ici ne relit « le taux en vigueur » : ce serait une seconde
 * implémentation du même critère que `tauxEnVigueur`, et *une seconde écriture
 * d'un même critère diverge en silence* (§9, 01/09). L'écran d'historique et la
 * fiche d'intervention passent tous deux par `tauxEnVigueur` ; cette fonction
 * se limite à ÉCRIRE.
 */

export const schemaSuccessionTaux = z.object({
  /** Entier strictement positif, dans l'unité la plus fine de la devise de la
   * société : zéro se lirait « gratuit », et un taux manquant ne se lit jamais
   * gratuit (voir `poserTauxInitial`). Sans défaut : un montant est un prix,
   * jamais une valeur inventée par le code (CLAUDE.md §8). */
  montant_mineur: z.number().int().positive(),
  /** Jour local `AAAA-MM-JJ`, toujours fourni — une succession est un geste
   * délibéré, et sa date d'effet ne se devine pas. */
  date_effet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type SaisieSuccessionTaux = z.infer<typeof schemaSuccessionTaux>;

const VIOLATION_UNICITE = "P2002";

/** Ce qu'un refus dit, et il n'en dit jamais plus. */
export type MotifRefusSuccessionTaux =
  /** Zéro se lirait « gratuit » — voir `poserTauxInitial`. */
  | "montant_invalide"
  /** `@@unique([societe_id, date_effet])` — deux taux ne partagent pas un jour. */
  | "date_deja_utilisee"
  /** Aucune société active n'est lisible sous ce contexte. */
  | "societe_introuvable";

export type ResultatSuccessionTaux =
  | {
      readonly accepte: true;
      readonly id: string;
      /** Jour local `AAAA-MM-JJ`, dans la forme canonique — voir `cleJour`. */
      readonly dateEffet: string;
      readonly taux: Montant;
      /** La devise, lue au référentiel : de quoi formater le montant (D19). */
      readonly devise: Devise;
    }
  | { readonly accepte: false; readonly motif: MotifRefusSuccessionTaux };

/**
 * Pose un nouveau taux horaire pour la société active — le chemin ORDINAIRE.
 *
 * @param client client Prisma explicite, pour les scénarios d'isolation qui se
 *   connectent déjà sous le rôle applicatif restreint.
 */
export async function succederTaux(
  contexte: ContexteSession,
  demande: {
    /** Entier, dans l'unité la plus fine de la devise de la société. */
    readonly montantMineur: bigint;
    /** Jour local `AAAA-MM-JJ`. */
    readonly dateEffet: string;
  },
  client?: PrismaClient,
): Promise<ResultatSuccessionTaux> {
  // DÉFENSE EN PROFONDEUR : la route qui appelle cette fonction valide déjà le
  // montant par `schemaSuccessionTaux`, mais la fonction reste sûre à appeler
  // directement — comme `poserTauxInitial`, qu'aucun schéma ne protège.
  if (demande.montantMineur <= BigInt(0)) {
    return { accepte: false as const, motif: "montant_invalide" as const };
  }

  // La forme du jour est vérifiée AVANT la transaction : une date mal formée
  // ne doit pas dépendre de ce que la base a à dire.
  const dateEffet = cleJour(lireCleJour(demande.dateEffet));

  const societeId = exigerSocieteActive(contexte);

  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      // `societe` est de forme « identité » (D42) : sa politique RLS rend
      // toutes les sociétés dont l'utilisateur est habilité, jamais la seule
      // active — MESURÉ (une lecture sans `where: { id }` a rendu la devise
      // d'une AUTRE société, faisant mordre le déclencheur de cohérence). La
      // société doit donc être NOMMÉE par son id, comme `poserTauxInitial`
      // le fait déjà.
      const societe = await tx.societe.findUnique({
        where: { id: societeId },
        select: {
          devise: { select: { code: true, decimales: true, symbole: true } },
        },
      });
      if (societe === null) {
        return {
          accepte: false as const,
          motif: "societe_introuvable" as const,
        };
      }

      const devise = lireDevise(societe.devise);
      const id = uuidv7();
      try {
        await tx.tauxHoraire.create({
          data: {
            id,
            societe_id: societeId,
            date_effet: new Date(`${dateEffet}T00:00:00.000Z`),
            montant_mineur: demande.montantMineur,
            // La devise est celle de la SOCIÉTÉ, jamais un paramètre : le
            // déclencheur de la table refuserait une autre de toute façon.
            devise_code: devise.code,
          },
        });
      } catch (erreur: unknown) {
        if (
          erreur instanceof Prisma.PrismaClientKnownRequestError &&
          erreur.code === VIOLATION_UNICITE
        ) {
          return {
            accepte: false as const,
            motif: "date_deja_utilisee" as const,
          };
        }
        throw erreur;
      }

      return {
        accepte: true as const,
        id,
        dateEffet,
        taux: montant(demande.montantMineur, devise.code),
        devise,
      };
    },
    client,
  );
}
