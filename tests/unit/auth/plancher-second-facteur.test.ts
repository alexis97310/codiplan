import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  creerAuth,
  DUREE_VERROUILLAGE_SECONDES,
  SEUIL_ECHECS_SECOND_FACTEUR,
  SEUIL_ESCALADE_VERROUILLAGE,
} from "@/lib/auth/config";

import { RACINE } from "../outils/fichiers-source";

/**
 * LES TROIS VALEURS DU PLANCHER, ET LES DEUX ENDROITS QUI LES APPLIQUENT
 * (arbitrage du 08/09/2026, D64).
 *
 * ## Ce que ce gardien confronte, et pourquoi il ne recopie rien
 *
 * Le seuil d'échecs et la durée sont appliqués par la **bibliothèque** ; le
 * seuil d'escalade est appliqué par un **déclencheur PostgreSQL**. Trois valeurs
 * métier, deux exécutants qui ne se parlent pas : c'est exactement la situation
 * où deux lectures d'un même critère divergent en silence, chacune restant juste
 * de son côté (§9, 01/09).
 *
 * Le gardien les fait donc **répondre l'une à côté de l'autre** :
 *
 *   - les deux premières sont lues dans les options RÉELLEMENT construites par
 *     `creerAuth`, jamais dans le texte du fichier — c'est ce que la
 *     bibliothèque recevra, et non ce que quelqu'un a écrit à côté ;
 *   - la troisième est lue dans le **SQL de la migration**, une source que ce
 *     module ne contrôle pas.
 *
 * ## Le piège de la population, fermé
 *
 * Le critère de sélection ne porte sur rien de ce que le gardien fait
 * respecter : la migration est nommée, et son absence fait échouer la lecture
 * plutôt que vider la population.
 */

const MIGRATION = join(
  RACINE,
  "prisma",
  "migrations",
  "20260908160000_plancher_second_facteur_d62",
  "migration.sql",
);

describe("les valeurs du plancher sont celles qui ont été arbitrées", () => {
  it("la bibliothèque reçoit le seuil et la durée — lus dans les options, pas dans le texte", () => {
    const options = creerAuth().options;
    const greffon = options.plugins?.find((p) => p.id === "two-factor") as
      { options?: { accountLockout?: Record<string, unknown> } } | undefined;
    const verrouillage = greffon?.options?.accountLockout;

    // TÉMOIN : sans cette assertion, un greffon disparu rendrait `undefined` et
    // les deux comparaisons suivantes ne compareraient rien.
    expect(
      verrouillage,
      "le greffon de second facteur ne porte aucune configuration de " +
        "verrouillage : le plancher est alors celui de la bibliothèque, " +
        "c'est-à-dire une décision prise par personne.",
    ).toBeDefined();

    expect(verrouillage!.enabled).toBe(true);
    expect(verrouillage!.maxFailedAttempts).toBe(SEUIL_ECHECS_SECOND_FACTEUR);
    expect(verrouillage!.durationSeconds).toBe(DUREE_VERROUILLAGE_SECONDES);
  });

  it("le déclencheur porte le MÊME seuil d'escalade que le module", () => {
    const sql = readFileSync(MIGRATION, "utf8");

    // TÉMOIN DE NON-VACUITÉ : la migration existe et porte bien le déclencheur.
    expect(sql).toContain("second_facteur_escalade");

    const declaration = /seuil\s+CONSTANT\s+INTEGER\s*:=\s*(\d+)\s*;/.exec(sql);
    expect(
      declaration,
      "le déclencheur d'escalade ne déclare plus son seuil sous la forme " +
        "attendue : ce gardien ne peut plus le confronter au module, et les " +
        "deux valeurs peuvent diverger sans que rien ne rougisse.",
    ).not.toBeNull();
    expect(Number(declaration![1])).toBe(SEUIL_ESCALADE_VERROUILLAGE);
  });

  it("les trois valeurs sont cohérentes entre elles", () => {
    // Un seuil au-dessous de cinq verrouillerait au moment MÊME où le défi
    // s'épuise — la bibliothèque n'en compare que cinq par défi.
    expect(SEUIL_ECHECS_SECOND_FACTEUR).toBeGreaterThan(5);
    // Une durée qui exigerait un appel au support ferait dépendre
    // l'exploitation d'un tiers : un `admin_societe` bloqué n'a personne dans
    // sa société pour le débloquer.
    expect(DUREE_VERROUILLAGE_SECONDES).toBeLessThanOrEqual(3600);
    // Sans escalade, l'arithmétique ne se ferme pas.
    expect(SEUIL_ESCALADE_VERROUILLAGE).toBeGreaterThan(1);
  });
});
