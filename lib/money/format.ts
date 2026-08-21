import {
  suffixeDevise,
  uniteParDevise,
  type CodeDevise,
  type Devise,
} from "./devise";
import type { MontantAgrege } from "./agregat";
import type { MontantConsolide } from "./consolide";
import { ErreurDeviseIncompatible, type Montant } from "./montant";

/**
 * Le point de passage unique du formatage monétaire (I3, D19).
 *
 * **Convention.** Symbole si la devise en a un, code sinon — `1 234,56 €`,
 * `7 000 XPF`. Typographie française : espace insécable comme séparateur de
 * milliers et devant la devise, virgule décimale.
 *
 * **Pourquoi pas `Intl.NumberFormat`.** Deux raisons, et la seconde suffirait.
 * D'abord le nombre de décimales viendrait alors de la locale ou du code ISO
 * connu d'ICU, alors qu'il doit venir de la table `devise` et d'elle seule
 * (I3, RG-TAR-03). Ensuite le séparateur de milliers d'ICU en français a changé
 * de caractère selon les versions — espace insécable, puis espace fine
 * insécable : un rendu qui dépend de la version d'ICU installée sur le serveur
 * n'est pas un rendu spécifié, et ne se teste pas.
 *
 * L'arithmétique reste entière de bout en bout : la partie entière et la partie
 * décimale sortent d'un quotient et d'un reste, jamais d'une division flottante.
 */

/** U+00A0. Un montant ne se coupe jamais en fin de ligne. */
const ESPACE_INSECABLE = "\u00a0";

/** Séparateur décimal français. */
const VIRGULE = ",";

const ZERO = BigInt(0);

/** Groupe les chiffres par trois, depuis la droite. */
function grouperMilliers(chiffres: string): string {
  let resultat = "";
  for (let index = chiffres.length; index > 0; index -= 3) {
    const debut = Math.max(0, index - 3);
    const tranche = chiffres.slice(debut, index);
    resultat =
      resultat === "" ? tranche : `${tranche}${ESPACE_INSECABLE}${resultat}`;
  }
  return resultat;
}

/**
 * Rend la valeur, exprimée dans l'unité la plus fine, sous sa forme française,
 * devise comprise. Cœur commun aux deux entrées publiques.
 *
 * Le contrôle de cohérence est ici et non au type seul : deux codes lus en base
 * portent tous deux `string`, et le compilateur ne peut alors rien affirmer.
 * Formater un montant en XPF avec la ligne EUR donnerait `70,00 €` là où il
 * fallait lire `7 000 XPF` — un chiffre faux, mais parfaitement présentable.
 */
function formater(
  valeur: bigint,
  codeAttendu: CodeDevise,
  devise: Devise,
): string {
  if (codeAttendu !== devise.code) {
    throw new ErreurDeviseIncompatible("formatage", codeAttendu, devise.code);
  }
  const unite = uniteParDevise(devise);
  const negatif = valeur < ZERO;
  const absolu = negatif ? -valeur : valeur;

  const entiere = grouperMilliers((absolu / unite).toString());
  const decimale =
    devise.decimales === 0
      ? ""
      : VIRGULE + (absolu % unite).toString().padStart(devise.decimales, "0");

  const signe = negatif ? "-" : "";
  return `${signe}${entiere}${decimale}${ESPACE_INSECABLE}${suffixeDevise(devise)}`;
}

/**
 * Formate un montant réel ou agrégé dans sa devise (D19).
 *
 * La devise est passée séparément parce qu'elle vient de la table : le montant
 * n'en porte que le code, jamais les décimales ni le symbole, qui changeraient
 * alors indépendamment du référentiel.
 */
export function formatMoney<C extends CodeDevise>(
  montant: Montant<C> | MontantAgrege<C>,
  devise: Devise<NoInfer<C>>,
): string {
  return formater(montant.valeur, montant.devise, devise);
}

/**
 * Formate un montant **consolidé**, c'est-à-dire converti (D19, chapitre 4.4).
 *
 * Fonction distincte, et non une surcharge de `formatMoney` : afficher un
 * chiffre converti est une décision, jamais un effet de bord d'un appel banal.
 * La devise attendue est celle de **restitution** ; la mention qui signale au
 * lecteur qu'il regarde une consolidation relève de l'écran qui l'affiche, et
 * sera arrêtée au lot du reporting.
 */
export function formatMoneyConsolide<C extends CodeDevise>(
  montant: MontantConsolide<C>,
  deviseRestitution: Devise<NoInfer<C>>,
): string {
  return formater(montant.valeur, montant.devise, deviseRestitution);
}
