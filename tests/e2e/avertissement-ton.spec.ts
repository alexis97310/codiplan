import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, type Locator, test } from "@playwright/test";

import { CLASSES_TON } from "@/lib/theme/statuts";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M13 (audit GR du 26/09/2026, constat M13) — « PRÉVENU PAR COURRIEL » EN
 * TON DE CONFIRMATION, PAS D'AVERTISSEMENT.
 *
 * Les trois clés `…_parti` du compte-rendu de planification annoncent un
 * SUCCÈS — le client, le technicien ou l'ancien technicien a bien été
 * prévenu — et portaient pourtant le même orange que les cinq clés qui
 * disent l'inverse (`_non_parti`, `_sans_destinataire`, `habilitation`).
 * `tonDeLAvertissement` (`lib/avertissements/ton.ts`) distingue désormais les
 * deux familles ; les deux écrans qui affichent ce compte-rendu
 * (`/planning`, `/interventions/[id]`) en tirent leurs classes.
 *
 * ## Deux écrans, deux scènes
 *
 * `/planning` ne dépend d'aucune donnée : le compte-rendu vient entièrement
 * de l'URL (`avertissement=<clé>`, répété), comme `avertissements-1.spec.ts`
 * l'établit déjà. La fiche d'intervention lit le MÊME paramètre, mais exige
 * une intervention réelle pour se rendre : scène PROPRE, préfixée `ERGO13-`,
 * créée et supprimée par cette seule épreuve — jamais `SCENE.*` (modèle
 * `demandes-marquer-transformee.spec.ts`).
 */

const PREFIXE = "ERGO13-";
const RAISON_SOCIALE = `${PREFIXE}Client (épreuve ton)`;
const LIBELLE_SITE = `${PREFIXE}Lieu (épreuve ton)`;

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

const CLE_SUCCES = "intervention.avertissement.courriel_client_parti";
const CLE_AVERTISSEMENT =
  "intervention.avertissement.courriel_client_non_parti";

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);

    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
        temps_trajet_min: 10,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        type: "curatif",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

/** La classe rendue porte-t-elle CHACUN des jetons du ton attendu ? */
async function verifierTon(
  locator: Locator,
  ton: keyof typeof CLASSES_TON,
): Promise<void> {
  const classes = (await locator.getAttribute("class")) ?? "";
  const portees = classes.split(/\s+/);
  for (const jeton of CLASSES_TON[ton].split(" ")) {
    expect(portees).toContain(jeton);
  }
}

test.describe.configure({ mode: "serial" });

test("/planning : « parti » en succès, « non parti » en avertissement", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(
    `/planning?avertissement=${CLE_SUCCES}&avertissement=${CLE_AVERTISSEMENT}`,
  );

  await verifierTon(
    page.locator(`[data-avertissement="${CLE_SUCCES}"]`),
    "succes",
  );
  await verifierTon(
    page.locator(`[data-avertissement="${CLE_AVERTISSEMENT}"]`),
    "avertissement",
  );
});

test("la fiche d'intervention : même distinction", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto(
    `/interventions/${INTERVENTION_ID}?avertissement=${CLE_SUCCES}&avertissement=${CLE_AVERTISSEMENT}`,
  );

  await verifierTon(
    page.locator(`[data-avertissement="${CLE_SUCCES}"]`),
    "succes",
  );
  await verifierTon(
    page.locator(`[data-avertissement="${CLE_AVERTISSEMENT}"]`),
    "avertissement",
  );
});
