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
 *
 * ## Depuis D118 : DIX destinations, sur DEUX NIVEAUX
 *
 * Ce que ce fichier appelait « onze », puis « dix » après D98, reste le compte
 * des ÉCRANS que la maquette fait foi — ce sur quoi D95 fait toujours foi.
 * Onze entrées à plat ne se lisaient plus au même rang, et D118 amende D95 sur
 * ce point précis : la FORME du menu — ses niveaux, ses regroupements — cesse
 * d'être imposée par la maquette. Voir `GroupeNavigation` ci-dessous pour ce
 * que cet amendement autorise, et ce qu'il continue de refuser.
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
 * UN GROUPE DE PREMIER NIVEAU (D118, 16/09/2026) — un titre, et sous lui des
 * ENTRÉES SIMPLES, jamais un second niveau de groupe.
 *
 * D118 amende D95 : la maquette ne fait plus foi sur la FORME du menu — le
 * nombre d'entrées de premier niveau, les niveaux, les libellés de
 * regroupement — seulement sur ses ÉCRANS. `docs/propositions/navigation.html`
 * montre deux structures possibles et note que la structure exacte
 * « reste à arrêter devant une image » : ni l'une ni l'autre n'a été validée
 * depuis. Ce fichier n'en rejoue donc aucune telle quelle ; il applique le
 * même principe — regrouper ce qui se ressemble — à la seule matière qui est
 * dans SON périmètre : les dix entrées déjà dans la barre. Ni `/clients`, ni
 * `/sites`, ni `/vgp`, ni `/absences` n'y entrent : ce sont des écrans vivants
 * sans porte aujourd'hui, et leur donner une porte est exactement la question
 * que D118 pose sans la trancher — l'ouvrir ici serait la trancher en douce, à
 * côté d'un autre agent qui travaille ces écrans au même moment.
 *
 * **UN TITRE DE GROUPE N'EST JAMAIS UNE DESTINATION** (repris tel quel du
 * document ci-dessus) : cliquer dessus ouvre le sous-menu, il ne navigue
 * nulle part — sinon l'appui est ambigu. Ce que cela coûte pour une entrée
 * comme « Sociétés & tarifs », qui EST une destination : elle réapparaît comme
 * l'un de ses propres enfants, exactement comme le document le fait pour
 * « Planning ».
 *
 * **ET C'EST CE QUI INTERDIT D'INVENTER UN LIBELLÉ.** Le document propose
 * « Paramètres » comme titre du second groupe et le signale lui-même comme
 * NON TRANCHÉ — « aucune clé de dictionnaire ne porte ce libellé ». Un titre
 * de groupe ici doit donc être le libellé d'un de ses propres enfants : le
 * gardien (`tests/unit/navigation/entrees.test.ts`) l'exige, ce qui rend
 * impossible d'introduire silencieusement un libellé que personne n'a encore
 * arrêté.
 */
export type GroupeNavigation = {
  /** Le titre du groupe — le libellé d'UN DE SES ENFANTS, jamais un mot neuf. */
  readonly cle: CleTraduction;
  /** Les entrées du sous-menu, dans l'ordre où elles s'y affichent. */
  readonly enfants: readonly EntreeNavigation[];
};

/** Une entrée de premier niveau : simple, ou un groupe qui en ouvre d'autres. */
export type EntreeDeBarre = EntreeNavigation | GroupeNavigation;

/** `entree` ouvre-t-elle un sous-menu ? Le seul endroit qui lit `enfants`. */
export function estGroupe(entree: EntreeDeBarre): entree is GroupeNavigation {
  return "enfants" in entree;
}

/**
 * TOUTES LES DESTINATIONS D'UNE BARRE, à PLAT — un groupe ouvert plutôt que
 * représenté.
 *
 * C'est la lecture que `entreeActive` et les gardiens partagent : la barre du
 * portail et celle du terrain n'ont pas de groupe, et y appliquer cette
 * fonction ne change rien pour elles (aucune entrée n'a `enfants`, chacune se
 * rend donc elle-même).
 */
export function feuilles(
  entrees: readonly EntreeDeBarre[],
): readonly EntreeNavigation[] {
  return entrees.flatMap((entree) =>
    estGroupe(entree) ? entree.enfants : [entree],
  );
}

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
 * LES ENTRÉES, REGROUPÉES SUR DEUX NIVEAUX (D118, 16/09/2026) — même dix
 * destinations qu'avant l'amendement, réorganisées, aucune ajoutée.
 *
 * *Motif de l'exploitation : onze entrées plates ne se lisent plus au même
 * rang. D118 le mesure autrement — cinq entrées sur dix ne mènent nulle
 * part — mais le symptôme est le même : un inventaire n'est pas un menu.*
 *
 * **Six entrées de premier niveau.** Quatre restent des destinations directes
 * — « Tableau de bord », « Parc machines », « Contrats », « Portail client » —
 * parce qu'aucune des six autres ne leur ressemble assez pour former un
 * groupe honnête. Les deux qui restent sont des groupes :
 *
 * - **Planning** rassemble ce qui organise le travail du jour : le planning
 *   lui-même et les interventions qui le remplissent.
 * - **Sociétés & tarifs** rassemble la configuration et ce qui n'a pas
 *   d'autre maison : les imports Excel qui alimentent les référentiels, et
 *   les deux entrées encore inertes — « App technicien », « Console éditeur »
 *   — pour qui n'importe quel groupe est un rangement provisoire tant
 *   qu'aucun écran ne leur donne un sens propre.
 *
 * **Liste close** : `tests/unit/navigation/entrees.test.ts` confronte les DIX
 * DESTINATIONS, une fois les groupes ouverts (`feuilles`), à la barre de
 * `docs/maquette/CODIPLAN_Maquette.html` — la maquette fait foi sur cet
 * ensemble (D95), plus depuis D118 sur l'ordre ou le regroupement (voir
 * `GroupeNavigation` ci-dessus).
 */
export const ENTREES: readonly EntreeDeBarre[] = [
  { cle: "nav.tableau_de_bord", chemin: null, ouvertePar: "lot 4" },
  {
    cle: "nav.planning",
    enfants: [
      { cle: "nav.planning", chemin: "/planning" },
      { cle: "nav.interventions", chemin: "/interventions" },
    ],
  },
  { cle: "nav.parc_machines", chemin: "/parc" },
  // ⟵ « Fiche machine » était ICI, entre le parc et les contrats. Elle est
  //    SORTIE (D98), et c'est le seul écart délibéré à la maquette : voir
  //    ECARTS_MAQUETTE ci-dessous, qui porte le motif et que le gardien lit.
  { cle: "nav.contrats", chemin: null, ouvertePar: "lot 4" },
  { cle: "nav.portail_client", chemin: "/portail" },
  {
    cle: "nav.societes_tarifs",
    enfants: [
      {
        // L'ENTRÉE MÈNE À LA SECTION, NON À L'UN DE SES ÉCRANS (R3-05). Elle
        // pointait sur `/parametres/agences`, si bien que les deux autres
        // écrans de réglage — les trajets et les forfaits — n'avaient AUCUNE
        // porte. La section existait déjà ici, il lui manquait sa page.
        cle: "nav.societes_tarifs",
        chemin: "/parametres",
        section: "/parametres",
      },
      // **ELLE ÉTAIT INERTE ET ELLE ATTENDAIT LE MAUVAIS TICKET** *(14/09/2026)*.
      // Elle nommait `L1-09`, qui porte les GABARITS — ce qu'on télécharge —,
      // jamais l'écran d'où l'on téléverse. L1-11 l'ouvre.
      { cle: "nav.imports_excel", chemin: "/imports" },
      { cle: "nav.app_technicien", chemin: null, ouvertePar: "lot 3" },
      { cle: "nav.console_editeur", chemin: null, ouvertePar: "lot 7" },
    ],
  },
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
 * `/interventions/nouvelle` doit allumer « Interventions ». Une égalité
 * stricte éteindrait la barre dès qu'on entre dans un sous-écran, ce qui est
 * le moment où l'on a le plus besoin de savoir où l'on est.
 *
 * Le préfixe est borné au segment : `/planning` n'allume pas `/planningX`.
 *
 * **La liste est un PARAMÈTRE depuis D97**, le portail ayant la sienne. Le
 * défaut reste celle du back-office : c'est l'appelant historique, et le rendre
 * obligatoire aurait touché des appels que ce ticket ne regarde pas. *Le
 * poseur, lui, ne devine rien* — la barre reçoit sa liste explicitement, et un
 * segment qui oublierait de la passer ne compile pas.
 *
 * **Depuis D118, `entrees` peut porter des groupes** : la recherche se fait
 * sur `feuilles(entrees)`, jamais sur la liste brute — un groupe n'a pas de
 * `chemin` propre, seuls ses enfants en ont un. Pour une barre sans groupe
 * (le portail, le terrain), `feuilles` rend la liste inchangée : le
 * comportement d'avant D118 est un cas particulier de celui-ci.
 */
export function entreeActive(
  chemin: string,
  entrees: readonly EntreeDeBarre[] = ENTREES,
): EntreeNavigation | null {
  let meilleure: { entree: EntreeNavigation; longueur: number } | null = null;
  for (const entree of feuilles(entrees)) {
    if (entree.chemin === null) continue;
    const section = entree.section ?? entree.chemin;
    if (chemin !== section && !chemin.startsWith(`${section}/`)) continue;
    if (meilleure === null || section.length > meilleure.longueur) {
      meilleure = { entree, longueur: section.length };
    }
  }
  return meilleure?.entree ?? null;
}
