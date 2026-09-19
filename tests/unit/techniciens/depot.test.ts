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
 * territoire de ce lot. Un test qui exigerait `TEST_DATABASE_URL` ferait
 * échouer `pnpm verify` sur tout poste qui n'a pas préparé cette base — c'est-
 * à-dire `pnpm verify` lui-même, qui ne la prépare pas.
 *
 * Le paramètre `client?: PrismaClient` de `creerTechnicien` et
 * `modifierTechnicien` existe précisément pour cette substitution — le même
 * paramètre que chaque dépôt du dépôt porte pour ses scénarios d'isolation.
 * Ici, il reçoit un OBJET qui rejoue le contrat minimal que ces deux fonctions
 * utilisent : `$transaction`, `$executeRawUnsafe`, et les trois modèles
 * écrits. Ce qu'il prouve : la FORME du code — une seule transaction, l'ordre
 * des écritures, ce qui se passe quand l'une d'elles refuse. Ce qu'il ne
 * prouve PAS : qu'une politique RLS réelle mord — c'est la moitié que
 * `tests/isolation/` tient déjà pour `technicien`, `utilisateur_societe` et
 * `utilisateur`, et que ce lot n'a pas à redémontrer.
 */

const CONTEXTE_ADMIN: ContexteSession = {
  utilisateurId: "0192f0a0-0000-7000-8000-0000000000a0",
  societeId: "0192f0a0-0000-7000-8000-0000000000s0",
  role: Role.admin_societe,
  // admin_societe exige un second facteur (D40) : sans lui, la validation de
  // contexte refuse avant même d'ouvrir la transaction, et le test ne
  // prouverait rien de ce module.
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
  /** Nombre d'ouvertures de `$transaction` — la preuve qu'il n'y en a qu'une. */
  transactionsOuvertes: number;
};

/**
 * Un client Prisma FACTICE portant le sous-ensemble de méthodes que
 * `lib/techniciens/depot.ts` appelle réellement, et rien de plus — un test
 * qui en ajouterait davantage masquerait un appel que le dépôt ne fait pas.
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

  const client = {
    $transaction: async (
      travail: (tx: unknown) => Promise<unknown>,
    ): Promise<unknown> => {
      appels.transactionsOuvertes += 1;
      return travail(tx);
    },
  } as unknown as PrismaClient;

  return { client, appels };
}

function erreurUnicite(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("créer un technicien — les trois lignes, une seule transaction (gardien)", () => {
  it("les trois écritures ont lieu dans UNE SEULE transaction interactive", async () => {
    const { client, appels } = fabriquerClientFactice({});

    const resultat = await creerTechnicien(CONTEXTE_ADMIN, SAISIE_VALIDE, client);

    expect(resultat.accepte).toBe(true);
    // UNE seule ouverture de `$transaction` — `avecContexteApplicatif` en
    // ouvre une, et `creerTechnicienDans` n'en ouvre aucune autre : les trois
    // écritures vivent dans le MÊME aller-retour PostgreSQL, ce qui est la
    // condition pour qu'un ROLLBACK les défasse ensemble.
    expect(appels.transactionsOuvertes).toBe(1);
    expect(appels.utilisateurCree).toHaveLength(1);
    expect(appels.utilisateurSocieteCree).toHaveLength(1);
    expect(appels.technicienCree).toHaveLength(1);
    // Les trois portent le MÊME `utilisateur_id` — la même personne, la même
    // transaction.
    const idCree = (appels.utilisateurCree[0] as { id: string }).id;
    expect(
      (appels.utilisateurSocieteCree[0] as { utilisateur_id: string })
        .utilisateur_id,
    ).toBe(idCree);
    expect(
      (appels.technicienCree[0] as { utilisateur_id: string }).utilisateur_id,
    ).toBe(idCree);
  });

  it("un refus sur la DERNIÈRE écriture n'en laisse AUCUNE réussir en surface", async () => {
    const { client, appels } = fabriquerClientFactice({
      echecTechnicien: new Error("panne simulée sur technicien.create"),
    });

    await expect(
      creerTechnicien(CONTEXTE_ADMIN, SAISIE_VALIDE, client),
    ).rejects.toThrow("panne simulée");

    // Les deux premières écritures ont été TENTÉES — c'est le fonctionnement
    // normal d'une transaction interactive PostgreSQL : elles s'exécutent,
    // et c'est le ROLLBACK automatique du `$transaction` qui les défait
    // toutes les deux à l'échec de la troisième. Ce gardien tient la moitié
    // qui lui revient : que les trois écritures vivent dans le MÊME appel à
    // `$transaction`, condition sans laquelle aucun rollback ne pourrait les
    // regrouper.
    expect(appels.utilisateurCree).toHaveLength(1);
    expect(appels.utilisateurSocieteCree).toHaveLength(1);
    expect(appels.technicienCree).toHaveLength(0);
    expect(appels.transactionsOuvertes).toBe(1);
  });

  it("une personne déjà membre de la société active est refusée, jamais dupliquée", async () => {
    const { client, appels } = fabriquerClientFactice({
      echecUtilisateurSociete: erreurUnicite(),
    });

    const resultat = await creerTechnicien(CONTEXTE_ADMIN, SAISIE_VALIDE, client);

    expect(resultat).toEqual({ accepte: false, motif: "deja_membre" });
    expect(appels.technicienCree).toHaveLength(0);
  });

  it("une agence hors de la société active est refusée avec le bon motif", async () => {
    const { client } = fabriquerClientFactice({
      echecTechnicien: new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "test" },
      ),
    });

    const resultat = await creerTechnicien(CONTEXTE_ADMIN, SAISIE_VALIDE, client);

    expect(resultat).toEqual({
      accepte: false,
      motif: "agence_hors_societe",
    });
  });
});

describe("un courriel déjà pris rattache, il ne duplique jamais (gardien)", () => {
  it("l'identité existante est réutilisée — AUCUN `utilisateur.create`", async () => {
    const { client, appels } = fabriquerClientFactice({
      utilisateurExistant: { id: "0192f0a0-0000-7000-8000-0000000000ex" },
    });

    const resultat = await creerTechnicien(CONTEXTE_ADMIN, SAISIE_VALIDE, client);

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
  });

  it("une identité NOUVELLE dit `rattache: false`", async () => {
    const { client } = fabriquerClientFactice({ utilisateurExistant: null });

    const resultat = await creerTechnicien(CONTEXTE_ADMIN, SAISIE_VALIDE, client);

    expect(resultat.accepte).toBe(true);
    expect(resultat.accepte && resultat.rattache).toBe(false);
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
