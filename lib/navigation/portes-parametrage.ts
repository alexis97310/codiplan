import { peut, type Capacite } from "@/lib/auth/habilitations";
import type { Role } from "@/lib/auth/roles";
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
  /**
   * LA OU LES CAPACITÉS QUI OUVRENT L'ÉCRAN (D153, TP-S3) — jamais un rôle
   * nommé en dur, la même matrice que la route. `undefined` laisse la porte
   * visible à quiconque n'est pas technicien (le cas de `/parametres/
   * societe`, qui ne porte aucun formulaire). Un tableau se lit en OU — le
   * taux horaire et les forfaits s'ouvrent à qui les paramètre OU à qui en a
   * besoin pour chiffrer (QT-2, D152). La porte teste toujours `peut()`, pas
   * `peutPleinement` : elle n'offre ici qu'un lien, jamais l'écriture
   * elle-même — c'est l'écran visé qui distingue ensuite les deux pour ses
   * propres formulaires.
   */
  readonly capacite?: Capacite | readonly Capacite[];
};

export const PORTES_PARAMETRAGE: readonly PorteParametrage[] = [
  {
    // LA HUITIÈME PORTE (N-02, 16/09/2026), et la première de la liste :
    // elle parle de la société elle-même, quand les autres parlent de ce
    // qu'elle règle. Elle n'existait nulle part — la pastille qui portait
    // cette information vivait en permanence dans la barre de navigation,
    // pour répondre à une question qu'on ne pose qu'à la mise en service.
    // Voir `app/(back-office)/parametres/societe/page.tsx`.
    //
    // Aucune `capacite` : l'écran ne porte aucun formulaire (D153).
    chemin: "/parametres/societe",
    titre: "parametres.index_societe_titre",
    resume: "parametres.index_societe_resume",
  },
  {
    chemin: "/parametres/agences",
    titre: "parametres.index_horaires_titre",
    resume: "parametres.index_horaires_resume",
    // D153 (03/10/2026, TP-S3) — aucune `capacite` : la LECTURE reste ouverte
    // à tout rôle non technicien, comme avant (QT-2, D152, choix 6). Seule
    // l'ÉCRITURE (agences, plages, pas-créneau) suit `administrer_agences`,
    // jugée par l'écran lui-même, jamais par cette porte.
  },
  {
    chemin: "/parametres/trajets",
    titre: "parametres.index_trajets_titre",
    resume: "parametres.index_trajets_resume",
    // D153 (03/10/2026, TP-S3, PA-25) — ADMS et ADV au ●, DIR au ○.
    capacite: "regler_trajets",
  },
  {
    chemin: "/parametres/forfaits",
    titre: "parametres.index_forfaits_titre",
    resume: "parametres.index_forfaits_resume",
    // D153 — même lecture que l'écran (QT-2, D152) : qui le paramètre, ou
    // qui en a besoin pour chiffrer.
    capacite: ["parametrer_societe", "voir_montants_vente"],
  },
  {
    // LA DIXIÈME PORTE (TAUX-1, 22/09/2026). `taux_horaire` n'avait qu'un
    // seul chemin d'écriture — le geste de mise en service, atteint par un
    // flux GitHub — et aucun écran. *Un tarif qui évolue et qu'on ne peut
    // pas changer n'est pas un réglage manquant : c'est une impasse.*
    //
    // **Elle ne porte aucun décompte**, comme les autres portes de cette
    // liste.
    chemin: "/parametres/taux-horaire",
    titre: "parametres.index_taux_horaire_titre",
    resume: "parametres.index_taux_horaire_resume",
    // D153 — même lecture que l'écran (QT-2, D152).
    capacite: ["parametrer_societe", "voir_montants_vente"],
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
    // D153 (03/10/2026, TP-S3, CS6) — lecture, pas l'écriture de D130.
    capacite: "consulter_clients_sites",
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
    // D153 (03/10/2026, TP-S3, CS6) — lecture, pas l'écriture de D130.
    capacite: "consulter_clients_sites",
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
    // D153 — ouvert comme l'écran : « pas technicien » seul, aucune capacité
    // ne restreint davantage LA LECTURE (seule l'écriture suit `peutPleinement`
    // sur `parametrer_societe`, à l'intérieur de l'écran lui-même).
  },
  {
    // LA SEPTIÈME PORTE (L1-05b, 15/09/2026). Les deux tables du référentiel
    // matériel existaient depuis L1-05 et n'avaient AUCUN chemin d'écriture :
    // `ls lib/materiel/` rendait `saisie.ts`, et rien d'autre.
    //
    // **Et c'est un ENCHAÎNEMENT, pas un manque isolé** : une machine exige un
    // modèle (D6), un modèle exige une famille, et aucun des deux ne pouvait
    // naître. *Le parc ne se remplissait que par le semis.* L'import ne le
    // sauvait pas non plus — une seule fonction d'application existe dans tout
    // le dépôt, et c'est celle des clients (R6-01, R6-03).
    //
    // **Elle ne porte aucun décompte**, comme les six autres.
    chemin: "/parametres/materiel",
    titre: "parametres.index_materiel_titre",
    resume: "parametres.index_materiel_resume",
    // D153 — même lecture ouverte que `/parametres/prestations`, voir
    // ci-dessus : aucune `capacite`, l'écran lui-même gère son écriture.
  },
  {
    // LA HUITIÈME PORTE DE CETTE LISTE (ÉQUIPE-1, 19/09/2026). La table
    // `technicien` existait depuis L3-01a et n'avait AUCUN chemin d'écriture
    // — mesuré sur 4fead41, les seules lignes qu'elle portait venaient du
    // seed. *Un technicien qui ne peut ni être ajouté ni partir n'est pas un
    // technicien administrable, c'est une donnée figée.*
    //
    // **Elle ne porte aucun décompte**, comme les autres portes de cette liste.
    chemin: "/parametres/equipe",
    titre: "parametres.index_equipe_titre",
    resume: "parametres.index_equipe_resume",
    // D153 (03/10/2026, TP-S3) — aucun ○ : seul admin_societe ouvre l'écran.
    capacite: "administrer_utilisateurs",
  },
  {
    // LA NEUVIÈME PORTE DE CETTE LISTE (ÉQUIPE-2, 20/09/2026). Même faute que
    // les prestations et le matériel : `lib/habilitations/affectation.ts`
    // applique RG-PLA-04 depuis L1-04, et `lib/interventions/depot.ts`
    // l'appelle réellement — mais rien ne pouvait écrire ni le référentiel, ni
    // une attribution, ni une exigence. *Le verrou mordait sur des données
    // qu'on ne pouvait alimenter qu'à la main, en base.*
    //
    // **Elle ne porte aucun décompte**, comme les autres portes de cette liste.
    chemin: "/parametres/habilitations",
    titre: "parametres.index_habilitations_titre",
    resume: "parametres.index_habilitations_resume",
    // D153 (03/10/2026, TP-S3) — même garde que `/parametres/equipe`.
    capacite: "administrer_utilisateurs",
  },
];

/**
 * LA PORTE S'OUVRE-T-ELLE POUR CE RÔLE ? (D153, TP-S3)
 *
 * `undefined` laisse passer (le cas de `/parametres/societe`, `/parametres/
 * materiel` et `/parametres/prestations`, dont la LECTURE est ouverte à tout
 * rôle non technicien ; l'ÉCRITURE, elle, est jugée par l'écran lui-même).
 * Un tableau de capacités se lit en OU — `peut`, jamais `peutPleinement` :
 * cette page ne pose qu'un LIEN, jamais un formulaire.
 */
export function porteOuverte(role: Role, porte: PorteParametrage): boolean {
  if (porte.capacite === undefined) {
    return true;
  }
  const capacites = Array.isArray(porte.capacite)
    ? porte.capacite
    : [porte.capacite];
  return capacites.some((capacite) => peut(role, capacite));
}
