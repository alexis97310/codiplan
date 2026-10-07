import { randomUUID } from "node:crypto";

import { type StatutImportLot } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { compterLesLots, listerLesLots } from "@/lib/imports/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LES PUCES DE « DERNIERS IMPORTS », ÉPROUVÉES SUR LA VRAIE TABLE
 * (9EB-TP-UX3-2-LISTES-2, QE-10 (a)).
 *
 * `compterLesLots` doit rendre EXACTEMENT `.length` de ce que `listerLesLots`
 * ouvrirait pour la même vue (§9, 01/09) — le même contrat que les puces du
 * parc. Fixtures créées ET supprimées par ce fichier, sous un marqueur dédié.
 */

afterAll(fermerClients);

const MARQUEUR = "GABIMP9EB2";

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const idsCrees: string[] = [];

beforeAll(async () => {
  const lot = (
    suffixe: string,
    statut: StatutImportLot,
    lignesRejets: number,
  ) =>
    clientOwner().importLot.create({
      data: {
        id: randomUUID(),
        societe_id: SOCIETE_A,
        type_import: "clients",
        version_modele: 1,
        utilisateur_id: UTILISATEUR_INTERNE_A,
        nom_fichier: `${MARQUEUR}-${suffixe}.xlsx`,
        statut,
        lignes_rejets: lignesRejets,
        // La contrainte `import_lot_dates_suivent_le_statut` exige
        // `applique_le` dès que `statut = applique` (I6, D15).
        applique_le: statut === "applique" ? new Date() : null,
      },
    });

  // L1 — CONTRÔLÉ, avec des rejets : entre dans « À appliquer » ET « Avec
  // des rejets ».
  const l1 = await lot("controle-rejets", "controle", 2);
  // L2 — APPLIQUÉ, sans rejet : entre dans « Tous » seulement.
  const l2 = await lot("applique", "applique", 0);

  idsCrees.push(l1.id, l2.id);
});

afterAll(async () => {
  await clientOwner().importLot.deleteMany({
    where: { nom_fichier: { startsWith: `${MARQUEUR}-` } },
  });
});

describe("les puces de « Derniers imports » comptent EXACTEMENT ce que leur lien ouvre", () => {
  it("« Tous » — les deux lots, et le compte vaut la longueur de la liste", async () => {
    const [total, lots] = await Promise.all([
      compterLesLots(SESSION_A, "tous", clientApp()),
      listerLesLots(SESSION_A, "tous", clientApp()),
    ]);
    const idsVus = lots.map((l) => l.id).filter((id) => idsCrees.includes(id));
    expect(idsVus.sort()).toEqual([...idsCrees].sort());
    expect(total).toBeGreaterThanOrEqual(idsCrees.length);
  });

  it("« À appliquer » — seulement le lot encore `controle`", async () => {
    const lots = await listerLesLots(SESSION_A, "a-appliquer", clientApp());
    const idsVus = lots.map((l) => l.id).filter((id) => idsCrees.includes(id));
    expect(idsVus).toEqual([idsCrees[0]]);
  });

  it("« Avec des rejets » — seulement le lot dont lignes_rejets > 0", async () => {
    const [total, lots] = await Promise.all([
      compterLesLots(SESSION_A, "rejets", clientApp()),
      listerLesLots(SESSION_A, "rejets", clientApp()),
    ]);
    const idsVus = lots.map((l) => l.id).filter((id) => idsCrees.includes(id));
    expect(idsVus).toEqual([idsCrees[0]]);
    expect(total).toBe(lots.length);
  });
});
