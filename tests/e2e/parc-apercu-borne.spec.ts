import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * L'APERÇU DU PARC, VU PAR UN HUMAIN, SUR UNE MACHINE À QUINZE ANS D'HISTOIRE
 * (PARC-1).
 *
 * Ce que ce scénario prouve, et que l'épreuve d'isolation ne peut pas
 * prouver : que l'écran RENDU garde ses trois lignes de « Derniers
 * événements » une fois la lecture bornée — ni zéro, ni quinze. Ce qu'il ne
 * prouve PAS, et qui est écrit pour ne pas être cru : le nombre de lignes que
 * la requête ramène. *Trois lignes à l'écran passaient aussi avec l'ancien
 * code* — c'est `tests/isolation/historique-machine-borne.test.ts` qui compte
 * ce que la requête rend.
 *
 * `CAPTURES_PARC_1=<dossier>` fait écrire la capture à 1280 px et
 * `mesure.json` — l'empreinte du commit, l'horodatage, le nombre
 * d'interventions EN BASE pour la machine et le nombre de lignes RENDUES.
 *
 * ## La scène
 *
 * Quinze interventions terminées, une par an de 2011 à 2025 — « quinze ans de
 * factures » — posées sur la première machine en service de la société
 * d'épreuve, et retirées à la fin. Des dates PASSÉES et distinctes : elles
 * ne tombent dans aucune semaine de planning, ne comptent dans aucune file
 * d'attente, et l'ordre « du plus récent au plus ancien » est sans ambiguïté.
 */

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_PARC_1 ?? "";
const ANNEES = 15;
const PREMIERE_ANNEE = 2011;
const LIGNES_DE_L_APERCU = 3;

function idIntervention(rang: number): string {
  return `e2e00000-0000-7000-8000-0000000151${String(rang).padStart(2, "0")}`;
}

function idRattachement(rang: number): string {
  return `e2e00000-0000-7000-8000-0000000152${String(rang).padStart(2, "0")}`;
}

type Scene = {
  readonly machineId: string;
  readonly numeroSerie: string;
  readonly enBase: number;
};

let scene: Scene;

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const machine = await client.machine.findFirstOrThrow({
      where: { societe_id: societe.id, statut: "en_service" },
      select: {
        id: true,
        numero_serie: true,
        client_id: true,
        site: { select: { id: true, agence_id: true } },
      },
      orderBy: { numero_serie: "asc" },
    });
    for (let rang = 0; rang < ANNEES; rang += 1) {
      const id = idIntervention(rang);
      // `delete` puis `create` : une scène repart d'un état connu, et le
      // verrou de cycle de vie refuse la réécriture d'une ligne terminée.
      await client.intervention.deleteMany({ where: { id } });
      await client.intervention.create({
        data: {
          id,
          societe_id: societe.id,
          agence_id: machine.site.agence_id,
          client_id: machine.client_id,
          site_id: machine.site.id,
          type: "curatif",
          priorite: "p3",
          statut: "terminee",
          date_planifiee: new Date(Date.UTC(PREMIERE_ANNEE + rang, 0, 1)),
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
        },
      });
      await client.$executeRawUnsafe(
        `INSERT INTO "intervention_machine" ("id", "societe_id", "intervention_id", "machine_id", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now())`,
        idRattachement(rang),
        societe.id,
        id,
        machine.id,
      );
    }
    // LE TÉMOIN — la machine porte bien ses rattachements EN BASE, et plus
    // que l'aperçu n'en montre : sans lui, une scène qui n'aurait rien posé
    // ferait passer « trois lignes » pour une borne alors que ce serait tout.
    const enBase = await client.interventionMachine.count({
      where: { societe_id: societe.id, machine_id: machine.id },
    });
    expect(enBase).toBeGreaterThanOrEqual(ANNEES);
    scene = {
      machineId: machine.id,
      numeroSerie: machine.numero_serie,
      enBase,
    };
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    // Le rattachement suit l'intervention (`ON DELETE CASCADE`).
    await client.intervention.deleteMany({
      where: {
        id: { in: Array.from({ length: ANNEES }, (_, r) => idIntervention(r)) },
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test("l'aperçu rend TROIS événements sur une machine qui en porte quinze — et les trois plus récents", async ({
  page,
}) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
  // La sélection vit dans l'URL (N-10) ; la recherche par n° de série rend
  // la machine seule dans la liste, la sélection n'a plus à la chercher.
  await page.goto(
    `/parc?q=${encodeURIComponent(scene.numeroSerie)}&machine=${scene.machineId}`,
  );
  await expect(page.locator('[data-bloc="apercu-hero"]')).toBeVisible();
  // C'est bien ELLE : une seule ligne dans la liste, et sa sous-ligne porte
  // le n° de série (N-12) — l'aperçu est celui de la ligne sélectionnée.
  const lignes = page.locator('[data-bloc="liste-machines"] a');
  await expect(lignes).toHaveCount(1);
  await expect(lignes.first().locator("p")).toContainText(scene.numeroSerie);

  const evenements = page.locator('[data-bloc="apercu-timeline"] > div');
  await expect(evenements).toHaveCount(LIGNES_DE_L_APERCU);
  // Les plus RÉCENTS — l'année la plus haute posée par la scène est en tête
  // à moins qu'une intervention de démonstration plus récente ne la précède ;
  // dans les deux cas, aucune des trois ne date de la première année.
  const details = await evenements.locator("p:nth-child(3)").allTextContents();
  expect(details.some((d) => d.includes(String(PREMIERE_ANNEE)))).toBe(false);

  if (DOSSIER_CAPTURES !== "") {
    mkdirSync(DOSSIER_CAPTURES, { recursive: true });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, "parc-apercu--1280.png"),
      fullPage: true,
    });
    writeFileSync(
      join(DOSSIER_CAPTURES, "mesure.json"),
      `${JSON.stringify(
        {
          commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
          horodatage: new Date().toISOString(),
          largeur: FENETRE.width,
          hauteur: FENETRE.height,
          machine: scene.numeroSerie,
          interventions_en_base: scene.enBase,
          evenements_rendus: await evenements.count(),
          details_rendus: details,
        },
        null,
        2,
      )}\n`,
    );
  }
});
