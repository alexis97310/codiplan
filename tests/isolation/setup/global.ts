import { execSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

import { Role, ROLES } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import {
  AGENCE_A,
  AGENCE_B,
  CALENDRIER_A,
  CALENDRIER_B,
  FERIE_TRAVAILLE_A,
  FUSEAU_AGENCE_B,
  PLAGE_A,
  PLAGE_B,
  PONT_A,
  PONT_FIXTURE_A,
  SURCHARGE_FERIE_A,
  TERRITOIRE_A,
  TERRITOIRE_B,
  feriesFixture,
  CLIENT_A1,
  CLIENT_A2,
  CLIENT_B1,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_B1,
  MODELE_PLATEFORME,
  MODELE_SURCHARGE_A,
  MODELE_SURCHARGE_B,
  PORTAIL_A_CLIENT,
  PORTAIL_B_CLIENT,
  QR_A1,
  QR_A2,
  QR_B1,
  ROLE_APP,
  ROLE_REPORTING,
  SITE_A1_S1,
  SITE_A1_S2,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
  UTILISATEUR_PORTAIL_A,
  UTILISATEUR_PORTAIL_B,
  politiqueCloisonnementSql,
  politiqueParcSql,
} from "./fixtures";
import { urlOwner } from "./db";

/**
 * Préparation de la base jetable des tests d'isolation (L0-05).
 *
 * Exécuté une fois avant la suite. Recrée intégralement le schéma à chaque
 * exécution (base « jetable »), pilotée par TEST_DATABASE_URL — jamais Neon,
 * injoignable en TCP depuis une session cloud (même cause que la migration,
 * voir docs/decisions/2026-08-20-tests-isolation-postgres-local.md).
 *
 * Étapes : garde-fou sur l'URL, reprise à zéro du schéma (DROP + `migrate
 * deploy` — qui crée au passage le rôle applicatif restreint), contrôle de la
 * présence de ce rôle, création des tables fixtures « contrat » et de leurs
 * politiques, puis amorçage déterministe des sociétés.
 */

function garantirBaseLocaleJetable(): string {
  const url = urlOwner();
  const prod = process.env.DATABASE_URL;

  if (/neon\.tech/i.test(url)) {
    throw new Error(
      "TEST_DATABASE_URL pointe vers Neon. Les tests d'isolation exigent un " +
        "PostgreSQL local jetable — jamais la base hébergée.",
    );
  }
  if (prod && prod === url) {
    throw new Error(
      "TEST_DATABASE_URL est identique à DATABASE_URL. La base de test doit " +
        "être une base locale distincte et jetable.",
    );
  }
  return url;
}

/** Exécute un lot SQL instruction par instruction (Prisma n'en accepte qu'une à la fois). */
async function executerLot(prisma: PrismaClient, sql: string): Promise<void> {
  for (const instruction of sql.split(";")) {
    const nettoyee = instruction.trim();
    if (nettoyee.length > 0) {
      await prisma.$executeRawUnsafe(nettoyee);
    }
  }
}

export default async function setup(): Promise<void> {
  const url = garantirBaseLocaleJetable();
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // Base recréée à chaque exécution. On dépose le schéma nous-mêmes en SQL
    // brut — `prisma migrate reset` est refusé par son garde-fou anti-IA — puis
    // on réapplique les migrations avec `migrate deploy` : non destructif,
    // idempotent, et capable d'appliquer n'importe quel SQL (dont les futurs
    // triggers), là où un découpage maison sur « ; » casserait. Aucun seed
    // applicatif : le harnais amorce ses propres données déterministes.
    await executerLot(
      prisma,
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public",
    );
    execSync("pnpm exec prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "ignore",
    });

    // Le rôle applicatif restreint n'est PAS créé ici : c'est la migration
    // `20260820130000_force_rls_role_applicatif` qui le crée et lui accorde ses
    // droits. Le harnais s'assure seulement qu'elle a bien fait son travail —
    // sans quoi les scénarios éprouveraient un rôle de test, pas le vrai.
    const roleExiste = await prisma.$queryRawUnsafe<Array<{ un: number }>>(
      "SELECT 1 AS un FROM pg_roles WHERE rolname = $1",
      ROLE_APP,
      ROLE_REPORTING,
    );
    if (roleExiste.length === 0) {
      throw new Error(
        `Le rôle applicatif « ${ROLE_APP} » est absent après migration. ` +
          "Le rôle qui applique les migrations a-t-il l'attribut CREATEROLE ?",
      );
    }

    // Idem pour le rôle de consolidation (D21), créé par la migration
    // `20260820150000_authentification_et_roles`.
    const roleReportingExiste = await prisma.$queryRawUnsafe<
      Array<{ un: number }>
    >("SELECT 1 AS un FROM pg_roles WHERE rolname = $1", ROLE_REPORTING);
    if (roleReportingExiste.length === 0) {
      throw new Error(
        `Le rôle de consolidation « ${ROLE_REPORTING} » est absent après ` +
          "migration. Les scénarios D21 ne peuvent pas être joués.",
      );
    }

    // Tables fixtures « contrat » — modèlent les vraies tables des lots 1 et 2,
    // types compris : identifiants en `uuid` natif, comme le schéma réel.
    await executerLot(
      prisma,
      `
      CREATE TABLE "client" (
        "id" uuid PRIMARY KEY,
        "societe_id" uuid NOT NULL,
        "raison_sociale" text NOT NULL
      );
      CREATE TABLE "site" (
        "id" uuid PRIMARY KEY,
        "societe_id" uuid NOT NULL,
        "client_id" uuid NOT NULL,
        "libelle" text NOT NULL
      );
      CREATE TABLE "machine" (
        "id" uuid PRIMARY KEY,
        "societe_id" uuid NOT NULL,
        "client_id" uuid NOT NULL,
        "site_id" uuid NOT NULL,
        "qr_token" text NOT NULL UNIQUE,
        "numero_serie" text NOT NULL
      );
      CREATE TABLE "modele_materiel" (
        "id" uuid PRIMARY KEY,
        "societe_id" uuid,
        "libelle" text NOT NULL
      );
      `,
    );

    await executerLot(prisma, politiqueParcSql("client", "id", null));
    await executerLot(prisma, politiqueParcSql("site", "client_id", "id"));
    await executerLot(
      prisma,
      politiqueParcSql("machine", "client_id", "site_id"),
    );
    await executerLot(prisma, politiqueCloisonnementSql("modele_materiel"));

    // Droits du rôle applicatif sur les seules tables FIXTURES. Les tables
    // réelles tiennent leurs droits des migrations, et d'elles seules : un
    // « GRANT … ON ALL TABLES » rendrait ici au rôle applicatif ce que la
    // migration lui a délibérément retiré — le droit de corriger ou d'effacer
    // le journal des accès, par exemple —, et les scénarios éprouveraient des
    // droits que la production n'accorde pas.
    await executerLot(
      prisma,
      `
      GRANT USAGE ON SCHEMA public TO "${ROLE_APP}";
      GRANT SELECT, INSERT, UPDATE, DELETE
        ON "client", "site", "machine", "modele_materiel"
        TO "${ROLE_APP}";
      `,
    );

    // ── Amorçage déterministe (I9 — données fictives) ────────────────────────
    await prisma.devise.createMany({
      data: [
        {
          code: "XPF",
          libelle: "Franc Pacifique",
          decimales: 0,
          symbole: null,
        },
        { code: "EUR", libelle: "Euro", decimales: 2, symbole: "€" },
      ],
    });

    await prisma.societe.createMany({
      data: [
        {
          id: SOCIETE_A,
          code: "ISO-A",
          raison_sociale: "Société A",
          pays: "Nouvelle-Calédonie",
          territoire: "Province Sud",
          fuseau_horaire: "Pacific/Noumea",
          devise_code: "XPF",
          taux_horaire_defaut: "7000",
          majoration_hors_ouverture_pct: "50",
          couleur_primaire: "#0b5cad",
          couleur_secondaire: "#f4a300",
          langue: "fr",
        },
        {
          id: SOCIETE_B,
          code: "ISO-B",
          raison_sociale: "Société B",
          pays: "France",
          territoire: "Métropole",
          fuseau_horaire: "Europe/Paris",
          devise_code: "EUR",
          taux_horaire_defaut: "65.00",
          majoration_hors_ouverture_pct: "50",
          couleur_primaire: "#0b5cad",
          couleur_secondaire: "#f4a300",
          langue: "fr",
        },
      ],
    });

    // Le territoire est posé DÈS LA CRÉATION : la colonne est NOT NULL depuis
    // L0-09a (D48), parce que le chaînage de `calendrier_ferie` s'appuie dessus
    // et qu'une clé étrangère dont une colonne vaut NULL n'est pas contrôlée.
    // Le fuseau de l'agence B est surchargé plus bas, une fois son calendrier
    // créé — territoire et fuseau restent deux attributs indépendants.
    await prisma.agence.createMany({
      data: [
        {
          id: AGENCE_A,
          societe_id: SOCIETE_A,
          code: "DUCOS",
          libelle: "Ducos",
          territoire: TERRITOIRE_A,
        },
        {
          id: AGENCE_B,
          societe_id: SOCIETE_B,
          code: "SIEGE",
          libelle: "Siège",
          territoire: TERRITOIRE_B,
        },
      ],
    });

    // ── 1. LE FAIT PUBLIC : le référentiel territorial des fériés (D46) ───
    // Pas de `societe_id`, donc aucun contexte à poser — comme `devise`.
    // L'horizon est GLISSANT (D46, complément 3) : `feriesFixture` part de
    // l'année en cours, si bien que `scripts/horizon-feries.mts` trouve toujours
    // plus de douze mois d'avance sur cette base — et échouerait si quelqu'un
    // figeait ces dates.
    await prisma.jourFerie.createMany({
      data: [TERRITOIRE_A, TERRITOIRE_B].flatMap((territoire) =>
        feriesFixture(territoire).map((ferie) => ({
          id: uuidv7(),
          territoire,
          date: new Date(`${ferie.date}T00:00:00.000Z`),
          libelle: ferie.libelle,
          mobile: false,
        })),
      ),
    });

    // ── 2. Calendriers d'ouverture — des HEURES, et rien d'autre ──────────
    // Ni territoire ni férié ici : ils appartiennent à l'agence (D46).
    await prisma.calendrier.createMany({
      data: [
        {
          id: CALENDRIER_A,
          societe_id: SOCIETE_A,
          code: "ISO-CAL-A",
          libelle: "Calendrier A",
        },
        {
          id: CALENDRIER_B,
          societe_id: SOCIETE_B,
          code: "ISO-CAL-B",
          libelle: "Calendrier B",
        },
      ],
    });
    await prisma.calendrierPlage.createMany({
      data: [
        {
          id: PLAGE_A,
          societe_id: SOCIETE_A,
          calendrier_id: CALENDRIER_A,
          jour_semaine: 1,
          debut_minutes: 480,
          fin_minutes: 720,
        },
        {
          id: PLAGE_B,
          societe_id: SOCIETE_B,
          calendrier_id: CALENDRIER_B,
          jour_semaine: 1,
          debut_minutes: 540,
          fin_minutes: 780,
        },
      ],
    });

    // Fuseau et calendrier de chaque agence. L'agence B surcharge son fuseau
    // pour valoir celui de l'agence A tout en gardant le TERRITOIRE posé à la
    // création : la fixture est adversaire, et tout code qui déduirait l'un de
    // l'autre tombe ici (D46, complément 1).
    await prisma.agence.update({
      where: { id: AGENCE_A },
      data: { calendrier_id: CALENDRIER_A },
    });
    await prisma.agence.update({
      where: { id: AGENCE_B },
      data: {
        calendrier_id: CALENDRIER_B,
        fuseau_horaire: FUSEAU_AGENCE_B,
      },
    });

    // ── 3. L'ÉCART LOCAL de l'agence A, et jamais avant le fait public ────
    // Deux formes : un férié TRAVAILLÉ (adossé au fait public), et un PONT
    // (aucun fait public en face).
    const ferieTravaille = await prisma.jourFerie.findUniqueOrThrow({
      where: {
        territoire_date: {
          territoire: TERRITOIRE_A,
          date: new Date(`${FERIE_TRAVAILLE_A.date}T00:00:00.000Z`),
        },
      },
      select: { id: true },
    });

    // `territoire` est recopié depuis l'agence (D48) : c'est la colonne par
    // laquelle le chaînage tient l'écart des deux côtés à la fois. Le PONT la
    // porte lui aussi, bien qu'il ne désigne aucun fait public — sa clé vers
    // l'agence, elle, n'a aucune colonne nullable et reste donc contrôlée.
    await prisma.calendrierFerie.createMany({
      data: [
        {
          id: SURCHARGE_FERIE_A,
          societe_id: SOCIETE_A,
          agence_id: AGENCE_A,
          territoire: TERRITOIRE_A,
          date: new Date(`${FERIE_TRAVAILLE_A.date}T00:00:00.000Z`),
          jour_ferie_id: ferieTravaille.id,
          travaille: true,
          motif: "Férié travaillé de démonstration",
        },
        {
          id: PONT_FIXTURE_A,
          societe_id: SOCIETE_A,
          agence_id: AGENCE_A,
          territoire: TERRITOIRE_A,
          date: new Date(`${PONT_A}T00:00:00.000Z`),
          jour_ferie_id: null,
          travaille: false,
          motif: "Pont de démonstration",
        },
      ],
    });

    // Un utilisateur interne par société, avec son habilitation.
    await prisma.utilisateur.createMany({
      data: [
        {
          id: UTILISATEUR_PORTAIL_A,
          nom: "Interne A",
          email: "interne-a@iso.test",
        },
        {
          id: UTILISATEUR_PORTAIL_B,
          nom: "Interne B",
          email: "interne-b@iso.test",
        },
      ],
    });
    await prisma.utilisateurSociete.createMany({
      data: [
        {
          id: "aaaaaaaa-0000-7000-8000-0000000000f5",
          utilisateur_id: UTILISATEUR_PORTAIL_A,
          societe_id: SOCIETE_A,
          role: Role.adv,
        },
        {
          id: "bbbbbbbb-0000-7000-8000-0000000000f6",
          utilisateur_id: UTILISATEUR_PORTAIL_B,
          societe_id: SOCIETE_B,
          role: Role.adv,
        },
      ],
    });

    // Comptes portail (D10) : chacun rattaché à un client de sa société.
    await prisma.utilisateur.createMany({
      data: [
        {
          id: PORTAIL_A_CLIENT,
          nom: "Portail A",
          email: "portail-a@iso.test",
        },
        {
          id: PORTAIL_B_CLIENT,
          nom: "Portail B",
          email: "portail-b@iso.test",
        },
      ],
    });
    await prisma.utilisateurClient.createMany({
      data: [
        {
          id: "aaaaaaaa-0000-7000-8000-0000000000f7",
          utilisateur_id: PORTAIL_A_CLIENT,
          client_id: CLIENT_A1,
          societe_id: SOCIETE_A,
          perimetre_sites: [],
        },
        {
          id: "bbbbbbbb-0000-7000-8000-0000000000f8",
          utilisateur_id: PORTAIL_B_CLIENT,
          client_id: CLIENT_B1,
          societe_id: SOCIETE_B,
          perimetre_sites: [],
        },
      ],
    });

    // Fixtures parc : clients, sites, machines des deux sociétés.
    await executerLot(
      prisma,
      `
      INSERT INTO "client" ("id", "societe_id", "raison_sociale") VALUES
        ('${CLIENT_A1}', '${SOCIETE_A}', 'Client A1'),
        ('${CLIENT_A2}', '${SOCIETE_A}', 'Client A2'),
        ('${CLIENT_B1}', '${SOCIETE_B}', 'Client B1');
      INSERT INTO "site" ("id", "societe_id", "client_id", "libelle") VALUES
        ('${SITE_A1_S1}', '${SOCIETE_A}', '${CLIENT_A1}', 'Site A1-1'),
        ('${SITE_A1_S2}', '${SOCIETE_A}', '${CLIENT_A1}', 'Site A1-2'),
        ('${SITE_B1_S1}', '${SOCIETE_B}', '${CLIENT_B1}', 'Site B1-1');
      INSERT INTO "machine" ("id", "societe_id", "client_id", "site_id", "qr_token", "numero_serie") VALUES
        ('${MACHINE_A1}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S1}', '${QR_A1}', 'SN-A1'),
        ('${MACHINE_A2}', '${SOCIETE_A}', '${CLIENT_A1}', '${SITE_A1_S2}', '${QR_A2}', 'SN-A2'),
        ('${MACHINE_B1}', '${SOCIETE_B}', '${CLIENT_B1}', '${SITE_B1_S1}', '${QR_B1}', 'SN-B1');
      INSERT INTO "modele_materiel" ("id", "societe_id", "libelle") VALUES
        ('${MODELE_PLATEFORME}', NULL, 'Compresseur (plateforme)'),
        ('${MODELE_SURCHARGE_A}', '${SOCIETE_A}', 'Compresseur (surcharge A)'),
        ('${MODELE_SURCHARGE_B}', '${SOCIETE_B}', 'Compresseur (surcharge B)');
      `,
    );

    // ── Un compte par rôle canonique (L0-06) ─────────────────────────────────
    // La boucle parcourt `ROLES`, l'énumération elle-même : ajouter un rôle sans
    // lui donner de compte ferait échouer l'amorçage, pas passer un scénario en
    // silence.
    await prisma.utilisateur.createMany({
      data: ROLES.map((role) => ({
        id: UTILISATEUR_PAR_ROLE[role],
        nom: `Compte ${role}`,
        email: `${role}@iso.test`,
        // Le second facteur est actif partout : les scénarios qui éprouvent son
        // absence le font sur un contexte de session, pas sur le compte.
        mfa_actif: true,
      })),
    });

    // Les cinq rôles internes sont habilités sur la société A ; les trois rôles
    // éditeur ne le sont nulle part (§22.5) ; `client` passe par le portail.
    const rolesInternes = ROLES.filter(
      (role) =>
        role !== Role.admin_plateforme &&
        role !== Role.editeur_commercial &&
        role !== Role.editeur_support &&
        role !== Role.client,
    );
    await prisma.utilisateurSociete.createMany({
      data: rolesInternes.map((role, rang) => ({
        id: `aaaaaaaa-0000-7000-8000-00000000071${rang}`,
        utilisateur_id: UTILISATEUR_PAR_ROLE[role],
        societe_id: SOCIETE_A,
        role,
      })),
    });

    await prisma.utilisateurClient.create({
      data: {
        id: "aaaaaaaa-0000-7000-8000-000000000720",
        utilisateur_id: UTILISATEUR_PAR_ROLE[Role.client],
        client_id: CLIENT_A1,
        societe_id: SOCIETE_A,
        perimetre_sites: [],
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
