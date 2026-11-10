import type { SaisiePointChecklist } from "@/lib/checklists/depot";

/**
 * LES GABARITS DE DÉPART (9K20-CHECKLIST-DUPLIQUER-DEPART) — une liste EN
 * CODE, jamais en base, jamais posée par une migration : un point de départ
 * pour un nouveau modèle, pas une donnée de société.
 *
 * **UN SEUL GABARIT AUJOURD'HUI** : « Entretien préventif — pont 2 colonnes
 * électromécanique jusqu'à 3 t » (préventif sous contrat ou hors contrat),
 * ses quinze points recopiés tels quels de l'étude du 08/11/2026 §4.1 A,
 * validés par Alexis le 29/10/2026 (« ok tel quel »). Les points 16 à 19 de
 * cette même section sont des propositions NON validées : ils n'entrent pas
 * ici.
 *
 * **AUCUNE TOLÉRANCE, AUCUNE VALEUR CHIFFRÉE** : là où l'étude renvoie à la
 * notice du fabricant (« = [N] »), le champ reste vide (CLAUDE.md §8 — pas de
 * valeur inventée). L'unité d'une mesure (« mm ») n'est pas de cette
 * nature : elle est écrite telle quelle dans l'étude, pas réduite à la
 * notice d'un modèle précis.
 *
 * **NI NATURE D'INTERVENTION NI RATTACHEMENT MATÉRIEL** : un gabarit ne fixe
 * que des POINTS. La nature (« préventif sous contrat ou hors contrat » ci-
 * dessus) est documentaire ; le champ `type_intervention` du modèle créé la
 * rendrait UNIQUE alors que l'étude en nomme deux, et aucun mécanisme ne
 * porte un ENSEMBLE de natures (D239, `lib/checklists/cascade.ts`). Le
 * rattachement matériel dépend de la société qui l'utilise — un sous-type
 * n'existe que dans son périmètre — et ne peut donc pas être écrit ici. Le
 * modèle né d'un gabarit arrive donc SANS nature ni rattachement ; seul le
 * semis de démonstration (`prisma/seed.ts`), qui connaît ses propres sous-
 * types, en pose un.
 */
export type GabaritDeDepart = {
  readonly id: string;
  readonly libelle: string;
  readonly points: readonly SaisiePointChecklist[];
};

export const GABARITS_DE_DEPART: readonly GabaritDeDepart[] = [
  {
    id: "pont-2-colonnes-electromecanique-entretien-preventif",
    libelle:
      "Entretien préventif — pont 2 colonnes électromécanique jusqu'à 3 t",
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
];

/** Un gabarit par son identifiant — `undefined` s'il n'existe pas (liste close). */
export function gabaritDeDepart(id: string): GabaritDeDepart | undefined {
  return GABARITS_DE_DEPART.find((gabarit) => gabarit.id === id);
}
