import { z } from "zod";

/**
 * La devise, telle qu'elle est lue dans la table `devise` (I1 — référentiel de
 * plateforme). C'est **elle** qui porte le nombre de décimales, jamais le code
 * applicatif et jamais une locale (I3, RG-TAR-03).
 *
 * Ce module ne connaît ni XPF ni EUR : il ne sait que lire une ligne de la
 * table. Écrire `if (code === "XPF") decimales = 0` reviendrait à recopier le
 * référentiel dans le code, où il cesserait de suivre la table le jour où une
 * troisième devise apparaît — et le chapitre 4.3 dit expressément que la table
 * reste ouverte.
 */

/**
 * Code ISO d'une devise. Volontairement `string` et non une énumération : la
 * liste des devises est une donnée, pas une décision de compilation.
 *
 * Le paramètre de type sert d'étiquette : `Montant<"XPF">` et `Montant<"EUR">`
 * sont deux types distincts, si bien qu'additionner l'un à l'autre ne compile
 * pas quand les codes sont connus littéralement.
 */
export type CodeDevise = string;

/** Une ligne de la table `devise`, réduite à ce dont l'arithmétique a besoin. */
export type Devise<C extends CodeDevise = CodeDevise> = {
  readonly code: C;
  /** Nombre de décimales de la devise. XPF : 0, EUR : 2 — lu, jamais déduit. */
  readonly decimales: number;
  /** Symbole s'il en existe un, `null` sinon : on affiche alors le code (D19). */
  readonly symbole: string | null;
};

/**
 * Borne haute du nombre de décimales. Ce n'est pas un formatage en dur : c'est
 * un contrôle de vraisemblance sur une donnée du référentiel. Aucune devise en
 * circulation ne dépasse quatre décimales ; huit laisse toute la marge utile et
 * arrête net une ligne corrompue avant qu'elle ne produise des montants absurdes.
 */
const DECIMALES_MAXIMUM = 8;

/** Schéma de validation d'une ligne de `devise` (CLAUDE.md §2 — Zod partout). */
export const schemaDevise = z.object({
  code: z.string().min(1),
  decimales: z.number().int().min(0).max(DECIMALES_MAXIMUM),
  symbole: z.string().min(1).nullable(),
});

/**
 * Construit une `Devise` à partir d'un enregistrement quelconque — typiquement
 * une ligne Prisma. Toute entrée non conforme échoue ici, et non trois couches
 * plus loin dans un montant faux.
 */
export function lireDevise(enregistrement: unknown): Devise {
  return schemaDevise.parse(enregistrement);
}

const DIX = BigInt(10);

/**
 * Nombre d'unités les plus fines dans une unité de la devise : 1 pour le XPF,
 * 100 pour l'EUR. Seul point du dépôt où cette puissance de dix se calcule.
 */
export function uniteParDevise(devise: Devise): bigint {
  return DIX ** BigInt(devise.decimales);
}

/** Ce qu'on affiche à droite du nombre : le symbole s'il existe, le code sinon (D19). */
export function suffixeDevise(devise: Devise): string {
  return devise.symbole ?? devise.code;
}
