import type { Role } from "@/lib/auth/roles";

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

/**
 * Un compte par rôle canonique (L0-06). Les identifiants portent le rang du
 * rôle dans l'énumération, pour rester lisibles à la lecture d'un échec.
 *
 * Les cinq rôles internes sont habilités sur la société A. Les trois rôles
 * éditeur ne le sont sur AUCUNE société : c'est le principe du §22.5 — « un
 * salarié de l'éditeur n'a aucun accès par défaut aux données d'un client » —,
 * et c'est ce qui rend leur scénario négatif réel plutôt que théorique. Le rôle
 * `client` est rattaché au client A1 par `utilisateur_client` (D10).
 */
export const UTILISATEUR_PAR_ROLE: Readonly<Record<Role, string>> = {
  admin_plateforme: "00000000-0000-7000-8000-000000000701",
  editeur_commercial: "00000000-0000-7000-8000-000000000702",
  editeur_support: "00000000-0000-7000-8000-000000000703",
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
