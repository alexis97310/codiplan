/**
 * ── LE RETOUR AU PARC REJOINT LA LISTE TELLE QU'ON L'AVAIT LAISSÉE
 * (79-LIENS-3) ────────────────────────────────────────────────────────────
 *
 * *Mesuré sur main le 25/09/2026 : « Fiche complète » (`page.tsx`) menait à
 * `/parc/<id>` nu, et le lien « Retour » de la fiche (`[id]/page.tsx`) vers
 * `/parc` nu — les filtres, la recherche et la page en cours étaient PERDUS
 * à chaque fiche ouverte.* Même défaut, même remède que 78-LIENS-2 sur le
 * registre des interventions (`app/(back-office)/interventions/
 * presentation.ts`, `retourActuelDuRegistre`/`retourVersRegistre`) — repris
 * ICI plutôt qu'importé : au 25/09/2026, ce lot n'est publié sur aucune
 * branche fusionnée dans `main` (`78-LIENS-2-garde`), et une fonction share
 * ne peut pas se lire depuis une branche qui n'existe pas encore pour
 * celle-ci. Le PARC et le REGISTRE ne lisent d'ailleurs pas la même liste de
 * paramètres — un module séparé, pas une duplication du même critère.
 *
 * « Tel qu'on l'avait laissé » se limite, comme le titre du ticket le
 * borne, aux FILTRES, à la RECHERCHE et à la PAGE — jamais à `machine`, la
 * sélection éphémère du maître-détail : ce n'est pas un filtre de recherche,
 * c'est un état d'écran qui n'a pas sa place dans un lien qui en sort.
 *
 * Rejetée EN BLOC — retour à `/parc` nu — dès que la valeur brute porte
 * `://`, `//` ou `:` (D50, redirection ouverte) : aucune des clés connues ne
 * porte ce caractère dans une valeur légitime (un UUID sans deux-points, un
 * entier, un texte de recherche libre), donc sa présence ne peut être qu'un
 * schéma d'URL détourné.
 */

/**
 * LA LISTE FERMÉE DES PARAMÈTRES QUE LE RETOUR PORTE — EXACTEMENT ceux que
 * `hrefDeLaLigne` et `hrefPage` de `page.tsx` composent déjà pour une AUTRE
 * page du même écran, jamais une seconde liste tenue à la main qui pourrait
 * diverger en silence de celle que `retourVersParc` relit plus bas (§9,
 * 01/09).
 */
export const PARAMETRES_RETOUR_PARC = [
  "q",
  "statut",
  "client",
  "site",
  "famille",
  "page",
] as const;

/** Une valeur de retour plus longue que ceci n'est pas un filtre plausible. */
const LONGUEUR_MAXIMALE_VALEUR_RETOUR = 200;

/**
 * LA REQUÊTE ACTIVE DU PARC, ENCODÉE — composée sur le lien « Fiche
 * complète » (`page.tsx`), pour que `retourVersParc` ci-dessous la rejoue
 * depuis la fiche. Prend les valeurs BRUTES de la requête en cours, jamais
 * les critères déjà analysés par `schemaRechercheParc` — la même prudence
 * que `retourActuelDuRegistre` applique déjà pour `du`/`au`.
 */
export function retourActuelDuParc(
  params: Readonly<Record<string, string | readonly string[] | undefined>>,
): string {
  const requete = new URLSearchParams();
  for (const cle of PARAMETRES_RETOUR_PARC) {
    const valeur = params[cle];
    const premiere = Array.isArray(valeur) ? valeur[0] : valeur;
    if (typeof premiere === "string" && premiere.length > 0) {
      requete.set(cle, premiere);
    }
  }
  return requete.toString();
}

/**
 * LE RETOUR — `/parc` nu quand `retour` est absent, vide, ou porte un schéma
 * d'URL détourné ; sinon la requête re-filtrée sur la même liste fermée.
 */
export function retourVersParc(
  retour: string | readonly string[] | undefined,
): string {
  const brut = Array.isArray(retour) ? retour[0] : retour;
  if (typeof brut !== "string" || brut.length === 0) {
    return "/parc";
  }
  if (brut.includes("://") || brut.includes("//") || brut.includes(":")) {
    return "/parc";
  }
  const recus = new URLSearchParams(brut);
  const conserves = new URLSearchParams();
  for (const cle of PARAMETRES_RETOUR_PARC) {
    const valeur = recus.get(cle);
    if (valeur !== null && valeur.length <= LONGUEUR_MAXIMALE_VALEUR_RETOUR) {
      conserves.set(cle, valeur);
    }
  }
  const requete = conserves.toString();
  return requete.length === 0 ? "/parc" : `/parc?${requete}`;
}

/**
 * ── UN INTERTITRE PAR CLIENT, JAMAIS DEUX LIGNES CONSÉCUTIVES DU MÊME
 * (99Z-GR10-PARC, décision B, 26/09/2026) ──────────────────────────────────
 *
 * Le tri du parc (`rechercherLeParc`, `lib/machines/depot.ts`) groupe déjà
 * les lignes par client, PUIS par `complet` (99C-PARC-TRI, PARC-A) — mais
 * rien ne le MONTRAIT : une longue liste de fiches sans repère visuel, un ADV
 * qui cherche « où commence tel client » devait lire chaque ligne. Cette
 * fonction ne trie rien — elle n'est correcte QUE parce que `lignes` lui
 * arrive déjà groupée par client — elle se contente d'insérer un intertitre
 * à chaque changement de `client_id`, y compris en tête de page.
 *
 * **Un client présent dans les deux parties (les complètes, puis les
 * incomplètes, PARC-A) porte deux intertitres.** Ce n'est pas un cas
 * particulier : entre les deux occurrences, `client_id` a changé au moins
 * une fois (une autre lettre de l'alphabet s'est intercalée, ou le groupe des
 * incomplètes a changé de client) — le simple compteur « client précédent »
 * le redécouvre sans qu'on le lui dise.
 */
export type ElementDeListeDuParc<T> =
  | {
      readonly type: "intertitre";
      readonly clientId: string;
      readonly libelle: string;
    }
  | { readonly type: "ligne"; readonly machine: T };

/** Ce que le regroupement exige d'une ligne — jamais toute `LigneDeParc`. */
export type LigneAvecClient = {
  readonly client_id: string;
  readonly client: { readonly raison_sociale: string };
};

export function regrouperLeParcParClient<T extends LigneAvecClient>(
  lignes: readonly T[],
): readonly ElementDeListeDuParc<T>[] {
  const elements: ElementDeListeDuParc<T>[] = [];
  let clientPrecedent: string | null = null;
  for (const machine of lignes) {
    if (machine.client_id !== clientPrecedent) {
      elements.push({
        type: "intertitre",
        clientId: machine.client_id,
        libelle: machine.client.raison_sociale,
      });
      clientPrecedent = machine.client_id;
    }
    elements.push({ type: "ligne", machine });
  }
  return elements;
}
