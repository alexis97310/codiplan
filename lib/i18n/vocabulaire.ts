import { type CleTraduction, t } from "./fr";

/**
 * Le vocabulaire imposé, et sa distinction (ticket L0-11).
 *
 * **Ce que ce module répare.** D5 a tranché que Ducos, Koné et Dolbeau sont des
 * **agences** CODIMA et non des **sites** clients, et a imposé que « ces deux
 * mots ne sont jamais interchangeables ». D47 a dû revenir corriger le chapitre
 * 10, où deux règles disaient « site » en désignant des agences — non par
 * négligence, mais parce que D5 corrigeait le glossaire et laissait les règles.
 * La leçon en avait été tirée pour la prose ; ce module la tire pour le code.
 *
 * **Comment la confusion devient plus difficile.** Le mot ne s'écrit qu'ici,
 * sous une clé du dictionnaire, et le code ne manipule plus le mot mais la
 * NOTION — `mot("agence")`. Écrire le mauvais mot n'est plus une faute de
 * frappe possible dans n'importe quel composant : il faut nommer la notion, et
 * la définition qui dit ce qu'elle n'est pas se lit à côté.
 *
 * **La limite, dite franchement.** Aucun gardien ne peut savoir laquelle des
 * deux notions un auteur voulait désigner : `mot("site")` là où il fallait
 * `mot("agence")` reste écrivable, et reste faux. Ce que le dispositif garantit
 * est plus étroit et suffit à ce que D47 réparait — le mot juste existe à un
 * seul endroit, il est défini, et sa définition nomme ce qu'il n'est pas.
 *
 * **Hors périmètre, au registre.** Un client acheteur voudra peut-être son
 * propre vocabulaire — « atelier » plutôt qu'« agence ». Rien ici ne l'empêche :
 * le code nomme la notion, jamais le mot, et un libellé propre à une société
 * viendrait se substituer à la valeur de la clé. Ce n'est pas construit.
 */

/** Les notions dont le mot est imposé. Le code les nomme ; il n'écrit pas le mot. */
export type NotionImposee = "agence" | "site";

/** Les clés du dictionnaire où une notion imposée s'écrit, et ce qu'elle n'est pas. */
export type TermeImpose = {
  /** Le mot, au singulier. */
  readonly libelle: CleTraduction;
  /** Le mot, au pluriel. */
  readonly pluriel: CleTraduction;
  /** Ce que la notion désigne, et ce qu'elle ne désigne jamais. */
  readonly definition: CleTraduction;
  /** L'autre notion — celle avec laquelle ce mot ne s'échange jamais (D5). */
  readonly jamais: NotionImposee;
};

export const VOCABULAIRE: Readonly<Record<NotionImposee, TermeImpose>> = {
  agence: {
    libelle: "vocabulaire.agence",
    pluriel: "vocabulaire.agence.pluriel",
    definition: "vocabulaire.agence.definition",
    jamais: "site",
  },
  site: {
    libelle: "vocabulaire.site",
    pluriel: "vocabulaire.site.pluriel",
    definition: "vocabulaire.site.definition",
    jamais: "agence",
  },
};

/**
 * Préfixe des clés où le vocabulaire imposé s'écrit en toutes lettres.
 *
 * Il est exporté parce que le gardien s'en sert pour distinguer, dans le
 * dictionnaire, les entrées qui ONT LE DROIT d'écrire le mot de celles qui
 * doivent le composer. La règle se déduit donc de la clé, elle ne s'énumère
 * pas entrée par entrée.
 */
export const PREFIXE_VOCABULAIRE = "vocabulaire.";

/** Le mot d'une notion imposée, au singulier ou au pluriel. */
export function mot(notion: NotionImposee, pluriel = false): string {
  const terme = VOCABULAIRE[notion];
  return t(pluriel ? terme.pluriel : terme.libelle);
}

/** Ce que la notion désigne, et ce qu'elle ne désigne jamais. */
export function definition(notion: NotionImposee): string {
  return t(VOCABULAIRE[notion].definition);
}
