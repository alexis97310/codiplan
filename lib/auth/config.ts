import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

import { prisma } from "@/lib/db/client";
import { uuidv7 } from "@/lib/db/uuid";

/**
 * Authentification Better Auth (ticket L0-06 ; CLAUDE.md §2 — « Pas Auth.js »).
 *
 * **Sessions serveur.** Better Auth range la session en base, dans la table
 * `session`, et ne dépose côté navigateur qu'un jeton signé. C'est cette ligne
 * de session qui porte la société active et le rôle tenu dessus : deux colonnes
 * de plus, `societe_id_active` et `role_actif`, déclarées ci-dessous en
 * `additionalFields`. Rien d'autre ne détermine `app.societe_id` — voir
 * `lib/db/client.ts`.
 *
 * **Un compte, une identité.** Better Auth est branché SUR la table
 * `utilisateur` du schéma L0-03 plutôt que sur une table `user` parallèle : la
 * correspondance des noms est écrite ici, explicitement, champ par champ. Sans
 * cela le dépôt porterait deux notions d'utilisateur, et la première divergence
 * serait une question de temps.
 *
 * **Identifiants.** `generateId` délègue à `uuidv7()` : les clés techniques
 * restent des UUID v7 (I10), y compris celles que Better Auth crée lui-même.
 */

/** Nom de la variable d'environnement portant le secret de signature. */
export const VARIABLE_SECRET = "BETTER_AUTH_SECRET";

/**
 * Correspondance des champs entre le vocabulaire de Better Auth et celui du
 * schéma. Extraite pour être lisible — et testée : un scénario compare cette
 * table aux colonnes réellement présentes en base.
 */
export const CHAMPS_UTILISATEUR = {
  name: "nom",
  emailVerified: "email_verifie",
  image: "avatar_url",
  createdAt: "cree_le",
  updatedAt: "modifie_le",
} as const;

export const CHAMPS_SESSION = {
  expiresAt: "expire_le",
  ipAddress: "adresse_ip",
  userAgent: "agent_utilisateur",
  userId: "utilisateur_id",
  createdAt: "cree_le",
  updatedAt: "modifie_le",
} as const;

export const CHAMPS_COMPTE = {
  userId: "utilisateur_id",
  accountId: "compte_externe_id",
  providerId: "fournisseur_id",
  issuer: "emetteur",
  password: "mot_de_passe",
  accessToken: "jeton_acces",
  refreshToken: "jeton_rafraichissement",
  idToken: "jeton_identite",
  accessTokenExpiresAt: "jeton_acces_expire_le",
  refreshTokenExpiresAt: "jeton_rafraichissement_expire_le",
  scope: "portee",
  createdAt: "cree_le",
  updatedAt: "modifie_le",
} as const;

export const CHAMPS_VERIFICATION = {
  identifier: "identifiant",
  value: "valeur",
  expiresAt: "expire_le",
  createdAt: "cree_le",
  updatedAt: "modifie_le",
} as const;

export const CHAMPS_SECOND_FACTEUR = {
  userId: "utilisateur_id",
  backupCodes: "codes_secours",
  verified: "verifie",
  failedVerificationCount: "echecs_verification",
  lockedUntil: "verrouille_jusqu_a",
} as const;

/**
 * Construit l'instance d'authentification.
 *
 * Prend son client Prisma en paramètre pour que les scénarios puissent la
 * monter sur la base jetable des tests d'isolation, avec le rôle applicatif
 * réel, sans dupliquer la configuration éprouvée en production.
 */
export function creerAuth(client: PrismaClient = prisma) {
  return betterAuth({
    appName: "CODIPLAN",
    secret: process.env[VARIABLE_SECRET],
    database: prismaAdapter(client, { provider: "postgresql" }),
    advanced: {
      database: {
        // I10 — clé technique UUID v7, y compris pour les tables d'identité.
        generateId: () => uuidv7(),
      },
    },
    // Mot de passe : le seul moyen d'authentification de la V1. Aucun
    // fournisseur externe n'est déclaré — en ajouter un serait une décision.
    emailAndPassword: { enabled: true },
    user: {
      modelName: "utilisateur",
      fields: CHAMPS_UTILISATEUR,
    },
    session: {
      modelName: "session",
      fields: CHAMPS_SESSION,
      additionalFields: {
        // Société active de la session : c'est elle, et rien d'autre, qui
        // alimente `app.societe_id`. `input: false` — elle ne se pose jamais
        // depuis le client, seulement par `basculerSociete`, qui contrôle
        // l'habilitation et journalise.
        societe_id_active: {
          type: "string",
          required: false,
          input: false,
        },
        role_actif: {
          type: "string",
          required: false,
          input: false,
        },
        // Le second facteur a été présenté à l'ouverture de la session. Le
        // greffon `twoFactor` n'ouvre la session qu'APRÈS vérification : la
        // valeur se déduit donc de `utilisateur.mfa_actif` au moment où la
        // session est créée.
        second_facteur_valide: {
          type: "boolean",
          required: false,
          input: false,
          defaultValue: false,
        },
      },
    },
    account: {
      modelName: "compte",
      fields: CHAMPS_COMPTE,
    },
    verification: {
      modelName: "verification",
      fields: CHAMPS_VERIFICATION,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const utilisateur = await client.utilisateur.findUnique({
              where: { id: session.userId },
              select: { mfa_actif: true },
            });
            return {
              data: {
                ...session,
                second_facteur_valide: utilisateur?.mfa_actif ?? false,
              },
            };
          },
        },
      },
    },
    plugins: [
      twoFactor({
        issuer: "CODIPLAN",
        schema: {
          user: {
            modelName: "utilisateur",
            fields: { twoFactorEnabled: "mfa_actif" },
          },
          twoFactor: {
            modelName: "secondFacteur",
            fields: CHAMPS_SECOND_FACTEUR,
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof creerAuth>;

let instance: Auth | undefined;

/**
 * Instance partagée par les routes d'API et les aides serveur.
 *
 * Construite à la première demande, et non au chargement du module : le secret
 * de signature est lu à ce moment-là. Une construction au chargement ferait
 * échouer `next build`, où aucun secret n'est — ni ne doit être — présent.
 */
export function auth(): Auth {
  instance ??= creerAuth();
  return instance;
}
