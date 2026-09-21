import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { motifDeLErreur } from "@/lib/agences/depot";

/**
 * LA TRADUCTION DES REFUS DE LA BASE (AGENCE-1, DÉFAUT 1 — revue Codex de #275).
 *
 * ## Le défaut mesuré
 *
 * `agence_territoire_verrou_ecarts` (D49,
 * `prisma/migrations/20260823130000_territoire_du_ferie_reference/migration.sql`,
 * lignes 231-269) refuse un changement de territoire tant que des écarts de
 * calendrier subsistent, désignés selon l'ANCIEN territoire — un conflit
 * MÉTIER ordinaire. Avant ce correctif, `motifDeLErreur` ne reconnaissait que
 * `P2002` et `P2025`, et exigeait `instanceof Prisma.
 * PrismaClientKnownRequestError` en première porte : un `RAISE EXCEPTION`
 * sans code SQLSTATE explicite ne l'est pas, le refus traversait le `catch`
 * de `modifierAgence` intact, et remontait comme un 500 générique — la faute
 * exacte qui a coûté deux pannes de production cette semaine.
 *
 * ## Pourquoi cette épreuve n'a pas de base derrière elle
 *
 * Ce bac à sable ne joint aucun PostgreSQL ni Docker (`pg_isready`,
 * `docker info` — voir la proposition #275) : `tests/isolation/
 * ecriture-agences.test.ts` porte le scénario contre une VRAIE base, mais ne
 * peut pas tourner ici. `motifDeLErreur` est une fonction PURE — aucune
 * base, aucun contexte — et reçoit exactement le TEXTE que PostgreSQL rend
 * pour ce déclencheur précis (mesuré dans la migration, copié ci-dessous),
 * ce qui permet d'éprouver la traduction sans ouvrir de connexion.
 */

/**
 * Le texte RÉEL du `RAISE EXCEPTION`, tel qu'il est écrit dans
 * `prisma/migrations/20260823130000_territoire_du_ferie_reference/migration.sql`
 * (lignes 261-264) — jamais reformulé : c'est un extrait fidèle qui prouve
 * que la traduction lit le message qu'une vraie base rendrait, pas une
 * approximation.
 */
const MESSAGE_DU_DECLENCHEUR =
  "Territoire de l'agence DUCOS : changement NC → FR refusé. 2 écart(s) de " +
  "calendrier subsistent (du 2027-01-01 au 2027-05-08) et désignent les " +
  "fériés de NC. Un changement de territoire les invalide. Marche à " +
  "suivre : traiter d'abord les écarts de cette agence — supprimer les " +
  "ponts qui n'ont plus lieu d'être, et réadosser chaque férié travaillé " +
  "au fait public du NOUVEAU territoire — puis changer le territoire.";

describe("motifDeLErreur — le verrou de territoire (D49, DÉFAUT 1 de la revue #275)", () => {
  it("reconnaît le refus du déclencheur `agence_territoire_verrou_ecarts`, même hors de `PrismaClientKnownRequestError`", () => {
    // Le déclencheur lève un `RAISE EXCEPTION` SANS SQLSTATE explicite :
    // Prisma le remonte comme une erreur générique, jamais comme un
    // `PrismaClientKnownRequestError` — un `Error` ordinaire en est le
    // représentant le plus fidèle qu'on puisse fabriquer sans base.
    const erreurDuDeclencheur = new Error(MESSAGE_DU_DECLENCHEUR);

    expect(motifDeLErreur(erreurDuDeclencheur)).toBe("territoire_ecarts");
  });

  it("reste indifférente à l'identité de l'agence et aux dates portées par le message", () => {
    const autreAgence = new Error(
      "Territoire de l'agence KONE : changement FR → NC refusé. 1 écart(s) " +
        "de calendrier subsistent (du 2028-07-14 au 2028-07-14) et " +
        "désignent les fériés de FR. Un changement de territoire les invalide.",
    );
    expect(motifDeLErreur(autreAgence)).toBe("territoire_ecarts");
  });

  it("continue de reconnaître un code déjà pris et une fiche introuvable — non-régression", () => {
    // La traduction du verrou de territoire est lue AVANT le contrôle
    // `instanceof PrismaClientKnownRequestError` (voir l'en-tête de
    // `motifDeLErreur`) : elle ne doit donc pas absorber les deux motifs que
    // ce contrôle tenait déjà.
    const dejaPris = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test" },
    );
    const introuvable = new Prisma.PrismaClientKnownRequestError(
      "An operation failed because it depends on one or more records that were required but not found",
      { code: "P2025", clientVersion: "test" },
    );
    expect(motifDeLErreur(dejaPris)).toBe("code_pris");
    expect(motifDeLErreur(introuvable)).toBe("introuvable");
  });

  it("rend `null` sur une erreur ordinaire, sans texte de déclencheur ni code Prisma connu", () => {
    expect(
      motifDeLErreur(new Error("connexion réinitialisée par le pair")),
    ).toBe(null);
    expect(motifDeLErreur("une chaîne quelconque")).toBe(null);
  });
});
