import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99Z-GR10-PARC, décision A (26/09/2026) — les fiches INCOMPLÈTES passent en
 * FIN de liste.
 *
 * ## LE CONSTAT
 *
 * `rechercherLeParc` (`lib/machines/depot.ts`) triait jusqu'ici
 * `{ complet: "asc" }` — les incomplètes EN TÊTE. La règle ne vivait qu'en
 * commentaire (R2-21), absente de `docs/arbitrages.md`, et aucun test ne
 * l'imposait. Alexis, 26/09/2026 : l'exception attend en bas plutôt que
 * d'enterrer les fiches exploitables sous elle — `{ complet: "desc" }`.
 *
 * ## LA SCÈNE — préfixée `PARCA-`, créée et supprimée par l'épreuve
 *
 * Un client, un site, une famille et un modèle dédiés (D6 : une machine sans
 * site n'existe pas). Deux machines du MÊME modèle chez le MÊME client — l'une
 * `complet: true`, l'autre `complet: false` — pour que seul `complet` les
 * départage, jamais le client ni la désignation. La recherche `q=PARCAREF`
 * isole ces deux lignes de tout le reste du parc (démonstration et scènes des
 * autres fichiers, joués en parallèle). Aucune ligne au semis
 * (`prisma/seed*.ts`), rien écrit dans une fixture `SCENE.*` partagée.
 */

test.describe.configure({ mode: "serial" });

const REFERENCE_MODELE = "PARCAREF";
const MARQUE_MODELE = "PARCAMARQUE";

let admin: PrismaClient;
let clientId: string;
let siteId: string;
let machineCompleteId: string;
let machineIncompleteId: string;
let familleId: string;
let modeleId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: fr["parcincomplet.e2e.client"],
      actif: true,
    },
  });
  clientId = client.id;

  const site = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: fr["parcincomplet.e2e.site"],
    },
  });
  siteId = site.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `PARCAFAM${randomUUID().slice(0, 6)}`,
      libelle: "PARCA-Famille",
    },
  });
  familleId = famille.id;

  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: MARQUE_MODELE,
      reference: REFERENCE_MODELE,
    },
  });
  modeleId = modele.id;

  const [machineComplete, machineIncomplete] = await Promise.all([
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientId,
        site_id: siteId,
        qr_token: `PARCAQR${randomUUID().slice(0, 20)}`,
        numero_serie: "PARCA-SN-COMPLETE",
        complet: true,
      },
    }),
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientId,
        site_id: siteId,
        qr_token: `PARCAQR${randomUUID().slice(0, 20)}`,
        numero_serie: "PARCA-SN-INCOMPLETE",
        complet: false,
      },
    }),
  ]);
  machineCompleteId = machineComplete.id;
  machineIncompleteId = machineIncomplete.id;
});

test.afterAll(async () => {
  try {
    await admin.machine.deleteMany({ where: { modele_id: modeleId } });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la fiche incomplète vient après la fiche complète, à client et désignation égaux", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/parc?q=${encodeURIComponent(REFERENCE_MODELE)}`);
  await expect(page.locator('[data-bloc="maitre-detail"]')).toBeVisible();

  // Les DEUX lignes de l'épreuve, et elles seules (`q` isole `PARCAREF`) —
  // repérées par leur `href`, jamais par un texte : même client, même
  // désignation de modèle, seul `complet` les départage.
  const liens = page.locator('[data-bloc="liste-machines"] a');
  await expect(liens).toHaveCount(2);
  const hrefs = await liens.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("href") ?? ""),
  );
  const indexComplete = hrefs.findIndex((href) =>
    href.includes(machineCompleteId),
  );
  const indexIncomplete = hrefs.findIndex((href) =>
    href.includes(machineIncompleteId),
  );
  expect(indexComplete).toBeGreaterThanOrEqual(0);
  expect(indexIncomplete).toBeGreaterThanOrEqual(0);
  expect(indexComplete).toBeLessThan(indexIncomplete);
});
