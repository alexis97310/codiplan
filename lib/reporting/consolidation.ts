import { z } from "zod";

import { arrondirAuPlusProche } from "@/lib/money/arrondi";
import { marquerConsolide, type MontantConsolide } from "@/lib/money/consolide";
import {
  uniteParDevise,
  type CodeDevise,
  type Devise,
} from "@/lib/money/devise";
import type { MontantAgrege } from "@/lib/money/agregat";

/**
 * La **seule** conversion de devise du dépôt (I2, D19, CLAUDE.md §6).
 *
 * Elle vit dans `lib/reporting` et nulle part ailleurs. Ce n'est pas une
 * question de rangement : convertir ligne à ligne, c'est faire varier une
 * facture au gré d'un taux, et la règle RG-TAR-02 l'interdit. Trois gardiens
 * statiques tiennent la frontière — `tests/unit/money/conversion-reservee.test.ts`,
 * `tests/unit/money/sans-litteral-de-parite.test.ts` et
 * `tests/unit/money/sans-decimales-en-dur.test.ts`.
 *
 * Trois refus structurent ce module :
 *
 * 1. **Refus du montant unitaire.** L'entrée est un `MontantAgrege`, qui ne
 *    s'obtient que par `agreger`. Un `Montant` ne compile pas ici (D19).
 * 2. **Refus de la date implicite.** Aucune valeur par défaut « aujourd'hui » :
 *    un rapport historique rejoué doit donner le même chiffre qu'à sa première
 *    exécution, ce qu'une date implicite lui retirerait silencieusement (D20 :
 *    date de clôture de la période analysée).
 * 3. **Refus du taux en dur.** Les parités sont lues dans la table `parite`,
 *    passées ici en argument. Pas même la parité légale fixe du franc Pacifique
 *    n'est écrite dans ce fichier — elle est amorcée par `prisma/seed-data.ts`,
 *    et rien d'autre du dépôt n'a le droit de la citer.
 *
 * Le résultat est un `MontantConsolide`, type distinct de `Montant` : un chiffre
 * converti ne rentre dans aucun calcul métier et ne s'affiche que par
 * `formatMoneyConsolide`.
 */

/**
 * Une ligne de la table `parite`, telle que Prisma la rend. `taux` est une
 * chaîne décimale — `Decimal(18,8)` — et le reste ainsi : la convertir en
 * `number` perdrait des chiffres significatifs avant même le premier calcul.
 */
export type LigneParite = {
  readonly devise_code: string;
  readonly date_effet: Date | string;
  readonly taux: string;
};

/**
 * Un taux, en fraction exacte : `mantisse / 10^echelle`. L'échelle est **lue
 * dans la chaîne** : le nombre de chiffres après le point, quel qu'il soit.
 * Deux écritures d'un même taux, avec ou sans zéros de queue, donnent donc le
 * même résultat, et le jour où la colonne changera de précision ce module
 * n'aura rien à apprendre. Aucun taux n'est écrit dans ce fichier, pas même en
 * exemple : ils vivent tous dans `prisma/seed-data.ts` (gardien
 * `tests/unit/money/sans-litteral-de-parite.test.ts`).
 */
type Taux = {
  readonly mantisse: bigint;
  readonly echelle: number;
};

const UN = BigInt(1);
const DIX = BigInt(10);

/** Le taux neutre : celui de la devise de base, qui vaut 1 par définition. */
const TAUX_NEUTRE: Taux = { mantisse: UN, echelle: 0 };

/** Une date de parité s'écrit `AAAA-MM-JJ`. Explicite, sans fuseau, sans heure. */
const schemaDateParite = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date de parité attendue au format AAAA-MM-JJ")
  .refine((valeur) => !Number.isNaN(Date.parse(`${valeur}T00:00:00Z`)), {
    message: "date de parité inexistante au calendrier",
  });

/** Un taux s'écrit en décimal positif, signe et notation exponentielle exclus. */
const schemaTaux = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "taux de parité attendu en décimal positif");

/**
 * Normalise une date de parité en `AAAA-MM-JJ`. Les `Date` issues d'une colonne
 * PostgreSQL `date` sont à minuit UTC : c'est en UTC qu'on les relit, faute de
 * quoi le décalage +11 de Nouméa décalerait la date d'un jour.
 */
function jour(date: Date | string): string {
  const texte =
    typeof date === "string" ? date : date.toISOString().slice(0, 10);
  return schemaDateParite.parse(texte);
}

/** Décompose une chaîne décimale en fraction exacte. */
function lireTaux(texte: string): Taux {
  const valide = schemaTaux.parse(texte);
  const [entiere, decimales = ""] = valide.split(".");
  return {
    mantisse: BigInt(`${entiere}${decimales}`),
    echelle: decimales.length,
  };
}

/**
 * Le jeu de parités applicable à une date donnée — le seul objet que
 * `convertForConsolidation` accepte comme quatrième argument.
 *
 * **Pourquoi la date voyage avec les taux.** L'arbitrage D19 exige « une date
 * de parité explicite ». La passer à côté des taux laisserait subsister le cas
 * le plus difficile à voir : des taux résolus à une date, et une autre date
 * inscrite sur le résultat. Ici, les deux ne se séparent plus.
 */
export type ParitesDatees = {
  /** Devise dans laquelle les taux s'expriment : « X pour 1 base ». */
  readonly deviseBase: CodeDevise;
  /** Date d'application, `AAAA-MM-JJ`. */
  readonly date: string;
  readonly taux: ReadonlyMap<CodeDevise, Taux>;
};

/**
 * Retient, pour chaque devise, la parité en vigueur à la date demandée : la
 * plus récente dont la date d'effet ne lui est pas postérieure.
 *
 * `deviseBase` est demandée et jamais devinée. Le sens du taux — « combien
 * d'unités pour une unité de la base » — est une convention du référentiel, non
 * une propriété de la table ; l'inscrire en dur ici reviendrait à décider dans
 * un module ce qui se décide dans un arbitrage.
 */
export function resoudreParites(
  lignes: readonly LigneParite[],
  deviseBase: CodeDevise,
  date: string,
): ParitesDatees {
  const dateApplication = schemaDateParite.parse(date);
  const retenues = new Map<CodeDevise, { effet: string; taux: Taux }>();

  for (const ligne of lignes) {
    if (ligne.devise_code === deviseBase) {
      throw new Error(
        `La table parite porte une ligne pour ${deviseBase}, déclarée devise ` +
          "de base : son taux vaut 1 par définition. Deux conventions " +
          "coexistent, il faut trancher laquelle avant de consolider.",
      );
    }
    const effet = jour(ligne.date_effet);
    if (effet > dateApplication) {
      continue;
    }
    const deja = retenues.get(ligne.devise_code);
    if (deja === undefined || effet > deja.effet) {
      retenues.set(ligne.devise_code, { effet, taux: lireTaux(ligne.taux) });
    }
  }

  const taux = new Map<CodeDevise, Taux>([[deviseBase, TAUX_NEUTRE]]);
  for (const [code, retenue] of retenues) {
    taux.set(code, retenue.taux);
  }

  return { deviseBase, date: dateApplication, taux };
}

function tauxDe(parites: ParitesDatees, devise: Devise): Taux {
  const taux = parites.taux.get(devise.code);
  if (taux === undefined) {
    throw new Error(
      `Aucune parité pour ${devise.code} au ${parites.date} : la table parite ` +
        `n'en porte aucune dont la date d'effet précède cette date. La ` +
        "consolidation refuse d'inventer un taux.",
    );
  }
  return taux;
}

/**
 * Convertit un agrégat d'une devise vers une autre, à une parité datée (I2,
 * D19, D20).
 *
 * Arithmétique entière de bout en bout. En posant `v` la valeur agrégée, `dS` et
 * `dC` les décimales des deux devises et `tS`, `tC` les taux « unités pour une
 * unité de base », la valeur cible vaut :
 *
 *     v × 10^dC × tC ÷ (10^dS × tS)
 *
 * arrondie par `arrondirAuPlusProche`, l'unique arrondi du dépôt. Les taux
 * étant eux-mêmes des fractions exactes, numérateur et dénominateur restent
 * entiers : aucun flottant n'intervient, à aucune étape.
 */
export function convertForConsolidation<
  S extends CodeDevise,
  C extends CodeDevise,
>(
  agregat: MontantAgrege<S>,
  deviseSource: Devise<NoInfer<S>>,
  deviseCible: Devise<C>,
  parites: ParitesDatees,
): MontantConsolide<C> {
  if (agregat.devise !== deviseSource.code) {
    throw new Error(
      `L'agrégat est en ${agregat.devise} mais la devise source annoncée est ` +
        `${deviseSource.code}. Un montant ne voyage jamais sans sa devise (I2).`,
    );
  }

  const tauxSource = tauxDe(parites, deviseSource);
  const tauxCible = tauxDe(parites, deviseCible);

  const numerateur =
    agregat.valeur *
    uniteParDevise(deviseCible) *
    tauxCible.mantisse *
    DIX ** BigInt(tauxSource.echelle);
  const denominateur =
    uniteParDevise(deviseSource) *
    tauxSource.mantisse *
    DIX ** BigInt(tauxCible.echelle);

  return marquerConsolide(
    arrondirAuPlusProche(numerateur, denominateur),
    deviseCible.code,
    parites.date,
  );
}
