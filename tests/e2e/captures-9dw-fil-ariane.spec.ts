import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES APRÈS DU FIL D'ARIANE DE 9DR (9DW-SOLDE-9DR) — six écrans, à
 * 1280 et 375 px : fiche client, fiche site, fiche machine, fiche demande,
 * `/parametres/agences/<id>` et `/parametres/agences/calendrier/<id>`.
 *
 * Rien n'est écrit sans `CAPTURES_9DW` (même convention que les autres
 * specs `captures-*`/`zz-captures-*`) : `pnpm test:e2e` ordinaire n'écrit
 * jamais de fichier, et — comme O6 l'a corrigé pour `zz-captures-9dn`/`9do`
 * — ne forge même pas la scène ci-dessous.
 *
 * SA PROPRE SCÈNE, préfixée `9DW-CAPT-` — un client, un site, une machine et
 * une demande, même forme que `tests/e2e/9dr-fil-d-ariane.spec.ts`, créés en
 * `beforeAll`, supprimés en `afterAll`. Jamais `SCENE.*` partagée : l'ADV se
 * connecte (`ouvrirUneSession`), et l'agence DUCOS, lue en LECTURE SEULE, est
 * celle qui porte déjà son calendrier.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9DW ?? "";

// SANS CAPTURES_9DW, CE FICHIER NE CRÉE RIEN (même correctif que O6).
test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9DW");

const CLIENT_9DW = uuidv7();
const SITE_9DW = uuidv7();
const MACHINE_9DW = uuidv7();
const DEMANDE_9DW = uuidv7();

let agenceId = "";
let calendrierId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true, calendrier_id: true },
    });
    if (agence.calendrier_id === null) {
      throw new Error("DUCOS est sans calendrier dans le jeu de démonstration");
    }
    agenceId = agence.id;
    calendrierId = agence.calendrier_id;

    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9DW,
        societe_id: societeId,
        raison_sociale: fr["9dw.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DW,
        societe_id: societeId,
        client_id: CLIENT_9DW,
        agence_id: agenceId,
        libelle: fr["9dw.e2e.site"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9DW,
        societe_id: societeId,
        modele_id: modele.id,
        client_id: CLIENT_9DW,
        site_id: SITE_9DW,
        numero_serie: "9DW-CAPT-SN-1",
        qr_token: engendrerJetonQr(),
      },
    });
    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_9DW,
        societe_id: societeId,
        source: "appel",
        client_id: CLIENT_9DW,
        site_id: SITE_9DW,
        agence_id: agenceId,
        description: fr["9dw.e2e.demande_description"],
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.demande.deleteMany({ where: { id: DEMANDE_9DW } });
    await client.machine.deleteMany({ where: { client_id: CLIENT_9DW } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9DW } });
    await client.client.deleteMany({ where: { id: CLIENT_9DW } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

const ECRANS: ReadonlyArray<[string, () => string]> = [
  ["fiche-client", () => `/clients/${CLIENT_9DW}`],
  ["fiche-site", () => `/sites/${SITE_9DW}`],
  ["fiche-machine", () => `/parc/${MACHINE_9DW}`],
  ["fiche-demande", () => `/demandes/${DEMANDE_9DW}`],
  ["fiche-agence", () => `/parametres/agences/${agenceId}`],
  ["fiche-calendrier", () => `/parametres/agences/calendrier/${calendrierId}`],
];

for (const [nom, url] of ECRANS) {
  for (const largeur of [1280, 375] as const) {
    test(`capture — ${nom}, à ${largeur}px`, async ({ page }) => {
      await page.goto(url());
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, nom, largeur);
    });
  }
}
