import type { Role } from "@/lib/auth/roles";
import {
  anneeCourante,
  cleJour,
  jourSemaineIso,
  jourSuivant,
  lireCleJour,
  LUNDI,
  type JourLocal,
} from "@/lib/calendar";

/**
 * Données déterministes et briques SQL partagées par le harnais d'isolation
 * (ticket L0-05). Aucune donnée de production (I9) : deux sociétés fictives et
 * leurs objets, tous en identifiants fixes lisibles.
 *
 * Les tables `client`, `site`, `machine`, `modele_materiel` sont des FIXTURES
 * « contrat » : les vraies tables métier arrivent aux lots 1 et 2. Elles portent
 * exactement la même politique de cloisonnement que les tables réelles et
 * modèlent les chemins que L0-05 doit obligatoirement couvrir — résolution QR
 * inter-société (D22), accès portail à un autre client et respect du périmètre
 * de sites (D10). Quand les vraies tables seront livrées, elles devront honorer
 * ce même contrat, réutilisant les mêmes constructeurs de politique ci-dessous.
 */

/**
 * Rôle PostgreSQL non propriétaire, non-BYPASSRLS, sous lequel tournent les
 * scénarios. Ce n'est pas un rôle de test : c'est LE rôle applicatif, créé par
 * la migration `20260820130000_force_rls_role_applicatif`. Les scénarios
 * éprouvent donc les droits réellement accordés en production.
 */
export const ROLE_APP = "codiplan_app";

/**
 * Rôle PostgreSQL de consolidation (D21) — BYPASSRLS, SELECT seul, créé par la
 * migration `20260820150000_authentification_et_roles`. Éprouvé tel quel, comme
 * `codiplan_app` : les scénarios portent sur les droits réels, pas sur une
 * imitation.
 */
export const ROLE_REPORTING = "codiplan_reporting";

/** Variables de session lues par les politiques RLS. */
export const VAR_SOCIETE = "app.societe_id";
export const VAR_ROLE = "app.role";
export const VAR_CLIENT = "app.client_id";
export const VAR_PERIMETRE = "app.perimetre_sites";

/** Sociétés A et B — cloisonnées l'une de l'autre. UUID v7 bien formés. */
export const SOCIETE_A = "aaaaaaaa-0000-7000-8000-000000000001";
export const SOCIETE_B = "bbbbbbbb-0000-7000-8000-000000000002";

/** Clients (fixture). A1 et A2 appartiennent à la société A ; B1 à la société B. */
export const CLIENT_A1 = "aaaaaaaa-0000-7000-8000-0000000000c1";
export const CLIENT_A2 = "aaaaaaaa-0000-7000-8000-0000000000c2";
export const CLIENT_B1 = "bbbbbbbb-0000-7000-8000-0000000000c1";

/** Sites (fixture). Deux sites pour le client A1, un pour B1. */
export const SITE_A1_S1 = "aaaaaaaa-0000-7000-8000-00000000551a";
export const SITE_A1_S2 = "aaaaaaaa-0000-7000-8000-00000000551b";
export const SITE_B1_S1 = "bbbbbbbb-0000-7000-8000-00000000551a";

/** Machines (fixture) et leurs jetons QR (uniques globalement, D22). */
export const MACHINE_A1 = "aaaaaaaa-0000-7000-8000-0000000000a1";
export const MACHINE_A2 = "aaaaaaaa-0000-7000-8000-0000000000a2";
export const MACHINE_B1 = "bbbbbbbb-0000-7000-8000-0000000000b1";
export const QR_A1 = "qr-token-machine-a1";
export const QR_A2 = "qr-token-machine-a2";
export const QR_B1 = "qr-token-machine-b1";

/** Modèles matériel (fixture) — référentiel plateforme surchargeable (D4). */
export const MODELE_PLATEFORME = "00000000-0000-7000-8000-0000000000f0";
export const MODELE_SURCHARGE_A = "aaaaaaaa-0000-7000-8000-0000000000f1";
export const MODELE_SURCHARGE_B = "bbbbbbbb-0000-7000-8000-0000000000f2";

/** Agences (fixture d'isolation, distinctes du seed applicatif). */
export const AGENCE_A = "aaaaaaaa-0000-7000-8000-0000000000e1";
export const AGENCE_B = "bbbbbbbb-0000-7000-8000-0000000000e2";

/** Calendriers d'ouverture des deux agences (L0-08, D5, D13). */
export const CALENDRIER_A = "aaaaaaaa-0000-7000-8000-0000000000ca";
export const CALENDRIER_B = "bbbbbbbb-0000-7000-8000-0000000000cb";
export const PLAGE_A = "aaaaaaaa-0000-7000-8000-0000000000c5";
export const PLAGE_B = "bbbbbbbb-0000-7000-8000-0000000000c6";

/**
 * Fuseaux des deux sociétés fixtures.
 *
 * **L'agence B surcharge le sien pour valoir CELUI DE L'AGENCE A** (D5), alors
 * que leurs TERRITOIRES diffèrent. La fixture est délibérément adversaire :
 * deux agences qui partagent une heure et pas un calendrier de fêtes. Tout
 * code qui déduirait le territoire du fuseau — ou l'inverse — tomberait ici,
 * et non chez un client d'Alsace-Moselle deux ans plus tard (D46,
 * complément 1).
 */
export const FUSEAU_SOCIETE_A = "Pacific/Noumea";
export const FUSEAU_SOCIETE_B = "Europe/Paris";
export const FUSEAU_AGENCE_B = FUSEAU_SOCIETE_A;

/**
 * Territoires fictifs, en codes ISO 3166-1 alpha-2 **réservés à l'usage
 * privé** (`ZZ`, `XA`) : la norme garantit qu'aucun pays ne les portera jamais.
 * Un jeu de test ne doit désigner aucun territoire réel (I9), et la forme reste
 * celle que `jour_ferie` exige — deux lettres majuscules.
 */
export const TERRITOIRE_A = "ZZ";
export const TERRITOIRE_B = "XA";

/** Écarts locaux de l'agence A — un férié travaillé, et un pont. */
export const SURCHARGE_FERIE_A = "aaaaaaaa-0000-7000-8000-0000000000c7";
export const PONT_FIXTURE_A = "aaaaaaaa-0000-7000-8000-0000000000c8";

/**
 * Un compte par rôle canonique (L0-06). Les identifiants portent le rang du
 * rôle dans l'énumération, pour rester lisibles à la lecture d'un échec.
 *
 * Les six rôles internes — `admin_societe` compris depuis D37 — sont habilités
 * sur la société A. Les trois rôles
 * éditeur ne le sont sur AUCUNE société : c'est le principe du §22.5 — « un
 * salarié de l'éditeur n'a aucun accès par défaut aux données d'un client » —,
 * et c'est ce qui rend leur scénario négatif réel plutôt que théorique. Le rôle
 * `client` est rattaché au client A1 par `utilisateur_client` (D10).
 */
export const UTILISATEUR_PAR_ROLE: Readonly<Record<Role, string>> = {
  admin_plateforme: "00000000-0000-7000-8000-000000000701",
  editeur_commercial: "00000000-0000-7000-8000-000000000702",
  editeur_support: "00000000-0000-7000-8000-000000000703",
  admin_societe: "aaaaaaaa-0000-7000-8000-00000000070a",
  direction: "aaaaaaaa-0000-7000-8000-000000000704",
  responsable_materiel: "aaaaaaaa-0000-7000-8000-000000000705",
  responsable_sav: "aaaaaaaa-0000-7000-8000-000000000706",
  adv: "aaaaaaaa-0000-7000-8000-000000000707",
  technicien: "aaaaaaaa-0000-7000-8000-000000000708",
  client: "aaaaaaaa-0000-7000-8000-000000000709",
};

/** Comptes portail (table réelle `utilisateur_client`). */
export const UTILISATEUR_PORTAIL_A = "aaaaaaaa-0000-7000-8000-0000000000d1";
export const UTILISATEUR_PORTAIL_B = "bbbbbbbb-0000-7000-8000-0000000000d2";
export const PORTAIL_A_CLIENT = "aaaaaaaa-0000-7000-8000-0000000000d3";
export const PORTAIL_B_CLIENT = "bbbbbbbb-0000-7000-8000-0000000000d4";

/**
 * Politique de cloisonnement société, forme imposée (D4) — `::uuid` compris —,
 * rendue « zéro ligne hors contexte » (voir la migration
 * `20260820140000_identifiants_uuid`). Réutilisée à l'identique par les tables
 * fixtures pour que le contrat testé soit le contrat réel. `FORCE` est posé
 * comme sur les vraies tables cloisonnées.
 */
export function politiqueCloisonnementSql(table: string): string {
  const propre = `"societe_id" = NULLIF(current_setting('${VAR_SOCIETE}', true), '')::uuid`;
  const plateforme = `"societe_id" IS NULL`;
  // Lecture : sa propre société, plus les référentiels de plateforme (D4).
  const lecture = `${propre} OR ${plateforme}`;
  // Écriture : sa propre société ; une ligne de plateforme n'est modifiable que
  // par un rôle éditeur (I1). C'est la règle que la migration
  // `20260820150000_authentification_et_roles` pose sur `devise` et `parite` ;
  // les fixtures l'honorent à l'identique, sans quoi le contrat éprouvé ici ne
  // serait pas celui des vraies tables.
  const ecriture = `${propre} OR (${plateforme} AND "app_est_role_editeur"())`;
  return `
    ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "cloisonnement_societe" ON "${table}"
      USING (${lecture}) WITH CHECK (${ecriture});
  `;
}

/**
 * Politique du parc pour un compte portail (D10, D22). Superpose au filtre
 * société :
 *   - `app.client_id` positionné (compte portail) ⇒ un seul client visible ;
 *     absent (utilisateur interne) ⇒ tout le parc de la société ;
 *   - `app.perimetre_sites` (liste d'UUID séparés par des virgules, convertie en
 *     `uuid[]`) ⇒ visibilité
 *     restreinte à ces sites ; absent ⇒ tous les sites du client.
 * Sert `client`, `site` et `machine` : la résolution QR passe par `machine` et
 * hérite donc du même filtrage. `colonneClient` porte l'identité du client
 * (`id` sur la table `client` elle-même, `client_id` ailleurs).
 */
export function politiqueParcSql(
  table: string,
  colonneClient: string,
  colonneSite: string | null,
): string {
  const filtreSociete = `"societe_id" = NULLIF(current_setting('${VAR_SOCIETE}', true), '')::uuid`;
  const filtreClient = `(
    NULLIF(current_setting('${VAR_CLIENT}', true), '') IS NULL
    OR "${colonneClient}" = NULLIF(current_setting('${VAR_CLIENT}', true), '')::uuid
  )`;
  const filtreSite =
    colonneSite === null
      ? "true"
      : `(
    NULLIF(current_setting('${VAR_PERIMETRE}', true), '') IS NULL
    OR "${colonneSite}" = ANY(
      string_to_array(NULLIF(current_setting('${VAR_PERIMETRE}', true), ''), ',')::uuid[]
    )
  )`;
  const clause = `${filtreSociete} AND ${filtreClient} AND ${filtreSite}`;
  return `
    ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "cloisonnement_parc" ON "${table}"
      USING (${clause}) WITH CHECK (${clause});
  `;
}

/**
 * Jours fériés fictifs des deux territoires, sur un **horizon glissant**
 * (D46, complément 3).
 *
 * Trois années à partir de l'année en cours, deux fériés par an. L'horizon est
 * calculé, jamais écrit : une fixture figée à des dates passées ferait échouer
 * `scripts/horizon-feries.mts` un jour de janvier, sans que personne comprenne
 * pourquoi — et ce contrôle-là a précisément pour objet de refuser les données
 * périmées. Il s'exécute à chaque `verify:full` sur cette base.
 *
 * Les deux fériés tombent un LUNDI, seul jour où les calendriers fixtures
 * ouvrent : c'est ce qui permet d'éprouver « un férié travaillé compte comme
 * ouvré » (RG-PLA-02) sur une date réelle plutôt que théorique.
 */
export const ANNEE_FIXTURE = anneeCourante(FUSEAU_SOCIETE_A);

/** Les trois années couvertes — l'année en cours et les deux suivantes. */
export const ANNEES_FIXTURE = [0, 1, 2].map(
  (decalage) => ANNEE_FIXTURE + decalage,
);

/** Premier lundi du mois indiqué, en clé `AAAA-MM-JJ`. */
function premierLundi(annee: number, mois: number): string {
  let jour: JourLocal = { annee, mois, jour: 1 };
  while (jourSemaineIso(jour) !== LUNDI) {
    jour = jourSuivant(jour);
  }
  return cleJour(jour);
}

/** Un férié fictif du jeu d'isolation : sa date et son libellé. */
export type FerieFixture = { date: string; libelle: string };

/**
 * Les fériés d'un territoire fixture, sur l'horizon glissant. Le premier lundi
 * de juin et celui de décembre : deux dates par an, dont la dernière garantit
 * plus de douze mois d'avance en toute saison.
 */
export function feriesFixture(territoire: string): FerieFixture[] {
  return ANNEES_FIXTURE.flatMap((annee) => [
    {
      date: premierLundi(annee, 6),
      libelle: `Férié fictif de juin ${territoire}`,
    },
    {
      date: premierLundi(annee, 12),
      libelle: `Férié fictif de décembre ${territoire}`,
    },
  ]);
}

/**
 * Le férié que l'AGENCE A travaille : le premier de son territoire sur
 * l'horizon. C'est l'écart local de D46, complément 2 — le fait public dit
 * « férié », l'agence dit « on travaille », et l'ordre ne s'inverse pas.
 */
export const FERIE_TRAVAILLE_A = feriesFixture(TERRITOIRE_A)[0] as FerieFixture;

/**
 * Le PONT de l'agence A : un jour ordinaire qu'elle chôme, sans aucun férié en
 * face. Seconde forme d'écart local, et la seule qui ne s'adosse à aucun fait
 * public. Posé le lundi suivant le férié travaillé — donc un jour où le
 * calendrier ouvre, sans quoi le pont ne retirerait rien.
 */
export const PONT_A = cleJour(
  jourSuivant(lireCleJour(FERIE_TRAVAILLE_A.date), 7),
);
