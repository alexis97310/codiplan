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
 * ## Depuis D121 : QUATORZE destinations, sur TROIS DOMAINES FIXES
 *
 * D118 amendait D95 sur la FORME du menu — ses niveaux, ses regroupements —
 * en attendant qu'une maquette redessinée avec un menu redevienne la source.
 * C'est fait : `docs/maquette/codiplan-maquette-complete.html` dessine une
 * colonne verticale, sectionnée en trois titres — Exploitation, Clients &
 * parc, Paramètres —, et l'amendement de D118 **tombe de lui-même**, par
 * l'opération de sa propre clause (D121, « LE CONSTAT »). Ce fichier lit donc
 * de nouveau une maquette pour la LISTE et l'ORDRE de ses destinations — ce
 * n'est plus `docs/maquette/CODIPLAN_Maquette.html`, dont la barre plate à
 * onze boutons est un catalogue d'écrans (D98, D118), mais le second fichier,
 * qui garde seul l'autorité sur ce point précis (D95 reste la source des
 * couleurs et de la disposition des écrans, inchangée).
 *
 * **Les trois titres sont du TEXTE, jamais un contrôle.** Rien ne les
 * sélectionne, rien ne les déplie : les quatorze destinations sont TOUTES
 * visibles en permanence, dans une seule colonne (D121, « et ce que le
 * constat mesure aussi »). Voir `GroupeNavigation` ci-dessous pour ce que
 * cela change à la règle qui interdisait un mot neuf pour un titre.
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
 * UN DOMAINE DE LA BARRE LATÉRALE (D118, révisé par D121 le 17/09/2026) — un
 * titre de section, et sous lui des ENTRÉES SIMPLES, toutes visibles en
 * permanence.
 *
 * ## CE QUI CHANGE DE FORME, ET CE QUI NE CHANGE PAS
 *
 * D118 posait un groupe comme un sous-menu qui s'ouvre au clic sur son titre
 * — un `<details>`, un `<summary>`. **Ce n'est plus la forme retenue** : D121
 * mesure que la maquette redessinée ne commute rien — les trois titres sont
 * DU TEXTE, les quatorze destinations sont TOUTES visibles d'un coup, dans
 * une seule colonne. Le TYPE ne change pas — un titre, des enfants, dans
 * l'ordre où ils s'affichent —, seul le RENDU change
 * (`components/navigation/barre.tsx`) : plus de `<details>`, plus d'état à
 * ouvrir ou fermer, donc plus de règle sur le domaine à une seule destination
 * (D121, « LA RÈGLE DU DOMAINE À UNE SEULE DESTINATION »).
 *
 * ## LA RÈGLE DU LIBELLÉ NEUF, TRANCHÉE ICI (N-07, à la demande explicite de
 * D121 : « le futur ticket devra aussi trancher »)
 *
 * D118 interdisait qu'un titre de groupe soit un mot neuf, POUR UNE RAISON
 * PRÉCISE : le titre était un `<summary>` cliquable, au même rang visuel
 * qu'un lien, et un mot que personne n'avait arrêté aurait pu se lire comme
 * une destination qu'on invente en douce. C'est cette même raison qui faisait
 * réapparaître « Sociétés & tarifs » comme l'un de ses propres enfants : le
 * titre DEVAIT être un libellé déjà décidé ailleurs.
 *
 * **Cette raison n'existe plus.** Un titre de domaine n'est plus un contrôle :
 * il ne se clique pas, il n'ouvre rien, il ne navigue nulle part — c'est un
 * `<div>` de texte au-dessus d'une liste, exactement ce que
 * `docs/maquette/codiplan-maquette-complete.html` dessine (`.nav-group`, une
 * simple étiquette). Rien ne peut plus le confondre avec une destination
 * inventée, puisqu'il n'est jamais un lien. La garde qui comptait — empêcher
 * qu'un mot NON ARRÊTÉ entre silencieusement dans la barre — est donc
 * remplacée par une garde plus directe : le titre doit être l'un des TROIS
 * noms de domaine que D121 a mesurés sur cette maquette, ni plus ni moins, et
 * le gardien (`tests/unit/navigation/entrees.test.ts`) confronte les titres du
 * code aux trois `<div class="nav-group">` du document, dans les deux sens —
 * un titre de plus, ou un titre différent, le fait rougir. « Exploitation » et
 * « Clients & parc » peuvent donc entrer au dictionnaire : ce ne sont plus des
 * mots inventés par ce fichier, ce sont des mots MESURÉS sur une source de
 * rang 1 (D121), au même titre que les libellés d'écran qu'elle porte.
 */
export type GroupeNavigation = {
  /**
   * Le titre du domaine — un `<div>` de texte, jamais un contrôle. Depuis
   * N-07, ce n'est plus nécessairement le libellé d'un enfant : c'est l'un
   * des trois noms de domaine mesurés sur
   * `docs/maquette/codiplan-maquette-complete.html` (voir le commentaire du
   * type ci-dessus pour le motif du changement).
   */
  readonly cle: CleTraduction;
  /** Les entrées du domaine, dans l'ordre où elles s'affichent. */
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
 * LES ÉCARTS DÉLIBÉRÉS À LA MAQUETTE — liste close, VIDE depuis D121.
 *
 * D95 fait de la maquette une source qui FAIT FOI sur la disposition, et
 * autorise l'écart à une condition : *« il s'écrit avec sa mesure et le point
 * précis où elle est muette — jamais "la maquette ne prévoyait pas ce cas" ».*
 * Cette liste est cet écrit, et le gardien la lit plutôt que d'assouplir sa
 * comparaison.
 *
 * **La seule entrée qu'elle a jamais portée, « Fiche machine » (D98), ne
 * s'adosse plus à rien.** Elle écartait un bouton que
 * `docs/maquette/CODIPLAN_Maquette.html` — un catalogue d'écrans, pas un menu
 * — listait à tort. Depuis D121, `entrees.test.ts` confronte la barre à
 * `docs/maquette/codiplan-maquette-complete.html` pour sa LISTE et son
 * ORDRE, et ce second document ne dessine PAS « Fiche machine » dans sa
 * colonne : mesuré destination par destination (D121, « CE QUE LES QUATRE
 * ÉCARTS DEVIENNENT »), les quatorze destinations de la maquette sont, sans
 * exception, celles que la barre porte. **Zéro écart, pas un écart reformulé**
 * — garder l'ancienne ligne aurait fait échouer le gardien qui vérifie
 * qu'un écart est ADOSSÉ à un libellé que la maquette confrontée porte
 * réellement (§9, 31/08) : le jour où il faut retirer une ligne, c'est ce
 * scénario qui le dit, et c'est lui qui vient de le dire.
 *
 * Le mécanisme reste écrit, prêt pour le jour où une vraie divergence se
 * présentera : **toute addition ici est un arbitrage**, jamais une décision
 * de ticket, et le gardien exige cette liste exactement.
 */
export const ECARTS_MAQUETTE: ReadonlyArray<{
  readonly libelle: string;
  readonly motif: string;
}> = [];

/**
 * LES QUATORZE DESTINATIONS, SUR TROIS DOMAINES FIXES (D121, 17/09/2026).
 *
 * *Motif de la forme : `docs/maquette/codiplan-maquette-complete.html` est la
 * maquette redessinée avec un menu que D118 attendait pour rendre la main à
 * la maquette (« le jour où la maquette est redessinée avec un menu, elle
 * redevient la source de la forme »). Elle dessine trois domaines, chacun
 * suivi de ses destinations, TOUTES visibles — jamais un sous-menu.*
 *
 * **Trois domaines, aucune destination hors d'un domaine.** Contrairement à
 * la forme D118 (quatre destinations restaient au premier niveau faute de
 * ressembler à un groupe), la maquette range les quatorze sous l'un des
 * trois titres — y compris « Tableau de bord » et « Parc machines », qui
 * n'avaient pas de groupe avant :
 *
 * - **Exploitation** : Tableau de bord, Planning, Interventions, Absences.
 * - **Clients & parc** : Clients, Sites, Parc machines, VGP, Portail client.
 * - **Paramètres** : Sociétés & tarifs, Imports Excel, App technicien (depuis
 *   le chantier NAV-1, 20/09/2026 : `/terrain`), et les deux entrées encore
 *   inertes — Contrats, Console éditeur.
 *
 * **Quatre destinations nouvelles** — Clients, Sites, VGP, Absences —
 * n'avaient encore aucune porte dans la barre : ce sont des écrans déjà
 * vivants (voir la table mesurée de D121, « CE QUE LES QUATRE ÉCARTS
 * DEVIENNENT »), atteints jusqu'ici par rebond ou pas du tout.
 *
 * **Liste close** : `tests/unit/navigation/entrees.test.ts` confronte les
 * QUATORZE destinations, une fois les groupes ouverts (`feuilles`), et les
 * TROIS titres de domaine, à `docs/maquette/codiplan-maquette-complete.html`
 * — la LISTE et l'ORDRE, lettre pour lettre (D121).
 */
export const ENTREES: readonly EntreeDeBarre[] = [
  {
    cle: "nav.groupe_exploitation",
    enfants: [
      { cle: "nav.tableau_de_bord", chemin: "/tableau-de-bord" },
      { cle: "nav.planning", chemin: "/planning" },
      { cle: "nav.interventions", chemin: "/interventions" },
      { cle: "nav.absences", chemin: "/absences" },
    ],
  },
  {
    cle: "nav.groupe_clients_parc",
    enfants: [
      { cle: "nav.clients", chemin: "/clients" },
      // « Sites » réutilise la clé du vocabulaire imposé (D5, D47) plutôt que
      // d'écrire le mot une seconde fois — voir le commentaire de
      // `lib/i18n/fr.ts` à l'endroit où « nav.sites » n'existe pas.
      { cle: "vocabulaire.site.pluriel", chemin: "/sites" },
      { cle: "nav.parc_machines", chemin: "/parc" },
      // ⟵ « Fiche machine » n'entre PAS ici : voir ECARTS_MAQUETTE, vide
      //    depuis D121 — la maquette confrontée ne la dessine plus du tout.
      { cle: "nav.vgp", chemin: "/vgp" },
      { cle: "nav.portail_client", chemin: "/portail" },
    ],
  },
  {
    cle: "nav.groupe_parametres",
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
      { cle: "nav.contrats", chemin: null, ouvertePar: "lot 4" },
      // ELLE MENTAIT (chantier NAV-1, 20/09/2026) : `app/(mobile)/terrain`
      // EXISTE et fonctionne en ligne — `tests/e2e/terrain.spec.ts` le prouve
      // — mais aucune entrée de la barre n'y menait, alors qu'elle promettait
      // « lot 3 » depuis une entrée INERTE. Elle pointe désormais sur le
      // module réel, sans logique conditionnelle par rôle ICI (voir l'entête
      // du fichier : « ce n'est pas un contrôle d'accès ») — `/terrain`
      // redirige déjà, LUI-MÊME, un rôle à accès complet vers `/planning` et
      // un rôle sans accès vers `/arrivee` (`perimetreDuPlanning`), et cette
      // route n'est pas réécrite ici.
      { cle: "nav.app_technicien", chemin: "/terrain" },
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

/**
 * LE DOMAINE D'UN CHEMIN — le titre du GROUPE qui le porte (N-08).
 *
 * *Un écran écrit `<Page domaine={groupeDe("/clients")} …>` plutôt que
 * `domaine="nav.groupe_clients_parc"` en dur* : la maquette
 * (`docs/maquette/codiplan-maquette-complete.html`) pose un `eyebrow` — le nom
 * du domaine — au-dessus de chaque titre d'écran (`head(domain, …)`), et
 * `lib/navigation/entrees.ts` sait déjà, par `ENTREES`, quel domaine porte
 * quel chemin. **Deux lectures d'un même critère divergent en silence**
 * (§9, 01/09) : un second endroit qui recopierait à la main l'appartenance
 * d'un écran à un groupe finirait par diverger le jour où la barre change de
 * forme — exactement l'histoire de D118 puis D121.
 *
 * **Réutilise `entreeActive`**, sur les seuls enfants d'un groupe : c'est la
 * même règle de préfixe borné au segment (`/parametres/forfaits` allume
 * « Sociétés & tarifs » comme `/parametres/agences`), jamais une seconde
 * écriture du critère de correspondance.
 *
 * **Rend `null` pour un chemin sans groupe** — `/arrivee`, ou toute entrée
 * d'une barre plate comme `ENTREES_PORTAIL` et `ENTREES_TERRAIN`, qui n'ont
 * aucun `GroupeNavigation`. C'est un état légitime, jamais une erreur : un
 * écran sans domaine n'affiche simplement pas de surtitre — la maquette
 * elle-même ne dessine cet `eyebrow` que pour des écrans qui appartiennent à
 * l'un des trois domaines de la barre latérale.
 */
export function groupeDe(
  chemin: string,
  entrees: readonly EntreeDeBarre[] = ENTREES,
): CleTraduction | null {
  for (const entree of entrees) {
    if (!estGroupe(entree)) continue;
    if (entreeActive(chemin, entree.enfants) !== null) {
      return entree.cle;
    }
  }
  return null;
}
