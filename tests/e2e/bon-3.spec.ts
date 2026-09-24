import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { dateCivile } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { formatAdresseSite } from "@/lib/interventions/bon";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 69-BON-3 — LE BON IMPRIMABLE DIT QUAND, QUOI, OÙ ET POURQUOI : IDENTIFICATION
 * COMPLÈTE.
 *
 * ## Le constat
 *
 * L'en-tête du bon (`app/(back-office)/interventions/[id]/bon/page.tsx`) ne
 * portait que Client, Site, Agence, Machine — ni date, ni nature, ni adresse,
 * ni numéro de série, ni motif. `lireBonIntervention`
 * (`lib/interventions/bon.ts`) rend désormais `adresseSite`, `contact` et
 * `machinesIdentifiees` (marque, référence ET numéro de série), et la page
 * les affiche.
 *
 * ## Ce que ce fichier prouve, et que l'unitaire ne peut pas prouver
 *
 * `tests/unit/interventions/bon-3.test.ts` éprouve `formatAdresseSite`, pur.
 * Il ne prouve pas qu'un ÉCRAN RÉEL affiche la date, la nature, l'adresse et
 * le numéro de série d'une machine précise — c'est ce que ce fichier joue, à
 * travers le navigateur.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `BON3-` (même discipline que
 * `tests/e2e/registre-3.spec.ts` et `tests/e2e/formulaires-2.spec.ts`)
 *
 * Un client, un site (avec une adresse ET une commune), une machine de S/N
 * `BON3-SN-1`, une intervention `terminee` — créés en `beforeAll`, supprimés
 * en `afterAll`, aucune ligne ajoutée au semis.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_BON3 = uuidv7();
const SITE_BON3 = uuidv7();
const MACHINE_BON3 = uuidv7();
const INTERVENTION_BON3 = uuidv7();

/** LA DATE PLANIFIÉE, FIXE : un `dateCivile` déterministe, pas `now()`. */
const DATE_PLANIFIEE_BON3 = "2026-09-20";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_BON3,
        societe_id: societe.id,
        raison_sociale: fr["bon3.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_BON3,
        societe_id: societe.id,
        client_id: CLIENT_BON3,
        agence_id: agence.id,
        libelle: fr["bon3.e2e.site"],
        adresse: { rue: fr["bon3.e2e.rue"] },
        commune: fr["bon3.e2e.commune"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_BON3,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_BON3,
        site_id: SITE_BON3,
        numero_serie: fr["bon3.e2e.numero_serie"],
        qr_token: engendrerJetonQr(),
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "description", "date_planifiee", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'terminee'::"StatutIntervention", $6, $7::date, now())`,
      INTERVENTION_BON3,
      societe.id,
      CLIENT_BON3,
      SITE_BON3,
      agence.id,
      fr["bon3.e2e.panne"],
      DATE_PLANIFIEE_BON3,
    );
    await client.interventionMachine.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        intervention_id: INTERVENTION_BON3,
        machine_id: MACHINE_BON3,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_BON3,
    );
    await client.machine.deleteMany({ where: { id: MACHINE_BON3 } });
    await client.site.deleteMany({ where: { id: SITE_BON3 } });
    await client.client.deleteMany({ where: { id: CLIENT_BON3 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/69-BON-3/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test("le bon affiche la date, la nature, l'adresse et la machine identifiée par son numéro de série", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_BON3}/bon`);

  // LA DATE — `date_planifiee` sans créneau, lue par `dateCivile` (jamais un
  // fuseau, colonne `@db.Date`).
  await expect(
    page.getByText(dateCivile(new Date(`${DATE_PLANIFIEE_BON3}T00:00:00Z`)), {
      exact: true,
    }),
  ).toBeVisible();

  // LA NATURE.
  await expect(
    page.getByText(fr["type_intervention.curatif"], { exact: true }),
  ).toBeVisible();

  // L'ADRESSE — la rue ET la commune, en une ligne composée par la MÊME
  // fonction que `lireBonIntervention` (§9, 01/09 : jamais une seconde
  // lecture du format qui pourrait diverger).
  const adresseAttendue = formatAdresseSite(
    { rue: fr["bon3.e2e.rue"] },
    fr["bon3.e2e.commune"],
  );
  expect(adresseAttendue).not.toBeNull();
  await expect(
    page.getByText(adresseAttendue as string, { exact: true }),
  ).toBeVisible();

  // LA MACHINE, IDENTIFIÉE PAR SON NUMÉRO DE SÉRIE — jamais son seul modèle.
  await expect(page.getByText(fr["bon3.e2e.numero_serie"])).toBeVisible();

  // LE MOTIF DE L'INTERVENTION.
  await expect(
    page.getByText(fr["bon3.e2e.panne"], { exact: true }),
  ).toBeVisible();

  await capturer(page, "bon-identification-complete");
});
