import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";

import { prisma } from "@/lib/db/client";

import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "./lecture-identite";
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
 * LE PLANCHER DU SECOND FACTEUR — trois valeurs MÉTIER, arbitrées le
 * 08/09/2026, et la raison du calibrage est écrite ici parce que quelqu'un
 * voudra un jour descendre à 3 (D64).
 *
 * ## L'arithmétique, d'abord, parce qu'elle borne la discussion
 *
 * La fenêtre de vérification est de ±1 période — mesuré : `createOTP().verify()`
 * ne reçoit pas d'option et retient `window = 1`. **Trois codes sont donc
 * valides à tout instant**, et l'espace utile est 3,3·10⁵, pas 10⁶.
 *
 * À `SEUIL` échecs par `DUREE`, un attaquant qui détient DÉJÀ le mot de passe
 * dispose de `SEUIL / DUREE` essais : 10 pour 15 minutes font ~350 000 codes par
 * an, soit près de deux chances sur trois d'aboutir en un an. **Aucune paire
 * (seuil, durée) supportable ne ferme cette arithmétique** — c'est
 * l'ESCALADE qui la ferme, en plafonnant l'attaque soutenue à
 * `SEUIL × SEUIL_ESCALADE` codes au total.
 *
 * ## Pourquoi DIX et pas trois
 *
 * La bibliothèque ne compare que **cinq** codes par défi avant d'en exiger un
 * nouveau — mesuré. Un seuil de 5 verrouillerait donc au moment MÊME où le défi
 * s'épuise : une seule session maladroite suffirait. Dix laisse deux défis
 * entiers de fautes de frappe, ce qui est le geste réel de quelqu'un qui saisit
 * six chiffres au soleil avec des gants.
 *
 * ## Pourquoi QUINZE MINUTES
 *
 * Le verrouillage temporaire se purge seul. C'est ce qui compte : un
 * `admin_societe` est, chez son client, le seul à pouvoir administrer les
 * comptes — personne dans sa société ne peut le débloquer. Une durée qui
 * exigerait un appel au support ferait dépendre l'exploitation d'un tiers.
 *
 * ## Pourquoi TROIS verrouillages
 *
 * Trente codes faux répartis sur quarante-cinq minutes ne sont plus une faute de
 * frappe. Au-delà, le verrouillage cesse d'expirer et devient un acte
 * administratif — ticket **L7-04**, `admin_societe` de la société concernée,
 * journalisé. *Déverrouiller n'accorde aucun accès : la personne devra toujours
 * présenter un code valide. C'est une gêne d'exploitation, pas un événement de
 * sécurité* — et c'est ce qui le distingue de L7-01, qui rend un accès PERDU
 * quand L7-04 ne rend que le droit de réessayer.
 */
export const SEUIL_ECHECS_SECOND_FACTEUR = 10;

/** Durée du verrouillage temporaire, en secondes. Quinze minutes. */
export const DUREE_VERROUILLAGE_SECONDES = 900;

/**
 * Nombre de verrouillages CONSÉCUTIFS — sans connexion réussie entre eux — au
 * terme duquel le verrouillage cesse d'expirer.
 *
 * Il n'est pas lu par la bibliothèque : l'escalade est tenue par un déclencheur
 * PostgreSQL, seul point de passage que tous les chemins de vérification
 * franchissent. Voir la migration `20260908160000_plancher_second_facteur_d62`.
 */
export const SEUIL_ESCALADE_VERROUILLAGE = 3;

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
 * LE CANAL DE REMISE D'UN JETON DE PREMIER ACCÈS (Q1 / D65, 09/09/2026).
 *
 * ## Ce que ce paramètre ouvre, et ce qu'il laisse fermé
 *
 * Better Auth n'expose `/request-password-reset` **que si**
 * `emailAndPassword.sendResetPassword` est fourni — mesuré le 09/09/2026 :
 * sans lui, l'appel est refusé par `RESET_PASSWORD_DISABLED`, sur un courriel
 * existant comme sur un courriel inexistant. **L'instance de production ne le
 * fournit pas et ne doit jamais le fournir** : il n'existe donc aucun moyen,
 * depuis un navigateur, de faire émettre un jeton pour un compte quelconque.
 *
 * Le geste d'amorçage, lui, construit **sa propre instance** en passant ce
 * canal. Il obtient ainsi un jeton par la mécanique de la bibliothèque —
 * une ligne de `verification`, **à usage unique et datée** — plutôt qu'en
 * fabriquant une ligne à la main sur un format qu'il aurait deviné.
 *
 * **La CONSOMMATION, elle, reste sur l'instance de production, et c'est
 * mesuré :** `/reset-password` n'exige pas ce canal ; il valide le jeton et
 * refuse `INVALID_TOKEN` sur un jeton inventé. Émettre et consommer sont donc
 * deux droits distincts, et un seul est ouvert au monde.
 *
 * Signature : la bibliothèque appelle ce canal avec l'URL complète et le jeton.
 */
export type CanalPremierAcces = (remise: {
  readonly url: string;
  readonly jeton: string;
}) => Promise<void>;

/**
 * Construit l'instance d'authentification.
 *
 * Prend son client Prisma en paramètre pour que les scénarios puissent la
 * monter sur la base jetable des tests d'isolation, avec le rôle applicatif
 * réel, sans dupliquer la configuration éprouvée en production.
 */
export function creerAuth(
  client: PrismaClient = prisma,
  administration?: ContexteAdministratif,
  canalPremierAcces?: CanalPremierAcces,
) {
  return betterAuth({
    appName: "CODIPLAN",
    secret: process.env[VARIABLE_SECRET],
    // L'ENVELOPPE DE DÉSIGNATION (L1-02c). `utilisateur` est cloisonnée en
    // base, et l'authentification précède la société : chaque lecture doit
    // NOMMER la ligne qu'elle demande, dans sa propre transaction. L'adaptateur
    // n'est pas déformé — il reçoit un client Prisma, et c'est tout ce qu'il
    // connaît.
    database: prismaAdapter(avecDesignationAuth(client, administration), {
      provider: "postgresql",
    }),
    advanced: {
      database: {
        // I10 — clé technique UUID v7, y compris pour les tables d'identité.
        generateId: () => uuidv7(),
      },
    },
    // Mot de passe : le seul moyen d'authentification de la V1. Aucun
    // fournisseur externe n'est déclaré — en ajouter un serait une décision.
    //
    // `sendResetPassword` n'est fourni QUE par le geste d'amorçage (Q1 / D65),
    // sur son instance à lui. Sur l'instance de production il est absent, et
    // `/request-password-reset` répond alors `RESET_PASSWORD_DISABLED` —
    // mesuré. Il n'y a donc aucune émission de jeton en libre-service.
    emailAndPassword: {
      enabled: true,
      ...(canalPremierAcces === undefined
        ? {}
        : {
            sendResetPassword: async ({
              url,
              token,
            }: {
              url: string;
              token: string;
            }) => {
              await canalPremierAcces({ url, jeton: token });
            },
          }),
    },
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
            // L'ENVELOPPE, ET PAS LE CLIENT NU (L1-02d). `utilisateur` est
            // cloisonnée : une lecture non désignée rendrait `null`, et le
            // `?? false` ci-dessous aurait transformé ce refus en « pas de
            // second facteur ». Un défaut silencieux, dans le sens permissif.
            const utilisateur = await avecDesignationAuth(
              client,
            ).utilisateur.findUnique({
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
        // LE PLANCHER EST ÉNONCÉ, JAMAIS HÉRITÉ (D62). La bibliothèque porte
        // des valeurs par défaut — 10 et 900 s — qui se trouvent coïncider avec
        // celles qui ont été arbitrées. *Une valeur par défaut qui répond à une
        // question qu'on n'a pas posée est une décision prise par personne*
        // (§9, 24/08) : les trois valeurs sont donc écrites, avec leur raison,
        // et un gardien vérifie que la configuration les porte réellement.
        accountLockout: {
          enabled: true,
          maxFailedAttempts: SEUIL_ECHECS_SECOND_FACTEUR,
          durationSeconds: DUREE_VERROUILLAGE_SECONDES,
        },
        // LES CODES DE SECOURS NE SONT PAS STOCKÉS EN CLAIR (L1-02d, décision
        // d'exploitation du 08/09/2026). *Un code de secours est un identifiant
        // de connexion.* Le greffon ne les chiffre QUE si on le demande — son
        // défaut est le texte brut, et c'est ce que le dépôt portait.
        //
        // Ce que cette option fait exactement, dit plutôt que supposé : un
        // CHIFFREMENT symétrique par la clé de signature, et non une empreinte.
        // La bibliothèque n'offre pas d'empreinte — les codes doivent être
        // rendus à l'utilisateur une fois, puis comparés. Conséquence à
        // connaître : une copie de la base seule ne les livre plus ; une copie
        // de la base ET du secret, si.
        backupCodeOptions: { storeBackupCodes: "encrypted" },
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
