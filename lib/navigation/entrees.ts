import type { CleTraduction } from "@/lib/i18n/fr";

/**
 * LA BARRE DE NAVIGATION — les onze entrées de la maquette (D95).
 *
 * ## Pourquoi onze, et pas « celles qui existent »
 *
 * La maquette fait foi sur la disposition (D95), et sa barre porte onze
 * entrées. *Mesuré le 11/09/2026 : l'application en ligne n'en portait AUCUNE
 * — `grep -rln 'nav\b\|Navigation' app components` rendait zéro fichier, et on
 * ne circulait qu'en tapant une URL.* Livrer « les trois qui existent » aurait
 * donné une barre qui ne ressemble à rien de validé, et qui grandirait au
 * hasard des lots.
 *
 * **Une entrée dont l'écran n'existe pas est INERTE, jamais absente et jamais
 * un lien.** Absente, la barre mentirait par omission sur ce que le produit
 * sera ; en lien, elle mènerait à un 404 — *et un 404 dans une barre de
 * navigation se lit comme une panne, pas comme un lot à venir.* Elle est donc
 * rendue, visiblement éteinte, avec la mention que le dictionnaire porte.
 *
 * **Et le lot qui l'ouvrira est nommé ici.** C'est ce qui empêche cette liste
 * de devenir une liste de vœux : chaque entrée inerte dit quel travail la rend
 * vivante, et le jour où ce travail est livré, la seule chose à changer est le
 * `chemin` — le libellé, l'ordre et la place ne bougent pas.
 *
 * ## Ce que cette liste n'est PAS
 *
 * **Ce n'est pas un contrôle d'accès.** Un rôle qui n'a pas le droit d'un écran
 * ne doit pas être arrêté par une barre de navigation : il l'est par la
 * politique de cloisonnement et par le garde de la route. Masquer une entrée
 * serait une SECONDE lecture d'un même critère (§9, 01/09), et c'est celle qui
 * se trompe — elle vieillit sans rougir pendant que la vraie continue de
 * mordre. La barre dit ce que le produit contient ; elle ne dit jamais ce que
 * vous avez le droit d'ouvrir.
 *
 * *Conséquence assumée et écrite : `portail` figure dans la barre parce que la
 * maquette l'y met, alors qu'un compte interne ne peut pas l'ouvrir — un compte
 * portail n'a aucune ligne dans `utilisateur_societe` (D10), et la route le
 * refuse. Le jour où la barre sera servie par rôle, ce sera une décision, pas
 * un effet de bord.*
 */

export type EntreeNavigation = {
  /** La clé du libellé. Aucun texte lisible n'est écrit ici (CLAUDE.md §5). */
  readonly cle: CleTraduction;
  /**
   * La route, ou `null` quand l'écran n'existe pas encore. `null` est ce qui
   * rend l'entrée inerte — il n'y a pas de second drapeau à tenir d'accord.
   */
  readonly chemin: string | null;
  /**
   * LA SECTION qu'une entrée allume, quand elle ne coïncide pas avec sa
   * destination.
   *
   * *Mesuré en écrivant le gardien :* « Sociétés & tarifs » pointe sur
   * `/parametres/agences` — il faut bien que le lien mène quelque part — mais
   * la section est `/parametres`, et `/parametres/forfaits` doit l'allumer
   * aussi. Confondre les deux éteignait la barre sur l'un des deux écrans de
   * réglage, c'est-à-dire au moment précis où l'on navigue entre eux.
   *
   * Absente, c'est `chemin` qui fait section — le cas général.
   */
  readonly section?: string;
  /**
   * Le ticket ou le lot qui ouvrira cette entrée. Renseigné pour les seules
   * entrées inertes ; c'est une chaîne LUE PAR UN HUMAIN dans le code, jamais
   * rendue à l'écran — elle ne passe donc pas par le dictionnaire.
   */
  readonly ouvertePar?: string;
};

/**
 * Les onze entrées, dans l'ordre exact de la maquette. **Liste close** :
 * `tests/unit/navigation/entrees.test.ts` la confronte à la barre de
 * `docs/maquette/CODIPLAN_Maquette.html`, et échoue si l'une des deux bouge sans
 * l'autre — libellé et ordre compris.
 */
export const ENTREES: readonly EntreeNavigation[] = [
  { cle: "nav.tableau_de_bord", chemin: null, ouvertePar: "lot 4" },
  { cle: "nav.planning", chemin: "/planning" },
  { cle: "nav.interventions", chemin: null, ouvertePar: "L2-08" },
  { cle: "nav.parc_machines", chemin: "/parc" },
  { cle: "nav.fiche_machine", chemin: null, ouvertePar: "L2-01 (écran)" },
  { cle: "nav.contrats", chemin: null, ouvertePar: "lot 4" },
  { cle: "nav.app_technicien", chemin: null, ouvertePar: "lot 3" },
  { cle: "nav.portail_client", chemin: "/portail" },
  { cle: "nav.imports_excel", chemin: null, ouvertePar: "L1-09" },
  {
    cle: "nav.societes_tarifs",
    chemin: "/parametres/agences",
    section: "/parametres",
  },
  { cle: "nav.console_editeur", chemin: null, ouvertePar: "lot 7" },
];

/**
 * L'entrée active pour un chemin donné.
 *
 * La comparaison est un PRÉFIXE, et c'est délibéré : `/parametres/forfaits`
 * doit allumer « Sociétés & tarifs » comme `/parametres/agences`, et
 * `/planning/nouvelle` doit allumer « Planning ». Une égalité stricte
 * éteindrait la barre dès qu'on entre dans un sous-écran, ce qui est le moment
 * où l'on a le plus besoin de savoir où l'on est.
 *
 * Le préfixe est borné au segment : `/planning` n'allume pas `/planningX`.
 */
export function entreeActive(chemin: string): EntreeNavigation | null {
  let meilleure: { entree: EntreeNavigation; longueur: number } | null = null;
  for (const entree of ENTREES) {
    if (entree.chemin === null) continue;
    const section = entree.section ?? entree.chemin;
    if (chemin !== section && !chemin.startsWith(`${section}/`)) continue;
    if (meilleure === null || section.length > meilleure.longueur) {
      meilleure = { entree, longueur: section.length };
    }
  }
  return meilleure?.entree ?? null;
}
