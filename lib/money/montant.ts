import type { CodeDevise } from "./devise";

/**
 * Le type `Montant` — un montant ne voyage jamais sans sa devise (I2, RG-TAR-01).
 *
 * **Représentation.** Un entier, dans l'unité la plus fine de sa devise : le
 * franc pour le XPF (zéro décimale), le centime pour l'EUR (deux). Jamais un
 * flottant — `0.1 + 0.2 !== 0.3` n'est pas une curiosité quand il s'agit d'une
 * facture — et jamais un `number` en stockage : au-delà de 2^53 francs, un
 * `number` cesse silencieusement de compter juste, et le franc Pacifique
 * s'écrit sans décimale, donc en grands nombres. D'où `bigint`.
 *
 * **Un nombre nu qui représente de l'argent est un défaut.** Le code de la
 * devise fait partie du montant, et le paramètre de type le porte : quand les
 * codes sont connus littéralement — `montant(7000, "XPF")` —, additionner un
 * `Montant<"XPF">` à un `Montant<"EUR">` **ne compile pas**. Quand ils ne le
 * sont pas — deux lignes lues en base —, le contrôle a lieu à l'exécution et
 * l'erreur nomme les deux devises.
 *
 * **`nature`** distingue structurellement les trois natures de montants :
 * réel (celui-ci), agrégé (`MontantAgrege`) et consolidé (`MontantConsolide`).
 * Sans ce discriminant, un chiffre converti serait assignable à un montant réel
 * — TypeScript compare les formes, pas les intentions — et pourrait rentrer
 * dans un calcul métier, ce que le ticket L0-07 interdit expressément.
 */
export type Montant<C extends CodeDevise = CodeDevise> = {
  readonly nature: "reel";
  /** Valeur entière, dans l'unité la plus fine de la devise. */
  readonly valeur: bigint;
  readonly devise: C;
};

/** Levée dès qu'une opération met en présence deux devises différentes (I2). */
export class ErreurDeviseIncompatible extends Error {
  constructor(
    readonly operation: string,
    readonly gauche: CodeDevise,
    readonly droite: CodeDevise,
  ) {
    super(
      `Opération « ${operation} » entre deux devises différentes : ` +
        `${gauche} et ${droite}. Les montants ne sont jamais convertis ligne ` +
        "à ligne (I2) : la conversion n'existe que sur les agrégats de " +
        "consolidation, dans lib/reporting.",
    );
    this.name = "ErreurDeviseIncompatible";
  }
}

/** Levée quand on tente de construire un montant qui n'est pas un entier. */
export class ErreurMontantNonEntier extends Error {
  constructor(readonly valeur: number) {
    super(
      `Montant non entier : ${valeur}. Un montant s'exprime en unités les ` +
        "plus fines de sa devise (franc, centime) et n'a donc pas de partie " +
        "décimale. Arrondir d'abord avec arrondirAuPlusProche.",
    );
    this.name = "ErreurMontantNonEntier";
  }
}

const ZERO = BigInt(0);

/**
 * Construit un montant. Accepte un `number` par commodité d'écriture — il est
 * contrôlé entier et sûr, puis converti : ce qui est **stocké** reste un
 * `bigint`.
 */
export function montant<C extends CodeDevise>(
  valeur: bigint | number,
  devise: C,
): Montant<C> {
  if (typeof valeur === "number" && !Number.isSafeInteger(valeur)) {
    throw new ErreurMontantNonEntier(valeur);
  }
  return {
    nature: "reel",
    valeur: typeof valeur === "bigint" ? valeur : BigInt(valeur),
    devise,
  };
}

/** Le zéro de la devise. Utile comme élément neutre d'une somme. */
export function zero<C extends CodeDevise>(devise: C): Montant<C> {
  return { nature: "reel", valeur: ZERO, devise };
}

/**
 * `NoInfer` sur le second opérande, dans les opérations binaires ci-dessous :
 * sans lui, TypeScript unifierait `Montant<"XPF">` et `Montant<"EUR">` en
 * `Montant<"XPF" | "EUR">` et l'addition compilerait. Le paramètre de type se
 * fixe donc sur le premier opérande, et le second doit s'y conformer.
 *
 * Contrôle d'exécution du garde de devise, pour les cas où le type ne suffit
 * pas — deux montants lus en base portent tous deux le type `CodeDevise`, et le
 * compilateur ne peut alors rien affirmer.
 */
function memeDevise(
  operation: string,
  gauche: CodeDevise,
  droite: CodeDevise,
): void {
  if (gauche !== droite) {
    throw new ErreurDeviseIncompatible(operation, gauche, droite);
  }
}

/** Somme de deux montants de même devise. */
export function additionner<C extends CodeDevise>(
  gauche: Montant<C>,
  droite: Montant<NoInfer<C>>,
): Montant<C> {
  memeDevise("addition", gauche.devise, droite.devise);
  return {
    nature: "reel",
    valeur: gauche.valeur + droite.valeur,
    devise: gauche.devise,
  };
}

/** Différence de deux montants de même devise. */
export function soustraire<C extends CodeDevise>(
  gauche: Montant<C>,
  droite: Montant<NoInfer<C>>,
): Montant<C> {
  memeDevise("soustraction", gauche.devise, droite.devise);
  return {
    nature: "reel",
    valeur: gauche.valeur - droite.valeur,
    devise: gauche.devise,
  };
}

/** Opposé d'un montant — un avoir, une reprise. */
export function opposer<C extends CodeDevise>(
  montantSource: Montant<C>,
): Montant<C> {
  return {
    nature: "reel",
    valeur: -montantSource.valeur,
    devise: montantSource.devise,
  };
}

/**
 * Multiplie un montant par un entier — une quantité de pièces, un nombre de
 * techniciens. Le facteur est entier à dessein : multiplier par un taux
 * fractionnaire suppose une règle d'arrondi, qui appartient à la règle de
 * gestion et non à la primitive.
 */
export function multiplier<C extends CodeDevise>(
  montantSource: Montant<C>,
  facteur: bigint | number,
): Montant<C> {
  if (typeof facteur === "number" && !Number.isSafeInteger(facteur)) {
    throw new ErreurMontantNonEntier(facteur);
  }
  return {
    nature: "reel",
    valeur:
      montantSource.valeur *
      (typeof facteur === "bigint" ? facteur : BigInt(facteur)),
    devise: montantSource.devise,
  };
}

/** `-1`, `0` ou `1` — comparaison de deux montants de même devise. */
export function comparer<C extends CodeDevise>(
  gauche: Montant<C>,
  droite: Montant<NoInfer<C>>,
): -1 | 0 | 1 {
  memeDevise("comparaison", gauche.devise, droite.devise);
  if (gauche.valeur < droite.valeur) {
    return -1;
  }
  return gauche.valeur > droite.valeur ? 1 : 0;
}

/** Égalité de deux montants de même devise. */
export function estEgal<C extends CodeDevise>(
  gauche: Montant<C>,
  droite: Montant<NoInfer<C>>,
): boolean {
  return comparer(gauche, droite) === 0;
}

/** Vrai si le montant est strictement négatif. */
export function estNegatif(montantSource: Montant): boolean {
  return montantSource.valeur < ZERO;
}
