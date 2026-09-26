import { t } from "@/lib/i18n";

/**
 * LE VERDICT D'UN TÉMOIN — extrait d'une fonction pure pour pouvoir l'éprouver
 * sans navigateur (99O-CAPTURES-TEMOIN, constat C-A2 de l'audit du 26/09/2026).
 *
 * ## CE QUE LE TÉMOIN SEUL NE VOYAIT PAS
 *
 * `arrivee` et `arrivee-sans-societe` visitent tous deux `/arrivee`, et
 * partageaient un seul témoin — « Choisir la société » — comparé par
 * `innerText().includes()`. Or `Choix` se rend dès qu'un compte porte AU MOINS
 * UNE société (`societes.length > 0`, `app/(back-office)/arrivee/page.tsx`),
 * active ou non : le même texte apparaît sur les DEUX écrans. **Mesuré au
 * `cmp`** : `docs/captures/arrivee-sans-societe--clair--{1280,390}.png` étaient
 * identiques à l'octet près à `arrivee--clair--*.png` — l'écran « aucune
 * société active » montrait en réalité une société active, et une image
 * fausse a circulé dans trois audits sans qu'aucune assertion ne rougisse.
 *
 * Deux contrôles de plus, propres à `arrivee-sans-societe` :
 *
 * - **le chemin réellement atteint** doit être le chemin déclaré de l'écran —
 *   un compte mono-société active sa seule habilitation à la connexion (D35)
 *   et ne rencontre jamais ce sélecteur ; une redirection vers un autre écran
 *   ne doit jamais se lire comme un succès parce que le témoin, seul, s'y
 *   retrouverait par accident ;
 * - **l'ABSENCE** du lien d'entrée (`arrivee.entrer.planning`, « Ouvrir le
 *   planning ») — il ne se rend QUE quand une société est active
 *   (`Entree` dans `page.tsx`) — et la présence d'AU MOINS DEUX boutons
 *   « Travailler sur cette société » (`arrivee.choix.activer`) : un bouton
 *   masqué par société ACTIVE (`arrivee.choix.active` le remplace), donc deux
 *   occurrences disent qu'aucune des sociétés du compte n'est active.
 *
 * Les deux textes viennent du dictionnaire (`lib/i18n`), jamais en dur : un
 * libellé qui change ne doit pas rendre ce contrôle aveugle en silence.
 */

/** Ce dont le verdict a besoin d'un écran — un sous-ensemble d'`Ecran`. */
export type EcranTemoin = {
  readonly nom: string;
  readonly chemin: string;
  readonly temoin: string;
};

export type VerdictTemoin =
  | { readonly verdict: "accepte" }
  | { readonly verdict: "refuse"; readonly motif: string };

/** Occurrences d'une sous-chaîne, insensible à la casse — jamais négatif. */
function compteOccurrences(corps: string, motif: string): number {
  if (motif === "") {
    return 0;
  }
  return corps.toLowerCase().split(motif.toLowerCase()).length - 1;
}

/**
 * Le verdict d'un écran, à partir de ce qu'une page a réellement rendu.
 *
 * Ne lit ni navigateur ni horloge ni dictionnaire au-delà de `t()` — un appel
 * pur, éprouvable sans Playwright.
 */
export function verdictDuTemoin(entree: {
  readonly corps: string;
  readonly cheminAtteint: string;
  readonly ecran: EcranTemoin;
}): VerdictTemoin {
  const { corps, cheminAtteint, ecran } = entree;

  if (!corps.toLowerCase().includes(ecran.temoin.toLowerCase())) {
    const vu = corps.replace(/\s+/g, " ").trim().slice(0, 120);
    return {
      verdict: "refuse",
      motif:
        `« ${ecran.nom} » ne porte pas son témoin « ${ecran.temoin} » : ce ` +
        "n'est pas l'écran attendu, et la capture est refusée. " +
        `Atteint : ${cheminAtteint} — vu : « ${vu} »`,
    };
  }

  if (ecran.nom === "arrivee" || ecran.nom === "arrivee-sans-societe") {
    if (cheminAtteint !== ecran.chemin) {
      return {
        verdict: "refuse",
        motif:
          `« ${ecran.nom} » devait atteindre ${ecran.chemin} et a atteint ` +
          `${cheminAtteint} : ce n'est pas l'écran attendu, et la capture ` +
          "est refusée.",
      };
    }
  }

  if (ecran.nom === "arrivee-sans-societe") {
    if (compteOccurrences(corps, t("arrivee.entrer.planning")) > 0) {
      return {
        verdict: "refuse",
        motif:
          `« ${ecran.nom} » porte le lien d'entrée du planning (« ` +
          `${t("arrivee.entrer.planning")} ») : ce lien ne se rend que quand ` +
          "une société est ACTIVE, et cet écran doit montrer un compte qui " +
          "n'en a encore choisi aucune. La capture est refusée.",
      };
    }
    const boutons = compteOccurrences(corps, t("arrivee.choix.activer"));
    if (boutons < 2) {
      return {
        verdict: "refuse",
        motif:
          `« ${ecran.nom} » ne porte que ${boutons} bouton(s) « ` +
          `${t("arrivee.choix.activer")} » : il en faut au moins deux, un par ` +
          "société du compte de démonstration, pour montrer l'arrivée d'un " +
          "compte habilité sur plusieurs sociétés sans qu'aucune ne soit " +
          "active. La capture est refusée.",
      };
    }
  }

  return { verdict: "accepte" };
}
