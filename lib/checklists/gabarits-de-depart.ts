import type { TypeIntervention } from "@/lib/interventions/saisie";
import type { SaisiePointChecklist } from "@/lib/checklists/depot";

/**
 * LES GABARITS DE DÉPART (9K20-CHECKLIST-DUPLIQUER-DEPART, étendus au ticket
 * 9K30A-CHECKLIST-GABARITS-VALIDES) — une liste EN CODE, jamais en base,
 * jamais posée par une migration : un point de départ pour un nouveau
 * modèle, pas une donnée de société.
 *
 * **VINGT-QUATRE GABARITS VALIDÉS PAR ALEXIS** (atelier des 10/11 et
 * 11/11/2026) — treize d'entretien préventif (G00 à G13, G01 déjà repris tel
 * quel depuis 9K20) et douze d'installation / fin de travaux (I00 à I11),
 * recopiés TEL QUEL depuis `gabarits-valides-11-11.md` (libellés, sections,
 * ordre, étoiles, types, unités, choix) — aucune valeur inventée, aucune
 * tolérance : les 23 mesures restent en « relevé seul » (décision du 11/11).
 * `G01` — « Entretien préventif — pont 2 colonnes électromécanique jusqu'à
 * 3 t », ses quinze points recopiés tels quels de l'étude du 08/11/2026
 * §4.1 A, validés par Alexis le 29/10/2026 (« ok tel quel ») — N'EST PAS
 * MODIFIÉ par ce ticket.
 *
 * **AUCUNE TOLÉRANCE, AUCUNE VALEUR CHIFFRÉE** : là où la source renvoie à la
 * notice du fabricant, le champ reste vide (CLAUDE.md §8 — pas de valeur
 * inventée). L'unité d'une mesure (« mm », « bar »…) n'est pas de cette
 * nature : elle est écrite telle quelle dans la source.
 *
 * **CHAQUE GABARIT D'INSTALLATION (I00 à I11) SE TERMINE PAR LE BLOC COMMUN
 * « Remise au client »** (six points, `BLOC_REMISE_AU_CLIENT` ci-dessous),
 * numérotés À LA SUITE des points propres au gabarit — jamais une table
 * `checklist_section` séparée (9K08) : la section reste un simple libellé
 * porté par chaque point.
 *
 * **NI NATURE D'INTERVENTION NI RATTACHEMENT MATÉRIEL IMPOSÉS** : un gabarit
 * ne fixe que des POINTS. `typesSuggeres` et `rattachementSuggere`
 * (9K30A) sont des SUGGESTIONS, jamais une contrainte — la société qui part
 * d'un gabarit choisit SES PROPRES types (cases à cocher modifiables) et SON
 * PROPRE sous-type ou SA PROPRE famille (`rattachementSuggere` est un TEXTE
 * affiché à l'écran, jamais un identifiant : un sous-type ou une famille
 * n'existe que dans le périmètre d'une société, et ne peut donc pas être
 * désigné ici). Le modèle né d'un gabarit arrive donc avec des types et un
 * rattachement PROPOSÉS, jamais imposés ; seul le semis de démonstration
 * (`prisma/seed.ts`), qui connaît ses propres sous-types, pose un
 * rattachement effectif.
 */
export type GabaritDeDepart = {
  readonly id: string;
  readonly libelle: string;
  readonly points: readonly SaisiePointChecklist[];
  /** VIDE = aucune suggestion (G00/I00, générique) — voir le docblock. */
  readonly typesSuggeres: readonly TypeIntervention[];
  /** Un TEXTE, jamais un identifiant — voir le docblock. */
  readonly rattachementSuggere: string | null;
};

const ENTRETIEN: readonly TypeIntervention[] = [
  "preventif_contrat",
  "preventif_hors_contrat",
];
const INSTALLATION: readonly TypeIntervention[] = ["installation"];

/** Un point « conforme / non conforme / sans objet ». */
function c(
  section: string,
  ordre: number,
  libelle: string,
  obligatoire = false,
): SaisiePointChecklist {
  return {
    section,
    ordre,
    libelle,
    obligatoire,
    typeReponse: "conforme_non_conforme_sans_objet",
  };
}

/** Un point « case faite ». */
function f(
  section: string,
  ordre: number,
  libelle: string,
  obligatoire = false,
): SaisiePointChecklist {
  return { section, ordre, libelle, obligatoire, typeReponse: "case_faite" };
}

/** Un point « valeur mesurée » — RELEVÉ SEUL, jamais de tolérance (décision du 11/11/2026). */
function m(
  section: string,
  ordre: number,
  libelle: string,
  unite: string,
  obligatoire = false,
): SaisiePointChecklist {
  return {
    section,
    ordre,
    libelle,
    obligatoire,
    typeReponse: "valeur_mesuree",
    unite,
  };
}

/** Un point « choix dans une liste » — choix recopiés dans l'ordre de la source. */
function ch(
  section: string,
  ordre: number,
  libelle: string,
  choix: readonly string[],
  obligatoire = false,
): SaisiePointChecklist {
  return {
    section,
    ordre,
    libelle,
    obligatoire,
    typeReponse: "choix_dans_une_liste",
    choix,
  };
}

/** Un point « texte libre ». */
function txt(
  section: string,
  ordre: number,
  libelle: string,
  obligatoire = false,
): SaisiePointChecklist {
  return { section, ordre, libelle, obligatoire, typeReponse: "texte_libre" };
}

/**
 * LE BLOC COMMUN « Remise au client » (R1 à R6 de la source) — numéroté À
 * LA SUITE du dernier point propre à chaque gabarit d'installation.
 */
function blocRemiseAuClient(
  dernierOrdre: number,
): readonly SaisiePointChecklist[] {
  return [
    c(
      "Remise au client",
      dernierOrdre + 1,
      "Essai complet réalisé en présence du client",
      true,
    ),
    f(
      "Remise au client",
      dernierOrdre + 2,
      "Utilisateurs formés : utilisation, sécurités, entretien courant",
      true,
    ),
    f(
      "Remise au client",
      dernierOrdre + 3,
      "Notice et déclaration de conformité remises",
      true,
    ),
    f(
      "Remise au client",
      dernierOrdre + 4,
      "N° de série relevé, fiche machine à jour, étiquette QR posée",
      true,
    ),
    f(
      "Remise au client",
      dernierOrdre + 5,
      "Zone nettoyée, emballages évacués",
    ),
    txt(
      "Remise au client",
      dernierOrdre + 6,
      "Réserves ou remarques du client",
    ),
  ];
}

const VERIFICATION_ORGANISME_CHOIX = [
  "faite",
  "à prévoir par le client",
  "sans objet",
] as const;

export const GABARITS_DE_DEPART: readonly GabaritDeDepart[] = [
  {
    id: "pont-2-colonnes-electromecanique-entretien-preventif",
    libelle:
      "Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "pont 2 colonnes électromécanique",
    points: [
      {
        section: "Sécurité",
        ordre: 1,
        libelle: "Plaque constructeur et charge maximale lisibles",
        obligatoire: false,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Sécurité",
        ordre: 2,
        libelle: "Consignes et pictogrammes présents",
        obligatoire: false,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Sécurité",
        ordre: 3,
        libelle: "Arrêt d'urgence et interrupteur général fonctionnent",
        obligatoire: true,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Structure",
        ordre: 4,
        libelle: "Ancrages au sol : serrage des chevilles",
        obligatoire: true,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Structure",
        ordre: 5,
        libelle: "Colonnes : aplomb, ni fissure ni déformation",
        obligatoire: false,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Structure",
        ordre: 6,
        libelle: "Bras : axes et verrous de bras fonctionnent",
        obligatoire: true,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Structure",
        ordre: 7,
        libelle: "Patins / tampons en bon état",
        obligatoire: false,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Levage",
        ordre: 8,
        libelle: "Usure des écrous porteurs",
        obligatoire: true,
        typeReponse: "valeur_mesuree",
        unite: "mm",
      },
      {
        section: "Levage",
        ordre: 9,
        libelle: "Graissage des vis",
        obligatoire: false,
        typeReponse: "case_faite",
      },
      {
        section: "Levage",
        ordre: 10,
        libelle: "Courroie / transmission : tension et état",
        obligatoire: false,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Levage",
        ordre: 11,
        libelle: "Écart de hauteur entre les deux chariots",
        obligatoire: false,
        typeReponse: "valeur_mesuree",
        unite: "mm",
      },
      {
        section: "Levage",
        ordre: 12,
        libelle: "Fins de course haut et bas",
        obligatoire: true,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Électrique",
        ordre: 13,
        libelle: "Câbles, boîtier de commande et moteurs en bon état",
        obligatoire: false,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Essai",
        ordre: 14,
        libelle: "Montée et descente complètes à vide",
        obligatoire: true,
        typeReponse: "conforme_non_conforme_sans_objet",
      },
      {
        section: "Essai",
        ordre: 15,
        libelle: "Photo de l'ensemble",
        obligatoire: false,
        typeReponse: "case_faite",
      },
    ],
  },
  {
    id: "generique-entretien-preventif",
    libelle: "Entretien préventif générique",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: null,
    points: [
      c(
        "Sécurité",
        1,
        "Machine consignée avant intervention (énergie coupée, pression purgée)",
        true,
      ),
      c(
        "Sécurité",
        2,
        "Protecteurs, carters et arrêt d'urgence en place et fonctionnels",
      ),
      c(
        "État",
        3,
        "État général : structure, fixations, absence de fuite",
        true,
      ),
      c("État", 4, "Câble d'alimentation, prise, flexibles"),
      f("Entretien", 5, "Nettoyage et dépoussiérage"),
      f("Entretien", 6, "Graissage et niveaux selon la notice"),
      c("Essai", 7, "Essai de fonctionnement complet", true),
      txt("Essai", 8, "Pièces d'usure à prévoir"),
    ],
  },
  {
    id: "pont-2-colonnes-electro-hydraulique-entretien-preventif",
    libelle: "Entretien préventif — pont 2 colonnes électro-hydraulique",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "pont 2 colonnes électro-hydraulique",
    points: [
      c("Sécurité", 1, "Plaque de charge et consignes lisibles", true),
      c(
        "Sécurité",
        2,
        "Crans de sécurité : enclenchement et déverrouillage, 2 colonnes",
        true,
      ),
      c(
        "Sécurité",
        3,
        "Arrêt d'urgence, fin de course haut, commande à action maintenue",
      ),
      c(
        "Structure",
        4,
        "Ancrage au sol : chevilles serrées, dalle sans fissure",
        true,
      ),
      c("Structure", 5, "Colonnes, chariots, patins de guidage (jeu, usure)"),
      c(
        "Structure",
        6,
        "Bras : verrouillage automatique, extensions, butées",
        true,
      ),
      c("Structure", 7, "Tampons d'appui : caoutchouc, filetage"),
      c(
        "Levage",
        8,
        "Câbles de synchronisation : état, tension, poulies",
        true,
      ),
      c("Levage", 9, "Vérins, flexibles, raccords : absence de fuite"),
      f("Levage", 10, "Niveau d'huile hydraulique contrôlé"),
      f("Levage", 11, "Graissage glissières, axes de bras, poulies"),
      c(
        "Essai",
        12,
        "Montée et descente complètes à vide, pose sur crans",
        true,
      ),
      m("Essai", 13, "Écart de hauteur entre les deux chariots", "mm"),
    ],
  },
  {
    id: "pont-4-colonnes-entretien-preventif",
    libelle: "Entretien préventif — pont 4 colonnes",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "pont 4 colonnes",
    points: [
      c("Sécurité", 1, "Plaque de charge et consignes lisibles", true),
      c("Sécurité", 2, "Crémaillères et taquets de sécurité, 4 colonnes", true),
      c("Sécurité", 3, "Sécurité de mou ou rupture de câble", true),
      c("Sécurité", 4, "Arrêt d'urgence, fins de course, signal de descente"),
      c("Structure", 5, "Ancrage et aplomb des colonnes", true),
      c(
        "Structure",
        6,
        "Chemins de roulement, traverses, butées de roues, rampes",
      ),
      c(
        "Levage",
        7,
        "Câbles de levage : fils cassés, corrosion, tension, attaches",
        true,
      ),
      c("Levage", 8, "Poulies et axes : rotation, usure"),
      c("Levage", 9, "Vérin, flexibles, raccords : absence de fuite"),
      f("Levage", 10, "Niveau d'huile hydraulique contrôlé"),
      f("Levage", 11, "Graissage poulies, axes, glissières"),
      c(
        "Accessoires",
        12,
        "Traverse de levage, plaques à jeux, plateaux pivotants (si équipé)",
      ),
      c(
        "Essai",
        13,
        "Montée et descente complètes, horizontalité, pose sur crans",
        true,
      ),
    ],
  },
  {
    id: "pont-ciseaux-entretien-preventif",
    libelle: "Entretien préventif — pont ciseaux",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "pont ciseaux (aussi « pont ciseau (petit) »)",
    points: [
      c("Sécurité", 1, "Plaque de charge et consignes lisibles", true),
      c(
        "Sécurité",
        2,
        "Sécurité mécanique : enclenchement et déverrouillage",
        true,
      ),
      c(
        "Sécurité",
        3,
        "Arrêt d'urgence, fin de course, alarme de fin de descente",
      ),
      c(
        "Structure",
        4,
        "Fixation au sol, état de la fosse ou des rampes",
        true,
      ),
      c("Structure", 5, "Axes, articulations, galets et pistes de roulement"),
      c("Structure", 6, "Tampons et rallonges de plateformes"),
      c("Levage", 7, "Vérins, flexibles, raccords : absence de fuite", true),
      c("Levage", 8, "Synchronisation des deux plateformes"),
      f("Levage", 9, "Niveau d'huile hydraulique contrôlé"),
      f("Levage", 10, "Graissage axes et galets"),
      f("Levage", 11, "Nettoyage sous les plateformes et de la fosse"),
      c(
        "Essai",
        12,
        "Montée et descente complètes, mise à niveau, pose sur sécurité",
        true,
      ),
    ],
  },
  {
    id: "cric-verin-entretien-preventif",
    libelle: "Entretien préventif — cric / vérin hydraulique",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "cric / vérin",
    points: [
      c("Sécurité", 1, "Plaque de charge lisible", true),
      c(
        "Sécurité",
        2,
        "Structure, bras, soudures : ni déformation ni fissure",
        true,
      ),
      c("État", 3, "Roues et roulettes"),
      c("État", 4, "Sellette ou tête d'appui"),
      c("État", 5, "Vérin et pompe : absence de fuite", true),
      c("État", 6, "Levier, pédale, commande de descente"),
      c("État", 7, "Raccord et flexible d'air (oléopneumatique)"),
      f("Entretien", 8, "Niveau d'huile contrôlé, circuit purgé"),
      f("Entretien", 9, "Graissage articulations et axes"),
      c(
        "Essai",
        10,
        "Levée complète, maintien sans affaissement, descente contrôlée",
        true,
      ),
    ],
  },
  {
    id: "grue-atelier-entretien-preventif",
    libelle: "Entretien préventif — grue d'atelier",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "grue d'atelier",
    points: [
      c("Sécurité", 1, "Plaque de charge par position de flèche lisible", true),
      c(
        "Sécurité",
        2,
        "Structure, flèche, soudures : ni déformation ni fissure",
        true,
      ),
      c(
        "Sécurité",
        3,
        "Crochet : linguet de sécurité, ouverture, rotation",
        true,
      ),
      c("État", 4, "Chaîne et maillons"),
      c("État", 5, "Goupilles et axes de flèche et de pliage"),
      c("État", 6, "Roues et roulettes"),
      c("État", 7, "Vérin et pompe : absence de fuite", true),
      f("Entretien", 8, "Niveau d'huile contrôlé, graissage des axes"),
      c(
        "Essai",
        9,
        "Levée, maintien sans affaissement, descente contrôlée",
        true,
      ),
    ],
  },
  {
    id: "compresseur-pistons-entretien-preventif",
    libelle: "Entretien préventif — compresseur à pistons",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "compresseur à pistons",
    points: [
      c("Sécurité", 1, "Soupape de sécurité : déclenchement manuel", true),
      c("Sécurité", 2, "Pressostat : arrêt et redémarrage", true),
      m("Sécurité", 3, "Pression d'arrêt relevée", "bar"),
      c("Sécurité", 4, "Carter de courroie en place, sectionneur"),
      ch(
        "Bloc compresseur",
        5,
        "Huile du bloc",
        ["niveau contrôlé", "appoint", "vidange"],
        true,
      ),
      ch("Bloc compresseur", 6, "Filtre à air", ["nettoyé", "remplacé"]),
      c("Bloc compresseur", 7, "Courroies : état, tension, alignement"),
      c(
        "Bloc compresseur",
        8,
        "Clapet anti-retour et mise à vide : pas de fuite à l'arrêt",
      ),
      f("Bloc compresseur", 9, "Ailettes de refroidissement nettoyées"),
      f("Cuve et réseau", 10, "Purge des condensats de la cuve", true),
      c("Cuve et réseau", 11, "Purgeur automatique (si équipé)"),
      c("Cuve et réseau", 12, "Cuve : corrosion, plaque lisible, silentblocs"),
      c("Cuve et réseau", 13, "Fuites d'air : raccords, flexible, robinet"),
      m(
        "Essai",
        14,
        "Temps de montée en pression, de 0 à l'arrêt",
        "min",
        true,
      ),
    ],
  },
  {
    id: "compresseur-vis-entretien-preventif",
    libelle: "Entretien préventif — compresseur à vis",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "compresseur à vis",
    points: [
      c("Sécurité", 1, "Soupape de sécurité : déclenchement manuel", true),
      c("Sécurité", 2, "Pressions de charge et de mise à vide", true),
      m("Sécurité", 3, "Pression de service relevée", "bar"),
      m("Relevés", 4, "Heures de marche au compteur", "h", true),
      m("Relevés", 5, "Température d'huile en charge", "°C"),
      c("Relevés", 6, "Alarmes et messages du contrôleur"),
      ch(
        "Entretien",
        7,
        "Huile",
        ["niveau contrôlé", "appoint", "vidange"],
        true,
      ),
      ch("Entretien", 8, "Filtre à huile", ["contrôlé", "remplacé"]),
      ch("Entretien", 9, "Filtre à air", ["nettoyé", "remplacé"]),
      ch("Entretien", 10, "Séparateur air-huile", ["contrôlé", "remplacé"]),
      c("Entretien", 11, "Courroies ou accouplement"),
      f("Entretien", 12, "Radiateur et filtres d'armoire nettoyés"),
      c("Entretien", 13, "Fuites d'huile et d'air"),
      f("Entretien", 14, "Purge des condensats, purgeur contrôlé"),
      c("Essai", 15, "Cycle charge, marche à vide, arrêt", true),
    ],
  },
  {
    id: "secheur-air-entretien-preventif",
    libelle: "Entretien préventif — sécheur d'air frigorifique",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "sécheur d'air",
    points: [
      c(
        "Contrôle",
        1,
        "Indicateur de point de rosée dans la zone normale",
        true,
      ),
      f("Contrôle", 2, "Condenseur nettoyé"),
      c("Contrôle", 3, "Purgeur de condensats : fonctionnement", true),
      c("Contrôle", 4, "Ventilateur"),
      c("Contrôle", 5, "Fuites d'air, vanne de by-pass"),
      ch("Contrôle", 6, "Filtres de ligne", [
        "contrôlés",
        "remplacés",
        "sans objet",
      ]),
      c("Contrôle", 7, "Alimentation électrique, alarmes"),
    ],
  },
  {
    id: "demonte-pneus-entretien-preventif",
    libelle: "Entretien préventif — démonte-pneus",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "démonte-pneus",
    points: [
      c("Sécurité", 1, "Pédales : commande et retour au repos", true),
      c(
        "Sécurité",
        2,
        "Gonflage : pistolet, manomètre, limiteur de pression",
        true,
      ),
      f(
        "Air comprimé",
        3,
        "Filtre-régulateur-lubrificateur : purge, niveau d'huile",
      ),
      m("Air comprimé", 4, "Pression d'alimentation", "bar"),
      c(
        "Air comprimé",
        5,
        "Fuites d'air : vérins, flexibles, distributeur rotatif",
      ),
      c(
        "Mécanique",
        6,
        "Plateau : griffes, coulisseaux, serrage et desserrage",
      ),
      c("Mécanique", 7, "Rotation dans les deux sens, courroie, réducteur"),
      c("Mécanique", 8, "Détalonneur : palette, protection, vérin"),
      c("Mécanique", 9, "Colonne et bras : blocage, jeu"),
      c(
        "Mécanique",
        10,
        "Tête de montage : protection plastique, réglage",
        true,
      ),
      c("Mécanique", 11, "Bras d'aide (si équipé)"),
      f(
        "Entretien et essai",
        12,
        "Graissage des coulisseaux et axes, nettoyage",
      ),
      c(
        "Entretien et essai",
        13,
        "Essai complet : détalonnage, démontage, montage",
        true,
      ),
    ],
  },
  {
    id: "equilibreuse-entretien-preventif",
    libelle: "Entretien préventif — équilibreuse",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "équilibreuse",
    points: [
      c(
        "Sécurité",
        1,
        "Carter de protection : pas de lancement carter ouvert",
        true,
      ),
      c("Sécurité", 2, "Stabilité et fixation au sol"),
      c("Mécanique", 3, "Arbre et plateau d'appui : propreté, pas de choc"),
      c("Mécanique", 4, "Écrou rapide, cônes, cloche"),
      c("Mécanique", 5, "Pige et palpeurs : distance, diamètre, largeur"),
      c("Mécanique", 6, "Frein, blocage de position, courroie"),
      f("Entretien", 7, "Nettoyage arbre, cônes, bac à masses"),
      f("Contrôle", 8, "Auto-étalonnage réalisé selon la notice", true),
      c(
        "Contrôle",
        9,
        "Roue équilibrée puis remontée décalée : résultat cohérent",
        true,
      ),
      m("Contrôle", 10, "Résidu relevé au contrôle", "g"),
    ],
  },
  {
    id: "station-climatisation-entretien-preventif",
    libelle: "Entretien préventif — station de climatisation",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "station de climatisation",
    points: [
      ch("Identification", 1, "Fluide de la station", [
        "R134a",
        "R1234yf",
        "bi-gaz",
      ]),
      c("Étanchéité", 2, "Flexibles HP et BP, coupleurs, joints", true),
      c("Étanchéité", 3, "Tenue au vide de la station", true),
      ch("Entretien", 4, "Filtre déshydrateur", ["contrôlé", "remplacé"]),
      ch("Entretien", 5, "Huile de pompe à vide", [
        "niveau contrôlé",
        "vidange",
      ]),
      f(
        "Entretien",
        6,
        "Balance de la bouteille contrôlée avec une masse connue",
      ),
      c("Entretien", 7, "Manomètres et capteurs : zéro"),
      c("Entretien", 8, "Flacons d'huile neuve, d'huile usagée, de traceur"),
      f("Entretien", 9, "Purge des incondensables"),
      c("Entretien", 10, "Logiciel, base véhicules, imprimante"),
      m("Relevé et essai", 11, "Fluide dans la bouteille interne", "kg"),
      c(
        "Relevé et essai",
        12,
        "Cycle complet : récupération, vide, charge",
        true,
      ),
    ],
  },
  {
    id: "banc-geometrie-entretien-preventif",
    libelle: "Entretien préventif — banc de géométrie",
    typesSuggeres: ENTRETIEN,
    rattachementSuggere: "banc de géométrie",
    points: [
      c("Contrôle", 1, "Cibles : propres, non fêlées ; griffes"),
      c("Contrôle", 2, "Caméras et poutre : propreté, fixation"),
      c("Contrôle", 3, "Ordinateur, logiciel, base de données"),
      c(
        "Contrôle",
        4,
        "Plateaux pivotants et plaques de ripage : libres, goupilles",
      ),
      c("Contrôle", 5, "Bloque-volant, presse-pédale"),
      f("Contrôle", 6, "Contrôle de calibrage selon la notice", true),
      c("Contrôle", 7, "Mesure test répétée : résultat cohérent", true),
      txt("Contrôle", 8, "Remarque sur le pont associé (niveau des chemins)"),
    ],
  },
  {
    id: "generique-installation",
    libelle: "Installation générique",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: null,
    points: [
      c(
        "Installation",
        1,
        "Emplacement conforme à la notice : sol, dégagements, ventilation",
        true,
      ),
      c(
        "Installation",
        2,
        "Alimentations conformes à la plaque : électricité, air",
        true,
      ),
      c("Installation", 3, "Fixation et mise à niveau"),
      c("Installation", 4, "Protecteurs et arrêt d'urgence"),
      c("Installation", 5, "Essai de fonctionnement complet", true),
      ...blocRemiseAuClient(5),
    ],
  },
  {
    id: "pont-2-colonnes-electromecanique-installation",
    libelle: "Installation — pont 2 colonnes électromécanique",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "pont 2 colonnes électromécanique",
    points: [
      c("Implantation", 1, "Dalle conforme aux exigences de la notice", true),
      c(
        "Implantation",
        2,
        "Implantation : cotes, dégagements, hauteur sous plafond",
      ),
      c("Implantation", 3, "Aplomb des colonnes, calage", true),
      c("Implantation", 4, "Ancrages posés selon la notice", true),
      m("Implantation", 5, "Couple de serrage des ancrages", "Nm"),
      c("Montage", 6, "Liaison et synchronisation des deux colonnes"),
      c("Montage", 7, "Bras montés : verrouillage, butées, tampons", true),
      f("Montage", 8, "Lubrification vis, écrous, glissières selon la notice"),
      c(
        "Électricité",
        9,
        "Alimentation conforme à la plaque : tension, protection, terre",
        true,
      ),
      c("Électricité", 10, "Sens de rotation des moteurs"),
      c(
        "Sécurités et essais",
        11,
        "Sécurités : fins de course, arrêt d'urgence, écrou de sécurité",
        true,
      ),
      c(
        "Sécurités et essais",
        12,
        "Essai à vide : montée et descente complètes, synchronisation",
        true,
      ),
      c("Sécurités et essais", 13, "Essai en charge avec un véhicule", true),
      c("Sécurités et essais", 14, "Plaque de charge et consignes en place"),
      ch(
        "Sécurités et essais",
        15,
        "Vérification de mise en service par un organisme",
        VERIFICATION_ORGANISME_CHOIX,
      ),
      ...blocRemiseAuClient(15),
    ],
  },
  {
    id: "pont-2-colonnes-electro-hydraulique-installation",
    libelle: "Installation — pont 2 colonnes électro-hydraulique",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "pont 2 colonnes électro-hydraulique",
    points: [
      c("Implantation", 1, "Dalle conforme aux exigences de la notice", true),
      c(
        "Implantation",
        2,
        "Implantation : cotes, dégagements, hauteur sous plafond",
      ),
      c("Implantation", 3, "Aplomb des colonnes, calage", true),
      c("Implantation", 4, "Ancrages posés selon la notice", true),
      m("Implantation", 5, "Couple de serrage des ancrages", "Nm"),
      c("Montage", 6, "Câbles de synchronisation : montage, tension"),
      c(
        "Montage",
        7,
        "Circuit hydraulique : flexibles, raccords, remplissage, purge",
      ),
      c("Montage", 8, "Bras montés : verrouillage, butées, tampons", true),
      c(
        "Électricité",
        9,
        "Alimentation conforme à la plaque : tension, protection, terre",
        true,
      ),
      c("Électricité", 10, "Sens de rotation de la pompe"),
      c(
        "Sécurités et essais",
        11,
        "Sécurités : crans, fin de course, arrêt d'urgence",
        true,
      ),
      c(
        "Sécurités et essais",
        12,
        "Essai à vide : synchronisation, pose sur crans",
        true,
      ),
      c(
        "Sécurités et essais",
        13,
        "Essai en charge : maintien, absence de fuite",
        true,
      ),
      c("Sécurités et essais", 14, "Plaque de charge et consignes en place"),
      ch(
        "Sécurités et essais",
        15,
        "Vérification de mise en service par un organisme",
        VERIFICATION_ORGANISME_CHOIX,
      ),
      ...blocRemiseAuClient(15),
    ],
  },
  {
    id: "pont-4-colonnes-installation",
    libelle: "Installation — pont 4 colonnes",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "pont 4 colonnes",
    points: [
      c("Implantation", 1, "Dalle conforme aux exigences de la notice", true),
      c("Implantation", 2, "Implantation : dégagements, accès du véhicule"),
      c("Implantation", 3, "Aplomb, équerrage et ancrage des colonnes", true),
      m("Implantation", 4, "Couple de serrage des ancrages", "Nm"),
      c(
        "Montage",
        5,
        "Câbles : cheminement, tension, réglage de l'horizontalité",
        true,
      ),
      c(
        "Montage",
        6,
        "Circuit hydraulique et air : raccordement, remplissage, purge",
      ),
      c(
        "Montage",
        7,
        "Chemins de roulement : écartement, niveau, rampes, butées",
      ),
      c(
        "Électricité",
        8,
        "Alimentation conforme à la plaque : tension, protection, terre",
        true,
      ),
      c("Électricité", 9, "Sens de rotation de la pompe"),
      c(
        "Sécurités et essais",
        10,
        "Sécurités : crémaillères, mou de câble, fins de course, arrêt d'urgence",
        true,
      ),
      c(
        "Sécurités et essais",
        11,
        "Essai à vide : montée et descente complètes, pose sur crans",
        true,
      ),
      c(
        "Sécurités et essais",
        12,
        "Essai en charge : horizontalité, maintien, absence de fuite",
        true,
      ),
      c(
        "Sécurités et essais",
        13,
        "Accessoires : traverse, plaques à jeux, plateaux (si équipé)",
      ),
      c("Sécurités et essais", 14, "Plaque de charge et consignes en place"),
      ch(
        "Sécurités et essais",
        15,
        "Vérification de mise en service par un organisme",
        VERIFICATION_ORGANISME_CHOIX,
      ),
      ...blocRemiseAuClient(15),
    ],
  },
  {
    id: "pont-ciseaux-installation",
    libelle: "Installation — pont ciseaux",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "pont ciseaux (aussi « pont ciseau (petit) »)",
    points: [
      c(
        "Implantation",
        1,
        "Sol ou fosse conforme aux exigences de la notice",
        true,
      ),
      c("Implantation", 2, "Implantation : pupitre, passage des flexibles"),
      c("Implantation", 3, "Mise à niveau et fixation", true),
      m("Implantation", 4, "Couple de serrage des ancrages", "Nm"),
      c(
        "Montage",
        5,
        "Circuit hydraulique et air : raccordement, remplissage, purge",
      ),
      c("Montage", 6, "Synchronisation des plateformes réglée", true),
      c(
        "Électricité",
        7,
        "Alimentation conforme à la plaque : tension, protection, terre",
        true,
      ),
      c("Électricité", 8, "Sens de rotation de la pompe"),
      c(
        "Sécurités et essais",
        9,
        "Sécurités : mécanique, fin de course, alarme de descente, arrêt d'urgence",
        true,
      ),
      c(
        "Sécurités et essais",
        10,
        "Essai à vide : montée et descente complètes, mise à niveau",
        true,
      ),
      c(
        "Sécurités et essais",
        11,
        "Essai en charge : maintien, absence de fuite",
        true,
      ),
      c("Sécurités et essais", 12, "Plaque de charge et consignes en place"),
      ch(
        "Sécurités et essais",
        13,
        "Vérification de mise en service par un organisme",
        VERIFICATION_ORGANISME_CHOIX,
      ),
      ...blocRemiseAuClient(13),
    ],
  },
  {
    id: "compresseur-pistons-installation",
    libelle: "Installation — compresseur à pistons",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "compresseur à pistons",
    points: [
      c("Implantation", 1, "Local : ventilation, dégagements, sol", true),
      c("Implantation", 2, "Pose sur silentblocs, mise à niveau"),
      c(
        "Raccordements",
        3,
        "Alimentation conforme à la plaque : tension, protection, terre",
        true,
      ),
      c("Raccordements", 4, "Sens de rotation", true),
      c("Raccordements", 5, "Niveau d'huile du bloc"),
      c(
        "Raccordements",
        6,
        "Raccordement au réseau : flexible, vanne d'isolement",
      ),
      c(
        "Sécurités et réglages",
        7,
        "Soupape de sécurité : déclenchement",
        true,
      ),
      c("Sécurités et réglages", 8, "Pressostat : arrêt et redémarrage", true),
      m("Sécurités et réglages", 9, "Pression d'arrêt réglée", "bar"),
      c("Sécurités et réglages", 10, "Purge de cuve accessible, purgeur"),
      c("Essai", 11, "Étanchéité : aucune fuite sous pression"),
      m(
        "Essai",
        12,
        "Temps de montée en pression, de 0 à l'arrêt",
        "min",
        true,
      ),
      ...blocRemiseAuClient(12),
    ],
  },
  {
    id: "compresseur-vis-installation",
    libelle: "Installation — compresseur à vis",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "compresseur à vis",
    points: [
      c(
        "Implantation",
        1,
        "Local : ventilation, température, dégagements",
        true,
      ),
      c("Implantation", 2, "Pose et mise à niveau"),
      c(
        "Raccordements",
        3,
        "Alimentation conforme à la plaque : tension, protection, terre",
        true,
      ),
      c("Raccordements", 4, "Sens de rotation, ordre des phases", true),
      c("Raccordements", 5, "Niveau d'huile"),
      c(
        "Raccordements",
        6,
        "Raccordement au réseau et à la cuve, vanne d'isolement",
      ),
      c("Raccordements", 7, "Évacuation des condensats raccordée"),
      c(
        "Sécurités et réglages",
        8,
        "Soupape de sécurité : déclenchement",
        true,
      ),
      c(
        "Sécurités et réglages",
        9,
        "Contrôleur : pressions de charge et de mise à vide réglées",
        true,
      ),
      m("Sécurités et réglages", 10, "Pression de service réglée", "bar"),
      m("Essai", 11, "Température d'huile en charge", "°C"),
      c("Essai", 12, "Fuites d'huile et d'air"),
      c("Essai", 13, "Cycle charge, marche à vide, arrêt", true),
      m("Essai", 14, "Heures au compteur à la mise en service", "h"),
      ...blocRemiseAuClient(14),
    ],
  },
  {
    id: "secheur-air-installation",
    libelle: "Installation — sécheur d'air frigorifique",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "sécheur d'air",
    points: [
      c("Installation", 1, "Emplacement ventilé, dégagements", true),
      c("Installation", 2, "Raccordement dans le bon sens, by-pass", true),
      c("Installation", 3, "Alimentation conforme à la plaque", true),
      c("Installation", 4, "Évacuation des condensats"),
      c("Installation", 5, "Filtres de ligne montés"),
      c("Installation", 6, "Fuites d'air"),
      c(
        "Installation",
        7,
        "Point de rosée dans la zone normale après mise en route",
        true,
      ),
      ...blocRemiseAuClient(7),
    ],
  },
  {
    id: "demonte-pneus-installation",
    libelle: "Installation — démonte-pneus",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "démonte-pneus",
    points: [
      c("Installation", 1, "Emplacement, dégagements, fixation au sol", true),
      c(
        "Installation",
        2,
        "Alimentation électrique conforme à la plaque",
        true,
      ),
      c("Installation", 3, "Sens de rotation du plateau"),
      c(
        "Installation",
        4,
        "Air : raccordement, filtre-régulateur-lubrificateur",
        true,
      ),
      m("Installation", 5, "Pression d'alimentation réglée", "bar"),
      c("Installation", 6, "Fuites d'air"),
      c("Installation", 7, "Montage colonne, bras, tête"),
      c("Installation", 8, "Bras d'aide (si équipé)"),
      c(
        "Installation",
        9,
        "Gonflage : pistolet, manomètre, limiteur de pression",
        true,
      ),
      c("Installation", 10, "Essai complet sur une roue", true),
      ...blocRemiseAuClient(10),
    ],
  },
  {
    id: "equilibreuse-installation",
    libelle: "Installation — équilibreuse",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "équilibreuse",
    points: [
      c(
        "Installation",
        1,
        "Emplacement stable, fixation selon la notice",
        true,
      ),
      c(
        "Installation",
        2,
        "Alimentation électrique conforme à la plaque",
        true,
      ),
      c("Installation", 3, "Montage carter, arbre, accessoires"),
      c(
        "Installation",
        4,
        "Carter de protection : pas de lancement carter ouvert",
        true,
      ),
      f("Installation", 5, "Étalonnage initial selon la notice", true),
      c(
        "Installation",
        6,
        "Roue équilibrée puis remontée décalée : résultat cohérent",
        true,
      ),
      m("Installation", 7, "Résidu relevé au contrôle", "g"),
      ...blocRemiseAuClient(7),
    ],
  },
  {
    id: "station-climatisation-installation",
    libelle: "Installation — station de climatisation",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "station de climatisation",
    points: [
      ch("Installation", 1, "Fluide de la station", [
        "R134a",
        "R1234yf",
        "bi-gaz",
      ]),
      c(
        "Installation",
        2,
        "Déballage, déblocage de la balance après transport",
      ),
      c(
        "Installation",
        3,
        "Alimentation électrique conforme à la plaque",
        true,
      ),
      f("Installation", 4, "Niveau d'huile de la pompe à vide"),
      f("Installation", 5, "Remplissage de la bouteille interne"),
      m("Installation", 6, "Fluide chargé dans la bouteille", "kg"),
      c("Installation", 7, "Tenue au vide de la station", true),
      f("Installation", 8, "Balance contrôlée avec une masse connue"),
      c("Installation", 9, "Logiciel, base véhicules, langue, imprimante"),
      c("Installation", 10, "Cycle complet : récupération, vide, charge", true),
      ...blocRemiseAuClient(10),
    ],
  },
  {
    id: "banc-geometrie-installation",
    libelle: "Installation — banc de géométrie",
    typesSuggeres: INSTALLATION,
    rattachementSuggere: "banc de géométrie",
    points: [
      c(
        "Installation",
        1,
        "Emplacement : recul, hauteur, éclairage selon la notice",
        true,
      ),
      c("Installation", 2, "Fixation de la poutre et des caméras"),
      c("Installation", 3, "Alimentation, ordinateur, logiciel, licence", true),
      c(
        "Installation",
        4,
        "Pont associé : niveau des chemins, plateaux, plaques",
      ),
      f("Installation", 5, "Calibrage initial selon la notice", true),
      c("Installation", 6, "Mesure test répétée : résultat cohérent", true),
      c(
        "Installation",
        7,
        "Accessoires complets : cibles, griffes, bloque-volant, presse-pédale",
      ),
      ...blocRemiseAuClient(7),
    ],
  },
];

/** Un gabarit par son identifiant — `undefined` s'il n'existe pas (liste close). */
export function gabaritDeDepart(id: string): GabaritDeDepart | undefined {
  return GABARITS_DE_DEPART.find((gabarit) => gabarit.id === id);
}
