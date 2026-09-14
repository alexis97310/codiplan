import type { CleTraduction } from "@/lib/i18n/fr";

/**
 * LES PORTES DE LA SECTION « Sociétés & tarifs » (R3-05).
 *
 * **Elles vivent ici, et pas dans l'écran qui les rend**, pour deux raisons qui
 * ne se recouvrent pas. La première est celle de `lib/navigation/` tout entier :
 * une liste de destinations est une donnée, et un écran ne la tient pas. La
 * seconde est mesurée — le gardien des chaînes en dur (L0-11) lit un fichier
 * qui porte du JSX et prend ses littéraux pour du texte visible ; un tableau de
 * routes et de clés y serait rangé sous « chaîne visible écrite hors du
 * dictionnaire », ce qu'il n'est pas. *Le gardien a raison de ne pas savoir :
 * c'est la DESTINATION d'un texte qui décide, et il ne peut pas la lire.*
 *
 * Ce qu'elles NE portent pas : aucun décompte, aucune pastille, aucune lecture
 * de base. *Une porte dit où elle mène, pas ce qu'il y a derrière* — un « 3
 * forfaits » se lirait comme une mesure, et il faudrait alors décider ce qu'il
 * affiche quand la lecture échoue (le motif de D88).
 */
export type PorteParametrage = {
  readonly chemin: string;
  readonly titre: CleTraduction;
  readonly resume: CleTraduction;
  /**
   * `true` quand le libellé est un MOT IMPOSÉ — il se compose alors depuis
   * `mot(notion)`, jamais depuis le dictionnaire (D5, D47). « Site » en est un.
   */
  readonly vocabulaire?: "site";
};

export const PORTES_PARAMETRAGE: readonly PorteParametrage[] = [
  {
    chemin: "/parametres/agences",
    titre: "parametres.index_horaires_titre",
    resume: "parametres.index_horaires_resume",
  },
  {
    chemin: "/parametres/trajets",
    titre: "parametres.index_trajets_titre",
    resume: "parametres.index_trajets_resume",
  },
  {
    chemin: "/parametres/forfaits",
    titre: "parametres.index_forfaits_titre",
    resume: "parametres.index_forfaits_resume",
  },
  {
    // « Sites d'intervention » n'était PAS orphelin — on l'atteint depuis le
    // lieu d'une intervention, puis depuis la fiche du site. *Un chemin qui
    // existe dans le code n'est pas un chemin qu'un humain trouve*, et c'est la
    // limite que le gardien d'atteignabilité annonce lui-même.
    chemin: "/sites",
    // Le titre ne vient PAS du dictionnaire : il se compose depuis
    // `mot("site")`. La clé portée ici est celle du RESTE du libellé.
    titre: "parametres.index_sites_suffixe",
    resume: "parametres.index_sites_resume",
    vocabulaire: "site",
  },
  {
    // LA CINQUIÈME PORTE (14/09/2026). Elle n'est pas un doublon des colonnes
    // « Client » du parc et des sites, qui mènent à la FICHE : *on ne peut pas
    // créer un client depuis une machine qui n'existe pas encore*, et la liste
    // est le seul endroit d'où la création puisse partir.
    //
    // **La barre de navigation ne bouge pas** : elle est close à onze entrées,
    // confrontées à la maquette (D95), et une douzième la ferait rougir à
    // raison. Une porte de section n'est pas une entrée de barre.
    chemin: "/clients",
    titre: "parametres.index_clients_titre",
    resume: "parametres.index_clients_resume",
  },
  {
    // LA SIXIÈME PORTE (R3-15, 14/09/2026). Le catalogue des prestations
    // existait en base depuis L1-12 et n'avait AUCUN chemin : ni dépôt, ni
    // route, ni écran. *Une table qu'aucun humain n'atteint est une table dont
    // on ne peut pas dire si elle est juste.*
    //
    // **Elle ne porte aucun décompte**, comme les cinq autres : un « 12
    // prestations » se lirait comme une mesure, et il faudrait décider ce qu'il
    // affiche quand la lecture échoue (le motif de D88).
    chemin: "/parametres/prestations",
    titre: "parametres.index_prestations_titre",
    resume: "parametres.index_prestations_resume",
  },
];
