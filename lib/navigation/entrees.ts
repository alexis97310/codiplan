import type { CleTraduction } from "@/lib/i18n/fr";

/**
 * LA BARRE DE NAVIGATION — les entrées de la maquette (D95), moins un écart
 * nommé (D98).
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
 *
 * ## Et ce que cette barre N'EST PAS non plus : celle du portail
 *
 * Ces entrées sont celles d'un **back-office**, et c'est ce que la maquette
 * dessine. Un compte de portail en reçoit une autre — `ENTREES_PORTAIL`, D97 —,
 * *un client qui lirait « Facturation » ou « Techniciens » au-dessus de son
 * espace apprendrait l'existence d'un outil qui n'est pas le sien.*
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
 * LES ÉCARTS DÉLIBÉRÉS À LA MAQUETTE — liste close, une entrée, avec son motif.
 *
 * D95 fait de la maquette une source qui FAIT FOI sur la disposition, et
 * autorise l'écart à une condition : *« il s'écrit avec sa mesure et le point
 * précis où elle est muette — jamais "la maquette ne prévoyait pas ce cas" ».*
 * Cette liste est cet écrit, et le gardien la lit plutôt que d'assouplir sa
 * comparaison. *Assouplir aurait fait entrer sans décision tous les écarts
 * suivants ; nommer n'en fait entrer qu'un.*
 *
 * **Un écart se désigne par son LIBELLÉ tel que la maquette l'écrit**, et non
 * par une clé du dictionnaire : la clé disparaît avec l'entrée, le libellé
 * reste dans le document. C'est ce qui rend l'écart *adossé* — le gardien
 * vérifie que la maquette porte bien ce libellé, sans quoi l'entrée de cette
 * liste n'écarterait plus rien et personne ne le dirait (§9, 31/08).
 *
 * **Toute addition ici est un arbitrage**, jamais une décision de ticket : le
 * gardien exige cette liste exactement, à la manière de `CABLAGE_ATTENDU`.
 */
export const ECARTS_MAQUETTE: ReadonlyArray<{
  readonly libelle: string;
  readonly motif: string;
}> = [
  {
    libelle: "Fiche machine",
    // D98. La maquette la liste parce qu'elle est un CATALOGUE D'ÉCRANS, pas
    // un menu : elle montre ses onze écrans pour qu'on les voie tous. Une
    // fiche a besoin d'un IDENTIFIANT — elle ne peut donc pas être une section
    // de navigation, quel que soit le travail qu'on y mette. Les trois chemins
    // réels vers une fiche en portent un, et ils existent : le parc (R2-21),
    // le QR code (D22), l'intervention.
    motif:
      "D98 — une fiche a besoin d'un identifiant ; ce n'est pas une section",
  },
];

/**
 * Les entrées, dans l'ordre exact de la maquette **moins les écarts nommés**.
 * **Liste close** : `tests/unit/navigation/entrees.test.ts` la confronte à la
 * barre de `docs/maquette/CODIPLAN_Maquette.html`, et échoue si l'une des deux
 * bouge sans l'autre — libellé et ordre compris.
 */
export const ENTREES: readonly EntreeNavigation[] = [
  { cle: "nav.tableau_de_bord", chemin: null, ouvertePar: "lot 4" },
  { cle: "nav.planning", chemin: "/planning" },
  { cle: "nav.interventions", chemin: null, ouvertePar: "L2-08" },
  { cle: "nav.parc_machines", chemin: "/parc" },
  // ⟵ « Fiche machine » était ICI, entre le parc et les contrats. Elle est
  //    SORTIE (D98), et c'est le seul écart délibéré à la maquette : voir
  //    ECARTS_MAQUETTE ci-dessous, qui porte le motif et que le gardien lit.
  { cle: "nav.contrats", chemin: null, ouvertePar: "lot 4" },
  { cle: "nav.app_technicien", chemin: null, ouvertePar: "lot 3" },
  { cle: "nav.portail_client", chemin: "/portail" },
  // **ELLE ÉTAIT INERTE ET ELLE ATTENDAIT LE MAUVAIS TICKET** *(14/09/2026)*.
  // Elle nommait `L1-09`, qui porte les GABARITS — ce qu'on télécharge —,
  // jamais l'écran d'où l'on téléverse. *Une entrée inerte qui nomme un ticket
  // fantôme est inerte deux fois : elle n'ouvre rien, et elle envoie chercher
  // là où il n'y a rien.* L1-11 l'ouvre, et **la barre reste close à onze
  // entrées** : une entrée inerte devient un chemin, aucune ne s'ajoute.
  { cle: "nav.imports_excel", chemin: "/imports" },
  {
    // L'ENTRÉE MÈNE À LA SECTION, NON À L'UN DE SES ÉCRANS (R3-05). Elle
    // pointait sur `/parametres/agences`, si bien que les deux autres écrans de
    // réglage — les trajets et les forfaits — n'avaient AUCUNE porte : la barre
    // est une liste close de onze entrées, et il n'y en avait pas de douzième à
    // leur donner. La section existait déjà ici, il lui manquait sa page.
    cle: "nav.societes_tarifs",
    chemin: "/parametres",
    section: "/parametres",
  },
  { cle: "nav.console_editeur", chemin: null, ouvertePar: "lot 7" },
];

/**
 * LA BARRE DU PORTAIL CLIENT — une seconde liste, et non un sous-ensemble de la
 * première (D97).
 *
 * **Elle ne porte que ce qui EXISTE et ce qui APPARTIENT AU CLIENT.** *Un
 * client qui lit « Facturation » ou « Techniciens » au-dessus de son espace
 * apprend l'existence d'un outil qui n'est pas le sien* — c'est « une fuite par
 * déduction est une fuite » (§2 de la doctrine) appliquée non plus à un
 * compteur mais à un LIBELLÉ : une entrée de menu renseigne par son existence,
 * sans qu'aucune donnée soit derrière elle.
 *
 * **AUCUNE ENTRÉE INERTE ICI, et c'est la seule règle qui diffère de la barre
 * du back-office.** Une entrée inerte est admise dans une barre que la maquette
 * PRESCRIT — elle dit ce que le produit sera, et la maquette en fait foi. Elle
 * ne l'est pas dans une barre qu'on dessine soi-même : *inventer une entrée
 * inerte, ce serait promettre au client un outil qu'on n'a pas décidé de lui
 * donner.* Le gardien l'exige, dans les deux sens.
 *
 * **Une seule entrée aujourd'hui**, et c'est un état plutôt qu'un choix : le
 * portail n'a qu'un écran servi (L2-12). Ce qu'une barre d'une entrée apporte
 * quand même est le POINT DE RETOUR — sans elle, un client qui ouvre une fiche
 * n'a aucun chemin vers sa liste, et c'est le coût que l'issue « pas de barre
 * du tout » faisait payer.
 *
 * **Ce n'est pas un contrôle d'accès**, pas plus que l'autre : ce qui protège
 * le parc d'un client est la forme « parc » et la forme « rattachement », pas
 * l'absence d'un lien.
 */
export const ENTREES_PORTAIL: readonly EntreeNavigation[] = [
  { cle: "nav.portail_parc", chemin: "/portail" },
];

/**
 * LA BARRE DU TERRAIN — **vide, et c'est une décision** (R5-01).
 *
 * Un technicien n'a qu'un écran : sa journée. Lui donner les onze entrées du
 * back-office serait la faute que D97 a réparée pour le portail — *une entrée
 * de menu renseigne par sa seule existence*, et « Facturation » au-dessus d'un
 * téléphone de terrain promet un outil que ce compte n'ouvrira jamais. Lui
 * inventer des entrées à lui serait pire : *inventer une entrée inerte, c'est
 * promettre un outil qu'on n'a pas décidé de donner.*
 *
 * **Ce n'est pas « pas de barre ».** L'en-tête demeure — marque, charte de la
 * société, pastille d'identité — et la marque est le POINT DE RETOUR vers la
 * journée, exactement l'argument qui a donné sa barre au portail. Ce qui est
 * vide est la liste, pas le chrome.
 *
 * *Elle est nommée plutôt qu'écrite `[]` à l'appel : une liste vide anonyme se
 * lit comme un oubli, une liste vide nommée se lit comme une décision — et
 * celle-ci porte sa raison au-dessus d'elle.*
 */
export const ENTREES_TERRAIN: readonly EntreeNavigation[] = [];

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
 *
 * **La liste est un PARAMÈTRE depuis D97**, le portail ayant la sienne. Le
 * défaut reste celle du back-office : c'est l'appelant historique, et le rendre
 * obligatoire aurait touché des appels que ce ticket ne regarde pas. *Le
 * poseur, lui, ne devine rien* — la barre reçoit sa liste explicitement, et un
 * segment qui oublierait de la passer ne compile pas.
 */
export function entreeActive(
  chemin: string,
  entrees: readonly EntreeNavigation[] = ENTREES,
): EntreeNavigation | null {
  let meilleure: { entree: EntreeNavigation; longueur: number } | null = null;
  for (const entree of entrees) {
    if (entree.chemin === null) continue;
    const section = entree.section ?? entree.chemin;
    if (chemin !== section && !chemin.startsWith(`${section}/`)) continue;
    if (meilleure === null || section.length > meilleure.longueur) {
      meilleure = { entree, longueur: section.length };
    }
  }
  return meilleure?.entree ?? null;
}
