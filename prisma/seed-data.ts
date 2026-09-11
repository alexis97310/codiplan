import { Role } from "@/lib/auth/roles";
import { anneeCourante, cleJour } from "@/lib/calendar/fuseau";
import { cleJourAdossePaques } from "@/lib/calendar/paques";
import { DIMANCHE, LUNDI, SAMEDI } from "@/lib/calendar/semaine";
import type {
  PrioriteIntervention,
  StatutIntervention,
  TypeIntervention,
} from "@prisma/client";

/**
 * Jeu de données de démonstration (I9 — aucune donnée de production).
 *
 * Décrit de façon pure et déterministe ce que `prisma/seed.ts` écrit en base :
 * deux sociétés (l'une en XPF avec trois agences, l'autre en EUR) et au moins
 * un compte portail rattaché à un client (critère d'acceptation L0-03).
 *
 * Ce module ne dépend pas de la base : il est directement vérifiable par un
 * test unitaire. Les clés naturelles (code, email) rendent le seed idempotent.
 *
 * Les sociétés portent ici un identifiant FIXE, contrairement aux autres objets
 * dont l'UUID v7 est attribué à l'écriture par `seed.ts`. Raison : depuis que
 * `FORCE ROW LEVEL SECURITY` s'applique aussi au propriétaire, la politique de
 * `societe` est `id = app.societe_id` — le seed doit donc connaître l'identifiant
 * AVANT d'écrire, pour poser le contexte. Une recherche préalable par `code`
 * serait elle-même filtrée : impossible. Ces identifiants restent des UUID v7
 * bien formés (I10) et ne désignent que des sociétés fictives (I9).
 */

/**
 * Un écart local de l'agence sur le fait public (D46, complément 2).
 *
 * Deux formes : un **férié travaillé**, désigné par son libellé dans le
 * référentiel du territoire ; ou un **pont**, désigné par sa date locale.
 * L'une et l'autre produisent une ligne de `calendrier_ferie`.
 */
export type EcartAgenceSeed =
  /** Un férié du territoire que l'agence TRAVAILLE, désigné par son libellé. */
  | { ferie_libelle: string; travaille: true; motif: string }
  /**
   * Un PONT : un jour ordinaire que l'agence chôme, désigné par son mois et
   * son quantième. Comme les fériés fixes, il se répète chaque année et suit
   * donc l'horizon glissant — un pont figé à une date passée serait le défaut
   * même que le complément 3 de D46 prévient.
   */
  | { mois: number; jour: number; travaille: false; motif: string };

export type AgenceSeed = {
  code: string;
  libelle: string;
  adresse: { rue: string; commune: string };
  /**
   * Territoire au sens des JOURS FÉRIÉS — code ISO 3166-1 alpha-2 (D46).
   * **Indépendant du fuseau, et jamais déduit de lui.** Il est écrit ici agence
   * par agence, précisément pour qu'aucun code ne puisse le calculer.
   */
  territoire: string;
  /**
   * Code du calendrier d'ouverture rattaché (D5). Plusieurs agences peuvent
   * partager le même : c'est la forme que prend « héritage depuis la société
   * avec surcharge possible par agence » (D13). Le calendrier porte les
   * HEURES ; le territoire et les écarts appartiennent à l'agence.
   */
  calendrier_code: string;
  /** Ce par quoi cette agence s'écarte du fait public de son territoire. */
  ecarts: readonly EcartAgenceSeed[];
};

/** Une plage d'ouverture hebdomadaire, sous sa forme LOCALE (jamais UTC). */
export type PlageSeed = {
  /** Jour ISO — 1 lundi, 7 dimanche. */
  jour_semaine: number;
  debut_minutes: number;
  fin_minutes: number;
};

/**
 * Un calendrier d'ouverture : des HEURES, et rien d'autre.
 *
 * Ni territoire, ni fériés travaillés : ces deux-là appartiennent à l'AGENCE
 * (D46, compléments 1 et 2). Deux agences de territoires différents peuvent
 * partager les mêmes horaires, et deux agences du même calendrier peuvent
 * diverger sur un pont.
 */
export type CalendrierSeed = {
  code: string;
  libelle: string;
  plages: readonly PlageSeed[];
};

export type SocieteSeed = {
  /** UUID v7 fixe — voir l'entête du module. */
  id: string;
  code: string;
  raison_sociale: string;
  pays: string;
  territoire: string;
  fuseau_horaire: string;
  devise_code: string;
  majoration_hors_ouverture_pct: string;
  /**
   * Charte de démonstration (L0-09). Les deux sociétés du seed portent des
   * couleurs DISTINCTES : c'est ce qui rend visible qu'une bascule de société
   * change l'identité visuelle. Ces couleurs ne sont pas celles de l'annexe C
   * du cahier des charges — un jeu de démonstration ne porte aucune charte
   * réelle (I9), et le vrai paramétrage est une opération d'exploitation.
   */
  couleur_primaire: string;
  couleur_secondaire: string;
  /**
   * Libellé d'affichage de `client.code_externe` (D29). CODIMA dit « Code
   * Winpro » ; une société qui n'a pas d'ERP nommé n'en dit rien, et reçoit le
   * libellé générique du dictionnaire. Les deux cas sont représentés dans le
   * jeu de démonstration — sans quoi la branche « société sans libellé » ne
   * serait jamais empruntée.
   */
  libelle_code_externe: string | null;
  langue: string;
  agences: AgenceSeed[];
  calendriers: CalendrierSeed[];
  /** Clients de démonstration (ticket L1-01). */
  clients: ClientSeed[];
};

/**
 * Un client de démonstration (ticket L1-01, I9).
 *
 * **Identifiant FIXE**, comme celui des sociétés et pour une raison voisine :
 * `COMPTES_PORTAIL` doit pouvoir désigner un client par son identifiant avant
 * que quoi que ce soit ne soit écrit, et un `upsert` par identifiant est ce qui
 * rend le seed idempotent — rejouer corrige un libellé au lieu de créer une
 * seconde fiche. Ce sont des UUID v7 bien formés (I10) désignant des sociétés
 * fictives (I9).
 *
 * **Le libellé DIT qu'il s'agit d'une démonstration**, en toutes lettres et
 * dans la raison sociale elle-même : une base de démonstration qu'on prendrait
 * pour une base réelle est exactement ce que I9 prévient.
 */
/**
 * Un site de démonstration (ticket L1-02).
 *
 * **Le libellé DIT qu'il s'agit d'une démonstration**, comme la raison sociale
 * des clients : une base de démonstration qu'on prendrait pour une base réelle
 * est exactement ce que I9 prévient.
 *
 * Les identifiants sont des UUID v7 FIXES, pour la même raison que ceux des
 * clients : `COMPTES_PORTAIL.perimetre_sites` doit pouvoir désigner un site
 * avant que quoi que ce soit ne soit écrit, et l'`upsert` par identifiant est
 * ce qui rend le seed idempotent.
 */
export type SiteSeed = {
  /** UUID v7 fixe — voir ci-dessus. */
  id: string;
  /**
   * **Code de l'agence dont ce site dépend** (D56) — pas son identifiant : les
   * agences sont `upsert`ées par `(societe_id, code)` et n'ont pas d'UUID fixe
   * au jeu de démonstration. Le seed le résout, et ÉCHOUE en nommant le site si
   * le code est inconnu : un site dépend d'une agence et d'une seule, il n'y a
   * pas de valeur par défaut.
   */
  agence_code: string;
  libelle: string;
  commune: string | null;
  /**
   * Zone de D23, ou `null`. **Le `null` n'est pas un remplissage manquant :
   * c'est le cas que les six zones ne savent pas décrire.** Le site européen du
   * jeu de démonstration le porte à dessein — `grand_noumea` n'a aucun sens à
   * Paris —, et c'est la démonstration en acte de l'arbitrage ouvert par ce
   * ticket : l'énumération de D23 est la géographie d'UN territoire.
   */
  zone_geo: string | null;
  latitude: number | null;
  longitude: number | null;
  consignes_acces: string | null;
  /** Plages hebdomadaires, même forme que `calendrier_plage` (jour ISO, minutes). */
  horaires: Array<{
    jour_semaine: number;
    debut_minutes: number;
    fin_minutes: number;
  }> | null;
  /** Fait foi sur l'estimation par zone quand il est renseigné (D23, RG-PLA-05). */
  temps_trajet_min: number | null;
  actif: boolean;
};

export type ClientSeed = {
  /** UUID v7 fixe — voir ci-dessus. */
  id: string;
  /**
   * Code externe. `null` sur l'un des clients à dessein : D29 exige que son
   * absence n'empêche rien, et une démonstration où tous les clients en portent
   * un n'éprouverait jamais cette branche.
   */
  code_externe: string | null;
  raison_sociale: string;
  ridet: string | null;
  categorie: string | null;
  adresse_facturation: { rue: string; commune: string } | null;
  conditions_reglement: string | null;
  commercial_referent: string | null;
  actif: boolean;
  /**
   * Les sites de ce client (L1-02). Imbriqués sous le client plutôt que listés
   * à côté : c'est la clé étrangère composite `(societe_id, client_id)` qui les
   * y rattache en base, et une liste à plat aurait à répéter ce rattachement —
   * donc à pouvoir le contredire.
   */
  sites: SiteSeed[];
};

export type DeviseSeed = {
  code: string;
  libelle: string;
  decimales: number;
  symbole: string | null;
};

export type HabilitationSeed = { societe_code: string; role: Role };

export type UtilisateurInterneSeed = {
  /** Nom affiché — Better Auth l'exige, et un compte sans nom ne se relit pas. */
  nom: string;
  email: string;
  habilitations: HabilitationSeed[];
};

export type ComptePortailSeed = {
  nom: string;
  email: string;
  societe_code: string;
  client_id: string;
  perimetre_sites: string[];
};

export type PariteSeed = {
  devise_code: string;
  /** Date d'effet ISO (YYYY-MM-DD). Jamais implicite (D20). */
  date_effet: string;
  /** Taux en chaîne décimale — jamais de flottant, l'arithmétique reste exacte. */
  taux: string;
  source: string;
};

/** Référentiel de plateforme (I1). XPF sans décimale, EUR à deux (I3, D19). */
export const DEVISES: readonly DeviseSeed[] = [
  { code: "XPF", libelle: "Franc Pacifique", decimales: 0, symbole: null },
  { code: "EUR", libelle: "Euro", decimales: 2, symbole: "€" },
];

/**
 * Territoires au sens des JOURS FÉRIÉS, en **code ISO 3166-1 alpha-2** (D46).
 *
 * **Trois choses à ne pas confondre, et c'est tout le sujet du complément 1
 * de D46 :**
 *   — le **territoire** dit quels jours sont fériés — `NC`, `FR` ;
 *   — le **fuseau** dit quelle heure il est — `Pacific/Noumea`,
 *     `Europe/Paris` ;
 *   — `societe.territoire` porte une **circonscription administrative**
 *     (« Province Sud », « Métropole »), sans rapport avec les fériés.
 *
 * Le territoire ne se déduit JAMAIS du fuseau : `Europe/Paris` couvre plusieurs
 * territoires aux fériés différents. Les deux sont écrits agence par agence,
 * précisément pour qu'aucun code ne puisse calculer l'un depuis l'autre.
 */
export const TERRITOIRE_NOUVELLE_CALEDONIE = "NC";
export const TERRITOIRE_FRANCE_METROPOLE = "FR";

/** Un férié à date fixe — le jour du calendrier grégorien, chaque année. */
export type FerieFixeSeed = { mois: number; jour: number; libelle: string };

/** Une ligne de `jour_ferie` telle que le seed l'écrit. */
export type JourFerieSeed = {
  territoire: string;
  /** Date locale `AAAA-MM-JJ` — un férié est un jour, pas un instant. */
  date: string;
  libelle: string;
  /** Vrai pour les fêtes adossées à Pâques. */
  mobile: boolean;
};

/**
 * Fériés à date fixe, par territoire.
 *
 * **Ce sont des DONNÉES, et elles ne vivent que là** (point 4 du ticket
 * L0-08) : aucune date fériée n'est écrite ailleurs dans le dépôt, et le
 * gardien `tests/unit/calendar/sans-date-feriee-en-dur.test.ts` le vérifie.
 * Vendre la solution suppose qu'un client d'un autre territoire ajoute les
 * siens — une entrée de plus dans cette table, jamais une ligne de code.
 *
 * La Nouvelle-Calédonie porte, en plus des fériés métropolitains, la **fête de
 * la citoyenneté du 24 septembre**. Elle ne porte pas le 8 mai de la même
 * manière : la liste ci-dessous est celle des jours fériés légaux applicables
 * sur le territoire, et elle sera confirmée par l'exploitant au premier
 * paramétrage réel — comme les horaires d'agence.
 */
export const FERIES_FIXES: Readonly<Record<string, readonly FerieFixeSeed[]>> =
  {
    [TERRITOIRE_NOUVELLE_CALEDONIE]: [
      { mois: 1, jour: 1, libelle: "Jour de l'An" },
      { mois: 5, jour: 1, libelle: "Fête du Travail" },
      { mois: 5, jour: 8, libelle: "Victoire 1945" },
      { mois: 7, jour: 14, libelle: "Fête nationale" },
      { mois: 8, jour: 15, libelle: "Assomption" },
      { mois: 9, jour: 24, libelle: "Fête de la citoyenneté" },
      { mois: 11, jour: 1, libelle: "Toussaint" },
      { mois: 11, jour: 11, libelle: "Armistice 1918" },
      { mois: 12, jour: 25, libelle: "Noël" },
    ],
    [TERRITOIRE_FRANCE_METROPOLE]: [
      { mois: 1, jour: 1, libelle: "Jour de l'An" },
      { mois: 5, jour: 1, libelle: "Fête du Travail" },
      { mois: 5, jour: 8, libelle: "Victoire 1945" },
      { mois: 7, jour: 14, libelle: "Fête nationale" },
      { mois: 8, jour: 15, libelle: "Assomption" },
      { mois: 11, jour: 1, libelle: "Toussaint" },
      { mois: 11, jour: 11, libelle: "Armistice 1918" },
      { mois: 12, jour: 25, libelle: "Noël" },
    ],
  };

/**
 * Fêtes mobiles adossées à Pâques : leur libellé et leur décalage en jours par
 * rapport au dimanche pascal.
 *
 * **Le libellé est une donnée du territoire, pas une constante de calcul.**
 * `lib/calendar/paques.ts` ne connaît qu'un décalage en jours ; c'est ici que
 * ce décalage reçoit un nom, à côté des fériés fixes, pour qu'un territoire
 * qui n'en célèbre qu'une partie puisse le dire sans toucher au code.
 *
 * La liste est aujourd'hui la même pour les deux territoires du jeu ; elle
 * devient propre à chacun le jour où un territoire s'en écarte.
 */
export const FETES_MOBILES: readonly { libelle: string; decalage: number }[] = [
  { libelle: "Lundi de Pâques", decalage: 1 },
  { libelle: "Ascension", decalage: 39 },
  { libelle: "Lundi de Pentecôte", decalage: 50 },
];

/**
 * Nombre d'années amorcées **au-delà** de l'année en cours.
 *
 * Deux, donc un horizon de deux à trois ans selon le mois. La borne basse — au
 * 31 décembre, l'année en cours est épuisée et il reste exactement deux ans —
 * dépasse largement les douze mois que `scripts/horizon-feries.mts` exige.
 */
export const ANNEES_AU_DELA = 2;

/**
 * Les années couvertes par le seed, à partir d'une année de départ.
 *
 * **Horizon GLISSANT, jamais une liste figée** (D46, complément 3). Une liste
 * `[2026, 2027, 2028]` écrite à la main serait juste aujourd'hui et fausse en
 * 2029 — et sa fausseté serait silencieuse : la table ne serait pas vide, elle
 * serait périmée, et le planning proposerait des créneaux un 1ᵉʳ mai sans rien
 * signaler.
 */
export function anneesFeries(anneeDeDepart: number): number[] {
  if (!Number.isInteger(anneeDeDepart)) {
    throw new Error(
      `Année de départ invalide : ${anneeDeDepart}. Attendu un entier.`,
    );
  }
  return Array.from(
    { length: ANNEES_AU_DELA + 1 },
    (_, index) => anneeDeDepart + index,
  );
}

/**
 * Les fériés d'un territoire pour une année : les fixes, plus les mobiles
 * adossées à Pâques.
 *
 * Le calcul de Pâques vit dans `lib/calendar/paques.ts` et n'est appelé QU'ICI :
 * il produit les lignes de la table, il ne s'exécute jamais à la volée dans le
 * métier (point 4 du ticket). Une fête déplacée demain se corrige par une ligne
 * de table, pas par un correctif logiciel.
 */
export function feriesDuTerritoire(
  territoire: string,
  annee: number,
): JourFerieSeed[] {
  const fixes = FERIES_FIXES[territoire];
  if (fixes === undefined) {
    throw new Error(
      `Territoire inconnu du jeu de démonstration : ${territoire}. ` +
        "Les fériés sont des données : ajouter le territoire à FERIES_FIXES.",
    );
  }

  return [
    ...fixes.map((ferie) => ({
      territoire,
      date: cleJour({ annee, mois: ferie.mois, jour: ferie.jour }),
      libelle: ferie.libelle,
      mobile: false,
    })),
    ...FETES_MOBILES.map((fete) => ({
      territoire,
      date: cleJourAdossePaques(annee, fete.decalage),
      libelle: fete.libelle,
      mobile: true,
    })),
  ];
}

/**
 * Toutes les lignes de `jour_ferie` du jeu de démonstration, sur l'horizon
 * glissant qui part de `anneeDeDepart`.
 *
 * Ce n'est **pas une constante** : une constante figerait l'horizon au jour où
 * le module a été chargé pour la première fois, ce qui est exactement le défaut
 * que le complément 3 de D46 prévient.
 */
export function joursFeries(anneeDeDepart: number): JourFerieSeed[] {
  return Object.keys(FERIES_FIXES)
    .flatMap((territoire) =>
      anneesFeries(anneeDeDepart).flatMap((annee) =>
        feriesDuTerritoire(territoire, annee),
      ),
    )
    .sort(
      (a, b) =>
        a.territoire.localeCompare(b.territoire) ||
        a.date.localeCompare(b.date),
    );
}

/**
 * L'horizon des fériés d'une société, calculé dans SON fuseau.
 *
 * « L'année en cours » est une lecture locale : le 1ᵉʳ janvier n'arrive pas au
 * même instant à Nouméa et à Paris. Le fuseau vient donc de la société, jamais
 * d'une constante — c'est la même règle que partout ailleurs dans ce dépôt.
 */
export function anneeDeDepartFeries(societe: SocieteSeed): number {
  return anneeCourante(societe.fuseau_horaire);
}

/** Minutes locales depuis minuit — `heureLocale(7, 30)` vaut 450. */
function heureLocale(heures: number, minutes = 0): number {
  return heures * 60 + minutes;
}

/**
 * Fabrique les plages d'une semaine de démonstration : les mêmes horaires du
 * premier au dernier jour indiqués, avec une coupure de midi.
 */
function semaineDeDemonstration(
  premierJour: number,
  dernierJour: number,
  matin: readonly [number, number],
  apresMidi: readonly [number, number] | null,
): PlageSeed[] {
  const plages: PlageSeed[] = [];
  for (let jour = premierJour; jour <= dernierJour; jour += 1) {
    plages.push({
      jour_semaine: jour,
      debut_minutes: matin[0],
      fin_minutes: matin[1],
    });
    if (apresMidi !== null) {
      plages.push({
        jour_semaine: jour,
        debut_minutes: apresMidi[0],
        fin_minutes: apresMidi[1],
      });
    }
  }
  return plages;
}

/**
 * Calendriers de DÉMONSTRATION de la société néo-calédonienne.
 *
 * **Ces horaires ne sont pas ceux des agences CODIMA.** Le ticket L0-08 le pose
 * expressément : « les horaires réels des agences CODIMA seront saisis plus
 * tard ; le seed porte des valeurs de démonstration, clairement identifiées
 * comme telles ». Le libellé de chaque calendrier le dit, pour qu'une capture
 * d'écran ne puisse pas passer pour un paramétrage validé.
 *
 * Ce qui n'est PAS de la démonstration, en revanche, c'est la divergence entre
 * les deux : Ducos ouvre le samedi, Koné non (RG-PLA-01). C'est la règle même
 * que I7 défend, et le jeu de test doit la porter.
 */
const CALENDRIERS_NC: CalendrierSeed[] = [
  {
    code: "DEMO-NOUMEA",
    libelle: "Nouméa — horaires de démonstration",
    plages: [
      ...semaineDeDemonstration(
        LUNDI,
        SAMEDI - 1,
        [heureLocale(7, 30), heureLocale(11, 30)],
        [heureLocale(13), heureLocale(17)],
      ),
      // Le samedi matin seulement — Ducos ouvre, et c'est le point de RG-PLA-01.
      {
        jour_semaine: SAMEDI,
        debut_minutes: heureLocale(7, 30),
        fin_minutes: heureLocale(11, 30),
      },
    ],
  },
  {
    code: "DEMO-KONE",
    libelle: "Koné — horaires de démonstration",
    plages: semaineDeDemonstration(
      LUNDI,
      SAMEDI - 1,
      [heureLocale(7, 30), heureLocale(11, 30)],
      [heureLocale(13), heureLocale(17)],
    ),
  },
];

/** Calendrier de démonstration de la société européenne. */
const CALENDRIERS_EU: CalendrierSeed[] = [
  {
    code: "DEMO-SIEGE",
    libelle: "Siège — horaires de démonstration",
    plages: semaineDeDemonstration(
      LUNDI,
      DIMANCHE - 2,
      [heureLocale(9), heureLocale(12, 30)],
      [heureLocale(14), heureLocale(18)],
    ),
  },
];

/**
 * Un **pont** de démonstration : un jour ordinaire que l'agence chôme, sans
 * qu'aucun férié ne tombe ce jour-là.
 *
 * C'est la seconde forme d'écart local (D46, complément 2), et la seule qui ne
 * s'adosse à aucun fait public. Elle est portée par DOLBEAU seule, alors que
 * Dolbeau et Ducos partagent le calendrier `DEMO-NOUMEA` : c'est la
 * démonstration, en données, que l'écart appartient à l'AGENCE et non au
 * calendrier — et c'est pourquoi `calendrier_ferie` porte `agence_id`.
 *
 * La veille de Noël chômée l'après-midi est le pont le plus banal qui soit ;
 * c'est un choix de DÉMONSTRATION, pas une décision de CODIMA.
 */
const PONT_DE_DEMONSTRATION: EcartAgenceSeed = {
  mois: 12,
  jour: 24,
  travaille: false,
  motif: "Pont de démonstration — veille de Noël",
};

/**
 * Les écarts locaux d'une agence, déroulés sur l'horizon glissant.
 *
 * Un férié travaillé est résolu par son libellé dans le référentiel du
 * territoire — c'est le fait public qui donne la date, jamais l'agence
 * (D46, complément 2) ; un pont porte la sienne.
 */
export function ecartsDeLAgence(
  agence: AgenceSeed,
  anneeDeDepart: number,
): Array<{
  date: string;
  travaille: boolean;
  motif: string;
  ferie_libelle: string | null;
}> {
  return anneesFeries(anneeDeDepart).flatMap((annee) =>
    agence.ecarts.map((ecart) => {
      if ("ferie_libelle" in ecart) {
        const feries = feriesDuTerritoire(agence.territoire, annee);
        const ferie = feries.find(
          (candidat) => candidat.libelle === ecart.ferie_libelle,
        );
        if (ferie === undefined) {
          throw new Error(
            `Agence ${agence.code} : le férié « ${ecart.ferie_libelle} » ` +
              `n'existe pas sur le territoire ${agence.territoire} en ` +
              `${annee}. Un écart local surcharge un fait public ; il ne le ` +
              "crée pas.",
          );
        }
        return {
          date: ferie.date,
          travaille: true,
          motif: ecart.motif,
          ferie_libelle: ecart.ferie_libelle,
        };
      }

      return {
        date: cleJour({ annee, mois: ecart.mois, jour: ecart.jour }),
        travaille: false,
        motif: ecart.motif,
        ferie_libelle: null,
      };
    }),
  );
}

/**
 * Société XPF : CODIMA en Nouvelle-Calédonie, avec ses trois agences (D5).
 * Taux horaire 7 000 XPF (chapitre 11 §11.2), majoration hors ouverture +50 % (D12).
 */
/**
 * Clients de démonstration de CODIMA-NC (ticket L1-01, I9).
 *
 * Le PREMIER porte l'identifiant que `COMPTES_PORTAIL` désigne depuis L0-03 :
 * jusqu'à ce ticket, le compte portail de démonstration pointait vers un client
 * qui n'existait pas — la table n'existait pas non plus. Il pointe désormais
 * vers une fiche réelle, et le scénario du portail (D10) est jouable de bout en
 * bout sur la base de démonstration.
 *
 * Trois cas, et chacun sert : un client avec code externe, un SANS (D29 —
 * « son absence ne suffit plus à rejeter la ligne »), et un INACTIF (la colonne
 * `actif` du chapitre 11.2, et le filtre `actifs_seulement` de la recherche).
 */
const CLIENTS_NC: ClientSeed[] = [
  {
    id: "0192f0a0-1000-7000-8000-000000000001",
    code_externe: "DEMO-001",
    raison_sociale: "Atelier Ducos (démonstration)",
    ridet: null,
    categorie: "Industrie",
    adresse_facturation: {
      rue: "1 rue de la Démonstration",
      commune: "Nouméa",
    },
    conditions_reglement: "30 jours fin de mois",
    commercial_referent: "Commercial de démonstration",
    actif: true,
    // DEUX sites chez le même client, et c'est ce qui rend le périmètre
    // démontrable : seul `app.perimetre_sites` les sépare — ni la société, ni
    // le client (D10, RG-DRO-01). Le compte portail de démonstration est
    // restreint au premier.
    sites: [
      {
        id: "0192f0a0-4000-7000-8000-000000000001",
        agence_code: "DUCOS",
        libelle: "Atelier principal (démonstration)",
        commune: "Nouméa",
        zone_geo: "grand_noumea",
        latitude: -22.2758,
        longitude: 166.4572,
        consignes_acces:
          "Badge visiteur à l'accueil. EPI obligatoires : casque, chaussures de sécurité.",
        // Lundi au vendredi, 7 h – 11 h 30 puis 13 h – 16 h. La coupure de midi
        // est deux plages, comme dans `calendrier_plage` : un jour sans plage
        // est un jour fermé, il n'y a pas de booléen qui pourrait les contredire.
        horaires: [1, 2, 3, 4, 5].flatMap((jour) => [
          { jour_semaine: jour, debut_minutes: 420, fin_minutes: 690 },
          { jour_semaine: jour, debut_minutes: 780, fin_minutes: 960 },
        ]),
        temps_trajet_min: 25,
        actif: true,
      },
      {
        id: "0192f0a0-4000-7000-8000-000000000002",
        // Rattaché à KONÉ et non à Ducos : deux sites du MÊME client dépendant
        // d'agences différentes, ce qui est le cas réel et ce qui rend le
        // rattachement lisible dans la démonstration.
        agence_code: "KONE",
        libelle: "Dépôt de brousse (démonstration)",
        commune: "Bourail",
        zone_geo: "cote_ouest",
        latitude: -21.5686,
        longitude: 165.4936,
        consignes_acces: null,
        // Horaires NON renseignés — `null`, et non une liste vide. Les deux ne
        // disent pas la même chose : `null` = « on ne sait pas », liste vide =
        // « aucune ouverture ». Le premier ne doit produire aucun avertissement
        // (I7), le second en produit un.
        horaires: null,
        // Temps de trajet ABSENT à dessein : c'est la branche où l'estimation
        // par zone s'applique comme DÉFAUT (D23, RG-PLA-05). Une démonstration
        // où tous les sites en portent un n'éprouverait jamais cette branche.
        temps_trajet_min: null,
        actif: true,
      },
    ],
  },
  {
    id: "0192f0a0-1000-7000-8000-000000000002",
    code_externe: null,
    raison_sociale: "Garage du Nord (démonstration, sans code externe)",
    ridet: null,
    categorie: "Automobile",
    adresse_facturation: null,
    conditions_reglement: null,
    commercial_referent: null,
    actif: true,
    // Le site d'un AUTRE client de la même société : c'est lui que le filtre
    // `app.client_id` doit masquer au compte portail du premier client.
    sites: [
      {
        id: "0192f0a0-4000-7000-8000-000000000003",
        agence_code: "KONE",
        libelle: "Garage de Koné (démonstration)",
        commune: "Koné",
        zone_geo: "nord",
        latitude: -21.0594,
        longitude: 164.8619,
        consignes_acces: null,
        horaires: null,
        temps_trajet_min: 180,
        actif: true,
      },
    ],
  },
  {
    id: "0192f0a0-1000-7000-8000-000000000003",
    code_externe: "DEMO-003",
    raison_sociale: "Ancien client (démonstration, inactif)",
    ridet: null,
    categorie: null,
    adresse_facturation: null,
    conditions_reglement: null,
    commercial_referent: null,
    actif: false,
    // Un client inactif garde ses sites : `actif` dit qu'on ne travaille plus
    // pour lui, jamais que ses lieux n'ont pas existé. Le site l'est aussi, ce
    // qui donne au filtre `actifs_seulement` de la recherche une ligne à
    // écarter.
    sites: [
      {
        id: "0192f0a0-4000-7000-8000-000000000004",
        agence_code: "DOLBEAU",
        libelle: "Ancien chantier (démonstration, inactif)",
        commune: "Poindimié",
        zone_geo: "cote_est",
        latitude: null,
        longitude: null,
        consignes_acces: null,
        horaires: null,
        temps_trajet_min: null,
        actif: false,
      },
    ],
  },
];

/**
 * Clients de démonstration de CODIMA-EU.
 *
 * Le premier porte le MÊME code externe que celui de CODIMA-NC, et c'est le
 * point : l'unicité est `(societe_id, code_externe)` et jamais le code seul.
 * Deux sociétés vendues séparément ont chacune son ERP (RG-SOC-04) ; un seed
 * qui ne le montrerait pas laisserait passer une unicité globale sans que rien
 * ne rougisse.
 */
const CLIENTS_EU: ClientSeed[] = [
  {
    id: "0192f0a0-1000-7000-8000-000000000011",
    code_externe: "DEMO-001",
    raison_sociale: "Client européen (démonstration)",
    ridet: null,
    categorie: null,
    adresse_facturation: { rue: "1 rue de la Démonstration", commune: "Lyon" },
    conditions_reglement: null,
    commercial_referent: null,
    actif: true,
    // **Le site européen porte `zone_geo: null`, et c'est la démonstration en
    // acte de l'arbitrage ouvert par L1-02.** Les six zones de D23 —
    // `grand_noumea`, `cote_est`… — sont la géographie de la
    // Nouvelle-Calédonie ; aucune ne décrit Lyon. Si l'énumération avait été
    // fermée en base, cette ligne aurait obligé soit à inventer une zone, soit
    // à migrer la contrainte le jour du premier client hors territoire. Elle
    // est la raison pour laquelle la liste est tenue à l'entrée serveur.
    sites: [
      {
        id: "0192f0a0-4000-7000-8000-000000000011",
        agence_code: "SIEGE",
        libelle: "Site de Lyon (démonstration)",
        commune: "Lyon",
        zone_geo: null,
        latitude: 45.764,
        longitude: 4.8357,
        consignes_acces: null,
        horaires: null,
        temps_trajet_min: 40,
        actif: true,
      },
      {
        id: "0192f0a0-4000-7000-8000-000000000012",
        agence_code: "SIEGE",
        libelle: "Atelier de Villeurbanne (démonstration)",
        commune: "Villeurbanne",
        zone_geo: null,
        latitude: 45.7719,
        longitude: 4.8902,
        consignes_acces: null,
        horaires: null,
        temps_trajet_min: 25,
        actif: true,
      },
    ],
  },
  {
    // **La seconde société reçoit SON PROPRE PLANNING GARNI** *(décision
    // d'exploitation du 10/09/2026)*. Elle portait un client et un site, et
    // ZÉRO intervention : le multi-société ne se démontrait donc pas — un
    // acheteur voyait un planning vivant et un écran vide. *Un écran vide ne
    // vend rien.* Ce qui manquait n'était pas la donnée mais de quoi
    // l'accrocher : deux clients, trois sites, et des identifiants propres.
    id: "0192f0a0-1000-7000-8000-000000000012",
    code_externe: "DEMO-002",
    raison_sociale: "Manufacture de Saint-Étienne (démonstration)",
    ridet: null,
    categorie: null,
    adresse_facturation: {
      rue: "12 rue des Aciéries",
      commune: "Saint-Étienne",
    },
    conditions_reglement: null,
    commercial_referent: null,
    actif: true,
    sites: [
      {
        id: "0192f0a0-4000-7000-8000-000000000013",
        agence_code: "SIEGE",
        libelle: "Usine de Saint-Étienne (démonstration)",
        commune: "Saint-Étienne",
        zone_geo: null,
        latitude: 45.4397,
        longitude: 4.3872,
        consignes_acces: null,
        horaires: null,
        temps_trajet_min: 65,
        actif: true,
      },
    ],
  },
];

const CODIMA_NC: SocieteSeed = {
  id: "0192f0a0-0000-7000-8000-000000000001",
  code: "CODIMA-NC",
  raison_sociale: "CODIMA Nouvelle-Calédonie",
  pays: "Nouvelle-Calédonie",
  territoire: "Province Sud",
  fuseau_horaire: "Pacific/Noumea",
  devise_code: "XPF",
  majoration_hors_ouverture_pct: "50",
  couleur_primaire: "#0b5cad",
  couleur_secondaire: "#f4a300",
  // CODIMA nomme son ERP : c'est le cas que D29 avait en tête.
  libelle_code_externe: "Code Winpro",
  langue: "fr",
  agences: [
    {
      code: "DUCOS",
      libelle: "Ducos",
      adresse: { rue: "Zone industrielle de Ducos", commune: "Nouméa" },
      territoire: TERRITOIRE_NOUVELLE_CALEDONIE,
      calendrier_code: "DEMO-NOUMEA",
      ecarts: [],
    },
    {
      code: "KONE",
      libelle: "Koné",
      adresse: { rue: "Zone VKP", commune: "Koné" },
      territoire: TERRITOIRE_NOUVELLE_CALEDONIE,
      calendrier_code: "DEMO-KONE",
      ecarts: [],
    },
    {
      // Dolbeau partage le calendrier de Ducos — deux agences de Nouméa, un
      // seul calendrier (D13) — et s'en écarte pourtant sur un pont. C'est
      // exactement pourquoi l'écart local porte `agence_id` et non
      // `calendrier_id` (D46, complément 2).
      code: "DOLBEAU",
      libelle: "Dolbeau",
      adresse: { rue: "Rue de Dolbeau", commune: "Nouméa" },
      territoire: TERRITOIRE_NOUVELLE_CALEDONIE,
      calendrier_code: "DEMO-NOUMEA",
      ecarts: [PONT_DE_DEMONSTRATION],
    },
  ],
  calendriers: CALENDRIERS_NC,
  clients: CLIENTS_NC,
};

/** Seconde société, en EUR : démontre le multi-société et le multi-devise. */
const CODIMA_EU: SocieteSeed = {
  id: "0192f0a0-0000-7000-8000-000000000002",
  code: "CODIMA-EU",
  raison_sociale: "CODIMA Europe",
  pays: "France",
  territoire: "Métropole",
  fuseau_horaire: "Europe/Paris",
  devise_code: "EUR",
  majoration_hors_ouverture_pct: "50",
  couleur_primaire: "#7a1f3d",
  couleur_secondaire: "#2f9e6b",
  // AUCUN libellé, et c'est délibéré : « société qui n'a pas nommé son ERP »
  // doit être un état représenté, sinon le libellé générique n'est jamais
  // affiché nulle part et sa branche n'est jamais empruntée.
  libelle_code_externe: null,
  langue: "fr",
  agences: [
    {
      code: "SIEGE",
      libelle: "Siège",
      adresse: { rue: "1 rue de la République", commune: "Lyon" },
      territoire: TERRITOIRE_FRANCE_METROPOLE,
      calendrier_code: "DEMO-SIEGE",
      // Le lundi de Pentecôte est TRAVAILLÉ : journée de solidarité, pratique
      // courante en métropole, et surtout la démonstration de RG-PLA-02 — « un
      // férié n'est pas systématiquement chômé ». Sans une ligne comme
      // celle-ci, le booléen `travaille` ne serait jamais éprouvé sur des
      // données réelles.
      ecarts: [
        {
          ferie_libelle: "Lundi de Pentecôte",
          travaille: true,
          motif: "Journée de solidarité",
        },
      ],
    },
  ],
  calendriers: CALENDRIERS_EU,
  clients: CLIENTS_EU,
};

export const SOCIETES: readonly SocieteSeed[] = [CODIMA_NC, CODIMA_EU];

/** Résout une société du jeu de démonstration par son code naturel. */
export function societeParCode(code: string): SocieteSeed {
  const societe = SOCIETES.find((s) => s.code === code);
  if (societe === undefined) {
    throw new Error(`Société inconnue dans le jeu de démonstration : ${code}`);
  }
  return societe;
}

/**
 * Utilisateurs internes. Le premier est habilité sur les deux sociétés :
 * il illustre concrètement l'habilitation multi-société portée par
 * `utilisateur_societe` (chapitre 11 §11.2).
 */
export const UTILISATEURS_INTERNES: readonly UtilisateurInterneSeed[] = [
  {
    nom: "Direction de démonstration",
    email: "direction@codima.test",
    habilitations: [
      { societe_code: "CODIMA-NC", role: Role.direction },
      { societe_code: "CODIMA-EU", role: Role.direction },
    ],
  },
  {
    nom: "ADV de démonstration",
    email: "adv@codima.test",
    habilitations: [{ societe_code: "CODIMA-NC", role: Role.adv }],
  },
  // ── LES QUATRE TECHNICIENS DE LA MAQUETTE (R2-12) ────────────────────────
  //
  // **Leurs noms ne sont pas inventés : ils sont écrits dans
  // `docs/maquette/CODIPLAN_Maquette.html`**, qui fait foi depuis D95, et la
  // maquette dit elle-même pourquoi ils sont quatre — *« Effectif réel : 1
  // technicien. La maquette illustre le fonctionnement à l'effectif cible de
  // 3 techniciens plus l'atelier SAV. »* C'est l'effectif CIBLE de l'annexe E,
  // et c'est ce qu'une démonstration doit montrer.
  //
  // **Pourquoi le semis en a besoin, et ce n'est pas pour flatter un écran.**
  // Un planning dont toutes les lignes disent « non affectées » ne démontre
  // rien — ni le multi-société, ni la charge, ni les calendriers distincts de
  // RG-PLA-01. *Le défaut est antérieur à l'écran : il vise la raison d'être
  // du jeu de démonstration.*
  //
  // **Leur rattachement d'agence n'est PAS une colonne**, parce qu'aucune ne
  // l'est : la table `technicien` du chapitre 11 n'existe pas (§6, marque
  // `(prévu)`). Il se lit par leurs interventions, et le commentaire qui suit
  // chaque nom dit à quelle agence la démonstration les rattache — c'est une
  // note de lecture, jamais une donnée.
  {
    // Ducos · compresseurs, ponts
    nom: "D. Guérin",
    email: "guerin@codima.test",
    habilitations: [{ societe_code: "CODIMA-NC", role: Role.technicien }],
  },
  {
    // Dolbeau · pneumatique, clim
    nom: "T. Wamytan",
    email: "wamytan@codima.test",
    habilitations: [{ societe_code: "CODIMA-NC", role: Role.technicien }],
  },
  {
    // Koné · généraliste Nord
    nom: "M. Poigoune",
    email: "poigoune@codima.test",
    habilitations: [{ societe_code: "CODIMA-NC", role: Role.technicien }],
  },
  {
    // Ducos · électroportatif, SAV
    nom: "J. Lefèvre",
    email: "lefevre@codima.test",
    habilitations: [{ societe_code: "CODIMA-NC", role: Role.technicien }],
  },
  {
    nom: "Technicien de démonstration (Lyon)",
    email: "technicien.eu@codima.test",
    habilitations: [{ societe_code: "CODIMA-EU", role: Role.technicien }],
  },
  {
    nom: "Atelier de démonstration (Lyon)",
    email: "atelier.eu@codima.test",
    habilitations: [{ societe_code: "CODIMA-EU", role: Role.technicien }],
  },
];

/**
 * Compte portail rattaché à un client de la société XPF (D10).
 * `client_id` est une référence logique déterministe : la table `client`
 * est métier et n'existe qu'au lot 1. `perimetre_sites` vide = tous les sites.
 * Ce compte n'a volontairement aucune entrée dans `utilisateur_societe`.
 */
export const COMPTES_PORTAIL: readonly ComptePortailSeed[] = [
  {
    nom: "Contact portail de démonstration",
    email: "portail@example.test",
    societe_code: "CODIMA-NC",
    client_id: "0192f0a0-1000-7000-8000-000000000001",
    // **Périmètre RESTREINT à un seul des deux sites du client, depuis L1-02.**
    // Il était vide — « tous les sites » —, ce qui rendait la branche la plus
    // intéressante de D10 indémontrable : un périmètre vide ne prouve pas que
    // le filtre morde. Le compte portail de démonstration voit donc l'atelier
    // principal et NON le dépôt de brousse, alors que les deux appartiennent au
    // même client et à la même société. C'est très exactement ce que ni le
    // filtre société ni le filtre client ne savent faire.
    perimetre_sites: ["0192f0a0-4000-7000-8000-000000000001"],
  },
];

/**
 * Parité légale fixe du franc Pacifique (D20). Le franc CFP est arrimé à l'euro
 * depuis son introduction : 1 EUR = 119,331740 XPF. Le taux est porté par la
 * ligne XPF et se lit « XPF pour 1 EUR » — la base de consolidation est l'euro
 * (convention arrêtée pour la ligne fixe, voir docs/decisions). `date_effet` est
 * la date d'effet de la parité légale (introduction de l'euro), jamais implicite.
 */
export const PARITES: readonly PariteSeed[] = [
  {
    devise_code: "XPF",
    date_effet: "1999-01-01",
    taux: "119.331740",
    source: "parité légale fixe",
  },
];

/**
 * L'AMORÇAGE DES HABILITATIONS (D60, ticket L1-04).
 *
 * **Ce n'est pas un référentiel de plateforme, c'est un point de départ.**
 * `habilitation` est une table métier cloisonnée : chaque société possède sa
 * liste et peut la compléter ou la réduire. Celle-ci lui est posée à l'ouverture
 * — aujourd'hui par le seed, demain par le provisionnement du lot 7 — pour
 * qu'aucune société ne parte d'une page blanche.
 *
 * **TROIS FAMILLES, parce que CODIMA en suit trois** (décision d'exploitation du
 * 08/09/2026) : les habilitations électriques, les CACES et engins, et le
 * travail en hauteur. L'amorçage n'en couvrait qu'une et demie ; une liste
 * amorcée sur l'électrique seul se lit comme un catalogue complet, et personne
 * ne s'aperçoit que deux tiers du métier manquent.
 *
 * **Les codes et les libellés sont des FAITS** — symboles de la norme NF C
 * 18-510, catégories des recommandations R489, R482, R484, R486 et R408 de la
 * CNAM. Ils ne sont pas inventés, et c'est ce qui les distingue du reste du jeu
 * de démonstration. **Une seule entrée n'est pas réglementaire**, le port du
 * harnais, et son libellé le DIT : c'est l'illustration en acte de D60.
 *
 * **Les DURÉES DE VALIDITÉ, elles, sont laissées NULLES, et c'est une
 * décision.** La périodicité de recyclage est une pratique d'entreprise, pas une
 * obligation chiffrée par la norme : l'écrire ici reviendrait à inventer une
 * valeur métier que personne n'a arbitrée (CLAUDE.md §8 — « un montant, un taux,
 * un délai non spécifié : ne jamais inventer de valeur par défaut »). `NULL` se
 * lit « n'expire pas », ce qui ne bloque personne à tort ; la vraie périodicité
 * se saisit au paramétrage, et la question est au registre.
 *
 * **Aucun identifiant fixe ici, à l'inverse des clients et des sites.** Ces
 * lignes existent une fois PAR SOCIÉTÉ : un identifiant fixe les ferait entrer
 * en collision. L'idempotence vient de la clé unique `(societe_id, code)`, qui
 * donne exactement la même propriété — rejouer le seed corrige un libellé au
 * lieu de créer une seconde habilitation.
 */
/**
 * Les trois FAMILLES que CODIMA suit réellement (décision d'exploitation du
 * 08/09/2026, ticket L1-04b).
 *
 * **La famille n'est PAS une colonne de `habilitation`, et c'est délibéré.**
 * Elle organise l'AMORÇAGE, pas la table : une société qui ajoutera « formé sur
 * telle presse » n'aura aucune famille à choisir, et D60 dit très exactement
 * cela — *une société suit aussi des qualifications qu'aucune nomenclature ne
 * connaît.* La poser en base ferait de l'ajout d'une famille une migration, ce
 * qui est le raisonnement des zones pris à l'envers.
 *
 * Ce qu'elle permet, en revanche, c'est un gardien : les trois familles doivent
 * être PEUPLÉES. Une liste amorcée sur l'électrique seul se lirait comme un
 * catalogue complet, et personne ne s'apercevrait que deux tiers du métier
 * manquent — un décompte non nul ressemble beaucoup trop à des données justes
 * (§9, 21/08).
 */
export type FamilleHabilitation = "electrique" | "caces_engins" | "hauteur";

export const FAMILLES_HABILITATION: readonly FamilleHabilitation[] = [
  "electrique",
  "caces_engins",
  "hauteur",
];

export type HabilitationAmorcageSeed = {
  readonly code: string;
  readonly libelle: string;
  readonly famille: FamilleHabilitation;
};

export const HABILITATIONS_AMORCAGE: readonly HabilitationAmorcageSeed[] = [
  // ── ÉLECTRIQUE — symboles de la norme NF C 18-510 ────────────────────────
  {
    code: "B0",
    famille: "electrique",
    libelle: "Exécutant non électricien — travaux d'ordre non électrique",
  },
  {
    code: "H0V",
    famille: "electrique",
    libelle: "Non électricien au voisinage renforcé — haute tension",
  },
  {
    code: "BS",
    famille: "electrique",
    libelle: "Chargé d'intervention élémentaire — basse tension",
  },
  {
    code: "BE-MANOEUVRE",
    famille: "electrique",
    libelle: "Chargé d'opérations spécifiques — manœuvre, basse tension",
  },
  {
    code: "B1V",
    famille: "electrique",
    libelle: "Exécutant électricien — travaux au voisinage, basse tension",
  },
  {
    code: "B2V",
    famille: "electrique",
    libelle: "Chargé de travaux au voisinage — basse tension",
  },
  {
    code: "BR",
    famille: "electrique",
    libelle: "Chargé d'intervention générale — basse tension",
  },
  {
    code: "BC",
    famille: "electrique",
    libelle: "Chargé de consignation — basse tension",
  },
  {
    code: "HC",
    famille: "electrique",
    libelle: "Chargé de consignation — haute tension",
  },

  // ── CACES ET ENGINS — recommandations R489, R482, R484 de la CNAM ────────
  {
    code: "R489-1B",
    famille: "caces_engins",
    libelle: "Gerbeur à conducteur porté (CACES R489 cat. 1B)",
  },
  {
    code: "R489-3",
    famille: "caces_engins",
    libelle: "Chariot élévateur frontal en porte-à-faux (CACES R489 cat. 3)",
  },
  {
    code: "R489-5",
    famille: "caces_engins",
    libelle: "Chariot élévateur à mât rétractable (CACES R489 cat. 5)",
  },
  {
    code: "R482-A",
    famille: "caces_engins",
    libelle: "Engin de chantier compact (CACES R482 cat. A)",
  },
  {
    code: "R484-1",
    famille: "caces_engins",
    libelle: "Pont roulant et portique à commande au sol (CACES R484 cat. 1)",
  },

  // ── TRAVAIL EN HAUTEUR — recommandations R486 et R408 ────────────────────
  {
    code: "R486-A",
    famille: "hauteur",
    libelle: "PEMP du groupe A — élévation verticale (CACES R486 cat. A)",
  },
  {
    code: "R486-B",
    famille: "hauteur",
    libelle:
      "PEMP du groupe B — élévation multidirectionnelle (CACES R486 cat. B)",
  },
  {
    code: "R408",
    famille: "hauteur",
    libelle: "Montage, démontage et vérification d'échafaudage de pied (R408)",
  },
  {
    // LA SEULE ENTRÉE NON RÉGLEMENTAIRE, et elle est là pour ce qu'elle
    // ILLUSTRE autant que pour ce qu'elle sert : D60 dit qu'une société suit
    // des qualifications qu'aucune nomenclature ne chiffre. Le port du harnais
    // en est une — il relève de la formation d'entreprise, et son libellé le
    // dit plutôt que de se donner l'allure d'un code officiel.
    code: "HARNAIS",
    famille: "hauteur",
    libelle:
      "Port du harnais et systèmes d'arrêt de chute — formation d'entreprise, hors nomenclature",
  },
];

/**
 * LES INTERVENTIONS DE DÉMONSTRATION (lot 2, D84).
 *
 * **Ce sont des données de DÉMONSTRATION, dites comme telles**, et elles
 * disparaissent avec `scripts/purge-demonstration.mts` comme les clients et les
 * sites. Un planning vide ne démontre rien : il ne dit pas si les couleurs de
 * statut se lisent, si la file d'attente se distingue des lignes posées, ni si
 * le calcul de RG-TAR-05 s'affiche.
 *
 * **Les six couvrent ce qu'un écran doit savoir montrer** : une ligne sans date
 * — la file d'attente de l'annexe D —, des lignes posées à des statuts
 * différents, une clôturée qui porte un temps réel, et une annulée qui reste
 * visible. *Une annulation n'efface rien.*
 *
 * **Aucun montant n'est écrit ici.** Le total hors taxes est CALCULÉ à la
 * clôture, au taux en vigueur à la date de l'intervention (RG-TAR-04) ; l'écrire
 * dans le seed poserait un chiffre que personne n'a décidé, et il divergerait du
 * calcul au premier changement de tarif.
 *
 * ── LES IDENTIFIANTS ÉTAIENT FIXES, ET LA SECONDE SOCIÉTÉ N'EN RECEVAIT AUCUNE
 *
 * **Mesuré le 09/09/2026, réparé le 10 :** `INTERVENTIONS_DEMONSTRATION` portait
 * six `id` en dur. La première société les prenait ; la seconde trouvait chaque
 * ligne déjà écrite et s'abstenait — *« CODIMA-EU — interventions de
 * démonstration : 0 écrite(s) sur 6 prévue(s) »*. Le multi-société était donc
 * indémontrable par la démonstration elle-même : un acheteur voyait un planning
 * vivant et un écran vide, et **un écran vide ne vend rien**.
 *
 * L'identifiant est désormais DÉRIVÉ du rang de l'intervention et de celui de sa
 * société — `identifiantIntervention` ci-dessous. Il reste **déterministe**,
 * donc le seed reste idempotent ; il cesse d'être **unique au monde**, ce qu'il
 * n'avait aucune raison d'être. C'est la faute du §9 (20/08) sous une autre
 * forme : une clé fabriquée pour un cas, reconduite quand le second est arrivé.
 *
 * **Les dates sont en UTC**, jamais construites par un `Date` local : UTC+11
 * décale le jour d'un cran, et une intervention du 1er se rangerait au 31.
 */
export type InterventionDemoSeed = {
  readonly rang: number;
  readonly type: TypeIntervention;
  readonly priorite: PrioriteIntervention;
  readonly statut: StatutIntervention;
  /**
   * Jours depuis le LUNDI de la semaine courante. Négatif = la semaine passée,
   * `null` = aucune date, c'est-à-dire la file d'attente.
   */
  readonly joursDepuisLundi: number | null;
  /** Début du créneau, en minutes locales depuis minuit. `null` = date sans heure. */
  readonly debutMinutes: number | null;
  readonly dureeMin: number | null;
  readonly temps_reel_min: number | null;
  /**
   * LA SUSPENSION (L2-10, RG-INT-06). Obligatoire dès que `statut` vaut
   * `suspendue` — la base le refuse autrement, et elle a raison : *une
   * intervention arrêtée sans qu'on sache pourquoi est une intervention
   * perdue.*
   */
  readonly motifSuspension?: string;
  /**
   * L'ATTENTE DE PIÈCE, et les deux vont ENSEMBLE. La date est donnée en jours
   * depuis le lundi courant, comme le créneau : *une date écrite en dur
   * vieillirait avec la démonstration.*
   */
  readonly pieceAttendueRef?: string;
  readonly pieceDispoJoursDepuisLundi?: number;
};

/**
 * Les interventions de démonstration (R2-12).
 *
 * ## LES DATES SONT RELATIVES, ET C'EST LA LEÇON DES JOURS FÉRIÉS
 *
 * Elles étaient ABSOLUES — du 2 au 14 septembre 2026 —, et une démonstration
 * datée se périme sans jamais être vide : le planning s'ouvre sur la semaine
 * courante, et six interventions figées dans le passé lui laissent des colonnes
 * blanches. *C'est très exactement le §9 du 21/08 sur les fériés — « une donnée
 * datée se périme en silence » —, appliqué au jeu de démonstration au lieu du
 * référentiel.* Elles sont donc posées par rapport au LUNDI DE LA SEMAINE
 * COURANTE, lu dans le fuseau de la société.
 *
 * **Le passé reste au passé.** Les interventions terminales — clôturée,
 * annulée, terminée — sont placées la semaine d'avant : c'est ce qu'un planning
 * réel montre, et c'est aussi ce que le verrou de cycle de vie impose, une
 * ligne close ne se réécrivant plus (D84). Les vivantes sont sur la semaine
 * courante, et le semis les y RAMÈNE à chaque exécution.
 *
 * ## POURQUOI SEIZE, ET PAS SIX
 *
 * *« La démonstration doit présenter un planning GARNI, pas vide, parce que
 * c'est ce qui montre le multi-société à un acheteur »* (décision
 * d'exploitation du 09/09/2026, rappelée le 11/09). Six lignes réparties sur
 * deux semaines et quatre techniciens laissaient une grille presque blanche —
 * mesuré : **2 blocs visibles** sur la semaine affichée. Seize en donnent assez
 * pour que les cinq couleurs de statut, les deux agences aux calendriers
 * distincts et la file d'attente se lisent toutes sur un seul écran.
 *
 * **Le technicien n'est PAS écrit ici**, et c'est délibéré : il est déduit de
 * l'AGENCE du site, par `TECHNICIENS_PAR_AGENCE`. L'écrire ligne à ligne
 * ferait deux lectures d'un même rattachement, et la première erreur de frappe
 * mettrait le technicien de Koné sur un chantier de Ducos sans que rien ne le
 * dise (§9, 01/09).
 */
export const INTERVENTIONS_DEMONSTRATION: readonly InterventionDemoSeed[] = [
  // ── La FILE D'ATTENTE — sans date, sans technicien ────────────────────────
  {
    rang: 1,
    type: "curatif",
    priorite: "p1",
    statut: "a_planifier",
    joursDepuisLundi: null,
    debutMinutes: null,
    dureeMin: 120,
    temps_reel_min: null,
  },
  // ── La SEMAINE PASSÉE — ce qui est fait, et qui ne se réécrit plus ────────
  {
    rang: 6,
    type: "garantie",
    priorite: "p3",
    statut: "annulee",
    joursDepuisLundi: -5,
    debutMinutes: 450,
    dureeMin: 60,
    temps_reel_min: null,
  },
  {
    rang: 5,
    type: "controle_reglementaire",
    priorite: "p3",
    statut: "cloturee",
    joursDepuisLundi: -3,
    debutMinutes: 480,
    dureeMin: 90,
    // Douze minutes : c'est le cas de D83 mis sous les yeux — arrondi à un
    // quart d'heure, puis relevé au plancher d'une heure.
    temps_reel_min: 12,
  },
  {
    rang: 4,
    type: "curatif",
    priorite: "p4",
    statut: "terminee",
    joursDepuisLundi: -2,
    debutMinutes: 810,
    dureeMin: 120,
    temps_reel_min: 95,
  },
  // ── LA SEMAINE COURANTE — lundi ───────────────────────────────────────────
  {
    rang: 2,
    type: "preventif_contrat",
    priorite: "p3",
    statut: "planifiee",
    joursDepuisLundi: 0,
    debutMinutes: 450,
    dureeMin: 120,
    temps_reel_min: null,
  },
  {
    rang: 7,
    type: "preventif_contrat",
    priorite: "p4",
    statut: "planifiee",
    joursDepuisLundi: 0,
    debutMinutes: 810,
    dureeMin: 90,
    temps_reel_min: null,
  },
  {
    rang: 8,
    type: "installation",
    priorite: "p2",
    statut: "envoyee",
    joursDepuisLundi: 0,
    debutMinutes: 540,
    dureeMin: 180,
    temps_reel_min: null,
  },
  // ── mardi ─────────────────────────────────────────────────────────────────
  {
    rang: 9,
    type: "curatif",
    priorite: "p1",
    statut: "en_cours",
    joursDepuisLundi: 1,
    debutMinutes: 450,
    dureeMin: 150,
    temps_reel_min: null,
  },
  {
    rang: 10,
    type: "preventif_contrat",
    priorite: "p3",
    statut: "planifiee",
    joursDepuisLundi: 1,
    debutMinutes: 780,
    dureeMin: 120,
    temps_reel_min: null,
  },
  // ── mercredi ──────────────────────────────────────────────────────────────
  {
    rang: 3,
    type: "installation",
    priorite: "p2",
    statut: "en_cours",
    joursDepuisLundi: 2,
    debutMinutes: 450,
    dureeMin: 240,
    temps_reel_min: null,
  },
  {
    rang: 11,
    type: "curatif",
    priorite: "p2",
    statut: "suspendue",
    joursDepuisLundi: 2,
    debutMinutes: 840,
    dureeMin: 120,
    temps_reel_min: null,
    // LA DÉMONSTRATION MONTRE LA FILE « EN ATTENTE DE PIÈCE » (L2-10), et pas
    // seulement une intervention arrêtée : c'est le cas que RG-INT-06 vise, et
    // celui que l'alerte « depuis > 30 j » du chapitre 16.1 surveillera.
    motifSuspension: "Attente de pièce fournisseur",
    pieceAttendueRef: "CMP-4417-B",
    pieceDispoJoursDepuisLundi: 9,
  },
  // ── jeudi ─────────────────────────────────────────────────────────────────
  {
    rang: 12,
    type: "preventif_contrat",
    priorite: "p3",
    statut: "planifiee",
    joursDepuisLundi: 3,
    debutMinutes: 450,
    dureeMin: 120,
    temps_reel_min: null,
  },
  {
    rang: 13,
    type: "controle_reglementaire",
    priorite: "p3",
    statut: "planifiee",
    joursDepuisLundi: 3,
    debutMinutes: 780,
    dureeMin: 90,
    temps_reel_min: null,
  },
  // ── vendredi ──────────────────────────────────────────────────────────────
  {
    rang: 14,
    type: "curatif",
    priorite: "p2",
    statut: "planifiee",
    joursDepuisLundi: 4,
    debutMinutes: 510,
    dureeMin: 120,
    temps_reel_min: null,
  },
  {
    rang: 15,
    type: "garantie",
    priorite: "p4",
    statut: "planifiee",
    joursDepuisLundi: 4,
    debutMinutes: 870,
    dureeMin: 60,
    temps_reel_min: null,
  },
  // ── SAMEDI — Ducos ouvre, Koné non (RG-PLA-01). La ligne qui rend la
  //    hachure démontrable : elle n'existe que pour l'agence qui ouvre.
  {
    rang: 16,
    type: "curatif",
    priorite: "p1",
    statut: "planifiee",
    joursDepuisLundi: 5,
    debutMinutes: 450,
    dureeMin: 120,
    temps_reel_min: null,
  },
];

/**
 * QUELS TECHNICIENS SERVENT QUELLE AGENCE, dans la démonstration (R2-12).
 *
 * **C'est une note de démonstration, pas un modèle de données.** Le
 * rattachement d'un technicien à une agence n'a aucune colonne : la table
 * `technicien` du chapitre 11 n'existe pas, et le §6 la marque `(prévu)`.
 * Écrire ici « qui sert où » ne crée donc aucune donnée — cela dit seulement à
 * QUI le semis confie les interventions de chaque agence.
 *
 * Les rattachements sont ceux que la maquette écrit à côté de chaque nom :
 * Guérin et Lefèvre à Ducos, Wamytan à Dolbeau, Poigoune à Koné.
 *
 * **Une agence absente de cette table garde ses interventions NON AFFECTÉES**,
 * et c'est voulu : la ligne « non affectées » est un cas réel du produit — une
 * intervention arrive avant qu'on sache qui ira —, elle doit rester
 * démontrable. Le siège de CODIMA-EU en porte donc une part.
 */
export const TECHNICIENS_PAR_AGENCE: Readonly<
  Record<string, readonly string[]>
> = {
  DUCOS: ["guerin@codima.test", "lefevre@codima.test"],
  DOLBEAU: ["wamytan@codima.test"],
  KONE: ["poigoune@codima.test"],
  SIEGE: ["technicien.eu@codima.test", "atelier.eu@codima.test"],
};

/**
 * L'identifiant d'une intervention de démonstration, DÉRIVÉ et non écrit.
 *
 * `rangSociete` est la position de la société dans `SOCIETES`, à partir de 1 :
 * il ouvre à chacune une plage de cent identifiants qui ne peut pas rencontrer
 * celle de sa voisine. La forme suit la convention du jeu de démonstration —
 * `0192f0a0-6000-…` pour les interventions, comme `-1000-` pour les clients et
 * `-4000-` pour les sites.
 */
export function identifiantIntervention(
  rangSociete: number,
  rang: number,
): string {
  // `rangSociete - 1` est délibéré : la PREMIÈRE société retrouve exactement
  // les six identifiants historiques, si bien que la base hébergée ne se
  // retrouve pas avec douze lignes de démonstration — six anciennes orphelines
  // et six nouvelles. *Une réparation qui laisse derrière elle l'état qu'elle
  // corrige n'est réparée qu'à moitié.*
  const suffixe = String((rangSociete - 1) * 100 + rang).padStart(12, "0");
  return `0192f0a0-6000-7000-8000-${suffixe}`;
}
