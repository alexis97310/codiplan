import type { Role } from "@prisma/client";

/**
 * Jeu de données de démonstration (I9 — aucune donnée de production).
 *
 * Décrit de façon pure et déterministe ce que `prisma/seed.ts` écrit en base :
 * deux sociétés (l'une en XPF avec trois agences, l'autre en EUR) et au moins
 * un compte portail rattaché à un client (critère d'acceptation L0-03).
 *
 * Ce module ne dépend pas de la base : il est directement vérifiable par un
 * test unitaire. Les identifiants techniques (UUID v7, I10) sont attribués à
 * l'écriture par `seed.ts` ; les clés naturelles ci-dessous (code, email)
 * rendent le seed idempotent.
 */

export type AgenceSeed = {
  code: string;
  libelle: string;
  adresse: { rue: string; commune: string };
};

export type SocieteSeed = {
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
};

export type DeviseSeed = {
  code: string;
  libelle: string;
  decimales: number;
  symbole: string | null;
};

export type HabilitationSeed = { societe_code: string; role: Role };

export type UtilisateurInterneSeed = {
  email: string;
  habilitations: HabilitationSeed[];
};

export type ComptePortailSeed = {
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
 * Société XPF : CODIMA en Nouvelle-Calédonie, avec ses trois agences (D5).
 * Taux horaire 7 000 XPF (chapitre 11 §11.2), majoration hors ouverture +50 % (D12).
 */
const CODIMA_NC: SocieteSeed = {
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
    },
    {
      code: "KONE",
      libelle: "Koné",
      adresse: { rue: "Zone VKP", commune: "Koné" },
    },
    {
      code: "DOLBEAU",
      libelle: "Dolbeau",
      adresse: { rue: "Rue de Dolbeau", commune: "Nouméa" },
    },
  ],
};

/** Seconde société, en EUR : démontre le multi-société et le multi-devise. */
const CODIMA_EU: SocieteSeed = {
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
    },
  ],
};

export const SOCIETES: readonly SocieteSeed[] = [CODIMA_NC, CODIMA_EU];

/**
 * Utilisateurs internes. Le premier est habilité sur les deux sociétés :
 * il illustre concrètement l'habilitation multi-société portée par
 * `utilisateur_societe` (chapitre 11 §11.2).
 */
export const UTILISATEURS_INTERNES: readonly UtilisateurInterneSeed[] = [
  {
    email: "direction@codima.test",
    habilitations: [
      { societe_code: "CODIMA-NC", role: "direction" },
      { societe_code: "CODIMA-EU", role: "direction" },
    ],
  },
  {
    email: "adv@codima.test",
    habilitations: [{ societe_code: "CODIMA-NC", role: "adv" }],
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
