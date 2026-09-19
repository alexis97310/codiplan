import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import { creerTechnicien, modifierTechnicien } from "@/lib/techniciens/depot";
import type { SaisieTechnicien } from "@/lib/techniciens/saisie";

/**
 * LES ÉCRITURES DE `lib/techniciens/depot.ts`, ÉPROUVÉES SANS BASE (ÉQUIPE-1).
 *
 * ## Pourquoi un client FACTICE, et pas la base jetable de `tests/isolation/`
 *
 * `pnpm test` (projet « unit ») tourne sans base — `vitest.config.mts` ne pose
 * `globalSetup` que pour le projet « isolation », sanctuarisé et hors du
 * territoire de ce lot ; et dans la CI, `pnpm test` s'exécute AVANT
 * `pnpm test:isolation`, sur une base qui n'a encore reçu AUCUNE migration.
 * Un test qui exigerait une vraie base ferait donc échouer `pnpm verify`
 * partout.
 *
 * Le paramètre `client?: PrismaClient` de `creerTechnicien` et
 * `modifierTechnicien` reçoit ici un OBJET qui rejoue le contrat minimal que
 * ces fonctions utilisent — y compris `$extends`, parce que `creerTechnicien`
 * appelle RÉELLEMENT `avecDesignationAuth` (`lib/auth/lecture-identite.ts`,
 * jamais réécrit ici) pour l'écriture de l'identité. Ce que ce fichier prouve
 * est la FORME du code — l'ordre des écritures, le rattachement plutôt que le
 * doublon, ce qui se passe quand une écriture refuse. Ce qu'il ne prouve PAS :
 * qu'une politique RLS réelle mord — c'est la moitié que `tests/isolation/`
 * tient déjà pour `technicien`, `utilisateur_societe` et `utilisateur`.
 *
 * ## POURQUOI DEUX TRANSACTIONS, ET NON UNE SEULE
 *
 * La première rédaction posait les trois lignes dans une transaction unique,
 * en armant elle-même les variables de désignation d'authentification.
 * `tests/unit/auth/pose-de-designation.test.ts` l'a refusé : cette pose est
 * fermée à toute maison hors de `lib/db/rls.ts` et
 * `lib/auth/lecture-identite.ts` — une liste close, et l'étendre est un
 * arbitrage hors du territoire de ce lot. `creerTechnicien` écrit donc
 * l'identité par `avecDesignationAuth` (SA propre transaction, par appel),
 * puis l'habilitation et le rattachement ENSEMBLE (une seconde transaction).
 * Voir l'en-tête de `lib/techniciens/depot.ts` pour le raisonnement complet et
 * ce que ce choix coûte.
 */

const CONTEXTE_ADMIN: ContexteSession = {
  utilisateurId: "0192f0a0-0000-7000-8000-0000000000a0",
  societeId: "0192f0a0-0000-7000-8000-0000000000s0",
  role: Role.admin_societe,
  // admin_societe exige un second facteur (D40) : sans lui, la validation de
  // contexte refuse avant même d'ouvrir une transaction.
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const SAISIE_VALIDE: SaisieTechnicien = {
  nom: "Marc Wamytan",
  email: "marc.wamytan@example.test",
  agence_id: "0192f0a0-0000-7000-8000-0000000000ag",
  actif: true,
};

type Appels = {
  utilisateurCree: unknown[];
  utilisateurSocieteCree: unknown[];
  technicienCree: unknown[];
  technicienModifie: unknown[];
  /** Nombre d'ouvertures de `$transaction`, TOUTES origines confondues. */
  transactionsOuvertes: number;
};

/** La forme MINIMALE d'une opération Prisma étendue — `$allOperations`. */
type OperationEtendue = (entree: {
  readonly operation: string;
  readonly args: unknown;
  readonly query: (a: unknown) => Promise<unknown>;
}) => Promise<unknown>;

/**
 * Un client Prisma FACTICE portant le sous-ensemble de méthodes que
 * `lib/techniciens/depot.ts` — ET, à travers lui, `avecDesignationAuth` —
 * appellent réellement.
 */
function fabriquerClientFactice(options: {
  readonly utilisateurExistant?: { readonly id: string } | null;
  readonly echecUtilisateurSociete?: unknown;
  readonly echecTechnicien?: unknown;
}): { readonly client: PrismaClient; readonly appels: Appels } {
  const appels: Appels = {
    utilisateurCree: [],
    utilisateurSocieteCree: [],
    technicienCree: [],
    technicienModifie: [],
    transactionsOuvertes: 0,
  };

  const jamaisAppele = (): Promise<never> =>
    Promise.reject(
      new Error(
        "le passe-plat `query` de $allOperations ne doit jamais être " +
          "appelé ici — `avecDesignationAuth` ouvre toujours sa propre " +
          "transaction dès qu'un contexte d'administration est fourni.",
      ),
    );

  // `tx` : ce que `$transaction` remet à son rappel — les modèles PLATS,
  // sans la couche `$allOperations` (c'est elle qui appelle `base.$transaction`,
  // pas l'inverse).
  const tx = {
    $executeRawUnsafe: async () => undefined,
    utilisateur: {
      findUnique: async () => options.utilisateurExistant ?? null,
      create: async ({ data }: { data: { id: string } }) => {
        appels.utilisateurCree.push(data);
        return { id: data.id };
      },
    },
    utilisateurSociete: {
      create: async ({ data }: { data: { id: string } }) => {
        if (options.echecUtilisateurSociete !== undefined) {
          throw options.echecUtilisateurSociete;
        }
        appels.utilisateurSocieteCree.push(data);
        return { id: data.id };
      },
    },
    technicien: {
      create: async ({ data }: { data: { id: string } }) => {
        if (options.echecTechnicien !== undefined) {
          throw options.echecTechnicien;
        }
        appels.technicienCree.push(data);
        return { id: data.id };
      },
      updateMany: async ({ data }: { data: unknown }) => {
        appels.technicienModifie.push(data);
        return { count: 1 };
      },
    },
  };

  const fakeClient = {
    $transaction: async (
      travail: (t: unknown) => Promise<unknown>,
    ): Promise<unknown> => {
      appels.transactionsOuvertes += 1;
      return travail(tx);
    },
    // `avecDesignationAuth(base, administration).utilisateur.<op>(args)` —
    // reproduit le contrat de `$extends` : router chaque appel du modèle
    // `utilisateur` vers `$allOperations`, exactement comme le fait le
    // client Prisma réel pour une extension `query`.
    $extends: (configuration: {
      query: { utilisateur: { $allOperations: OperationEtendue } };
    }) => ({
      utilisateur: {
        findUnique: (args: unknown) =>
          configuration.query.utilisateur.$allOperations({
            operation: "findUnique",
            args,
            query: jamaisAppele,
          }),
        create: (args: unknown) =>
          configuration.query.utilisateur.$allOperations({
            operation: "create",
            args,
            query: jamaisAppele,
          }),
      },
    }),
  } as unknown as PrismaClient;

  return { client: fakeClient, appels };
}

function erreurUnicite(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("créer un technicien — l'identité, puis l'habilitation et le rattachement (gardien)", () => {
  it("une identité NOUVELLE est créée, puis habilitée et rattachée", async () => {
    const { client, appels } = fabriquerClientFactice({});

    const resultat = await creerTechnicien(
      CONTEXTE_ADMIN,
      SAISIE_VALIDE,
      client,
    );

    expect(resultat.accepte).toBe(true);
    expect(appels.utilisateurCree).toHaveLength(1);
    expect(appels.utilisateurSocieteCree).toHaveLength(1);
    expect(appels.technicienCree).toHaveLength(1);
    // Les trois portent le MÊME `utilisateur_id` — la même personne.
    const idCree = (appels.utilisateurCree[0] as { id: string }).id;
    expect(
      (appels.utilisateurSocieteCree[0] as { utilisateur_id: string })
        .utilisateur_id,
    ).toBe(idCree);
    expect(
      (appels.technicienCree[0] as { utilisateur_id: string }).utilisateur_id,
    ).toBe(idCree);
    // TROIS ouvertures : la lecture par désignation, la création de
    // l'identité — chacune SA propre transaction, par construction de
    // `avecDesignationAuth` — puis l'habilitation ET le rattachement,
    // ENSEMBLE, dans une troisième.
    expect(appels.transactionsOuvertes).toBe(3);
  });

  it("un refus sur l'HABILITATION n'écrit PAS le rattachement — les deux vont ensemble", async () => {
    const { client, appels } = fabriquerClientFactice({
      echecUtilisateurSociete: erreurUnicite(),
    });

    const resultat = await creerTechnicien(
      CONTEXTE_ADMIN,
      SAISIE_VALIDE,
      client,
    );

    expect(resultat).toEqual({ accepte: false, motif: "deja_membre" });
    // L'identité EST créée (elle est désignée et neuve) ; ce qui la suit,
    // habilitation et rattachement, échoue ensemble.
    expect(appels.utilisateurCree).toHaveLength(1);
    expect(appels.technicienCree).toHaveLength(0);
  });

  it("un refus sur le RATTACHEMENT n'écrit pas non plus l'habilitation, prise dans le ROLLBACK", async () => {
    const { client, appels } = fabriquerClientFactice({
      echecTechnicien: new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "test" },
      ),
    });

    const resultat = await creerTechnicien(
      CONTEXTE_ADMIN,
      SAISIE_VALIDE,
      client,
    );

    expect(resultat).toEqual({ accepte: false, motif: "agence_hors_societe" });
    // L'écriture de l'habilitation a été TENTÉE — c'est le fonctionnement
    // normal d'une transaction interactive PostgreSQL : elle s'exécute, et
    // c'est le ROLLBACK automatique du `$transaction` qui la défait avec le
    // rattachement à l'échec de ce dernier. Ce gardien tient la moitié qui
    // lui revient : que les deux écritures vivent dans le MÊME appel à
    // `$transaction` (voir le test précédent, qui compte les ouvertures).
    expect(appels.utilisateurSocieteCree).toHaveLength(1);
    expect(appels.technicienCree).toHaveLength(0);
  });
});

describe("un courriel déjà pris rattache, il ne duplique jamais (gardien)", () => {
  it("l'identité existante est réutilisée — AUCUN `utilisateur.create`", async () => {
    const { client, appels } = fabriquerClientFactice({
      utilisateurExistant: { id: "0192f0a0-0000-7000-8000-0000000000ex" },
    });

    const resultat = await creerTechnicien(
      CONTEXTE_ADMIN,
      SAISIE_VALIDE,
      client,
    );

    expect(resultat).toEqual({
      accepte: true,
      utilisateurId: "0192f0a0-0000-7000-8000-0000000000ex",
      rattache: true,
    });
    expect(appels.utilisateurCree).toHaveLength(0);
    expect(
      (appels.utilisateurSocieteCree[0] as { utilisateur_id: string })
        .utilisateur_id,
    ).toBe("0192f0a0-0000-7000-8000-0000000000ex");
    // DEUX ouvertures seulement : la lecture par désignation (pas de
    // création, l'identité existe déjà), puis l'habilitation + le
    // rattachement ensemble.
    expect(appels.transactionsOuvertes).toBe(2);
  });

  it("une identité NOUVELLE dit `rattache: false`", async () => {
    const { client } = fabriquerClientFactice({ utilisateurExistant: null });

    const resultat = await creerTechnicien(
      CONTEXTE_ADMIN,
      SAISIE_VALIDE,
      client,
    );

    expect(resultat.accepte).toBe(true);
    expect(resultat.accepte && resultat.rattache).toBe(false);
  });

  it("une personne déjà membre de la société active est refusée, jamais dupliquée", async () => {
    const { client, appels } = fabriquerClientFactice({
      utilisateurExistant: { id: "0192f0a0-0000-7000-8000-0000000000ex" },
      echecUtilisateurSociete: erreurUnicite(),
    });

    const resultat = await creerTechnicien(
      CONTEXTE_ADMIN,
      SAISIE_VALIDE,
      client,
    );

    expect(resultat).toEqual({ accepte: false, motif: "deja_membre" });
    expect(appels.technicienCree).toHaveLength(0);
  });
});

describe("modifier un technicien — l'agence et l'activité, rien d'autre", () => {
  it("écrit exactement `agence_id` et `actif`", async () => {
    const { client, appels } = fabriquerClientFactice({});

    const resultat = await modifierTechnicien(
      CONTEXTE_ADMIN,
      "0192f0a0-0000-7000-8000-0000000000te",
      { agence_id: "0192f0a0-0000-7000-8000-0000000000ag", actif: false },
      client,
    );

    expect(resultat).toEqual({ accepte: true });
    expect(appels.technicienModifie).toEqual([
      { agence_id: "0192f0a0-0000-7000-8000-0000000000ag", actif: false },
    ]);
  });
});
