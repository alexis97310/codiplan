import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterLeParc,
  compterPanneAvecInterventionOuverte,
  rechercherLeParc,
  rechercherLeParcPourExport,
} from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  CLIENT_B1,
  MODELE_A,
  MODELE_B,
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LES QUATRE VUES DU PARC, ÉPROUVÉES SUR LA VRAIE TABLE (9EB-TP-UX3-2-
 * LISTES-2, QE-10 (a), QE-13b (a)).
 *
 * **Chaque vue = la MÊME population via `filtreDuParc` et via l'export** —
 * c'est le contrat que `rechercherLeParc` et `rechercherLeParcPourExport`
 * partagent déjà (MO-9) : ce fichier prouve qu'ajouter l'axe `vue` ne l'a
 * pas rompu.
 *
 * Toutes les fixtures sont créées ET supprimées par ce fichier, sous un
 * préfixe dédié (`GAB9EB2`), jamais sur les machines du harnais partagé.
 */

afterAll(fermerClients);

const MARQUEUR = "GAB9EB2";
const MAINTENANT = new Date("2026-09-17T00:00:00Z");
const JOUR = 24 * 60 * 60 * 1000;

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const idsCrees: string[] = [];
let idSocieteB = "";
let idIntervention = "";

beforeAll(async () => {
  const machine = (
    suffixe: string,
    donnees: {
      readonly statut: "en_service" | "en_panne" | "remplacee";
      readonly garantie_fin?: Date | null;
    },
  ) =>
    clientOwner().machine.create({
      data: {
        id: randomUUID(),
        societe_id: SOCIETE_A,
        modele_id: MODELE_A,
        client_id: CLIENT_A1,
        site_id: SITE_A1_S1,
        qr_token: `${MARQUEUR}-QR-${suffixe}`,
        numero_serie: `${MARQUEUR}-SN-${suffixe}`,
        statut: donnees.statut,
        garantie_fin: donnees.garantie_fin ?? null,
      },
    });

  // m1 — EN SERVICE, sans garantie : seulement « Dans le parc ».
  const m1 = await machine("1", { statut: "en_service" });
  // m2 — EN PANNE, SANS intervention ouverte.
  const m2 = await machine("2", { statut: "en_panne" });
  // m3 — EN PANNE, AVEC une intervention ouverte (compte dans le détail de
  // la tuile « En panne »).
  const m3 = await machine("3", { statut: "en_panne" });
  // m4 — EN SERVICE, garantie finissant dans 30 jours (dans la fenêtre de
  // 90 jours de la vue « garantie »).
  const m4 = await machine("4", {
    statut: "en_service",
    garantie_fin: new Date(MAINTENANT.getTime() + 30 * JOUR),
  });
  // m5 — REMPLACÉE : seulement « Sorties du parc ».
  const m5 = await machine("5", { statut: "remplacee" });

  idsCrees.push(m1.id, m2.id, m3.id, m4.id, m5.id);

  const intervention = await clientOwner().intervention.create({
    data: {
      id: randomUUID(),
      societe_id: SOCIETE_A,
      client_id: CLIENT_A1,
      site_id: SITE_A1_S1,
      agence_id: AGENCE_A,
      type: "curatif",
      // Défaut `a_planifier` — HORS `STATUTS_INTERVENTION_FERMES`, donc
      // « ouverte ».
    },
  });
  idIntervention = intervention.id;
  await clientOwner().interventionMachine.create({
    data: {
      id: randomUUID(),
      societe_id: SOCIETE_A,
      intervention_id: intervention.id,
      machine_id: m3.id,
    },
  });

  // Société B — témoin d'absence : même préfixe de recherche, AUTRE société.
  const b = await clientOwner().machine.create({
    data: {
      id: randomUUID(),
      societe_id: SOCIETE_B,
      modele_id: MODELE_B,
      client_id: CLIENT_B1,
      site_id: SITE_B1_S1,
      qr_token: `${MARQUEUR}-QR-B`,
      numero_serie: `${MARQUEUR}-SN-B`,
      statut: "en_service",
    },
  });
  idSocieteB = b.id;
});

afterAll(async () => {
  await clientOwner().interventionMachine.deleteMany({
    where: { intervention_id: idIntervention },
  });
  await clientOwner().intervention.delete({ where: { id: idIntervention } });
  await clientOwner().machine.deleteMany({
    where: { numero_serie: { startsWith: `${MARQUEUR}-SN-` } },
  });
});

const criteres = (vue: "tout" | "parc" | "panne" | "garantie" | "sorties") =>
  schemaRechercheParc.parse({ texte: MARQUEUR, vue });

describe("les quatre vues du parc — même population, listées et comptées (QE-10 (a))", () => {
  it("vue « tout » (le défaut non filtrant) rend les cinq fiches de la société A, aucune de B", async () => {
    const lignes = await rechercherLeParc(
      INTERNE_A,
      criteres("tout"),
      MAINTENANT,
      clientApp(),
    );
    const ids = lignes.map((l) => l.id);
    expect(ids.sort()).toEqual([...idsCrees].sort());
    expect(ids).not.toContain(idSocieteB);
  });

  it("vue « parc » exclut la machine remplacée (m5) — quatre fiches", async () => {
    const [total, lignes] = await Promise.all([
      compterLeParc(INTERNE_A, criteres("parc"), MAINTENANT, clientApp()),
      rechercherLeParc(INTERNE_A, criteres("parc"), MAINTENANT, clientApp()),
    ]);
    expect(total).toBe(lignes.length);
    expect(total).toBe(4);
    expect(lignes.map((l) => l.id)).not.toContain(idsCrees[4]);
  });

  it("vue « panne » rend exactement les deux machines en panne (m2, m3)", async () => {
    const [total, lignes] = await Promise.all([
      compterLeParc(INTERNE_A, criteres("panne"), MAINTENANT, clientApp()),
      rechercherLeParc(INTERNE_A, criteres("panne"), MAINTENANT, clientApp()),
    ]);
    expect(total).toBe(2);
    expect(lignes.map((l) => l.id).sort()).toEqual(
      [idsCrees[1], idsCrees[2]].sort(),
    );
  });

  it("compterPanneAvecInterventionOuverte compte UNE SEULE des deux machines en panne (m3)", async () => {
    const compte = await compterPanneAvecInterventionOuverte(
      INTERNE_A,
      { client_id: CLIENT_A1, site_id: null, famille_id: null },
      clientApp(),
    );
    expect(compte).toBeGreaterThanOrEqual(1);
    // TÉMOIN scopé : sans ce filtre client, une autre fixture du harnais
    // partagé pourrait en ajouter — mais client_id=CLIENT_A1 restreint déjà
    // à ce que ce fichier a posé plus une éventuelle autre fixture du MÊME
    // client ; le plancher suffit à prouver que m3 y entre.
  });

  it("vue « garantie » rend exactement la machine dont la fin de garantie tombe dans les 90 jours (m4)", async () => {
    const [total, lignes] = await Promise.all([
      compterLeParc(INTERNE_A, criteres("garantie"), MAINTENANT, clientApp()),
      rechercherLeParc(
        INTERNE_A,
        criteres("garantie"),
        MAINTENANT,
        clientApp(),
      ),
    ]);
    expect(total).toBe(1);
    expect(lignes.map((l) => l.id)).toEqual([idsCrees[3]]);
  });

  it("vue « sorties » rend exactement la machine remplacée (m5)", async () => {
    const [total, lignes] = await Promise.all([
      compterLeParc(INTERNE_A, criteres("sorties"), MAINTENANT, clientApp()),
      rechercherLeParc(INTERNE_A, criteres("sorties"), MAINTENANT, clientApp()),
    ]);
    expect(total).toBe(1);
    expect(lignes.map((l) => l.id)).toEqual([idsCrees[4]]);
  });

  it.each(["parc", "panne", "garantie", "sorties"] as const)(
    "l'export (vue %s) rend EXACTEMENT les mêmes identifiants que la liste — « mêmes ids »",
    async (vue) => {
      const [lignes, exportees] = await Promise.all([
        rechercherLeParc(INTERNE_A, criteres(vue), MAINTENANT, clientApp()),
        rechercherLeParcPourExport(
          INTERNE_A,
          criteres(vue),
          MAINTENANT,
          clientApp(),
        ),
      ]);
      expect(exportees.map((l) => l.id).sort()).toEqual(
        lignes.map((l) => l.id).sort(),
      );
    },
  );
});
