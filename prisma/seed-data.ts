import { Role } from "@/lib/auth/roles";
import { cleJour } from "@/lib/calendar/fuseau";
import { cleJourAdossePaques } from "@/lib/calendar/paques";
import { DIMANCHE, LUNDI, SAMEDI } from "@/lib/calendar/semaine";

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

export type AgenceSeed = {
  code: string;
  libelle: string;
  adresse: { rue: string; commune: string };
  /**
   * Code du calendrier d'ouverture rattaché (D5). Plusieurs agences peuvent
   * partager le même : c'est la forme que prend « héritage depuis la société
   * avec surcharge possible par agence » (D13).
   */
  calendrier_code: string;
};

/** Une plage d'ouverture hebdomadaire, sous sa forme LOCALE (jamais UTC). */
export type PlageSeed = {
  /** Jour ISO — 1 lundi, 7 dimanche. */
  jour_semaine: number;
  debut_minutes: number;
  fin_minutes: number;
};

export type CalendrierSeed = {
  code: string;
  libelle: string;
  /** Territoire dont les fériés s'appliquent — clé de `jour_ferie` (D46). */
  territoire: string;
  plages: readonly PlageSeed[];
  /**
   * Libellés des fériés que cette agence TRAVAILLE (D13, RG-PLA-02). Tout ce
   * qui n'y figure pas est chômé : la surcharge ne dit que l'exception.
   */
  feries_travailles: readonly string[];
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
  taux_horaire_defaut: string;
  majoration_hors_ouverture_pct: string;
  couleur_primaire: string;
  couleur_secondaire: string;
  langue: string;
  agences: AgenceSeed[];
  calendriers: CalendrierSeed[];
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
 * Territoires au sens des JOURS FÉRIÉS (D46).
 *
 * À ne pas confondre avec `societe.territoire`, qui porte une circonscription
 * administrative (« Province Sud », « Métropole ») : deux notions voisines, deux
 * usages sans rapport. Le territoire des fériés est la juridiction qui décide
 * des jours chômés ; c'est lui qui sert de clé à `jour_ferie`.
 */
export const TERRITOIRE_NOUVELLE_CALEDONIE = "NOUVELLE_CALEDONIE";
export const TERRITOIRE_FRANCE_METROPOLE = "FRANCE_METROPOLE";

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
 * Années amorcées par le seed. Trois ans suffisent à faire vivre le jeu de
 * démonstration ; l'alimentation des années suivantes est un travail
 * d'exploitation, pas de code — c'est précisément ce que « les fériés sont des
 * données » veut dire.
 */
export const ANNEES_FERIES: readonly number[] = [2026, 2027, 2028];

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

/** Toutes les lignes de `jour_ferie` du jeu de démonstration. */
export const JOURS_FERIES: readonly JourFerieSeed[] = Object.keys(FERIES_FIXES)
  .flatMap((territoire) =>
    ANNEES_FERIES.flatMap((annee) => feriesDuTerritoire(territoire, annee)),
  )
  .sort(
    (a, b) =>
      a.territoire.localeCompare(b.territoire) || a.date.localeCompare(b.date),
  );

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
    territoire: TERRITOIRE_NOUVELLE_CALEDONIE,
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
    feries_travailles: [],
  },
  {
    code: "DEMO-KONE",
    libelle: "Koné — horaires de démonstration",
    territoire: TERRITOIRE_NOUVELLE_CALEDONIE,
    plages: semaineDeDemonstration(
      LUNDI,
      SAMEDI - 1,
      [heureLocale(7, 30), heureLocale(11, 30)],
      [heureLocale(13), heureLocale(17)],
    ),
    feries_travailles: [],
  },
];

/**
 * Calendrier de démonstration de la société européenne.
 *
 * Il porte la seule surcharge de férié du jeu : le **lundi de Pentecôte est
 * travaillé**. C'est la journée de solidarité, pratique courante en métropole,
 * et c'est surtout la démonstration de RG-PLA-02 — « un férié n'est pas
 * systématiquement chômé ». Sans une ligne comme celle-ci, le booléen
 * `travaille` ne serait jamais éprouvé sur des données réelles.
 */
const CALENDRIERS_EU: CalendrierSeed[] = [
  {
    code: "DEMO-SIEGE",
    libelle: "Siège — horaires de démonstration",
    territoire: TERRITOIRE_FRANCE_METROPOLE,
    plages: semaineDeDemonstration(
      LUNDI,
      DIMANCHE - 2,
      [heureLocale(9), heureLocale(12, 30)],
      [heureLocale(14), heureLocale(18)],
    ),
    feries_travailles: ["Lundi de Pentecôte"],
  },
];

/**
 * Société XPF : CODIMA en Nouvelle-Calédonie, avec ses trois agences (D5).
 * Taux horaire 7 000 XPF (chapitre 11 §11.2), majoration hors ouverture +50 % (D12).
 */
const CODIMA_NC: SocieteSeed = {
  id: "0192f0a0-0000-7000-8000-000000000001",
  code: "CODIMA-NC",
  raison_sociale: "CODIMA Nouvelle-Calédonie",
  pays: "Nouvelle-Calédonie",
  territoire: "Province Sud",
  fuseau_horaire: "Pacific/Noumea",
  devise_code: "XPF",
  taux_horaire_defaut: "7000",
  majoration_hors_ouverture_pct: "50",
  couleur_primaire: "#0b5cad",
  couleur_secondaire: "#f4a300",
  langue: "fr",
  agences: [
    {
      code: "DUCOS",
      libelle: "Ducos",
      adresse: { rue: "Zone industrielle de Ducos", commune: "Nouméa" },
      calendrier_code: "DEMO-NOUMEA",
    },
    {
      code: "KONE",
      libelle: "Koné",
      adresse: { rue: "Zone VKP", commune: "Koné" },
      calendrier_code: "DEMO-KONE",
    },
    {
      // Dolbeau partage le calendrier de Ducos : deux agences de Nouméa, un
      // seul calendrier. C'est l'héritage de D13 dans sa forme la plus simple.
      code: "DOLBEAU",
      libelle: "Dolbeau",
      adresse: { rue: "Rue de Dolbeau", commune: "Nouméa" },
      calendrier_code: "DEMO-NOUMEA",
    },
  ],
  calendriers: CALENDRIERS_NC,
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
  taux_horaire_defaut: "65.00",
  majoration_hors_ouverture_pct: "50",
  couleur_primaire: "#0b5cad",
  couleur_secondaire: "#f4a300",
  langue: "fr",
  agences: [
    {
      code: "SIEGE",
      libelle: "Siège",
      adresse: { rue: "1 rue de la République", commune: "Lyon" },
      calendrier_code: "DEMO-SIEGE",
    },
  ],
  calendriers: CALENDRIERS_EU,
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
    perimetre_sites: [],
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
